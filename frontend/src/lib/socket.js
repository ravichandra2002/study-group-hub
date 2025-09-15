// frontend/src/lib/socket.js
import { io } from "socket.io-client";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5050";
const NS = "/ws/chat";
const SOCKET_KEY = "__SGH_NOTIFY_SOCKET__";
const BOUND_KEY = "__SGH_NOTIFY_BOUND__";

// Reuse a single socket across HMR/tab reloads
let sock = typeof window !== "undefined" ? window[SOCKET_KEY] : null;
if (!sock) {
  sock = io(`${API_BASE}${NS}`, {
    transports: ["websocket"],
    autoConnect: false, // connect on demand to avoid race conditions
  });
  if (typeof window !== "undefined") window[SOCKET_KEY] = sock;
}
export const notifySocket = sock;

// One-time global listeners + console logging + CustomEvent rebroadcast
if (typeof window !== "undefined" && !window[BOUND_KEY]) {
  notifySocket.on("connect", () => {
    console.log("[socket] connected:", notifySocket.id);
  });
  notifySocket.on("disconnect", (reason) => {
    console.log("[socket] disconnected:", reason);
  });
  notifySocket.on("connect_error", (err) => {
    console.warn("[socket] connect_error:", err?.message || err);
  });

  // Rebroadcast 'notify' so UI can listen even if handlers were momentarily unbound
  notifySocket.on("notify", (payload) => {
    console.log("[socket][lib] notify:", payload);
    try {
      window.dispatchEvent(new CustomEvent("sgh:notify", { detail: payload }));
    } catch {}
  });

  window[BOUND_KEY] = true;
}

// Ensure connection before emitting anything
export function ensureConnected() {
  if (!notifySocket.connected) {
    console.log("[socket] ensureConnected(): connect()");
    notifySocket.connect();
  }
}

// Join a per-user room (acked)
export function joinUserRoom(userId) {
  if (!userId) {
    console.warn("[socket] joinUserRoom: no userId");
    return;
  }
  ensureConnected();
  const id = String(userId);
  console.log("[socket] joinUserRoom →", { userId: id });
  notifySocket.emit("join_user", { userId: id }, (ack) => {
    console.log("[socket] join_user ACK ←", ack);
  });
}

// Leave a per-user room (acked) — call on logout or user switch
export function leaveUserRoom(userId) {
  if (!userId) {
    console.warn("[socket] leaveUserRoom: no userId");
    return;
  }
  ensureConnected();
  const id = String(userId);
  console.log("[socket] leaveUserRoom →", { userId: id });
  notifySocket.emit("leave_user", { userId: id }, (ack) => {
    console.log("[socket] leave_user ACK ←", ack);
  });
}

// Optional: fully tear down the socket (use on hard logout if needed)
export function hardDisconnect() {
  try {
    notifySocket.removeAllListeners();
    notifySocket.disconnect();
    if (typeof window !== "undefined") window[BOUND_KEY] = false;
    console.log("[socket] hardDisconnect() done");
  } catch (e) {
    console.warn("[socket] hardDisconnect() error", e);
  }
}
