# # backend/routes_me.py
# from datetime import datetime
# from flask import Blueprint, jsonify, request
# from flask_jwt_extended import jwt_required, get_jwt_identity
# from bson import ObjectId

# from db import get_db

# me_bp = Blueprint("me", __name__, url_prefix="/api/me")

# ALLOWED = {"either", "online", "oncampus"}

# def ensure_prefs_collection(db):
#     if "user_prefs" not in db.list_collection_names():
#         db.create_collection("user_prefs")
#     db.user_prefs.create_index([("userId", 1)], unique=True)

# def _oid(s):
#     try:
#         return ObjectId(str(s))
#     except Exception:
#         return None

# @me_bp.get("/prefs")
# @jwt_required()
# def get_prefs():
#     db = get_db()
#     ensure_prefs_collection(db)

#     uid = _oid(get_jwt_identity())
#     if not uid:
#         return jsonify({"ok": False, "error": "Invalid user"}), 400

#     doc = db.user_prefs.find_one({"userId": uid}) or {}
#     mode = doc.get("meetingMode") or "either"
#     return jsonify({"meetingMode": mode}), 200

# @me_bp.post("/prefs")
# @jwt_required()
# def set_prefs():
#     db = get_db()
#     ensure_prefs_collection(db)

#     uid = _oid(get_jwt_identity())
#     if not uid:
#         return jsonify({"ok": False, "error": "Invalid user"}), 400

#     body = request.get_json(silent=True) or {}
#     mode = str(body.get("meetingMode", "")).strip().lower()

#     # normalize a few synonyms
#     if mode in {"on-campus", "campus", "offline"}:
#         mode = "oncampus"
#     if mode in {"either", "any", "both", ""}:
#         mode = "either"
#     if mode not in ALLOWED:
#         return jsonify({"ok": False, "error": "Invalid meetingMode"}), 400

#     now = datetime.utcnow()
#     db.user_prefs.update_one(
#         {"userId": uid},
#         {"$set": {"meetingMode": mode, "updatedAt": now}},
#         upsert=True,
#     )
#     return jsonify({"ok": True, "meetingMode": mode}), 200

# backend/routes_me.py
from datetime import datetime
from bson import ObjectId
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.security import check_password_hash, generate_password_hash
import re

from db import get_db

me_bp = Blueprint("me", __name__, url_prefix="/api/me")

ALLOWED_MEETING_MODES = {"either", "online", "oncampus"}

# Strong password: 8+ chars, 1 upper, 1 lower, 1 number, 1 special
STRONG_PASS_RE = re.compile(
    r"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$"
)


def ensure_prefs_collection(db):
    if "user_prefs" not in db.list_collection_names():
        db.create_collection("user_prefs")
    db.user_prefs.create_index([("userId", 1)], unique=True)


def _oid(s):
    try:
        return ObjectId(str(s))
    except Exception:
        return None


def _iso(dt):
    if isinstance(dt, datetime):
        return dt.isoformat()
    return dt


# ------------------------ MEETING PREFS (existing) ------------------------


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
    if mode not in ALLOWED_MEETING_MODES:
        return jsonify({"ok": False, "error": "Invalid meetingMode"}), 400

    now = datetime.utcnow()
    db.user_prefs.update_one(
        {"userId": uid},
        {"$set": {"meetingMode": mode, "updatedAt": now}},
        upsert=True,
    )
    return jsonify({"ok": True, "meetingMode": mode}), 200


# --------------------------- PROFILE: GET / UPDATE ---------------------------


@me_bp.get("/profile")
@jwt_required()
def get_profile():
    """
    Returns the current user's profile info from the users collection.
    """
    db = get_db()
    uid = _oid(get_jwt_identity())
    if not uid:
        return jsonify({"ok": False, "error": "Invalid user"}), 400

    user = db.users.find_one(
        {"_id": uid},
        {
            "fullName": 1,
            "email": 1,
            "timezone": 1,
            "department": 1,
            "program": 1,
            "yearOfStudy": 1,
            "currentSemester": 1,
            "studyMode": 1,
            "meetingMode": 1,
            "notifyEmail": 1,
            "notifyRemindersHours": 1,
            "allowDMs": 1,
            "visibility": 1,
            "createdAt": 1,
            "lastLoginAt": 1,
        },
    )

    if not user:
        return jsonify({"ok": False, "error": "User not found"}), 404

    # build clean JSON structure
    profile = {
        "id": str(uid),
        "fullName": user.get("fullName") or "",
        "email": user.get("email") or "",
        "timezone": user.get("timezone") or "",
        "department": user.get("department") or "",
        "program": user.get("program") or "",
        "yearOfStudy": user.get("yearOfStudy") or 1,
        "currentSemester": user.get("currentSemester") or "",
        "studyMode": user.get("studyMode") or "",
        "meetingMode": user.get("meetingMode") or "",
        "notifyEmail": bool(user.get("notifyEmail", True)),
        "notifyRemindersHours": int(user.get("notifyRemindersHours", 1)),
        "allowDMs": bool(user.get("allowDMs", True)),
        "visibility": user.get("visibility") or "SameCourseOnly",
        "createdAt": _iso(user.get("createdAt")),
        "lastLoginAt": _iso(user.get("lastLoginAt")),
    }

    return jsonify({"ok": True, "profile": profile}), 200


@me_bp.patch("/profile")
@jwt_required()
def update_profile():
    """
    Update editable profile fields for the current user.
    Email / tenant are NOT changed here to keep things simple.
    """
    db = get_db()
    uid = _oid(get_jwt_identity())
    if not uid:
        return jsonify({"ok": False, "error": "Invalid user"}), 400

    body = request.get_json(silent=True) or {}

    # fields user is allowed to edit from UI
    editable_fields = [
        "fullName",
        "timezone",
        "department",
        "program",
        "yearOfStudy",
        "currentSemester",
        "studyMode",
        "meetingMode",
        "notifyEmail",
        "notifyRemindersHours",
        "allowDMs",
        "visibility",
    ]

    updates = {}

    for field in editable_fields:
        if field not in body:
            continue
        value = body[field]

        # strings: strip whitespace
        if isinstance(value, str):
            value = value.strip()

        if field == "yearOfStudy":
            try:
                value = int(value)
            except (ValueError, TypeError):
                continue  # ignore bad value

        if field == "notifyRemindersHours":
            try:
                value = int(value)
            except (ValueError, TypeError):
                continue
            # clamp between 0 and 72 hours
            value = max(0, min(value, 72))

        if field in {"notifyEmail", "allowDMs"}:
            value = bool(value)

        if field == "visibility":
            # you can extend allowed values if needed
            if value not in {"SameCourseOnly", "SameUniversity", "Private"}:
                continue

        updates[field] = value

    if not updates:
        return jsonify({"ok": False, "error": "No valid fields to update"}), 400

    updates["updatedAt"] = datetime.utcnow()

    db.users.update_one({"_id": uid}, {"$set": updates})
    return jsonify({"ok": True}), 200


# --------------------------- CHANGE PASSWORD ---------------------------


@me_bp.post("/change-password")
@jwt_required()
def change_password():
    """
    Body: {
      "currentPassword": "...",
      "newPassword": "..."
    }
    - Checks current password
    - Enforces strong password rule
    - Updates password_hash
    """
    db = get_db()
    uid = _oid(get_jwt_identity())
    if not uid:
        return jsonify({"ok": False, "error": "Invalid user"}), 400

    body = request.get_json(silent=True) or {}
    current = (body.get("currentPassword") or "").strip()
    new = (body.get("newPassword") or "").strip()

    if not current or not new:
        return jsonify({"ok": False, "error": "Both current and new password are required"}), 400

    user = db.users.find_one({"_id": uid}, {"password_hash": 1})
    if not user:
        return jsonify({"ok": False, "error": "User not found"}), 404

    if not check_password_hash(user.get("password_hash", ""), current):
        return jsonify({"ok": False, "error": "Current password is incorrect"}), 400

    if not STRONG_PASS_RE.match(new):
        return jsonify({
            "ok": False,
            "error": "Password must be 8+ chars and include uppercase, lowercase, number, and special character",
        }), 400

    new_hash = generate_password_hash(new)
    db.users.update_one({"_id": uid}, {"$set": {"password_hash": new_hash}})
    return jsonify({"ok": True, "message": "Password updated successfully"}), 200
