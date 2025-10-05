# import os
# from dotenv import load_dotenv
# load_dotenv()

# class Config:
#     SECRET_KEY = os.getenv("SECRET_KEY", "dev")
#     JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "devjwt")
#     MONGO_URI = os.getenv("MONGO_URI")
#     CLIENT_ORIGIN = os.getenv("CLIENT_ORIGIN", "http://localhost:5173")
# backend/config.py
import os
from dotenv import load_dotenv

load_dotenv()  # loads backend/.env if present

class Config:
    # Flask / JWT
    SECRET_KEY = os.getenv("SECRET_KEY", "dev")
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "devjwt")

    # Mongo
    MONGO_URI = os.getenv("MONGO_URI", "")

    # Frontend origin (Vite default)
    CLIENT_ORIGIN = os.getenv("CLIENT_ORIGIN", "http://localhost:5173")


