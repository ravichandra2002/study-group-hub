

// // frontend/src/lib/socket.js
// import { io } from "socket.io-client";

// const RAW_API = import.meta.env.VITE_API_URL || "http://localhost:5050";
// const API_BASE = String(RAW_API).replace(/\/$/, "");
// const NS = "/ws/chat";

// const SOCKET_KEY = "__SGH_NOTIFY_SOCKET__";
// const BOUND_KEY = "__SGH_NOTIFY_BOUND__";

// // Reuse a single socket instance across HMR/tabs
// let sock = typeof window !== "undefined" ? window[SOCKET_KEY] : null;

// if (!sock) {
//   sock = io(`${API_BASE}${NS}`, {
//     transports: ["websocket"],
//     autoConnect: false,
//   });
//   if (typeof window !== "undefined") window[SOCKET_KEY] = sock;
// }

// export const notifySocket = sock;

// /* -----------------------------------------------------------
//    One-time global listeners (+ rebroadcast events)
// ----------------------------------------------------------- */
// if (typeof window !== "undefined" && !window[BOUND_KEY]) {
//   notifySocket.on("connect", () => {
//     console.log("[socket] connected:", notifySocket.id);
//   });

//   notifySocket.on("disconnect", (reason) => {
//     console.log("[socket] disconnected:", reason);
//   });

//   notifySocket.on("connect_error", (err) => {
//     console.warn("[socket] connect_error:", err?.message || err);
//   });

//   // Group/system notifications
//   notifySocket.on("notify", (payload) => {
//     try {
//       window.dispatchEvent(new CustomEvent("sgh:notify", { detail: payload }));
//     } catch {}
//   });

//   // Direct user notifications (e.g., meeting requests)
//   notifySocket.on("notify_user", (payload) => {
//     try {
//       window.dispatchEvent(
//         new CustomEvent("sgh:notify", {
//           detail: {
//             type: "meeting_request",
//             text: payload?.message || "New meeting request",
//           },
//         })
//       );
//     } catch {}
//   });

//   // 🔴 Real-time group presence (who is online in a group)
//   notifySocket.on("presence_update", (payload) => {
//     try {
//       console.log("[socket] presence_update:", payload);
//       window.dispatchEvent(
//         new CustomEvent("sgh:presence", { detail: payload || {} })
//       );
//     } catch {}
//   });

//   window[BOUND_KEY] = true;
// }

// /* -----------------------------------------------------------
//    Connection helpers
// ----------------------------------------------------------- */
// export function ensureConnected() {
//   if (!notifySocket.connected) notifySocket.connect();
// }

// /* -----------------------------------------------------------
//    Per-user notification rooms
// ----------------------------------------------------------- */
// export function joinUserRoom(userId) {
//   if (!userId) return console.warn("[socket] joinUserRoom: no userId");
//   ensureConnected();
//   notifySocket.emit("join_user", { userId: String(userId) }, (ack) =>
//     console.log("[socket] join_user ACK ←", ack)
//   );
// }

// export function leaveUserRoom(userId) {
//   if (!userId) return console.warn("[socket] leaveUserRoom: no userId");
//   ensureConnected();
//   notifySocket.emit("leave_user", { userId: String(userId) }, (ack) =>
//     console.log("[socket] leave_user ACK ←", ack)
//   );
// }

// /* -----------------------------------------------------------
//    Group chat helpers (required by ChatDock/ChatPanel)
// ----------------------------------------------------------- */
// export function joinGroupRoom(gid) {
//   if (!gid) return console.warn("[socket] joinGroupRoom: no gid");
//   ensureConnected();
//   notifySocket.emit("join_group", { groupId: String(gid) }, (ack) =>
//     console.log("[socket] join_group ACK ←", ack)
//   );
// }

// export function leaveGroupRoom(gid) {
//   if (!gid) return console.warn("[socket] leaveGroupRoom: no gid");
//   ensureConnected();
//   notifySocket.emit("leave_group", { groupId: String(gid) }, (ack) =>
//     console.log("[socket] leave_group ACK ←", ack)
//   );
// }

// // helper to read current user from localStorage
// function getMe() {
//   try {
//     return JSON.parse(localStorage.getItem("user") || "{}");
//   } catch {
//     return {};
//   }
// }

// export function sendGroupMessage(gid, text) {
//   const msg = (text || "").trim();
//   if (!gid || !msg) return;

//   ensureConnected();

//   const me = getMe();
//   const payload = {
//     groupId: String(gid),
//     text: msg,
//     user: {
//       id: String(me?._id ?? me?.id ?? me?.userId ?? ""),
//       name: me?.fullName || me?.name || me?.email || "Member",
//       email: me?.email,
//     },
//   };

//   notifySocket.emit("group_message", payload, (ack) => {
//     if (ack?.ok === false) {
//       console.warn("[socket] group_message error:", ack?.error);
//     }
//   });
// }

// /* -----------------------------------------------------------
//    REAL-TIME PRESENCE HELPERS
// ----------------------------------------------------------- */
// export function presenceJoinGroup(gid) {
//   if (!gid) return console.warn("[socket] presenceJoinGroup: no gid");
//   ensureConnected();
//   const me = getMe();
//   const uid = String(me?._id ?? me?.id ?? me?.userId ?? "");
//   if (!uid) return console.warn("[socket] presenceJoinGroup: no user id");

//   const payload = {
//     groupId: String(gid),
//     user: {
//       id: uid,
//       name: me?.fullName || me?.name || me?.email || "Member",
//       email: me?.email || "",
//     },
//   };

//   notifySocket.emit("presence_join", payload, (ack) =>
//     console.log("[socket] presence_join ACK ←", ack)
//   );
// }

// export function presenceLeaveGroup(gid, userId) {
//   if (!gid) return console.warn("[socket] presenceLeaveGroup: no gid");
//   const uid = String(userId || "");
//   if (!uid) return console.warn("[socket] presenceLeaveGroup: no userId");

//   ensureConnected();
//   notifySocket.emit(
//     "presence_leave",
//     { groupId: String(gid), userId: uid },
//     (ack) => console.log("[socket] presence_leave ACK ←", ack)
//   );
// }

// /* -----------------------------------------------------------
//    Optional: hard disconnect (e.g., hard logout)
// ----------------------------------------------------------- */
// export function hardDisconnect() {
//   try {
//     notifySocket.removeAllListeners();
//     notifySocket.disconnect();
//     if (typeof window !== "undefined") window[BOUND_KEY] = false;
//     console.log("[socket] hardDisconnect() done");
//   } catch (e) {
//     console.warn("[socket] hardDisconnect() error", e);
//   }
// }


// frontend/src/lib/socket.js
import { io } from "socket.io-client";

const RAW_API = import.meta.env.VITE_API_URL || "http://localhost:5050";
const API_BASE = String(RAW_API).replace(/\/$/, "");
const NS = "/ws/chat";

const SOCKET_KEY = "__SGH_NOTIFY_SOCKET__";
const BOUND_KEY = "__SGH_NOTIFY_BOUND__";

// Reuse a single socket instance across HMR/tabs
let sock = typeof window !== "undefined" ? window[SOCKET_KEY] : null;

if (!sock) {
  sock = io(`${API_BASE}${NS}`, {
    transports: ["websocket"],
    autoConnect: false,
  });
  if (typeof window !== "undefined") window[SOCKET_KEY] = sock;
}

export const notifySocket = sock;

/* -----------------------------------------------------------
   One-time global listeners (+ rebroadcast events)
----------------------------------------------------------- */
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

  // Group/system notifications
  notifySocket.on("notify", (payload) => {
    try {
      window.dispatchEvent(
        new CustomEvent("sgh:notify", { detail: payload })
      );
    } catch {}
  });

  // Direct user notifications (e.g., meeting requests)
  notifySocket.on("notify_user", (payload) => {
    try {
      window.dispatchEvent(
        new CustomEvent("sgh:notify", {
          detail: {
            type: "meeting_request",
            text: payload?.message || "New meeting request",
          },
        })
      );
    } catch {}
  });

  // 🔴 Real-time group presence (who is online in a group)
  notifySocket.on("presence_update", (payload) => {
    try {
      console.log("[socket] presence_update:", payload);
      window.dispatchEvent(
        new CustomEvent("sgh:presence", { detail: payload || {} })
      );
    } catch {}
  });

  window[BOUND_KEY] = true;
}

/* -----------------------------------------------------------
   Connection helpers
----------------------------------------------------------- */
export function ensureConnected() {
  if (!notifySocket.connected) notifySocket.connect();
}

/* small helper to read current user */
function getMe() {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}");
  } catch {
    return {};
  }
}

/* -----------------------------------------------------------
   Per-user notification rooms
----------------------------------------------------------- */
export function joinUserRoom(userId) {
  if (!userId) return console.warn("[socket] joinUserRoom: no userId");
  ensureConnected();
  notifySocket.emit("join_user", { userId: String(userId) }, (ack) =>
    console.log("[socket] join_user ACK ←", ack)
  );
}

export function leaveUserRoom(userId) {
  if (!userId) return console.warn("[socket] leaveUserRoom: no userId");
  ensureConnected();
  notifySocket.emit("leave_user", { userId: String(userId) }, (ack) =>
    console.log("[socket] leave_user ACK ←", ack)
  );
}

/* -----------------------------------------------------------
   Group chat helpers (required by ChatDock/ChatPanel)
----------------------------------------------------------- */
export function joinGroupRoom(gid) {
  if (!gid) return console.warn("[socket] joinGroupRoom: no gid");
  ensureConnected();
  notifySocket.emit("join_group", { groupId: String(gid) }, (ack) =>
    console.log("[socket] join_group ACK ←", ack)
  );
}

export function leaveGroupRoom(gid) {
  if (!gid) return console.warn("[socket] leaveGroupRoom: no gid");
  ensureConnected();
  notifySocket.emit("leave_group", { groupId: String(gid) }, (ack) =>
    console.log("[socket] leave_group ACK ←", ack)
  );
}

export function sendGroupMessage(gid, text) {
  const msg = (text || "").trim();
  if (!gid || !msg) return;

  ensureConnected();

  const me = getMe();
  const payload = {
    groupId: String(gid),
    text: msg,
    user: {
      id: String(me?._id ?? me?.id ?? me?.userId ?? ""),
      name: me?.fullName || me?.name || me?.email || "Member",
      email: me?.email,
    },
  };

  notifySocket.emit("group_message", payload, (ack) => {
    if (ack?.ok === false) {
      console.warn("[socket] group_message error:", ack?.error);
    }
  });
}

/* -----------------------------------------------------------
   REAL-TIME "WHO IS TYPING" HELPERS
----------------------------------------------------------- */
export function startTyping(gid) {
  if (!gid) return console.warn("[socket] startTyping: no gid");
  ensureConnected();

  const me = getMe();
  const uid = String(me?._id ?? me?.id ?? me?.userId ?? "");
  if (!uid) return;

  const payload = {
    groupId: String(gid),
    user: {
      id: uid,
      name: me?.fullName || me?.name || me?.email || "Member",
      email: me?.email || "",
    },
  };

  notifySocket.emit("group_typing_start", payload, (ack) => {
    if (ack && ack.ok === false) {
      console.warn("[socket] group_typing_start error:", ack.error);
    }
  });
}

export function stopTyping(gid) {
  if (!gid) return console.warn("[socket] stopTyping: no gid");
  ensureConnected();

  const me = getMe();
  const uid = String(me?._id ?? me?.id ?? me?.userId ?? "");
  if (!uid) return;

  const payload = {
    groupId: String(gid),
    user: {
      id: uid,
    },
  };

  notifySocket.emit("group_typing_stop", payload, (ack) => {
    if (ack && ack.ok === false) {
      console.warn("[socket] group_typing_stop error:", ack.error);
    }
  });
}

/* -----------------------------------------------------------
   REAL-TIME PRESENCE HELPERS
----------------------------------------------------------- */
export function presenceJoinGroup(gid) {
  if (!gid) return console.warn("[socket] presenceJoinGroup: no gid");
  ensureConnected();
  const me = getMe();
  const uid = String(me?._id ?? me?.id ?? me?.userId ?? "");
  if (!uid) return console.warn("[socket] presenceJoinGroup: no user id");

  const payload = {
    groupId: String(gid),
    user: {
      id: uid,
      name: me?.fullName || me?.name || me?.email || "Member",
      email: me?.email || "",
    },
  };

  notifySocket.emit("presence_join", payload, (ack) =>
    console.log("[socket] presence_join ACK ←", ack)
  );
}

export function presenceLeaveGroup(gid, userId) {
  if (!gid) return console.warn("[socket] presenceLeaveGroup: no gid");
  const uid = String(userId || "");
  if (!uid) return console.warn("[socket] presenceLeaveGroup: no userId");

  ensureConnected();
  notifySocket.emit(
    "presence_leave",
    { groupId: String(gid), userId: uid },
    (ack) => console.log("[socket] presence_leave ACK ←", ack)
  );
}

/* -----------------------------------------------------------
   Optional: hard disconnect (e.g., hard logout)
----------------------------------------------------------- */
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
