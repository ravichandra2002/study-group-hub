from datetime import datetime
from bson import ObjectId
from flask_socketio import Namespace, emit, join_room, leave_room

from db import get_db, db_for_email
from helpers import university_from_email

GROUP_ONLINE = {}


def _oid(v):
    try:
        return ObjectId(v) if isinstance(v, str) else v
    except Exception:
        return None


def _id_eq(a, b) -> bool:
    return str(a) == str(b)


def _ensure_chat_indexes(db):
    if "group_messages" not in db.list_collection_names():
        db.create_collection("group_messages")
    db.group_messages.create_index([("groupId", 1), ("createdAt", 1)], background=True)


def _is_member(db, gid: ObjectId, uid: ObjectId) -> bool:
    doc = db.study_groups.find_one(
        {"_id": gid}, {"members._id": 1, "ownerId": 1, "memberIds": 1}
    )
    if not doc:
        return False
    if _id_eq(doc.get("ownerId"), uid):
        return True
    if any(_id_eq(m.get("_id"), uid) for m in (doc.get("members") or [])):
        return True
    if any(_id_eq(mid, uid) for mid in (doc.get("memberIds") or [])):
        return True
    return False


def _serialize_msg(doc):
    return {
        "id": str(doc["_id"]),
        "groupId": str(doc["groupId"]),
        "userId": str(doc["userId"]),
        "user": {
            "_id": str(doc["user"]["_id"]),
            "name": doc["user"].get("name"),
            "email": doc["user"].get("email"),
        },
        "text": doc["text"],
        "createdAt": doc["createdAt"].isoformat() + "Z",
    }


def _tenant_db_from_email_or_default(email: str):
    """
    Prefer the tenant DB resolved from a university email.
    Fallback to request-bound DB (single-tenant dev) if anything fails.
    """
    try:
        university_from_email(email)  # raises if not a university address
        return db_for_email(email)
    except Exception:
        return get_db()


class ChatNamespace(Namespace):
    # ----------------- helper: notify one user about meetings -----------------
    def emit_meeting_notification(self, receiver_id, message="New meeting request"):
        try:
            room = f"user:{str(receiver_id)}"
            payload = {
                "type": "meeting_request",
                "message": message,
                "at": datetime.utcnow().isoformat() + "Z",
            }
            emit("notify_user", payload, to=room)
            print(f"[ws] meeting_notify -> {room}: {payload}")
        except Exception as e:
            print("[ws] meeting_notify error:", e)

    # ----------------------------- lifecycle ---------------------------------
    def on_connect(self):
        print("[ws] client connected to /ws/chat")
        emit("connected", {"ok": True})

    def on_disconnect(self):
        # We don't fully clean GROUP_ONLINE here because we don't know which
        # groups this socket had joined, but we at least log it.
        print("[ws] client disconnected from /ws/chat")

    # --------------------------- user rooms ----------------------------------
    def on_join_user(self, data):
        uid = (data or {}).get("userId")
        if not uid:
            return {"ok": False, "error": "missing userId"}
        room = f"user:{str(uid)}"
        join_room(room)
        print(f"[ws] joined user room {room}")
        emit("system", {"msg": f"joined {room}"})
        return {"ok": True, "room": room}

    def on_leave_user(self, data):
        uid = (data or {}).get("userId")
        if not uid:
            return {"ok": False, "error": "missing userId"}
        room = f"user:{str(uid)}"
        leave_room(room)
        print(f"[ws] left user room {room}")
        emit("system", {"msg": f"left {room}"})
        return {"ok": True, "room": room}

    # --------------------------- group rooms ---------------------------------
    def on_join_group(self, data):
        gid = (data or {}).get("groupId")
        if not gid:
            return {"ok": False, "error": "missing groupId"}
        room = f"group:{str(gid)}"
        join_room(room)
        print(f"[ws] joined group room {room}")
        emit("system", {"msg": f"joined {room}"})
        return {"ok": True, "room": room}

    def on_leave_group(self, data):
        gid = (data or {}).get("groupId")
        if not gid:
            return {"ok": False, "error": "missing groupId"}
        room = f"group:{str(gid)}"
        leave_room(room)
        print(f"[ws] left group room {room}")
        emit("system", {"msg": f"left {room}"})
        return {"ok": True, "room": room}

    # ----------------------- REAL-TIME PRESENCE ------------------------------
    def on_presence_join(self, data):
        """
        data: {
          "groupId": "<gid>",
          "user": { "id": "...", "name": "...", "email": "..." }
        }
        """
        try:
            data = data or {}
            gid_s = str(data.get("groupId") or "").strip()
            user = data.get("user") or {}
            uid_s = str(user.get("id") or user.get("_id") or "").strip()

            if not gid_s or not uid_s:
                return {"ok": False, "error": "missing groupId or user.id"}

            room = f"group:{gid_s}"
            join_room(room)

            now = datetime.utcnow().isoformat() + "Z"

            if gid_s not in GROUP_ONLINE:
                GROUP_ONLINE[gid_s] = {}

            GROUP_ONLINE[gid_s][uid_s] = {
                "_id": uid_s,
                "name": user.get("name"),
                "email": user.get("email"),
                "lastSeen": now,
            }

            online_list = list(GROUP_ONLINE[gid_s].values())

            emit(
                "presence_update",
                {"groupId": gid_s, "online": online_list},
                room=room,
            )
            print(
                f"[ws] presence_join {uid_s} in {room}, now {len(online_list)} online"
            )
            return {"ok": True, "onlineCount": len(online_list)}
        except Exception as e:
            print("[ws] presence_join error:", e)
            return {"ok": False, "error": str(e)}

    def on_presence_leave(self, data):
        """
        data: { "groupId": "<gid>", "userId": "<uid>" }
        """
        try:
            data = data or {}
            gid_s = str(data.get("groupId") or "").strip()
            uid_s = str(data.get("userId") or "").strip()
            if not gid_s or not uid_s:
                return {"ok": False, "error": "missing groupId or userId"}

            room = f"group:{gid_s}"
            leave_room(room)

            if gid_s in GROUP_ONLINE and uid_s in GROUP_ONLINE[gid_s]:
                GROUP_ONLINE[gid_s].pop(uid_s, None)

            online_list = list(GROUP_ONLINE.get(gid_s, {}).values())

            emit(
                "presence_update",
                {"groupId": gid_s, "online": online_list},
                room=room,
            )
            print(
                f"[ws] presence_leave {uid_s} from {room}, now {len(online_list)} online"
            )
            return {"ok": True, "onlineCount": len(online_list)}
        except Exception as e:
            print("[ws] presence_leave error:", e)
            return {"ok": False, "error": str(e)}

    # ------------------- send message (persist + broadcast) ------------------
    def on_group_message(self, data):
        """
        Expected payload from client:
          {
            "groupId": "<string>",
            "text": "<string>",
            "user": {"id": "...", "name": "...", "email": "..."}  # sender identity
          }
        """
        try:
            data = data or {}
            gid_s = data.get("groupId")
            text = (data.get("text") or "").strip()
            user = data.get("user") or {}
            uid_s = user.get("id") or user.get("_id")
            email = (user.get("email") or "").strip().lower()

            if not gid_s or not text or not uid_s:
                return {"ok": False, "error": "missing fields"}

            db = _tenant_db_from_email_or_default(email)
            _ensure_chat_indexes(db)

            gid = _oid(gid_s)
            uid = _oid(uid_s)
            if not gid or not uid:
                return {"ok": False, "error": "invalid ids"}

            if not _is_member(db, gid, uid):
                return {"ok": False, "error": "not a member"}

            doc = {
                "groupId": gid,
                "userId": uid,
                "user": {
                    "_id": uid,
                    "name": user.get("name"),
                    "email": email or user.get("email"),
                },
                "text": text,
                "createdAt": datetime.utcnow(),
            }
            ins = db.group_messages.insert_one(doc)
            saved = db.group_messages.find_one({"_id": ins.inserted_id})
            payload = _serialize_msg(saved)

            room = f"group:{gid_s}"
            emit("group_message", payload, to=room)
            print(f"[ws] group_message -> {room}: {payload}")
            return {"ok": True, "id": payload["id"]}
        except Exception as e:
            print("[ws] group_message error:", e)
            return {"ok": False, "error": str(e)}
