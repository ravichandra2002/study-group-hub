// frontend/src/components/MembersModal.jsx
import MeetingRequestButton from "./MeetingRequestButton.jsx";

export default function MembersModal({
  open,
  onClose,
  groupTitle = "Group",
  members = [],
  currentUserId = null,
}) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        display: "grid",
        placeItems: "center",
        zIndex: 1000,
      }}
    >
      <div
        style={{
          width: "min(92vw, 720px)",
          background: "white",
          borderRadius: 14,
          boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 16px",
            borderBottom: "1px solid #f1f5f9",
          }}
        >
          <h3 style={{ margin: 0, fontSize: 18, color: "#0f172a" }}>
            Members · {groupTitle}
          </h3>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: "transparent",
              border: "none",
              fontSize: 18,
              cursor: "pointer",
            }}
          >
            ✕
          </button>
        </div>

        {/* List */}
        <div style={{ padding: 12, maxHeight: "60vh", overflowY: "auto" }}>
          {members.length === 0 ? (
            <div style={{ padding: 16, color: "#64748b" }}>No members yet.</div>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
              {members.map((m) => {
                const id = String(m?._id ?? m?.id ?? "");
                const isYou = currentUserId && String(currentUserId) === id;

                return (
                  <li
                    key={id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      border: "1px solid #e2e8f0",
                      borderRadius: 12,
                      padding: "10px 12px",
                      background: "#ffffff",
                    }}
                  >
                    {/* Avatar */}
                    <div
                      aria-hidden
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 999,
                        display: "grid",
                        placeItems: "center",
                        fontWeight: 700,
                        color: "#1e293b",
                        background: "#f1f5f9",
                        textTransform: "uppercase",
                      }}
                    >
                      {(m?.name || m?.fullName || m?.email || "U")
                        .slice(0, 2)
                        .replace(/[^a-zA-Z]/g, "")
                        .padEnd(2, "U")}
                    </div>

                    {/* Text */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, color: "#0f172a" }}>
                        {m?.name || m?.fullName || m?.email || "Member"}
                        {isYou && <span style={{ marginLeft: 6, color: "#64748b" }}>(You)</span>}
                        {m?.role === "owner" && (
                          <span
                            style={{
                              marginLeft: 8,
                              background: "#fff7ed",
                              color: "#b45309",
                              padding: "2px 8px",
                              borderRadius: 999,
                              fontSize: 12,
                              fontWeight: 600,
                              border: "1px solid #fed7aa",
                            }}
                          >
                            Owner
                          </span>
                        )}
                      </div>
                      <div
                        style={{
                          color: "#64748b",
                          fontSize: 13,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                        title={m?.email || ""}
                      >
                        {m?.email || ""}
                      </div>
                    </div>

                    {/* Action */}
                    {!isYou && id && (
                      <MeetingRequestButton receiverId={id} label="Request meeting" />
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
