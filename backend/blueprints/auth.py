# backend/blueprints/auth.py
from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import timedelta, datetime
from pymongo.errors import DuplicateKeyError, PyMongoError

from db import get_db, db_for_email, ensure_user_indexes
from helpers import university_from_email

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")

# Strong password: 8+ chars, 1 upper, 1 lower, 1 number, 1 special
import re
STRONG_PASS_RE = re.compile(
    r"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$"
)

def ensure_indexes(db):
    """Idempotent index creation (kept for local use)."""
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

        try:
            yearOfStudy = int(data.get("yearOfStudy") or 1)
        except (ValueError, TypeError):
            yearOfStudy = 1

        studyMode = (data.get("studyMode") or "Problem-Solving").strip()
        meetingMode = (data.get("meetingMode") or "Either").strip()

        currentSemester = (data.get("currentSemester") or "").strip()
        if not currentSemester:
            term = (data.get("semesterTerm") or "").strip()
            year = str(data.get("semesterYear") or "").strip()
            if term and year:
                currentSemester = f"{term} {year}"

        # ---- Validation ----
        if not fullName:
            return jsonify({"ok": False, "error": "Full name is required"}), 400

        # Derive (and validate) university -> tenant/db
        try:
            domain, tenant, _db_name = university_from_email(email)
        except ValueError as ve:
            return jsonify({"ok": False, "error": str(ve)}), 400

        if not STRONG_PASS_RE.match(password):
            return jsonify({
                "ok": False,
                "error": "Password must be 8+ chars and include uppercase, lowercase, number, and special character"
            }), 400
        if not timezone:
            return jsonify({"ok": False, "error": "Timezone is required"}), 400
        if not department:
            return jsonify({"ok": False, "error": "Department is required"}), 400
        if not currentSemester:
            return jsonify({"ok": False, "error": "Current semester is required"}), 400

        # ---- Use tenant-specific DB ----
        db = db_for_email(email)
        ensure_indexes(db)
        ensure_user_indexes(db)   # keep your global helper too

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

            "domain": domain,
            "tenant": tenant,

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

        # token with tenant claim
        token = create_access_token(
            identity=str(doc["_id"]),
            expires_delta=timedelta(days=7),
            additional_claims={"tenant": tenant, "email": email}
        )

        return jsonify({
            "ok": True,
            "message": "Signup successful",
            "token": token,
            "user": {
                "id": str(doc["_id"]),
                "name": fullName,
                "email": email,
                "tenant": tenant,
                "department": department,
                "program": program,
                "studyMode": studyMode,
                "meetingMode": meetingMode,
            }
        }), 201

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

        # pick tenant DB via email domain
        try:
            domain, tenant, _db_name = university_from_email(email)
        except ValueError:
            return jsonify({"ok": False, "error": "Use your university email"}), 400

        db = db_for_email(email)
        user = db.users.find_one({"email": email})

        if not user or not check_password_hash(user.get("password_hash", ""), password):
            return jsonify({"ok": False, "error": "Invalid credentials"}), 401

        db.users.update_one({"_id": user["_id"]}, {"$set": {"lastLoginAt": datetime.utcnow()}})

        token = create_access_token(
            identity=str(user["_id"]),
            expires_delta=timedelta(days=7),
            additional_claims={"tenant": tenant, "email": email}
        )

        ui_name = user.get("fullName") or user.get("name") or ""
        return jsonify({
            "ok": True,
            "token": token,
            "user": {
                "id": str(user["_id"]),
                "name": ui_name,
                "email": user["email"],
                "tenant": tenant,
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
