
from datetime import datetime
import os

from flask import Flask, jsonify, current_app
from flask_cors import CORS
from flask_jwt_extended import JWTManager, jwt_required, get_jwt_identity
from flask_socketio import SocketIO

from config import Config
from db import get_db, close_db
from blueprints.auth import auth_bp, ensure_indexes as ensure_user_indexes
from blueprints.groups import groups_bp, ensure_group_collection
from sockets import ChatNamespace


def create_app() -> Flask:
    app = Flask(__name__)
    app.config.from_object(Config)

    client_origin = app.config.get("CLIENT_ORIGIN") or os.environ.get(
        "CLIENT_ORIGIN", "http://localhost:5173"
    )

    CORS(
        app,
        resources={r"/api/*": {"origins": [client_origin]}},
        allow_headers=["Content-Type", "Authorization"],
        expose_headers=["Content-Type", "Authorization"],
        supports_credentials=False,
    )

    # JWT
    JWTManager(app)

    # Blueprints
    app.register_blueprint(auth_bp)
    app.register_blueprint(groups_bp)

    @app.get("/")
    def index():
        return "Backend is working!", 200

    @app.get("/api/health")
    def health():
        return jsonify({"ok": True}), 200

    # Debug route to test a socket notify to the current user
    @app.get("/api/__debug/ping")
    @jwt_required()
    def debug_ping():
        try:
            uid = get_jwt_identity()
            room = f"user:{str(uid)}"
            sio = current_app.extensions.get("socketio")
            if sio is None:
                # Fallback import avoids circular refs in some runners
                try:
                    from app import socketio as sio  # type: ignore
                except Exception:
                    sio = None

            if not sio:
                return jsonify({"ok": False, "error": "socketio unavailable"}), 500

            payload = {
                "type": "debug",
                "text": "pong",
                "at": datetime.utcnow().isoformat() + "Z",
            }
            sio.emit("notify", payload, namespace="/ws/chat", to=room)
            print(f"[ws] debug notify -> {room}: {payload}")
            return jsonify({"ok": True}), 200
        except Exception as e:
            return jsonify({"ok": False, "error": str(e)}), 500

    # DB lifecycle
    app.teardown_appcontext(close_db)

    # Ensure indexes/collections once on boot
    with app.app_context():
        db = get_db()
        ensure_user_indexes(db)
        ensure_group_collection(db)

    return app


# --- App & Socket.IO bootstrap ------------------------------------------------
app = create_app()

# Single namespace handles chat + notifications
# Keep CORS open for dev; tighten to [client_origin] in production if desired.
socketio = SocketIO(
    app,
    cors_allowed_origins="*",
    async_mode="threading",
    ping_timeout=20,
    ping_interval=25,
)

# Register your custom namespace
socketio.on_namespace(ChatNamespace("/ws/chat"))

# Make sure groups.py can find it via current_app.extensions["socketio"]
with app.app_context():
    current_app.extensions["socketio"] = socketio

if __name__ == "__main__":
    # Run the combined Flask + Socket.IO server
    socketio.run(app, host="0.0.0.0", port=5050, debug=True)
