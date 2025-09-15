import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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

export default function MyGroups() {
  const navigate = useNavigate();

  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}");
    } catch {
      return {};
    }
  }, []);
  const myId = String(user?.id || user?._id || "");

  const [loading, setLoading] = useState(true);
  const [mine, setMine] = useState([]);

  // requests modal
  const [reqModal, setReqModal] = useState({
    open: false,
    groupId: null,
    title: "",
    items: [], // [{userId,name,email,createdAt}]
    loading: false,
  });

  const load = async () => {
    try {
      setLoading(true);
      const m = await apiGet("/api/groups");
      setMine(m || []);
    } catch {
      toast.error("Failed to load your groups");
    } finally {
      setLoading(false);
    }
  };

useEffect(() => {
  load(); // initial
  const onFocus = () => load();
  window.addEventListener("focus", onFocus);

  const id = setInterval(load, 8000); // light poll (8s)
  return () => {
    window.removeEventListener("focus", onFocus);
    clearInterval(id);
  };
}, []);


  const leave = async (gid) => {
    try {
      await apiPost(`/api/groups/leave/${gid}`);
      toast.success("Left group");
      load();
    } catch {
      toast.error("Could not leave group");
    }
  };

  const del = async (gid) => {
    try {
      await apiDelete(`/api/groups/${gid}`);
      toast.success("Group deleted");
      load();
    } catch {
      toast.error("Could not delete group");
    }
  };

  const openRequests = async (g) => {
    try {
      setReqModal({ open: true, groupId: g._id, title: g.title, items: [], loading: true });
      const rows = await apiGet(`/api/groups/${g._id}/requests`);
      setReqModal((s) => ({ ...s, items: rows || [], loading: false }));
    } catch {
      setReqModal((s) => ({ ...s, loading: false }));
      toast.error("Failed to load requests");
    }
  };

  const approve = async (gid, uid) => {
    try {
      await apiPost(`/api/groups/${gid}/requests/${uid}/approve`);
      toast.success("Approved");
      // refresh modal + cards
      const rows = await apiGet(`/api/groups/${gid}/requests`);
      setReqModal((s) => ({ ...s, items: rows || [] }));
      load();
    } catch {
      toast.error("Approve failed");
    }
  };

  const reject = async (gid, uid) => {
    try {
      await apiPost(`/api/groups/${gid}/requests/${uid}/reject`);
      toast.success("Rejected");
      const rows = await apiGet(`/api/groups/${gid}/requests`);
      setReqModal((s) => ({ ...s, items: rows || [] }));
      load();
    } catch {
      toast.error("Reject failed");
    }
  };

  return (
    <div style={{ padding: "24px 16px 40px" }}>
      <div style={headRow}>
        <h1 style={{ margin: 0, fontSize: 36, fontWeight: 900 }}>My groups</h1>
        <div style={{ display: "flex", gap: 10 }}>
          <button style={btnPill} onClick={() => navigate("/browse")}>
            🔎 Browse groups
          </button>
          <button style={btnPrimary} onClick={() => navigate("/create")}>
            + Create group
          </button>
        </div>
      </div>

      {loading ? (
        <div style={stateBox}>Loading…</div>
      ) : mine.length === 0 ? (
        <div style={stateBox}>You’re not in any groups yet.</div>
      ) : (
        <div style={listWrap}>
          {mine.map((g) => {
            // 🔐 robust owner detection (fallback if API didn’t send isOwner)
            const isOwner =
              g.isOwner ??
              (g.ownerId ? String(g.ownerId) === myId : false);

            // show pending count if API gave it; else try to infer
            const pending =
              typeof g.pendingCount === "number"
                ? g.pendingCount
                : Array.isArray(g.joinRequests)
                ? g.joinRequests.filter((r) => r.status === "pending").length
                : 0;

            return (
              <div key={g._id} style={card}>
                <div style={titleRow}>
                  <span style={dot} />
                  <div style={title}>{g.title}</div>
                </div>
                <div style={meta}>
                  {g.course} · {g.membersCount ?? g.members?.length ?? 0} members
                </div>
                {g.description ? <div style={desc}>{g.description}</div> : null}

                <div style={actions}>
                  <button style={btnTiny} onClick={() => navigate(`/group/${g._id}`)}>
                    Open
                  </button>

                  {isOwner ? (
                    <>
                      <button
                        style={pending > 0 ? btnPillBlue : btnPillMuted}
                        onClick={() => openRequests(g)}
                        title="Pending join requests"
                      >
                        Requests {pending ? `(${pending})` : ""}
                      </button>
                      {/* Owner cannot leave; only delete */}
                      <button style={btnDanger} onClick={() => del(g._id)}>
                        Delete
                      </button>
                    </>
                  ) : (
                    // Non-owners can leave; can’t delete
                    <button style={btnGhost} onClick={() => leave(g._id)}>
                      Leave
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Requests modal */}
      {reqModal.open && (
        <div
          style={modalBackdrop}
          onClick={() =>
            setReqModal({ open: false, groupId: null, title: "", items: [], loading: false })
          }
        >
          <div style={modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={modalHead}>
              <div style={{ fontWeight: 900, fontSize: 18 }}>
                Join requests · {reqModal.title}
              </div>
              <button
                style={btnGhost}
                onClick={() =>
                  setReqModal({ open: false, groupId: null, title: "", items: [], loading: false })
                }
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
                    <div>
                      <div style={{ fontWeight: 700 }}>{r.name || r.email}</div>
                      <div style={{ color: "#6b7280", fontSize: 12 }}>
                        {r.email} ·{" "}
                        {r.createdAt ? new Date(r.createdAt).toLocaleString() : ""}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button style={btnTiny} onClick={() => approve(reqModal.groupId, r.userId)}>
                        Approve
                      </button>
                      <button style={btnDanger} onClick={() => reject(reqModal.groupId, r.userId)}>
                        Reject
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---- styles ---- */
const headRow = {
  maxWidth: 1100,
  margin: "0 auto 18px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
};
const listWrap = {
  maxWidth: 1100,
  margin: "0 auto",
  display: "grid",
  gap: 16,
};
const stateBox = {
  background: "#fff",
  border: "1px solid #eef0f5",
  borderRadius: 14,
  color: "#6b7280",
  padding: 16,
};
const card = {
  width: 560,
  maxWidth: "100%",
  background: "#fff",
  border: "1px solid #EDF0F5",
  borderRadius: 18,
  boxShadow: "0px 18px 60px rgba(2, 6, 23, 0.06)",
  padding: 16,
};
const titleRow = { display: "flex", alignItems: "center", gap: 10 };
const dot = { width: 10, height: 10, borderRadius: "50%", background: "#5B7CFA", boxShadow: "0 0 0 4px #EEF2FF" };
const title = { fontWeight: 800, fontSize: 20 };
const meta = { color: "#6b7280", marginTop: 6 };
const desc = { marginTop: 10, color: "#374151" };
const actions = { display: "flex", gap: 8, marginTop: 12 };

const btnPrimary = {
  background: "linear-gradient(180deg,#5b7cfa,#4f46e5)",
  color: "#fff",
  border: 0,
  padding: "10px 14px",
  borderRadius: 12,
  fontWeight: 800,
  cursor: "pointer",
};
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
const btnPillMuted = {
  background: "#f1f5f9",
  color: "#6b7280",
  border: "1px solid #e5e7eb",
  padding: "8px 12px",
  borderRadius: 999,
  fontWeight: 800,
  fontSize: 12,
  cursor: "pointer",
};
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
