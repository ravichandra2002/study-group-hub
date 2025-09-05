import os
from dotenv import load_dotenv
load_dotenv()

class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "dev")
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "devjwt")
    MONGO_URI = os.getenv("MONGO_URI")
    CLIENT_ORIGIN = os.getenv("CLIENT_ORIGIN", "http://localhost:5173")
