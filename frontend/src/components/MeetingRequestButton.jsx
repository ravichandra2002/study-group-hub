
import { useMemo, useState } from "react";
import MeetingRequestModal from "./MeetingRequestModal.jsx";

export default function MeetingRequestButton({
  receiverId,
  receiverName,
  receiverEmail,
  label = "Request meeting",
  initial = null,        
  mySavedSlots = [],      
  onSent,                
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
