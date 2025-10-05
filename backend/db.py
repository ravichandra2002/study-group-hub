# backend/db.py
import os
from functools import lru_cache
from urllib.parse import urlparse
from flask import g
from pymongo import MongoClient, ASCENDING, DESCENDING
from helpers import university_from_email, tenant_from_request

# ----------------- Client -----------------

def _default_db_name_from_uri(uri: str) -> str:
    try:
        parsed = urlparse(uri)
        if parsed.path and len(parsed.path) > 1:
            return parsed.path.strip("/").split("/")[0]
    except Exception:
        pass
    return os.getenv("MONGO_DB_NAME", "study_group_hub")

@lru_cache(maxsize=1)
def _client() -> MongoClient:
    uri = os.getenv("MONGO_URI") or ""
    if not uri:
        uri = "mongodb://127.0.0.1:27017/study_group_hub"
    return MongoClient(uri, uuidRepresentation="standard")

# ----------------- Per-tenant DB helpers -----------------

def client() -> MongoClient:
    return _client()

def db_name_for_tenant(tenant: str) -> str:
    return f"study_group_hub_{tenant}"

def db_for_tenant(tenant: str):
    return client()[db_name_for_tenant(tenant)]

def db_for_email(email: str):
    """
    Use during signup/login before you have a JWT.
    Raises ValueError if email is not a university email.
    """
    _, tenant, dbname = university_from_email(email)
    return client()[dbname]

def bind_request_db():
    """
    Bind g.db for authed requests using the tenant in JWT (if present).
    Falls back to default DB so public routes keep working.
    """
    t = tenant_from_request()
    if t:
        g.db = db_for_tenant(t)
    else:
        # legacy fallback (single-tenant)
        if "db" not in g:
            uri = os.getenv("MONGO_URI", "")
            g.db = client()[_default_db_name_from_uri(uri)]

# ----------------- Public API -----------------

def get_db():
    if "db" not in g:
        bind_request_db()
    return g.db

def close_db(e=None):
    g.pop("db", None)

# --- bootstrap helpers (same as before) ---
def ensure_user_indexes(db):
    try:
        db.users.create_index("email", unique=True, background=True)
    except Exception:
        pass

def ensure_group_indexes(db):
    try:
        db.study_groups.create_index([("ownerId", ASCENDING)], background=True)
        db.study_groups.create_index([("members._id", ASCENDING)], background=True)
        db.study_groups.create_index(
            [("isOpen", ASCENDING), ("createdAt", DESCENDING)],
            background=True,
        )
        try:
            db.study_groups.create_index([("title", "text"), ("course", "text")], background=True)
        except Exception:
            pass
    except Exception:
        pass
