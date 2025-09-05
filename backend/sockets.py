from flask_socketio import Namespace, emit, join_room

class ChatNamespace(Namespace):
    def on_connect(self):
        emit("connected", {"ok": True})

    def on_join(self, data):
        room = data.get("groupId")
        if room:
            join_room(room)
            emit("system", {"msg": f"joined {room}"}, to=room)

    def on_message(self, data):
        room = data.get("groupId")
        text = data.get("text")
        if room and text:
            emit("message", {"text": text}, to=room)
