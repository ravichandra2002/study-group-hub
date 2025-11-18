
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import {
  notifySocket,
  ensureConnected,
  joinGroupRoom,
  leaveGroupRoom,
} from "../lib/socket";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5050";
const ALLOWED_EXTS = ["pdf", "doc", "docx"];

/* ---------- helpers ---------- */
const fmtTime = (iso) =>
  iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";

const fmtBytes = (n) => {
  if (!Number.isFinite(n)) return "";
  const u = ["B", "KB", "MB", "GB"];
  let i = 0, v = n;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${u[i]}`;
};

const normalizeMessage = (m) => ({
  id: m.id || m._id || `${Date.now()}-${Math.random()}`,
  kind: m.kind || "text",
  text: m.text || m.message || "",
  file: m.file || null,
  at: m.at || m.createdAt || new Date().toISOString(),
  from: m.from || m.user || m.sender || {},
  groupId: String(
    m.groupId ||
      m.group_id ||
      (m.room && String(m.room).startsWith("group:") ? String(m.room).slice(6) : "") ||
      ""
  ),
});

async function apiGet(path) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${localStorage.getItem("token") || ""}` },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
async function apiPost(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
async function apiUpload(path, file) {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${localStorage.getItem("token") || ""}` },
    body: fd,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

/** Fetch any file with Authorization header and return an object URL */
async function fetchBlobUrl(authUrl) {
  const res = await fetch(authUrl, {
    headers: { Authorization: `Bearer ${localStorage.getItem("token") || ""}` },
  });
  if (!res.ok) throw new Error(await res.text());
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

export default function ChatDock({ gid, groupTitle, canChat, myId, me }) {
  const [open, setOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [loadedFor, setLoadedFor] = useState("");
  const [unread, setUnread] = useState(0);
  const [uploading, setUploading] = useState(false);

  // preview modal state
  const [preview, setPreview] = useState(null);      // original file meta {name,url,mime,size}
  const [previewUrl, setPreviewUrl] = useState("");  // blob: URL for iframe / download
  const [previewLoading, setPreviewLoading] = useState(false);

  const seenIdsRef = useRef(new Set());
  const joinedRoomRef = useRef("");
  const listRef = useRef(null);
  const fileRef = useRef(null);

  const myName = useMemo(
    () => me?.name || me?.fullName || me?.email || "You",
    [me]
  );

  const pushMsg = (raw, viaSocket = false) => {
    const m = normalizeMessage(raw);
    if (m.id && seenIdsRef.current.has(m.id)) return;
    if (m.id) seenIdsRef.current.add(m.id);
    if (m.groupId && gid && String(m.groupId) !== String(gid)) return;

    setMessages((prev) => [...prev, m]);

    const fromId = String(m?.from?.id ?? m?.from?._id ?? "");
    const mine = myId && fromId && myId === fromId;
    if (viaSocket && !open && !mine) {
      setUnread((u) => Math.min(u + 1, 99));
    }
  };

  // autoscroll
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, open]);

  // join group room & listen
  useEffect(() => {
    if (!gid || !canChat) return;
    ensureConnected();

    const room = `group:${gid}`;
    if (joinedRoomRef.current && joinedRoomRef.current !== room) {
      try { leaveGroupRoom(joinedRoomRef.current.replace(/^group:/, "")); } catch {}
    }
    joinGroupRoom(gid);
    joinedRoomRef.current = room;

    const onGroupMessage = (payload) => {
      const p = normalizeMessage(payload);
      if (String(p.groupId || "") !== String(gid)) return;
      pushMsg(p, true);
    };
    notifySocket.on("group_message", onGroupMessage);
    return () => notifySocket.off("group_message", onGroupMessage);
  }, [gid, canChat, myId, open]);

  // initial unread fetch (when closed)
  useEffect(() => {
    if (!gid || !canChat || open) return;
    apiGet(`/api/groups/${gid}/chat/unread`)
      .then((r) => setUnread(Math.min(Number(r?.count || 0), 99)))
      .catch(() => {});
  }, [gid, canChat, open]);

  // load history on open + mark read
  useEffect(() => {
    if (!open || !gid || !canChat) return;
    (async () => {
      try {
        if (loadedFor !== gid) {
          setMessages([]);
          seenIdsRef.current = new Set();
          const rows = await apiGet(`/api/groups/${gid}/chat`);
          rows.forEach((m) => pushMsg(m, false));
          setLoadedFor(gid);
        }
      } catch {}
      try { await apiPost(`/api/groups/${gid}/chat/mark-read`); } catch {}
      setUnread(0);
    })();
  }, [open, gid, canChat, loadedFor]);

  const sendMsg = async (e) => {
    e?.preventDefault?.();
    const text = chatInput.trim();
    if (!text) return;
    if (!canChat) return toast.info("Join the group to chat.");
    try {
      setChatInput("");
      await apiPost(`/api/groups/${gid}/chat`, { text });
    } catch {
      toast.error("Message failed to send");
    }
  };

  const triggerFile = () => fileRef.current?.click();

  const onFileChange = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = ""; // reset
    if (!f) return;
    const ext = f.name.split(".").pop()?.toLowerCase();
    if (!ALLOWED_EXTS.includes(ext)) {
      toast.warn("Only PDF, DOC, DOCX files are allowed.");
      return;
    }
    if (!canChat) return toast.info("Join the group to chat.");
    try {
      setUploading(true);
      await apiUpload(`/api/groups/${gid}/chat/upload`, f);
      // will arrive via socket
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  // ----- preview (fetch as blob with Authorization) -----
  const openPreview = async (file) => {
    // cleanup any previous blob url
    if (previewUrl) {
      try { URL.revokeObjectURL(previewUrl); } catch {}
      setPreviewUrl("");
    }
    setPreview(file);
    setPreviewLoading(true);
    try {
      const blobUrl = await fetchBlobUrl(file.url);
      setPreviewUrl(blobUrl);
    } catch (err) {
      toast.error("Failed to load file preview");
    } finally {
      setPreviewLoading(false);
    }
  };

  const closePreview = () => {
    setPreview(null);
    if (previewUrl) {
      try { URL.revokeObjectURL(previewUrl); } catch {}
      setPreviewUrl("");
    }
  };

  const downloadFile = () => {
    if (!previewUrl) return;
    const a = document.createElement("a");
    a.href = previewUrl;
    a.download = preview?.name || "";
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  if (!canChat) return null;

  return (
    <div style={dockWrap}>
      {!open && (
        <button title="Open group chat" onClick={() => setOpen(true)} style={launcherBtn}>
          <span aria-hidden style={{ fontSize: 18 }}>💬</span>
          {unread > 0 && <span style={badge}>{unread > 9 ? "9+" : unread}</span>}
        </button>
      )}

      {open && (
        <div style={panel}>
          <div style={panelHead}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
              <span aria-hidden>💬</span>
              <div style={panelTitle} title={groupTitle || "Group chat"}>
                {groupTitle || "Group chat"}
              </div>
            </div>
            <button aria-label="Minimize" onClick={() => setOpen(false)} style={headBtn}>─</button>
          </div>

          <div style={panelBody}>
            <div ref={listRef} style={msgList}>
              {messages.length === 0 ? (
                <div style={{ color: "#6b7280", fontSize: 13, textAlign: "center", marginTop: 12 }}>
                  No messages yet. Say hi 👋
                </div>
              ) : (
                messages.map((m) => {
                  const fromId = String(m?.from?.id ?? m?.from?._id ?? "");
                  const mine = myId && fromId && myId === fromId;
                  const displayName = m?.from?.name || m?.from?.email || (mine ? myName : "Member");

                  return (
                    <div key={m.id} style={mine ? rowMine : rowOther}>
                      <div style={bubble(mine)}>
                        <div style={bubbleHead}>
                          <b style={nameText}>{displayName}</b>
                          <span style={timeText}>{fmtTime(m.at)}</span>
                        </div>

                        {m.kind === "file" && m.file ? (
                          <button
                            type="button"
                            onClick={() => openPreview(m.file)}
                            title={m.file.name}
                            style={filePill(mine)}
                          >
                            <span aria-hidden>📎</span>
                            <span style={pillName}>{m.file.name}</span>
                            <span style={pillMeta}>
                              {(m.file.mime || "").replace("application/", "")} · {fmtBytes(m.file.size)}
                            </span>
                          </button>
                        ) : (
                          <div style={msgText}>{m.text}</div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
              <div style={{ height: 2 }} />
            </div>

            <form onSubmit={sendMsg} style={inputRow}>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={onFileChange}
                style={{ display: "none" }}
              />
              <button
                type="button"
                onClick={triggerFile}
                style={attachBtn}
                disabled={uploading}
                title="Attach file (PDF/DOC/DOCX)"
              >
                {uploading ? "…" : "📎"}
              </button>

              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Type a message…"
                style={inputBox}
              />
              <button type="submit" style={sendBtn} disabled={!chatInput.trim()}>
                Send
              </button>
            </form>
          </div>
        </div>
      )}

      {/* -------- Preview modal -------- */}
      {preview && (
        <div style={backdrop} onClick={closePreview}>
          <div role="dialog" aria-modal="true" style={modal} onClick={(e) => e.stopPropagation()}>
            <div style={modalHead}>
              <div style={{ fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {preview.name}
              </div>
              <button style={modalX} onClick={closePreview} aria-label="Close">✕</button>
            </div>

            {previewLoading ? (
              <div style={loadingBox}>Loading…</div>
            ) : String(preview.mime || "").includes("pdf") ? (
              <iframe title={preview.name} src={previewUrl} style={pdfFrame} />
            ) : (
              <div style={noPreview}>
                <div style={{ fontSize: 40 }}>📄</div>
                <div style={{ fontWeight: 700, marginTop: 8 }}>{preview.name}</div>
                <div style={{ color: "#6b7280", fontSize: 13, marginTop: 4 }}>
                  {preview.mime || "document"} · {fmtBytes(preview.size)}
                </div>
              </div>
            )}

            <div style={modalActions}>
              <a
                href={previewUrl || "#"}
                onClick={(e) => !previewUrl && e.preventDefault()}
                target="_blank"
                rel="noreferrer"
                style={{ ...btnGhost, pointerEvents: previewUrl ? "auto" : "none", opacity: previewUrl ? 1 : 0.6 }}
              >
                Open in new tab
              </a>
              <button
                style={{ ...btnPrimary, opacity: previewUrl ? 1 : 0.6, pointerEvents: previewUrl ? "auto" : "none" }}
                onClick={downloadFile}
              >
                Download
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ===== compact styles (with small file pill) ===== */
const dockWrap = { position: "fixed", right: 16, bottom: 16, zIndex: 60 };

const launcherBtn = {
  position: "relative",
  width: 48,
  height: 48,
  borderRadius: 999,
  border: "1px solid #dbe2ff",
  background: "linear-gradient(180deg,#5b7cfa,#4f46e5)",
  color: "#fff",
  display: "grid",
  placeItems: "center",
  boxShadow: "0 12px 34px rgba(79,70,229,0.28)",
  cursor: "pointer",
  fontWeight: 800,
  overflow: "visible",
};

const badge = {
  position: "absolute",
  top: -6,
  right: -6,
  zIndex: 2,
  background: "#ef4444",
  color: "#fff",
  borderRadius: 999,
  padding: "1px 5px",
  fontSize: 10,
  lineHeight: 1,
  minWidth: 16,
  textAlign: "center",
  boxShadow: "0 4px 10px rgba(239,68,68,0.3)",
};

const panel = {
  width: "min(360px, 96vw)",
  height: 460,
  borderRadius: 12,
  background: "#fff",
  border: "1px solid #E7EAF5",
  boxShadow: "0 16px 60px rgba(2,6,23,0.14)",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
};

const panelHead = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "6px 8px",
  background: "linear-gradient(180deg,#F6F8FF,#EEF1FF)",
  borderBottom: "1px solid #E7EAF5",
};

const panelTitle = {
  fontWeight: 800,
  fontSize: 14,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const headBtn = {
  appearance: "none",
  border: 0,
  width: 26,
  height: 26,
  borderRadius: 7,
  background: "#eef2ff",
  color: "#3730a3",
  fontWeight: 900,
  cursor: "pointer",
};

const panelBody = {
  display: "flex",
  flexDirection: "column",
  height: "100%",
  minHeight: 0,
};

const msgList = {
  flex: 1,
  minHeight: 0,
  overflow: "auto",
  overscrollBehavior: "contain",
  padding: "8px 6px",
  background: "#F9FAFE",
  display: "grid",
  gap: 6,
  alignContent: "start",
  gridAutoRows: "min-content",
};

const rowOther = { display: "flex", justifyContent: "flex-start", alignItems: "flex-end" };
const rowMine  = { display: "flex", justifyContent: "flex-end",   alignItems: "flex-end" };

const bubble = (mine) => ({
  display: "inline-block",
  width: "fit-content",
  maxWidth: "74%",
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  lineHeight: 1.32,
  fontSize: 13,
  background: mine ? "linear-gradient(180deg,#5b7cfa,#4f46e5)" : "#fff",
  color: mine ? "#fff" : "#111827",
  border: mine ? "1px solid #4f46e5" : "1px solid #e5e7eb",
  borderRadius: 9,
  padding: "5px 8px",
  boxShadow: mine ? "0 5px 16px rgba(79,70,229,0.16)" : "0 3px 10px rgba(0,0,0,0.05)",
});

const bubbleHead = {
  display: "flex",
  alignItems: "center",
  gap: 5,
  marginBottom: 2,
  fontSize: 11,
  opacity: 0.8,
};

const nameText = {
  whiteSpace: "nowrap",
  textOverflow: "ellipsis",
  overflow: "hidden",
  maxWidth: 140,
  fontWeight: 700,
};

const timeText = { fontSize: 10, opacity: 0.8 };

const msgText = { fontSize: 13, lineHeight: 1.32 };

/* compact file pill */
const filePill = (mine) => ({
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  maxWidth: "100%",
  borderRadius: 8,
  padding: "6px 8px",
  background: mine ? "rgba(255,255,255,0.10)" : "#fff",
  border: mine ? "1px solid rgba(255,255,255,0.25)" : "1px solid #e5e7eb",
  color: mine ? "#fff" : "#0f172a",
  cursor: "pointer",
});

const pillName = {
  fontWeight: 700,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  maxWidth: 160,
};
const pillMeta = { fontSize: 11, opacity: 0.8 };

/* composer */
const inputRow = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  padding: 7,
  borderTop: "1px solid #E7EAF5",
  background: "#FAFBFF",
};

const attachBtn = {
  appearance: "none",
  border: "1px solid #E5E7EB",
  background: "#fff",
  borderRadius: 8,
  width: 34,
  height: 34,
  display: "grid",
  placeItems: "center",
  cursor: "pointer",
  fontSize: 16,
};

const inputBox = {
  flex: 1,
  border: "1px solid #E5E7EB",
  borderRadius: 9,
  padding: "8px 10px",
  outline: "none",
  background: "#fff",
  fontSize: 13,
};

const sendBtn = {
  background: "linear-gradient(180deg,#5b7cfa,#4f46e5)",
  color: "#fff",
  border: 0,
  padding: "7px 10px",
  borderRadius: 9,
  fontWeight: 800,
  cursor: "pointer",
  fontSize: 13,
};

/* ===== preview modal ===== */
const backdrop = {
  position: "fixed",
  inset: 0,
  background: "rgba(15,23,42,0.45)",
  display: "grid",
  placeItems: "center",
  padding: 16,
  zIndex: 70,
};
const modal = {
  width: "min(860px, 96vw)",
  background: "#fff",
  borderRadius: 14,
  border: "1px solid #E5E7EB",
  boxShadow: "0 24px 80px rgba(2,6,23,0.35)",
  padding: 12,
};
const modalHead = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  padding: "2px 2px 10px",
  borderBottom: "1px solid #EEF0F5",
};
const modalX = {
  appearance: "none",
  border: 0,
  background: "#F3F4F6",
  color: "#111827",
  width: 34,
  height: 34,
  borderRadius: 8,
  cursor: "pointer",
  fontWeight: 900,
};
const pdfFrame = {
  width: "100%",
  height: "70vh",
  border: 0,
  borderRadius: 8,
};
const loadingBox = {
  height: "70vh",
  display: "grid",
  placeItems: "center",
  color: "#6b7280",
  fontWeight: 600,
  fontSize: 14,
};
const noPreview = {
  display: "grid",
  placeItems: "center",
  textAlign: "center",
  padding: "28px 8px",
};
const modalActions = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 8,
  paddingTop: 10,
  borderTop: "1px solid #EEF0F5",
};
const btnGhost = {
  appearance: "none",
  border: "1px solid #E5E7EB",
  background: "#fff",
  color: "#111827",
  padding: "8px 12px",
  borderRadius: 9,
  fontWeight: 700,
  textDecoration: "none",
};
const btnPrimary = {
  background: "linear-gradient(180deg,#5b7cfa,#4f46e5)",
  color: "#fff",
  border: 0,
  padding: "8px 14px",
  borderRadius: 9,
  fontWeight: 800,
  cursor: "pointer",
};


