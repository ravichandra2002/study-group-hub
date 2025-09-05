from pymongo import MongoClient
from flask import g, current_app

def get_db():
    if "db" not in g:
        client = MongoClient(current_app.config["MONGO_URI"])
        g.db_client = client
        db = client.get_default_database()
        if db is None:  # if URI misses a db name, fall back
            db = client[current_app.config.get("MONGO_DBNAME", "study_group_hub")]
        g.db = db
    return g.db

def close_db(e=None):
    client = g.pop("db_client", None)
    if client:
        client.close()
