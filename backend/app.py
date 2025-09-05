from flask import Flask
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from config import Config
from db import close_db
from blueprints.auth import auth_bp
from blueprints.groups import groups_bp
from flask_socketio import SocketIO
from sockets import ChatNamespace

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    # Enable CORS for frontend
    CORS(app, resources={r"/api/*": {"origins": app.config.get("CLIENT_ORIGIN", "*")}})

    # Setup JWT
    JWTManager(app)

    # Register blueprints
    app.register_blueprint(auth_bp)
    app.register_blueprint(groups_bp)

    # Root route → show working text
    @app.get("/")
    def index():
        return "Backend is working!", 200

    # Close DB on teardown
    app.teardown_appcontext(close_db)

    return app

app = create_app()

# Use threading mode (safe with Python 3.13)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="threading")

# Attach chat namespace
socketio.on_namespace(ChatNamespace("/ws/chat"))

if __name__ == "__main__":
    socketio.run(app, host="0.0.0.0", port=5050)
