# backend/blueprints/notifications.py
from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from bson import ObjectId
from db import get_db
from datetime import datetime

notifications_bp = Blueprint("notifications_bp", __name__, url_prefix="/api/notifications")

def _as_oid(v):
    try:
        return ObjectId(v)
    except Exception:
        return None

def _ensure_indexes(db):
    if "notifications" not in db.list_collection_names():
        db.create_collection("notifications")
    db.notifications.create_index([("userId", 1), ("createdAt", -1)], background=True)
    db.notifications.create_index([("createdAt", -1)], background=True)
    db.notifications.create_index([("read", 1)], background=True)

@notifications_bp.get("/list")
@jwt_required()
def list_my_notifications():
    db = get_db()
    _ensure_indexes(db)
    uid = get_jwt_identity()

    # Support either string or ObjectId storage
    q = {"$or": [{"userId": str(uid)}]}
    oid = _as_oid(uid)
    if oid:
        q["$or"].append({"userId": oid})

    rows = list(db.notifications.find(q).sort("createdAt", -1))

    out = []
    me = str(uid)
    for n in rows:
        # Strong extra guard: if somehow a self-sent "meeting_request"
        # lands here, ignore it for the sender.
        if n.get("type") == "meeting_request":
            req = n.get("requestor") or {}
            if str(req.get("_id", "")) == me:
                continue

        out.append({
            "_id": str(n["_id"]),
            "type": n.get("type"),
            "title": n.get("title"),
            "slot": n.get("slot") or {},
            "read": bool(n.get("read", False)),
            "createdAt": n.get("createdAt", datetime.utcnow()).isoformat() + "Z",
        })

    return jsonify(out), 200

@notifications_bp.post("/clear")
@jwt_required()
def clear_my_notifications():
    db = get_db()
    _ensure_indexes(db)
    uid = get_jwt_identity()

    q = {"$or": [{"userId": str(uid)}]}
    oid = _as_oid(uid)
    if oid:
        q["$or"].append({"userId": oid})

    db.notifications.update_many(q, {"$set": {"read": True}})
    return jsonify({"ok": True}), 200
