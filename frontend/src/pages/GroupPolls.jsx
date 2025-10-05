import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5050";

/* ---------------- API helpers ---------------- */
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

const MODE_LABEL = { either: "Either", online: "Online", oncampus: "On-Campus" };
const normalizeMode = (v) => {
  const s = String(v || "").toLowerCase().trim();
  if (["on-campus", "campus", "offline"].includes(s)) return "oncampus";
  if (s === "online") return "online";
  return "either";
};
const fmtTime = (iso) =>
  iso ? new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "—";

/* ================== PAGE ================== */
export default function GroupPolls() {
  const { gid } = useParams();
  const navigate = useNavigate();

  const me = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("user") || "{}"); } catch { return {}; }
  }, []);

  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);

  const [pollsLoading, setPollsLoading] = useState(false);
  const [polls, setPolls] = useState([]);

  // create poll modal
  const [pollOpen, setPollOpen] = useState(false);
  const [pollTitle, setPollTitle] = useState("");
  const [pollMode, setPollMode] = useState("either");
  const [slot1, setSlot1] = useState("");
  const [slot2, setSlot2] = useState("");
  const [slot3, setSlot3] = useState("");
  const [creating, setCreating] = useState(false);

  // vote modal
  const [voteOpen, setVoteOpen] = useState(false);
  const [activePoll, setActivePoll] = useState(null);
  const [selectedSlotId, setSelectedSlotId] = useState("");
  const [submittingVote, setSubmittingVote] = useState(false);

  // confirm modal (generic)
  const [confirmState, setConfirmState] = useState({ open: false, title: "", message: "", onConfirm: null });
  const askConfirm = (title, message, onConfirm) => setConfirmState({ open: true, title, message, onConfirm });
  const closeConfirm = () => setConfirmState({ open: false, title: "", message: "", onConfirm: null });

  const loadHeader = async () => {
    try {
      setLoading(true);
      const g = await apiGet(`/api/groups/${gid}`);
      setGroup(g);
    } catch {
      toast.error("Failed to load group");
    } finally {
      setLoading(false);
    }
  };

  const loadPolls = async () => {
    try {
      setPollsLoading(true);
      const rows = await apiGet(`/api/groups/${gid}/meeting-polls`);
      setPolls(Array.isArray(rows) ? rows : []);
    } catch {
      setPolls([]);
    } finally {
      setPollsLoading(false);
    }
  };

  useEffect(() => {
    loadHeader();
    loadPolls();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gid]);

  const backToGroup = () => navigate(`/group/${gid}`);

  /* --------- Create poll --------- */
  const openCreatePoll = () => {
    setPollTitle("");
    setPollMode("either");
    setSlot1("");
    setSlot2("");
    setSlot3("");
    setPollOpen(true);
  };
  const closeCreatePoll = () => setPollOpen(false);

  const createPoll = async () => {
    const raw = [slot1, slot2, slot3].filter(Boolean);
    const slots = raw
      .map((v) => {
        const d = new Date(v);
        return isNaN(d.getTime()) ? null : d.toISOString();
      })
      .filter(Boolean);
    if (!pollTitle.trim()) return toast.warn("Give the poll a title.");
    if (slots.length === 0) return toast.warn("Add at least one time slot.");

    try {
      setCreating(true);
      await apiPost(`/api/groups/${gid}/meeting-polls`, {
        title: pollTitle.trim(),
        mode: pollMode,
        slots,
      });
      toast.success("Poll created");
      setPollOpen(false);
      loadPolls();
    } catch {
      toast.error("Could not create poll");
    } finally {
      setCreating(false);
    }
  };

  /* --------- Vote --------- */
  const openVote = (poll) => {
    setActivePoll(poll);
    const voted = (poll?.slots || []).find((s) => !!s.voted);
    setSelectedSlotId(voted?.slotId || "");
    setVoteOpen(true);
  };
  const closeVote = () => {
    setActivePoll(null);
    setSelectedSlotId("");
    setVoteOpen(false);
  };
  const submitVote = async () => {
    if (!activePoll) return;
    if (!selectedSlotId) return toast.warn("Pick one time slot.");

    askConfirm("Save vote?", "Confirm your selected meeting time.", async () => {
      try {
        setSubmittingVote(true);
        await apiPost(
          `/api/groups/${gid}/meeting-polls/${activePoll.id || activePoll._id}/vote`,
          { slotId: selectedSlotId }
        );
        toast.success("Vote saved");
        closeVote();
        loadPolls();
      } catch {
        toast.error("Could not save vote");
      } finally {
        setSubmittingVote(false);
        closeConfirm();
      }
    });
  };

  if (loading) return <div style={{ padding: 24, color: "#667085" }}>Loading…</div>;
  if (!group)  return <div style={{ padding: 24, color: "#ef4444" }}>Group not found.</div>;

  return (
    <>
      <div style={pageWrap}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <button style={chipLink} onClick={backToGroup}>← Back to group</button>
          <button style={btnPrimary} onClick={openCreatePoll}>+ Create poll</button>
        </div>

        <h1 style={h1}>Meeting polls · <span style={{ color: "#4f46e5" }}>{group.title}</span></h1>
        <div style={{ color: "#6b7280", marginBottom: 12 }}>{group.course} — {group.description || "Study group"}</div>

        <div style={cardWide}>
          {pollsLoading ? (
            <div style={{ color: "#6b7280" }}>Loading polls…</div>
          ) : polls.length === 0 ? (
            <div style={emptyBox}>
              <div style={{ fontWeight: 800, marginBottom: 6 }}>No polls yet</div>
              <div style={{ color: "#6b7280", marginBottom: 12 }}>
                Create a quick poll with a few time slots so members can vote.
              </div>
              <button style={btnPrimary} onClick={openCreatePoll}>+ Create poll</button>
            </div>
          ) : (
            <div style={pollList}>
              {polls.map((p) => {
                const youVoted = (p?.slots || []).some((s) => !!s.voted);
                return (
                  <div key={p.id || p._id} style={pollCard}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                        <div style={{ fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                             title={p.title}>
                          {p.title}
                        </div>
                        <span style={modeChip}>{MODE_LABEL[normalizeMode(p.mode)] || "Either"}</span>
                        {youVoted && <span style={youVotedChip}>You voted</span>}
                      </div>
                      <div style={{ color: "#6b7280", fontSize: 12 }}>
                        {fmtTime(p.createdAt)}
                      </div>
                    </div>

                    <div style={slotRow}>
                      {(p.slots || []).map((s) => {
                        const id = s.slotId || s.id || s._id;
                        return (
                          <div key={id} style={slotChip} title={fmtTime(s.at)}>
                            <div style={{ fontWeight: 700 }}>{fmtTime(s.at)}</div>
                            <div style={{ color: "#6b7280", fontSize: 12 }}>{Number(s.count || 0)} votes</div>
                          </div>
                        );
                      })}
                    </div>

                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      <button style={btnGhost} onClick={() => openVote(p)}>Vote</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Vote modal */}
      {voteOpen && activePoll && (
        <div style={backdrop} onClick={closeVote}>
          <div role="dialog" aria-modal="true" style={modal} onClick={(e) => e.stopPropagation()}>
            <div style={modalHead}>
              <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Vote · {activePoll.title}</h3>
              <button style={modalX} onClick={closeVote} aria-label="Close">✕</button>
            </div>

            <div style={{ marginBottom: 8, color: "#6b7280" }}>
              Mode: <b>{MODE_LABEL[normalizeMode(activePoll.mode)] || "Either"}</b>
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              {(activePoll.slots || []).map((s) => {
                const sid = s.slotId || s.id || s._id;
                const checked = selectedSlotId === sid;
                return (
                  <label key={sid} style={voteRow}>
                    <input
                      type="radio"
                      name="meeting-slot"
                      checked={checked}
                      onChange={() => setSelectedSlotId(sid)}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700 }}>{fmtTime(s.at)}</div>
                      <div style={{ color: "#6b7280", fontSize: 12 }}>{Number(s.count || 0)} votes</div>
                    </div>
                  </label>
                );
              })}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
              <button style={btnGhost} onClick={closeVote}>Cancel</button>
              <button
                style={{ ...btnPrimary, opacity: submittingVote ? 0.7 : 1, pointerEvents: submittingVote ? "none" : "auto" }}
                onClick={submitVote}
              >
                {submittingVote ? "Saving…" : "Save vote"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create poll modal */}
      {pollOpen && (
        <div style={backdrop} onClick={closeCreatePoll}>
          <div role="dialog" aria-modal="true" style={modal} onClick={(e) => e.stopPropagation()}>
            <div style={modalHead}>
              <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Create meeting poll</h3>
              <button style={modalX} onClick={closeCreatePoll} aria-label="Close">✕</button>
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              <label style={fld}>
                <div style={lbl}>Title</div>
                <input value={pollTitle} onChange={(e) => setPollTitle(e.target.value)} style={inp} placeholder="e.g., Sunday catch-up" />
              </label>

              <label style={fld}>
                <div style={lbl}>Mode</div>
                <select value={pollMode} onChange={(e) => setPollMode(e.target.value)} style={inp}>
                  <option value="either">Either</option>
                  <option value="online">Online</option>
                  <option value="oncampus">On-Campus</option>
                </select>
              </label>

              <div style={{ ...lbl, marginTop: 6 }}>Time slots</div>
              <input type="datetime-local" value={slot1} onChange={(e) => setSlot1(e.target.value)} style={inp} />
              <input type="datetime-local" value={slot2} onChange={(e) => setSlot2(e.target.value)} style={inp} />
              <input type="datetime-local" value={slot3} onChange={(e) => setSlot3(e.target.value)} style={inp} />

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 6 }}>
                <button style={btnGhost} onClick={closeCreatePoll}>Cancel</button>
                <button
                  style={{ ...btnPrimary, opacity: creating ? 0.7 : 1, pointerEvents: creating ? "none" : "auto" }}
                  onClick={createPoll}
                >
                  {creating ? "Creating…" : "Create poll"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Global confirm modal */}
      <ConfirmModal
        open={confirmState.open}
        title={confirmState.title}
        message={confirmState.message}
        onCancel={closeConfirm}
        onConfirm={confirmState.onConfirm}
      />
    </>
  );
}

/* ================= styles ================= */
const pageWrap = { padding: "24px 16px 40px" };
const h1 = { margin: "8px 0 10px", fontSize: 28, lineHeight: 1.15, fontWeight: 800 };

const cardWide = { width: "min(1100px, 96vw)", background: "#fff", borderRadius: 16, border: "1px solid #EEF0F5", boxShadow: "0 18px 60px rgba(2,6,23,0.06)", padding: 18 };
const chipLink = { background: "#F4F6FF", color: "#4f46e5", border: "1px solid #E3E8FF", padding: "8px 12px", borderRadius: 999, fontWeight: 700, fontSize: 14, cursor: "pointer" };
const btnGhost = { background: "#fff", color: "#6b7280", border: "1px solid #e5e7eb", padding: "10px 14px", borderRadius: 10, fontWeight: 700, cursor: "pointer" };
const btnPrimary = { background: "linear-gradient(180deg,#5b7cfa,#4f46e5)", color: "#fff", border: 0, padding: "10px 14px", borderRadius: 10, fontWeight: 800, cursor: "pointer" };

const pollList = { display: "grid", gap: 10 };
const pollCard = { border: "1px solid #eef0f5", borderRadius: 12, padding: 12, background: "#fff", display: "grid", gap: 10 };
const modeChip = { background: "#eef2ff", color: "#4f46e5", border: "1px solid #dbe2ff", padding: "2px 8px", borderRadius: 999, fontWeight: 700, fontSize: 12 };
const youVotedChip  = { background: "#ecfdf5", color: "#065f46", border: "1px solid #a7f3d0", padding: "2px 8px", borderRadius: 999, fontWeight: 700, fontSize: 12 };
const slotRow  = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 8 };
const slotChip = { border: "1px solid #e5e7eb", borderRadius: 10, padding: "8px 10px", background: "#fafafa" };

const emptyBox = { border: "1px dashed #e5e7eb", borderRadius: 12, padding: 18, textAlign: "center", background: "#fafafa" };

/* modal (shared) */
const backdrop = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 50 };
const modal    = { width: "min(760px, 96vw)", background: "#fff", borderRadius: 18, border: "1px solid #EDF0F5", boxShadow: "0 18px 60px rgba(0,0,0,0.20)", padding: 16 };
const modalHead= { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 };
const modalX   = { appearance: "none", border: 0, background: "#f3f4f6", color: "#111827", width: 36, height: 36, borderRadius: 10, cursor: "pointer" };
const fld = { display: "grid", gap: 6 };
const lbl = { fontWeight: 700, color: "#374151" };
const inp = { border: "1px solid #E5E7EB", borderRadius: 10, padding: "10px 12px", background: "#fff", fontWeight: 600 };
const voteRow = { display: "flex", alignItems: "center", gap: 10, border: "1px solid #e5e7eb", borderRadius: 10, padding: "8px 10px", background: "#fafafa" };

/* ================= Confirm Modal ================= */
function ConfirmModal({ open, title, message, onCancel, onConfirm }) {
  if (!open) return null;
  return (
    <div style={backdrop} onClick={onCancel}>
      <div role="dialog" aria-modal="true" style={modal} onClick={(e) => e.stopPropagation()}>
        <div style={modalHead}>
          <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>{title || "Are you sure?"}</h3>
          <button style={modalX} onClick={onCancel} aria-label="Close">✕</button>
        </div>
        <div style={{ color: "#374151", marginBottom: 12 }}>{message || ""}</div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button style={btnGhost} onClick={onCancel}>Cancel</button>
          <button style={btnPrimary} onClick={() => onConfirm && onConfirm()}>Confirm</button>
        </div>
      </div>
    </div>
  );
}
