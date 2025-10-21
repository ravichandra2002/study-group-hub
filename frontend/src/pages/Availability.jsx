// import { useState, useEffect } from "react";
// import api from "../lib/api";
// import { toast } from "react-toastify";

// export default function Availability() {
//   const [day, setDay] = useState("");
//   const [from, setFrom] = useState("");
//   const [to, setTo] = useState("");
//   const [slots, setSlots] = useState([]);

//   const loadSlots = async () => {
//     try {
//       const { data } = await api.get("/availability/list");
//       setSlots(data);
//     } catch {
//       toast.error("Failed to load availability.");
//     }
//   };

//   useEffect(() => {
//     loadSlots();
//   }, []);

//   const addSlot = async (e) => {
//     e.preventDefault();
//     try {
//       const { data } = await api.post("/availability/add", { day, from, to });
//       toast.success("Availability added!");
//       setSlots((prev) => [...prev, data.slot]);
//       setDay("");
//       setFrom("");
//       setTo("");
//     } catch {
//       toast.error("Failed to save availability.");
//     }
//   };

//   return (
//     <div style={{ padding: "20px", maxWidth: "600px", margin: "auto" }}>
//       <h2 style={{ marginBottom: "16px", color: "#334155" }}>Your Availability</h2>

//       <form onSubmit={addSlot} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
//         <input
//           placeholder="Day (e.g. Monday)"
//           value={day}
//           onChange={(e) => setDay(e.target.value)}
//           required
//         />
//         <label>From:</label>
//         <input type="time" value={from} onChange={(e) => setFrom(e.target.value)} required />
//         <label>To:</label>
//         <input type="time" value={to} onChange={(e) => setTo(e.target.value)} required />
//         <button
//           type="submit"
//           style={{
//             marginTop: "10px",
//             padding: "10px 14px",
//             backgroundColor: "#4f46e5",
//             color: "white",
//             border: "none",
//             borderRadius: "6px",
//             cursor: "pointer",
//           }}
//         >
//           Save Slot
//         </button>
//       </form>

//       <h3 style={{ marginTop: "24px", color: "#334155" }}>Saved Slots</h3>
//       {slots.length === 0 ? (
//         <p>No availability set yet.</p>
//       ) : (
//         <ul style={{ listStyle: "none", padding: 0 }}>
//           {slots.map((s, i) => (
//             <li
//               key={i}
//               style={{
//                 marginBottom: "8px",
//                 background: "#f9fafb",
//                 padding: "8px",
//                 borderRadius: "6px",
//                 boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
//               }}
//             >
//               <strong>{s.day}</strong>: {s.from} - {s.to}
//             </li>
//           ))}
//         </ul>
//       )}
//     </div>
//   );
// }
// frontend/src/pages/Availability.jsx
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
const cap = (s="") => s[0]?.toUpperCase() + s.slice(1);

export default function Availability() {
  const [day, setDay] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const canSave = day && from && to;

  const grouped = useMemo(() => {
    const map = new Map();
    for (const r of rows) {
      const key = r.day;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(r);
    }
    // keep day order Mon..Sun
    return DAYS.filter((d) => map.has(d)).map((d) => [d, map.get(d)]);
  }, [rows]);

  const load = async () => {
    try {
      setLoading(true);
      const data = await apiGet("/api/availability/list");
      const arr = Array.isArray(data) ? data : [];
      // newest first
      arr.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
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

  const save = async () => {
    if (!canSave || saving) return;
    try {
      setSaving(true);
      await apiPost("/api/availability/add", { day, from, to });
      setDay("");
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
            Day
            <select
              value={day}
              onChange={(e) => setDay(e.target.value)}
              style={select}
            >
              <option value="" disabled>Choose a day…</option>
              {DAYS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </label>

          <div style={row2}>
            <label style={label}>
              From
              <input
                type="time"
                step="900"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                style={input}
              />
            </label>
            <label style={label}>
              To
              <input
                type="time"
                step="900"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                style={input}
              />
            </label>
          </div>

          <button
            onClick={save}
            disabled={!canSave || saving}
            style={{ ...btnPrimary, opacity: !canSave || saving ? 0.6 : 1 }}
          >
            {saving ? "Saving…" : "Save Slot"}
          </button>
        </div>

        {/* List */}
        <h3 style={subhead}>Saved Slots</h3>
        {loading ? (
          <div style={muted}>Loading…</div>
        ) : rows.length === 0 ? (
          <div style={muted}>No availability set yet.</div>
        ) : (
          <div style={{ display: "grid", gap: 14 }}>
            {grouped.map(([d, items]) => (
              <section key={d} style={daySection}>
                <div style={dayHeader}>{d}</div>
                <div style={chips}>
                  {items.map((r) => (
                    <span key={r._id} title={`${r.day} ${r.from}–${r.to}`} style={chip}>
                      <span style={dot} />
                      {r.from}–{r.to}
                    </span>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* --------- styles (inline to match your app) --------- */
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
const select = {
  ...input,
  appearance: "none",
  background:
    "linear-gradient(#fff,#fff) padding-box, linear-gradient(180deg,#c7d2fe,#a5b4fc) border-box",
  border: "1px solid #e5e7eb",
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

/* mobile tweak */
const media = window.matchMedia?.("(max-width: 600px)");
if (media?.matches) {
  row2.gridTemplateColumns = "1fr";
}
