from datetime import datetime

from flask import Blueprint, jsonify, request, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from bson import ObjectId
from pymongo import ASCENDING, DESCENDING, TEXT
from pymongo.errors import OperationFailure, PyMongoError

from db import get_db


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


groups_bp = Blueprint("groups", __name__, url_prefix="/api/groups")

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
    """Create study_groups if missing; ensure indexes."""
    if "study_groups" not in db.list_collection_names():
        db.create_collection("study_groups")
    coll = db.study_groups
    _safe_create_index(coll, [("ownerId", ASCENDING)])
    _safe_create_index(coll, [("members._id", ASCENDING)])
    _safe_create_index(coll, [("isOpen", ASCENDING), ("createdAt", DESCENDING)])
    _safe_create_index(coll, [("department", ASCENDING)])  # <-- for scoping
    try:
        _safe_create_index(coll, [("title", TEXT), ("course", TEXT)])
    except Exception:
        # optional on some deployments
        pass


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


def current_user(db):
    uid = get_jwt_identity()
    _id = oid(uid)
    return db.users.find_one({"_id": _id}) if _id else None


def serialize_member(m):
    return {"_id": str(m["_id"]), "name": m.get("name"), "email": m.get("email")}


def serialize_group(doc):
    if not doc:
        return None
    return {
        "_id": str(doc["_id"]),
        "title": doc.get("title", ""),
        "course": doc.get("course", ""),
        "department": doc.get("department"),  # <-- expose department
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
        # optional extras that may exist on join_request:
        "requestor": doc.get("requestor"),
    }


# ---------- MY GROUPS --------------------------------------------------------


@groups_bp.get("/")
@jwt_required()
def list_groups():
    try:
        db = get_db()
        ensure_group_collection(db)

        uid = oid(get_jwt_identity())   # <— ObjectId of the caller
        if not uid:
            return jsonify({"ok": False, "error": "Invalid user identity"}), 401

        pipeline = [
            {"$match": {"members._id": uid}},  # <— use ObjectId
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
            is_owner = str(d.get("ownerId")) == str(uid)   # <— compare to ObjectId
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
            "department": user.get("department"),  # <-- scope by creator's department
            "isOpen": True,
            "members": [member_doc],  # creator auto-member
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
    """
    Return ONLY public info for open groups, filtered to the viewer's department.
    Non-members must not see the member list (names/emails).
    """
    try:
        db = get_db()
        ensure_group_collection(db)

        viewer = current_user(db)
        if not viewer:
            return jsonify({"ok": False, "error": "Unauthorized"}), 401

        dept = (viewer.get("department") or "").strip()
        q = (request.args.get("q") or "").strip()

        # Only groups in the same department
        query = {"isOpen": True, "department": dept}
        if q:
            query["$or"] = [
                {"title": {"$regex": q, "$options": "i"}},
                {"course": {"$regex": q, "$options": "i"}},
            ]

        docs = list(db.study_groups.find(query).sort("createdAt", -1))

        # annotate my status but DO NOT include member documents
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
                    "membersCount": len(d.get("members", [])),  # number only
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
    """
    Return full details for owners/members.
    For non-members, omit the member list (names/emails); include only counts.
    """
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

        # 🚫 Hide member list for non-members/non-owners
        if not (my_in_members or out["isOwner"]):
            out.pop("members", None)  # names/emails removed

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

        # department guard: only same-department users can request
        if (group.get("department") or "").strip() != (user.get("department") or "").strip():
            return jsonify({"ok": False, "error": "Cross-department join is not allowed"}), 403

        # already member?
        if any(m["_id"] == user["_id"] for m in group.get("members", [])):
            return jsonify({"ok": False, "error": "You are already a member"}), 409

        # already pending?
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

        # persist a notification for the OWNER so they still see it after re-login
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

        # realtime notify owner via socket
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

        # realtime notify requester
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

        # persistent notification for requester
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

        # realtime notify requester
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

        # persistent notification for requester
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


# ---------- AVAILABILITY -----------------------------------------------------


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


# ---------- Notifications (persistent) --------------------------------------


@groups_bp.get("/notifications")
@jwt_required()
def list_my_notifications():
    db = get_db()
    ensure_notifications_collection(db)
    uid = oid(get_jwt_identity())
    if not uid:
        return jsonify({"ok": False, "error": "Unauthorized"}), 401

    rows = list(db.notifications.find({"userId": uid}).sort("createdAt", -1).limit(50))
    return jsonify([serialize_notification(r) for r in rows]), 200


@groups_bp.post("/notifications/read")
@jwt_required()
def mark_notifications_read():
    db = get_db()
    ensure_notifications_collection(db)
    uid = oid(get_jwt_identity())
    if not uid:
        return jsonify({"ok": False, "error": "Unauthorized"}), 401

    body = request.get_json(silent=True) or {}
    ids = body.get("ids") or []

    q = {"userId": uid, "read": {"$ne": True}}
    if ids:
        q["_id"] = {"$in": [oid(x) for x in ids if oid(x)]}

    res = db.notifications.update_many(q, {"$set": {"read": True, "readAt": datetime.utcnow()}})
    return jsonify({"ok": True, "updated": res.modified_count}), 200


@groups_bp.post("/notifications/clear")
@jwt_required()
def clear_notifications():
    db = get_db()
    ensure_notifications_collection(db)
    uid = oid(get_jwt_identity())
    if not uid:
        return jsonify({"ok": False, "error": "Unauthorized"}), 401

    db.notifications.delete_many({"userId": uid})
    return jsonify({"ok": True}), 200

# //group members
@groups_bp.get("/<gid>/members")
@jwt_required()
def group_members(gid):
    """
    Return the group's members (name/email) ONLY if the caller is
    the owner or already a member. Otherwise 403.

    Response: [
      {"_id": "...", "name": "...", "email": "...", "isOwner": true|false},
      ...
    ]
    """
    try:
        db = get_db()
        ensure_group_collection(db)

        uid = oid(get_jwt_identity())
        _gid = oid(gid)
        if not uid or not _gid:
            return jsonify({"ok": False, "error": "Unauthorized"}), 401

        doc = db.study_groups.find_one({"_id": _gid}, {"members": 1, "ownerId": 1})
        if not doc:
            return jsonify({"ok": False, "error": "Group not found"}), 404

        is_owner = str(doc.get("ownerId")) == str(uid)
        is_member = any(m.get("_id") == uid for m in doc.get("members", []))
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

        # optional: owner first, then alphabetical by name/email
        members.sort(key=lambda x: (not x["isOwner"], (x.get("name") or x.get("email") or "").lower()))

        return jsonify(members), 200

    except Exception as e:
        return jsonify({"ok": False, "error": f"Server error: {e}"}), 500


