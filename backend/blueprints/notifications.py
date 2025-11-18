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

from datetime import datetime
from typing import Any, Dict, Optional, Sequence

from bson import ObjectId
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity

from db import get_db

notifications_bp = Blueprint(
    "notifications_bp",
    __name__,
    url_prefix="/api/notifications",
)


# --------------------------------------------------------------------- helpers


def _as_oid(v: Any) -> Optional[ObjectId]:
    try:
        return ObjectId(str(v))
    except Exception:
        return None


def _utcnow() -> datetime:
    return datetime.utcnow()


def _ensure_indexes(db):
    """Make sure the notifications collection + indexes exist."""
    try:
        db.notifications.create_index(
            [("userId", 1), ("createdAt", -1)],
            background=True,
        )
        db.notifications.create_index(
            [("read", 1), ("userId", 1)],
            background=True,
        )
    except Exception:
        # Indexes might already exist, ignore errors here
        pass


def _user_match(uid_str: str) -> Dict[str, Any]:
    """
    Match notifications where userId is stored either as string or ObjectId.
    """
    parts = [{"userId": uid_str}]
    oid = _as_oid(uid_str)
    if oid:
        parts.append({"userId": oid})
    return {"$or": parts}


def _iso(dt: Optional[datetime]) -> str:
    if not isinstance(dt, datetime):
        dt = _utcnow()
    return dt.isoformat() + ("Z" if dt.tzinfo is None else "")


# --------------------------------------------------------------------- public helper for other blueprints


def create_notification(
    user_id: Any,
    *,
    type: str,
    title: str,
    message: str = "",
    slot: Optional[Dict[str, Any]] = None,
    link: Optional[str] = None,
    group_id: Optional[Any] = None,
    meta: Optional[Dict[str, Any]] = None,
    requestor: Optional[Dict[str, Any]] = None,
) -> None:
    """
    Helper to insert a notification from other blueprints.

    Example (in meetings.py, when sending a request):

        from blueprints.notifications import create_notification

        create_notification(
            receiver_id,
            type="meeting_request",
            title="New meeting request",
            message="Alice proposed a time on Tuesday.",
            slot={"day": "Tue", "from": "11:00", "to": "12:00"},
            link="/meetings",
            group_id=group_id,
            meta={"meetingId": str(meeting_doc["_id"])},
            requestor={"_id": sender_id, "name": sender_name, "email": sender_email},
        )
    """
    if not user_id:
        return

    db = get_db()
    _ensure_indexes(db)

    doc: Dict[str, Any] = {
        "userId": str(user_id),
        "type": type,
        "title": title,
        "message": message or "",
        "slot": slot or {},
        "link": link,
        "groupId": str(group_id) if group_id is not None else None,
        "meta": meta or {},
        "requestor": requestor or {},
        "read": False,
        "createdAt": _utcnow(),
        "readAt": None,
    }

    db.notifications.insert_one(doc)


# --------------------------------------------------------------------- routes


@notifications_bp.get("/list")
@jwt_required()
def list_my_notifications():
    """
    GET /api/notifications/list
    Optional query params:
      - all=1       -> include read notifications too
      - limit=20    -> max number to return (default 20, max 100)
    """
    db = get_db()
    _ensure_indexes(db)
    uid = str(get_jwt_identity())

    include_all = request.args.get("all") in {"1", "true", "True"}
    try:
        limit = int(request.args.get("limit", 20))
    except ValueError:
        limit = 20
    limit = max(1, min(limit, 100))

    query: Dict[str, Any] = _user_match(uid)
    if not include_all:
        # default: only unread
        query["read"] = {"$ne": True}

    cur = (
        db.notifications.find(query)
        .sort("createdAt", -1)
        .limit(limit)
    )

    items = []
    me = uid
    for n in cur:
        # For meeting_request we hide the one where I am the requester.
        if n.get("type") == "meeting_request":
            req = n.get("requestor") or {}
            if str(req.get("_id", "")) == me:
                continue

        created = n.get("createdAt") or _utcnow()
        item = {
            "_id": str(n["_id"]),
            "type": n.get("type"),
            "title": n.get("title"),
            "message": n.get("message") or "",
            "slot": n.get("slot") or {},
            "link": n.get("link"),
            "groupId": str(n.get("groupId")) if n.get("groupId") else None,
            "meta": n.get("meta") or {},
            "read": bool(n.get("read", False)),
            "createdAt": _iso(created),
        }
        items.append(item)

    return jsonify(items), 200


@notifications_bp.get("/unread-count")
@jwt_required()
def unread_count():
    """
    GET /api/notifications/unread-count
    -> { "count": <number> }
    """
    db = get_db()
    _ensure_indexes(db)
    uid = str(get_jwt_identity())

    query = {**_user_match(uid), "read": {"$ne": True}}
    count = db.notifications.count_documents(query)
    return jsonify({"count": int(count)}), 200


@notifications_bp.post("/mark-read")
@jwt_required()
def mark_read():
    """
    POST /api/notifications/mark-read
    Body can be:
      { "id": "<singleId>" }             # backward compatible
    or
      { "ids": ["id1", "id2", ...] }     # multiple
    """
    db = get_db()
    _ensure_indexes(db)
    uid = str(get_jwt_identity())
    data = request.get_json() or {}

    ids_raw: Sequence[Any]
    if "ids" in data and isinstance(data["ids"], (list, tuple)):
        ids_raw = data["ids"]
    else:
        # fallback to single "id" field
        single = (data.get("id") or "").strip()
        ids_raw = [single] if single else []

    oids = [_as_oid(v) for v in ids_raw if _as_oid(v)]
    if not oids:
        return jsonify({"ok": False, "error": "valid notification id(s) required"}), 400

    res = db.notifications.update_many(
        {"_id": {"$in": oids}, **_user_match(uid)},
        {"$set": {"read": True, "readAt": _utcnow()}},
    )

    if res.matched_count == 0:
        return jsonify({"ok": False, "error": "Not found"}), 404

    return jsonify({"ok": True, "updated": int(res.modified_count)}), 200


def _mark_all_read_for_user(db, uid: str):
    return db.notifications.update_many(
        {**_user_match(uid), "read": {"$ne": True}},
        {"$set": {"read": True, "readAt": _utcnow()}},
    )


@notifications_bp.post("/clear")
@jwt_required()
def clear_all_my_notifications():
    """
    POST /api/notifications/clear
    Mark all my notifications as read.
    (Kept for backward compatibility.)
    """
    db = get_db()
    _ensure_indexes(db)
    uid = str(get_jwt_identity())
    _mark_all_read_for_user(db, uid)
    return jsonify({"ok": True}), 200


@notifications_bp.post("/mark-all-read")
@jwt_required()
def mark_all_read():
    """
    POST /api/notifications/mark-all-read
    Same as /clear, but with a more explicit name.
    """
    db = get_db()
    _ensure_indexes(db)
    uid = str(get_jwt_identity())
    _mark_all_read_for_user(db, uid)
    return jsonify({"ok": True}), 200
