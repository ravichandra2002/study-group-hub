# # backend/app.py
# from datetime import datetime
# import os
# import traceback

# from flask import Flask, jsonify, current_app, Blueprint
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


# def _register_blueprints(app: Flask) -> None:
#     # ---- auth (optional; stub is fine) ------------------------------------
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


#     # ---- availability -----------------------------------------------------
#     try:
#         from blueprints.availability import availability_bp
#         app.register_blueprint(availability_bp)
#         print("[app] registered availability blueprint")
#     except Exception as e:
#         print("[app] failed to import availability:", e)

#     # ---- meetings ---------------------------------------------------------
#     try:
#         from blueprints.meetings import meetings_bp
#         app.register_blueprint(meetings_bp)
#         print("[app] registered meetings blueprint")
#     except Exception as e:
#         print("[app] failed to import meetings:", e)    

#     # ---- groups (REQUIRED; try two locations; NO STUB) --------------------
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

#     # ---- /api/me (optional; stub is fine) ---------------------------------
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

#     # ----- CORS (Vite runs on :5173) --------------------------------------
#     client_origin = app.config.get("CLIENT_ORIGIN") or os.environ.get(
#         "CLIENT_ORIGIN", "http://localhost:5173"
#     )
#     CORS(
#         app,
#         resources={r"/api/*": {"origins": [client_origin]}},
#         methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
#         allow_headers=["Authorization", "Content-Type"],
#         expose_headers=["Authorization", "Content-Type", "Content-Disposition"],
#         supports_credentials=False,  # we use Authorization header, not cookies
#     )

#     # ----- JWT -------------------------------------------------------------
#     JWTManager(app)

#     # Bind tenant DB (based on JWT) on every request. Public routes still OK.
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

#     # DB lifecycle
#     app.teardown_appcontext(close_db)

#     # # Best-effort index bootstrap
#     # with app.app_context():
#     #     try:
#     #         db = get_db()
#     #         ensure_user_indexes(db)
#     #         ensure_group_indexes(db)
#     #     except Exception as e:
#     #         print("[db] bootstrap skipped:", e)

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
from datetime import datetime
import os
import traceback

from flask import Flask, jsonify, current_app, Blueprint
from flask_cors import CORS
from flask_jwt_extended import (
    JWTManager, jwt_required, get_jwt_identity, verify_jwt_in_request
)
from flask_socketio import SocketIO

from config import Config
from db import (
    get_db, close_db, ensure_user_indexes, ensure_group_indexes, bind_request_db
)
from sockets import ChatNamespace


def _register_blueprints(app: Flask) -> None:

        # ---- notifications ----------------------------------------------------
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

    # CORS for your Vite dev origin
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

    app.teardown_appcontext(close_db)
    _register_blueprints(app)

    base_dir = os.path.dirname(os.path.abspath(__file__))
    app.config.setdefault("UPLOAD_DIR", os.path.join(base_dir, "uploads"))
    app.config.setdefault("MAX_CONTENT_LENGTH", 16 * 1024 * 1024)
    os.makedirs(app.config["UPLOAD_DIR"], exist_ok=True)

    return app


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

if __name__ == "__main__":
    socketio.run(app, host="0.0.0.0", port=5050, debug=True)
