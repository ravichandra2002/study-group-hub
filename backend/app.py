

# # backend/app.py
# from datetime import datetime
# import os
# import traceback

# from flask import Flask, jsonify, current_app, Blueprint, request
# from flask_cors import CORS
# from flask_jwt_extended import (
#     JWTManager, jwt_required, get_jwt_identity, verify_jwt_in_request
# )
# from flask_socketio import SocketIO

# from config import Config
# from db import (
#     get_db, close_db, ensure_user_indexes, ensure_group_indexes, bind_request_db
# )
# from sockets import ChatNamespace
# from mailer import send_email  # debug email endpoint

# def _register_blueprints(app: Flask) -> None:
#     """Import and register all HTTP blueprints."""

#     # notifications (optional)
#     try:
#         from blueprints.notifications import notifications_bp
#         app.register_blueprint(notifications_bp)
#         print("[app] registered notifications blueprint")
#     except Exception as e:
#         print("[app] failed to import notifications:", e)

#     # auth (ok to stub)
#     try:
#         from blueprints.auth import auth_bp  # type: ignore
#         app.register_blueprint(auth_bp)
#     except Exception as e:
#         print("[app] auth blueprint missing, installing stub:", e)
#         auth_bp = Blueprint("auth_stub", __name__, url_prefix="/api/auth")

#         @auth_bp.get("/health")
#         def auth_health():
#             return jsonify({"ok": True}), 200

#         app.register_blueprint(auth_bp)

#     # availability
#     try:
#         from blueprints.availability import availability_bp
#         app.register_blueprint(availability_bp)
#         print("[app] registered availability blueprint")
#     except Exception as e:
#         print("[app] failed to import availability:", e)

#     # meetings
#     try:
#         from blueprints.meetings import meetings_bp
#         app.register_blueprint(meetings_bp)
#         print("[app] registered meetings blueprint")
#     except Exception as e:
#         print("[app] failed to import meetings:", e)

#     # groups (REQUIRED; try two locations; no stub)
#     last_err = None
#     for path in ("blueprints.groups", "groups"):
#         try:
#             mod = __import__(path, fromlist=["groups_bp"])
#             app.register_blueprint(mod.groups_bp)  # type: ignore
#             print(f"[app] registered groups blueprint from {path}")
#             break
#         except Exception as e:
#             last_err = e
#             print(f"[app] could not import {path}: {e}")
#             traceback.print_exc()
#     else:
#         raise RuntimeError(
#             "FATAL: Could not import a real groups blueprint. "
#             "Put your file at backend/blueprints/groups.py (with groups_bp) "
#             "or at backend/groups.py."
#         ) from last_err

#     # /api/me (ok to stub)
#     try:
#         from routes_me import me_bp  # type: ignore
#         app.register_blueprint(me_bp)
#     except Exception:
#         try:
#             from blueprints.me import me_bp as _me_bp  # type: ignore
#             app.register_blueprint(_me_bp)
#         except Exception as e:
#             print("[app] me blueprint missing, installing stub:", e)
#             me_bp = Blueprint("me_stub", __name__, url_prefix="/api/me")

#             @me_bp.get("/prefs")
#             def get_prefs_stub():
#                 return jsonify({"meetingMode": "either"}), 200

#             @me_bp.post("/prefs")
#             def set_prefs_stub():
#                 return jsonify({"ok": True, "meetingMode": "either"}), 200

#             app.register_blueprint(me_bp)

# def create_app() -> Flask:
#     app = Flask(__name__)
#     app.config.from_object(Config)

#     # CORS for Vite dev origin
#     client_origin = app.config.get("CLIENT_ORIGIN") or os.environ.get(
#         "CLIENT_ORIGIN", "http://localhost:5173"
#     )
#     CORS(
#         app,
#         resources={r"/api/*": {"origins": [client_origin]}},
#         methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
#         allow_headers=["Authorization", "Content-Type"],
#         expose_headers=["Authorization", "Content-Type", "Content-Disposition"],
#         supports_credentials=False,
#     )

#     # JWT
#     JWTManager(app)

#     # Bind DB per request (based on JWT if present)
#     @app.before_request
#     def _bind_db():
#         verify_jwt_in_request(optional=True)
#         bind_request_db()

#     # Health
#     @app.get("/")
#     def index():
#         return "Backend is working!", 200

#     @app.get("/api/health")
#     def health():
#         return jsonify({"ok": True}), 200

#     # Debug: push a WS notify to the current user
#     @app.get("/api/__debug/ping")
#     @jwt_required()
#     def debug_ping():
#         try:
#             uid = get_jwt_identity()
#             room = f"user:{str(uid)}"
#             sio = current_app.extensions.get("socketio")
#             if not sio:
#                 return jsonify({"ok": False, "error": "socketio unavailable"}), 500
#             payload = {"type": "debug", "text": "pong", "at": datetime.utcnow().isoformat() + "Z"}
#             sio.emit("notify", payload, namespace="/ws/chat", to=room)
#             print(f"[ws] debug notify -> {room}: {payload}")
#             return jsonify({"ok": True}), 200
#         except Exception as e:
#             return jsonify({"ok": False, "error": str(e)}), 500

#     # Debug: quick email sender to verify SMTP credentials
#     @app.get("/api/__debug/send_email")
#     @jwt_required(optional=True)
#     def __debug_send_email():
#         to = request.args.get("to") or current_app.config.get("SMTP_USER")
#         ok, err = send_email(
#             to=to,
#             subject="SGH: Email test ✔",
#             html="""
#                 <div style="font-family:system-ui,Segoe UI,Arial;">
#                   <h2>Study Group Hub – Email Test</h2>
#                   <p>If you can read this, SMTP is working 🎉</p>
#                 </div>
#             """,
#             text="Study Group Hub – Email test. If you see this, SMTP works.",
#         )
#         if not ok:
#             return jsonify({"ok": False, "error": err}), 500
#         return jsonify({"ok": True, "sent_to": to}), 200

#     # DB lifecycle
#     app.teardown_appcontext(close_db)

#     # Blueprints
#     _register_blueprints(app)

#     # Uploads
#     base_dir = os.path.dirname(os.path.abspath(__file__))
#     app.config.setdefault("UPLOAD_DIR", os.path.join(base_dir, "uploads"))
#     app.config.setdefault("MAX_CONTENT_LENGTH", 16 * 1024 * 1024)  # 16 MB
#     os.makedirs(app.config["UPLOAD_DIR"], exist_ok=True)

#     return app

# # ---------------- App & Socket.IO bootstrap ----------------------------------
# app = create_app()

# socketio = SocketIO(
#     app,
#     cors_allowed_origins="*",
#     async_mode="threading",
#     ping_timeout=20,
#     ping_interval=25,
# )
# socketio.on_namespace(ChatNamespace("/ws/chat"))

# with app.app_context():
#     current_app.extensions["socketio"] = socketio

# if __name__ == "__main__":
#     socketio.run(app, host="0.0.0.0", port=5050, debug=True)

# backend/app.py
from datetime import datetime, timedelta
import os
import traceback
from threading import Thread, Event

from flask import Flask, jsonify, current_app, Blueprint, request
from flask_cors import CORS
from flask_jwt_extended import (
    JWTManager, jwt_required, get_jwt_identity, verify_jwt_in_request
)
from flask_socketio import SocketIO
from pymongo import MongoClient

from config import Config
from db import (
    get_db, close_db, ensure_user_indexes, ensure_group_indexes, bind_request_db
)
from sockets import ChatNamespace
from mailer import send_email  # debug email endpoint

def _bg_db():
    """Standalone DB client for background worker (no request context)."""
    uri = os.getenv("MONGO_URI") or getattr(Config, "MONGO_URI", "")
    dbname = os.getenv("MONGO_DBNAME", "study_group_hub")
    client = MongoClient(uri, connectTimeoutMS=10000, serverSelectionTimeoutMS=10000)
    return client[dbname]

def _register_blueprints(app: Flask) -> None:
    """Import and register all HTTP blueprints."""

    try:
        from blueprints.notifications import notifications_bp
        app.register_blueprint(notifications_bp)
        print("[app] registered notifications blueprint")
    except Exception as e:
        print("[app] failed to import notifications:", e)

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

    try:
        from blueprints.availability import availability_bp
        app.register_blueprint(availability_bp)
        print("[app] registered availability blueprint")
    except Exception as e:
        print("[app] failed to import availability:", e)

    try:
        from blueprints.meetings import meetings_bp
        app.register_blueprint(meetings_bp)
        print("[app] registered meetings blueprint")
    except Exception as e:
        print("[app] failed to import meetings:", e)

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

def create_app() -> Flask:
    app = Flask(__name__)
    app.config.from_object(Config)

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

    JWTManager(app)

    @app.before_request
    def _bind_db():
        verify_jwt_in_request(optional=True)
        bind_request_db()

    @app.get("/")
    def index():
        return "Backend is working!", 200

    @app.get("/api/health")
    def health():
        return jsonify({"ok": True}), 200

    @app.get("/api/__debug/ping")
    @jwt_required()
    def debug_ping():
        try:
            uid = get_jwt_identity()
            room = f"user:{str(uid)}"
            sio = current_app.extensions.get("socketio")
            if not sio:
                return jsonify({"ok": False, "error": "socketio unavailable"}), 500
            payload = {"type": "debug", "text": "pong", "at": datetime.utcnow().isoformat() + "Z"}
            sio.emit("notify", payload, namespace="/ws/chat", to=room)
            print(f"[ws] debug notify -> {room}: {payload}")
            return jsonify({"ok": True}), 200
        except Exception as e:
            return jsonify({"ok": False, "error": str(e)}), 500

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

    app.teardown_appcontext(close_db)
    _register_blueprints(app)

    base_dir = os.path.dirname(os.path.abspath(__file__))
    app.config.setdefault("UPLOAD_DIR", os.path.join(base_dir, "uploads"))
    app.config.setdefault("MAX_CONTENT_LENGTH", 16 * 1024 * 1024)
    os.makedirs(app.config["UPLOAD_DIR"], exist_ok=True)

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

# ---------------- Reminder worker (runs every ~60s) --------------------------
stop_event = Event()

def _send_30min_reminders():
    """Find accepted meetings starting in ~30 minutes and email both sides once."""
    db = _bg_db()
    now = datetime.utcnow()
    window_start = now + timedelta(minutes=29)   # small window so we don't miss by latency
    window_end   = now + timedelta(minutes=31)

    crit = {
        "status": "accepted",
        "reminderSent": {"$ne": True},
        "startAt": {"$gte": window_start, "$lte": window_end},
    }

    matches = list(db.meetings.find(crit).limit(50))
    if not matches:
        return

    # try to resolve emails from users collection if available
    users = db.users if "users" in db.list_collection_names() else None

    for m in matches:
        slot = m.get("slot", {})
        link = m.get("meetingLink")
        when_txt = f"{slot.get('day')} {slot.get('date')} {slot.get('from')}–{slot.get('to')}"
        sender_id = str(m.get("senderId"))
        receiver_id = str(m.get("receiverId"))

        sender_email = None
        receiver_email = None
        if users:
            sdoc = users.find_one({"_id": _as_oid(sender_id)}) or users.find_one({"id": sender_id})
            rdoc = users.find_one({"_id": _as_oid(receiver_id)}) or users.find_one({"id": receiver_id})
            sender_email = sdoc.get("email") if sdoc else None
            receiver_email = rdoc.get("email") if rdoc else None

        # Send emails
        subject = "Reminder: your meeting starts in 30 minutes"
        html = f"""
            <div style="font-family:system-ui,Segoe UI,Arial">
              <h2>Starting soon (30 minutes)</h2>
              <p>Time: <strong>{when_txt}</strong></p>
              {f"<p>Meeting link: <a href='{link}'>{link}</a></p>" if link else ""}
              <p>See you there!</p>
            </div>
        """
        text = f"Starts in 30 minutes: {when_txt}. Link: {link or '(no link)'}"

        if sender_email:
            send_email(to=sender_email, subject=subject, html=html, text=text)
        if receiver_email:
            send_email(to=receiver_email, subject=subject, html=html, text=text)

        db.meetings.update_one({"_id": m["_id"]}, {"$set": {"reminderSent": True, "reminderAt": now}})

def _reminder_loop():
    with app.app_context():
        print("[reminder] worker started")
        while not stop_event.wait(60):  # every ~60s
            try:
                _send_30min_reminders()
            except Exception as e:
                print("[reminder] error:", e)

# kick it off
Thread(target=_reminder_loop, daemon=True).start()

if __name__ == "__main__":
    try:
        socketio.run(app, host="0.0.0.0", port=5050, debug=True)
    finally:
        stop_event.set()
