# # backend/blueprints/helpers.py
# from flask import abort
# from bson import ObjectId
# from db import get_db
# from datetime import datetime

# def oid(v): return ObjectId(str(v))

# def now(): return datetime.utcnow()

# def require_member(gid, uid):
#     db = get_db()
#     g = db.study_groups.find_one({"_id": oid(gid)}, {"members._id":1, "ownerId":1})
#     if not g: abort(404, "Group not found")
#     is_owner = str(g["ownerId"]) == str(uid)
#     is_member = any(str(m["_id"]) == str(uid) for m in g.get("members", []))
#     if not (is_owner or is_member):
#         abort(403, "Join this group to access")
#     return g

# def serialize_message(m):
#     return {
#         "_id": str(m["_id"]),
#         "gid": str(m["gid"]),
#         "userId": str(m["userId"]),
#         "name": m.get("name"),
#         "email": m.get("email"),
#         "text": m.get("text"),
#         "files": m.get("files", []),
#         "createdAt": m.get("createdAt", now()).isoformat() + "Z",
#     }

# def serialize_file(f):
#     return {
#         "_id": str(f["_id"]),
#         "gid": str(f["gid"]),
#         "userId": str(f["userId"]),
#         "name": f["name"],
#         "size": f.get("size", 0),
#         "mime": f.get("mime"),
#         "url": f["url"],
#         "createdAt": f.get("createdAt", now()).isoformat() + "Z",
#     }

# def serialize_poll(p):
#     return {
#         "_id": str(p["_id"]),
#         "gid": str(p["gid"]),
#         "question": p["question"],
#         "options": p["options"],       # [{id,text,votes}]
#         "isOpen": p.get("isOpen", True),
#         "createdBy": str(p.get("createdBy")),
#         "createdAt": p.get("createdAt", now()).isoformat() + "Z",
#     }
