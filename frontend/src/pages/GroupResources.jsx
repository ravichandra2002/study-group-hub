
import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5050";


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
    body: JSON.stringify(body || {}),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
async function apiPatch(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
    },
    body: JSON.stringify(body || {}),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
async function apiDelete(path) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${localStorage.getItem("token") || ""}` },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

/* ---------- helpers ---------- */
const iconFor = (r) => {
  if (r?.type === "link") return "🔗";
  const name = (r.filename || r.title || "").toLowerCase();
  const ext = (name.split(".").pop() || "").trim();
  if (/(pdf)$/.test(ext)) return "📕";
  if (/(doc|docx)$/.test(ext)) return "📘";
  if (/(ppt|pptx|key)$/.test(ext)) return "📙";
  if (/(png|jpg|jpeg|gif|webp|svg)$/.test(ext)) return "🖼️";
  if (/(mp4|mov|mkv|webm)$/.test(ext)) return "🎞️";
  if (/(mp3|wav|m4a|flac|ogg)$/.test(ext)) return "🎧";
  if (/(zip|rar|7z|tar|gz)$/.test(ext)) return "🗂️";
  return "📦";
};
const prettySize = (n) => {
  if (!n && n !== 0) return "";
  if (n === 0) return "0 B";
  const k = 1024, u = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(n) / Math.log(k));
  return `${(n / Math.pow(k, i)).toFixed(i ? 1 : 0)} ${u[i]}`;
};
const domainFromUrl = (u) => {
  try { return new URL(u).hostname.replace(/^www\./, ""); }
  catch { return ""; }
};
const timeShort = (iso) =>
  iso ? new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "";


export default function GroupResources() {
  const { gid } = useParams();
  const navigate = useNavigate();

  const me = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("user") || "{}"); }
    catch { return {}; }
  }, []);
  const myId = String(me?._id ?? me?.id ?? me?.userId ?? "");

  const [group, setGroup] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  // Upload/link fields
  const [fileObj, setFileObj] = useState(null);
  const [fileTitle, setFileTitle] = useState("");
  const [fileDesc, setFileDesc] = useState("");
  const [linkTitle, setLinkTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkDesc, setLinkDesc] = useState("");
  const [busyUpload, setBusyUpload] = useState(false);
  const [busyLink, setBusyLink] = useState(false);

  // Edit modal
  const [editOpen, setEditOpen] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");

  const loadGroup = async () => {
    try { setGroup(await apiGet(`/api/groups/${gid}`)); } catch {}
  };
  const loadList = async () => {
    try {
      setLoading(true);
      setRows(await apiGet(`/api/resources/list?group_id=${gid}`));
    } catch {
      toast.error("Failed to load resources");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGroup();
    loadList();
  }, [gid]);

  const isOwner = !!group?.isOwner;
  const canEditRow = (r) => isOwner || String(r.createdBy) === myId;

  /* ---------- actions ---------- */
  const doUpload = async () => {
    if (!fileObj) return toast.info("Select a file first!");
    try {
      setBusyUpload(true);
      const form = new FormData();
      form.append("group_id", gid);
      form.append("file", fileObj);
      form.append("title", fileTitle);
      form.append("description", fileDesc);
      const res = await fetch(`${API_BASE}/api/resources/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("token") || ""}` },
        body: form,
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success("File uploaded!");
      setFileObj(null);
      setFileTitle("");
      setFileDesc("");
      loadList();
    } catch {
      toast.error("Upload failed");
    } finally {
      setBusyUpload(false);
    }
  };

  const saveLink = async () => {
    if (!linkUrl.trim()) return toast.info("Paste a valid link!");
    try {
      setBusyLink(true);
      await apiPost("/api/resources/link", {
        group_id: gid,
        title: linkTitle,
        url: linkUrl,
        description: linkDesc,
      });
      toast.success("Link added!");
      setLinkTitle("");
      setLinkUrl("");
      setLinkDesc("");
      loadList();
    } catch {
      toast.error("Save failed");
    } finally {
      setBusyLink(false);
    }
  };

  const download = async (r) => {
    try {
      const res = await fetch(`${API_BASE}/api/resources/download/${r._id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token") || ""}` },
      });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = r.filename || r.title || "file";
      a.click();
    } catch {
      toast.error("Download failed");
    }
  };

  const openEdit = (r) => {
    setEditRow(r);
    setEditTitle(r.title || "");
    setEditDesc(r.description || "");
    setEditOpen(true);
  };

  const saveEdit = async () => {
    try {
      await apiPatch(`/api/resources/update/${editRow._id}`, {
        title: editTitle,
        description: editDesc,
      });
      toast.success("Updated!");
      setEditOpen(false);
      loadList();
    } catch {
      toast.error("Update failed");
    }
  };

  const doDelete = async (r) => {
    if (!confirm("Delete this resource?")) return;
    try {
      await apiDelete(`/api/resources/${r._id}`);
      toast.success("Deleted");
      loadList();
    } catch {
      toast.error("Delete failed");
    }
  };

  return (
    <div style={pageWrap}>
      <div style={container}>
       <div style={topBar}>
  <h1 style={h1}>Group Resources</h1>
  <button style={chipLink} onClick={() => navigate(`/group/${gid}`)}>
    ← Back
  </button>
</div>

        {/* Forms */}
        <div style={twoCol}>
          <section style={card}>
            <h3 style={cardTitle}>Upload File</h3>
            <label htmlFor="file" style={fileBtn}>Choose File</label>
            <input
              id="file"
              type="file"
              onChange={(e) => setFileObj(e.target.files?.[0] || null)}
              style={{ display: "none" }}
            />
            <input style={input} placeholder="Title" value={fileTitle} onChange={(e) => setFileTitle(e.target.value)} />
            <input style={input} placeholder="Description" value={fileDesc} onChange={(e) => setFileDesc(e.target.value)} />
            <button style={btnPrimary} onClick={doUpload} disabled={busyUpload}>
              {busyUpload ? "Uploading…" : "Upload"}
            </button>
          </section>

          <section style={card}>
            <h3 style={cardTitle}>Add Link</h3>
            <input style={input} placeholder="Title" value={linkTitle} onChange={(e) => setLinkTitle(e.target.value)} />
            <input style={input} placeholder="https://example.com" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} />
            <input style={input} placeholder="Description" value={linkDesc} onChange={(e) => setLinkDesc(e.target.value)} />
            <button style={btnPrimary} onClick={saveLink} disabled={busyLink}>
              {busyLink ? "Saving…" : "Save Link"}
            </button>
          </section>
        </div>

        {/* List */}
        <section style={{ ...card, marginTop: 20 }}>
          <h3 style={cardTitle}>All Resources</h3>
          {loading ? (
            <div>Loading…</div>
          ) : rows.length === 0 ? (
            <div>No resources yet.</div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {rows.map((r) => {
                const isFile = r.type === "file";
                const title = r.title || (isFile ? r.filename : r.url);
                const meta = [
                  isFile ? prettySize(r.size) : domainFromUrl(r.url),
                  timeShort(r.createdAt),
                ].filter(Boolean);
                return (
                  <div key={r._id} style={row}>
                    <div style={rowLeft}>
                      <div style={rowIcon}>{iconFor(r)}</div>
                      <div style={{ minWidth: 0 }}>
                        <div style={rowTitle} title={title}>{title}</div>
                        <div style={rowMeta}>
                          {meta.map((m, i) => (
                            <span key={i} style={metaBit}>
                              {m}{i < meta.length - 1 && <span style={metaDot}>•</span>}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div style={rowActions}>
                      {isFile ? (
                        <button style={btnPill} onClick={() => download(r)} title="Download">⬇️</button>
                      ) : (
                        <a href={r.url} target="_blank" rel="noreferrer" style={btnPill} title="Open link">🔎</a>
                      )}
                      {canEditRow(r) && (
                        <>
                          <button style={btnGhostCircle} onClick={() => openEdit(r)} title="Edit">✏️</button>
                          <button style={btnDangerCircle} onClick={() => doDelete(r)} title="Delete">🗑️</button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Edit Modal */}
      {editOpen && (
        <div style={backdrop} onClick={() => setEditOpen(false)}>
          <div role="dialog" aria-modal="true" style={modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: 20, fontWeight: 800, marginBottom: 10 }}>Edit Resource</h3>
            <input style={input} placeholder="Title" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
            <textarea
              style={textArea}
              placeholder="Description"
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              rows={6}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button style={btnGhost} onClick={() => setEditOpen(false)}>Cancel</button>
              <button style={btnPrimary} onClick={saveEdit}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- styles (no experimental syntax) ---------- */
const pageWrap = { padding: "32px 16px 72px", minHeight: "100vh", background: "#f9f9ff" };
const container = { width: "min(1100px, 96vw)", margin: "0 auto" };
const topBar = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" };
const chipLink = { background: "#EEF2FF", color: "#4f46e5", border: "1px solid #DBE2FF", padding: "8px 12px", borderRadius: 999, fontWeight: 800, cursor: "pointer" };
const h1 = { fontSize: 26, fontWeight: 900, margin: 0 };

const twoCol = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 };
const card = { border: "1px solid #EEF0F5", background: "#fff", borderRadius: 14, padding: 14, boxShadow: "0 6px 24px rgba(2,6,23,0.04)" };
const cardTitle = { margin: 0, marginBottom: 10, fontSize: 16, fontWeight: 900 };
const input = { width: "100%", border: "1px solid #e5e7eb", borderRadius: 10, padding: "10px 12px", marginBottom: 8, boxSizing: "border-box" };
const textArea = { ...input, minHeight: 120 };
const btnPrimary = { background: "#4f46e5", color: "#fff", border: "none", padding: "10px 14px", borderRadius: 10, fontWeight: 800, cursor: "pointer" };
const btnGhost = { background: "#fff", color: "#6b7280", border: "1px solid #e5e7eb", padding: "10px 14px", borderRadius: 10, fontWeight: 700, cursor: "pointer" };
const fileBtn = { background: "#EEF2FF", color: "#4f46e5", border: "1px solid #DBE2FF", padding: "10px 14px", borderRadius: 999, fontWeight: 900, cursor: "pointer", display: "inline-block", marginBottom: 10, userSelect: "none" };

const row = { display: "flex", alignItems: "center", justifyContent: "space-between", border: "1px solid #eef0f5", padding: "10px 12px", borderRadius: 12, gap: 12 };
const rowLeft = { display: "flex", alignItems: "center", gap: 10, minWidth: 0 };
const rowIcon = { width: 40, height: 40, display: "grid", placeItems: "center", borderRadius: 12, background: "#EEF2FF", color: "#4f46e5", fontSize: 20, flexShrink: 0 };
const rowTitle = { fontWeight: 800, color: "#111827", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 520 };
const rowMeta = { fontSize: 12, color: "#6b7280", display: "flex", alignItems: "center", flexWrap: "wrap" };
const metaBit = { display: "inline-flex", alignItems: "center" };
const metaDot = { margin: "0 6px", color: "#CBD5E1" };
const rowActions = { display: "flex", gap: 8, alignItems: "center", flexShrink: 0 };

const btnPill = { background: "#EEF2FF", color: "#4f46e5", border: "1px solid #DBE2FF", padding: "8px 12px", borderRadius: 999, fontWeight: 800, cursor: "pointer", textDecoration: "none" };
const btnGhostCircle = { background: "#fff", color: "#4f46e5", border: "1px solid #DBE2FF", width: 40, height: 40, borderRadius: 999, fontSize: 18, cursor: "pointer" };
const btnDangerCircle = { ...btnGhostCircle, color: "#be123c", borderColor: "#fecdd3" };

const backdrop = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 50 };
const modal = { width: "min(720px, 96vw)", background: "#fff", borderRadius: 18, border: "1px solid #EDF0F5", boxShadow: "0 18px 60px rgba(0,0,0,0.20)", padding: 16 };
