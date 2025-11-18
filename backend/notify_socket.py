# backend/notify_socket.py
"""
Socket.IO helpers for group typing indicator ("who is typing...").

Usage from app.py:

    from notify_socket import register_socket_handlers
    register_socket_handlers(socketio)

This file does NOT import app.py to avoid circular imports.
"""

from typing import Dict, Tuple

# { groupId: { userId: name } }
_TYPING: Dict[str, Dict[str, str]] = {}


def _group_room(gid: str) -> str:
    """Room name helper – must match whatever you use for join_group."""
    return f"group:{gid}"


def _broadcast_typing(socketio, gid: str) -> None:
    """
    Emits to the group room:

      event: "group_typing"
      payload: { groupId, users: [{userId, name}, ...] }
    """
    group_map = _TYPING.get(gid) or {}
    users = [
        {"userId": uid, "name": name}
        for uid, name in group_map.items()
    ]

    socketio.emit(
      "group_typing",
      {"groupId": gid, "users": users},
      room=_group_room(gid),
      namespace="/ws/chat",
    )


def register_socket_handlers(socketio):
    """
    Call this once from app.py *after* you create the `socketio` instance.

    Example:

        socketio = SocketIO(app, cors_allowed_origins="*")
        from notify_socket import register_socket_handlers
        register_socket_handlers(socketio)
    """

    @socketio.on("group_typing_start", namespace="/ws/chat")
    def handle_group_typing_start(data):
        """
        data: { groupId, user: { id, name, email? } }
        """
        try:
            gid = str((data or {}).get("groupId") or "").strip()
            user = (data or {}).get("user") or {}
            uid = str(user.get("id") or "").strip()
            name = (user.get("name") or "Member").strip()
        except Exception:
            return

        if not gid or not uid:
            return

        group_map = _TYPING.get(gid) or {}
        group_map[uid] = name
        _TYPING[gid] = group_map

        _broadcast_typing(socketio, gid)

    @socketio.on("group_typing_stop", namespace="/ws/chat")
    def handle_group_typing_stop(data):
        """
        data: { groupId, user: { id } }
        """
        try:
            gid = str((data or {}).get("groupId") or "").strip()
            user = (data or {}).get("user") or {}
            uid = str(user.get("id") or "").strip()
        except Exception:
            return

        if not gid or not uid:
            return

        group_map = _TYPING.get(gid) or {}
        if uid in group_map:
            del group_map[uid]

        if group_map:
            _TYPING[gid] = group_map
        else:
            _TYPING.pop(gid, None)

        _broadcast_typing(socketio, gid)
