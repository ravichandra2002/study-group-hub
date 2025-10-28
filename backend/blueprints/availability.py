
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from bson import ObjectId
from db import get_db
from datetime import datetime, date as D

availability_bp = Blueprint("availability_bp", __name__, url_prefix="/api/availability")


def _as_oid(v):
    try:
        return ObjectId(v)
    except Exception:
        return None

def _weekday_from_yyyy_mm_dd(s: str) -> str | None:
    try:
        y, m, d = [int(x) for x in s.split("-")]
        return D(y, m, d).strftime("%A")  # e.g., "Monday"
    except Exception:
        return None

def _ensure_indexes(db):
    if "availabilities" not in db.list_collection_names():
        db.create_collection("availabilities")
    db.availabilities.create_index([("userId", 1)], background=True)
    db.availabilities.create_index([("userId_oid", 1)], background=True)
    db.availabilities.create_index([("createdAt", -1)], background=True)

def _validate_slot(payload):
    """
    Requires: date (YYYY-MM-DD), from (HH:MM), to (HH:MM)
    'day' is optional and will be auto-detected from date if missing.
    """
    date_str = (payload.get("date") or "").strip()         
    start    = (payload.get("from") or "").strip()          
    end      = (payload.get("to") or "").strip()           
    day_in   = (payload.get("day") or "").strip()           

    if not date_str or not start or not end:
        return None, "Missing 'date', 'from', or 'to'."


    weekday = _weekday_from_yyyy_mm_dd(date_str) or day_in
    if not weekday:
        return None, "Invalid date format. Use YYYY-MM-DD."

    if len(start) < 4 or len(end) < 4 or ":" not in start or ":" not in end:
        return None, "Invalid time format. Use HH:MM (24h)."

    slot = {
        "day":  weekday,     
        "date": date_str,    
        "from": start,       
        "to":   end,        
    }
    return slot, None


@availability_bp.post("/add")
@jwt_required()
def add_availability():
    db = get_db()
    _ensure_indexes(db)

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

    ins = db.availabilities.insert_one(doc)
    saved = db.availabilities.find_one({"_id": ins.inserted_id})

    out = {
        "_id": str(saved["_id"]),
        "day": saved["slot"]["day"],
        "date": saved["slot"]["date"],
        "from": saved["slot"]["from"],
        "to": saved["slot"]["to"],
        "createdAt": saved["createdAt"].isoformat() + "Z",
    }
    return jsonify({"ok": True, "slot": out}), 201


@availability_bp.get("/list")
@jwt_required()
def list_availability():
    db = get_db()
    _ensure_indexes(db)

    uid_raw = get_jwt_identity()
    query = {"$or": [{"userId": str(uid_raw)}]}
    oid = _as_oid(uid_raw)
    if oid:
        query["$or"].append({"userId_oid": oid})

    cur = db.availabilities.find(query).sort("createdAt", -1)
    items = [{
        "_id": str(d["_id"]),
        "day":  d["slot"].get("day"),
        "date": d["slot"].get("date"),  
        "from": d["slot"].get("from"),
        "to":   d["slot"].get("to"),
        "createdAt": d.get("createdAt").isoformat() + "Z" if d.get("createdAt") else None,
    } for d in cur]
    return jsonify(items), 200



@availability_bp.get("/of/<user_id>")
@jwt_required()
def list_availability_of_user(user_id):
    db = get_db()
    _ensure_indexes(db)

    oid = _as_oid(user_id)
    query = {"$or": [{"userId": str(user_id)}]}
    if oid:
        query["$or"].append({"userId_oid": oid})

    cur = db.availabilities.find(query).sort("createdAt", -1)
    items = [{
        "_id": str(d["_id"]),
        "day":  d["slot"].get("day"),
        "date": d["slot"].get("date"),  
        "from": d["slot"].get("from"),
        "to":   d["slot"].get("to"),
        "createdAt": d.get("createdAt").isoformat() + "Z" if d.get("createdAt") else None,
    } for d in cur]
    return jsonify(items), 200
