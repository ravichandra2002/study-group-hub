


import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import api from "../lib/api";

const cap = (s = "") => (s ? s[0].toUpperCase() + s.slice(1) : "");
const fmt = (slot) =>
  slot
    ? `${cap(slot.day)}${slot.date ? " " + slot.date : ""} ${slot.from} - ${slot.to}`
    : "—";

export default function Meetings() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(null); // meeting id being updated

  const load = async () => {
    try {
      setLoading(true);
      const data = await api.get("/meetings/list");
      const arr = Array.isArray(data?.data ?? data) ? (data.data ?? data) : [];
      arr.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setRows(arr);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load meeting requests");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const respond = async (id, action) => {
    try {
      setBusy(id);
      // backend now returns { ok, meeting }
      const res = await api.post("/meetings/respond", { meeting_id: id, action });
      const updated = res.meeting;
      setRows((prev) =>
        prev.map((m) =>
          m._id === id
            ? {
                ...m,
                status: updated?.status || action,
                meetingLink: updated?.meetingLink ?? m.meetingLink,
                slot: updated?.slot ?? m.slot,
              }
            : m
        )
      );
      toast.success(action === "accepted" ? "Accepted" : "Rejected");
    } catch (e) {
      console.error(e);
      toast.error("Could not update request");
    } finally {
      setBusy(null);
    }
  };

const clearOne = async (id) => {
  try {
    setBusy(id);
    await api.post("/meetings/clear", { meeting_id: id });
    // Remove it from local state so UI updates instantly
    setRows((prev) => prev.filter((m) => m._id !== id));
    toast.success("Cleared from your list");
  } catch (e) {
    console.error(e);
    toast.error("Could not clear meeting");
  } finally {
    setBusy(null);
  }
};


const clearAllNonPending = async () => {
  const clearables = rows.filter((r) => r.status !== "pending").map((r) => r._id);
  if (clearables.length === 0) return;
  try {
    setBusy("all");
    for (const id of clearables) {
      await api.post("/meetings/clear", { meeting_id: id }).catch(() => {});
    }
    setRows((prev) => prev.filter((m) => m.status === "pending"));
    toast.success("Cleared finished meetings");
  } catch (e) {
    toast.error("Could not clear some meetings");
  } finally {
    setBusy(null);
  }
};


  const anyNonPending = rows.some((r) => r.status !== "pending");

  return (
    <div style={pageWrap}>
      <div style={container}>
        <div style={headerRow}>
          <h2 style={pageTitle}>Meeting Requests</h2>
          <button
            style={{ ...btnGhost, opacity: anyNonPending ? 1 : 0.5, pointerEvents: anyNonPending ? "auto" : "none" }}
            onClick={clearAllNonPending}
          >
            Clear all finished
          </button>
        </div>

        <div style={table}>
          <div style={thead}>
            <div>Slot</div>
            <div>Status</div>
            <div>Role</div>
            <div>Link</div>
            <div style={{ textAlign: "right" }}>Actions</div>
          </div>

          {loading ? (
            <div style={loadingBox}>Loading…</div>
          ) : rows.length === 0 ? (
            <div style={emptyCard}>
              <div style={emptyTitle}>No meeting requests</div>
              <div style={emptyText}>You’ll see incoming and outgoing requests here.</div>
            </div>
          ) : (
            rows.map((m) => (
              <div key={m._id} style={trow}>
                <div style={cellStrong}>{fmt(m.slot)}</div>

                <div>
                  <span
                    style={{
                      ...statusPill,
                      ...(m.status === "accepted"
                        ? pillOk
                        : m.status === "rejected"
                        ? pillNo
                        : pillPending),
                    }}
                  >
                    {m.status}
                  </span>
                </div>

                <div style={muted}>{m.role}</div>

                <div>
                  {m.status === "accepted" && m.meetingLink ? (
                    <a href={m.meetingLink} target="_blank" rel="noreferrer">
                      Join
                    </a>
                  ) : (
                    <span style={{ color: "#9ca3af" }}>—</span>
                  )}
                </div>

                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  {m.role === "received" && m.status === "pending" ? (
                    <>
                      <button
                        disabled={busy === m._id}
                        onClick={() => respond(m._id, "accepted")}
                        style={{ ...btn, ...btnOk, opacity: busy === m._id ? 0.6 : 1 }}
                      >
                        Accept
                      </button>
                      <button
                        disabled={busy === m._id}
                        onClick={() => respond(m._id, "rejected")}
                        style={{ ...btn, ...btnNo, opacity: busy === m._id ? 0.6 : 1 }}
                      >
                        Reject
                      </button>
                    </>
                  ) : null}

                  <button
                    disabled={busy === m._id}
                    onClick={() => clearOne(m._id)}
                    style={{ ...btn, ...btnGhost, opacity: busy === m._id ? 0.6 : 1 }}
                    title="Remove from my list"
                  >
                    Clear
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}


const pageWrap = {
  padding: "32px 16px 72px",
  minHeight: "calc(100vh - 80px)",
  background: "linear-gradient(180deg,#f8f9ff 0%, #ffffff 100%)",
};
const container = { width: "min(1100px, 96vw)", margin: "0 auto" };

const headerRow = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
};
const pageTitle = {
  margin: "8px 0 18px",
  fontSize: 28,
  lineHeight: 1.15,
  fontWeight: 800,
  color: "#1f2937",
};

const table = { display: "grid", gap: 10 };
const thead = {
  display: "grid",
  gridTemplateColumns: "1fr 140px 120px 120px 220px",
  fontSize: 12,
  fontWeight: 900,
  color: "#6b7280",
  padding: "0 8px",
};
const trow = {
  display: "grid",
  gridTemplateColumns: "1fr 140px 120px 120px 220px",
  alignItems: "center",
  gap: 8,
  background: "linear-gradient(180deg,#ffffff,#fafaff)",
  border: "1px solid #EEF0F5",
  boxShadow: "0 12px 40px rgba(2,6,23,0.06)",
  borderRadius: 16,
  padding: "12px 14px",
};
const cellStrong = { fontSize: 16, fontWeight: 800, color: "#111827" };
const muted = { color: "#6b7280" };

const statusPill = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "4px 10px",
  borderRadius: 999,
  fontWeight: 800,
  fontSize: 12,
  border: "1px solid transparent",
  textTransform: "lowercase",
};
const pillOk = { background: "#ECFDF5", borderColor: "#A7F3D0", color: "#065F46" };
const pillNo = { background: "#FEF2F2", borderColor: "#FECACA", color: "#991B1B" };
const pillPending = { background: "#FFFBEB", borderColor: "#FDE68A", color: "#92400E" };

const btn = {
  appearance: "none",
  outline: 0,
  border: 0,
  padding: "10px 14px",
  borderRadius: 10,
  fontWeight: 800,
  cursor: "pointer",
};
const btnOk = { color: "#fff", background: "linear-gradient(180deg,#34d399,#059669)", border: "1px solid #10b981" };
const btnNo = { color: "#fff", background: "linear-gradient(180deg,#f97373,#ef4444)", border: "1px solid #ef4444" };
const btnGhost = {
  background: "#fff",
  color: "#6b7280",
  border: "1px solid #e5e7eb",
  padding: "10px 14px",
  borderRadius: 10,
  fontWeight: 800,
  cursor: "pointer",
};

const loadingBox = { border: "1px dashed #e5e7eb", borderRadius: 12, padding: 16, color: "#6b7280", background: "#fafafa" };
const emptyCard = { background: "#fff", border: "1px dashed #e5e7eb", borderRadius: 16, padding: 18, boxShadow: "0 6px 24px rgba(2,6,23,0.04)" };
const emptyTitle = { fontWeight: 800, color: "#111827", marginBottom: 6 };
const emptyText = { color: "#6b7280" };
