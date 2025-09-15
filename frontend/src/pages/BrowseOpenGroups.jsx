
// frontend/src/pages/BrowseGroups.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5050";

async function apiGet(path) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${localStorage.getItem("token") || ""}` },
  });
  if (!res.ok) {
    const text = await res.text();
    const err = new Error(text || `GET ${path} failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
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
  if (!res.ok) {
    const text = await res.text();
    const err = new Error(text || `POST ${path} failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

export default function BrowseGroups() {
  const navigate = useNavigate();

  const user = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("user") || "{}"); } catch { return {}; }
  }, []);
  const myId = useMemo(
    () => String(user?._id ?? user?.id ?? user?.userId ?? ""),
    [user]
  );
  const myEmail = useMemo(
    () => (user?.email || "").toLowerCase(),
    [user]
  );

  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState([]);

  // members modal
  const [membersOpen, setMembersOpen] = useState(false);
  const [membersLoading, setMembersLoading] = useState(false);
  const [members, setMembers] = useState([]);
  const [membersTitle, setMembersTitle] = useState("");

  // run-once guard
  const didInit = useRef(false);

  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    (async () => {
      try {
        setLoading(true);
        const list = await apiGet("/api/groups/browse");
        setGroups(Array.isArray(list) ? list : []);
      } catch (e) {
        if (e.status === 401) toast.error("Please log in again.");
        else toast.error("Failed to load open groups");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function requestJoin(gid) {
    try {
      await apiPost(`/api/groups/request/${gid}`);
      toast.success("Join request sent");
      const list = await apiGet("/api/groups/browse");
      setGroups(Array.isArray(list) ? list : []);
    } catch {
      toast.error("Could not send request");
    }
  }

  // identify "me"
  const isSelf = (m) => {
    const mid = String(m?._id ?? m?.id ?? m?.userId ?? "");
    if (myId && mid && myId === mid) return true;
    if (m?.email && myEmail && m.email.toLowerCase() === myEmail) return true;
    return false;
  };

  // 🔒 Only members/owner can fetch members list
  const openMembers = async (g) => {
    try {
      setMembersTitle(g.title || "Members");
      setMembersOpen(true);
      setMembersLoading(true);
      const rows = await apiGet(`/api/groups/${g._id}/members`);
      setMembers(Array.isArray(rows) ? rows : []);
    } catch (e) {
      setMembers([]);
      if (e?.status === 403) toast.info("Join this group to view members.");
      else toast.error("Could not load members");
      setMembersOpen(false);
    } finally {
      setMembersLoading(false);
    }
  };

  const closeMembers = () => {
    setMembersOpen(false);
    setMembers([]);
    setMembersTitle("");
  };

  useEffect(() => {
    if (!membersOpen) return;
    const onKey = (e) => e.key === "Escape" && closeMembers();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [membersOpen]);

  const renderCard = (g) => {
    const status = g.myJoinStatus || "none";
    const count = g.membersCount ?? g.members?.length ?? 0;

    return (
      <div key={g._id} style={cardSm}>
        <div style={row}>
          <span style={dot} />
          <div style={title}>{g.title}</div>
        </div>

        <div style={subMeta}>
          {g.course || "—"}{" · "}
          {status === "member" ? (
            <button
              type="button"
              onClick={() => openMembers(g)}
              style={membersLinkBtn}
              aria-label={`View members of ${g.title}`}
            >
              {count} {count === 1 ? "member" : "members"}
            </button>
          ) : (
            <span style={{ color: "#6b7280" }}>
              {count} {count === 1 ? "member" : "members"}
            </span>
          )}
        </div>

        {g.description ? <div style={desc}>{g.description}</div> : <div style={{ height: 4 }} />}

        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          {status === "member" ? (
            <button style={btnPrimary} onClick={() => navigate(`/group/${g._id}`)}>Open</button>
          ) : status === "requested" ? (
            <button style={btnMuted} disabled>Requested</button>
          ) : (
            <button style={btnPrimary} onClick={() => requestJoin(g._id)}>Request to join</button>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <div style={wrap}>
        <div style={headRow}>
          <h1 style={h1}>Browse open groups</h1>
          <button
            type="button"
            style={chipLink}
            onClick={() => navigate("/dashboard")}
            aria-label="Back to dashboard"
          >
            ← Back to dashboard
          </button>
        </div>

        {loading ? (
          <div style={{ color: "#667085", marginTop: 8 }}>Loading…</div>
        ) : groups.length === 0 ? (
          <div style={empty}>No open groups yet.</div>
        ) : (
          <div style={cardsGrid}>{groups.map(renderCard)}</div>
        )}
      </div>

      {/* Members modal */}
      {membersOpen && (
        <div style={backdrop} onClick={closeMembers}>
          <div role="dialog" aria-modal="true" style={modal} onClick={(e) => e.stopPropagation()}>
            <div style={modalHead}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
                Members · {membersTitle}
              </h3>
              <button style={modalX} onClick={closeMembers} aria-label="Close">✕</button>
            </div>

            {membersLoading ? (
              <div style={{ padding: 10, color: "#6b7280" }}>Loading members…</div>
            ) : members.length === 0 ? (
              <div style={{ padding: 10, color: "#6b7280" }}>No members yet.</div>
            ) : (
              <ul style={memberList}>
                {members.map((m) => (
                  <li key={m._id || m.email} style={memberItem}>
                    <span style={dotSmall} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                        <div
                          style={{
                            fontWeight: 700,
                            whiteSpace: "nowrap",
                            textOverflow: "ellipsis",
                            overflow: "hidden",
                          }}
                          title={m.name || m.email}
                        >
                          {m.name || m.email}
                        </div>

                        {m.isOwner && (
                          <span style={ownerChip} title="Group owner">
                            <span style={ownerDot} />
                            Owner
                          </span>
                        )}

                        {isSelf(m) && (
                          <span style={youChip} title="This is you">
                            <span style={youDot} />
                            You
                          </span>
                        )}
                      </div>

                      {m.email && <div style={emailSub}>{m.email}</div>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </>
  );
}

/* ====== styles ====== */

const wrap = { padding: "24px 16px 40px", maxWidth: 1200, margin: "0 auto" };

const headRow = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  marginBottom: 8,
};

const h1 = { margin: 0, fontSize: 28, lineHeight: 1.15, fontWeight: 800 };

const chipLink = {
  background: "#F4F6FF",
  color: "#4f46e5",
  border: "1px solid #E3E8FF",
  padding: "8px 12px",
  borderRadius: 999,
  fontWeight: 700,
  fontSize: 14,
  cursor: "pointer",
};

const cardsGrid = {
  display: "flex",
  flexWrap: "wrap",
  gap: 16,
  alignItems: "stretch",
  marginTop: 16,
};

const cardSm = {
  width: 460,          
  maxWidth: "100%",
  boxSizing: "border-box",
  background: "#fff",
  borderRadius: 18,
  border: "1px solid #EDF0F5",
  boxShadow: "0 18px 60px rgba(2,6,23,0.06)",
  padding: 16,
};

const row = { display: "flex", alignItems: "center", gap: 10 };
const dot = { width: 10, height: 10, borderRadius: "50%", background: "#5b7cfa", boxShadow: "0 0 0 4px #eef2ff" };
const title = { fontWeight: 700, fontSize: 18, letterSpacing: -0.2 };

const subMeta = { color: "#667085", marginTop: 6, fontSize: 14 };
const desc = { marginTop: 10, color: "#374151", fontSize: 14 };

const membersLinkBtn = {
  appearance: "none",
  background: "transparent",
  border: 0,
  color: "#4f46e5",
  fontWeight: 700,
  fontSize: 14,
  padding: 0,
  textDecoration: "none",
  cursor: "pointer",
};

const btnPrimary = {
  background: "linear-gradient(180deg,#5b7cfa,#4f46e5)",
  color: "#fff",
  border: 0,
  padding: "10px 14px",
  borderRadius: 10,
  fontWeight: 800,
  cursor: "pointer",
};
const btnMuted = {
  background: "#f3f4f6",
  color: "#98A2B3",
  border: "1px solid #EAECF0",
  padding: "10px 14px",
  borderRadius: 10,
  fontWeight: 800,
  cursor: "not-allowed",
};

const empty = {
  background: "#fff",
  borderRadius: 14,
  padding: 16,
  color: "#6b7280",
  border: "1px solid #eef0f5",
};

const backdrop = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.4)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
  zIndex: 50,
};
const modal = {
  width: "min(560px, 96vw)",
  maxHeight: "80vh",
  overflow: "hidden auto",
  background: "#fff",
  borderRadius: 16,
  boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
  padding: 16,
};

const modalHead = { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 };
const modalX = { appearance: "none", border: 0, background: "#f3f4f6", color: "#111827", width: 32, height: 32, borderRadius: 8, cursor: "pointer" };

const memberList = { listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 };
const memberItem = { display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", border: "1px solid #eef0f5", borderRadius: 10, background: "#fff" };
const dotSmall = { width: 8, height: 8, borderRadius: "50%", background: "#4f46e5", boxShadow: "0 0 0 3px #eef2ff" };

const ownerChip = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "2px 8px",
  borderRadius: 999,
  background: "#FFF7E6",
  border: "1px solid #FFE3A3",
  color: "#A16207",
  fontSize: 12,
  fontWeight: 700,
  lineHeight: 1,
};
const ownerDot = {
  width: 8,
  height: 8,
  borderRadius: "50%",
  background: "linear-gradient(180deg,#F59E0B,#D97706)",
  boxShadow: "0 0 0 3px #FFF2CC",
};

/* NEW: "You" chip (blue) + sub email style */
const youChip = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "2px 8px",
  borderRadius: 999,
  background: "#EAF2FF",
  border: "1px solid #CFE0FF",
  color: "#1D4ED8",
  fontSize: 12,
  fontWeight: 700,
  lineHeight: 1,
};
const youDot = {
  width: 8,
  height: 8,
  borderRadius: "50%",
  background: "linear-gradient(180deg,#60A5FA,#3B82F6)",
  boxShadow: "0 0 0 3px #DCEBFF",
};

const emailSub = {
  color: "#6b7280",
  fontSize: 12,
  whiteSpace: "nowrap",
  textOverflow: "ellipsis",
  overflow: "hidden",
  marginTop: 2,
};
