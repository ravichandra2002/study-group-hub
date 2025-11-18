
import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { toast } from "react-toastify";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5050";

/* ---------------- API ---------------- */
async function apiGet(path) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${localStorage.getItem("token") || ""}` },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
async function api(method, path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

/* ---------------- helpers ---------------- */
const fmtTime = (iso) =>
  iso ? new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "";

const initials = (name = "", email = "") => {
  const s = (name || email || "?").trim();
  const p = s.replace(/\s+/g, " ").split(" ");
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return (p[0][0] + p[1][0]).toUpperCase();
};

/* ---------------- styles ---------------- */
const page = {
  padding: "24px 16px 64px",
  minHeight: "calc(100vh - 80px)",
  background:
    "radial-gradient(1200px 600px at 0% -10%, #f6f7ff 20%, transparent 60%), radial-gradient(1200px 600px at 100% -10%, #f6f7ff 20%, transparent 60%), #ffffff",
};
const wrap = { width: "min(980px, 96vw)", margin: "0 auto" };

const topBar = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 12,
  gap: 10,
  flexWrap: "wrap",
};
const h1 = { margin: 0, fontSize: 22, fontWeight: 900, letterSpacing: "-0.02em" };

const btn = {
  background: "#f7f7ff",
  color: "#4740ff",
  border: "1px solid #e0e5ff",
  padding: "6px 10px",
  borderRadius: 8,
  fontWeight: 800,
  fontSize: 12,
  cursor: "pointer",
  textDecoration: "none",
};
const btnGhost = {
  background: "#fff",
  color: "#4b5563",
  border: "1px solid #e5e7eb",
  padding: "6px 10px",
  borderRadius: 8,
  fontWeight: 700,
  fontSize: 12,
  cursor: "pointer",
};
const btnPrimary = {
  background: "linear-gradient(180deg,#5b7cfa,#4f46e5)",
  color: "#fff",
  border: 0,
  padding: "8px 12px",
  borderRadius: 8,
  fontWeight: 900,
  fontSize: 12,
  cursor: "pointer",
  boxShadow: "0 6px 18px rgba(79,70,229,0.25)",
};

const lane = { display: "grid", gridTemplateColumns: "60px 1fr", gap: 14 };
const threadCard = {
  border: "1px solid #e6e8f0",
  borderRadius: 12,
  background: "#fff",
  boxShadow: "0 8px 26px rgba(15,18,40,.05)",
};

const voteCol = {
  display: "grid",
  gridTemplateRows: "min-content min-content min-content",
  alignContent: "start",
  justifyItems: "center",
  gap: 6,
  padding: "12px 6px",
  userSelect: "none",
};
const voteBtn = (active, dir) => ({
  width: 32,
  height: 32,
  display: "grid",
  placeItems: "center",
  borderRadius: 10,
  border: active ? "2px solid #365CF8" : "1px solid #e5e7eb",
  background: active ? (dir === "up" ? "#EEF2FF" : "#FFF1F2") : "#fff",
  color: active ? (dir === "up" ? "#1e3a8a" : "#7f1d1d") : "#111827",
  cursor: "pointer",
  fontSize: 14,
  fontWeight: 900,
});
const scorePill = {
  fontWeight: 900,
  fontSize: 12,
  color: "#0f172a",
  background: "#f8fafc",
  border: "1px solid #e5e7eb",
  padding: "2px 10px",
  borderRadius: 999,
};

const bodyCol = { padding: 12, paddingRight: 14 };

const titleRow = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  flexWrap: "wrap",
};
const tTitle = { fontSize: 16, fontWeight: 900, margin: 0, letterSpacing: "-0.01em" };
const meta = {
  color: "#6b7280",
  fontSize: 12,
  display: "flex",
  gap: 6,
  alignItems: "center",
  flexWrap: "wrap",
};
const sepDot = { color: "#cbd5e1" };

const md = {
  marginTop: 6,
  fontSize: 14,
  color: "#0f172a",
  lineHeight: 1.45,
  whiteSpace: "pre-wrap",
};
const hr = { border: 0, borderTop: "1px dashed #e5e7eb", margin: "10px 0" };

const toolsRow = { display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" };
const toolIcon = {
  ...btn,
  padding: "4px 8px",
  fontSize: 12,
  background: "#fff",
  borderColor: "#e5e7eb",
  color: "#111827",
};

const cmRow = (level) => ({
  display: "grid",
  gridTemplateColumns: "40px 1fr",
  gap: 8,
  padding: "8px 0",
  marginLeft: level * 24,
});
const avatar = {
  width: 36,
  height: 36,
  borderRadius: "50%",
  display: "grid",
  placeItems: "center",
  fontWeight: 900,
  color: "#111827",
  background: "#eef2ff",
  border: "1px solid #e0e7ff",
  fontSize: 11,
};
const cmHead = { display: "flex", alignItems: "baseline", gap: 8, marginBottom: 2 };
const cmName = { fontWeight: 900, fontSize: 12, color: "#111827" };
const cmTime = { color: "#6b7280", fontSize: 11 };
const cmBox = {
  background: "#f8fafc",
  border: "1px solid #e5e7eb",
  borderRadius: 10,
  padding: "8px 10px",
  fontSize: 13,
  color: "#111827",
  whiteSpace: "pre-wrap",
};

const input = {
  border: "1px solid #e5e7eb",
  borderRadius: 10,
  padding: 8,
  outline: "none",
  fontFamily: "inherit",
  fontSize: 13,
};
const codeBlock = {
  display: "block",
  fontFamily:
    "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  background: "#0b0f19",
  color: "#e5e7eb",
  padding: "8px 10px",
  borderRadius: 10,
  overflowX: "auto",
  border: "1px solid #0f172a",
  whiteSpace: "pre",
  fontSize: 12,
  marginTop: 6,
};
const chip = {
  background: "#f1f5ff",
  border: "1px solid #e0e7ff",
  color: "#334155",
  padding: "2px 8px",
  borderRadius: 999,
  fontWeight: 800,
  fontSize: 11,
};

const filtersShell = {
  width: "100%",
  boxSizing: "border-box",
  margin: "12px auto 16px",
  padding: "12px 18px 10px",
  borderRadius: 999,
  background:
    "radial-gradient(140% 260% at 0% 0%, #eef2ff 0%, #f9fbff 40%, #ffffff 100%)",
  border: "1px solid #dbeafe",
  boxShadow: "0 18px 40px rgba(79,70,229,0.12)",
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const filtersRowTop = {
  display: "flex",
  justifyContent: "center",
};

const searchWrapper = {
  position: "relative",
  width: "min(100%, 760px)", 
};



const filtersRowBottom = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  flexWrap: "wrap",
  marginTop: 4,
};

/* NEW FILTER BAR STYLES */
const filterBarWrap = {
  width: "97%",
  background: "#f8f9ff",
  border: "1px solid #e4e7ff",
  padding: "12px 16px",
  borderRadius: 12,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  marginBottom: 18,
};

const filterLeft = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
};

const inputGroup = {
  display: "flex",
  alignItems: "center",
  background: "#fff",
  border: "1px solid #d8ddf7",
  borderRadius: 8,
  padding: "6px 10px",
  gap: 6,
};

const searchIcon = {
  opacity: 0.5,
  fontSize: 14,
};

const searchInput = {
  border: "none",
  outline: "none",
  fontSize: 13,
  width: 220,
  background: "transparent",
};

const sortSelect = {
  border: "1px solid #d8ddf7",
  background: "#fff",
  borderRadius: 8,
  padding: "6px 10px",
  fontSize: 13,
  cursor: "pointer",
};

const toggleWrap = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  fontSize: 13,
  color: "#4b5563",
};

const toggleBox = {
  width: 14,
  height: 14,
  cursor: "pointer",
};

const countBadge = {
  background: "#e9edff",
  color: "#1e1b4b",
  padding: "6px 14px",
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 700,
  border: "1px solid #d8ddf7",
  whiteSpace: "nowrap",
};




/* ---------------- Small local-state reply box ---------------- */
function ReplyBox({ placeholder = "Reply…", onSend, buttonLabel = "Reply" }) {
  const [text, setText] = useState("");
  return (
    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        style={{ ...input, flex: 1 }}
      />
      <button
        style={btn}
        onClick={async () => {
          const t = text.trim();
          if (!t) return;
          try {
            await onSend(t);
            setText("");
          } catch (err) {
            console.error("Reply failed:", err);
            toast.error("Could not post reply");
          }
        }}
      >
        {buttonLabel}
      </button>
    </div>
  );
}

/* ---------------- component ---------------- */
export default function GroupDiscussions() {
  const { gid } = useParams();

  const me = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}");
    } catch {
      return {};
    }
  }, []);
  const myId = String(me?._id ?? me?.id ?? me?.userId ?? "");

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [compose, setCompose] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  // filters
  const [search, setSearch] = useState("");
  const [sortMode, setSortMode] = useState("newest"); // newest | mostReplies | unanswered
  const [onlyMine, setOnlyMine] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      setErr("");
      const rows = await apiGet(`/api/discussions/threads?group_id=${gid}`);
      setItems(Array.isArray(rows) ? rows : []);
    } catch (e) {
      console.error("Failed to load discussions:", e);
      setErr(String(e.message || e));
      toast.error("Failed to load discussions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gid]);

  const createThread = async () => {
    if (!title.trim()) return toast.error("Title required");
    try {
      await api("POST", "/api/discussions/threads", { group_id: gid, title, body });
      setTitle("");
      setBody("");
      setCompose(false);
      await load();
      toast.success("Thread posted");
    } catch (e) {
      console.error("Create thread failed:", e);
      toast.error("Could not post");
    }
  };

  const canEdit = (t) => String(t?.createdBy) === myId;

  const editThread = async (t) => {
    const newTitle = prompt("Edit title (leave blank to keep)", t.title ?? "");
    if (newTitle === null) return;
    const newBody = prompt("Edit body (leave blank to keep)", t.body ?? "");
    if (newBody === null) return;
    try {
      await api("PATCH", `/api/discussions/threads/${t._id}`, {
        title: newTitle,
        body: newBody,
      });
      await load();
    } catch (e) {
      console.error("Update thread failed:", e);
      toast.error("Update failed");
    }
  };

  const deleteThread = async (t) => {
    if (!confirm("Delete this thread?")) return;
    try {
      await api("DELETE", `/api/discussions/threads/${t._id}`);
      await load();
    } catch (e) {
      console.error("Delete thread failed:", e);
      toast.error("Delete failed");
    }
  };

  // ---- voting (persisted) ----
  const onVote = async (t, dir) => {
    try {
      const want = t.myVote === dir ? null : dir;
      const data = await api("POST", `/api/discussions/threads/${t._id}/vote`, {
        vote: want,
      });
      setItems((prev) =>
        prev.map((row) =>
          row._id === t._id ? { ...row, score: data.score, myVote: data.myVote } : row
        )
      );
    } catch (e) {
      console.error("Vote failed:", e);
      toast.error("Could not update vote");
    }
  };

  // ---- comments ----
  const sendReply = async ({ threadId, parentId, text }) => {
    console.log("Posting reply", { threadId, parentId, text });
    try {
      await api("POST", `/api/discussions/threads/${threadId}/comments`, {
        text,
        parent_id: parentId || null,
      });
      await load();
    } catch (e) {
      console.error("Reply API failed:", e);
      toast.error("Could not post reply");
      throw e; // so ReplyBox can also catch
    }
  };

  const deleteComment = async (t, c) => {
    if (!confirm("Delete this comment and its replies?")) return;
    try {
      await api("DELETE", `/api/discussions/threads/${t._id}/comments/${c.id}`);
      await load();
    } catch (e) {
      console.error("Delete comment failed:", e);
      toast.error("Delete failed");
    }
  };

  const renderBody = (txt) => {
    const str = String(txt || "");
    const m = str.match(/```([\s\S]*?)```/);
    if (!m) return <div style={md}>{str}</div>;
    const [full, code] = m;
    const before = str.slice(0, str.indexOf(full));
    const after = str.slice(str.indexOf(full) + full.length);
    return (
      <div>
        {before && <div style={md}>{before}</div>}
        <pre style={codeBlock}>{code}</pre>
        {after && <div style={md}>{after}</div>}
      </div>
    );
  };

  // recursive comment renderer
  const Comment = ({ t, c, level = 0 }) => {
    const cname = c?.author?.name || c?.author?.email || "member";
    const cemail = c?.author?.email || "";
    return (
      <div style={cmRow(level)}>
        <div style={avatar} title={cname}>
          {initials(cname, cemail)}
        </div>
        <div>
          <div style={cmHead}>
            <span style={cmName}>{cname}</span>
            <span style={cmTime}>{fmtTime(c.createdAt)}</span>
            {c.userId === myId && (
              <button
                title="Delete"
                style={{
                  ...btn,
                  padding: "2px 8px",
                  background: "#fff1f2",
                  color: "#be123c",
                  borderColor: "#fecdd3",
                  marginLeft: "auto",
                }}
                onClick={() => deleteComment(t, c)}
              >
                🗑️
              </button>
            )}
          </div>
          <div style={cmBox}>{c.text}</div>

          {/* reply box for this comment */}
          <ReplyBox
            placeholder="Reply…"
            onSend={(text) => sendReply({ threadId: t._id, parentId: c.id, text })}
          />

          {/* children */}
          {(c.children || []).map((cc) => (
            <Comment key={cc.id} t={t} c={cc} level={Math.min(level + 1, 6)} />
          ))}
        </div>
      </div>
    );
  };

  // ---- helpers for search/filter/sort ----
  const totalThreads = items.length;

  const filteredItems = useMemo(() => {
    let arr = [...items];

    const q = search.trim().toLowerCase();
    if (q) {
      arr = arr.filter((t) => {
        const title = String(t.title || "").toLowerCase();
        const body = String(t.body || "").toLowerCase();
        const commentsText = flattenTreeText(t.commentsTree || []).toLowerCase();
        return title.includes(q) || body.includes(q) || commentsText.includes(q);
      });
    }

    if (onlyMine && myId) {
      arr = arr.filter((t) => String(t.createdBy) === myId);
    }

    if (sortMode === "mostReplies") {
      arr.sort(
        (a, b) =>
          countTree(b.commentsTree || []) - countTree(a.commentsTree || []) ||
          new Date(b.updatedAt || b.createdAt || 0) -
            new Date(a.updatedAt || a.createdAt || 0)
      );
    } else if (sortMode === "unanswered") {
      arr.sort((a, b) => {
        const aHas = countTree(a.commentsTree || []) > 0 ? 1 : 0;
        const bHas = countTree(b.commentsTree || []) > 0 ? 1 : 0;
        if (aHas !== bHas) return aHas - bHas; // unanswered (0) first
        return (
          new Date(b.updatedAt || b.createdAt || 0) -
          new Date(a.updatedAt || a.createdAt || 0)
        );
      });
    } else {
      // newest
      arr.sort(
        (a, b) =>
          new Date(b.updatedAt || b.createdAt || 0) -
          new Date(a.updatedAt || a.createdAt || 0)
      );
    }

    return arr;
  }, [items, search, sortMode, onlyMine, myId]);

  const filteredCount = filteredItems.length;

  return (
    <div style={page}>
      <div style={wrap}>
        <div style={topBar}>
          <h1 style={h1}>Group Discussions</h1>
          <div style={{ display: "flex", gap: 8 }}>
            <Link to={`/group/${gid}`} style={btn}>
              ← Back
            </Link>
            <button style={btnPrimary} onClick={() => setCompose(true)}>
              New thread
            </button>
          </div>
        </div>

{/* FILTER BAR */}
{/* FILTER BAR – CLEAN MODERN UI */}
{totalThreads > 0 && (
  <div style={filterBarWrap}>
    <div style={filterLeft}>
      <div style={inputGroup}>
        <span style={searchIcon}>🔍</span>
        <input
          style={searchInput}
          placeholder="Search title, body, or replies…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <select
        style={sortSelect}
        value={sortMode}
        onChange={(e) => setSortMode(e.target.value)}
      >
        <option value="newest">Newest</option>
        <option value="mostReplies">Most replies</option>
        <option value="unanswered">Unanswered</option>
      </select>

      <label style={toggleWrap}>
        <input
          type="checkbox"
          checked={onlyMine}
          onChange={(e) => setOnlyMine(e.target.checked)}
          style={toggleBox}
        />
        <span>Only my threads</span>
      </label>
    </div>

    <div style={countBadge}>
      Showing {filteredCount} of {totalThreads}
    </div>
  </div>
)}




        {compose && (
          <div style={{ ...threadCard, padding: 14, marginBottom: 12 }}>
            <div style={{ display: "grid", gap: 8 }}>
              <input
                placeholder="Concise, specific title…"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                style={{ ...input, fontWeight: 800 }}
              />
              <textarea
                placeholder="Explain clearly. Use ```code``` for examples."
                rows={6}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                style={input}
              />
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  justifyContent: "flex-end",
                }}
              >
                <button style={btnGhost} onClick={() => setCompose(false)}>
                  Cancel
                </button>
                <button style={btnPrimary} onClick={createThread}>
                  Publish
                </button>
              </div>
            </div>
          </div>
        )}

        {loading && (
          <div style={{ ...threadCard, padding: 14, color: "#6b7280" }}>
            Loading…
          </div>
        )}
        {!loading && err && (
          <div
            style={{
              ...threadCard,
              padding: 14,
              borderColor: "#fecdd3",
              background: "#fff1f2",
              color: "#be123c",
            }}
          >
            Failed to load: {err}
          </div>
        )}

        {!loading && !err && (
          totalThreads === 0 ? (
            <div style={{ ...threadCard, padding: 14, color: "#6b7280" }}>
              No discussions yet.
            </div>
          ) : filteredCount === 0 ? (
            <div style={{ ...threadCard, padding: 14, color: "#6b7280" }}>
              No discussions match your filters.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {filteredItems.map((t) => {
                const author = t?.author?.name || t?.author?.email || "member";
                const email = t?.author?.email || "";
                const repliesCount = countTree(t.commentsTree || []);
                return (
                  <div key={t._id} style={threadCard}>
                    <div style={lane}>
                      {/* votes */}
                      <div style={voteCol}>
                        <button
                          title={t.myVote === "up" ? "Remove upvote" : "Upvote"}
                          style={voteBtn(t.myVote === "up", "up")}
                          onClick={() => onVote(t, "up")}
                        >
                          ▲
                        </button>
                        <div style={scorePill}>{t.score ?? 0}</div>
                        <button
                          title={
                            t.myVote === "down"
                              ? "Remove downvote"
                              : "Downvote"
                          }
                          style={voteBtn(t.myVote === "down", "down")}
                          onClick={() => onVote(t, "down")}
                        >
                          ▼
                        </button>
                      </div>

                      <div style={bodyCol}>
                        <div style={titleRow}>
                          <h2 style={tTitle}>{t.title}</h2>
                          <div style={toolsRow}>
                            <span style={chip}>
                              {repliesCount} repl
                              {repliesCount === 1 ? "y" : "ies"}
                            </span>
                            {canEdit(t) && (
                              <>
                                <button
                                  title="Edit"
                                  style={toolIcon}
                                  onClick={() => editThread(t)}
                                >
                                  ✏️
                                </button>
                                <button
                                  title="Delete"
                                  style={{
                                    ...toolIcon,
                                    color: "#be123c",
                                    borderColor: "#fecdd3",
                                    background: "#fff1f2",
                                  }}
                                  onClick={() => deleteThread(t)}
                                >
                                  🗑️
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                        <div style={meta}>
                          <span>{author}</span>
                          <span style={sepDot}>•</span>
                          <span>{fmtTime(t.updatedAt || t.createdAt)}</span>
                        </div>

                        {t.body && renderBody(t.body)}

                        <hr style={hr} />

                        {/* comments tree */}
                        {(t.commentsTree || []).map((c) => (
                          <Comment key={c.id} t={t} c={c} level={0} />
                        ))}

                        {/* add root comment */}
                        <ReplyBox
                          placeholder="Add a comment…"
                          onSend={(text) =>
                            sendReply({
                              threadId: t._id,
                              parentId: null,
                              text,
                            })
                          }
                          buttonLabel="Reply"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>
    </div>
  );
}

// total comments in a tree
function countTree(nodes = []) {
  let n = 0;
  for (const x of nodes) n += 1 + countTree(x.children || []);
  return n;
}

// flatten all comment text for search
function flattenTreeText(nodes = []) {
  let out = "";
  for (const n of nodes) {
    if (n.text) out += " " + String(n.text);
    if (n.children && n.children.length) {
      out += " " + flattenTreeText(n.children);
    }
  }
  return out;
}


