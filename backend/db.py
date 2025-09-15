# backend/db.py
import os
from urllib.parse import urlparse, parse_qs
from functools import lru_cache
from flask import g
from pymongo import MongoClient, ASCENDING, DESCENDING

# --------------------------
# Connection & DB selection
# --------------------------

def _db_name_from_uri(uri: str) -> str:
    """
    Extract db name from Mongo URI (e.g. .../study_group_hub?...)
    If none present, fall back to MONGO_DB_NAME env, else 'study_group_hub'.
    """
    try:
        parsed = urlparse(uri)
        # path => '/dbname' when provided
        if parsed.path and len(parsed.path) > 1:
            # strip leading '/' and any trailing slashes
            path = parsed.path.strip("/")
            # in case something like '/dbname/extra' (rare), take first part
            return path.split("/")[0]
    except Exception:
        pass
    return os.getenv("MONGO_DB_NAME", "study_group_hub")


@lru_cache(maxsize=1)
def _client() -> MongoClient:
    uri = os.getenv("MONGO_URI") or getattr(__import__("config").Config, "MONGO_URI", None)
    if not uri:
        raise RuntimeError("MONGO_URI is not set. Check backend/.env")
    return MongoClient(uri)


@lru_cache(maxsize=1)
def _db_name() -> str:
    uri = os.getenv("MONGO_URI") or getattr(__import__("config").Config, "MONGO_URI", None)
    return _db_name_from_uri(uri or "")


def get_db():
    """
    Returns a per-request handle to the configured database (cached on flask.g).
    The underlying MongoClient is shared (memoized) across requests.
    """
    if "db" not in g:
        g.db = _client()[_db_name()]
    return g.db


def close_db(e=None):
    """
    We keep the global client alive; nothing to close per request.
    Clearing g.db is enough.
    """
    g.pop("db", None)


# --------------------------
# Optional: bootstrap indexes
# --------------------------

def ensure_user_indexes(db):
    # Unique index for email; safe to call repeatedly.
    db.users.create_index("email", unique=True, background=True)


def ensure_group_indexes(db):
    """
    Ensures the study_groups collection exists and has useful indexes.
    Using unnamed indexes keeps them idempotent even if they already exist
    under the default name (e.g., ownerId_1).
    """
    # Calling create_index implicitly creates the collection if it doesn't exist.
    db.study_groups.create_index([("ownerId", ASCENDING)], background=True)
    db.study_groups.create_index([("members._id", ASCENDING)], background=True)
    db.study_groups.create_index([("isOpen", ASCENDING), ("createdAt", DESCENDING)], background=True)
    # Text search (title, course). Different clusters can error if a text index
    # already exists with another definition; ignore in that case.
    try:
        db.study_groups.create_index([("title", "text"), ("course", "text")], background=True)
    except Exception:
        pass


# Handy helper for a quick health/debug route (optional)
def list_collections(db):
    return sorted(db.list_collection_names())
