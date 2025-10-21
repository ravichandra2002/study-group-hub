
// // // frontend/src/components/MeetingRequestModal.jsx
// // import { useEffect, useRef, useState } from "react";
// // import styles from "./MeetingRequestModal.module.css";

// // const DAY_OPTIONS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];

// // export default function MeetingRequestModal({ open, onClose, onSend, savedSlots = [], initial = null }) {
// //   const [day, setDay] = useState("");
// //   const [from, setFrom] = useState("");
// //   const [to, setTo] = useState("");
// //   const [saving, setSaving] = useState(false);
// //   const [showSaved, setShowSaved] = useState(false);
// //   const dialogRef = useRef(null);

// //   useEffect(() => {
// //     if (!open) return;
// //     setDay(initial?.day || "");
// //     setFrom(initial?.from || "");
// //     setTo(initial?.to || "");

// //     // if there are saved slots, open that section by default
// //     setShowSaved(Array.isArray(savedSlots) && savedSlots.length > 0);

// //     const t = setTimeout(() => {
// //       dialogRef.current?.querySelector("input,button,select,textarea")?.focus?.();
// //     }, 0);
// //     return () => clearTimeout(t);
// //   }, [open, initial, savedSlots]);

// //   useEffect(() => {
// //     if (!open) return;
// //     const onKey = (e) => e.key === "Escape" && onClose?.();
// //     window.addEventListener("keydown", onKey);
// //     return () => window.removeEventListener("keydown", onKey);
// //   }, [open, onClose]);

// //   if (!open) return null;

// //   const canSubmit = day.trim() && from && to;

// //   const fillFromSaved = (s) => {
// //     setDay(s.day || "");
// //     setFrom(s.from || "");
// //     setTo(s.to || "");
// //     setShowSaved(true);
// //   };

// //   const handleSend = async () => {
// //     if (!canSubmit || saving) return;
// //     try {
// //       setSaving(true);
// //       await onSend?.({ day: day.trim(), from, to });
// //       onClose?.();
// //     } finally {
// //       setSaving(false);
// //     }
// //   };

// //   return (
// //     <div className={styles.backdrop} onClick={onClose}>
// //       <div className={styles.dialog} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} ref={dialogRef}>
// //         <div className={styles.head}>
// //           <h3 className={styles.title}>Propose a meeting</h3>
// //           <button className={styles.x} onClick={onClose} aria-label="Close">✕</button>
// //         </div>

// //         <p className={styles.sub}>
// //           Pick a time that works for you. The other person will be notified to accept or reject.
// //         </p>

// //         <div className={styles.form}>
// //           <label className={styles.label}>
// //             <span className={styles.labelText}>Day</span>
// //             <input
// //               className={styles.input}
// //               type="text"
// //               placeholder="e.g., Monday"
// //               list="days"
// //               value={day}
// //               onChange={(e) => setDay(e.target.value)}
// //             />
// //             <datalist id="days">
// //               {DAY_OPTIONS.map((d) => <option key={d} value={d} />)}
// //             </datalist>
// //           </label>

// //           <div className={styles.row2}>
// //             <label className={styles.label}>
// //               <span className={styles.labelText}>From</span>
// //               <input
// //                 className={styles.input}
// //                 type="time"
// //                 step="900"
// //                 value={from}
// //                 onChange={(e) => setFrom(e.target.value)}
// //               />
// //             </label>

// //             <label className={styles.label}>
// //               <span className={styles.labelText}>To</span>
// //               <input
// //                 className={styles.input}
// //                 type="time"
// //                 step="900"
// //                 value={to}
// //                 onChange={(e) => setTo(e.target.value)}
// //               />
// //             </label>
// //           </div>
// //         </div>

// //         <div className={styles.actions}>
// //           <button className={styles.primary} disabled={!canSubmit || saving} onClick={handleSend}>
// //             {saving ? "Sending…" : "Send request"}
// //           </button>
// //           <button className={styles.ghost} onClick={onClose}>Cancel</button>
// //           <button className={styles.secondary} type="button" onClick={() => setShowSaved((s) => !s)}>
// //             Use my saved slots
// //           </button>
// //         </div>

// //         <div className={`${styles.savedWrap} ${showSaved ? styles.savedOpen : ""}`}>
// //           <div className={styles.savedTitle}>Their saved availability</div>
// //           {Array.isArray(savedSlots) && savedSlots.length > 0 ? (
// //             <div className={styles.chips}>
// //               {savedSlots.map((s, i) => (
// //                 <button
// //                   key={`${s.day}-${s.from}-${s.to}-${i}`}
// //                   className={styles.chip}
// //                   title={`${s.day} ${s.from}–${s.to}`}
// //                   onClick={() => fillFromSaved(s)}
// //                 >
// //                   <span className={styles.dot} />
// //                   {s.day} <span className={styles.sep}>•</span> {s.from}–{s.to}
// //                 </button>
// //               ))}
// //             </div>
// //           ) : (
// //             <div className={styles.empty}>No saved availability found.</div>
// //           )}
// //         </div>
// //       </div>
// //     </div>
// //   );
// // }

// // frontend/src/components/MeetingRequestModal.jsx
// import { useEffect, useRef, useState } from "react";
// import styles from "./MeetingRequestModal.module.css";

// const DAY_OPTIONS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
// const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5050";

// export default function MeetingRequestModal({
//   open,
//   onClose,
//   onSend,              // (slot) => Promise | void
//   savedSlots = [],     // YOUR saved slots (for "Use my saved slots" button)
//   initial = null,      // { day, from, to } to prefill
//   // NEW: identify who you clicked
//   receiverId,
//   receiverName,
//   receiverEmail,
// }) {
//   const [day, setDay] = useState("");
//   const [from, setFrom] = useState("");
//   const [to, setTo] = useState("");

//   const [saving, setSaving] = useState(false);
//   const [showMySaved, setShowMySaved] = useState(false);

//   // NEW: receiver’s availability (fetched on open)
//   const [theirSlots, setTheirSlots] = useState([]);
//   const [loadingAvail, setLoadingAvail] = useState(false);

//   const dialogRef = useRef(null);

//   // Prefill when opening
//   useEffect(() => {
//     if (!open) return;

//     setDay(initial?.day || "");
//     setFrom(initial?.from || "");
//     setTo(initial?.to || "");
//     setShowMySaved(false);

//     // focus first field
//     const t = setTimeout(() => {
//       const first = dialogRef.current?.querySelector("input,button,select,textarea");
//       first?.focus?.();
//     }, 0);
//     return () => clearTimeout(t);
//   }, [open, initial]);

//   // Close on ESC
//   useEffect(() => {
//     if (!open) return;
//     const onKey = (e) => e.key === "Escape" && onClose?.();
//     window.addEventListener("keydown", onKey);
//     return () => window.removeEventListener("keydown", onKey);
//   }, [open, onClose]);

//   // 🔥 Fetch the clicked member’s saved availability on open
//   useEffect(() => {
//     if (!open) return;

//     console.log("[Meeting Modal Opened]");
//     console.log("[receiver info]", { receiverId, receiverName, receiverEmail });

//     if (!receiverId) {
//       console.warn("[availability] No receiverId provided — cannot fetch.");
//       setTheirSlots([]);
//       return;
//     }

//     (async () => {
//       try {
//         setLoadingAvail(true);
//         console.log(`[availability] fetching → ${API_BASE}/availabilities/${receiverId}`);

//         const res = await fetch(`${API_BASE}/availabilities/${receiverId}`, {
//           headers: {
//             "Content-Type": "application/json",
//             Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
//           },
//         });

//         // Accept both {data: [...]} and raw array
//         const payload = await res.json().catch(() => null);
//         console.log("[availability] raw response →", payload);

//         const rows = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : [];
//         const normalized = rows.map((s) => ({
//           day: s.day,
//           from: s.from,
//           to: s.to,
//         }));

//         console.log("[availability] normalized →", normalized);
//         setTheirSlots(normalized);
//       } catch (err) {
//         console.error("[availability] fetch error:", err);
//         setTheirSlots([]);
//       } finally {
//         setLoadingAvail(false);
//       }
//     })();
//   }, [open, receiverId, receiverEmail, receiverName]);

//   if (!open) return null;

//   const canSubmit = day.trim() && from && to;

//   const fillFrom = (s) => {
//     setDay(s.day || "");
//     setFrom(s.from || "");
//     setTo(s.to || "");
//   };

//   const handleSend = async () => {
//     if (!canSubmit || saving) return;
//     const slot = { day: day.trim(), from, to };
//     try {
//       setSaving(true);
//       await onSend?.(slot);
//       onClose?.();
//     } finally {
//       setSaving(false);
//     }
//   };

//   return (
//     <div className={styles.backdrop} onClick={onClose}>
//       <div
//         className={styles.dialog}
//         role="dialog"
//         aria-modal="true"
//         onClick={(e) => e.stopPropagation()}
//         ref={dialogRef}
//       >
//         {/* Header */}
//         <div className={styles.head}>
//           <h3 className={styles.title}>Propose a meeting</h3>
//           <button className={styles.x} onClick={onClose} aria-label="Close">✕</button>
//         </div>

//         <p className={styles.sub}>
//           Pick a time that works for you. The other person will be notified to accept or reject.
//         </p>

//         {/* Form */}
//         <div className={styles.form}>
//           <label className={styles.label}>
//             <span className={styles.labelText}>Day</span>
//             <input
//               className={styles.input}
//               type="text"
//               placeholder="e.g., Monday"
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

//         {/* Actions */}
//         <div className={styles.actions}>
//           <button
//             className={styles.primary}
//             disabled={!canSubmit || saving}
//             onClick={handleSend}
//           >
//             {saving ? "Sending…" : "Send request"}
//           </button>
//           <button className={styles.ghost} onClick={onClose}>Cancel</button>

//           <button
//             className={styles.secondary}
//             type="button"
//             onClick={() => setShowMySaved((s) => !s)}
//           >
//             Use my saved slots
//           </button>
//         </div>

//         {/* ── Their saved availability (fetched) ───────────────────────────── */}
//         <div className={`${styles.savedWrap} ${styles.savedOpen}`}>
//           <div className={styles.savedTitle}>
//             {receiverName ? `${receiverName}'s saved availability` : "Their saved availability"}
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

//         {/* ── Your saved slots (toggle) ────────────────────────────────────── */}
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

// frontend/src/components/MeetingRequestModal.jsx
import { useEffect, useRef, useState } from "react";
import styles from "./MeetingRequestModal.module.css";

const DAY_OPTIONS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5050";

export default function MeetingRequestModal({
  open,
  onClose,
  onSend,              // (slot) => Promise | void
  savedSlots = [],     // your saved slots for the toggle section
  initial = null,      // { day, from, to } to prefill
  // identify who you clicked (used to fetch their availability)
  receiverId,
  receiverName,
  receiverEmail,
}) {
  const [day, setDay] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [saving, setSaving] = useState(false);

  // toggle for "My saved slots"
  const [showMySaved, setShowMySaved] = useState(false);

  // their availability (fetched on open)
  const [theirSlots, setTheirSlots] = useState([]);
  const [loadingAvail, setLoadingAvail] = useState(false);

  const dialogRef = useRef(null);

  // Prefill + focus when opening
  useEffect(() => {
    if (!open) return;

    setDay(initial?.day || "");
    setFrom(initial?.from || "");
    setTo(initial?.to || "");
    setShowMySaved(false);

    const t = setTimeout(() => {
      dialogRef.current
        ?.querySelector("input,button,select,textarea")
        ?.focus?.();
    }, 0);
    return () => clearTimeout(t);
  }, [open, initial]);

  // Close on ESC
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Fetch the clicked member’s saved availability when modal opens
  useEffect(() => {
    if (!open) return;

    console.log("[Meeting Modal Opened]");
    console.log("[receiver info]", { receiverId, receiverName, receiverEmail });

    if (!receiverId) {
      console.warn("[availability] No receiverId provided — cannot fetch.");
      setTheirSlots([]);
      return;
    }

    (async () => {
      try {
        setLoadingAvail(true);
        const url = `${API_BASE}/api/availability/of/${receiverId}`;
        console.log("[availability] fetching →", url);

        const res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
          },
        });
        if (!res.ok) throw new Error(await res.text());

        // backend returns an array: [{day,from,to,...}]
        const rows = await res.json();
        const normalized = (Array.isArray(rows) ? rows : []).map((s) => ({
          day: s.day,
          from: s.from,
          to: s.to,
        }));
        console.log("[availability] normalized →", normalized);
        setTheirSlots(normalized);
      } catch (err) {
        console.error("[availability] fetch error:", err);
        setTheirSlots([]);
      } finally {
        setLoadingAvail(false);
      }
    })();
  }, [open, receiverId, receiverName, receiverEmail]);

  if (!open) return null;

  const canSubmit = day.trim() && from && to;

  const fillFrom = (s) => {
    setDay(s.day || "");
    setFrom(s.from || "");
    setTo(s.to || "");
  };

  const handleSend = async () => {
    if (!canSubmit || saving) return;
    try {
      setSaving(true);
      await onSend?.({ day: day.trim(), from, to });
      onClose?.();
    } finally {
      setSaving(false);
    }
  };

  const receiverLabel =
    (receiverName && receiverName.trim()) ||
    (receiverEmail && receiverEmail.trim()) ||
    "Their";

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        ref={dialogRef}
      >
        {/* Header */}
        <div className={styles.head}>
          <h3 className={styles.title}>Propose a meeting</h3>
          <button className={styles.x} onClick={onClose} aria-label="Close">✕</button>
        </div>

        <p className={styles.sub}>
          Pick a time that works for you. The other person will be notified to accept or reject.
        </p>

        {/* Form */}
        <div className={styles.form}>
          <label className={styles.label}>
            <span className={styles.labelText}>Day</span>
            <input
              className={styles.input}
              type="text"
              placeholder="e.g., Monday"
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

        {/* Actions */}
        <div className={styles.actions}>
          <button className={styles.primary} disabled={!canSubmit || saving} onClick={handleSend}>
            {saving ? "Sending…" : "Send request"}
          </button>
          <button className={styles.ghost} onClick={onClose}>Cancel</button>
          <button className={styles.secondary} type="button" onClick={() => setShowMySaved((s) => !s)}>
            Use my saved slots
          </button>
        </div>

        {/* Their saved availability */}
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
              {theirSlots.map((s, i) => (
                <button
                  key={`${s.day}-${s.from}-${s.to}-${i}`}
                  className={styles.chip}
                  title={`${s.day} ${s.from}–${s.to}`}
                  onClick={() => fillFrom(s)}
                >
                  <span className={styles.dot} />
                  {s.day} <span className={styles.sep}>•</span> {s.from}–{s.to}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Your saved slots (toggle) */}
        <div className={`${styles.savedWrap} ${showMySaved ? styles.savedOpen : ""}`}>
          <div className={styles.savedTitle}>My saved slots</div>
          {Array.isArray(savedSlots) && savedSlots.length > 0 ? (
            <div className={styles.chips}>
              {savedSlots.map((s, i) => (
                <button
                  key={`${s.day}-${s.from}-${s.to}-${i}`}
                  className={styles.chip}
                  title={`${s.day} ${s.from}–${s.to}`}
                  onClick={() => fillFrom(s)}
                >
                  <span className={styles.dot} />
                  {s.day} <span className={styles.sep}>•</span> {s.from}–{s.to}
                </button>
              ))}
            </div>
          ) : (
            <div className={styles.empty}>You haven’t saved any availability yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}
