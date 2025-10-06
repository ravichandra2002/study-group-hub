

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5050";

/* ---------- tiny API helpers ---------- */
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
async function apiDelete(path) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${localStorage.getItem("token") || ""}` },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

/* ========================================================= */

export default function Dashboard() {
  const navigate = useNavigate();
  const user = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("user") || "{}"); } catch { return {}; }
  }, []);

  const [loading, setLoading] = useState(true);
  const [mine, setMine] = useState([]);

  // Requests modal (owner)
  const [reqModal, setReqModal] = useState({
    open: false,
    groupId: null,
    title: "",
    items: [],
    loading: false,
  });

  // run-once guard (prevents double-run in StrictMode)
  const didInit = useRef(false);

  // initial load (once)
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    load({ showSpinner: true });
  }, []);

  const load = async ({ showSpinner = false } = {}) => {
    try {
      if (showSpinner) setLoading(true);
      const m = await apiGet("/api/groups"); // my groups (owner/member) with pendingCount for owner
      setMine(m || []);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load your groups");
    } finally {
      if (showSpinner) setLoading(false);
    }
  };

  /* ---------- actions ---------- */
  const leave = async (gid) => {
    try {
      await apiPost(`/api/groups/leave/${gid}`);
      toast.success("Left group");
      load(); // light refresh (no spinner)
    } catch (e) {
      toast.error(e?.message || "Could not leave group");
    }
  };

  const del = async (gid) => {
    if (!confirm("Delete this group? This cannot be undone.")) return;
    try {
      await apiDelete(`/api/groups/${gid}`);
      toast.success("Group deleted");
      load(); // light refresh
    } catch (e) {
      toast.error(e?.message || "Could not delete group");
    }
  };

  const openRequests = async (g) => {
    try {
      setReqModal({ open: true, groupId: g._id, title: g.title, items: [], loading: true });
      const rows = await apiGet(`/api/groups/${g._id}/requests`);
      setReqModal((s) => ({ ...s, items: rows || [], loading: false }));
    } catch (e) {
      setReqModal((s) => ({ ...s, loading: false }));
      toast.error("Failed to load requests");
    }
  };

  const approve = async (gid, uid) => {
    try {
      await apiPost(`/api/groups/${gid}/requests/${uid}/approve`);
      toast.success("Approved");
      const rows = await apiGet(`/api/groups/${gid}/requests`);
      setReqModal((s) => ({ ...s, items: rows || [] }));
      load(); // light refresh
    } catch (e) {
      toast.error(e?.message || "Approve failed");
    }
  };

  const reject = async (gid, uid) => {
    try {
      await apiPost(`/api/groups/${gid}/requests/${uid}/reject`);
      toast.success("Rejected");
      const rows = await apiGet(`/api/groups/${gid}/requests`);
      setReqModal((s) => ({ ...s, items: rows || [] }));
      load(); // light refresh
    } catch (e) {
      toast.error(e?.message || "Reject failed");
    }
  };

  /* ---------- render ---------- */
  const renderCard = (g) => {
    const membersCount = g.membersCount ?? g.members?.length ?? 0;

    return (
      <div key={g._id} style={cardSm}>
        <div style={row}>
          <span style={dot} />
          <div style={title}>{g.title}</div>
        </div>

        <div style={subMeta}>
          {g.course || "—"}{" · "}{membersCount} {membersCount === 1 ? "member" : "members"}
        </div>

        {g.description ? <div style={desc}>{g.description}</div> : <div style={{ height: 6 }} />}

        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button style={btnPrimary} onClick={() => navigate(`/group/${g._id}`)}>Open</button>

          {g.isOwner ? (
            <>
              <button
                style={{ ...btnPillBlue, ...(g.pendingCount ? pillHasCount : null) }}
                onClick={() => openRequests(g)}
                title="Pending join requests"
              >
                Requests {g.pendingCount ? `(${g.pendingCount})` : ""}
              </button>
              <button style={btnDanger} onClick={() => del(g._id)}>Delete</button>
            </>
          ) : (
            <button style={btnGhost} onClick={() => leave(g._id)}>Leave</button>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <div style={{ padding: "24px 16px 40px" }}>
        <div style={headRow}>
          <div>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800 }}>My groups</h1>
            <div style={{ color: "#6b7280", fontSize: 14 }}>
              {user?.name || user?.fullName || user?.email || ""}
            </div>
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <button style={btnPill} onClick={() => navigate("/browse")}>
              <span aria-hidden>🔎</span>&nbsp;Browse groups&nbsp;→
            </button>
            <button style={btnPrimaryLg} onClick={() => navigate("/create")}>
              +&nbsp;Create group
            </button>
          </div>
        </div>

        {loading ? (
          <div style={stateBox}>Loading…</div>
        ) : mine.length === 0 ? (
          <div style={stateBox}>You’re not in any groups yet.</div>
        ) : (
          <div style={cardsGrid}>{mine.map(renderCard)}</div>
        )}
      </div>

      {/* Requests modal (owner) */}
      {reqModal.open && (
        <div
          style={modalBackdrop}
          onClick={() => setReqModal({ open: false, groupId: null, title: "", items: [], loading: false })}
        >
          <div style={modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={modalHead}>
              <div style={{ fontWeight: 900, fontSize: 18 }}>
                Join requests · {reqModal.title}
              </div>
              <button
                style={btnGhost}
                onClick={() => setReqModal({ open: false, groupId: null, title: "", items: [], loading: false })}
              >
                Close
              </button>
            </div>

            {reqModal.loading ? (
              <div style={stateBox}>Loading…</div>
            ) : reqModal.items.length === 0 ? (
              <div style={stateBox}>No pending requests.</div>
            ) : (
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
                {reqModal.items.map((r) => (
                  <li key={r.userId} style={reqRow}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis" }}>
                        {r.name || r.email}
                      </div>
                      <div style={{ color: "#6b7280", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis" }}>
                        {r.email} · {r.createdAt ? new Date(r.createdAt).toLocaleString() : ""}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button style={btnTiny} onClick={() => approve(reqModal.groupId, r.userId)}>Approve</button>
                      <button style={btnDanger} onClick={() => reject(reqModal.groupId, r.userId)}>Reject</button>
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

/* ---------- styles (dashboard look you liked) ---------- */
const headRow = {
  maxWidth: 1200,
  margin: "0 auto 18px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
};
const stateBox = {
  background: "#fff",
  border: "1px solid #eef0f5",
  borderRadius: 14,
  color: "#6b7280",
  padding: 16,
  maxWidth: 1200,
  margin: "0 auto",
};
const cardsGrid = {
  maxWidth: 1200,
  margin: "0 auto",
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))",
  gap: 16,
};

const cardSm = {
  background: "#fff",
  border: "1px solid #EDF0F5",
  borderRadius: 18,
  boxShadow: "0 18px 60px rgba(2,6,23,0.06)",
  padding: 16,
};

const row = { display: "flex", alignItems: "center", gap: 10 };
const dot = { width: 10, height: 10, borderRadius: "50%", background: "#5b7cfa", boxShadow: "0 0 0 4px #eef2ff" };
const title = { fontWeight: 800, fontSize: 18 };
const subMeta = { color: "#667085", marginTop: 6, fontSize: 14 };
const desc = {
  marginTop: 8,
  color: "#374151",
  fontSize: 14,
  display: "-webkit-box",
  WebkitLineClamp: 2,        
  WebkitBoxOrient: "vertical",
  overflow: "hidden"
};

const btnPrimary = {
  background: "linear-gradient(180deg,#5b7cfa,#4f46e5)",
  color: "#fff",
  border: 0,
  padding: "10px 14px",
  borderRadius: 12,
  fontWeight: 800,
  cursor: "pointer",
};
const btnPrimaryLg = { ...btnPrimary, padding: "12px 16px" };
const btnPill = {
  background: "#eef2ff",
  color: "#4f46e5",
  border: "1px solid #dbe2ff",
  padding: "10px 14px",
  borderRadius: 999,
  fontWeight: 800,
  cursor: "pointer",
};
const btnPillBlue = {
  background: "#eef6ff",
  color: "#1d4ed8",
  border: "1px solid #cfe6ff",
  padding: "8px 12px",
  borderRadius: 999,
  fontWeight: 800,
  fontSize: 12,
  cursor: "pointer",
};
const pillHasCount = { background: "#e0edff", borderColor: "#9cc3ff" };
const btnTiny = {
  background: "#4f46e5",
  color: "#fff",
  border: 0,
  padding: "8px 12px",
  borderRadius: 10,
  fontWeight: 700,
  fontSize: 12,
  cursor: "pointer",
};
const btnGhost = {
  background: "#fff",
  color: "#6b7280",
  border: "1px solid #e5e7eb",
  padding: "8px 12px",
  borderRadius: 10,
  fontWeight: 700,
  fontSize: 12,
  cursor: "pointer",
};
const btnDanger = {
  background: "#fee2e2",
  color: "#b91c1c",
  border: "1px solid #fecaca",
  padding: "8px 12px",
  borderRadius: 10,
  fontWeight: 800,
  fontSize: 12,
  cursor: "pointer",
};

const modalBackdrop = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 23, 42, 0.35)",
  backdropFilter: "blur(2px)",
  display: "grid",
  placeItems: "center",
  padding: 16,
  zIndex: 50,
};
const modalCard = {
  width: "min(680px, 100%)",
  background: "#fff",
  borderRadius: 16,
  border: "1px solid #eef0f5",
  boxShadow: "0 24px 60px rgba(0,0,0,0.18)",
  padding: 16,
};
const modalHead = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 12,
};
const reqRow = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: 12,
  border: "1px solid #eef0f5",
  borderRadius: 12,
  background: "#fafbff",
};
