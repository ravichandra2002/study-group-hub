from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from bson import ObjectId
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from db import get_db

discussions_bp = Blueprint("discussions", __name__, url_prefix="/api/discussions")


def _oid(x):
    try:
        return ObjectId(str(x))
    except Exception:
        return None


def _get_me():
    uid = get_jwt_identity()
    if not uid:
        return None, None, None
    db = get_db()
    user = db.users.find_one({"_id": _oid(uid)}, {"name": 1, "email": 1})
    name = (user or {}).get("name") or ""
    email = (user or {}).get("email") or ""
    return str(uid), name, email


def _thread_projection():
    return {
        "_id": 1,
        "groupId": 1,
        "title": 1,
        "body": 1,
        "createdAt": 1,
        "updatedAt": 1,
        "createdBy": 1,
        "author": 1,
        "comments": 1,  # flat storage (with parentId)
        "votesUp": 1,
        "votesDown": 1,
    }


def _ensure_indexes(db):
    """Indexes for faster lookups."""
    try:
        db.discussion_threads.create_index([("groupId", 1), ("updatedAt", -1)])
    except Exception:
        pass
    try:
        db.discussion_seen.create_index(
            [("userId", 1), ("groupId", 1)], unique=True
        )
    except Exception:
        pass


def _build_tree(flat: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Convert a flat comments list into a tree by parentId."""
    nodes: Dict[str, Dict[str, Any]] = {}
    roots: List[Dict[str, Any]] = []

    for c in flat or []:
        cid = str(c.get("id") or c.get("_id") or ObjectId())
        node = {
            "id": cid,
            "parentId": c.get("parentId"),
            "userId": c.get("userId"),
            "author": c.get("author") or {},
            "text": c.get("text") or "",
            "createdAt": c.get("createdAt"),
            "children": [],
        }
        nodes[cid] = node

    # attach children
    for node in nodes.values():
        pid = node.get("parentId")
        if pid and str(pid) in nodes:
            nodes[str(pid)]["children"].append(node)
        else:
            roots.append(node)

    # sort by time (oldest first)
    def sort_rec(arr: List[Dict[str, Any]]):
        arr.sort(key=lambda x: x.get("createdAt") or "")
        for ch in arr:
            sort_rec(ch["children"])

    sort_rec(roots)
    return roots


# -------------------------------------------------------------------
# Threads list (for /group/:gid/discussions page)
# -------------------------------------------------------------------
@discussions_bp.get("/threads")
@jwt_required()
def list_threads():
    db = get_db()
    _ensure_indexes(db)
    gid = request.args.get("group_id", "").strip()
    if not _oid(gid):
        return jsonify([]), 200

    rows = list(
        db.discussion_threads.find({"groupId": str(gid)}, _thread_projection())
        .sort([("updatedAt", -1)])
        .limit(50)
    )

    current_uid = str(get_jwt_identity() or "")
    out = []
    for r in rows:
        up = set(map(str, r.get("votesUp", []) or []))
        dn = set(map(str, r.get("votesDown", []) or []))
        score = len(up) - len(dn)
        my_vote = "up" if current_uid in up else ("down" if current_uid in dn else None)

        # normalize comments + build tree
        flat = []
        for c in r.get("comments", []) or []:
            flat.append(
                {
                    "id": str(c.get("id") or c.get("_id") or ObjectId()),
                    "parentId": str(c.get("parentId")) if c.get("parentId") else None,
                    "userId": c.get("userId"),
                    "author": c.get("author") or {},
                    "text": c.get("text") or "",
                    "createdAt": c.get("createdAt"),
                }
            )
        tree = _build_tree(flat)

        out.append(
            {
                "_id": str(r["_id"]),
                "groupId": r.get("groupId"),
                "title": r.get("title"),
                "body": r.get("body"),
                "createdAt": r.get("createdAt"),
                "updatedAt": r.get("updatedAt"),
                "createdBy": r.get("createdBy"),
                "author": r.get("author") or {},
                "commentsTree": tree,  # <-- nested
                "score": score,
                "myVote": my_vote,
            }
        )
    return jsonify(out), 200


@discussions_bp.post("/threads")
@jwt_required()
def create_thread():
    db = get_db()
    _ensure_indexes(db)

    uid, name, email = _get_me()
    data = request.get_json(silent=True) or {}
    gid = str(data.get("group_id", "")).strip()
    title = str(data.get("title", "")).strip()
    body = str(data.get("body", "")).strip()

    if not _oid(gid) or not title:
        return jsonify({"ok": False, "error": "bad_input"}), 400

    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "groupId": gid,
        "title": title,
        "body": body,
        "createdAt": now,
        "updatedAt": now,
        "createdBy": uid,
        "author": {"name": name, "email": email},
        "comments": [],  # store flat; API returns tree
        "votesUp": [],
        "votesDown": [],
    }
    ins = db.discussion_threads.insert_one(doc)
    return jsonify({"ok": True, "_id": str(ins.inserted_id)}), 200


@discussions_bp.patch("/threads/<tid>")
@jwt_required()
def update_thread(tid):
    db = get_db()
    uid, _, _ = _get_me()
    doc = db.discussion_threads.find_one({"_id": _oid(tid)})
    if not doc:
        return jsonify({"ok": False, "error": "not_found"}), 404
    if str(doc.get("createdBy")) != str(uid):
        return jsonify({"ok": False, "error": "forbidden"}), 403

    data = request.get_json(silent=True) or {}
    updates: Dict[str, Any] = {}
    if "title" in data and str(data["title"]).strip() != "":
        updates["title"] = str(data["title"]).strip()
    if "body" in data and data["body"] is not None:
        updates["body"] = str(data["body"])

    updates["updatedAt"] = datetime.now(timezone.utc).isoformat()
    db.discussion_threads.update_one({"_id": _oid(tid)}, {"$set": updates})
    return jsonify({"ok": True}), 200


@discussions_bp.delete("/threads/<tid>")
@jwt_required()
def delete_thread(tid):
    db = get_db()
    uid, _, _ = _get_me()
    doc = db.discussion_threads.find_one({"_id": _oid(tid)})
    if not doc:
        return jsonify({"ok": False, "error": "not_found"}), 404
    if str(doc.get("createdBy")) != str(uid):
        return jsonify({"ok": False, "error": "forbidden"}), 403

    db.discussion_threads.delete_one({"_id": _oid(tid)})
    return jsonify({"ok": True}), 200


@discussions_bp.post("/threads/<tid>/comments")
@jwt_required()
def add_comment(tid):
    """
    Body: { "text": "...", "parent_id": "<cid>|null" }
    If parent_id is provided, the new comment becomes a reply to that comment.
    """
    db = get_db()
    uid, name, email = _get_me()
    data = request.get_json(silent=True) or {}
    text = str(data.get("text", "")).strip()
    parent_id = data.get("parent_id")  # may be None

    if not text:
        return jsonify({"ok": False, "error": "bad_input"}), 400

    doc = db.discussion_threads.find_one({"_id": _oid(tid)}, {"comments": 1})
    if not doc:
        return jsonify({"ok": False, "error": "thread_missing"}), 404

    # validate parent exists when provided
    if parent_id:
        flat = doc.get("comments") or []
        exists = any(
            str(c.get("id") or c.get("_id")) == str(parent_id)
            for c in flat
        )
        if not exists:
            return jsonify({"ok": False, "error": "parent_missing"}), 404

    c = {
        "id": str(ObjectId()),
        "parentId": str(parent_id) if parent_id else None,
        "userId": uid,
        "author": {"name": name, "email": email},
        "text": text,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }

    db.discussion_threads.update_one(
        {"_id": _oid(tid)},
        {
            "$push": {"comments": c},
            "$set": {"updatedAt": datetime.now(timezone.utc).isoformat()},
        },
    )
    return jsonify({"ok": True, "comment": c}), 200


def _collect_descendants(flat: List[Dict[str, Any]], cid: str) -> List[str]:
    children = [str(c.get("id")) for c in flat if str(c.get("parentId")) == str(cid)]
    all_ids = [cid]
    for ch in children:
        all_ids.extend(_collect_descendants(flat, ch))
    return all_ids


@discussions_bp.delete("/threads/<tid>/comments/<cid>")
@jwt_required()
def delete_comment(tid, cid):
    """
    Removes the target comment and all its descendants (replies).
    Only the author of the target comment can perform this.
    """
    db = get_db()
    uid, _, _ = _get_me()
    doc = db.discussion_threads.find_one({"_id": _oid(tid)}, {"comments": 1})
    if not doc:
        return jsonify({"ok": False, "error": "not_found"}), 404

    flat = doc.get("comments") or []
    target = next((c for c in flat if str(c.get("id")) == str(cid)), None)
    if not target:
        return jsonify({"ok": False, "error": "comment_missing"}), 404
    if str(target.get("userId")) != str(uid):
        return jsonify({"ok": False, "error": "forbidden"}), 403

    ids = _collect_descendants(flat, str(cid))
    db.discussion_threads.update_one(
        {"_id": _oid(tid)},
        {"$pull": {"comments": {"id": {"$in": ids}}}},
    )
    return jsonify({"ok": True}), 200


@discussions_bp.post("/threads/<tid>/vote")
@jwt_required()
def vote(tid):
    """
    Body: { "vote": "up" | "down" | null }
    A user can have at most one of the two. Sending null clears vote.
    """
    db = get_db()
    uid, _, _ = _get_me()
    doc = db.discussion_threads.find_one({"_id": _oid(tid)}, {"_id": 1})
    if not doc:
        return jsonify({"ok": False, "error": "not_found"}), 404

    payload = (request.get_json(silent=True) or {})
    v = payload.get("vote", None)
    now = datetime.now(timezone.utc).isoformat()

    if v == "up":
        db.discussion_threads.update_one(
            {"_id": _oid(tid)},
            {
                "$addToSet": {"votesUp": uid},
                "$pull": {"votesDown": uid},
                "$set": {"updatedAt": now},
            },
        )
    elif v == "down":
        db.discussion_threads.update_one(
            {"_id": _oid(tid)},
            {
                "$addToSet": {"votesDown": uid},
                "$pull": {"votesUp": uid},
                "$set": {"updatedAt": now},
            },
        )
    else:
        db.discussion_threads.update_one(
            {"_id": _oid(tid)},
            {
                "$pull": {"votesUp": uid, "votesDown": uid},
                "$set": {"updatedAt": now},
            },
        )

    after = db.discussion_threads.find_one(
        {"_id": _oid(tid)},
        {"votesUp": 1, "votesDown": 1},
    )
    up = set(map(str, (after or {}).get("votesUp", []) or []))
    dn = set(map(str, (after or {}).get("votesDown", []) or []))
    score = len(up) - len(dn)
    myVote = "up" if uid in up else ("down" if uid in dn else None)
    return jsonify({"ok": True, "score": score, "myVote": myVote}), 200


# -------------------------------------------------------------------
# UNREAD replies summary (for badge on GroupDetail)
# -------------------------------------------------------------------
@discussions_bp.get("/replies/unread")
@jwt_required()
def replies_summary_for_me():
    """
    Returns per-thread counts of **unread** comments made by OTHER users
    (replies on my threads) in a given group.

    Query params:
      - group_id: required group id

    Uses collection `discussion_seen`:
      { userId, groupId, lastSeenAt }
    """
    db = get_db()
    _ensure_indexes(db)
    uid = str(get_jwt_identity() or "")
    if not uid:
        return jsonify([]), 200

    gid = (request.args.get("group_id") or "").strip()
    if not gid or not _oid(gid):
        # we always call with group_id from frontend
        return jsonify([]), 200

    # when did this user last "see" discussions in this group?
    seen_doc = db.discussion_seen.find_one({"userId": uid, "groupId": gid})
    last_seen: Optional[str] = (
        seen_doc.get("lastSeenAt") if seen_doc else None
    )

    # threads created by me in this group
    rows = list(
        db.discussion_threads.find(
            {
                "groupId": gid,
                "createdBy": {"$in": [uid, _oid(uid)]},
            },
            {
                "_id": 1,
                "groupId": 1,
                "title": 1,
                "comments": 1,
                "createdBy": 1,
            },
        )
    )

    result: List[Dict[str, Any]] = []

    for r in rows:
        thread_owner = str(r.get("createdBy") or "")
        comments = r.get("comments") or []

        count = 0
        latest: Optional[str] = None

        for c in comments:
            # only replies from OTHER people
            c_user = str(c.get("userId") or "")
            if not c_user or c_user == thread_owner:
                continue

            ca = c.get("createdAt")
            if isinstance(ca, str):
                ts = ca
            elif isinstance(ca, datetime):
                ts = ca.isoformat()
            else:
                ts = str(ca or "")

            if not ts:
                continue

            # unread = comment after last_seen (or no last_seen yet)
            if last_seen and ts <= last_seen:
                continue

            count += 1
            if latest is None or ts > latest:
                latest = ts

        if count > 0:
            result.append(
                {
                    "threadId": str(r["_id"]),
                    "groupId": r.get("groupId"),
                    "title": r.get("title") or "",
                    "replyCount": int(count),
                    "latestReplyAt": latest,
                }
            )

    return jsonify(result), 200


# -------------------------------------------------------------------
# Mark replies as seen for this user & group
# -------------------------------------------------------------------
@discussions_bp.post("/replies/mark_seen")
@jwt_required()
def mark_replies_seen():
    """
    Body: { "group_id": "<gid>" }

    Called when user clicks "Open discussions" from GroupDetail.
    Stores a lastSeenAt timestamp in `discussion_seen` so that
    /replies/unread will ignore older replies.
    """
    db = get_db()
    _ensure_indexes(db)
    uid = str(get_jwt_identity() or "")
    if not uid:
        return jsonify({"ok": False, "error": "no_user"}), 401

    data = request.get_json(silent=True) or {}
    gid = (data.get("group_id") or "").strip()
    if not gid or not _oid(gid):
        return jsonify({"ok": False, "error": "bad_input"}), 400

    now_iso = datetime.now(timezone.utc).isoformat()
    db.discussion_seen.update_one(
        {"userId": uid, "groupId": gid},
        {"$set": {"lastSeenAt": now_iso}},
        upsert=True,
    )

    return jsonify({"ok": True, "lastSeenAt": now_iso}), 200


# -------------------------------------------------------------------
# Discussion POINTS summary (for points counter on GroupDetail)
# -------------------------------------------------------------------
@discussions_bp.get("/points/summary")
@jwt_required()
def points_summary_for_me():
    """
    Returns a discussion points summary for the current user in a group.

    Query params:
      - group_id: required

    Simple scoring:
      +3 points per thread authored by the user in this group
      +1 point per comment authored by the user in this group
      +1 point per upvote on the user's threads
    """
    db = get_db()
    _ensure_indexes(db)
    uid = str(get_jwt_identity() or "")
    if not uid:
        return jsonify({"ok": False, "error": "no_user"}), 401

    gid = (request.args.get("group_id") or "").strip()
    if not gid or not _oid(gid):
        return jsonify({"ok": False, "error": "bad_input"}), 400

    rows = list(
        db.discussion_threads.find(
            {"groupId": gid},
            {
                "_id": 1,
                "groupId": 1,
                "createdBy": 1,
                "comments": 1,
                "votesUp": 1,
            },
        )
    )

    threads_authored = 0
    comments_authored = 0
    upvotes_received = 0

    for r in rows:
        owner = str(r.get("createdBy") or "")
        comments = r.get("comments") or []
        votes_up = r.get("votesUp") or []

        # threads authored by this user
        if owner == uid:
            threads_authored += 1
            # count all upvotes on this thread
            upvotes_received += len(list(votes_up))

        # comments authored by this user (in any thread in this group)
        for c in comments:
            c_user = str(c.get("userId") or "")
            if c_user == uid:
                comments_authored += 1

    total_points = 3 * threads_authored + comments_authored + upvotes_received

    return jsonify(
        {
            "ok": True,
            "groupId": gid,
            "threadsAuthored": threads_authored,
            "commentsAuthored": comments_authored,
            "upvotesReceived": upvotes_received,
            "totalPoints": int(total_points),
        }
    ), 200
