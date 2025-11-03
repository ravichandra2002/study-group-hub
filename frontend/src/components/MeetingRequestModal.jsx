

// import { useEffect, useRef, useState } from "react";
// import styles from "./MeetingRequestModal.module.css";

// const DAY_OPTIONS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
// const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5050";

// function dayFromISO(iso) {
//   if (!iso) return "";
//   const d = new Date(iso + "T00:00:00");
//   const names = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
//   return names[d.getDay()];
// }

// export default function MeetingRequestModal({
//   open,
//   onClose,
//   onSend,             
//   savedSlots = [],    
//   initial = null,      
//   receiverId,
//   receiverName,
//   receiverEmail,
// }) {
//   const [dateISO, setDateISO] = useState(""); // YYYY-MM-DD
//   const [day, setDay] = useState("");
//   const [from, setFrom] = useState("");
//   const [to, setTo] = useState("");
//   const [saving, setSaving] = useState(false);

//   const [showMySaved, setShowMySaved] = useState(false);
//   const [theirSlots, setTheirSlots] = useState([]);
//   const [loadingAvail, setLoadingAvail] = useState(false);

//   const dialogRef = useRef(null);

//   useEffect(() => {
//     if (!open) return;
//     setDateISO(initial?.date || "");
//     setDay(initial?.day || "");
//     setFrom(initial?.from || "");
//     setTo(initial?.to || "");
//     setShowMySaved(false);
//     const t = setTimeout(() => {
//       dialogRef.current?.querySelector("input,button,select,textarea")?.focus?.();
//     }, 0);
//     return () => clearTimeout(t);
//   }, [open, initial]);

//   useEffect(() => {
//     if (!open) return;
//     const onKey = (e) => e.key === "Escape" && onClose?.();
//     window.addEventListener("keydown", onKey);
//     return () => window.removeEventListener("keydown", onKey);
//   }, [open, onClose]);

//   // Fetch the clicked member’s saved availability when modal opens
//   useEffect(() => {
//     if (!open) return;
//     if (!receiverId) {
//       setTheirSlots([]);
//       return;
//     }
//     (async () => {
//       try {
//         setLoadingAvail(true);
//         const res = await fetch(`${API_BASE}/api/availability/of/${receiverId}`, {
//           headers: { Authorization: `Bearer ${localStorage.getItem("token") || ""}` },
//         });
//         if (!res.ok) throw new Error(await res.text());
//         const rows = await res.json();
//         const normalized = (Array.isArray(rows) ? rows : []).map((s) => ({
//           day: s.day, from: s.from, to: s.to,
//         }));
//         setTheirSlots(normalized);
//       } catch (err) {
//         console.error("[availability] fetch error:", err);
//         setTheirSlots([]);
//       } finally {
//         setLoadingAvail(false);
//       }
//     })();
//   }, [open, receiverId]);


//   useEffect(() => {
//     if (dateISO) setDay(dayFromISO(dateISO));
//   }, [dateISO]);

//   if (!open) return null;

//   const canSubmit = !!dateISO && !!from && !!to;

//   const fillFrom = (s) => {

//     setDay(s.day || "");
//     setFrom(s.from || "");
//     setTo(s.to || "");
//   };

//   const handleSend = async () => {
//     if (!canSubmit || saving) return;
//     try {
//       setSaving(true);
//       await onSend?.({ day: day || dayFromISO(dateISO), date: dateISO, from, to });
//       onClose?.();
//     } finally {
//       setSaving(false);
//     }
//   };

//   const receiverLabel =
//     (receiverName && receiverName.trim()) ||
//     (receiverEmail && receiverEmail.trim()) ||
//     "Their";

//   return (
//     <div className={styles.backdrop} onClick={onClose}>
//       <div
//         className={styles.dialog}
//         role="dialog"
//         aria-modal="true"
//         onClick={(e) => e.stopPropagation()}
//         ref={dialogRef}
//       >
//         <div className={styles.head}>
//           <h3 className={styles.title}>Propose a meeting</h3>
//           <button className={styles.x} onClick={onClose} aria-label="Close">✕</button>
//         </div>

//         <p className={styles.sub}>
//           Pick a date and time. The other person will be notified to accept or reject.
//         </p>

//         <div className={styles.form}>
//           {/* Date */}
//           <label className={styles.label}>
//             <span className={styles.labelText}>Date</span>
//             <input
//               className={styles.input}
//               type="date"
//               value={dateISO}
//               onChange={(e) => setDateISO(e.target.value)}
//             />
//           </label>

//           <label className={styles.label}>
//             <span className={styles.labelText}>Weekday</span>
//             <input
//               className={styles.input}
//               type="text"
//               placeholder="Monday"
//               list="days"
//               value={day}
//               onChange={(e) => setDay(e.target.value)}
//             />
//             <datalist id="days">
//               {DAY_OPTIONS.map((d) => <option key={d} value={d} />)}
//             </datalist>
//           </label>

//           <div className={styles.row2}>
//             <label className={styles.label}>
//               <span className={styles.labelText}>From</span>
//               <input
//                 className={styles.input}
//                 type="time"
//                 step="900"
//                 value={from}
//                 onChange={(e) => setFrom(e.target.value)}
//               />
//             </label>

//             <label className={styles.label}>
//               <span className={styles.labelText}>To</span>
//               <input
//                 className={styles.input}
//                 type="time"
//                 step="900"
//                 value={to}
//                 onChange={(e) => setTo(e.target.value)}
//               />
//             </label>
//           </div>
//         </div>

//         <div className={styles.actions}>
//           <button className={styles.primary} disabled={!canSubmit || saving} onClick={handleSend}>
//             {saving ? "Sending…" : "Send request"}
//           </button>
//           <button className={styles.ghost} onClick={onClose}>Cancel</button>
//           <button className={styles.secondary} type="button" onClick={() => setShowMySaved((s) => !s)}>
//             Use my saved slots
//           </button>
//         </div>

//         {/* Their saved availability */}
//         <div className={`${styles.savedWrap} ${styles.savedOpen}`}>
//           <div className={styles.savedTitle}>
//             {receiverLabel.toLowerCase().endsWith("'s") ? receiverLabel : `${receiverLabel}'s`} saved availability
//           </div>
//           {loadingAvail ? (
//             <div className={styles.empty}>Loading…</div>
//           ) : theirSlots.length === 0 ? (
//             <div className={styles.empty}>No saved availability found.</div>
//           ) : (
//             <div className={styles.chips}>
//               {theirSlots.map((s, i) => (
//                 <button
//                   key={`${s.day}-${s.from}-${s.to}-${i}`}
//                   className={styles.chip}
//                   title={`${s.day} ${s.from}–${s.to}`}
//                   onClick={() => fillFrom(s)}
//                 >
//                   <span className={styles.dot} />
//                   {s.day} <span className={styles.sep}>•</span> {s.from}–{s.to}
//                 </button>
//               ))}
//             </div>
//           )}
//         </div>

//         <div className={`${styles.savedWrap} ${showMySaved ? styles.savedOpen : ""}`}>
//           <div className={styles.savedTitle}>My saved slots</div>
//           {Array.isArray(savedSlots) && savedSlots.length > 0 ? (
//             <div className={styles.chips}>
//               {savedSlots.map((s, i) => (
//                 <button
//                   key={`${s.day}-${s.from}-${s.to}-${i}`}
//                   className={styles.chip}
//                   title={`${s.day} ${s.from}–${s.to}`}
//                   onClick={() => fillFrom(s)}
//                 >
//                   <span className={styles.dot} />
//                   {s.day} <span className={styles.sep}>•</span> {s.from}–{s.to}
//                 </button>
//               ))}
//             </div>
//           ) : (
//             <div className={styles.empty}>You haven’t saved any availability yet.</div>
//           )}
//         </div>
//       </div>
//     </div>
//   );
// }


import { useEffect, useRef, useState, useMemo } from "react";
import styles from "./MeetingRequestModal.module.css";

const DAY_OPTIONS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5050";

function dayFromISO(iso) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  const names = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  return names[d.getDay()];
}

function isPastDateISO(iso) {
  if (!iso) return false;
  const today = new Date(); today.setHours(0,0,0,0);
  const dd = new Date(iso + "T00:00:00");
  return dd < today;
}
function isPastDateTime(iso, hhmm) {
  if (!iso || !hhmm) return false;
  const now = new Date();
  const [h,m] = hhmm.split(":").map(Number);
  const dt = new Date(iso + "T00:00:00");
  dt.setHours(h || 0, m || 0, 0, 0);
  return dt < now;
}

export default function MeetingRequestModal({
  open,
  onClose,
  onSend,
  savedSlots = [],
  initial = null,
  receiverId,
  receiverName,
  receiverEmail,
}) {
  const [dateISO, setDateISO] = useState("");
  const [day, setDay] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [saving, setSaving] = useState(false);

  const [showMySaved, setShowMySaved] = useState(false);
  const [theirSlots, setTheirSlots] = useState([]);
  const [loadingAvail, setLoadingAvail] = useState(false);

  const dialogRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setDateISO(initial?.date || "");
    setDay(initial?.day || "");
    setFrom(initial?.from || "");
    setTo(initial?.to || "");
    setShowMySaved(false);
    const t = setTimeout(() => {
      dialogRef.current?.querySelector("input,button,select,textarea")?.focus?.();
    }, 0);
    return () => clearTimeout(t);
  }, [open, initial]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Fetch receiver’s saved availability (future only).
  useEffect(() => {
    if (!open) return;
    if (!receiverId) {
      setTheirSlots([]);
      return;
    }
    (async () => {
      try {
        setLoadingAvail(true);
        const res = await fetch(`${API_BASE}/api/availability/of/${receiverId}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token") || ""}` },
        });
        if (!res.ok) throw new Error(await res.text());
        const rows = await res.json();
        const normalized = (Array.isArray(rows) ? rows : []).map((s) => ({
          day: s.day, date: s.date, from: s.from, to: s.to,
        }));
        setTheirSlots(normalized);
      } catch (err) {
        console.error("[availability] fetch error:", err);
        setTheirSlots([]);
      } finally {
        setLoadingAvail(false);
      }
    })();
  }, [open, receiverId]);

  // keep weekday in sync
  useEffect(() => {
    if (dateISO) setDay(dayFromISO(dateISO));
  }, [dateISO]);

  if (!open) return null;

  const canSubmit =
    !!dateISO &&
    !!from && !!to &&
    !isPastDateISO(dateISO) &&
    !isPastDateTime(dateISO, to) && // end must be in the future if today
    (from < to);

  const fillFrom = (s) => {
    if (!s) return;
    setDateISO(s.date || "");
    setDay(s.day || (s.date ? dayFromISO(s.date) : ""));
    setFrom(s.from || "");
    setTo(s.to || "");
  };

  const handleSend = async () => {
    if (!canSubmit || saving) return;
    if (isPastDateISO(dateISO)) return;
    if (!(from < to)) return;

    // if it’s today and ‘from’ is still earlier than now, nudge user
    if (isPastDateTime(dateISO, from)) {
      alert("Start time is in the past. Pick a later time.");
      return;
    }

    try {
      setSaving(true);
      await onSend?.({ day: day || dayFromISO(dateISO), date: dateISO, from, to });
      onClose?.();
    } finally {
      setSaving(false);
    }
  };

  const receiverLabel =
    (receiverName && receiverName.trim()) ||
    (receiverEmail && receiverEmail.trim()) ||
    "Their";

  const myFutureSlots = useMemo(
    () => (Array.isArray(savedSlots) ? savedSlots : []),
    [savedSlots]
  );

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        ref={dialogRef}
      >
        <div className={styles.head}>
          <h3 className={styles.title}>Propose a meeting</h3>
          <button className={styles.x} onClick={onClose} aria-label="Close">✕</button>
        </div>

        <p className={styles.sub}>
          Pick a date and time. The other person will be notified to accept or reject.
        </p>

        <div className={styles.form}>
          <label className={styles.label}>
            <span className={styles.labelText}>Date</span>
            <input
              className={styles.input}
              type="date"
              value={dateISO}
              onChange={(e) => setDateISO(e.target.value)}
              min={new Date().toISOString().slice(0,10)}
            />
          </label>

          <label className={styles.label}>
            <span className={styles.labelText}>Weekday</span>
            <input
              className={styles.input}
              type="text"
              placeholder="Monday"
              list="days"
              value={day}
              onChange={(e) => setDay(e.target.value)}
            />
            <datalist id="days">
              {DAY_OPTIONS.map((d) => <option key={d} value={d} />)}
            </datalist>
          </label>

          <div className={styles.row2}>
            <label className={styles.label}>
              <span className={styles.labelText}>From</span>
              <input
                className={styles.input}
                type="time"
                step="900"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </label>

            <label className={styles.label}>
              <span className={styles.labelText}>To</span>
              <input
                className={styles.input}
                type="time"
                step="900"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </label>
          </div>
        </div>

        <div className={styles.actions}>
          <button className={styles.primary} disabled={!canSubmit || saving} onClick={handleSend}>
            {saving ? "Sending…" : "Send request"}
          </button>
          <button className={styles.ghost} onClick={onClose}>Cancel</button>
          <button className={styles.secondary} type="button" onClick={() => setShowMySaved((s) => !s)}>
            Use my saved slots
          </button>
        </div>

        {/* Receiver saved availability (future only from API) */}
        <div className={`${styles.savedWrap} ${styles.savedOpen}`}>
          <div className={styles.savedTitle}>
            {receiverLabel.toLowerCase().endsWith("'s") ? receiverLabel : `${receiverLabel}'s`} saved availability
          </div>
          {loadingAvail ? (
            <div className={styles.empty}>Loading…</div>
          ) : theirSlots.length === 0 ? (
            <div className={styles.empty}>No saved availability found.</div>
          ) : (
            <div className={styles.chips}>
              {theirSlots.map((s, i) => {
                const past = isPastDateISO(s.date);
                return (
                  <button
                    key={`${s.date}-${s.day}-${s.from}-${s.to}-${i}`}
                    className={styles.chip}
                    title={`${s.day} ${s.date} • ${s.from}–${s.to}`}
                    onClick={() => !past && fillFrom(s)}
                    disabled={past}
                    style={past ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
                  >
                    <span className={styles.dot} />
                    {s.day} • {s.date} • {s.from}–{s.to}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* My saved slots (already future-only due to API filter) */}
        <div className={`${styles.savedWrap} ${showMySaved ? styles.savedOpen : ""}`}>
          <div className={styles.savedTitle}>My saved slots</div>
          {Array.isArray(myFutureSlots) && myFutureSlots.length > 0 ? (
            <div className={styles.chips}>
              {myFutureSlots.map((s, i) => {
                const past = isPastDateISO(s.date);
                return (
                  <button
                    key={`${s.date}-${s.day}-${s.from}-${s.to}-${i}`}
                    className={styles.chip}
                    title={`${s.day} ${s.date} • ${s.from}–${s.to}`}
                    onClick={() => !past && fillFrom(s)}
                    disabled={past}
                    style={past ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
                  >
                    <span className={styles.dot} />
                    {s.day} • {s.date} • {s.from}–{s.to}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className={styles.empty}>You haven’t saved any availability yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}
