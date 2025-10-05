# backend/routes_me.py
from datetime import datetime
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from bson import ObjectId

from db import get_db

me_bp = Blueprint("me", __name__, url_prefix="/api/me")

ALLOWED = {"either", "online", "oncampus"}

def ensure_prefs_collection(db):
    if "user_prefs" not in db.list_collection_names():
        db.create_collection("user_prefs")
    db.user_prefs.create_index([("userId", 1)], unique=True)

def _oid(s):
    try:
        return ObjectId(str(s))
    except Exception:
        return None

@me_bp.get("/prefs")
@jwt_required()
def get_prefs():
    db = get_db()
    ensure_prefs_collection(db)

    uid = _oid(get_jwt_identity())
    if not uid:
        return jsonify({"ok": False, "error": "Invalid user"}), 400

    doc = db.user_prefs.find_one({"userId": uid}) or {}
    mode = doc.get("meetingMode") or "either"
    return jsonify({"meetingMode": mode}), 200

@me_bp.post("/prefs")
@jwt_required()
def set_prefs():
    db = get_db()
    ensure_prefs_collection(db)

    uid = _oid(get_jwt_identity())
    if not uid:
        return jsonify({"ok": False, "error": "Invalid user"}), 400

    body = request.get_json(silent=True) or {}
    mode = str(body.get("meetingMode", "")).strip().lower()

    # normalize a few synonyms
    if mode in {"on-campus", "campus", "offline"}:
        mode = "oncampus"
    if mode in {"either", "any", "both", ""}:
        mode = "either"
    if mode not in ALLOWED:
        return jsonify({"ok": False, "error": "Invalid meetingMode"}), 400

    now = datetime.utcnow()
    db.user_prefs.update_one(
        {"userId": uid},
        {"$set": {"meetingMode": mode, "updatedAt": now}},
        upsert=True,
    )
    return jsonify({"ok": True, "meetingMode": mode}), 200
