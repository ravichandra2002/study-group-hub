from datetime import datetime, timezone
import os
import uuid

from flask import Blueprint, jsonify, request, current_app, send_from_directory
from flask_jwt_extended import jwt_required, get_jwt_identity
from bson import ObjectId
from pymongo import ASCENDING, DESCENDING, TEXT
from pymongo.errors import OperationFailure, PyMongoError
from werkzeug.utils import secure_filename

from db import get_db
from helpers import current_user  # <-- shared helper (tenant-safe)

groups_bp = Blueprint("groups", __name__, url_prefix="/api/groups")


# ---------- socket.io access -------------------------------------------------
def get_socketio():
    """
    Return the SocketIO instance without creating a circular import.
    Try current_app.extensions first; fall back to importing from app at runtime.
    """
    sio = current_app.extensions.get("socketio")
    if sio is not None:
        return sio
    try:
        from app import socketio as sio2  # type: ignore
        return sio2
    except Exception:
        return None


# ---------- collections + indexes -------------------------------------------
def _safe_create_index(coll, keys, **opts):
    """Create an index; ignore IndexOptionsConflict (code 85)."""
    try:
        coll.create_index(keys, **opts)
    except OperationFailure as e:
        if getattr(e, "code", None) == 85:
            return
        raise


def ensure_group_collection(db):
    """Create study_groups if missing; ensure indexes (and chat indexes)."""
    if "study_groups" not in db.list_collection_names():
        db.create_collection("study_groups")
    coll = db.study_groups
    _safe_create_index(coll, [("ownerId", ASCENDING)])
    _safe_create_index(coll, [("members._id", ASCENDING)])
    _safe_create_index(coll, [("isOpen", ASCENDING), ("createdAt", DESCENDING)])
    _safe_create_index(coll, [("department", ASCENDING)])  # department scoping
    try:
        _safe_create_index(coll, [("title", TEXT), ("course", TEXT)])
    except Exception:
        pass

    # --- chat collection + indexes
    if "group_messages" not in db.list_collection_names():
        db.create_collection("group_messages")
    _safe_create_index(db.group_messages, [("groupId", ASCENDING), ("createdAt", ASCENDING)], background=True)


def ensure_notifications_collection(db):
    """Create notifications if missing; ensure indexes."""
    if "notifications" not in db.list_collection_names():
        db.create_collection("notifications")
    coll = db.notifications
    _safe_create_index(coll, [("userId", ASCENDING), ("createdAt", DESCENDING)])
    _safe_create_index(coll, [("userId", ASCENDING), ("read", ASCENDING)])


# ---------- helpers ----------------------------------------------------------
def oid(v):
    """Return ObjectId or None."""
    try:
        return ObjectId(v) if isinstance(v, str) else v
    except Exception:
        return None


def serialize_member(m):
    return {"_id": str(m["_id"]), "name": m.get("name"), "email": m.get("email")}


def serialize_group(doc):
    if not doc:
        return None
    return {
        "_id": str(doc["_id"]),
        "title": doc.get("title", ""),
        "course": doc.get("course", ""),
        "department": doc.get("department"),
        "description": doc.get("description", "") or "",
        "isOpen": bool(doc.get("isOpen", True)),
        "ownerId": str(doc.get("ownerId")) if doc.get("ownerId") else None,
        "createdAt": doc.get("createdAt").isoformat() + "Z" if doc.get("createdAt") else None,
        "members": [serialize_member(m) for m in doc.get("members", [])],
        "membersCount": len(doc.get("members", [])),
        "pendingCount": doc.get("_pendingCount", 0),
        "myJoinStatus": doc.get("_myJoinStatus"),
    }


def serialize_notification(doc):
    return {
        "_id": str(doc["_id"]),
        "type": doc.get("type"),
        "title": doc.get("title"),
        "groupId": str(doc.get("groupId")) if doc.get("groupId") else None,
        "createdAt": doc.get("createdAt").isoformat() + "Z" if doc.get("createdAt") else None,
        "read": bool(doc.get("read", False)),
        "requestor": doc.get("requestor"),
    }


def _is_member_or_owner(group_doc, uid):
    """
    True if uid is owner or in members. Accepts ObjectId or string.
    """
    if not group_doc or not uid:
        return False
    uid_str = str(uid)
    if str(group_doc.get("ownerId")) == uid_str:
        return True
    for m in group_doc.get("members", []) or []:
        if str(m.get("_id")) == uid_str:
            return True
    for mid in group_doc.get("memberIds", []) or []:
        if str(mid) == uid_str:
            return True
    return False


# ---------- MY GROUPS --------------------------------------------------------
@groups_bp.get("/")
@jwt_required()
def list_groups():
    try:
        db = get_db()
        ensure_group_collection(db)

        uid = oid(get_jwt_identity())
        if not uid:
            return jsonify({"ok": False, "error": "Invalid user identity"}), 401

        pipeline = [
            {"$match": {"members._id": uid}},
            {
                "$addFields": {
                    "pendingCount": {
                        "$size": {
                            "$filter": {
                                "input": {"$ifNull": ["$joinRequests", []]},
                                "as": "r",
                                "cond": {"$eq": ["$$r.status", "pending"]},
                            }
                        }
                    }
                }
            },
            {
                "$project": {
                    "title": 1,
                    "course": 1,
                    "description": 1,
                    "ownerId": 1,
                    "members": 1,
                    "createdAt": 1,
                    "pendingCount": 1,
                }
            },
            {"$sort": {"createdAt": -1}},
        ]

        rows = list(db.study_groups.aggregate(pipeline))
        out = []
        for d in rows:
            is_owner = str(d.get("ownerId")) == str(uid)
            out.append(
                {
                    "_id": str(d["_id"]),
                    "title": d.get("title", ""),
                    "course": d.get("course", ""),
                    "description": d.get("description", "") or "",
                    "ownerId": str(d.get("ownerId")) if d.get("ownerId") else None,
                    "isOwner": is_owner,
                    "members": [serialize_member(m) for m in d.get("members", [])],
                    "membersCount": len(d.get("members", [])),
                    "createdAt": d.get("createdAt").isoformat() + "Z" if d.get("createdAt") else None,
                    "pendingCount": int(d.get("pendingCount") or 0) if is_owner else 0,
                }
            )
        return jsonify(out), 200
    except Exception as e:
        return jsonify({"ok": False, "error": f"Server error: {e}"}), 500


# ---------- CREATE -----------------------------------------------------------
@groups_bp.post("")
@jwt_required()
def create_group():
    try:
        db = get_db()
        ensure_group_collection(db)

        user = current_user(db)
        if not user:
            return jsonify({"ok": False, "error": "User not found"}), 401

        data = request.get_json(silent=True) or {}
        title = (data.get("title") or "").strip()
        course = (data.get("course") or "").strip()
        desc = (data.get("description") or "").strip()

        if not title or not course:
            return jsonify({"ok": False, "error": "Title and course are required"}), 400

        member_doc = {"_id": user["_id"], "name": user.get("fullName"), "email": user["email"]}

        doc = {
            "title": title,
            "course": course,
            "description": desc,
            "department": user.get("department"),
            "isOpen": True,
            "members": [member_doc],
            "ownerId": user["_id"],
            "createdAt": datetime.utcnow(),
            "joinRequests": [],
        }

        ins = db.study_groups.insert_one(doc)
        created = db.study_groups.find_one({"_id": ins.inserted_id})
        ser = serialize_group(created)
        ser["isOwner"] = True
        return jsonify(ser), 201

    except PyMongoError as e:
        return jsonify({"ok": False, "error": f"Database error: {e}"}), 500
    except Exception as e:
        return jsonify({"ok": False, "error": f"Create failed: {e}"}), 500


# ---------- BROWSE (open groups) -------------------------------------------
@groups_bp.get("/browse")
@jwt_required()
def browse_groups():
    """Return public info for open groups in the viewer's department."""
    try:
        db = get_db()
        ensure_group_collection(db)

        viewer = current_user(db)
        if not viewer:
            return jsonify({"ok": False, "error": "Unauthorized"}), 401

        dept = (viewer.get("department") or "").strip()
        q = (request.args.get("q") or "").strip()

        query = {"isOpen": True, "department": dept}
        if q:
            query["$or"] = [
                {"title": {"$regex": q, "$options": "i"}},
                {"course": {"$regex": q, "$options": "i"}},
            ]

        docs = list(db.study_groups.find(query).sort("createdAt", -1))
        _uid = viewer["_id"]

        out = []
        for d in docs:
            status = "none"
            if any(m["_id"] == _uid for m in d.get("members", [])):
                status = "member"
            elif any((r.get("userId") == _uid) and r.get("status") == "pending" for r in d.get("joinRequests", [])):
                status = "requested"

            out.append(
                {
                    "_id": str(d["_id"]),
                    "title": d.get("title", ""),
                    "course": d.get("course", ""),
                    "department": d.get("department"),
                    "description": d.get("description", "") or "",
                    "isOpen": bool(d.get("isOpen", True)),
                    "createdAt": d.get("createdAt").isoformat() + "Z" if d.get("createdAt") else None,
                    "membersCount": len(d.get("members", [])),
                    "myJoinStatus": status,
                }
            )

        return jsonify(out), 200
    except Exception as e:
        return jsonify({"ok": False, "error": f"Server error: {e}"}), 500


# ---------- GROUP DETAILS (minimal for non-members) -------------------------
@groups_bp.get("/<gid>")
@jwt_required()
def get_group(gid):
    """Full details for members/owners; counts only for non-members."""
    try:
        db = get_db()
        ensure_group_collection(db)

        uid_str = get_jwt_identity()
        uid = oid(uid_str)
        if not uid:
            return jsonify({"ok": False, "error": "Invalid user identity"}), 401

        _gid = oid(gid)
        if not _gid:
            return jsonify({"ok": False, "error": "Invalid group id"}), 400

        doc = db.study_groups.find_one({"_id": _gid})
        if not doc:
            return jsonify({"ok": False, "error": "Group not found"}), 404

        out = serialize_group(doc)
        out["isOwner"] = (str(doc.get("ownerId")) == str(uid))
        out["membersCount"] = len(doc.get("members", []))

        my_in_members = any(m.get("_id") == uid for m in doc.get("members", []))
        my_in_requests = any(
            (r.get("userId") == uid) and r.get("status") == "pending" for r in doc.get("joinRequests", [])
        )
        out["myJoinStatus"] = "member" if my_in_members else ("requested" if my_in_requests else "none")

        if out["isOwner"]:
            out["pendingCount"] = len([r for r in doc.get("joinRequests", []) if r.get("status") == "pending"])

        if not (my_in_members or out["isOwner"]):
            out.pop("members", None)

        return jsonify(out), 200

    except Exception as e:
        print("GET /api/groups/<gid> failed:", e)
        return jsonify({"ok": False, "error": "Server error"}), 500


# ---------- JOIN REQUESTS FLOW ----------------------------------------------
@groups_bp.post("/request/<gid>")
@jwt_required()
def request_join(gid):
    try:
        db = get_db()
        ensure_group_collection(db)

        user = current_user(db)
        if not user:
            return jsonify({"ok": False, "error": "Unauthorized"}), 401

        _gid = oid(gid)
        if not _gid:
            return jsonify({"ok": False, "error": "Invalid group id"}), 400

        group = db.study_groups.find_one({"_id": _gid})
        if not group:
            return jsonify({"ok": False, "error": "Group not found"}), 404

        if (group.get("department") or "").strip() != (user.get("department") or "").strip():
            return jsonify({"ok": False, "error": "Cross-department join is not allowed"}), 403

        if any(m["_id"] == user["_id"] for m in group.get("members", [])):
            return jsonify({"ok": False, "error": "You are already a member"}), 409

        if any((r.get("userId") == user["_id"]) and r.get("status") == "pending" for r in group.get("joinRequests", [])):
            return jsonify({"ok": False, "error": "Request already pending"}), 409

        req = {
            "userId": user["_id"],
            "name": user.get("fullName"),
            "email": user["email"],
            "status": "pending",
            "createdAt": datetime.utcnow(),
        }

        db.study_groups.update_one({"_id": _gid}, {"$addToSet": {"joinRequests": req}})

        ensure_notifications_collection(db)
        db.notifications.insert_one(
            {
                "userId": group["ownerId"],
                "type": "join_request",
                "title": group.get("title") or "Study group",
                "groupId": _gid,
                "createdAt": datetime.utcnow(),
                "read": False,
                "requestor": {
                    "_id": user["_id"],
                    "name": user.get("fullName"),
                    "email": user["email"],
                },
            }
        )

        try:
            sio = get_socketio()
            owner_id = group.get("ownerId")
            if sio and owner_id:
                room = f"user:{str(owner_id)}"
                payload = {
                    "type": "join_request",
                    "groupId": str(_gid),
                    "title": group.get("title") or "Study group",
                    "requestor": {
                        "id": str(user["_id"]),
                        "name": user.get("fullName"),
                        "email": user["email"],
                    },
                    "requestedAt": datetime.utcnow().isoformat() + "Z",
                }
                sio.emit("notify", payload, namespace="/ws/chat", to=room)
                print(f"[ws] notify → {room}: {payload}")
        except Exception as e:
            print("[ws] notify error (request_join):", e)

        return jsonify({"ok": True, "message": "Request submitted"}), 200

    except Exception as e:
        return jsonify({"ok": False, "error": f"Request failed: {e}"}), 500


@groups_bp.get("/<gid>/requests")
@jwt_required()
def list_requests(gid):
    try:
        db = get_db()
        ensure_group_collection(db)

        user = current_user(db)
        if not user:
            return jsonify({"ok": False, "error": "Unauthorized"}), 401

        _gid = oid(gid)
        if not _gid:
            return jsonify({"ok": False, "error": "Invalid group id"}), 400

        group = db.study_groups.find_one({"_id": _gid})
        if not group:
            return jsonify({"ok": False, "error": "Group not found"}), 404

        if str(group.get("ownerId")) != str(user["_id"]):
            return jsonify({"ok": False, "error": "Only the owner can view requests"}), 403

        pending = [
            {
                "userId": str(r.get("userId")),
                "name": r.get("name"),
                "email": r.get("email"),
                "createdAt": r.get("createdAt").isoformat() + "Z" if r.get("createdAt") else None,
            }
            for r in group.get("joinRequests", [])
            if r.get("status") == "pending"
        ]
        return jsonify(pending), 200
    except Exception as e:
        return jsonify({"ok": False, "error": f"Load failed: {e}"}), 500


@groups_bp.post("/<gid>/requests/<uid>/approve")
@jwt_required()
def approve_request(gid, uid):
    try:
        db = get_db()
        ensure_group_collection(db)
        ensure_notifications_collection(db)

        owner = current_user(db)
        if not owner:
            return jsonify({"ok": False, "error": "Unauthorized"}), 401

        _gid = oid(gid)
        _uid = oid(uid)
        if not _gid or not _uid:
            return jsonify({"ok": False, "error": "Invalid id(s)"}), 400

        group = db.study_groups.find_one({"_id": _gid})
        if not group:
            return jsonify({"ok": False, "error": "Group not found"}), 404
        if str(group.get("ownerId")) != str(owner["_id"]):
            return jsonify({"ok": False, "error": "Only the owner can approve"}), 403

        u = db.users.find_one({"_id": _uid})
        if not u:
            return jsonify({"ok": False, "error": "User not found"}), 404

        member_doc = {"_id": u["_id"], "name": u.get("fullName"), "email": u["email"]}

        result = db.study_groups.update_one(
            {"_id": _gid},
            {"$addToSet": {"members": member_doc}, "$set": {"joinRequests.$[r].status": "approved"}},
            array_filters=[{"r.userId": _uid, "r.status": "pending"}],
        )
        print(
            f"[api] approve DB: matched={result.matched_count} modified={result.modified_count} gid={_gid} uid={_uid}"
        )

        try:
            sio = get_socketio()
            if sio:
                room = f"user:{str(_uid)}"
                payload = {
                    "type": "join_approved",
                    "userId": str(_uid),
                    "groupId": str(_gid),
                    "title": group.get("title") or "Study group",
                    "approvedAt": datetime.utcnow().isoformat() + "Z",
                }
                sio.emit("notify", payload, namespace="/ws/chat", to=room)
                print(f"[ws] notify → {room}: {payload}")
        except Exception as e:
            print("[ws] notify error (approve):", e)

        db.notifications.insert_one(
            {
                "userId": _uid,
                "type": "join_approved",
                "title": group.get("title") or "Study group",
                "groupId": _gid,
                "createdAt": datetime.utcnow(),
                "read": False,
            }
        )

        return jsonify({"ok": True}), 200

    except Exception as e:
        print("[api] approve_request error:", e)
        return jsonify({"ok": False, "error": f"Approve failed: {e}"}), 500


@groups_bp.post("/<gid>/requests/<uid>/reject")
@jwt_required()
def reject_request(gid, uid):
    try:
        db = get_db()
        ensure_group_collection(db)
        ensure_notifications_collection(db)

        owner = current_user(db)
        if not owner:
            return jsonify({"ok": False, "error": "Unauthorized"}), 401

        _gid = oid(gid)
        _uid = oid(uid)
        if not _gid or not _uid:
            return jsonify({"ok": False, "error": "Invalid id(s)"}), 400

        group = db.study_groups.find_one({"_id": _gid})
        if not group:
            return jsonify({"ok": False, "error": "Group not found"}), 404
        if str(group.get("ownerId")) != str(owner["_id"]):
            return jsonify({"ok": False, "error": "Only the owner can reject"}), 403

        db.study_groups.update_one(
            {"_id": _gid},
            {"$set": {"joinRequests.$[r].status": "rejected"}},
            array_filters=[{"r.userId": _uid, "r.status": "pending"}],
        )

        try:
            sio = get_socketio()
            if sio:
                room = f"user:{str(_uid)}"
                payload = {
                    "type": "join_rejected",
                    "userId": str(_uid),
                    "groupId": str(group["_id"]),
                    "title": group.get("title") or "Study Group",
                    "rejectedAt": datetime.utcnow().isoformat() + "Z",
                }
                sio.emit("notify", payload, namespace="/ws/chat", to=room)
                print(f"[ws] notify → {room}: {payload}")
        except Exception as e:
            print("[ws] notify error (reject):", e)

        db.notifications.insert_one(
            {
                "userId": _uid,
                "type": "join_rejected",
                "title": group.get("title") or "Study Group",
                "groupId": _gid,
                "createdAt": datetime.utcnow(),
                "read": False,
            }
        )

        return jsonify({"ok": True}), 200

    except Exception as e:
        print("[api] reject_request error:", e)
        return jsonify({"ok": False, "error": f"Reject failed: {e}"}), 500


# ---------- LEAVE / DELETE ---------------------------------------------------
@groups_bp.post("/leave/<gid>")
@jwt_required()
def leave_group(gid):
    try:
        db = get_db()
        ensure_group_collection(db)
        user = current_user(db)
        if not user:
            return jsonify({"ok": False, "error": "Unauthorized"}), 401
        _gid = oid(gid)
        if not _gid:
            return jsonify({"ok": False, "error": "Invalid group id"}), 400
        db.study_groups.update_one({"_id": _gid}, {"$pull": {"members": {"_id": user["_id"]}}})
        return jsonify({"ok": True}), 200
    except Exception as e:
        return jsonify({"ok": False, "error": f"Leave failed: {e}"}), 500


@groups_bp.delete("/<gid>")
@jwt_required()
def delete_group(gid):
    try:
        db = get_db()
        ensure_group_collection(db)
        user = current_user(db)
        if not user:
            return jsonify({"ok": False, "error": "Unauthorized"}), 401
        _gid = oid(gid)
        if not _gid:
            return jsonify({"ok": False, "error": "Invalid group id"}), 400
        group = db.study_groups.find_one({"_id": _gid})
        if not group:
            return jsonify({"ok": False, "error": "Group not found"}), 404
        if str(group.get("ownerId")) != str(user["_id"]):
            return jsonify({"ok": False, "error": "Only the owner can delete this group"}), 403
        db.study_groups.delete_one({"_id": _gid})
        return jsonify({"ok": True, "message": "Group deleted"}), 200
    except Exception as e:
        return jsonify({"ok": False, "error": f"Delete failed: {e}"}), 500


# ===================== AVAILABILITY =====================
WEEK_KEYS = ("mon", "tue", "wed", "thu", "fri", "sat", "sun")


@groups_bp.put("/availability")
@jwt_required()
def set_availability():
    try:
        db = get_db()
        user = current_user(db)
        if not user:
            return jsonify({"ok": False, "error": "Unauthorized"}), 401
        body = request.get_json(silent=True) or {}
        avail = {k: body.get(k, []) for k in WEEK_KEYS}
        db.users.update_one({"_id": user["_id"]}, {"$set": {"availability": avail}})
        return jsonify({"ok": True}), 200
    except Exception as e:
        return jsonify({"ok": False, "error": f"Save failed: {e}"}), 500


@groups_bp.get("/availability/me")
@jwt_required()
def get_my_availability():
    try:
        db = get_db()
        user = current_user(db)
        if not user:
            return jsonify({"ok": False, "error": "Unauthorized"}), 401
        out = user.get("availability") or {k: [] for k in WEEK_KEYS}
        return jsonify(out), 200
    except Exception as e:
        return jsonify({"ok": False, "error": f"Load failed: {e}"}), 500


# ===================== Notifications (persistent) =====================
from bson import ObjectId
from datetime import datetime
from flask import jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity

def _as_oid(v):
    try:
        return ObjectId(v) if isinstance(v, str) else (v if isinstance(v, ObjectId) else None)
    except Exception:
        return None

def _user_id_variants(uid_raw):
    out = [str(uid_raw)]
    o = _as_oid(uid_raw)
    if o:
        out.append(o)
    return out

def ensure_notifications_collection(db):
    if "notifications" not in db.list_collection_names():
        db.create_collection("notifications")
    db.notifications.create_index([("userId", 1), ("createdAt", -1)], background=True)
    db.notifications.create_index([("read", 1)], background=True)

def _scrub_ids(x):
    """Recursively convert ObjectId -> str in nested dicts/lists."""
    if isinstance(x, ObjectId):
        return str(x)
    if isinstance(x, list):
        return [_scrub_ids(i) for i in x]
    if isinstance(x, dict):
        return {k: _scrub_ids(v) for k, v in x.items()}
    return x

def serialize_notification(doc):
    # Build a lean object, but make sure nested bits are safe (no ObjectId left).
    return {
        "_id": str(doc.get("_id")),
        "type": doc.get("type"),
        "title": doc.get("title"),
        "groupId": str(doc.get("groupId")) if doc.get("groupId") else None,
        # requestor could contain an ObjectId from join-request code → scrub it
        "requestor": _scrub_ids(doc.get("requestor")),
        # slot is a small dict (strings) but scrub anyway for safety
        "slot": _scrub_ids(doc.get("slot")),
        "read": bool(doc.get("read")),
        "createdAt": (doc.get("createdAt") or datetime.utcnow()).isoformat() + "Z",
    }

@groups_bp.get("/notifications")
@jwt_required()
def list_my_notifications():
    try:
        from db import get_db
        db = get_db()
        ensure_notifications_collection(db)

        uid_raw = get_jwt_identity()
        if not uid_raw:
            return jsonify({"ok": False, "error": "Unauthorized"}), 401

        variants = _user_id_variants(uid_raw)
        rows = list(
            db.notifications
              .find({"userId": {"$in": variants}})
              .sort("createdAt", -1)
              .limit(50)
        )
        return jsonify([serialize_notification(r) for r in rows]), 200
    except Exception as e:
        return jsonify({"ok": False, "error": f"/notifications failed: {e}"}), 500

@groups_bp.post("/notifications/read")
@jwt_required()
def mark_notifications_read():
    try:
        from db import get_db
        db = get_db()
        ensure_notifications_collection(db)

        uid_raw = get_jwt_identity()
        if not uid_raw:
            return jsonify({"ok": False, "error": "Unauthorized"}), 401

        body = request.get_json(silent=True) or {}
        ids = body.get("ids") or []

        variants = _user_id_variants(uid_raw)
        q = {"userId": {"$in": variants}, "read": {"$ne": True}}
        if ids:
            def _either(v): return _as_oid(v) or v
            q["_id"] = {"$in": [_either(x) for x in ids]}

        res = db.notifications.update_many(q, {"$set": {"read": True, "readAt": datetime.utcnow()}})
        return jsonify({"ok": True, "updated": res.modified_count}), 200
    except Exception as e:
        return jsonify({"ok": False, "error": f"/notifications/read failed: {e}"}), 500

@groups_bp.post("/notifications/clear")
@jwt_required()
def clear_notifications():
    try:
        from db import get_db
        db = get_db()
        ensure_notifications_collection(db)

        uid_raw = get_jwt_identity()
        if not uid_raw:
            return jsonify({"ok": False, "error": "Unauthorized"}), 401

        variants = _user_id_variants(uid_raw)
        db.notifications.delete_many({"userId": {"$in": variants}})
        return jsonify({"ok": True}), 200
    except Exception as e:
        return jsonify({"ok": False, "error": f"/notifications/clear failed: {e}"}), 500
# =================== end notifications ===================




# ===================== CHAT =====================
def ensure_chat_collection(db):
    if "group_messages" not in db.list_collection_names():
        db.create_collection("group_messages")
    db.group_messages.create_index(
        [("groupId", ASCENDING), ("createdAt", DESCENDING)],
        background=True,
    )

def ensure_chat_reads_collection(db):
    if "group_reads" not in db.list_collection_names():
        db.create_collection("group_reads")
    db.group_reads.create_index([("userId", 1), ("groupId", 1)], unique=True)
    db.group_reads.create_index([("updatedAt", -1)])

def _serialize_chat(doc):
    fr = doc.get("from", {})
    out = {
        "_id": str(doc.get("_id")),
        "id": str(doc.get("_id")),
        "groupId": str(doc.get("groupId")) if doc.get("groupId") else None,
        "kind": doc.get("kind", "text"),
        "text": doc.get("text", ""),
        "from": {
            "id": str(fr.get("id")) if fr.get("id") else None,
            "name": fr.get("name"),
            "email": fr.get("email"),
        },
        "at": doc.get("createdAt").isoformat() + "Z" if doc.get("createdAt") else None,
    }
    f = doc.get("file")
    if f:
        out["file"] = {
            "name": f.get("name"),
            "url": f.get("url"),
            "mime": f.get("mime"),
            "size": int(f.get("size") or 0),
        }
    return out

# ---- upload helpers ----------------------------------------------------------
ALLOWED_EXTS = {"pdf", "doc", "docx"}

def _allowed_ext(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTS

def _uploads_dir_for_gid(gid_oid):
    base = current_app.config.get("UPLOAD_DIR") or os.path.join(current_app.root_path, "uploads")
    folder = os.path.join(base, str(gid_oid))
    os.makedirs(folder, exist_ok=True)
    return folder

# --- GET /api/groups/<gid>/chat  — history (members/owner only) ---------------
@groups_bp.get("/<gid>/chat", endpoint="chat_history")
@jwt_required()
def chat_history(gid):
    try:
        db = get_db()
        ensure_group_collection(db)
        ensure_chat_collection(db)

        uid = oid(get_jwt_identity())
        _gid = oid(gid)
        if not uid or not _gid:
            return jsonify({"ok": False, "error": "Unauthorized"}), 401

        grp = db.study_groups.find_one({"_id": _gid}, {"members._id": 1, "ownerId": 1})
        if not grp:
            return jsonify({"ok": False, "error": "Group not found"}), 404
        if not _is_member_or_owner(grp, uid):
            return jsonify({"ok": False, "error": "Only members can view chat"}), 403

        rows = list(
            db.group_messages
              .find({"groupId": _gid})
              .sort("createdAt", DESCENDING)
              .limit(200)
        )
        rows.reverse()  # oldest → newest
        return jsonify([_serialize_chat(r) for r in rows]), 200
    except Exception as e:
        return jsonify({"ok": False, "error": f"Chat load failed: {e}"}), 500

# --- POST /api/groups/<gid>/chat — send (members/owner only) ------------------
@groups_bp.post("/<gid>/chat", endpoint="chat_send")
@jwt_required()
def chat_send(gid):
    try:
        db = get_db()
        ensure_group_collection(db)
        ensure_chat_collection(db)
        ensure_chat_reads_collection(db)

        me = current_user(db)
        _gid = oid(gid)
        if not me or not _gid:
            return jsonify({"ok": False, "error": "Unauthorized"}), 401

        grp = db.study_groups.find_one({"_id": _gid}, {"members._id": 1, "ownerId": 1, "title": 1})
        if not grp:
            return jsonify({"ok": False, "error": "Group not found"}), 404
        if not _is_member_or_owner(grp, me["_id"]):
            return jsonify({"ok": False, "error": "Only members can send chat"}), 403

        body = request.get_json(silent=True) or {}
        text = (body.get("text") or "").strip()
        if not text:
            return jsonify({"ok": False, "error": "Message cannot be empty"}), 400

        display_name = me.get("fullName") or me.get("name") or me.get("email") or "Member"
        now = datetime.utcnow()

        doc = {
            "groupId": _gid,
            "kind": "text",
            "text": text,
            "from": {"id": me["_id"], "name": display_name, "email": me.get("email")},
            "createdAt": now,
        }
        ins = db.group_messages.insert_one(doc)

        # mark sender as read up to now
        db.group_reads.update_one(
            {"userId": me["_id"], "groupId": _gid},
            {"$set": {"lastReadAt": now, "updatedAt": now}},
            upsert=True,
        )

        payload = _serialize_chat({**doc, "_id": ins.inserted_id})

        # realtime: broadcast to room group:<gid>
        try:
            sio = get_socketio()
            if sio:
                sio.emit("group_message", payload, namespace="/ws/chat", to=f"group:{gid}")
        except Exception as e:
            print("[ws] broadcast error (chat_send):", e)

        return jsonify(payload), 201
    except Exception as e:
        return jsonify({"ok": False, "error": f"Chat send failed: {e}"}), 500

# --- POST /api/groups/<gid>/chat/upload — file message ------------------------
@groups_bp.post("/<gid>/chat/upload", endpoint="chat_upload")
@jwt_required()
def chat_upload(gid):
    """
    Multipart/form-data with field 'file'.
    Saves into UPLOAD_DIR/<gid>/ and creates a 'file' chat message.
    """
    try:
        db = get_db()
        ensure_group_collection(db)
        ensure_chat_collection(db)

        me = current_user(db)
        _gid = oid(gid)
        if not me or not _gid:
            return jsonify({"ok": False, "error": "Unauthorized"}), 401

        grp = db.study_groups.find_one({"_id": _gid}, {"members._id": 1, "ownerId": 1})
        if not grp or not _is_member_or_owner(grp, me["_id"]):
            return jsonify({"ok": False, "error": "Only members can upload"}), 403

        if "file" not in request.files:
            return jsonify({"ok": False, "error": "No file part"}), 400
        f = request.files["file"]
        if not f or f.filename == "":
            return jsonify({"ok": False, "error": "Empty filename"}), 400
        if not _allowed_ext(f.filename):
            return jsonify({"ok": False, "error": "Only PDF/DOC/DOCX allowed"}), 415

        safe_name = secure_filename(f.filename)
        stored_name = f"{uuid.uuid4().hex}_{safe_name}"
        folder = _uploads_dir_for_gid(_gid)
        full_path = os.path.join(folder, stored_name)
        f.save(full_path)

        size = os.path.getsize(full_path)
        file_url = f"{request.host_url.rstrip('/')}/api/groups/file/{str(_gid)}/{stored_name}"

        display_name = me.get("fullName") or me.get("name") or me.get("email") or "Member"
        now = datetime.utcnow()

        doc = {
            "groupId": _gid,
            "kind": "file",
            "text": "",
            "file": {"name": safe_name, "url": file_url, "mime": f.mimetype, "size": size},
            "from": {"id": me["_id"], "name": display_name, "email": me.get("email")},
            "createdAt": now,
        }
        ins = db.group_messages.insert_one(doc)
        payload = _serialize_chat({**doc, "_id": ins.inserted_id})

        # broadcast
        try:
            sio = get_socketio()
            if sio:
                sio.emit("group_message", payload, namespace="/ws/chat", to=f"group:{gid}")
        except Exception as e:
            print("[ws] broadcast error (chat_upload):", e)

        return jsonify(payload), 201
    except Exception as e:
        return jsonify({"ok": False, "error": f"Upload failed: {e}"}), 500

# --- GET /api/groups/file/<gid>/<filename> — secure serve ---------------------
@groups_bp.get("/file/<gid>/<filename>", endpoint="chat_file")
@jwt_required()
def serve_group_file(gid, filename):
    """
    Serve a previously uploaded file if the caller is a member/owner of the group.
    """
    try:
        db = get_db()
        uid = oid(get_jwt_identity())
        _gid = oid(gid)
        if not uid or not _gid:
            return jsonify({"ok": False, "error": "Unauthorized"}), 401

        grp = db.study_groups.find_one({"_id": _gid}, {"members._id": 1, "ownerId": 1})
        if not grp or not _is_member_or_owner(grp, uid):
            return jsonify({"ok": False, "error": "Forbidden"}), 403

        folder = _uploads_dir_for_gid(_gid)
        return send_from_directory(folder, filename, as_attachment=False)
    except Exception as e:
        return jsonify({"ok": False, "error": f"File fetch failed: {e}"}), 500

# --- GET /api/groups/<gid>/chat/unread → {"count": int} -----------------------
@groups_bp.get("/<gid>/chat/unread", endpoint="chat_unread_count")
@jwt_required()
def chat_unread(gid):
    try:
        db = get_db()
        ensure_group_collection(db)
        ensure_chat_collection(db)
        ensure_chat_reads_collection(db)

        uid = oid(get_jwt_identity())
        _gid = oid(gid)
        if not uid or not _gid:
            return jsonify({"ok": False, "error": "Unauthorized"}), 401

        grp = db.study_groups.find_one({"_id": _gid}, {"members._id": 1, "ownerId": 1})
        if not grp:
            return jsonify({"ok": False, "error": "Group not found"}), 404
        if not _is_member_or_owner(grp, uid):
            return jsonify({"ok": False, "error": "Join this group to view chat"}), 403

        read = db.group_reads.find_one({"userId": uid, "groupId": _gid}) or {}
        since = read.get("lastReadAt")

        q = {"groupId": _gid, "from.id": {"$ne": uid}}  # exclude my own messages
        if since:
            q["createdAt"] = {"$gt": since}

        cnt = db.group_messages.count_documents(q)
        return jsonify({"count": int(cnt)}), 200
    except Exception as e:
        return jsonify({"ok": False, "error": f"Unread failed: {e}"}), 500

# --- POST /api/groups/<gid>/chat/mark-read → {"ok": true} ---------------------
@groups_bp.post("/<gid>/chat/mark-read", endpoint="chat_mark_read")
@jwt_required()
def chat_mark_read(gid):
    try:
        db = get_db()
        ensure_group_collection(db)
        ensure_chat_collection(db)
        ensure_chat_reads_collection(db)

        uid = oid(get_jwt_identity())
        _gid = oid(gid)
        if not uid or not _gid:
            return jsonify({"ok": False, "error": "Unauthorized"}), 401

        grp = db.study_groups.find_one({"_id": _gid}, {"members._id": 1, "ownerId": 1})
        if not grp:
            return jsonify({"ok": False, "error": "Group not found"}), 404
        if not _is_member_or_owner(grp, uid):
            return jsonify({"ok": False, "error": "Join this group to view chat"}), 403

        now = datetime.utcnow()
        db.group_reads.update_one(
            {"userId": uid, "groupId": _gid},
            {"$set": {"lastReadAt": now, "updatedAt": now}},
            upsert=True,
        )
        return jsonify({"ok": True}), 200
    except Exception as e:
        return jsonify({"ok": False, "error": f"Mark-read failed: {e}"}), 500


# ===================== MEETING POLLS =====================
VALID_MODES = {"online", "oncampus", "either"}  # "on-campus" is normalized to "oncampus"

def ensure_meeting_polls_collection(db):
    if "meeting_polls" not in db.list_collection_names():
        db.create_collection("meeting_polls")
    db.meeting_polls.create_index([("groupId", 1), ("createdAt", -1)], background=True)
    db.meeting_polls.create_index([("slots.id", 1)], background=True)

def _iso(dt):
    return dt.isoformat() + "Z" if isinstance(dt, datetime) else None

def _serialize_poll(doc, uid=None):
    """Return client-safe poll. Each slot: {slotId, id, at, count, voted}."""
    uid_str = str(uid) if uid else None
    out_slots = []
    for s in (doc.get("slots") or []):
        votes = s.get("votes", []) or []
        vote_strs = {str(v) for v in votes}  # normalize & dedupe
        sid = s.get("id")
        out_slots.append({
            "slotId": sid,           # preferred
            "id": sid,               # back-compat
            "at": _iso(s.get("at")),
            "count": len(vote_strs),
            "voted": (uid_str in vote_strs) if uid_str else False,
        })
    return {
        "id": str(doc.get("_id")),
        "groupId": str(doc.get("groupId")),
        "title": doc.get("title", ""),
        "mode": doc.get("mode", "either"),
        "slots": out_slots,
        "createdBy": str(doc.get("createdBy")) if doc.get("createdBy") else None,
        "createdAt": _iso(doc.get("createdAt")),
    }

def _parse_iso_to_utc_naive(s: str):
    """
    Accepts ISO strings like 'YYYY-MM-DDTHH:MM[:SS][Z or +offset]'.
    Returns a naive UTC datetime (tzinfo stripped).
    """
    try:
        s = (s or "").strip()
        if not s:
            return None
        if s.endswith("Z"):
            aware = datetime.fromisoformat(s.replace("Z", "+00:00"))
            return aware.astimezone(timezone.utc).replace(tzinfo=None)
        dt = datetime.fromisoformat(s)
        return (dt.astimezone(timezone.utc).replace(tzinfo=None)
                if dt.tzinfo is not None else dt)
    except Exception:
        return None

def _is_member(db, gid_oid, uid_oid):
    grp = db.study_groups.find_one({"_id": gid_oid}, {"members._id": 1, "ownerId": 1})
    if not grp:
        return False
    if str(grp.get("ownerId")) == str(uid_oid):
        return True
    return any(m.get("_id") == uid_oid for m in grp.get("members", []))

# -------- List polls for a group --------
@groups_bp.get("/<gid>/meeting-polls")
@jwt_required()
def list_meeting_polls(gid):
    db = get_db()
    ensure_group_collection(db)
    ensure_meeting_polls_collection(db)

    uid = oid(get_jwt_identity())
    _gid = oid(gid)
    if not uid or not _gid:
        return jsonify({"ok": False, "error": "Unauthorized"}), 401
    if not _is_member(db, _gid, uid):
        return jsonify({"ok": False, "error": "Members only"}), 403

    rows = list(
        db.meeting_polls.find({"groupId": _gid})
        .sort("createdAt", DESCENDING)
        .limit(50)
    )
    return jsonify([_serialize_poll(r, uid) for r in rows]), 200

# -------- Create a poll --------
@groups_bp.post("/<gid>/meeting-polls")
@jwt_required()
def create_meeting_poll(gid):
    db = get_db()
    ensure_group_collection(db)
    ensure_meeting_polls_collection(db)

    me = current_user(db)
    _gid = oid(gid)
    if not me or not _gid:
        return jsonify({"ok": False, "error": "Unauthorized"}), 401
    if not _is_member(db, _gid, me["_id"]):
        return jsonify({"ok": False, "error": "Members only"}), 403

    body = request.get_json(silent=True) or {}
    title = (body.get("title") or "").strip()
    mode_in = str(body.get("mode") or "either").lower().strip()
    mode = "oncampus" if mode_in in ("on-campus", "on_campus") else mode_in
    slots_in = body.get("slots") or []

    if not title:
        return jsonify({"ok": False, "error": "Title is required"}), 400
    if mode not in VALID_MODES:
        return jsonify({"ok": False, "error": "Invalid mode"}), 400

    # normalize & dedupe slots
    seen = set()
    slots = []
    for raw in slots_in:
        dt = _parse_iso_to_utc_naive(raw)
        if not dt:
            return jsonify({"ok": False, "error": f"Invalid datetime: {raw}"}), 400
        key = dt.isoformat()
        if key in seen:
            continue
        seen.add(key)
        slots.append({"id": uuid.uuid4().hex, "at": dt, "votes": []})

    if not slots:
        return jsonify({"ok": False, "error": "At least one time slot is required"}), 400

    slots.sort(key=lambda x: x["at"])
    now = datetime.utcnow()
    doc = {
        "groupId": _gid,
        "title": title,
        "mode": mode,              # "either" | "online" | "oncampus"
        "slots": slots,            # each: {id(str), at(datetime UTC naive), votes:[ObjectId]}
        "createdBy": me["_id"],
        "createdAt": now,
        "updatedAt": now,
    }
    ins = db.meeting_polls.insert_one(doc)
    doc["_id"] = ins.inserted_id
    return jsonify(_serialize_poll(doc, me["_id"])), 201

# -------- Vote for a slot (single-choice) --------
@groups_bp.post("/<gid>/meeting-polls/<pid>/vote")
@jwt_required()
def vote_meeting_poll(gid, pid):
    db = get_db()
    ensure_group_collection(db)
    ensure_meeting_polls_collection(db)

    uid = oid(get_jwt_identity())
    _gid = oid(gid)
    _pid = oid(pid)
    if not uid or not _gid or not _pid:
        return jsonify({"ok": False, "error": "Unauthorized"}), 401
    if not _is_member(db, _gid, uid):
        return jsonify({"ok": False, "error": "Members only"}), 403

    body = request.get_json(silent=True) or {}
    # accept slotId OR slotIds (array) OR id (legacy)
    slot_id = (body.get("slotId")
               or (body.get("slotIds")[0] if isinstance(body.get("slotIds"), list) and body.get("slotIds") else None)
               or body.get("id") or "")
    slot_id = str(slot_id).strip()
    if not slot_id:
        return jsonify({"ok": False, "error": "slotId is required"}), 400

    poll = db.meeting_polls.find_one({"_id": _pid, "groupId": _gid}, {"slots.id": 1})
    if not poll:
        return jsonify({"ok": False, "error": "Poll not found"}), 404
    if slot_id not in {s.get("id") for s in (poll.get("slots") or [])}:
        return jsonify({"ok": False, "error": "Slot not found"}), 400

    uid_str = str(uid)

    # 1) remove this user from votes in ALL slots (handle both ObjectId and string legacy)
    db.meeting_polls.update_one(
        {"_id": _pid},
        {
            "$pull": {"slots.$[].votes": {"$in": [uid, uid_str]}},
            "$set": {"updatedAt": datetime.utcnow()},
        },
    )

    # 2) add to the selected slot
    db.meeting_polls.update_one(
        {"_id": _pid, "slots.id": slot_id},
        {"$addToSet": {"slots.$.votes": uid}},
    )

    fresh = db.meeting_polls.find_one({"_id": _pid})
    return jsonify(_serialize_poll(fresh, uid)), 200
# --------------------- end meeting polls ---------------------
@groups_bp.route("/<path:_any>", methods=["OPTIONS"])
def _groups_preflight(_any):
    return ("", 204)



# ---------- Members list (guarded) ------------------------------------------

# Unprotected preflight so the browser can proceed with the real GET
@groups_bp.route("/<gid>/members", methods=["OPTIONS"])
def group_members_preflight(gid):
     # no auth here; CORS middleware will attach headers
     return ("", 204)

# Real data fetch (protected)
@groups_bp.get("/<gid>/members")
@jwt_required()
def group_members(gid):
    """
    Return the group's members ONLY if caller is owner or member.
    Also tags the owner (isOwner: true). Frontend will add "(You)".
    """
    try:
        db = get_db()

        def _oid(v):
            try:
                return ObjectId(v) if isinstance(v, str) else v
            except Exception:
                return None

        uid = _oid(get_jwt_identity())
        _gid = _oid(gid)
        if not uid or not _gid:
            return jsonify({"ok": False, "error": "Unauthorized"}), 401

        doc = db.study_groups.find_one({"_id": _gid}, {"members": 1, "ownerId": 1})
        if not doc:
            return jsonify({"ok": False, "error": "Group not found"}), 404

        is_owner = str(doc.get("ownerId")) == str(uid)
        is_member = any(m.get("_id") == uid for m in (doc.get("members") or []))
        if not (is_owner or is_member):
            return jsonify({"ok": False, "error": "Join this group to view members"}), 403

        owner_id = doc.get("ownerId")
        members = []
        for m in doc.get("members", []):
            mid = m.get("_id")
            members.append({
                "_id": str(mid),
                "name": m.get("name"),
                "email": m.get("email"),
                "isOwner": (mid == owner_id),
            })

        # owner first, then alphabetical by name/email
        members.sort(key=lambda x: (not x["isOwner"], (x.get("name") or x.get("email") or "").lower()))
        return jsonify(members), 200

    except Exception as e:
        return jsonify({"ok": False, "error": f"Server error: {e}"}), 500
