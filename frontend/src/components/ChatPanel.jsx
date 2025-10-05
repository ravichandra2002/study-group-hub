// frontend/src/components/ChatPanel.jsx
import { useEffect, useRef, useState } from "react";
import { notifySocket, joinGroupRoom, leaveGroupRoom, sendGroupMessage } from "../lib/socket";

export default function ChatPanel({ gid, currentUser }) {
  const [messages, setMessages] = useState([]); // {text, from, at}
  const [text, setText] = useState("");
  const scrollerRef = useRef(null);

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
      setMessages((prev) => [...prev, { text: p?.msg || "system", from: "system", at: new Date().toISOString() }]);
    };

    notifySocket.on("group_message", onMsg);
    notifySocket.on("system", onSystem);

    return () => {
      notifySocket.off("group_message", onMsg);
      notifySocket.off("system", onSystem);
    };
  }, []);

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  const submit = (e) => {
    e.preventDefault();
    sendGroupMessage(gid, text);
    setText("");
  };

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
              String(m.from.id) === String(currentUser.id || currentUser._id || currentUser.userId);
            return (
              <div key={i} style={{ ...row, justifyContent: isMe ? "flex-end" : "flex-start" }}>
                <div style={{ ...bubble, ...(isMe ? bubbleMe : bubbleOther) }}>
                  <div style={meta}>
                    {m.from?.name || m.from?.email || (m.from === "system" ? "system" : "someone")} ·{" "}
                    {new Date(m.at).toLocaleTimeString()}
                  </div>
                  <div>{m.text}</div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <form onSubmit={submit} style={inputRow}>
        <input
          style={input}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message…"
        />
        <button style={sendBtn} disabled={!text.trim()} type="submit">
          Send
        </button>
      </form>
    </div>
  );
}

/* styles */
const wrap = { border: "1px solid #eef0f5", borderRadius: 16, background: "#fff", padding: 12, maxWidth: 720 };
const head = { fontWeight: 800, marginBottom: 8 };
const list = { height: 280, overflow: "auto", background: "#fafbff", border: "1px solid #eef0f5", borderRadius: 12, padding: 10 };
const empty = { color: "#6b7280", textAlign: "center", marginTop: 80 };
const row = { display: "flex", marginBottom: 8 };
const bubble = { maxWidth: "70%", borderRadius: 12, padding: "8px 10px", border: "1px solid #e5e7eb" };
const bubbleMe = { background: "#eef2ff", borderColor: "#dbe2ff" };
const bubbleOther = { background: "#fff" };
const meta = { fontSize: 11, color: "#6b7280", marginBottom: 2 };
const inputRow = { display: "flex", gap: 8, marginTop: 8 };
const input = { flex: 1, border: "1px solid #e5e7eb", borderRadius: 10, padding: "10px 12px", outline: "none" };
const sendBtn = {
  background: "linear-gradient(180deg,#5b7cfa,#4f46e5)",
  color: "#fff",
  border: 0,
  padding: "10px 14px",
  borderRadius: 10,
  fontWeight: 800,
  cursor: "pointer",
};
