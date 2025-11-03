// import { useEffect, useState, useMemo } from "react";
// import { toast } from "react-toastify";

// const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5050";

// async function apiGet(path) {
//   const res = await fetch(`${API_BASE}${path}`, {
//     headers: { Authorization: `Bearer ${localStorage.getItem("token") || ""}` },
//   });
//   if (!res.ok) throw new Error(await res.text());
//   return res.json();
// }
// async function apiPost(path, body) {
//   const res = await fetch(`${API_BASE}${path}`, {
//     method: "POST",
//     headers: {
//       "Content-Type": "application/json",
//       Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
//     },
//     body: JSON.stringify(body),
//   });
//   if (!res.ok) throw new Error(await res.text());
//   return res.json();
// }

// const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];

// const weekdayShort = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
// const monthShort = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// const niceDate = (yyyy_mm_dd) => {
//   if (!yyyy_mm_dd) return "";
//   const [y,m,d] = yyyy_mm_dd.split("-").map(Number);
//   if (!y || !m || !d) return "";
//   const dt = new Date(y, m - 1, d);
//   return `${weekdayShort[dt.getDay()]}, ${monthShort[dt.getMonth()]} ${dt.getDate()} ${y}`;
// };
// const weekdayFromISO = (yyyy_mm_dd) => {
//   if (!yyyy_mm_dd) return "";
//   const [y,m,d] = yyyy_mm_dd.split("-").map(Number);
//   if (!y || !m || !d) return "";
//   const dt = new Date(y, m - 1, d);
//   // Map JS Sunday(0)…Saturday(6) to our DAYS order Monday…Sunday
//   return DAYS[(dt.getDay() + 6) % 7] || "";
// };

// export default function Availability() {
//   const [day, setDay] = useState("");
//   const [date, setDate] = useState("");     // REQUIRED
//   const [from, setFrom] = useState("");
//   const [to, setTo] = useState("");
//   const [saving, setSaving] = useState(false);
//   const [rows, setRows] = useState([]);
//   const [loading, setLoading] = useState(true);

//   const canSave = Boolean(date) && Boolean(from) && Boolean(to);

//   // Auto-derive weekday when date changes
//   useEffect(() => {
//     if (date) setDay(weekdayFromISO(date));
//   }, [date]);

//   // --- FIX 1: group by weekday; fall back to weekday derived from date ---
//   const grouped = useMemo(() => {
//     const map = new Map();
//     for (const r of rows) {
//       const key = r.day || (r.date ? weekdayFromISO(r.date) : "Other");
//       if (!map.has(key)) map.set(key, []);
//       map.get(key).push(r);
//     }
//     const ordered = DAYS.filter((d) => map.has(d)).map((d) => [d, map.get(d)]);
//     for (const [k, v] of map.entries()) {
//       if (!DAYS.includes(k)) ordered.push([k, v]);
//     }
//     return ordered;
//   }, [rows]);

//   const load = async () => {
//     try {
//       setLoading(true);
//       const data = await apiGet("/api/availability/list");
//       const arr = Array.isArray(data) ? data : [];
//       // newest first (createdAt from backend)
//       arr.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
//       setRows(arr);
//     } catch (e) {
//       console.error(e);
//       toast.error("Could not load availability");
//       setRows([]);
//     } finally {
//       setLoading(false);
//     }
//   };

//   useEffect(() => { load(); }, []);

//   const validTimeRange = (from, to) => {
//     const [fh,fm] = from.split(":").map(Number);
//     const [th,tm] = to.split(":").map(Number);
//     if (Number.isNaN(fh) || Number.isNaN(th)) return false;
//     return th*60 + tm > fh*60 + fm;
//   };

//   const save = async () => {
//     if (!canSave || saving) return;
//     if (!validTimeRange(from, to)) {
//       toast.error("End time must be after start time");
//       return;
//     }
//     try {
//       setSaving(true);
//       await apiPost("/api/availability/add", {
//         date,
//         day: day || weekdayFromISO(date),
//         from,
//         to,
//       });
//       setDay(""); setDate(""); setFrom(""); setTo("");
//       await load();
//       toast.success("Saved");
//     } catch (e) {
//       console.error(e);
//       toast.error("Failed to save slot");
//     } finally {
//       setSaving(false);
//     }
//   };

//   return (
//     <div style={pageWrap}>
//       <div style={container}>
//         <h2 style={title}>Your Availability</h2>

//         {/* Form */}
//         <div style={card}>
//           <label style={label}>
//             Exact date <span style={{color:"#ef4444"}}>(required)</span>
//             <input
//               type="date"
//               value={date}
//               onChange={(e) => setDate(e.target.value)}
//               style={input}
//               required
//             />
//             {date ? (
//               <div style={{fontSize:12, color:"#6b7280"}}>
//                 This is a <strong>{weekdayFromISO(date)}</strong>.
//               </div>
//             ) : null}
//           </label>

//           <div style={row2}>
//             <label style={label}>
//               From
//               <input type="time" step="900" value={from} onChange={(e) => setFrom(e.target.value)} style={input} required />
//             </label>
//             <label style={label}>
//               To
//               <input type="time" step="900" value={to} onChange={(e) => setTo(e.target.value)} style={input} required />
//             </label>
//           </div>

//           <button
//             onClick={save}
//             disabled={!canSave || saving}
//             style={{ ...btnPrimary, opacity: !canSave || saving ? 0.6 : 1 }}
//           >
//             {saving ? "Saving…" : "Save Slot"}
//           </button>

//           <div style={{fontSize:12, color:"#6b7280"}}>
//             Date is mandatory. The weekday will be auto-detected.
//           </div>
//         </div>

//         {/* List */}
//         <h3 style={subhead}>Saved Slots</h3>
//         {loading ? (
//           <div style={muted}>Loading…</div>
//         ) : rows.length === 0 ? (
//           <div style={muted}>No availability set yet.</div>
//         ) : (
//           <div style={{ display: "grid", gap: 14 }}>
//             {grouped.map(([section, items]) => (
//               <section key={section} style={daySection}>
//                 <div style={dayHeader}>{section}</div>
//                 <div style={chips}>
//                   {items.map((r) => {
//                     // --- FIX 2: always include the date in the label if present ---
//                     const parts = [];
//                     // show detected weekday in chip (matches section)
//                     const chipDay = r.day || (r.date ? weekdayFromISO(r.date) : "");
//                     if (chipDay) parts.push(chipDay);
//                     if (r.date) parts.push(niceDate(r.date)); // Tue, Oct 28 2025
//                     parts.push(`${r.from}–${r.to}`);
//                     const label = parts.join(" • ");

//                     return (
//                       <span key={r._id} title={label} style={chip}>
//                         <span style={dot} />
//                         {label}
//                       </span>
//                     );
//                   })}
//                 </div>
//               </section>
//             ))}
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }

// /* --------- styles --------- */
// const pageWrap = {
//   padding: "32px 16px 72px",
//   minHeight: "calc(100vh - 80px)",
//   background: "linear-gradient(180deg,#f8f9ff 0%, #ffffff 100%)",
// };
// const container = { width: "min(720px, 96vw)", margin: "0 auto" };
// const title = { margin: "8px 0 16px", fontSize: 28, fontWeight: 800, color: "#111827" };
// const subhead = { marginTop: 20, marginBottom: 8, fontSize: 16, fontWeight: 900 };
// const card = {
//   display: "grid",
//   gap: 12,
//   background: "#fff",
//   border: "1px solid #EEF0F5",
//   borderRadius: 14,
//   padding: 16,
//   boxShadow: "0 6px 24px rgba(2,6,23,0.04)",
// };
// const label = { display: "grid", gap: 6, fontSize: 13, fontWeight: 800, color: "#6b7280" };
// const input = {
//   height: 40,
//   borderRadius: 12,
//   border: "1px solid #e5e7eb",
//   padding: "0 12px",
//   font: "inherit",
//   outline: "none",
// };
// const row2 = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 };
// const btnPrimary = {
//   height: 44,
//   background: "linear-gradient(180deg,#5b7cfa,#4f46e5)",
//   color: "#fff",
//   border: 0,
//   borderRadius: 12,
//   fontWeight: 800,
//   cursor: "pointer",
// };
// const muted = {
//   color: "#6b7280",
//   border: "1px dashed #e5e7eb",
//   borderRadius: 12,
//   padding: 12,
//   background: "#fafafa",
// };
// const daySection = {
//   background: "#fff",
//   border: "1px solid #EEF0F5",
//   borderRadius: 14,
//   padding: 12,
//   boxShadow: "0 4px 18px rgba(2,6,23,0.04)",
// };
// const dayHeader = { fontWeight: 900, fontSize: 13, color: "#4f46e5", marginBottom: 8 };
// const chips = { display: "flex", flexWrap: "wrap", gap: 8 };
// const chip = {
//   display: "inline-flex",
//   alignItems: "center",
//   gap: 8,
//   background: "#F4F6FF",
//   border: "1px solid #E3E8FF",
//   color: "#4f46e5",
//   padding: "6px 10px",
//   borderRadius: 999,
//   fontWeight: 800,
//   fontSize: 12,
// };
// const dot = {
//   width: 8,
//   height: 8,
//   borderRadius: "50%",
//   background: "linear-gradient(180deg,#38BDF8,#0EA5E9)",
//   boxShadow: "0 0 0 3px #DFF5FF",
// };

// /* mobile tweak */
// const media = window.matchMedia?.("(max-width: 600px)");
// if (media?.matches) {
//   row2.gridTemplateColumns = "1fr";
// }

import { useEffect, useState, useMemo } from "react";
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
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const weekdayShort = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const monthShort = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const niceDate = (yyyy_mm_dd) => {
  if (!yyyy_mm_dd) return "";
  const [y,m,d] = yyyy_mm_dd.split("-").map(Number);
  if (!y || !m || !d) return "";
  const dt = new Date(y, m - 1, d);
  return `${weekdayShort[dt.getDay()]}, ${monthShort[dt.getMonth()]} ${dt.getDate()} ${y}`;
};
const weekdayFromISO = (yyyy_mm_dd) => {
  if (!yyyy_mm_dd) return "";
  const [y,m,d] = yyyy_mm_dd.split("-").map(Number);
  if (!y || !m || !d) return "";
  const dt = new Date(y, m - 1, d);
  return DAYS[(dt.getDay() + 6) % 7] || "";
};
const isPastDateISO = (iso) => {
  if (!iso) return false;
  const today = new Date(); today.setHours(0,0,0,0);
  const dd = new Date(iso + "T00:00:00");
  return dd < today;
};

export default function Availability() {
  const [day, setDay] = useState("");
  const [date, setDate] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const canSave = Boolean(date) && Boolean(from) && Boolean(to);

  useEffect(() => {
    if (date) setDay(weekdayFromISO(date));
  }, [date]);

  const grouped = useMemo(() => {
    const map = new Map();
    for (const r of rows) {
      const key = r.date ? "Specific date" : (r.day || "Other");
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(r);
    }
    const ordered = [];
    if (map.has("Specific date")) ordered.push(["Specific date", map.get("Specific date")]);
    for (const d of DAYS) {
      if (map.has(d)) ordered.push([d, map.get(d)]);
    }
    for (const [k, v] of map.entries()) {
      if (k !== "Specific date" && !DAYS.includes(k)) ordered.push([k, v]);
    }
    return ordered;
  }, [rows]);

  const load = async () => {
    try {
      setLoading(true);
      // default: future only
      const data = await apiGet("/api/availability/list");
      const arr = Array.isArray(data) ? data : [];
      arr.sort((a,b) => new Date(a.date) - new Date(b.date) || a.from.localeCompare(b.from));
      setRows(arr);
    } catch (e) {
      console.error(e);
      toast.error("Could not load availability");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const validTimeRange = (from, to) => {
    const [fh,fm] = from.split(":").map(Number);
    const [th,tm] = to.split(":").map(Number);
    if (Number.isNaN(fh) || Number.isNaN(th)) return false;
    return th*60 + tm > fh*60 + fm;
  };

  const save = async () => {
    if (!canSave || saving) return;
    if (!validTimeRange(from, to)) {
      toast.error("End time must be after start time");
      return;
    }
    if (isPastDateISO(date)) {
      toast.error("Date is in the past");
      return;
    }
    try {
      setSaving(true);
      await apiPost("/api/availability/add", {
        date,
        day: day || weekdayFromISO(date),
        from,
        to,
      });
      setDay("");
      setDate("");
      setFrom("");
      setTo("");
      await load();
      toast.success("Saved");
    } catch (e) {
      console.error(e);
      toast.error("Failed to save slot");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={pageWrap}>
      <div style={container}>
        <h2 style={title}>Your Availability</h2>

        {/* Form */}
        <div style={card}>
          <label style={label}>
            Exact date <span style={{color:"#ef4444"}}>(required)</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={input}
              required
              min={new Date().toISOString().slice(0,10)}
            />
            {date ? (
              <div style={{fontSize:12, color:"#6b7280"}}>
                This is a <strong>{weekdayFromISO(date)}</strong>.
              </div>
            ) : null}
          </label>

          <div style={row2}>
            <label style={label}>
              From
              <input type="time" step="900" value={from} onChange={(e) => setFrom(e.target.value)} style={input} required />
            </label>
            <label style={label}>
              To
              <input type="time" step="900" value={to} onChange={(e) => setTo(e.target.value)} style={input} required />
            </label>
          </div>

          <button
            onClick={save}
            disabled={!canSave || saving}
            style={{ ...btnPrimary, opacity: !canSave || saving ? 0.6 : 1 }}
          >
            {saving ? "Saving…" : "Save Slot"}
          </button>

          <div style={{fontSize:12, color:"#6b7280"}}>
            Past dates are not allowed. The list below shows future slots only.
          </div>
        </div>

        {/* List */}
        <h3 style={subhead}>Saved Slots</h3>
        {loading ? (
          <div style={muted}>Loading…</div>
        ) : rows.length === 0 ? (
          <div style={muted}>No availability set yet.</div>
        ) : (
          <div style={{ display: "grid", gap: 14 }}>
            {grouped.map(([section, items]) => (
              <section key={section} style={daySection}>
                <div style={dayHeader}>{section}</div>
                <div style={chips}>
                  {items.map((r) => {
                    const past = isPastDateISO(r.date);
                    const label = [r.day, r.date && niceDate(r.date), `${r.from}–${r.to}`]
                      .filter(Boolean)
                      .join(" • ");
                    return (
                      <span
                        key={r._id}
                        title={label}
                        style={{
                          ...chip,
                          ...(past ? { opacity: 0.55 } : {}),
                        }}
                      >
                        <span style={dot} />
                        {label} {past ? <em style={{marginLeft:6, fontStyle:"normal", opacity:0.8}}>(past)</em> : null}
                      </span>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* --------- styles --------- */
const pageWrap = {
  padding: "32px 16px 72px",
  minHeight: "calc(100vh - 80px)",
  background: "linear-gradient(180deg,#f8f9ff 0%, #ffffff 100%)",
};
const container = { width: "min(720px, 96vw)", margin: "0 auto" };
const title = { margin: "8px 0 16px", fontSize: 28, fontWeight: 800, color: "#111827" };
const subhead = { marginTop: 20, marginBottom: 8, fontSize: 16, fontWeight: 900 };
const card = {
  display: "grid",
  gap: 12,
  background: "#fff",
  border: "1px solid #EEF0F5",
  borderRadius: 14,
  padding: 16,
  boxShadow: "0 6px 24px rgba(2,6,23,0.04)",
};
const label = { display: "grid", gap: 6, fontSize: 13, fontWeight: 800, color: "#6b7280" };
const input = {
  height: 40,
  borderRadius: 12,
  border: "1px solid #e5e7eb",
  padding: "0 12px",
  font: "inherit",
  outline: "none",
};
const row2 = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 };
const btnPrimary = {
  height: 44,
  background: "linear-gradient(180deg,#5b7cfa,#4f46e5)",
  color: "#fff",
  border: 0,
  borderRadius: 12,
  fontWeight: 800,
  cursor: "pointer",
};
const muted = {
  color: "#6b7280",
  border: "1px dashed #e5e7eb",
  borderRadius: 12,
  padding: 12,
  background: "#fafafa",
};
const daySection = {
  background: "#fff",
  border: "1px solid #EEF0F5",
  borderRadius: 14,
  padding: 12,
  boxShadow: "0 4px 18px rgba(2,6,23,0.04)",
};
const dayHeader = { fontWeight: 900, fontSize: 13, color: "#4f46e5", marginBottom: 8 };
const chips = { display: "flex", flexWrap: "wrap", gap: 8 };
const chip = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  background: "#F4F6FF",
  border: "1px solid #E3E8FF",
  color: "#4f46e5",
  padding: "6px 10px",
  borderRadius: 999,
  fontWeight: 800,
  fontSize: 12,
};
const dot = {
  width: 8,
  height: 8,
  borderRadius: "50%",
  background: "linear-gradient(180deg,#38BDF8,#0EA5E9)",
  boxShadow: "0 0 0 3px #DFF5FF",
};
