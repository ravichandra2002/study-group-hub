# from flask import Blueprint, request, jsonify
# from flask_jwt_extended import create_access_token
# from werkzeug.security import generate_password_hash, check_password_hash
# from datetime import timedelta, datetime
# from db import get_db
# import re
# from pymongo.errors import DuplicateKeyError, PyMongoError

# auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")

# # Only allow @kent.edu emails
# KENT_EMAIL_RE = re.compile(r"^[^@\s]+@kent\.edu$", re.IGNORECASE)

# def ensure_indexes(db):
#     # idempotent: safe to call multiple times
#     db.users.create_index("email", unique=True)
#     db.users.create_index([("courses.courseCode", 1)])

# @auth_bp.post("/signup")
# def signup():
#     try:
#         data = (request.get_json() or {})

#         # Required MVP fields
#         required = [
#             "fullName", "email", "password", "timezone",
#             "department", "program", "yearOfStudy", "currentSemester",
#             "courses", "studyMode", "meetingMode"
#         ]
#         if not all(k in data and data[k] not in (None, "", []) for k in required):
#             return jsonify({"ok": False, "error": "Missing required fields"}), 400

#         email = (data.get("email") or "").strip().lower()
#         if not KENT_EMAIL_RE.match(email):
#             return jsonify({"ok": False, "error": "Use your @kent.edu email"}), 400

#         password = data.get("password") or ""
#         if len(password) < 6:
#             return jsonify({"ok": False, "error": "Password must be at least 6 characters"}), 400

#         # Courses validation (at least 1, each with code & title)
#         courses = data.get("courses") or []
#         if not isinstance(courses, list) or len(courses) == 0:
#             return jsonify({"ok": False, "error": "Add at least one course"}), 400
#         for c in courses:
#             if not c.get("courseCode") or not c.get("courseTitle"):
#                 return jsonify({"ok": False, "error": "Course needs code and title"}), 400

#         db = get_db()
#         ensure_indexes(db)

#         doc = {
#             "fullName": (data.get("fullName") or "").strip(),
#             "email": email,
#             "password_hash": generate_password_hash(password),

#             "timezone": data["timezone"],
#             "department": (data.get("department") or "").strip(),
#             "program": data.get("program"),
#             "yearOfStudy": int(data.get("yearOfStudy")),
#             "currentSemester": (data.get("currentSemester") or "").strip(),

#             "courses": [
#                 {
#                     "courseCode": c["courseCode"].strip(),
#                     "courseTitle": c["courseTitle"].strip()
#                 } for c in courses
#             ],

#             "studyMode": data.get("studyMode"),
#             "meetingMode": data.get("meetingMode"),

#             # Defaults for later features
#             "availability": data.get("availability") or {
#                 "mon": [], "tue": [], "wed": [], "thu": [], "fri": [], "sat": [], "sun": []
#             },
#             "notifyEmail": True,
#             "notifyRemindersHours": 1,
#             "allowDMs": True,
#             "visibility": "SameCourseOnly",

#             "createdAt": datetime.utcnow(),
#             "lastLoginAt": None,
#         }

#         try:
#             db.users.insert_one(doc)
#         except DuplicateKeyError:
#             return jsonify({"ok": False, "error": "Email already registered"}), 409

#         return jsonify({"ok": True, "message": "Signup successful"}), 201

#     except PyMongoError as e:
#         return jsonify({"ok": False, "error": f"Database error: {str(e)}"}), 500
#     except Exception as e:
#         return jsonify({"ok": False, "error": str(e)}), 500

# @auth_bp.post("/login")
# def login():
#     try:
#         data = (request.get_json() or {})
#         email = (data.get("email") or "").strip().lower()
#         password = data.get("password") or ""

#         if not email or not password:
#             return jsonify({"ok": False, "error": "Missing email or password"}), 400

#         db = get_db()
#         user = db.users.find_one({"email": email})

#         if not user or not check_password_hash(user.get("password_hash", ""), password):
#             return jsonify({"ok": False, "error": "Invalid credentials"}), 401

#         # Optional: mark last login
#         db.users.update_one({"_id": user["_id"]}, {"$set": {"lastLoginAt": datetime.utcnow()}})

#         token = create_access_token(identity=str(user["_id"]), expires_delta=timedelta(days=7))

#         # Keep compatibility with frontend expecting "name"
#         ui_name = user.get("fullName") or user.get("name") or ""
#         return jsonify({
#             "ok": True,
#             "token": token,
#             "user": {"name": ui_name, "email": user["email"]}
#         }), 200

#     except PyMongoError as e:
#         return jsonify({"ok": False, "error": f"Database error: {str(e)}"}), 500
#     except Exception as e:
#         return jsonify({"ok": False, "error": str(e)}), 500


# backend/blueprints/auth.py
from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import timedelta, datetime
from db import get_db
from pymongo.errors import DuplicateKeyError, PyMongoError
import re

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")

# Only allow @kent.edu emails
KENT_EMAIL_RE = re.compile(r"^[^@\s]+@kent\.edu$", re.IGNORECASE)

def ensure_indexes(db):
    """Idempotent index creation."""
    db.users.create_index("email", unique=True)

@auth_bp.post("/signup")
def signup():
    try:
        data = (request.get_json() or {})

        # ---- Extract & normalize fields ----
        fullName = (data.get("fullName") or "").strip()
        email = (data.get("email") or "").strip().lower()
        password = data.get("password") or ""

        timezone = (data.get("timezone") or "").strip()
        department = (data.get("department") or "").strip()
        program = (data.get("program") or "Masters").strip()

        # Convert yearOfStudy to int safely
        try:
            yearOfStudy = int(data.get("yearOfStudy") or 1)
        except (ValueError, TypeError):
            yearOfStudy = 1

        studyMode = (data.get("studyMode") or "Problem-Solving").strip()
        meetingMode = (data.get("meetingMode") or "Either").strip()

        # Accept either combined "currentSemester" or split "semesterTerm"/"semesterYear"
        currentSemester = (data.get("currentSemester") or "").strip()
        if not currentSemester:
            term = (data.get("semesterTerm") or "").strip()
            year = str(data.get("semesterYear") or "").strip()
            if term and year:
                currentSemester = f"{term} {year}"

        # ---- Validation ----
        if not fullName:
            return jsonify({"ok": False, "error": "Full name is required"}), 400
        if not KENT_EMAIL_RE.match(email):
            return jsonify({"ok": False, "error": "Use your @kent.edu email"}), 400
        if len(password) < 6:
            return jsonify({"ok": False, "error": "Password must be at least 6 characters"}), 400
        if not timezone:
            return jsonify({"ok": False, "error": "Timezone is required"}), 400
        if not department:
            return jsonify({"ok": False, "error": "Department is required"}), 400
        if not currentSemester:
            return jsonify({"ok": False, "error": "Current semester is required"}), 400

        db = get_db()
        ensure_indexes(db)

        doc = {
            "fullName": fullName,
            "email": email,
            "password_hash": generate_password_hash(password),

            "timezone": timezone,
            "department": department,
            "program": program,
            "yearOfStudy": yearOfStudy,
            "currentSemester": currentSemester,

            "studyMode": studyMode,
            "meetingMode": meetingMode,

            # sensible defaults for later features
            "availability": {
                "mon": [], "tue": [], "wed": [], "thu": [], "fri": [], "sat": [], "sun": []
            },
            "notifyEmail": True,
            "notifyRemindersHours": 1,
            "allowDMs": True,
            "visibility": "SameCourseOnly",

            "createdAt": datetime.utcnow(),
            "lastLoginAt": None,
        }

        try:
            db.users.insert_one(doc)
        except DuplicateKeyError:
            return jsonify({"ok": False, "error": "Email already registered"}), 409

        return jsonify({"ok": True, "message": "Signup successful"}), 201

    except PyMongoError as e:
        return jsonify({"ok": False, "error": f"Database error: {str(e)}"}), 500
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500


@auth_bp.post("/login")
def login():
    try:
        data = (request.get_json() or {})
        email = (data.get("email") or "").strip().lower()
        password = data.get("password") or ""

        if not email or not password:
            return jsonify({"ok": False, "error": "Missing email or password"}), 400

        db = get_db()
        user = db.users.find_one({"email": email})

        if not user or not check_password_hash(user.get("password_hash", ""), password):
            return jsonify({"ok": False, "error": "Invalid credentials"}), 401

        # mark last login
        db.users.update_one({"_id": user["_id"]}, {"$set": {"lastLoginAt": datetime.utcnow()}})

        token = create_access_token(identity=str(user["_id"]), expires_delta=timedelta(days=7))

        # keep compatibility with frontend expecting "name"
        ui_name = user.get("fullName") or user.get("name") or ""
        return jsonify({
            "ok": True,
            "token": token,
            "user": {
                "name": ui_name,
                "email": user["email"],
                # useful extras for the header/dashboard if you want them now
                "department": user.get("department"),
                "program": user.get("program"),
                "studyMode": user.get("studyMode"),
                "meetingMode": user.get("meetingMode"),
            }
        }), 200

    except PyMongoError as e:
        return jsonify({"ok": False, "error": f"Database error: {str(e)}"}), 500
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500
