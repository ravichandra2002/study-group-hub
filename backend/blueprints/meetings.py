# # backend/blueprints/meetings.py
# from flask import Blueprint, jsonify, request, current_app
# from flask_jwt_extended import jwt_required, get_jwt_identity
# from bson import ObjectId
# from db import get_db
# from datetime import datetime

# meetings_bp = Blueprint("meetings_bp", __name__, url_prefix="/api/meetings")


# # ----------------------- helpers -----------------------
# def _as_oid(v):
#     try:
#         return ObjectId(v)
#     except Exception:
#         return None


# def _validate_slot(slot):
#     if not isinstance(slot, dict):
#         return None, "slot must be an object."
#     day = (slot.get("day") or "").strip()
#     start = (slot.get("from") or "").strip()
#     end = (slot.get("to") or "").strip()
#     if not day or not start or not end:
#         return None, "slot requires 'day', 'from', 'to'."
#     return {"day": day, "from": start, "to": end}, None


# def _ensure_meeting_indexes(db):
#     if "meetings" not in db.list_collection_names():
#         db.create_collection("meetings")
#     db.meetings.create_index([("receiverId", 1), ("status", 1), ("createdAt", -1)], background=True)
#     db.meetings.create_index([("senderId", 1), ("createdAt", -1)], background=True)
#     db.meetings.create_index([("receiverId_oid", 1)], background=True)
#     db.meetings.create_index([("senderId_oid", 1)], background=True)


# def _ensure_notifications_collection(db):
#     if "notifications" not in db.list_collection_names():
#         db.create_collection("notifications")
#     db.notifications.create_index([("userId", 1), ("createdAt", -1)], background=True)
#     db.notifications.create_index([("read", 1)], background=True)


# def _emit_notify(user_id_str, payload):
#     """
#     Send a realtime bell-notification to one user room.
#     Your frontend already listens to 'notify' on /ws/chat and
#     shows it in the bell dropdown.
#     """
#     try:
#         sio = current_app.extensions.get("socketio")
#         if sio:
#             room = f"user:{str(user_id_str)}"
#             sio.emit("notify", payload, namespace="/ws/chat", to=room)
#     except Exception as e:
#         print("[meetings] socket emit error:", e)


# # ----------------------- routes ------------------------
# @meetings_bp.post("/request")
# @jwt_required()
# def request_meeting():
#     db = get_db()
#     sender_raw = get_jwt_identity()
#     payload = request.get_json() or {}

#     receiver_id = (payload.get("receiver_id") or "").strip()
#     slot, err = _validate_slot(payload.get("slot") or {})
#     if not receiver_id or err:
#         return jsonify({"ok": False, "error": err or "Missing receiver_id"}), 400

#     # store meeting
#     _ensure_meeting_indexes(db)
#     doc = {
#         "senderId": str(sender_raw),
#         "receiverId": str(receiver_id),
#         "slot": slot,
#         "status": "pending",
#         "createdAt": datetime.utcnow(),
#     }
#     s_oid = _as_oid(sender_raw)
#     r_oid = _as_oid(receiver_id)
#     if s_oid:
#         doc["senderId_oid"] = s_oid
#     if r_oid:
#         doc["receiverId_oid"] = r_oid

#     ins = db.meetings.insert_one(doc)

#     # persist bell notification for RECEIVER
#     _ensure_notifications_collection(db)
#     # IMPORTANT: your groups notifications API queries by ObjectId(userId),
#     # so write userId as ObjectId when possible.
#     notif = {
#         "userId": r_oid if r_oid else str(receiver_id),
#         "type": "meeting_request",
#         "title": "New meeting request",
#         "requestor": {"_id": str(sender_raw)},  # lightweight; UI can show generic text
#         "slot": slot,
#         "read": False,
#         "createdAt": datetime.utcnow(),
#     }
#     db.notifications.insert_one(notif)

#     # realtime push
#     _emit_notify(receiver_id, {
#         "type": "meeting_request",
#         "title": "New meeting request",
#         "slot": slot,
#         "requestor": {"_id": str(sender_raw)},
#         "at": datetime.utcnow().isoformat() + "Z",
#     })

#     return jsonify({"ok": True, "id": str(ins.inserted_id)}), 200


# @meetings_bp.post("/respond")
# @jwt_required()
# def respond_meeting():
#     db = get_db()
#     uid_raw = get_jwt_identity()
#     data = request.get_json() or {}

#     meeting_id = (data.get("meeting_id") or "").strip()
#     action = (data.get("action") or "").strip().lower()
#     if action not in ("accepted", "rejected"):
#         return jsonify({"ok": False, "error": "action must be 'accepted' or 'rejected'"}), 400

#     r_oid = _as_oid(uid_raw)
#     cond = {
#         "_id": _as_oid(meeting_id) or meeting_id,  # try OID first
#         "$or": [{"receiverId": str(uid_raw)}],
#     }
#     if r_oid:
#         cond["$or"].append({"receiverId_oid": r_oid})

#     upd = db.meetings.find_one_and_update(cond, {"$set": {"status": action}}, return_document=True)
#     if not upd:
#         return jsonify({"ok": False, "error": "Meeting not found or not authorized."}), 404

#     # Notify the SENDER about the decision
#     sender_id = upd.get("senderId")
#     s_oid = _as_oid(sender_id)

#     _ensure_notifications_collection(db)
#     notif_type = "meeting_accepted" if action == "accepted" else "meeting_rejected"
#     title = "Meeting accepted" if action == "accepted" else "Meeting rejected"

#     db.notifications.insert_one({
#         "userId": s_oid if s_oid else str(sender_id),
#         "type": notif_type,
#         "title": title,
#         "slot": upd.get("slot") or {},
#         "read": False,
#         "createdAt": datetime.utcnow(),
#     })

#     _emit_notify(sender_id, {
#         "type": notif_type,
#         "title": title,
#         "slot": upd.get("slot") or {},
#         "at": datetime.utcnow().isoformat() + "Z",
#     })

#     return jsonify({"ok": True, "status": action}), 200


# @meetings_bp.get("/list")
# @jwt_required()
# def list_meetings():
#     db = get_db()
#     uid_raw = get_jwt_identity()
#     me = str(uid_raw)

#     r_oid = _as_oid(uid_raw)
#     q = {"$or": [{"senderId": me}, {"receiverId": me}]}
#     if r_oid:
#         q["$or"].extend([{"senderId_oid": r_oid}, {"receiverId_oid": r_oid}])

#     cur = db.meetings.find(q).sort("createdAt", -1)
#     out = []
#     for m in cur:
#         sender_id = str(m.get("senderId", ""))
#         receiver_id = str(m.get("receiverId", ""))
#         direction = "incoming" if receiver_id == me else "outgoing"

#         out.append(
#             {
#                 "_id": str(m["_id"]),
#                 "senderId": sender_id,
#                 "receiverId": receiver_id,
#                 "slot": m.get("slot"),
#                 "status": m.get("status", "pending"),
#                 "direction": direction,             # <— added
#                 "createdAt": m["createdAt"].isoformat() + "Z",
#             }
#         )
#     return jsonify(out), 200


# backend/blueprints/meetings.py
from flask import Blueprint, jsonify, request, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from bson import ObjectId
from db import get_db
from datetime import datetime

meetings_bp = Blueprint("meetings_bp", __name__, url_prefix="/api/meetings")

def _as_oid(v):
    try:
        return ObjectId(v)
    except Exception:
        return None

def _validate_slot(slot):
    if not isinstance(slot, dict):
        return None, "slot must be an object."
    day = (slot.get("day") or "").strip()
    start = (slot.get("from") or "").strip()
    end = (slot.get("to") or "").strip()
    if not day or not start or not end:
        return None, "slot requires 'day', 'from', 'to'."
    return {"day": day, "from": start, "to": end}, None

def _ensure_meeting_indexes(db):
    if "meetings" not in db.list_collection_names():
        db.create_collection("meetings")
    db.meetings.create_index([("receiverId", 1), ("status", 1), ("createdAt", -1)], background=True)
    db.meetings.create_index([("senderId", 1), ("createdAt", -1)], background=True)
    db.meetings.create_index([("receiverId_oid", 1)], background=True)
    db.meetings.create_index([("senderId_oid", 1)], background=True)
    # NEW: to filter hidden rows efficiently
    db.meetings.create_index([("deletedFor", 1)], background=True)

def _ensure_notifications_collection(db):
    if "notifications" not in db.list_collection_names():
        db.create_collection("notifications")
    db.notifications.create_index([("userId", 1), ("createdAt", -1)], background=True)
    db.notifications.create_index([("read", 1)], background=True)

def _emit_notify(user_id_str, payload):
    try:
        sio = current_app.extensions.get("socketio")
        if sio:
            room = f"user:{str(user_id_str)}"
            sio.emit("notify", payload, namespace="/ws/chat", to=room)
    except Exception as e:
        print("[meetings] socket emit error:", e)

@meetings_bp.post("/request")
@jwt_required()
def request_meeting():
    db = get_db()
    sender_raw = get_jwt_identity()
    payload = request.get_json() or {}

    receiver_id = (payload.get("receiver_id") or "").strip()
    slot, err = _validate_slot(payload.get("slot") or {})
    if not receiver_id or err:
        return jsonify({"ok": False, "error": err or "Missing receiver_id"}), 400

    _ensure_meeting_indexes(db)
    doc = {
        "senderId": str(sender_raw),
        "receiverId": str(receiver_id),
        "slot": slot,
        "status": "pending",
        "createdAt": datetime.utcnow(),
        "deletedFor": [],   # NEW: users who cleared this item
    }
    s_oid = _as_oid(sender_raw)
    r_oid = _as_oid(receiver_id)
    if s_oid: doc["senderId_oid"] = s_oid
    if r_oid: doc["receiverId_oid"] = r_oid

    ins = db.meetings.insert_one(doc)

    _ensure_notifications_collection(db)
    notif = {
        "userId": r_oid if r_oid else str(receiver_id),
        "type": "meeting_request",
        "title": "New meeting request",
        "requestor": {"_id": str(sender_raw)},
        "slot": slot,
        "read": False,
        "createdAt": datetime.utcnow(),
    }
    db.notifications.insert_one(notif)

    _emit_notify(receiver_id, {
        "type": "meeting_request",
        "title": "New meeting request",
        "slot": slot,
        "requestor": {"_id": str(sender_raw)},
        "at": datetime.utcnow().isoformat() + "Z",
    })

    return jsonify({"ok": True, "id": str(ins.inserted_id)}), 200

@meetings_bp.post("/respond")
@jwt_required()
def respond_meeting():
    db = get_db()
    uid_raw = get_jwt_identity()
    data = request.get_json() or {}

    meeting_id = (data.get("meeting_id") or "").strip()
    action = (data.get("action") or "").strip().lower()
    if action not in ("accepted", "rejected"):
        return jsonify({"ok": False, "error": "action must be 'accepted' or 'rejected'"}), 400

    r_oid = _as_oid(uid_raw)
    cond = {"_id": _as_oid(meeting_id) or meeting_id, "$or": [{"receiverId": str(uid_raw)}]}
    if r_oid: cond["$or"].append({"receiverId_oid": r_oid})

    upd = db.meetings.find_one_and_update(cond, {"$set": {"status": action}}, return_document=True)
    if not upd:
        return jsonify({"ok": False, "error": "Meeting not found or not authorized."}), 404

    sender_id = upd.get("senderId")
    s_oid = _as_oid(sender_id)

    _ensure_notifications_collection(db)
    notif_type = "meeting_accepted" if action == "accepted" else "meeting_rejected"
    title = "Meeting accepted" if action == "accepted" else "Meeting rejected"

    db.notifications.insert_one({
        "userId": s_oid if s_oid else str(sender_id),
        "type": notif_type,
        "title": title,
        "slot": upd.get("slot") or {},
        "read": False,
        "createdAt": datetime.utcnow(),
    })

    _emit_notify(sender_id, {
        "type": notif_type,
        "title": title,
        "slot": upd.get("slot") or {},
        "at": datetime.utcnow().isoformat() + "Z",
    })

    return jsonify({"ok": True, "status": action}), 200

@meetings_bp.get("/list")
@jwt_required()
def list_meetings():
    db = get_db()
    uid_raw = get_jwt_identity()
    uid_str = str(uid_raw)
    r_oid = _as_oid(uid_raw)

    # hide items the current user cleared
    base_or = [{"senderId": uid_str}, {"receiverId": uid_str}]
    if r_oid:
        base_or.extend([{"senderId_oid": r_oid}, {"receiverId_oid": r_oid}])

    q = {
        "$and": [
            {"$or": base_or},
            {"deletedFor": {"$ne": uid_str}},  # (string check)
        ]
    }

    cur = db.meetings.find(q).sort("createdAt", -1)
    out = []
    for m in cur:
        role = "sent" if m.get("senderId") == uid_str else "received"
        out.append({
            "_id": str(m["_id"]),
            "senderId": m.get("senderId"),
            "receiverId": m.get("receiverId"),
            "slot": m.get("slot"),
            "status": m.get("status", "pending"),
            "role": role,  # NEW
            "createdAt": m["createdAt"].isoformat() + "Z",
        })
    return jsonify(out), 200

@meetings_bp.post("/clear")
@jwt_required()
def clear_meeting():
    """Soft-delete for the current user (doesn't remove for the other party)."""
    db = get_db()
    uid_str = str(get_jwt_identity())
    data = request.get_json() or {}
    meeting_id = (data.get("meeting_id") or "").strip()
    if not meeting_id:
        return jsonify({"ok": False, "error": "meeting_id required"}), 400

    m_id = _as_oid(meeting_id) or meeting_id
    upd = db.meetings.update_one(
        {"_id": m_id},
        {"$addToSet": {"deletedFor": uid_str}}
    )
    if upd.matched_count == 0:
        return jsonify({"ok": False, "error": "Not found"}), 404
    return jsonify({"ok": True}), 200
