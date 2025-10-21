

// // frontend/src/pages/Meetings.jsx
// import { useEffect, useMemo, useState } from "react";
// import { toast } from "react-toastify";
// import api from "../lib/api";

// const cap = (s = "") => (s ? s[0].toUpperCase() + s.slice(1) : "");
// const fmt = (slot) => (slot ? `${cap(slot.day)} ${slot.from} - ${slot.to}` : "—");

// export default function Meetings() {
//   // who am I?
//   const me = useMemo(() => {
//     try {
//       return JSON.parse(localStorage.getItem("user") || "{}");
//     } catch {
//       return {};
//     }
//   }, []);
//   const myId = useMemo(
//     () => String(me?._id ?? me?.id ?? me?.userId ?? ""),
//     [me]
//   );

//   const [loading, setLoading] = useState(true);
//   const [rows, setRows] = useState([]);
//   const [savingId, setSavingId] = useState(null);

//   const load = async () => {
//     try {
//       setLoading(true);
//       const data = await api.get("/meetings/list");
//       const arr = Array.isArray(data?.data ?? data) ? (data.data ?? data) : [];

//       // newest first
//       arr.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

//       // ensure each has direction (prefer backend, else derive here)
//       const normalized = arr.map((r) => {
//         const dir =
//           r.direction ||
//           (String(r?.receiverId || "") === myId ? "incoming" : "outgoing");
//         return { ...r, direction: dir };
//       });

//       setRows(normalized);
//     } catch (e) {
//       console.error(e);
//       toast.error("Failed to load meeting requests");
//       setRows([]);
//     } finally {
//       setLoading(false);
//     }
//   };

//   useEffect(() => {
//     load();
//   }, [myId]);

//   const respond = async (id, action) => {
//     try {
//       setSavingId(id);
//       await api.post("/meetings/respond", { meeting_id: id, action }); // 'accepted' | 'rejected'
//       setRows((prev) =>
//         prev.map((m) => (m._id === id ? { ...m, status: action } : m))
//       );
//       toast.success(action === "accepted" ? "Accepted" : "Rejected");
//     } catch (e) {
//       console.error(e);
//       toast.error("Could not update request");
//     } finally {
//       setSavingId(null);
//     }
//   };

//   return (
//     <div style={pageWrap}>
//       <div style={container}>
//         <h2 style={pageTitle}>Meeting Requests</h2>

//         {loading ? (
//           <div style={loadingBox}>Loading…</div>
//         ) : rows.length === 0 ? (
//           <div style={emptyCard}>
//             <div style={emptyTitle}>No meeting requests yet</div>
//             <div style={emptyText}>
//               You’ll see incoming and outgoing requests here. Propose one from a
//               group’s member list.
//             </div>
//           </div>
//         ) : (
//           <div style={stack}>
//             {rows.map((m) => {
//               const canAct =
//                 m.direction === "incoming" && m.status === "pending";
//               return (
//                 <MeetingCard
//                   key={m._id}
//                   slot={m.slot}
//                   status={m.status}
//                   direction={m.direction}
//                   canAct={canAct}
//                   saving={savingId === m._id}
//                   onAccept={() => respond(m._id, "accepted")}
//                   onReject={() => respond(m._id, "rejected")}
//                 />
//               );
//             })}
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }

// /* ---------- presentational ---------- */
// function MeetingCard({
//   slot,
//   status,
//   direction,
//   canAct,
//   saving,
//   onAccept,
//   onReject,
// }) {
//   return (
//     <section style={card}>
//       <div style={rowBetween}>
//         <div style={leftCol}>
//           <div style={label}>Slot:</div>
//           <div style={strong}>{fmt(slot)}</div>
//           {direction === "outgoing" && (
//             <div style={{ color: "#6b7280", fontSize: 12 }}>You sent this request.</div>
//           )}
//         </div>

//         <div style={rightCol}>
//           <div style={label}>Status:</div>
//           <span
//             style={{
//               ...statusPill,
//               ...(status === "accepted"
//                 ? pillOk
//                 : status === "rejected"
//                 ? pillNo
//                 : pillPending),
//             }}
//           >
//             {status}
//           </span>
//         </div>
//       </div>

//       {canAct && (
//         <div style={actions}>
//           <button
//             disabled={saving}
//             onClick={onAccept}
//             style={{ ...btn, ...btnOk, opacity: saving ? 0.6 : 1 }}
//           >
//             Accept
//           </button>
//           <button
//             disabled={saving}
//             onClick={onReject}
//             style={{ ...btn, ...btnNo, opacity: saving ? 0.6 : 1 }}
//           >
//             Reject
//           </button>
//         </div>
//       )}
//     </section>
//   );
// }

// /* ---------- styles (theme-matched) ---------- */
// const pageWrap = {
//   padding: "32px 16px 72px",
//   minHeight: "calc(100vh - 80px)",
//   background: "linear-gradient(180deg,#f8f9ff 0%, #ffffff 100%)",
// };

// const container = {
//   width: "min(900px, 96vw)",
//   margin: "0 auto",
// };

// const pageTitle = {
//   margin: "8px 0 18px",
//   fontSize: 28,
//   lineHeight: 1.15,
//   fontWeight: 800,
//   color: "#1f2937",
// };

// const stack = { display: "grid", gap: 14 };

// const card = {
//   background: "linear-gradient(180deg,#ffffff,#fafaff)",
//   border: "1px solid #EEF0F5",
//   boxShadow: "0 12px 40px rgba(2,6,23,0.06)",
//   borderRadius: 16,
//   padding: 16,
// };

// const rowBetween = {
//   display: "flex",
//   justifyContent: "space-between",
//   alignItems: "flex-start",
//   gap: 12,
//   flexWrap: "wrap",
// };

// const leftCol = { display: "grid", gap: 4, minWidth: 240 };
// const rightCol = { display: "grid", gap: 4, textAlign: "right", minWidth: 140 };

// const label = { fontSize: 12, fontWeight: 800, color: "#6b7280", textTransform: "uppercase" };
// const strong = { fontSize: 16, fontWeight: 800, color: "#111827" };

// const statusPill = {
//   display: "inline-flex",
//   alignItems: "center",
//   justifyContent: "center",
//   padding: "4px 10px",
//   borderRadius: 999,
//   fontWeight: 800,
//   fontSize: 12,
//   border: "1px solid transparent",
//   textTransform: "lowercase",
// };
// const pillOk = { background: "#ECFDF5", borderColor: "#A7F3D0", color: "#065F46" };
// const pillNo = { background: "#FEF2F2", borderColor: "#FECACA", color: "#991B1B" };
// const pillPending = { background: "#FFFBEB", borderColor: "#FDE68A", color: "#92400E" };

// const actions = { marginTop: 14, display: "flex", gap: 10 };

// const btn = {
//   appearance: "none",
//   outline: 0,
//   border: 0,
//   padding: "10px 14px",
//   borderRadius: 10,
//   fontWeight: 800,
//   cursor: "pointer",
// };
// const btnOk = {
//   color: "#fff",
//   background: "linear-gradient(180deg,#34d399,#059669)",
//   border: "1px solid #10b981",
// };
// const btnNo = {
//   color: "#fff",
//   background: "linear-gradient(180deg,#f97373,#ef4444)",
//   border: "1px solid #ef4444",
// };

// const loadingBox = {
//   border: "1px dashed #e5e7eb",
//   borderRadius: 12,
//   padding: 16,
//   color: "#6b7280",
//   background: "#fafafa",
// };

// const emptyCard = {
//   background: "#fff",
//   border: "1px dashed #e5e7eb",
//   borderRadius: 16,
//   padding: 18,
//   boxShadow: "0 6px 24px rgba(2,6,23,0.04)",
// };
// const emptyTitle = { fontWeight: 800, color: "#111827", marginBottom: 6 };
// const emptyText = { color: "#6b7280" };


// frontend/src/pages/Meetings.jsx
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import api from "../lib/api";

const cap = (s = "") => (s ? s[0].toUpperCase() + s.slice(1) : "");
const fmt = (slot) => (slot ? `${cap(slot.day)} ${slot.from} - ${slot.to}` : "—");

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
      await api.post("/meetings/respond", { meeting_id: id, action });
      setRows((prev) => prev.map((m) => (m._id === id ? { ...m, status: action } : m)));
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
      setRows((prev) => prev.filter((m) => m._id !== id));
    } catch (e) {
      console.error(e);
      toast.error("Could not clear");
    } finally {
      setBusy(null);
    }
  };

  const clearAllNonPending = async () => {
    const clearables = rows.filter((r) => r.status !== "pending").map((r) => r._id);
    if (clearables.length === 0) return;
    try {
      setBusy("all");
      // Do them sequentially to keep it simple
      for (const id of clearables) {
        // ignore errors per item
        await api.post("/meetings/clear", { meeting_id: id }).catch(() => {});
      }
      await load();
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

/* ---------- styles: airy “invisible table” ---------- */
const pageWrap = {
  padding: "32px 16px 72px",
  minHeight: "calc(100vh - 80px)",
  background: "linear-gradient(180deg,#f8f9ff 0%, #ffffff 100%)",
};
const container = { width: "min(950px, 96vw)", margin: "0 auto" };

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
  gridTemplateColumns: "1fr 160px 120px 220px",
  fontSize: 12,
  fontWeight: 900,
  color: "#6b7280",
  padding: "0 8px",
};
const trow = {
  display: "grid",
  gridTemplateColumns: "1fr 160px 120px 220px",
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
