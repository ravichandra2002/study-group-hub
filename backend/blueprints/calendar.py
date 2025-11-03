from __future__ import annotations

import os
import secrets
from datetime import datetime, timezone
from typing import Optional

from flask import Blueprint, jsonify, request, Response, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from bson import ObjectId

from db import get_db

calendar_bp = Blueprint("calendar_bp", __name__, url_prefix="/api/calendar")


def _as_oid(v) -> Optional[ObjectId]:
    try:
        return ObjectId(v)
    except Exception:
        return None


def _abs_base_url() -> str:
    # Prefer explicit base for proxies/tunnels; fall back to request.host_url
    env_base = (os.getenv("APP_BASE_URL") or "").rstrip("/")
    if env_base:
        return env_base
    try:
        return request.host_url.rstrip("/")
    except Exception:
        return "http://localhost:5050"


def _ensure_users(db):
    if "users" not in db.list_collection_names():
        db.create_collection("users")
    # indexes are optional; harmless if dup
    try:
        db.users.create_index([("id", 1)], background=True)
        db.users.create_index([("calendarToken", 1)], background=True, unique=False)
    except Exception:
        pass


@calendar_bp.get("/token")
@jwt_required()
def get_or_create_token():
    """
    Always returns a private calendar token + full ICS feed URL for the
    current authenticated user. Creates user row if missing.
    """
    try:
        db = get_db()
        _ensure_users(db)

        uid = str(get_jwt_identity())
        uoid = _as_oid(uid)

        # Find by either ObjectId _id or string id field
        q_or = []
        if uoid:
            q_or.append({"_id": uoid})
        q_or.append({"id": uid})

        user = db.users.find_one({"$or": q_or})

        if not user:
            # Create a minimal user doc so future lookups succeed consistently
            token = secrets.token_urlsafe(24).replace("-", "").replace("_", "")
            doc = {"id": uid, "calendarToken": token, "createdAt": datetime.now(timezone.utc)}
            db.users.insert_one(doc)
            base = _abs_base_url()
            url = f"{base}/api/calendar/feed/{token}.ics"
            return jsonify({"ok": True, "token": token, "url": url}), 200

        # Ensure token exists
        token = user.get("calendarToken")
        if not token:
            token = secrets.token_urlsafe(24).replace("-", "").replace("_", "")
            # Update by _id when available; otherwise by id
            if user.get("_id"):
                db.users.update_one({"_id": user["_id"]}, {"$set": {"calendarToken": token}})
            else:
                db.users.update_one({"id": uid}, {"$set": {"calendarToken": token}}, upsert=True)

        base = _abs_base_url()
        url = f"{base}/api/calendar/feed/{token}.ics"
        return jsonify({"ok": True, "token": token, "url": url}), 200

    except Exception as e:
        # Log server-side for debugging, return structured error for client toast
        current_app.logger.exception("calendar/token failed")
        return jsonify({"ok": False, "error": f"calendar token error: {str(e)}"}), 500


@calendar_bp.get("/feed/<token>.ics")
def calendar_feed(token: str):
    """
    Public ICS feed keyed by secret token. Includes accepted FUTURE meetings
    for the user (either sender or receiver).
    """
    try:
        db = get_db()
        if "users" not in db.list_collection_names():
            return Response("Not configured", status=404)

        user = db.users.find_one({"calendarToken": token})
        if not user:
            return Response("Not found", status=404)

        uid_str = str(user.get("id") or user.get("_id"))
        uid_oid = _as_oid(uid_str)

        now = datetime.now(timezone.utc)
        or_match = [{"senderId": uid_str}, {"receiverId": uid_str}]
        if uid_oid:
            or_match += [{"senderId_oid": uid_oid}, {"receiverId_oid": uid_oid}]

        cur = db.meetings.find({
            "$and": [
                {"$or": or_match},
                {"status": "accepted"},
                {"endAt": {"$gte": now}},
            ]
        }).sort("startAt", 1)

        def esc(s: str) -> str:
            return (s or "").replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace("\n", "\\n")

        lines = [
            "BEGIN:VCALENDAR",
            "VERSION:2.0",
            "PRODID:-//Study Group Hub//EN",
            "CALSCALE:GREGORIAN",
            "METHOD:PUBLISH",
            "X-WR-CALNAME:Study Group Hub",
        ]

        base = _abs_base_url()

        for d in cur:
            start = d.get("startAt")
            end = d.get("endAt")
            if not isinstance(start, datetime) or not isinstance(end, datetime):
                continue

            slot = d.get("slot") or {}
            link = d.get("meetingLink") or f"{base}/meetings"
            uid = f"{d.get('_id')}@sgh"

            dtstamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
            dtstart = start.astimezone(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
            dtend = end.astimezone(timezone.utc).strftime("%Y%m%dT%H%M%SZ")

            title = f"Study Group — {slot.get('day','')} {slot.get('date','')}".strip()
            desc = f"Time: {slot.get('day','')} {slot.get('date','')} {slot.get('from','')}–{slot.get('to','')}"
            desc += f"\\nLink: {link}"

            lines += [
                "BEGIN:VEVENT",
                f"UID:{esc(uid)}",
                f"DTSTAMP:{dtstamp}",
                f"DTSTART:{dtstart}",
                f"DTEND:{dtend}",
                f"SUMMARY:{esc(title)}",
                f"DESCRIPTION:{esc(desc)}",
                f"URL:{esc(link)}",
                "END:VEVENT",
            ]

        lines.append("END:VCALENDAR")
        body = "\r\n".join(lines) + "\r\n"
        return Response(body, status=200, headers={
            "Content-Type": "text/calendar; charset=utf-8",
            "Content-Disposition": 'attachment; filename="study-group-hub.ics"',
            "Access-Control-Allow-Origin": os.getenv("CLIENT_ORIGIN", "http://localhost:5173"),
        })
    except Exception as e:
        current_app.logger.exception("calendar/feed failed")
        return Response(f"ICS error: {e}", status=500, headers={
            "Access-Control-Allow-Origin": os.getenv("CLIENT_ORIGIN", "http://localhost:5173"),
        })
