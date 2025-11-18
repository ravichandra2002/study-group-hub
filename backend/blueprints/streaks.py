# backend/blueprints/streaks.py
from __future__ import annotations

from datetime import datetime
from typing import Dict, Any, List

from bson import ObjectId
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from db import get_db
from helpers import current_user

streaks_bp = Blueprint("streaks", __name__, url_prefix="/api")

# XP weights per activity type
XP_BY_KIND: Dict[str, int] = {
    "chat_message": 2,
    "discussion_post": 3,
    "resource_upload": 5,
    "meeting": 8,
    "other": 1,
}


def _today_utc_date():
    return datetime.utcnow().date()


def _init_gamification() -> Dict[str, Any]:
    return {
        "xp": 0,
        "level": 1,
        "currentStreak": 0,
        "longestStreak": 0,
        "lastActiveDate": None,  # "YYYY-MM-DD"
        "totalActions": 0,
        "groupXp": {},  # { "groupId": int }
    }


def _update_streak(stats: Dict[str, Any]) -> None:
    """Update currentStreak / longestStreak based on lastActiveDate vs today."""
    today = _today_utc_date()

    last = stats.get("lastActiveDate")
    if last:
        try:
            last_dt = datetime.strptime(last, "%Y-%m-%d").date()
        except Exception:
            last_dt = None
    else:
        last_dt = None

    if not last_dt:
        # first activity ever
        stats["currentStreak"] = 1
    else:
        delta = (today - last_dt).days
        if delta == 0:
            # same day, streak unchanged
            pass
        elif delta == 1:
            # consecutive day, streak++
            stats["currentStreak"] = int(stats.get("currentStreak") or 0) + 1
        else:
            # break in streak
            stats["currentStreak"] = 1

    stats["lastActiveDate"] = today.isoformat()
    stats["longestStreak"] = max(
        int(stats.get("longestStreak") or 0),
        int(stats.get("currentStreak") or 0),
    )


def _award_xp(stats: Dict[str, Any], kind: str, group_id: str | None) -> None:
    xp_award = XP_BY_KIND.get(kind, XP_BY_KIND["other"])
    stats["xp"] = int(stats.get("xp") or 0) + xp_award
    stats["totalActions"] = int(stats.get("totalActions") or 0) + 1

    # simple level system: each 100 XP = +1 level
    stats["level"] = max(1, 1 + stats["xp"] // 100)

    if group_id:
        group_xp = stats.get("groupXp") or {}
        group_xp[group_id] = int(group_xp.get(group_id) or 0) + xp_award
        stats["groupXp"] = group_xp


@streaks_bp.post("/activity/ping")
@jwt_required()
def activity_ping():
    """
    Body: { "kind": "...", "groupId": "<optional>" }

    Called by frontend whenever the user does something 'study-related'.
    Updates XP, streak & group XP data.
    """
    db = get_db()
    user = current_user(db)
    if not user:
        return jsonify({"ok": False, "error": "user not found"}), 404

    data = request.get_json(silent=True) or {}
    kind = (data.get("kind") or "other").strip()
    group_id = data.get("groupId")
    if group_id:
        group_id = str(group_id)

    stats = user.get("gamification") or _init_gamification()

    _update_streak(stats)
    _award_xp(stats, kind, group_id)

    db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"gamification": stats}},
    )

    return jsonify({"ok": True, "gamification": stats}), 200


@streaks_bp.get("/streaks/me")
@jwt_required()
def streaks_me():
    """Return the current user's streak + XP stats."""
    db = get_db()
    user = current_user(db)
    if not user:
        return jsonify({"ok": False, "error": "user not found"}), 404

    stats = user.get("gamification") or _init_gamification()
    return jsonify(
        {
            "ok": True,
            "userId": str(user["_id"]),
            "name": user.get("fullName") or user.get("name") or user.get("email"),
            "email": user.get("email"),
            "gamification": stats,
        }
    ), 200


@streaks_bp.get("/groups/<gid>/streaks")
@jwt_required()
def group_streaks(gid):
    """
    Leaderboard for a group.
    Returns top members by XP (and streak as tiebreaker).
    """
    db = get_db()

    try:
        gid_obj = ObjectId(str(gid))
    except Exception:
        return jsonify({"ok": False, "error": "invalid group id"}), 400

    group = db.study_groups.find_one(
        {"_id": gid_obj},
        {"ownerId": 1, "members._id": 1, "memberIds": 1},
    )
    if not group:
        return jsonify({"ok": False, "error": "group not found"}), 404

    member_ids: List[ObjectId] = []

    owner_id = group.get("ownerId")
    if owner_id:
        member_ids.append(owner_id)

    for m in group.get("members") or []:
        mid = m.get("_id")
        if isinstance(mid, ObjectId):
            member_ids.append(mid)

    for mid in group.get("memberIds") or []:
        try:
            member_ids.append(ObjectId(str(mid)))
        except Exception:
            continue

    seen = set()
    uniq_ids: List[ObjectId] = []
    for mid in member_ids:
        s = str(mid)
        if s in seen:
            continue
        seen.add(s)
        uniq_ids.append(mid)

    if not uniq_ids:
        return jsonify({"ok": True, "rows": []}), 200

    cursor = db.users.find(
        {"_id": {"$in": uniq_ids}},
        {"fullName": 1, "name": 1, "email": 1, "gamification": 1},
    )

    rows = []
    for u in cursor:
        stats = u.get("gamification") or _init_gamification()
        rows.append(
            {
                "id": str(u["_id"]),
                "name": u.get("fullName") or u.get("name") or u.get("email"),
                "email": u.get("email"),
                "xp": int(stats.get("xp") or 0),
                "level": int(stats.get("level") or 1),
                "currentStreak": int(stats.get("currentStreak") or 0),
                "longestStreak": int(stats.get("longestStreak") or 0),
                "lastActiveDate": stats.get("lastActiveDate"),
            }
        )

    rows.sort(
        key=lambda r: (-r["xp"], -r["currentStreak"], (r["name"] or "").lower())
    )

    return jsonify({"ok": True, "rows": rows}), 200
