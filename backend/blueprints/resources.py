# backend/blueprints/resources.py
from __future__ import annotations

import os
import mimetypes
from datetime import datetime
from typing import Any, Iterable, Dict, Tuple, Set

from flask import Blueprint, jsonify, request, current_app, send_file
from flask_jwt_extended import jwt_required, get_jwt_identity
from bson import ObjectId

from db import get_db

resources_bp = Blueprint("resources_bp", __name__, url_prefix="/api/resources")


# ----------------------------- small helpers ---------------------------------
def _as_oid(v: Any):
    try:
        return ObjectId(str(v))
    except Exception:
        return None


def _stringy(v: Any) -> str | None:
    if v is None:
        return None
    s = str(v).strip()
    return s or None


def _collect_ids(members: Any) -> Tuple[Set[str], Set[ObjectId]]:
    sset: Set[str] = set()
    oset: Set[ObjectId] = set()
    if not isinstance(members, Iterable):
        return sset, oset

    for m in members:
        if isinstance(m, (str, int)):
            sid = _stringy(m)
            if sid:
                sset.add(sid)
            oid = _as_oid(m)
            if oid:
                oset.add(oid)
        elif isinstance(m, ObjectId):
            oset.add(m)
            sset.add(str(m))
        elif isinstance(m, dict):
            mid = m.get("_id") or m.get("id") or m.get("userId")
            if mid is not None:
                sid = _stringy(mid)
                if sid:
                    sset.add(sid)
                oid = _as_oid(mid)
                if oid:
                    oset.add(oid)

    return sset, oset


def _user_name_email_from_doc(u: dict) -> Tuple[str | None, str | None]:
    if not u:
        return None, None
    name = (
        u.get("name")
        or u.get("fullName")
        or u.get("displayName")
        or (f"{u.get('firstName','').strip()} {u.get('lastName','').strip()}".strip() or None)
        or u.get("username")
    )
    email = u.get("email") or u.get("primaryEmail") or u.get("mail")
    return (name, email)


def _lookup_user_map(db, ids_str: Set[str], ids_oid: Set[ObjectId]) -> Dict[str, dict]:
    out: Dict[str, dict] = {}

    if ids_oid:
        cur = db.users.find(
            {"_id": {"$in": list(ids_oid)}},
            {
                "name": 1, "fullName": 1, "displayName": 1, "firstName": 1, "lastName": 1,
                "username": 1, "email": 1, "primaryEmail": 1, "mail": 1,
            },
        )
        for u in cur:
            out[str(u["_id"])] = u

    remaining_str = [sid for sid in ids_str if sid not in out]
    if remaining_str:
        cur2 = db.users.find(
            {"_id": {"$in": remaining_str}},
            {
                "name": 1, "fullName": 1, "displayName": 1, "firstName": 1, "lastName": 1,
                "username": 1, "email": 1, "primaryEmail": 1, "mail": 1,
            },
        )
        for u in cur2:
            out[str(u["_id"])] = u

    return out


def _current_user_name_email(db, uid: str) -> Tuple[str | None, str | None]:
    doc = None
    oid = _as_oid(uid)
    if oid:
        doc = db.users.find_one({"_id": oid})
    if not doc:
        doc = db.users.find_one({"_id": uid})
    return _user_name_email_from_doc(doc)


# ---- robust group lookup (works across collections & id types) ---------------
def _get_group(db, group_id: str):
    """Try both collections and both id representations."""
    gid_oid = _as_oid(group_id)
    id_clauses = []
    if gid_oid:
        id_clauses.append({"_id": gid_oid})
    id_clauses.append({"_id": group_id})

    for coll_name in ("groups", "study_groups"):
        try:
            g = db[coll_name].find_one({"$or": id_clauses})
            if g:
                return g
        except Exception:
            pass
    return None


def _is_member(db, group_id: str, user_id: str) -> bool:
    """Return True if user is owner or member of the group (schema-tolerant)."""
    if not group_id or not user_id:
        return False

    g = _get_group(db, group_id)
    if not g:
        return False

    uid_str = _stringy(user_id)
    uid_oid = _as_oid(user_id)

    # owners
    owner_strs = {x for x in [_stringy(g.get("ownerId")), _stringy(g.get("owner"))] if x}
    owner_oids = {o for o in [_as_oid(g.get("ownerId")), _as_oid(g.get("ownerId_oid"))] if o}

    # simple member arrays
    m_strs, m_oids = _collect_ids(g.get("members") or [])
    # optional dedicated arrays
    m_strs2, m_oids2 = set(), set()
    for key in ("members_str", "memberIds", "member_ids"):
        s, _ = _collect_ids(g.get(key) or [])
        m_strs2 |= s
    for key in ("members_oid", "memberOids"):
        _, o = _collect_ids(g.get(key) or [])
        m_oids2 |= o

    all_strs = owner_strs | m_strs | m_strs2
    all_oids = owner_oids | m_oids | m_oids2

    return (uid_str in all_strs) or (uid_oid in all_oids)


def _require_member(db, group_id: str, user_id: str):
    if not _is_member(db, group_id, user_id):
        return jsonify({"ok": False, "error": "not a member of this group"}), 403
    return None


# --------------------------------- routes ------------------------------------
@resources_bp.get("/list")
@jwt_required()
def list_resources():
    db = get_db()
    uid = str(get_jwt_identity())
    group_id = (request.args.get("group_id") or "").strip()
    if not group_id:
        return jsonify({"ok": False, "error": "group_id required"}), 400

    guard = _require_member(db, group_id, uid)
    if guard:
        return guard

    rows = list(db.resources.find({"groupId": group_id}).sort("createdAt", -1))

    # Batch backfill of uploader names/emails
    created_by_str, created_by_oid = set(), set()
    for r in rows:
        cid = r.get("createdBy")
        if cid is not None:
            s = _stringy(cid)
            if s:
                created_by_str.add(s)
            o = _as_oid(cid)
            if o:
                created_by_oid.add(o)

    user_map = _lookup_user_map(db, created_by_str, created_by_oid)

    out = []
    for r in rows:
        cid = r.get("createdBy")
        cid_key = _stringy(cid) or ""
        name = r.get("createdByName") or None
        email = r.get("createdByEmail") or None
        if (not name or not email) and cid_key in user_map:
            n2, e2 = _user_name_email_from_doc(user_map[cid_key])
            name = name or n2
            email = email or e2

        out.append({
            "_id": str(r["_id"]),
            "type": r.get("type", "file"),
            "title": r.get("title"),
            "description": r.get("description"),
            "filename": r.get("filename"),
            "url": r.get("url"),
            "size": r.get("size"),
            "createdAt": (r.get("createdAt") or datetime.utcnow()).isoformat() + "Z",
            "createdBy": _stringy(cid) or "",
            "createdByName": name,
            "createdByEmail": email,
        })
    return jsonify(out), 200


@resources_bp.post("/upload")
@jwt_required()
def upload_resource():
    db = get_db()
    uid = str(get_jwt_identity())

    group_id = (request.args.get("group_id") or request.form.get("group_id") or "").strip()
    if not group_id:
        return jsonify({"ok": False, "error": "group_id required"}), 400

    guard = _require_member(db, group_id, uid)
    if guard:
        return guard

    if "file" not in request.files:
        return jsonify({"ok": False, "error": "file missing"}), 400

    f = request.files["file"]
    if not f or f.filename == "":
        return jsonify({"ok": False, "error": "empty filename"}), 400

    title = (request.form.get("title") or "").strip()
    description = (request.form.get("description") or "").strip()

    upload_dir = current_app.config.get("UPLOAD_DIR") or os.path.join(os.path.dirname(__file__), "..", "uploads")
    os.makedirs(upload_dir, exist_ok=True)

    name_on_disk = f"{ObjectId()}.{(f.filename or 'file').split('.')[-1]}"
    dst = os.path.join(upload_dir, name_on_disk)
    f.save(dst)

    size = os.path.getsize(dst)

    uploader_name, uploader_email = _current_user_name_email(db, uid)

    doc = {
        "groupId": group_id,
        "type": "file",
        "title": title or f.filename,
        "description": description or None,
        "filename": f.filename,
        "diskName": name_on_disk,
        "size": size,
        "createdBy": uid,
        "createdByName": uploader_name,
        "createdByEmail": uploader_email,
        "createdAt": datetime.utcnow(),
    }
    ins = db.resources.insert_one(doc)
    return jsonify({"ok": True, "id": str(ins.inserted_id)}), 200


@resources_bp.post("/link")
@jwt_required()
def save_link():
    db = get_db()
    uid = str(get_jwt_identity())
    data = request.get_json() or {}
    group_id = (data.get("group_id") or "").strip()
    if not group_id:
        return jsonify({"ok": False, "error": "group_id required"}), 400

    guard = _require_member(db, group_id, uid)
    if guard:
        return guard

    url = (data.get("url") or "").strip()
    if not url:
        return jsonify({"ok": False, "error": "url required"}), 400

    uploader_name, uploader_email = _current_user_name_email(db, uid)

    doc = {
        "groupId": group_id,
        "type": "link",
        "title": (data.get("title") or "").strip() or url,
        "description": (data.get("description") or "").strip() or None,
        "url": url,
        "createdBy": uid,
        "createdByName": uploader_name,
        "createdByEmail": uploader_email,
        "createdAt": datetime.utcnow(),
    }
    ins = db.resources.insert_one(doc)
    return jsonify({"ok": True, "id": str(ins.inserted_id)}), 200


@resources_bp.get("/download/<rid>")
@jwt_required()
def download_file(rid: str):
    db = get_db()
    uid = str(get_jwt_identity())
    r = db.resources.find_one({"_id": _as_oid(rid)})
    if not r:
        return jsonify({"ok": False, "error": "not found"}), 404

    guard = _require_member(db, r.get("groupId") or "", uid)
    if guard:
        return guard

    if r.get("type") != "file":
        return jsonify({"ok": False, "error": "not a file"}), 400

    upload_dir = current_app.config.get("UPLOAD_DIR") or os.path.join(os.path.dirname(__file__), "..", "uploads")
    path = os.path.join(upload_dir, r["diskName"])
    if not os.path.exists(path):
        return jsonify({"ok": False, "error": "file missing"}), 404

    mime = mimetypes.guess_type(r.get("filename") or "")[0] or "application/octet-stream"
    return send_file(path, mimetype=mime, as_attachment=True, download_name=r.get("filename") or "file")
