from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required
from db import get_db

groups_bp = Blueprint("groups", __name__, url_prefix="/api/groups")

@groups_bp.get("/")
@jwt_required()
def list_groups():
    db = get_db()
    docs = db.study_groups.find({}, {"title":1, "course":1})
    out = []
    for d in docs:
        d["_id"] = str(d["_id"])
        out.append(d)
    return jsonify(out)
