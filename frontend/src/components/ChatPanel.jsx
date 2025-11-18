// frontend/src/components/ChatPanel.jsx
import { useEffect, useRef, useState } from "react";
import {
  notifySocket,
  joinGroupRoom,
  leaveGroupRoom,
  sendGroupMessage,
  startTyping,
  stopTyping,
} from "../lib/socket";

export default function ChatPanel({ gid, currentUser }) {
  const [messages, setMessages] = useState([]); // {text, from, at}
  const [text, setText] = useState("");
  const [typingUsers, setTypingUsers] = useState([]); // [{userId,name}]
  const scrollerRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const myId =
    currentUser &&
    String(
      currentUser.id || currentUser._id || currentUser.userId || ""
    );

  // join/leave the room for this group
  useEffect(() => {
    if (!gid) return;
    joinGroupRoom(gid);
    return () => leaveGroupRoom(gid);
  }, [gid]);

  // socket listeners
  useEffect(() => {
    const onMsg = (payload) => {
      // payload: {text, from, at}
      setMessages((prev) => [...prev, payload]);
    };
    const onSystem = (p) => {
      setMessages((prev) => [
        ...prev,
        {
          text: p?.msg || "system",
          from: "system",
          at: new Date().toISOString(),
        },
      ]);
    };

    const onTyping = (payload) => {
      // payload: { groupId, users: [{userId, name}, ...] }
      if (!payload || String(payload.groupId) !== String(gid)) return;

      const list = Array.isArray(payload.users) ? payload.users : [];
      // remove myself from typing list
      const withoutMe = list.filter((u) => {
        const uid = String(u.userId || "");
        return uid && uid !== myId;
      });
      setTypingUsers(withoutMe);
    };

    notifySocket.on("group_message", onMsg);
    notifySocket.on("system", onSystem);
    notifySocket.on("group_typing", onTyping);

    return () => {
      notifySocket.off("group_message", onMsg);
      notifySocket.off("system", onSystem);
      notifySocket.off("group_typing", onTyping);
    };
  }, [gid, myId]);

  // auto-scroll on new messages
  useEffect(() => {
    scrollerRef.current?.scrollTo({
      top: scrollerRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages.length]);

  const handleChange = (e) => {
    const val = e.target.value;
    setText(val);

    if (!gid) return;

    // tell backend I'm typing
    startTyping(gid);

    // after 1.2s of no typing, send stop
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping(gid);
    }, 1200);
  };

  const submit = (e) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    sendGroupMessage(gid, trimmed);
    setText("");
    if (gid) {
      stopTyping(gid);
    }
  };

  const typingLabel = buildTypingLabel(typingUsers);

  return (
    <div style={wrap}>
      <div style={head}>Group chat</div>

      <div ref={scrollerRef} style={list}>
        {messages.length === 0 ? (
          <div style={empty}>No messages yet. Say hi 👋</div>
        ) : (
          messages.map((m, i) => {
            const isMe =
              m.from?.id &&
              currentUser &&
              String(m.from.id) === myId;

            const isSystem = m.from === "system";

            return (
              <div
                key={i}
                style={{
                  ...row,
                  justifyContent: isSystem
                    ? "center"
                    : isMe
                    ? "flex-end"
                    : "flex-start",
                }}
              >
                {isSystem ? (
                  <div style={systemMsg}>{m.text}</div>
                ) : (
                  <div
                    style={{
                      ...bubble,
                      ...(isMe ? bubbleMe : bubbleOther),
                    }}
                  >
                    <div style={meta}>
                      {m.from?.name ||
                        m.from?.email ||
                        (m.from === "system"
                          ? "system"
                          : "someone")}{" "}
                      · {new Date(m.at).toLocaleTimeString()}
                    </div>
                    <div>{m.text}</div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* typing indicator */}
      {typingLabel && (
        <div style={typingWrap}>
          <span style={typingDot} />
          <span style={typingText}>{typingLabel}</span>
        </div>
      )}

      <form onSubmit={submit} style={inputRow}>
        <input
          style={input}
          value={text}
          onChange={handleChange}
          placeholder="Type a message…"
        />
        <button style={sendBtn} disabled={!text.trim()} type="submit">
          Send
        </button>
      </form>
    </div>
  );
}

/* helper: build label like "Ravi is typing…" */
function buildTypingLabel(users) {
  if (!users || users.length === 0) return "";
  const names = users
    .map((u) => (u.name || "Member").split(" ")[0])
    .slice(0, 3);

  if (names.length === 1) return `${names[0]} is typing…`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`;
  return `${names[0]}, ${names[1]} and others are typing…`;
}

/* styles */
const wrap = {
  border: "1px solid #eef0f5",
  borderRadius: 16,
  background: "#fff",
  padding: 12,
  maxWidth: 720,
};
const head = { fontWeight: 800, marginBottom: 8 };
const list = {
  height: 280,
  overflow: "auto",
  background: "#fafbff",
  border: "1px solid #eef0f5",
  borderRadius: 12,
  padding: 10,
};
const empty = { color: "#6b7280", textAlign: "center", marginTop: 80 };
const row = { display: "flex", marginBottom: 8 };
const bubble = {
  maxWidth: "70%",
  borderRadius: 12,
  padding: "8px 10px",
  border: "1px solid #e5e7eb",
};
const bubbleMe = { background: "#eef2ff", borderColor: "#dbe2ff" };
const bubbleOther = { background: "#fff" };
const meta = { fontSize: 11, color: "#6b7280", marginBottom: 2 };
const systemMsg = {
  fontSize: 11,
  color: "#6b7280",
  padding: "4px 8px",
  borderRadius: 999,
  background: "#f3f4f6",
};

const inputRow = { display: "flex", gap: 8, marginTop: 8 };
const input = {
  flex: 1,
  border: "1px solid #e5e7eb",
  borderRadius: 10,
  padding: "10px 12px",
  outline: "none",
};
const sendBtn = {
  background: "linear-gradient(180deg,#5b7cfa,#4f46e5)",
  color: "#fff",
  border: 0,
  padding: "10px 14px",
  borderRadius: 10,
  fontWeight: 800,
  cursor: "pointer",
};

/* typing pill */
const typingWrap = {
  marginTop: 6,
  marginBottom: 2,
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "3px 10px",
  borderRadius: 999,
  background: "rgba(79,70,229,0.06)",
  border: "1px solid rgba(79,70,229,0.18)",
  fontSize: 11,
  fontWeight: 600,
  color: "#111827",
};
const typingDot = {
  width: 10,
  height: 10,
  borderRadius: "999px",
  background:
    "radial-gradient(circle at 30% 30%, #a5b4fc, #4f46e5)",
};
const typingText = {
  maxWidth: 240,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};
