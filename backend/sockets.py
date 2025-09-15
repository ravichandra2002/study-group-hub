# from flask_socketio import Namespace, emit, join_room

# class ChatNamespace(Namespace):
#     def on_connect(self):
#         print("[ws] client connected to /ws/chat")
#         emit("connected", {"ok": True})

#     def on_join_user(self, data):
#         uid = (data or {}).get("userId")
#         if not uid:
#             print("[ws] join_user missing userId")
#             return {"ok": False, "error": "missing userId"}

#         room = f"user:{str(uid)}"
#         join_room(room)
#         print(f"[ws] joined user room {room}")
#         emit("system", {"msg": f"joined {room}"})
#         return {"ok": True, "room": room}

#     # optional back-compat
#     def on_join_user_room(self, data):
#         return self.on_join_user(data)

# backend/sockets.py
from flask_socketio import Namespace, emit, join_room, leave_room

class ChatNamespace(Namespace):
    def on_connect(self):
        print("[ws] client connected to /ws/chat")
        emit("connected", {"ok": True})

    def on_join_user(self, data):
        uid = (data or {}).get("userId")
        if not uid:
            print("[ws] join_user missing userId")
            return {"ok": False, "error": "missing userId"}
        room = f"user:{str(uid)}"
        join_room(room)
        print(f"[ws] joined user room {room}")
        emit("system", {"msg": f"joined {room}"})
        return {"ok": True, "room": room}

    # NEW: allow clients to leave their previous user-room
    def on_leave_user(self, data):
        uid = (data or {}).get("userId")
        if not uid:
            print("[ws] leave_user missing userId")
            return {"ok": False, "error": "missing userId"}
        room = f"user:{str(uid)}"
        leave_room(room)
        print(f"[ws] left user room {room}")
        emit("system", {"msg": f"left {room}"})
        return {"ok": True, "room": room}

    # (optional backward compat)
    def on_join_user_room(self, data):
        return self.on_join_user(data)
