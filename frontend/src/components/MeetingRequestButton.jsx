// // frontend/src/components/MeetingRequestButton.jsx
// import { useState, useCallback } from "react";
// import MeetingRequestModal from "./MeetingRequestModal.jsx";
// import api from "../lib/api"; // your axios wrapper

// export default function MeetingRequestButton({
//   receiverId,
//   label = "Request meeting",
//   initial = null,         // optional { day, from, to } to prefill
//   className = "",
// }) {
//   const [open, setOpen] = useState(false);
//   const [savedSlots, setSavedSlots] = useState([]);
//   const [loadingSlots, setLoadingSlots] = useState(false);

//   const loadAvailability = useCallback(async (uid) => {
//     if (!uid) return setSavedSlots([]);
//     setLoadingSlots(true);

//     // Try a couple of common routes; first one that works "wins".
//     const tryRoutes = [
//       `/availability/${uid}`,             // e.g. GET /api/availability/:userId
//       `/availabilities/${uid}`,           // e.g. GET /api/availabilities/:userId
//       `/availabilities?user_id=${uid}`,   // e.g. GET /api/availabilities?user_id=...
//     ];

//     for (const path of tryRoutes) {
//       try {
//         const res = await api.get(path);
//         // normalize into [{day, from, to}]
//         const rows = Array.isArray(res?.data ?? res) ? (res.data ?? res) : [];
//         const normalized = rows.map(r => ({
//           day: r.day || "",
//           from: r.from || "",
//           to: r.to || "",
//         })).filter(s => s.day && s.from && s.to);
//         setSavedSlots(normalized);
//         setLoadingSlots(false);
//         return;
//       } catch (e) {
//         // try next route
//       }
//     }

//     setSavedSlots([]);
//     setLoadingSlots(false);
//   }, []);

//   const openModal = async () => {
//     setOpen(true);
//     // fire-and-forget; modal can open immediately
//     loadAvailability(receiverId);
//   };

//   const onSend = async (slot) => {
//     // send the meeting request to backend
//     // adjust endpoint to your API
//     await api.post(`/meetings/request`, {
//       receiverId,
//       slot, // { day, from, to }
//     });
//   };

//   return (
//     <>
//       <button className={className} onClick={openModal}>
//         {loadingSlots ? "Loading…" : label}
//       </button>

//       <MeetingRequestModal
//         open={open}
//         onClose={() => setOpen(false)}
//         onSend={onSend}
//         savedSlots={savedSlots}
//         initial={initial}
//       />
//     </>
//   );
// }

// frontend/src/components/MeetingRequestButton.jsx
import { useMemo, useState } from "react";
import MeetingRequestModal from "./MeetingRequestModal.jsx";

export default function MeetingRequestButton({
  receiverId,
  receiverName,
  receiverEmail,
  label = "Request meeting",
  initial = null,         // optional: { day, from, to }
  mySavedSlots = [],      // optional: your own saved availability (to use "Use my saved slots")
  onSent,                 // optional callback(slot)
}) {
  const [open, setOpen] = useState(false);

  const canOpen = useMemo(() => !!receiverId || !!receiverEmail, [receiverId, receiverEmail]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={!canOpen}
        style={{
          background: "#4f46e5",
          color: "#fff",
          border: "1px solid #4f46e5",
          padding: "8px 12px",
          borderRadius: 12,
          fontWeight: 800,
          cursor: canOpen ? "pointer" : "not-allowed",
        }}
      >
        {label}
      </button>

      {open && (
        <MeetingRequestModal
          open={open}
          onClose={() => setOpen(false)}
          onSend={(slot) => {
            onSent?.(slot);
          }}
          // ↓↓↓ IMPORTANT: pass who you clicked
          receiverId={receiverId}
          receiverName={receiverName}
          receiverEmail={receiverEmail}
          // optional helpers
          initial={initial}
          savedSlots={mySavedSlots}
        />
      )}
    </>
  );
}
