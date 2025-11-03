# from __future__ import annotations

# from flask import Blueprint, jsonify, request, current_app
# from flask_jwt_extended import jwt_required, get_jwt_identity
# from bson import ObjectId
# from datetime import datetime, date, time as dtime
# from zoneinfo import ZoneInfo
# import os
# import secrets

# from db import get_db

# meetings_bp = Blueprint("meetings_bp", __name__, url_prefix="/api/meetings")

# def _as_oid(v):
#     try:
#         return ObjectId(v)
#     except Exception:
#         return None

# def _default_tz() -> str:
#     return os.getenv("DEFAULT_TZ", "America/New_York")

# def _parse_hhmm(s: str) -> dtime | None:
#     try:
#         hh, mm = s.split(":")
#         return dtime(int(hh), int(mm))
#     except Exception:
#         return None

# def _format_when(slot: dict) -> tuple[str, str]:
#     """
#     Returns (text, html) like:
#     'Tue, Oct 28 — 11:38–12:39 EDT'
#     """
#     tz_name = (slot.get("tz") or _default_tz()).strip()
#     try:
#         tz = ZoneInfo(tz_name)
#     except Exception:
#         tz = ZoneInfo("America/New_York")
#         tz_name = "America/New_York"

#     try:
#         y, m, d = [int(x) for x in (slot.get("date") or "").split("-")]
#         t_from = _parse_hhmm(slot.get("from") or "")
#         t_to = _parse_hhmm(slot.get("to") or "")
#         d_obj = date(y, m, d)
#         start_local = datetime.combine(d_obj, t_from, tzinfo=tz)
#         end_local = datetime.combine(d_obj, t_to, tzinfo=tz)
#     except Exception:
#         # fallback text if anything is malformed
#         txt = f"{slot.get('day','')} {slot.get('date','')} {slot.get('from','')}–{slot.get('to','')}"
#         return txt.strip(), f"<strong>{txt.strip()}</strong>"

#     text = f"{start_local:%a, %b %d} — {start_local:%H:%M}–{end_local:%H:%M} {start_local:%Z}"
#     html = (
#         f"<strong>{start_local:%a, %b %d}</strong> — "
#         f"<span>{start_local:%H:%M}–{end_local:%H:%M}</span> "
#         f"<em>{start_local:%Z}</em>"
#     )
#     return text, html

# def _validate_slot(slot):
#     """
#     Requires: slot.date='YYYY-MM-DD', slot.from='HH:MM', slot.to='HH:MM'
#     Optional: slot.day, slot.tz
#     Computes startAt/endAt in UTC.
#     """
#     if not isinstance(slot, dict):
#         return None, None, None, "slot must be an object."

#     day = (slot.get("day") or "").strip()
#     date_str = (slot.get("date") or "").strip()
#     start = (slot.get("from") or "").strip()
#     end = (slot.get("to") or "").strip()
#     if not date_str or not start or not end:
#         return None, None, None, "slot requires 'date', 'from', and 'to'."

#     try:
#         yyyy, mm, dd = [int(x) for x in date_str.split("-")]
#         d_obj = date(yyyy, mm, dd)
#     except Exception:
#         return None, None, None, "slot.date must be YYYY-MM-DD."

#     if not day:
#         day = d_obj.strftime("%A")

#     t_from = _parse_hhmm(start)
#     t_to = _parse_hhmm(end)
#     if not t_from or not t_to:
#         return None, None, None, "Times must be HH:MM (24h)."

#     tz_name = (slot.get("tz") or _default_tz()).strip()
#     try:
#         tz = ZoneInfo(tz_name)
#     except Exception:
#         tz = ZoneInfo("America/New_York")
#         tz_name = "America/New_York"

#     start_local = datetime.combine(d_obj, t_from, tzinfo=tz)
#     end_local = datetime.combine(d_obj, t_to, tzinfo=tz)
#     start_utc = start_local.astimezone(ZoneInfo("UTC"))
#     end_utc = end_local.astimezone(ZoneInfo("UTC"))

#     clean = {"day": day, "date": date_str, "from": start, "to": end, "tz": tz_name}
#     return clean, start_utc, end_utc, None

# def _ensure_meeting_indexes(db):
#     if "meetings" not in db.list_collection_names():
#         db.create_collection("meetings")
#     db.meetings.create_index([("receiverId", 1), ("status", 1), ("createdAt", -1)], background=True)
#     db.meetings.create_index([("senderId", 1), ("createdAt", -1)], background=True)
#     db.meetings.create_index([("receiverId_oid", 1)], background=True)
#     db.meetings.create_index([("senderId_oid", 1)], background=True)
#     db.meetings.create_index([("deletedFor", 1)], background=True)
#     db.meetings.create_index([("startAt", 1)], background=True)
#     db.meetings.create_index([("status", 1), ("startAt", 1)], background=True)

# def _ensure_notifications_collection(db):
#     if "notifications" not in db.list_collection_names():
#         db.create_collection("notifications")
#     db.notifications.create_index([("userId", 1), ("createdAt", -1)], background=True)
#     db.notifications.create_index([("read", 1), ("userId", 1)], background=True)

# def _emit(user_id_str: str, event: str, payload: dict):
#     try:
#         sio = current_app.extensions.get("socketio")
#         if sio:
#             room = f"user:{str(user_id_str)}"
#             sio.emit(event, payload, namespace="/ws/chat", to=room)
#     except Exception as e:
#         print("[meetings] socket emit error:", e)

# def generate_video_link():
#     provider = (os.getenv("VIDEO_PROVIDER") or "jitsi").lower()
#     if provider == "jitsi":
#         base = os.getenv("JITSI_BASE", "https://meet.jit.si").rstrip("/")
#         slug = "SGH-" + secrets.token_urlsafe(6).replace("-", "").replace("_", "")
#         return f"{base}/{slug}"
#     return None

# def _get_user_email(db, uid_str: str) -> str | None:
#     if "users" not in db.list_collection_names():
#         return None
#     users = db["users"]
#     doc = users.find_one({"_id": _as_oid(uid_str)}) or users.find_one({"id": uid_str})
#     return doc.get("email") if doc else None

# @meetings_bp.post("/request")
# @jwt_required()
# def request_meeting():
#     db = get_db()
#     sender_raw = str(get_jwt_identity())
#     payload = request.get_json() or {}

#     receiver_id = (payload.get("receiver_id") or "").strip()
#     slot, start_utc, end_utc, err = _validate_slot(payload.get("slot") or {})
#     if not receiver_id or err:
#         return jsonify({"ok": False, "error": err or "Missing receiver_id"}), 400

#     _ensure_meeting_indexes(db)

#     # Link is NOT created until acceptance.
#     doc = {
#         "senderId": sender_raw,
#         "receiverId": receiver_id,
#         "slot": slot,
#         "startAt": start_utc,
#         "endAt": end_utc,
#         "status": "pending",
#         "createdAt": datetime.utcnow(),
#         "deletedFor": [],
#         "meetingLink": None,
#     }
#     s_oid = _as_oid(sender_raw)
#     r_oid = _as_oid(receiver_id)
#     if s_oid: doc["senderId_oid"] = s_oid
#     if r_oid: doc["receiverId_oid"] = r_oid
#     ins = db.meetings.insert_one(doc)

#     # In-app notification
#     _ensure_notifications_collection(db)
#     db.notifications.insert_one({
#         "userId": r_oid if r_oid else receiver_id,
#         "type": "meeting_request",
#         "title": "New meeting request",
#         "requestor": {"_id": sender_raw},
#         "slot": slot,
#         "read": False,
#         "createdAt": datetime.utcnow(),
#     })
#     _emit(receiver_id, "notify", {
#         "type": "meeting_request",
#         "title": "New meeting request",
#         "slot": slot,
#         "requestor": {"_id": sender_raw},
#         "at": datetime.utcnow().isoformat() + "Z",
#     })

#     # Emails (request) — no link yet
#     try:
#         from mailer import send_email
#         when_text, when_html = _format_when(slot)
#         sender_email = _get_user_email(db, sender_raw)
#         receiver_email = _get_user_email(db, receiver_id)

#         if sender_email:
#             send_email(
#                 to=sender_email,
#                 subject="Study Group Hub: Request sent",
#                 html=f"""
#                   <div style="font-family:system-ui,Segoe UI,Arial">
#                     <h2>Request sent</h2>
#                     <p>Proposed time: {when_html}</p>
#                     <p>We’ll notify you when it’s accepted or rejected.</p>
#                   </div>
#                 """,
#                 text=f"Proposed time: {when_text}. We’ll notify you when it’s accepted or rejected.",
#             )
#         if receiver_email:
#             send_email(
#                 to=receiver_email,
#                 subject="Study Group Hub: New meeting request",
#                 html=f"""
#                   <div style="font-family:system-ui,Segoe UI,Arial">
#                     <h2>New meeting request</h2>
#                     <p>Proposed time: {when_html}</p>
#                     <p>Open <strong>Meetings</strong> in Study Group Hub to accept or reject.</p>
#                   </div>
#                 """,
#                 text=f"New request: {when_text}. Open Meetings to accept or reject.",
#             )
#     except Exception as e:
#         print("[meetings] email(request) error:", e)

#     return jsonify({"ok": True, "id": str(ins.inserted_id)}), 200

# @meetings_bp.post("/respond")
# @jwt_required()
# def respond_meeting():
#     db = get_db()
#     uid_raw = str(get_jwt_identity())
#     data = request.get_json() or {}

#     meeting_id = (data.get("meeting_id") or "").strip()
#     action = (data.get("action") or "").strip().lower()
#     if action not in ("accepted", "rejected"):
#         return jsonify({"ok": False, "error": "action must be 'accepted' or 'rejected'"}), 400

#     r_oid = _as_oid(uid_raw)
#     cond = {"_id": _as_oid(meeting_id) or meeting_id, "$or": [{"receiverId": uid_raw}]}
#     if r_oid: cond["$or"].append({"receiverId_oid": r_oid})

#     upd = db.meetings.find_one_and_update(
#         cond,
#         {"$set": {"status": action, "respondedAt": datetime.utcnow()}},
#         return_document=True,
#     )
#     if not upd:
#         return jsonify({"ok": False, "error": "Meeting not found or not authorized."}), 404

#     # Create link only on accept
#     if action == "accepted" and not upd.get("meetingLink"):
#         link = generate_video_link()
#         if link:
#             db.meetings.update_one({"_id": upd["_id"]}, {"$set": {"meetingLink": link}})
#             upd["meetingLink"] = link

#     # Notify sender
#     sender_id = upd.get("senderId")
#     _ensure_notifications_collection(db)
#     notif_type = "meeting_accepted" if action == "accepted" else "meeting_rejected"
#     title = "Meeting accepted" if action == "accepted" else "Meeting rejected"
#     db.notifications.insert_one({
#         "userId": _as_oid(sender_id) or sender_id,
#         "type": notif_type,
#         "title": title,
#         "slot": upd.get("slot") or {},
#         "read": False,
#         "createdAt": datetime.utcnow(),
#     })
#     _emit(sender_id, "notify", {
#         "type": notif_type,
#         "title": title,
#         "slot": upd.get("slot") or {},
#         "at": datetime.utcnow().isoformat() + "Z",
#     })

#     # Push real-time update so lists refresh without reload
#     payload = {
#         "_id": str(upd["_id"]),
#         "status": upd.get("status"),
#         "meetingLink": upd.get("meetingLink") if upd.get("status") == "accepted" else None,
#     }
#     _emit(sender_id, "meeting_updated", payload)
#     _emit(uid_raw,   "meeting_updated", payload)

#     # Emails (respond)
#     try:
#         from mailer import send_email
#         slot = upd.get("slot") or {}
#         when_text, when_html = _format_when(slot)
#         link = upd.get("meetingLink")
#         sender_email = _get_user_email(db, sender_id)
#         receiver_email = _get_user_email(db, uid_raw)

#         if action == "accepted":
#             if sender_email:
#                 send_email(
#                     to=sender_email,
#                     subject="Study Group Hub: Your meeting request was accepted",
#                     html=f"""
#                       <div style="font-family:system-ui,Segoe UI,Arial">
#                         <h2>Your meeting request was accepted</h2>
#                         <p>Time: {when_html}</p>
#                         {f"<p>Meeting link: <a href='{link}'>{link}</a></p>" if link else ""}
#                       </div>
#                     """,
#                     text=f"Accepted: {when_text}. Link: {link or '(no link)'}",
#                 )
#             if receiver_email:
#                 send_email(
#                     to=receiver_email,
#                     subject="Study Group Hub: You accepted the meeting",
#                     html=f"""
#                       <div style="font-family:system-ui,Segoe UI,Arial">
#                         <h2>You accepted the meeting</h2>
#                         <p>Time: {when_html}</p>
#                         {f"<p>Meeting link: <a href='{link}'>{link}</a></p>" if link else ""}
#                         <p>A confirmation was emailed to the requester.</p>
#                       </div>
#                     """,
#                     text=f"You accepted the meeting: {when_text}. Link: {link or '(no link)'}",
#                 )
#         else:
#             if sender_email:
#                 send_email(
#                     to=sender_email,
#                     subject="Study Group Hub: Meeting request was rejected",
#                     html=f"""
#                       <div style="font-family:system-ui,Segoe UI,Arial">
#                         <h2>Your meeting request was rejected</h2>
#                         <p>Time proposed: {when_html}</p>
#                       </div>
#                     """,
#                     text=f"Your request was rejected. Time proposed: {when_text}.",
#                 )
#             if receiver_email:
#                 send_email(
#                     to=receiver_email,
#                     subject="Study Group Hub: You rejected the meeting",
#                     html=f"""
#                       <div style="font-family:system-ui,Segoe UI,Arial">
#                         <h2>You rejected the meeting</h2>
#                         <p>Time proposed: {when_html}</p>
#                       </div>
#                     """,
#                     text=f"You rejected the meeting. Time proposed: {when_text}.",
#                 )
#     except Exception as e:
#         print("[meetings] email(respond) error:", e)

#     return jsonify({
#         "ok": True,
#         "status": action,
#         "meeting": {
#             "_id": str(upd["_id"]),
#             "status": upd.get("status"),
#             "meetingLink": upd.get("meetingLink") if upd.get("status") == "accepted" else None,
#         },
#     }), 200

# @meetings_bp.get("/list")
# @jwt_required()
# def list_meetings():
#     db = get_db()
#     uid_raw = str(get_jwt_identity())
#     r_oid = _as_oid(uid_raw)

#     base_or = [{"senderId": uid_raw}, {"receiverId": uid_raw}]
#     if r_oid:
#         base_or.extend([{"senderId_oid": r_oid}, {"receiverId_oid": r_oid}])

#     q = {"$and": [{"$or": base_or}, {"deletedFor": {"$ne": uid_raw}}]}
#     cur = db.meetings.find(q).sort("createdAt", -1)

#     out = []
#     for m in cur:
#         role = "sent" if m.get("senderId") == uid_raw else "received"
#         out.append({
#             "_id": str(m["_id"]),
#             "senderId": m.get("senderId"),
#             "receiverId": m.get("receiverId"),
#             "slot": m.get("slot"),
#             "status": m.get("status", "pending"),
#             "role": role,
#             "meetingLink": m.get("meetingLink") if m.get("status") == "accepted" else None,
#             "startAt": m.get("startAt").isoformat() + "Z" if m.get("startAt") else None,
#             "createdAt": m["createdAt"].isoformat() + "Z",
#         })
#     return jsonify(out), 200

# @meetings_bp.post("/clear")
# @jwt_required()
# def clear_meeting():
#     db = get_db()
#     uid_str = str(get_jwt_identity())
#     data = request.get_json() or {}
#     meeting_id = (data.get("meeting_id") or "").strip()
#     if not meeting_id:
#         return jsonify({"ok": False, "error": "meeting_id required"}), 400

#     m_id = _as_oid(meeting_id) or meeting_id
#     upd = db.meetings.update_one({"_id": m_id}, {"$addToSet": {"deletedFor": uid_str}})
#     if upd.matched_count == 0:
#         return jsonify({"ok": False, "error": "Not found"}), 404
#     return jsonify({"ok": True}), 200

# backend/blueprints/meetings.py
from __future__ import annotations

from datetime import datetime, date, time as dtime
from zoneinfo import ZoneInfo
import os
import secrets

from flask import Blueprint, jsonify, request, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from bson import ObjectId
from pymongo import ReturnDocument
from flask import Response

from db import get_db

meetings_bp = Blueprint("meetings_bp", __name__, url_prefix="/api/meetings")


# ----------------------- helpers ------------------------
def _as_oid(v):
    try:
        return ObjectId(v)
    except Exception:
        return None


def _default_tz() -> str:
    # Ohio (Eastern Time) by default
    return os.getenv("DEFAULT_TZ", "America/New_York")


def _parse_hhmm(s: str) -> dtime | None:
    try:
        hh, mm = s.split(":")
        return dtime(int(hh), int(mm))
    except Exception:
        return None


def _format_when(slot: dict) -> tuple[str, str]:
    """
    Returns (text, html) such as:
    text: 'Tue, Oct 28 — 11:38–12:39 EDT'
    html: '<strong>Tue, Oct 28</strong> — <span>11:38–12:39</span> <em>EDT</em>'
    """
    tz_name = (slot.get("tz") or _default_tz()).strip()
    try:
        tz = ZoneInfo(tz_name)
    except Exception:
        tz = ZoneInfo("America/New_York")
        tz_name = "America/New_York"

    y, m, d = [int(x) for x in (slot.get("date") or "").split("-")]
    t_from = _parse_hhmm(slot.get("from") or "")
    t_to = _parse_hhmm(slot.get("to") or "")
    d_obj = date(y, m, d)

    start_local = datetime.combine(d_obj, t_from, tzinfo=tz)
    end_local = datetime.combine(d_obj, t_to, tzinfo=tz)

    text = f"{start_local:%a, %b %d} — {start_local:%H:%M}–{end_local:%H:%M} {start_local:%Z}"
    html = (
        f"<strong>{start_local:%a, %b %d}</strong> — "
        f"<span>{start_local:%H:%M}–{end_local:%H:%M}</span> "
        f"<em>{start_local:%Z}</em>"
    )
    return text, html


def _validate_slot(slot):
    """
    Requires: slot.date='YYYY-MM-DD', slot.from='HH:MM', slot.to='HH:MM'
    Optional: slot.day, slot.tz
    Computes startAt/endAt in UTC.
    """
    if not isinstance(slot, dict):
        return None, None, None, "slot must be an object."

    day = (slot.get("day") or "").strip()
    date_str = (slot.get("date") or "").strip()
    start = (slot.get("from") or "").strip()
    end = (slot.get("to") or "").strip()
    if not date_str or not start or not end:
        return None, None, None, "slot requires 'date', 'from', and 'to'."

    try:
        yyyy, mm, dd = [int(x) for x in date_str.split("-")]
        d_obj = date(yyyy, mm, dd)
    except Exception:
        return None, None, None, "slot.date must be YYYY-MM-DD."

    if not day:
        day = d_obj.strftime("%A")

    t_from = _parse_hhmm(start)
    t_to = _parse_hhmm(end)
    if not t_from or not t_to:
        return None, None, None, "Times must be HH:MM (24h)."

    tz_name = (slot.get("tz") or _default_tz()).strip()
    try:
        tz = ZoneInfo(tz_name)
    except Exception:
        tz = ZoneInfo("America/New_York")
        tz_name = "America/New_York"

    start_local = datetime.combine(d_obj, t_from, tzinfo=tz)
    end_local = datetime.combine(d_obj, t_to, tzinfo=tz)
    start_utc = start_local.astimezone(ZoneInfo("UTC"))
    end_utc = end_local.astimezone(ZoneInfo("UTC"))

    clean = {
        "day": day,
        "date": date_str,
        "from": start,
        "to": end,
        "tz": tz_name,
    }
    return clean, start_utc, end_utc, None


def _ensure_meeting_indexes(db):
    if "meetings" not in db.list_collection_names():
        db.create_collection("meetings")
    db.meetings.create_index([("receiverId", 1), ("status", 1), ("createdAt", -1)], background=True)
    db.meetings.create_index([("senderId", 1), ("createdAt", -1)], background=True)
    db.meetings.create_index([("receiverId_oid", 1)], background=True)
    db.meetings.create_index([("senderId_oid", 1)], background=True)
    db.meetings.create_index([("deletedFor", 1)], background=True)
    db.meetings.create_index([("startAt", 1)], background=True)
    db.meetings.create_index([("status", 1), ("startAt", 1)], background=True)


def _ensure_notifications_collection(db):
    if "notifications" not in db.list_collection_names():
        db.create_collection("notifications")
    db.notifications.create_index([("userId", 1), ("createdAt", -1)], background=True)
    db.notifications.create_index([("read", 1)], background=True)


def _emit(user_id_str: str, event: str, payload: dict):
    try:
        sio = current_app.extensions.get("socketio")
        if sio:
            room = f"user:{str(user_id_str)}"
            sio.emit(event, payload, namespace="/ws/chat", to=room)
    except Exception as e:
        print("[meetings] socket emit error:", e)


def generate_video_link():
    provider = (os.getenv("VIDEO_PROVIDER") or "jitsi").lower()
    if provider == "jitsi":
        base = os.getenv("JITSI_BASE", "https://meet.jit.si").rstrip("/")
        slug = "SGH-" + secrets.token_urlsafe(6).replace("-", "").replace("_", "")
        return f"{base}/{slug}"
    return None


def _get_user_email(db, uid_str: str) -> str | None:
    """Best-effort email lookup; adjust to your schema as needed."""
    if "users" not in db.list_collection_names():
        return None
    users = db["users"]  # don't use `if users:`; Collection has no truthiness
    doc = users.find_one({"_id": _as_oid(uid_str)}) or users.find_one({"id": uid_str})
    return (doc or {}).get("email")


# ----------------------- routes ------------------------
@meetings_bp.post("/request")
@jwt_required()
def request_meeting():
    db = get_db()
    sender_raw = str(get_jwt_identity())
    payload = request.get_json() or {}

    receiver_id = (payload.get("receiver_id") or "").strip()
    slot, start_utc, end_utc, err = _validate_slot(payload.get("slot") or {})
    if not receiver_id or err:
        return jsonify({"ok": False, "error": err or "Missing receiver_id"}), 400

    _ensure_meeting_indexes(db)

    # Do NOT create link yet — only after acceptance.
    doc = {
        "senderId": sender_raw,
        "receiverId": receiver_id,
        "slot": slot,
        "startAt": start_utc,
        "endAt": end_utc,
        "status": "pending",
        "createdAt": datetime.utcnow(),
        "deletedFor": [],
        "meetingLink": None,
    }
    s_oid = _as_oid(sender_raw)
    r_oid = _as_oid(receiver_id)
    if s_oid:
        doc["senderId_oid"] = s_oid
    if r_oid:
        doc["receiverId_oid"] = r_oid

    ins = db.meetings.insert_one(doc)

    # in-app notification
    _ensure_notifications_collection(db)
    db.notifications.insert_one({
        "userId": r_oid if r_oid else receiver_id,
        "type": "meeting_request",
        "title": "New meeting request",
        "requestor": {"_id": sender_raw},
        "slot": slot,
        "read": False,
        "createdAt": datetime.utcnow(),
    })
    _emit(receiver_id, "notify", {
        "type": "meeting_request",
        "title": "New meeting request",
        "slot": slot,
        "requestor": {"_id": sender_raw},
        "at": datetime.utcnow().isoformat() + "Z",
    })

    # emails (both people) – request created (no link)
    try:
        from mailer import send_email
        when_text, when_html = _format_when(slot)

        sender_email = _get_user_email(db, sender_raw)
        receiver_email = _get_user_email(db, receiver_id)

        if sender_email:
            send_email(
                to=sender_email,
                subject="Study Group Hub: Request sent",
                html=f"""
                  <div style="font-family:system-ui,Segoe UI,Arial">
                    <h2>Request sent</h2>
                    <p>Proposed time: {when_html}</p>
                    <p>We’ll notify you when it’s accepted or rejected.</p>
                  </div>
                """,
                text=f"Proposed time: {when_text}. We’ll notify you when it’s accepted or rejected.",
            )

        if receiver_email:
            send_email(
                to=receiver_email,
                subject="Study Group Hub: New meeting request",
                html=f"""
                  <div style="font-family:system-ui,Segoe UI,Arial">
                    <h2>New meeting request</h2>
                    <p>Proposed time: {when_html}</p>
                    <p>Open <strong>Meetings</strong> in Study Group Hub to accept or reject.</p>
                  </div>
                """,
                text=f"New request: {when_text}. Open Meetings in Study Group Hub to accept or reject.",
            )
    except Exception as e:
        print("[meetings] email(request) error:", e)

    return jsonify({"ok": True, "id": str(ins.inserted_id)}), 200


@meetings_bp.post("/respond")
@jwt_required()
def respond_meeting():
    db = get_db()
    uid_raw = str(get_jwt_identity())
    data = request.get_json() or {}

    meeting_id = (data.get("meeting_id") or "").strip()
    action = (data.get("action") or "").strip().lower()
    if action not in ("accepted", "rejected"):
        return jsonify({"ok": False, "error": "action must be 'accepted' or 'rejected'"}), 400

    # Ensure we have a valid ObjectId; otherwise we'll never match
    mid = _as_oid(meeting_id)
    if not mid:
        return jsonify({"ok": False, "error": "invalid meeting_id"}), 400

    r_oid = _as_oid(uid_raw)
    cond = {"_id": mid, "$or": [{"receiverId": uid_raw}]}
    if r_oid:
        cond["$or"].append({"receiverId_oid": r_oid})

    # Use ReturnDocument.AFTER so we get the updated document back
    upd = db.meetings.find_one_and_update(
        cond,
        {"$set": {"status": action, "respondedAt": datetime.utcnow()}},
        return_document=ReturnDocument.AFTER,
    )
    if not upd:
        return jsonify({"ok": False, "error": "Meeting not found or not authorized."}), 404

    # Create link only on accept
    if action == "accepted" and not upd.get("meetingLink"):
        link = generate_video_link()
        if link:
            db.meetings.update_one({"_id": upd["_id"]}, {"$set": {"meetingLink": link}})
            upd["meetingLink"] = link

    # notify sender
    sender_id = upd.get("senderId")
    _ensure_notifications_collection(db)
    notif_type = "meeting_accepted" if action == "accepted" else "meeting_rejected"
    title = "Meeting accepted" if action == "accepted" else "Meeting rejected"
    db.notifications.insert_one({
        "userId": _as_oid(sender_id) or sender_id,
        "type": notif_type,
        "title": title,
        "slot": upd.get("slot") or {},
        "read": False,
        "createdAt": datetime.utcnow(),
    })
    _emit(sender_id, "notify", {
        "type": notif_type,
        "title": title,
        "slot": upd.get("slot") or {},
        "at": datetime.utcnow().isoformat() + "Z",
    })

    # push a real-time row update to BOTH parties so lists refresh without reload
    payload = {
        "_id": str(upd["_id"]),
        "status": upd.get("status"),
        "meetingLink": upd.get("meetingLink") if upd.get("status") == "accepted" else None,
    }
    _emit(sender_id, "meeting_updated", payload)
    _emit(uid_raw,   "meeting_updated", payload)

    # acceptance emails with link; rejection email without link
    try:
        from mailer import send_email
        slot = upd.get("slot") or {}
        when_text, when_html = _format_when(slot)
        link = upd.get("meetingLink")

        sender_email = _get_user_email(db, sender_id)
        receiver_email = _get_user_email(db, uid_raw)

        if action == "accepted":
            if sender_email:
                send_email(
                    to=sender_email,
                    subject="Study Group Hub: Your meeting request was accepted",
                    html=f"""
                      <div style="font-family:system-ui,Segoe UI,Arial">
                        <h2>Your meeting request was accepted</h2>
                        <p>Time: {when_html}</p>
                        {f"<p>Meeting link: <a href='{link}'>{link}</a></p>" if link else ""}
                      </div>
                    """,
                    text=f"Accepted: {when_text}. Link: {link or '(no link)'}",
                )
            if receiver_email:
                send_email(
                    to=receiver_email,
                    subject="Study Group Hub: You accepted the meeting",
                    html=f"""
                      <div style="font-family:system-ui,Segoe UI,Arial">
                        <h2>You accepted the meeting</h2>
                        <p>Time: {when_html}</p>
                        {f"<p>Meeting link: <a href='{link}'>{link}</a></p>" if link else ""}
                        <p>A confirmation was emailed to the requester.</p>
                      </div>
                    """,
                    text=f"You accepted the meeting: {when_text}. Link: {link or '(no link)'}",
                )
        else:  # rejected
            if sender_email:
                send_email(
                    to=sender_email,
                    subject="Study Group Hub: Meeting request was rejected",
                    html=f"""
                      <div style="font-family:system-ui,Segoe UI,Arial">
                        <h2>Your meeting request was rejected</h2>
                        <p>Time proposed: {when_html}</p>
                      </div>
                    """,
                    text=f"Your request was rejected. Time proposed: {when_text}.",
                )
            if receiver_email:
                send_email(
                    to=receiver_email,
                    subject="Study Group Hub: You rejected the meeting",
                    html=f"""
                      <div style="font-family:system-ui,Segoe UI,Arial">
                        <h2>You rejected the meeting</h2>
                        <p>Time proposed: {when_html}</p>
                      </div>
                    """,
                    text=f"You rejected the meeting. Time proposed: {when_text}.",
                )
    except Exception as e:
        print("[meetings] email(respond) error:", e)

    # return the updated row (frontend can update immediately)
    return jsonify({
        "ok": True,
        "status": action,
        "meeting": {
            "_id": str(upd["_id"]),
            "status": upd.get("status"),
            "meetingLink": upd.get("meetingLink") if upd.get("status") == "accepted" else None,
        },
    }), 200


@meetings_bp.get("/list")
@jwt_required()
def list_meetings():
    db = get_db()
    uid_raw = str(get_jwt_identity())
    r_oid = _as_oid(uid_raw)

    base_or = [{"senderId": uid_raw}, {"receiverId": uid_raw}]
    if r_oid:
        base_or.extend([{"senderId_oid": r_oid}, {"receiverId_oid": r_oid}])

    q = {"$and": [{"$or": base_or}, {"deletedFor": {"$ne": uid_raw}}]}
    cur = db.meetings.find(q).sort("createdAt", -1)

    out = []
    for m in cur:
        role = "sent" if m.get("senderId") == uid_raw else "received"
        created_at = m.get("createdAt")
        start_at = m.get("startAt")
        out.append({
            "_id": str(m["_id"]),
            "senderId": m.get("senderId"),
            "receiverId": m.get("receiverId"),
            "slot": m.get("slot"),
            "status": m.get("status", "pending"),
            "role": role,
            # only expose link when accepted
            "meetingLink": m.get("meetingLink") if m.get("status") == "accepted" else None,
            "startAt": start_at.isoformat() + "Z" if isinstance(start_at, datetime) else None,
            "createdAt": created_at.isoformat() + "Z" if isinstance(created_at, datetime) else None,
        })
    return jsonify(out), 200


@meetings_bp.post("/clear")
@jwt_required()
def clear_meeting():
    db = get_db()
    uid_str = str(get_jwt_identity())
    data = request.get_json() or {}
    meeting_id = (data.get("meeting_id") or "").strip()
    if not meeting_id:
        return jsonify({"ok": False, "error": "meeting_id required"}), 400

    m_id = _as_oid(meeting_id)
    if not m_id:
        return jsonify({"ok": False, "error": "invalid meeting_id"}), 400

    upd = db.meetings.update_one({"_id": m_id}, {"$addToSet": {"deletedFor": uid_str}})
    if upd.matched_count == 0:
        return jsonify({"ok": False, "error": "Not found"}), 404
    return jsonify({"ok": True}), 200

def _ics_for_meeting(doc: dict) -> str:
    from datetime import timezone
    slot = doc.get("slot") or {}
    start = doc.get("startAt")
    end = doc.get("endAt")
    link = doc.get("meetingLink") or ""
    if not isinstance(start, datetime) or not isinstance(end, datetime):
        return ""

    def esc(s: str) -> str:
        return (s or "").replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace("\n", "\\n")

    dtstamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    dtstart = start.astimezone(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    dtend   = end.astimezone(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    uid     = f"{doc.get('_id')}@sgh"

    title = f"Study Group — {slot.get('day','')} {slot.get('date','')}".strip()
    desc  = f"Time: {slot.get('day','')} {slot.get('date','')} {slot.get('from','')}–{slot.get('to','')}"
    if link: desc += f"\\nLink: {link}"

    lines = [
        "BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Study Group Hub//EN",
        "BEGIN:VEVENT",
        f"UID:{esc(uid)}",
        f"DTSTAMP:{dtstamp}",
        f"DTSTART:{dtstart}",
        f"DTEND:{dtend}",
        f"SUMMARY:{esc(title)}",
        f"DESCRIPTION:{esc(desc)}",
        f"URL:{esc(link)}",
        "END:VEVENT","END:VCALENDAR"
    ]
    return "\r\n".join(lines) + "\r\n"


@meetings_bp.get("/<mid>/ics")
@jwt_required()
def one_meeting_ics(mid: str):
    db = get_db()
    uid = str(get_jwt_identity())
    uid_oid = _as_oid(uid)

    m_id = _as_oid(mid)
    if not m_id:
        return jsonify({"ok": False, "error": "invalid meeting id"}), 400

    # must belong to current user
    or_match = [{"senderId": uid}, {"receiverId": uid}]
    if uid_oid: or_match += [{"senderId_oid": uid_oid}, {"receiverId_oid": uid_oid}]

    doc = db.meetings.find_one({"_id": m_id, "$or": or_match})
    if not doc:
        return jsonify({"ok": False, "error": "not found"}), 404

    ics = _ics_for_meeting(doc)
    if not ics:
        return jsonify({"ok": False, "error": "cannot export"}), 400

    return Response(
        ics,
        headers={
            "Content-Type": "text/calendar; charset=utf-8",
            "Content-Disposition": 'attachment; filename="meeting.ics"',
            "Access-Control-Allow-Origin": os.getenv("CLIENT_ORIGIN", "http://localhost:5173"),
        }
    )

