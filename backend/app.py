from __future__ import annotations

import os
import traceback
import time
from datetime import datetime, timezone
from typing import Optional

from flask import Flask, jsonify, current_app, Blueprint, request
from flask_cors import CORS
from flask_jwt_extended import (
    JWTManager, jwt_required, get_jwt_identity, verify_jwt_in_request
)
from flask_socketio import SocketIO
from pymongo import MongoClient

from config import Config
from db import get_db, close_db, bind_request_db
from sockets import ChatNamespace
from mailer import send_email  
import notify_socket


def _bg_db():
    """
    Standalone DB client for the background worker.
    IMPORTANT: read from app.config first so we use the SAME DB as the API.
    This function must be called inside an app_context.
    """
    uri = (
        current_app.config.get("MONGO_URI")
        or os.getenv("MONGO_URI")
        or getattr(Config, "MONGO_URI", "")
    )
    dbname = (
        current_app.config.get("MONGO_DBNAME")
        or os.getenv("MONGO_DBNAME")
        or getattr(Config, "MONGO_DBNAME", "study_group_hub")
    )
    client = MongoClient(uri, connectTimeoutMS=10000, serverSelectionTimeoutMS=10000)
    return client[dbname]


# -------------------------- blueprint registration ---------------------------
def _register_blueprints(app: Flask) -> None:
    """Import and register all HTTP blueprints."""

    # notifications
    try:
        from blueprints.notifications import notifications_bp
        app.register_blueprint(notifications_bp)
        print("[app] registered notifications blueprint")
    except Exception as e:
        print("[app] failed to import notifications:", e)

    # auth (ok to stub)
    try:
        from blueprints.auth import auth_bp  # type: ignore
        app.register_blueprint(auth_bp)
    except Exception as e:
        print("[app] auth blueprint missing, installing stub:", e)
        auth_bp = Blueprint("auth_stub", __name__, url_prefix="/api/auth")

        @auth_bp.get("/health")
        def auth_health():
            return jsonify({"ok": True}), 200

        app.register_blueprint(auth_bp)

    # availability
    try:
        from blueprints.availability import availability_bp
        app.register_blueprint(availability_bp)
        print("[app] registered availability blueprint")
    except Exception as e:
        print("[app] failed to import availability:", e)

    # meetings
    try:
        from blueprints.meetings import meetings_bp
        app.register_blueprint(meetings_bp)
        print("[app] registered meetings blueprint")
    except Exception as e:
        print("[app] failed to import meetings:", e)

    # calendar (ICS subscription)
    try:
        from blueprints.calendar import calendar_bp
        app.register_blueprint(calendar_bp)
        print("[app] registered calendar blueprint")
    except Exception as e:
        print("[app] failed to import calendar:", e)

    # discussions (mini forum)
    try:
        from blueprints.discussions import discussions_bp
        app.register_blueprint(discussions_bp)
        print("[app] registered discussions blueprint")
    except Exception as e:
        print("[app] failed to import discussions:", e)

    # resources (group files/links)
    try:
        from blueprints.resources import resources_bp
        app.register_blueprint(resources_bp)
        print("[app] registered resources blueprint")
    except Exception as e:
        print("[app] failed to import resources:", e)

    # gamification / study streaks
    try:
        from blueprints.streaks import streaks_bp
        app.register_blueprint(streaks_bp)
        print("[app] registered streaks blueprint")
    except Exception as e:
        print("[app] failed to import streaks:", e)

    # groups (REQUIRED; try two locations; no stub)
    last_err = None
    for path in ("blueprints.groups", "groups"):
        try:
            mod = __import__(path, fromlist=["groups_bp"])
            app.register_blueprint(mod.groups_bp)  # type: ignore
            print(f"[app] registered groups blueprint from {path}")
            break
        except Exception as e:
            last_err = e
            print(f"[app] could not import {path}: {e}")
            traceback.print_exc()
    else:
        raise RuntimeError(
            "FATAL: Could not import a real groups blueprint. "
            "Put your file at backend/blueprints/groups.py (with groups_bp) "
            "or at backend/groups.py."
        ) from last_err

    # /api/me (ok to fall back)
    try:
        from routes_me import me_bp  # type: ignore
        app.register_blueprint(me_bp)
    except Exception:
        try:
            from blueprints.me import me_bp as _me_bp  # type: ignore
            app.register_blueprint(_me_bp)
        except Exception as e:
            print("[app] me blueprint missing, installing stub:", e)
            me_bp = Blueprint("me_stub", __name__, url_prefix="/api/me")

            @me_bp.get("/prefs")
            def get_prefs_stub():
                return jsonify({"meetingMode": "either"}), 200

            @me_bp.post("/prefs")
            def set_prefs_stub():
                return jsonify({"ok": True, "meetingMode": "either"}), 200

            app.register_blueprint(me_bp)


# ------------------------------- app factory --------------------------------
def create_app() -> Flask:
    app = Flask(__name__)
    app.config.from_object(Config)

    # CORS for Vite dev origin
    client_origin = app.config.get("CLIENT_ORIGIN") or os.environ.get(
        "CLIENT_ORIGIN", "http://localhost:5173"
    )
    CORS(
        app,
        resources={r"/api/*": {"origins": [client_origin]}},
        methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
        expose_headers=["Authorization", "Content-Type", "Content-Disposition"],
        supports_credentials=False,
    )

    # JWT
    JWTManager(app)

    # Bind DB per request (based on JWT if present)
    @app.before_request
    def _bind_db():
        verify_jwt_in_request(optional=True)
        bind_request_db()

    # Health
    @app.get("/")
    def index():
        return "Backend is working!", 200

    @app.get("/api/health")
    def health():
        return jsonify({"ok": True}), 200

    # Debug: push a WS notify to the current user
    @app.get("/api/__debug/ping")
    @jwt_required()
    def debug_ping():
        try:
            uid = get_jwt_identity()
            room = f"user:{str(uid)}"
            sio = current_app.extensions.get("socketio")
            if not sio:
                return jsonify({"ok": False, "error": "socketio unavailable"}), 500
            payload = {"type": "debug", "text": "pong", "at": datetime.now(timezone.utc).isoformat()}
            sio.emit("notify", payload, namespace="/ws/chat", to=room)
            print(f"[ws] debug notify -> {room}: {payload}")
            return jsonify({"ok": True}), 200
        except Exception as e:
            return jsonify({"ok": False, "error": str(e)}), 500

    # Debug: quick email sender to verify SMTP credentials
    @app.get("/api/__debug/send_email")
    @jwt_required(optional=True)
    def __debug_send_email():
        to = request.args.get("to") or current_app.config.get("SMTP_USER")
        ok, err = send_email(
            to=to,
            subject="SGH: Email test ✔",
            html="""
                <div style="font-family:system-ui,Segoe UI,Arial;">
                  <h2>Study Group Hub – Email Test</h2>
                  <p>If you can read this, SMTP is working 🎉</p>
                </div>
            """,
            text="Study Group Hub – Email test. If you see this, SMTP works.",
        )
        if not ok:
            return jsonify({"ok": False, "error": err}), 500
        return jsonify({"ok": True, "sent_to": to}), 200

    # Manual trigger to run reminders now (useful for testing)
    @app.post("/api/__debug/reminders_run")
    def __debug_reminders_run():
        try:
            _reminders_tick()
            return jsonify({"ok": True}), 200
        except Exception as e:
            return jsonify({"ok": False, "error": str(e)}), 500

    # DB lifecycle
    app.teardown_appcontext(close_db)

    # Blueprints
    _register_blueprints(app)

    # ---------------- Uploads (robust) ----------------
    base_dir = os.path.dirname(os.path.abspath(__file__))
    default_upload_dir = os.path.join(base_dir, "uploads")

    cfg_dir = app.config.get("UPLOAD_DIR")
    env_dir = (os.environ.get("UPLOAD_DIR") or "").strip()

    upload_dir = (cfg_dir or env_dir or default_upload_dir)
    upload_dir = os.path.abspath(upload_dir)

    app.config["UPLOAD_DIR"] = upload_dir
    app.config.setdefault("MAX_CONTENT_LENGTH", 16 * 1024 * 1024)  # 16 MB
    os.makedirs(upload_dir, exist_ok=True)

    return app


# ---------------- App & Socket.IO bootstrap ----------------------------------
app = create_app()

socketio = SocketIO(
    app,
    cors_allowed_origins="*",
    async_mode="threading",
    ping_timeout=20,
    ping_interval=25,
)
socketio.on_namespace(ChatNamespace("/ws/chat"))

with app.app_context():
    current_app.extensions["socketio"] = socketio


# -------------------------- Reminder worker ----------------------------------
def _reminders_tick(now_utc: Optional[datetime] = None):
    """
    Send reminder emails for meetings whose reminderAt <= now and not yet sent.
    meetings.py sets `reminderAt = startAt - 30 min` on ACCEPT.
    """
    db = _bg_db()
    now = now_utc or datetime.now(timezone.utc)

    crit = {
        "status": "accepted",
        "reminderSent": {"$ne": True},
        "reminderAt": {"$ne": None, "$lte": now},
    }
    docs = list(db.meetings.find(crit).limit(100))
    if not docs:
        return

    from blueprints.meetings import _format_when, _get_user_email  # lazy import
    sio = current_app.extensions.get("socketio")

    for m in docs:
        try:
            slot = m.get("slot") or {}
            link = m.get("meetingLink")
            sender_id = str(m.get("senderId"))
            receiver_id = str(m.get("receiverId"))

            when_text, when_html = _format_when(slot)

            subject = "Reminder: your meeting starts soon"
            html = f"""
              <div style="font-family:system-ui,Segoe UI,Arial">
                <h2>Starting soon</h2>
                <p>Time: {when_html}</p>
                {f"<p>Meeting link: <a href='{link}'>{link}</a></p>" if link else ""}
              </div>
            """
            text = f"Starting soon: {when_text}. Link: {link or '(no link)'}"

            # emails
            try:
                se = _get_user_email(db, sender_id)
                re = _get_user_email(db, receiver_id)
                if se:
                    send_email(to=se, subject=subject, html=html, text=text)
                if re:
                    send_email(to=re, subject=subject, html=html, text=text)
            except Exception as e:
                print("[reminder] email error:", e)

            # in-app notifications
            payload = {
                "type": "meeting_reminder",
                "title": "Reminder: upcoming meeting",
                "slot": slot,
                "at": now.isoformat(),
            }
            try:
                if sio:
                    sio.emit("notify", payload, namespace="/ws/chat", to=f"user:{sender_id}")
                    sio.emit("notify", payload, namespace="/ws/chat", to=f"user:{receiver_id}")
            except Exception as e:
                print("[reminder] socket emit error:", e)

            # mark sent
            db.meetings.update_one({"_id": m["_id"]}, {"$set": {"reminderSent": True}})
        except Exception as e:
            print("[reminder] process item error:", e)


def _reminder_loop():
    poll_seconds = int(os.getenv("REMINDER_POLL_SECONDS", "30"))
    with app.app_context():
        print("[reminder] worker started (poll =", poll_seconds, "s)")
        while True:
            try:
                _reminders_tick()
            except Exception as e:
                print("[reminder] loop error:", e)
            time.sleep(poll_seconds)


def start_reminder_worker(flask_app: Flask):
    socketio.start_background_task(_reminder_loop)


# kick off the worker
start_reminder_worker(app)


# ------------------------------- main ----------------------------------------
if __name__ == "__main__":
    socketio.run(app, host="0.0.0.0", port=57799, debug=True)
