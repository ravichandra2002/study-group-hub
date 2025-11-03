import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

class Config:
    # --- Flask / JWT ---
    SECRET_KEY = os.getenv("SECRET_KEY", "dev")
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "devjwt")

    # --- MongoDB ---
    MONGO_URI = os.getenv("MONGO_URI", "")

    # --- Frontend Origin (Vite default) ---
    CLIENT_ORIGIN = os.getenv("CLIENT_ORIGIN", "http://localhost:5173")

    # --- Email / SMTP Configuration ---
    SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
    SMTP_PORT = int(os.getenv("SMTP_PORT", 587))
    SMTP_USER = os.getenv("SMTP_USER")  # your Gmail (e.g. studygrouphub1111@gmail.com)
    SMTP_PASS = os.getenv("SMTP_PASS")  # your 16-character App Password
    FROM_EMAIL = os.getenv("FROM_EMAIL", SMTP_USER)

    # --- Optional Debug Flags ---
    DEBUG = os.getenv("DEBUG", "True").lower() in ("true", "1", "yes")


