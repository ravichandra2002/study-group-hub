
import random
import re
from datetime import timedelta, datetime

from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token
from werkzeug.security import generate_password_hash, check_password_hash
from pymongo.errors import DuplicateKeyError, PyMongoError

from db import get_db, db_for_email, ensure_user_indexes
from helpers import university_from_email
from mailer import send_email

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")

# Strong password: 8+ chars, 1 upper, 1 lower, 1 number, 1 special
STRONG_PASS_RE = re.compile(
    r"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$"
)


def ensure_indexes(db):
    """Idempotent index creation (kept for local use)."""
    db.users.create_index("email", unique=True)


def send_password_reset_email(to_email: str, code: str):
    """
    Helper that uses mailer.send_email() to send a reset-code email.
    """
    subject = "Study Group Hub – Password reset code"
    text = f"Your Study Group Hub password reset code is {code}. It expires in 10 minutes."

    html = f"""
    <html>
      <body>
        <p>Hi,</p>
        <p>We received a request to reset your Study Group Hub password.</p>
        <p style="font-size:18px;">
          Your one–time code: <strong>{code}</strong>
        </p>
        <p>This code will expire in 10 minutes.</p>
        <p>If you didn’t request this, you can safely ignore this email.</p>
      </body>
    </html>
    """

    ok, err = send_email(to_email, subject, html, text)
    return ok, err


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
            return jsonify(
                {
                    "ok": False,
                    "error": "Password must be 8+ chars and include uppercase, "
                             "lowercase, number, and special character",
                }
            ), 400
        if not timezone:
            return jsonify({"ok": False, "error": "Timezone is required"}), 400
        if not department:
            return jsonify({"ok": False, "error": "Department is required"}), 400
        if not currentSemester:
            return jsonify({"ok": False, "error": "Current semester is required"}), 400

        # ---- Use tenant-specific DB ----
        db = db_for_email(email)
        ensure_indexes(db)
        ensure_user_indexes(db)  # keep your global helper too

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
                "mon": [],
                "tue": [],
                "wed": [],
                "thu": [],
                "fri": [],
                "sat": [],
                "sun": [],
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
            additional_claims={"tenant": tenant, "email": email},
        )

        return (
            jsonify(
                {
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
                    },
                }
            ),
            201,
        )

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

        db.users.update_one(
            {"_id": user["_id"]}, {"$set": {"lastLoginAt": datetime.utcnow()}}
        )

        token = create_access_token(
            identity=str(user["_id"]),
            expires_delta=timedelta(days=7),
            additional_claims={"tenant": tenant, "email": email},
        )

        ui_name = user.get("fullName") or user.get("name") or ""
        return (
            jsonify(
                {
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
                    },
                }
            ),
            200,
        )

    except PyMongoError as e:
        return jsonify({"ok": False, "error": f"Database error: {str(e)}"}), 500
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500


# ---------- NEW: Forgot / Reset password ----------


@auth_bp.post("/forgot-password")
def forgot_password():
    """
    Step 1: User enters email → generate 6-digit code, store it, and email it.
    We always return a generic success message so we don't reveal if the email exists.
    """
    try:
        data = (request.get_json() or {})
        email = (data.get("email") or "").strip().lower()

        if not email:
            return jsonify({"ok": False, "error": "Email is required"}), 400

        # Determine DB from email; if domain is unknown, just behave like success
        try:
            db = db_for_email(email)
        except Exception:
            return (
                jsonify(
                    {
                        "ok": True,
                        "message": "If this email exists, a reset code has been sent.",
                    }
                ),
                200,
            )

        user = db.users.find_one({"email": email})
        if not user:
            return (
                jsonify(
                    {
                        "ok": True,
                        "message": "If this email exists, a reset code has been sent.",
                    }
                ),
                200,
            )

        # 6-digit numeric code, valid 10 minutes
        code = f"{random.randint(0, 999999):06d}"
        expires_at = datetime.utcnow() + timedelta(minutes=10)

        db.users.update_one(
            {"_id": user["_id"]},
            {"$set": {"resetCode": code, "resetExpiresAt": expires_at}},
        )

        ok, err = send_password_reset_email(email, code)
        if not ok:
            return jsonify({"ok": False, "error": "Could not send email"}), 500

        return (
            jsonify(
                {
                    "ok": True,
                    "message": "If this email exists, a reset code has been sent.",
                }
            ),
            200,
        )

    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500


@auth_bp.post("/reset-password")
def reset_password():
    """
    Step 2: User submits email + code + new password → verify & update hash.
    """
    try:
        data = (request.get_json() or {})
        email = (data.get("email") or "").strip().lower()
        code = (data.get("code") or "").strip()
        new_password = data.get("newPassword") or ""

        if not email or not code or not new_password:
            return (
                jsonify(
                    {"ok": False, "error": "Email, code and new password are required"}
                ),
                400,
            )

        if not STRONG_PASS_RE.match(new_password):
            return (
                jsonify(
                    {
                        "ok": False,
                        "error": "Password must be 8+ chars and include uppercase, "
                                 "lowercase, number, and special character",
                    }
                ),
                400,
            )

        try:
            db = db_for_email(email)
        except Exception:
            return jsonify({"ok": False, "error": "Invalid code or email"}), 400

        user = db.users.find_one({"email": email})
        if not user:
            return jsonify({"ok": False, "error": "Invalid code or email"}), 400

        stored_code = user.get("resetCode")
        expires_at = user.get("resetExpiresAt")

        if not stored_code or stored_code != code:
            return jsonify({"ok": False, "error": "Invalid code"}), 400

        if not expires_at or datetime.utcnow() > expires_at:
            return jsonify({"ok": False, "error": "Code has expired"}), 400

        # Update password hash & clear reset fields
        new_hash = generate_password_hash(new_password)
        db.users.update_one(
            {"_id": user["_id"]},
            {
                "$set": {"password_hash": new_hash},
                "$unset": {"resetCode": "", "resetExpiresAt": ""},
            },
        )

        return (
            jsonify(
                {
                    "ok": True,
                    "message": "Password updated. You can now log in with the new password.",
                }
            ),
            200,
        )

    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500
