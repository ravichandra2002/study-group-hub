
# from __future__ import annotations
# from flask import Blueprint, jsonify, request
# from flask_jwt_extended import jwt_required, get_jwt_identity
# from bson import ObjectId
# from datetime import datetime
# from db import get_db

# notifications_bp = Blueprint("notifications_bp", __name__, url_prefix="/api/notifications")

# def _as_oid(v):
#     try:
#         return ObjectId(v)
#     except Exception:
#         return None

# def _ensure_indexes(db):
#     if "notifications" not in db.list_collection_names():
#         db.create_collection("notifications")
#     db.notifications.create_index([("userId", 1), ("createdAt", -1)], background=True)
#     db.notifications.create_index([("read", 1), ("userId", 1)], background=True)

# def _user_match(uid_str: str):
#     """
#     Build a query OR that matches either string ids or ObjectIds,
#     since you sometimes store userId as str and sometimes as ObjectId.
#     """
#     parts = [{"userId": uid_str}]
#     oid = _as_oid(uid_str)
#     if oid:
#         parts.append({"userId": oid})
#     return {"$or": parts}


# @notifications_bp.get("/list")
# @jwt_required()
# def list_my_notifications():
#     db = get_db()
#     _ensure_indexes(db)
#     uid = str(get_jwt_identity())

#     cur = db.notifications.find(
#         {**_user_match(uid), "read": {"$ne": True}}
#     ).sort("createdAt", -1)

#     items = []
#     me = uid
#     for n in cur:
#         # guard: if a self-sent "meeting_request" lands here, hide it for sender
#         if n.get("type") == "meeting_request":
#             req = n.get("requestor") or {}
#             if str(req.get("_id", "")) == me:
#                 continue

#         created = n.get("createdAt") or datetime.utcnow()
#         items.append({
#             "_id": str(n["_id"]),
#             "type": n.get("type"),
#             "title": n.get("title"),
#             "slot": n.get("slot") or {},
#             "read": bool(n.get("read", False)),
#             "createdAt": created.isoformat() + ("Z" if created.tzinfo is None else ""),
#         })
#     return jsonify(items), 200

# # ---------------------------------------------------------------------------
# # MARK ONE READ — call this when the user clicks a notification
# # ---------------------------------------------------------------------------
# @notifications_bp.post("/mark-read")
# @jwt_required()
# def mark_one_read():
#     db = get_db()
#     _ensure_indexes(db)
#     uid = str(get_jwt_identity())
#     data = request.get_json() or {}
#     nid_raw = (data.get("id") or "").strip()
#     nid = _as_oid(nid_raw)
#     if not nid:
#         return jsonify({"ok": False, "error": "valid notification id required"}), 400

#     res = db.notifications.update_one(
#         {"_id": nid, **_user_match(uid)},
#         {"$set": {"read": True, "readAt": datetime.utcnow()}}
#     )
#     if res.matched_count == 0:
#         return jsonify({"ok": False, "error": "Not found"}), 404
#     return jsonify({"ok": True}), 200


# @notifications_bp.post("/clear")
# @jwt_required()
# def clear_all_my_notifications():
#     db = get_db()
#     _ensure_indexes(db)
#     uid = str(get_jwt_identity())

#     db.notifications.update_many(
#         {**_user_match(uid), "read": {"$ne": True}},
#         {"$set": {"read": True, "readAt": datetime.utcnow()}}
#     )
#     return jsonify({"ok": True}), 200

from __future__ import annotations
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from bson import ObjectId
from datetime import datetime
from db import get_db

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
    db.notifications.create_index([("read", 1), ("userId", 1)], background=True)

def _user_match(uid_str: str):
    parts = [{"userId": uid_str}]
    oid = _as_oid(uid_str)
    if oid:
        parts.append({"userId": oid})
    return {"$or": parts}

@notifications_bp.get("/list")
@jwt_required()
def list_my_notifications():
    db = get_db()
    _ensure_indexes(db)
    uid = str(get_jwt_identity())

    cur = db.notifications.find(
        {**_user_match(uid), "read": {"$ne": True}}
    ).sort("createdAt", -1)

    items = []
    me = uid
    for n in cur:
        if n.get("type") == "meeting_request":
            req = n.get("requestor") or {}
            if str(req.get("_id", "")) == me:
                continue

        created = n.get("createdAt") or datetime.utcnow()
        items.append({
            "_id": str(n["_id"]),
            "type": n.get("type"),
            "title": n.get("title"),
            "slot": n.get("slot") or {},
            "read": bool(n.get("read", False)),
            "createdAt": created.isoformat() + ("Z" if created.tzinfo is None else ""),
        })
    return jsonify(items), 200

@notifications_bp.post("/mark-read")
@jwt_required()
def mark_one_read():
    db = get_db()
    _ensure_indexes(db)
    uid = str(get_jwt_identity())
    data = request.get_json() or {}
    nid_raw = (data.get("id") or "").strip()
    nid = _as_oid(nid_raw)
    if not nid:
        return jsonify({"ok": False, "error": "valid notification id required"}), 400

    res = db.notifications.update_one(
        {"_id": nid, **_user_match(uid)},
        {"$set": {"read": True, "readAt": datetime.utcnow()}}
    )
    if res.matched_count == 0:
        return jsonify({"ok": False, "error": "Not found"}), 404
    return jsonify({"ok": True}), 200

@notifications_bp.post("/clear")
@jwt_required()
def clear_all_my_notifications():
    db = get_db()
    _ensure_indexes(db)
    uid = str(get_jwt_identity())

    db.notifications.update_many(
        {**_user_match(uid), "read": {"$ne": True}},
        {"$set": {"read": True, "readAt": datetime.utcnow()}}
    )
    return jsonify({"ok": True}), 200
