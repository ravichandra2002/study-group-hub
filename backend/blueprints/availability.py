# from flask import Blueprint, jsonify, request
# from flask_jwt_extended import jwt_required, get_jwt_identity
# from bson import ObjectId
# from db import get_db
# from datetime import datetime

# availability_bp = Blueprint("availability_bp", __name__, url_prefix="/api/availability")


# def _as_oid(v):
#     """Return ObjectId(v) if possible, else None."""
#     try:
#         return ObjectId(v)
#     except Exception:
#         return None


# def _user_id_variants(uid_raw):
#     """
#     Build a list of possible userId match values so we can query by either
#     string or ObjectId depending on how earlier data was stored.
#     """
#     oid = _as_oid(uid_raw)
#     vals = []
#     if oid:
#         vals.append(oid)
#     # also store / query by raw string to be resilient
#     vals.append(str(uid_raw))
#     return vals


# def _validate_slot(payload):
#     day = (payload.get("day") or "").strip()
#     start = (payload.get("from") or "").strip()
#     end = (payload.get("to") or "").strip()
#     if not day or not start or not end:
#         return None, "Missing 'day', 'from', or 'to'."
#     # very light sanity: HH:MM (24h or 12h ok, we store raw)
#     if len(start) < 4 or len(end) < 4:
#         return None, "Invalid time format."
#     return {"day": day, "from": start, "to": end}, None


# @availability_bp.post("/add")
# @jwt_required()
# def add_availability():
#     db = get_db()
#     uid_raw = get_jwt_identity()
#     data = request.get_json() or {}

#     slot, err = _validate_slot(data)
#     if err:
#         return jsonify({"ok": False, "error": err}), 400

#     # store userId as string by default; if the uid can be an ObjectId, also keep it as such
#     # to be consistent we’ll store *string* and make sure indexes support both
#     doc = {
#         "userId": str(uid_raw),
#         "slot": slot,  # nest the slot to be future-proof
#         "createdAt": datetime.utcnow(),
#     }

#     # optional dual-write with ObjectId for future lookups (does not replace string)
#     oid = _as_oid(uid_raw)
#     if oid:
#         doc["userId_oid"] = oid  # allows indexed lookups by ObjectId too

#     # ensure collection + indexes (idempotent)
#     if "availabilities" not in db.list_collection_names():
#         db.create_collection("availabilities")
#     db.availabilities.create_index([("userId", 1)], background=True)
#     db.availabilities.create_index([("userId_oid", 1)], background=True)
#     db.availabilities.create_index([("createdAt", 1)], background=True)

#     ins = db.availabilities.insert_one(doc)
#     saved = db.availabilities.find_one({"_id": ins.inserted_id})

#     # shape for client
#     out = {
#         "_id": str(saved["_id"]),
#         "day": saved["slot"]["day"],
#         "from": saved["slot"]["from"],
#         "to": saved["slot"]["to"],
#         "createdAt": saved["createdAt"].isoformat() + "Z",
#     }
#     return jsonify({"ok": True, "slot": out}), 201


# @availability_bp.get("/list")
# @jwt_required()
# def list_availability():
#     db = get_db()
#     uid_raw = get_jwt_identity()

#     keys = _user_id_variants(uid_raw)
#     query = {"$or": [{"userId": str(uid_raw)}]}
#     if len(keys) > 1 and isinstance(keys[0], ObjectId):
#         query["$or"].append({"userId_oid": keys[0]})

#     cur = db.availabilities.find(query).sort("createdAt", -1)
#     items = []
#     for d in cur:
#         items.append({
#             "_id": str(d["_id"]),
#             "day": d["slot"]["day"],
#             "from": d["slot"]["from"],
#             "to": d["slot"]["to"],
#             "createdAt": d["createdAt"].isoformat() + "Z",
#         })
#     return jsonify(items), 200

# backend/blueprints/availability.py
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from bson import ObjectId
from db import get_db
from datetime import datetime

availability_bp = Blueprint("availability_bp", __name__, url_prefix="/api/availability")


def _as_oid(v):
    try:
        return ObjectId(v)
    except Exception:
        return None


def _user_id_variants(uid_raw):
    oid = _as_oid(uid_raw)
    vals = []
    if oid:
        vals.append(oid)
    vals.append(str(uid_raw))
    return vals


def _validate_slot(payload):
    day = (payload.get("day") or "").strip()
    start = (payload.get("from") or "").strip()
    end = (payload.get("to") or "").strip()
    if not day or not start or not end:
        return None, "Missing 'day', 'from', or 'to'."
    if len(start) < 4 or len(end) < 4:
        return None, "Invalid time format."
    return {"day": day, "from": start, "to": end}, None


@availability_bp.post("/add")
@jwt_required()
def add_availability():
    db = get_db()
    uid_raw = get_jwt_identity()
    data = request.get_json() or {}

    slot, err = _validate_slot(data)
    if err:
        return jsonify({"ok": False, "error": err}), 400

    doc = {
        "userId": str(uid_raw),
        "slot": slot,
        "createdAt": datetime.utcnow(),
    }
    oid = _as_oid(uid_raw)
    if oid:
        doc["userId_oid"] = oid

    if "availabilities" not in db.list_collection_names():
        db.create_collection("availabilities")
    db.availabilities.create_index([("userId", 1)], background=True)
    db.availabilities.create_index([("userId_oid", 1)], background=True)
    db.availabilities.create_index([("createdAt", 1)], background=True)

    ins = db.availabilities.insert_one(doc)
    saved = db.availabilities.find_one({"_id": ins.inserted_id})

    out = {
        "_id": str(saved["_id"]),
        "day": saved["slot"]["day"],
        "from": saved["slot"]["from"],
        "to": saved["slot"]["to"],
        "createdAt": saved["createdAt"].isoformat() + "Z",
    }
    return jsonify({"ok": True, "slot": out}), 201


@availability_bp.get("/list")
@jwt_required()
def list_availability():
    db = get_db()
    uid_raw = get_jwt_identity()

    query = {"$or": [{"userId": str(uid_raw)}]}
    oid = _as_oid(uid_raw)
    if oid:
        query["$or"].append({"userId_oid": oid})

    cur = db.availabilities.find(query).sort("createdAt", -1)
    items = [{
        "_id": str(d["_id"]),
        "day": d["slot"]["day"],
        "from": d["slot"]["from"],
        "to": d["slot"]["to"],
        "createdAt": d["createdAt"].isoformat() + "Z",
    } for d in cur]
    return jsonify(items), 200


# NEW: read another user's availability by id (used by the modal)
@availability_bp.get("/of/<user_id>")
@jwt_required()
def list_availability_of_user(user_id):
    db = get_db()
    oid = _as_oid(user_id)

    query = {"$or": [{"userId": str(user_id)}]}
    if oid:
        query["$or"].append({"userId_oid": oid})

    cur = db.availabilities.find(query).sort("createdAt", -1)
    items = [{
        "_id": str(d["_id"]),
        "day": d["slot"]["day"],
        "from": d["slot"]["from"],
        "to": d["slot"]["to"],
        "createdAt": d["createdAt"].isoformat() + "Z",
    } for d in cur]
    return jsonify(items), 200
