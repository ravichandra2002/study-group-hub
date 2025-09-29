// frontend/src/pages/GroupDetail.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
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

export default function GroupDetail() {
  const { gid } = useParams();
  const navigate = useNavigate();

  const me = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("user") || "{}"); } catch { return {}; }
  }, []);
  const myId = useMemo(
    () => String(me?._id ?? me?.id ?? me?.userId ?? ""),
    [me]
  );

  const [loading, setLoading] = useState(true);
  const [group, setGroup] = useState(null);

  // Members modal
  const [membersOpen, setMembersOpen] = useState(false);
  const [members, setMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const g = await apiGet(`/api/groups/${gid}`);
      setGroup(g);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load group");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [gid]);

  const isOwner = !!group?.isOwner;
  const amMember = group?.myJoinStatus === "member";
  const canSeeMembers = isOwner || amMember;
  const membersCount = group?.membersCount ?? group?.members?.length ?? 0;

  const leave = async () => {
    try {
      await apiPost(`/api/groups/leave/${gid}`);
      toast.success("Left group");
      navigate("/dashboard");
    } catch {
      toast.error("Could not leave group");
    }
  };


  const isSelf = (m) => {
    const mid = String(m?._id ?? m?.id ?? m?.userId ?? "");
    if (myId && mid && myId === mid) return true;
    if (m?.email && me?.email && m.email.toLowerCase() === me.email.toLowerCase()) return true;
    return false;
  };

  const openMembers = async () => {
    setMembersOpen(true);
    if (!canSeeMembers) {
      setMembers([]);
      return;
    }
    try {
      setMembersLoading(true);
      // always fetch the normalized list (has isOwner + email)
      const rows = await apiGet(`/api/groups/${gid}/members`);
      setMembers(Array.isArray(rows) ? rows : []);
    } catch {
      setMembers([]);
      toast.error("Could not load members");
    } finally {
      setMembersLoading(false);
    }
  };
  const closeMembers = () => { setMembersOpen(false); setMembers([]); };

  useEffect(() => {
    if (!membersOpen) return;
    const onKey = (e) => e.key === "Escape" && closeMembers();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [membersOpen]);

  if (loading) return <div style={{ padding: 24, color: "#667085" }}>Loading…</div>;
  if (!group)  return <div style={{ padding: 24, color: "#ef4444" }}>Group not found.</div>;

  return (
    <>
      <div style={pageWrap}>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
          <button style={chipLink} onClick={() => navigate("/dashboard")}>
            ← Back to dashboard
          </button>
        </div>

        {/* h1 weight = 800 */}
        <h1 style={h1}>{group.title}</h1>

        <div style={cardWide}>
          <div style={{ color: "#667085", marginBottom: 4 }}>
            {group.course} ·{" "}
            <button type="button" onClick={openMembers} style={membersLinkBtn}>
              {membersCount} {membersCount === 1 ? "member" : "members"}
            </button>
          </div>

          {group.description ? (
            <div style={{ color: "#111827", marginBottom: 12 }}>{group.description}</div>
          ) : (
            <div style={{ height: 4 }} />
          )}

          <div style={factsGrid}>
            <div style={factBox}>
              <div style={factLabel}>Your role</div>
              <div style={factValue}>{isOwner ? "Owner" : amMember ? "Member" : "Visitor"}</div>
            </div>

            <div style={factBox}>
              <div style={factLabel}>Created</div>
              <div style={factValue}>
                {group.createdAt ? new Date(group.createdAt).toLocaleString() : "—"}
              </div>
            </div>

            <div style={factBox}>
              <div style={factLabel}>Members</div>
              <div style={factValue}>{membersCount}</div>
            </div>

            <div style={factBox}>
              <div style={factLabel}>Status</div>
              <div style={factValue}>{group.isOpen ? "Open to join" : "Closed"}</div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            {(amMember || isOwner) && <button style={btnGhost} onClick={leave}>Leave group</button>}
            <button style={btnPill} onClick={() => navigate("/my-groups")}>Back to My groups</button>
          </div>

          <div style={{ marginTop: 22 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>About this course</div>
            <div style={aboutBox}>
              <b>{group.course || "Course"}</b>. This page will eventually show schedules, resources, and
              links for this study group.
            </div>
          </div>
        </div>
      </div>

      {/* Members modal */}
      {membersOpen && (
        <div style={backdrop} onClick={closeMembers}>
          <div role="dialog" aria-modal="true" style={modal} onClick={(e) => e.stopPropagation()}>
            <div style={modalHead}>
              <h3 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>
                Members · {group.title}
              </h3>
              <button style={modalX} onClick={closeMembers} aria-label="Close">✕</button>
            </div>

            {!canSeeMembers ? (
              <div style={{ padding: 12, color: "#6b7280" }}>
                Only group members can view the member list.
              </div>
            ) : membersLoading ? (
              <div style={{ padding: 12, color: "#6b7280" }}>Loading members…</div>
            ) : members.length === 0 ? (
              <div style={{ padding: 12, color: "#6b7280" }}>No members yet.</div>
            ) : (
              <ul style={memberList}>
                {members.map((m) => (
                  <li key={m._id || m.email} style={memberItem}>
                    <span style={dotSmall} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                        <div
                          style={{ fontWeight: 700, whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}
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

/* ===== styles ===== */
const pageWrap = { padding: "24px 16px 40px" };
const h1 = { margin: "0 0 10px", fontSize: 32, lineHeight: 1.15, fontWeight: 800 };

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

const cardWide = {
  width: "min(1100px, 96vw)",
  background: "#fff",
  borderRadius: 16,
  border: "1px solid #EEF0F5",
  boxShadow: "0 18px 60px rgba(2,6,23,0.06)",
  padding: 18,
};

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

const factsGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
  marginTop: 10,
};
const factBox = {
  border: "1px solid #EEF0F5",
  borderRadius: 12,
  padding: "12px 14px",
  background: "#fff",
};
const factLabel = { color: "#6b7280", fontSize: 12, marginBottom: 4 };
const factValue = { fontWeight: 700 };

const btnPill = {
  background: "#eef2ff",
  color: "#4f46e5",
  border: "1px solid #dbe2ff",
  padding: "10px 14px",
  borderRadius: 999,
  fontWeight: 800,
  cursor: "pointer",
};
const btnGhost = {
  background: "#fff",
  color: "#6b7280",
  border: "1px solid #e5e7eb",
  padding: "10px 14px",
  borderRadius: 10,
  fontWeight: 700,
  cursor: "pointer",
};

const aboutBox = {
  background: "#F8FAFF",
  border: "1px solid #EEF0F5",
  borderRadius: 12,
  padding: 14,
};

/* modal */
const backdrop = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
  zIndex: 50,
};
const modal = {
  width: "min(760px, 96vw)",
  background: "#fff",
  borderRadius: 18,
  border: "1px solid #EDF0F5",
  boxShadow: "0 18px 60px rgba(0,0,0,0.20)",
  padding: 16,
};
const modalHead = { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 };
const modalX = { appearance: "none", border: 0, background: "#f3f4f6", color: "#111827", width: 36, height: 36, borderRadius: 10, cursor: "pointer" };

const memberList = { listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 10, maxHeight: "60vh", overflow: "auto" };
const memberItem = { display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", border: "1px solid #eef0f5", borderRadius: 12, background: "#fff" };
const dotSmall = { width: 8, height: 8, borderRadius: "50%", background: "#4f46e5", boxShadow: "0 0 0 3px #eef2ff" };

/* chips */
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
