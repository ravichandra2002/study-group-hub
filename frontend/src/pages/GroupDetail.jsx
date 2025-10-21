
// import { useEffect, useMemo, useState, useCallback } from "react";
// import { useNavigate, useParams, Link } from "react-router-dom";
// import { toast } from "react-toastify";
// import ChatDock from "../components/ChatDock";
// import MeetingRequestModal from "../components/MeetingRequestModal.jsx";

// const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5050";

// /* ---------------- API helpers ---------------- */
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
//     body: body ? JSON.stringify(body) : undefined,
//   });
//   if (!res.ok) throw new Error(await res.text());
//   return res.json();
// }

// /* small helpers */
// const fmtTime = (iso) =>
//   iso ? new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "—";
// const initials = (name = "", email = "") => {
//   const src = name || email || "?";
//   const parts = src.replace(/\s+/g, " ").trim().split(" ");
//   if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
//   return (parts[0][0] + parts[1][0]).toUpperCase();
// };
// const colorFromString = (s) => {
//   const palette = ["#D6E4FF", "#FDE68A", "#FBD5D5", "#D1FAE5", "#E9D5FF", "#C7F9FF", "#FFE4E6", "#F5F3FF"];
//   let h = 0;
//   for (let i = 0; i < (s || "").length; i++) h = (h * 31 + s.charCodeAt(i)) % 9973;
//   return palette[h % palette.length];
// };

// export default function GroupDetail() {
//   const { gid } = useParams();
//   const navigate = useNavigate();

//   const me = useMemo(() => {
//     try {
//       return JSON.parse(localStorage.getItem("user") || "{}");
//     } catch {
//       return {};
//     }
//   }, []);
//   const myId = useMemo(() => String(me?._id ?? me?.id ?? me?.userId ?? ""), [me]);

//   const [loading, setLoading] = useState(true);
//   const [group, setGroup] = useState(null);

//   // members modal
//   const [membersOpen, setMembersOpen] = useState(false);
//   const [members, setMembers] = useState([]);
//   const [membersLoading, setMembersLoading] = useState(false);

//   // local-only extras
//   const [notes, setNotes] = useState("");
//   const [checklist, setChecklist] = useState(() => {
//     const saved = localStorage.getItem("gd-checklist");
//     return saved
//       ? JSON.parse(saved)
//       : [
//           { id: "read", label: "Review this week's readings", done: false },
//           { id: "lab", label: "Prepare lab notebook", done: false },
//           { id: "quiz", label: "Practice quiz questions", done: false },
//           { id: "meet", label: "Confirm next study session time", done: false },
//         ];
//   });

//   // confirm modal
//   const [confirmState, setConfirmState] = useState({ open: false, title: "", message: "", onConfirm: null });
//   const askConfirm = (title, message, onConfirm) => setConfirmState({ open: true, title, message, onConfirm });
//   const closeConfirm = () => setConfirmState({ open: false, title: "", message: "", onConfirm: null });

//   // meeting request modal state
//   const [meetOpen, setMeetOpen] = useState(false);
//   const [meetTarget, setMeetTarget] = useState(null);   // { id, name, email }
//   const [meetInitial, setMeetInitial] = useState(null); // { day, from, to }
//   const [savedSlots, setSavedSlots] = useState([]);     // your own saved availability

//   const loadGroup = async () => {
//     try {
//       setLoading(true);
//       const g = await apiGet(`/api/groups/${gid}`);
//       setGroup(g);
//     } catch (e) {
//       console.error(e);
//       toast.error("Failed to load group");
//     } finally {
//       setLoading(false);
//     }
//   };

//   // Load *your* saved availability (used for "Use my saved slots")
//   const loadMyAvailability = async () => {
//     try {
//       const avail = await apiGet(`/api/groups/availability/me`);
//       const map = {
//         mon: "Monday", tue: "Tuesday", wed: "Wednesday",
//         thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday",
//       };
//       const list = [];
//       Object.keys(avail || {}).forEach((k) => {
//         const dayName = map[k] || k;
//         (avail[k] || []).forEach((r) => list.push({ day: dayName, from: r.from, to: r.to }));
//       });
//       setSavedSlots(list);
//     } catch {
//       setSavedSlots([]);
//     }
//   };

//   useEffect(() => {
//     loadGroup();
//   }, [gid, myId]);

//   useEffect(() => {
//     const key = `gd-notes-${gid}`;
//     const savedNotes = localStorage.getItem(key);
//     if (savedNotes != null) setNotes(savedNotes);
//   }, [gid]);

//   useEffect(() => {
//     localStorage.setItem("gd-checklist", JSON.stringify(checklist));
//   }, [checklist]);

//   const isOwner = !!group?.isOwner;
//   const amMember = group?.myJoinStatus === "member";
//   const canSeeMembers = isOwner || amMember;
//   const canChat = isOwner || amMember;
//   const membersCount = group?.membersCount ?? group?.members?.length ?? 0;

//   const leave = () =>
//     askConfirm("Leave group?", "Are you sure you want to leave this group?", async () => {
//       try {
//         await apiPost(`/api/groups/leave/${gid}`);
//         toast.success("Left group");
//         navigate("/dashboard");
//       } catch {
//         toast.error("Could not leave group");
//       } finally {
//         closeConfirm();
//       }
//     });

//   const goBack = () =>
//     askConfirm("Back to dashboard?", "You'll return to your groups.", () => {
//       closeConfirm();
//       navigate("/dashboard");
//     });

//   const isSelf = useCallback(
//     (m) => {
//       const mid = String(m?._id ?? m?.id ?? m?.userId ?? "");
//       if (myId && mid && myId === mid) return true;
//       if (m?.email && me?.email && m.email.toLowerCase() === me.email.toLowerCase()) return true;
//       return false;
//     },
//     [me?.email, myId]
//   );

//   const openMembers = async () => {
//     setMembersOpen(true);
//     if (!canSeeMembers) {
//       setMembers([]);
//       return;
//     }
//     try {
//       setMembersLoading(true);
//       const rows = await apiGet(`/api/groups/${gid}/members`);
//       setMembers(Array.isArray(rows) ? rows : []);
//     } catch {
//       setMembers([]);
//       toast.error("Could not load members");
//     } finally {
//       setMembersLoading(false);
//     }
//   };
//   const closeMembers = () => {
//     setMembersOpen(false);
//     setMembers([]);
//   };

//   // Open meeting modal for a member
//   const requestMeetingFor = async (m) => {
//     const id = String(m?._id ?? m?.id ?? m?.userId ?? "");
//     setMeetTarget({ id, name: m?.name || "", email: m?.email || "" });
//     setMeetInitial(null);
//     await loadMyAvailability();
//     setMeetOpen(true);
//   };

//   // Send meeting request
//   const sendMeeting = async (slot) => {
//     try {
//       await apiPost(`/api/meetings/request`, {
//         receiver_id: String(meetTarget?.id),
//         slot, // {day,from,to}
//       });
//       toast.success("Meeting request sent");
//       window.dispatchEvent(
//         new CustomEvent("sgh:notify", {
//           detail: { type: "meeting_request", title: "New meeting request", slot },
//         })
//       );
//     } catch (e) {
//       console.error(e);
//       toast.error("Could not send meeting request");
//       throw e;
//     }
//   };

//   if (loading) return <div style={{ padding: 24, color: "#667085" }}>Loading…</div>;
//   if (!group) return <div style={{ padding: 24, color: "#ef4444" }}>Group not found.</div>;

//   return (
//     <>
//       <div style={pageWrap}>
//         <div style={container}>
//           {/* Top Bar */}
//           <div style={topRow}>
//             <button style={chipLink} onClick={goBack}>
//               ← Back to dashboard
//             </button>
//             <Link to={`/group/${gid}/polls`} style={chipLinkPoll}>
//               Open polls →
//             </Link>
//           </div>

//           {/* Hero */}
//           <div style={heroCard}>
//             <div style={courseRow}>
//               <span style={courseCode}>{group.course || "Course"}</span>
//               <span style={{ width: 8 }} />
//               <span style={group.isOpen ? openChip : closedChip}>
//                 <span style={group.isOpen ? openDot : closedDot} /> {group.isOpen ? "Open to join" : "Closed"}
//               </span>
//             </div>

//             <h3 style={h1}>{group.title}</h3>
//             {group.description && <div style={subtitle}>{group.description}</div>}

//             <div style={statsWrap}>
//               <StatCard label="Your role" value={isOwner ? "Owner" : amMember ? "Member" : "Visitor"} />
//               <StatCard label="Created" value={fmtTime(group.createdAt)} />
//               <StatCard
//                 label="Members"
//                 value={
//                   <button type="button" onClick={openMembers} style={membersLinkBtn}>
//                     {membersCount} {membersCount === 1 ? "member" : "members"}
//                   </button>
//                 }
//               />
//             </div>

//             <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
//               {(amMember || isOwner) && (
//                 <button style={btnGhost} onClick={leave}>
//                   Leave group
//                 </button>
//               )}
//               <Link
//                 to={`/group/${gid}/polls`}
//                 style={{
//                   background: "#4f46e5",
//                   color: "#ffffff",
//                   border: "1px solid #4f46e5",
//                   padding: "8px 12px",
//                   borderRadius: 999,
//                   fontWeight: 700,
//                   fontSize: 14,
//                   cursor: "pointer",
//                   textDecoration: "none",
//                 }}
//               >
//                 Manage polls
//               </Link>
//             </div>
//           </div>

//           {/* Content Grid */}
//           <div style={grid}>
//             {/* LEFT */}
//             <div style={col}>
//               {/* About */}
//               <section style={section}>
//                 <h3 style={sectionTitle}>About this group</h3>
//                 <p style={pMuted}>
//                   {group.longDescription ||
//                     "Use this space to coordinate study sessions, share notes, and plan labs or assignments. Check polls to choose times and topics."}
//                 </p>
//                 <div style={tagWrap}>
//                   {(group.tags?.length ? group.tags : ["forensics", "lab", "assignment", "exam-prep"]).map((t) => (
//                     <span key={t} style={tagChip}>
//                       #{t}
//                     </span>
//                   ))}
//                 </div>
//               </section>

//               {/* Study Checklist (local-only) */}
//               <section style={section}>
//                 <h3 style={sectionTitle}>Study checklist</h3>
//                 <ul style={listPlain}>
//                   {checklist.map((item) => (
//                     <li key={item.id} style={checkRow}>
//                       <label style={checkLabel}>
//                         <input
//                           type="checkbox"
//                           checked={item.done}
//                           onChange={(e) => {
//                             setChecklist((prev) =>
//                               prev.map((x) => (x.id === item.id ? { ...x, done: e.target.checked } : x))
//                             );
//                           }}
//                         />
//                         <span>{item.label}</span>
//                       </label>
//                       {item.done && <span style={pillDone}>Done</span>}
//                     </li>
//                   ))}
//                 </ul>
//               </section>

//               {/* Quick links */}
//               <section style={section}>
//                 <h3 style={sectionTitle}>Quick links</h3>
//                 <div style={quickGrid}>
//                   <Link to={`/group/${gid}/polls`} style={quickBtn}>
//                     Open polls
//                   </Link>
//                   <button style={quickBtn} onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
//                     Go to top
//                   </button>
//                 </div>
//               </section>
//             </div>

//             {/* RIGHT */}
//             <div style={col}>
//               {/* Guidelines */}
//               <section style={section}>
//                 <h3 style={sectionTitle}>Group guidelines</h3>
//                 <ul style={bullets}>
//                   <li>Be respectful and stay on-topic.</li>
//                   <li>Use polls for decisions (meeting time, topic, deadlines).</li>
//                   <li>Share resources with clear titles.</li>
//                   <li>Keep chat threads concise. Start a new thread for new topics.</li>
//                 </ul>
//               </section>

//               {/* Personal notes */}
//               <section style={section}>
//                 <h3 style={sectionTitle}>My notes</h3>
//                 <textarea
//                   placeholder="Write reminders or TODOs for this group. (Saved only on this browser)"
//                   value={notes}
//                   onChange={(e) => {
//                     setNotes(e.target.value);
//                     localStorage.setItem(`gd-notes-${gid}`, e.target.value);
//                   }}
//                   style={notesBox}
//                   rows={5}
//                 />
//                 <div style={{ marginTop: 8, fontSize: 12, color: "#6b7280" }}>
//                   Notes are stored locally and are private to you.
//                 </div>
//               </section>
//             </div>
//           </div>
//         </div>
//       </div>

//       {/* Chat */}
//       <div data-chat-dock>
//         <ChatDock gid={gid} groupTitle={group?.title} canChat={canChat} myId={myId} me={me} />
//       </div>

//       {/* Members modal */}
//       {membersOpen && (
//         <div style={backdrop} onClick={closeMembers}>
//           <div role="dialog" aria-modal="true" style={modal} onClick={(e) => e.stopPropagation()}>
//             <div style={modalHead}>
//               <h3 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Members · {group.title}</h3>
//               <button style={modalX} onClick={closeMembers} aria-label="Close">
//                 ✕
//               </button>
//             </div>

//             {!canSeeMembers ? (
//               <div style={{ padding: 12, color: "#6b7280" }}>Only group members can view the member list.</div>
//             ) : membersLoading ? (
//               <div style={{ padding: 12, color: "#6b7280" }}>Loading members…</div>
//             ) : members.length === 0 ? (
//               <div style={{ padding: 12, color: "#6b7280" }}>No members yet.</div>
//             ) : (
//               <ul style={memberList}>
//                 {members.map((m) => {
//                   const id = String(m?._id ?? m?.id ?? m?.userId ?? "");
//                   const bg = colorFromString(m.name || m.email);
//                   const you = isSelf(m);

//                   return (
//                     <li key={id || m.email} style={memberItem}>
//                       <div style={{ ...avatar, background: bg }} aria-hidden>
//                         {initials(m.name, m.email)}
//                       </div>
//                       <div style={{ flex: 1, minWidth: 0 }}>
//                         <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
//                           <div
//                             style={{
//                               fontWeight: 700,
//                               whiteSpace: "nowrap",
//                               textOverflow: "ellipsis",
//                               overflow: "hidden",
//                             }}
//                             title={m.name || m.email}
//                           >
//                             {m.name || m.email}
//                             {you ? " (You)" : ""}
//                           </div>
//                           {m.isOwner && (
//                             <span style={ownerChip} title="Group owner">
//                               <span style={ownerDot} /> Owner
//                             </span>
//                           )}
//                         </div>
//                         {m.email && <div style={emailSub}>{m.email}</div>}
//                       </div>

//                       {/* Action: Request meeting (hide for yourself) */}
//                       {!you && id && (
//                         <button
//                           style={btnReq}
//                           onClick={() => requestMeetingFor({ _id: id, name: m.name, email: m.email })}
//                           title="Propose a meeting"
//                         >
//                           Request meeting
//                         </button>
//                       )}
//                     </li>
//                   );
//                 })}
//               </ul>
//             )}
//           </div>
//         </div>
//       )}

//       {/* Meeting modal (now gets receiver info) */}
//       {meetOpen && (
//         <MeetingRequestModal
//           open={meetOpen}
//           onClose={() => setMeetOpen(false)}
//           onSend={sendMeeting}
//           savedSlots={savedSlots}
//           initial={meetInitial}
//           receiverId={meetTarget?.id}
//           receiverName={meetTarget?.name}
//           receiverEmail={meetTarget?.email}
//         />
//       )}

//       {/* Confirm modal */}
//       <ConfirmModal
//         open={confirmState.open}
//         title={confirmState.title}
//         message={confirmState.message}
//         onCancel={closeConfirm}
//         onConfirm={confirmState.onConfirm}
//       />
//     </>
//   );
// }

// /* small presentational bits */
// function StatCard({ label, value }) {
//   return (
//     <div style={statCard}>
//       <div>
//         <div style={{ color: "#6b7280", fontSize: 12, fontWeight: 700 }}>{label}</div>
//         <div
//           style={{
//             fontWeight: 800,
//             whiteSpace: "nowrap",
//             textOverflow: "ellipsis",
//             overflow: "hidden",
//             maxWidth: 260,
//           }}
//         >
//           {value}
//         </div>
//       </div>
//     </div>
//   );
// }

// function ConfirmModal({ open, title, message, onCancel, onConfirm }) {
//   if (!open) return null;
//   return (
//     <div style={backdrop} onClick={onCancel}>
//       <div role="dialog" aria-modal="true" style={modal} onClick={(e) => e.stopPropagation()}>
//         <div style={modalHead}>
//           <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>{title || "Are you sure?"}</h3>
//           <button style={modalX} onClick={onCancel} aria-label="Close">
//             ✕
//           </button>
//         </div>
//         <div style={{ color: "#374151", marginBottom: 12 }}>{message || ""}</div>
//         <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
//           <button style={btnGhost} onClick={onCancel}>
//             Cancel
//           </button>
//           <button style={btnPrimary} onClick={() => onConfirm && onConfirm()}>
//             Confirm
//           </button>
//         </div>
//       </div>
//     </div>
//   );
// }

// /* =============== styles =============== */
// const pageWrap = {
//   padding: "32px 16px 72px",
//   minHeight: "calc(100vh - 80px)",
//   background: "linear-gradient(180deg,#f8f9ff 0%, #ffffff 100%)",
// };

// const container = {
//   width: "min(1100px, 96vw)",
//   margin: "0 auto",
// };

// const topRow = {
//   display: "flex",
//   justifyContent: "space-between",
//   alignItems: "center",
//   marginBottom: 16,
// };

// const heroCard = {
//   width: "100%",
//   background: "linear-gradient(180deg,#ffffff,#fafaff)",
//   borderRadius: 16,
//   border: "1px solid #EEF0F5",
//   boxShadow: "0 18px 60px rgba(2,6,23,0.06)",
//   padding: 18,
// };

// const courseRow = { display: "flex", alignItems: "center", gap: 6, color: "#6b7280", fontWeight: 700 };
// const courseCode = {
//   background: "#EEF2FF",
//   border: "1px solid #E0E7FF",
//   color: "#4f46e5",
//   padding: "2px 8px",
//   borderRadius: 999,
//   fontWeight: 800,
//   fontSize: 12,
// };

// const h1 = { margin: "8px 0 6px", fontSize: 24, lineHeight: 1.15, fontWeight: 800 };
// const subtitle = { color: "#111827" };

// const statsWrap = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10, marginTop: 10 };
// const statCard = { border: "1px solid #EEF0F5", borderRadius: 12, background: "#fff", padding: 12 };

// const chipLink = {
//   background: "#F4F6FF",
//   color: "#4f46e5",
//   border: "1px solid #E3E8FF",
//   padding: "8px 12px",
//   borderRadius: 999,
//   fontWeight: 700,
//   fontSize: 14,
//   cursor: "pointer",
// };
// const chipLinkPoll = {
//   background: "#F4F6FF",
//   color: "#4f46e5",
//   border: "1px solid #E3E8FF",
//   padding: "8px 12px",
//   borderRadius: 999,
//   fontWeight: 700,
//   fontSize: 14,
//   cursor: "pointer",
//   textDecoration: "none",
// };
// const btnGhost = {
//   background: "#fff",
//   color: "#6b7280",
//   border: "1px solid #e5e7eb",
//   padding: "10px 14px",
//   borderRadius: 10,
//   fontWeight: 700,
//   cursor: "pointer",
// };
// const btnPrimary = {
//   background: "linear-gradient(180deg,#5b7cfa,#4f46e5)",
//   color: "#fff",
//   border: 0,
//   padding: "10px 14px",
//   borderRadius: 10,
//   fontWeight: 800,
//   cursor: "pointer",
// };

// const btnReq = {
//   background: "#EEF2FF",
//   color: "#4f46e5",
//   border: "1px solid #DBE2FF",
//   padding: "8px 12px",
//   borderRadius: 999,
//   fontWeight: 800,
//   cursor: "pointer",
//   whiteSpace: "nowrap",
// };

// const membersLinkBtn = {
//   appearance: "none",
//   background: "transparent",
//   border: 0,
//   color: "#4f46e5",
//   fontWeight: 800,
//   fontSize: 14,
//   padding: 0,
//   textDecoration: "none",
//   cursor: "pointer",
// };

// const grid = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 };
// const col = { display: "flex", flexDirection: "column", gap: 16 };

// const section = {
//   border: "1px solid #EEF0F5",
//   background: "#fff",
//   borderRadius: 14,
//   padding: 14,
//   boxShadow: "0 6px 24px rgba(2,6,23,0.04)",
// };
// const sectionTitle = { margin: 0, marginBottom: 8, fontSize: 16, fontWeight: 900 };

// const tagWrap = { display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 };
// const tagChip = {
//   background: "#F5F3FF",
//   border: "1px solid #EDE9FE",
//   color: "#6D28D9",
//   padding: "4px 10px",
//   borderRadius: 999,
//   fontWeight: 800,
//   fontSize: 12,
// };

// const listPlain = { listStyle: "none", padding: 0, margin: 0 };
// const pMuted = { color: "#374151", margin: 0 };

// const quickGrid = { display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 8 };
// const quickBtn = { ...btnGhost, textAlign: "center", borderRadius: 999, padding: "10px 12px", textDecoration: "none" };

// const bullets = { margin: "4px 0 0 18px", color: "#374151" };

// const emailSub = {
//   color: "#6b7280",
//   fontSize: 12,
//   whiteSpace: "nowrap",
//   textOverflow: "ellipsis",
//   overflow: "hidden",
//   marginTop: 2,
// };

// const ownerChip = {
//   display: "inline-flex",
//   alignItems: "center",
//   gap: 6,
//   padding: "2px 8px",
//   borderRadius: 999,
//   background: "#FFF7E6",
//   border: "1px solid #FFE3A3",
//   color: "#A16207",
//   fontSize: 12,
//   fontWeight: 700,
//   lineHeight: 1,
// };
// const ownerDot = {
//   width: 8,
//   height: 8,
//   borderRadius: "50%",
//   background: "linear-gradient(180deg,#F59E0B,#D97706)",
//   boxShadow: "0 0 0 3px #FFF2CC",
// };

// const openChip = {
//   display: "inline-flex",
//   alignItems: "center",
//   gap: 6,
//   padding: "2px 8px",
//   borderRadius: 999,
//   background: "#ECFEFF",
//   border: "1px solid #BAE6FD",
//   color: "#075985",
//   fontSize: 12,
//   fontWeight: 800,
// };
// const openDot = {
//   width: 8,
//   height: 8,
//   borderRadius: "50%",
//   background: "linear-gradient(180deg,#38BDF8,#0EA5E9)",
//   boxShadow: "0 0 0 3px #DFF5FF",
// };
// const closedChip = {
//   display: "inline-flex",
//   alignItems: "center",
//   gap: 6,
//   padding: "2px 8px",
//   borderRadius: 999,
//   background: "#FEF2F2",
//   border: "1px solid #FECACA",
//   color: "#991B1B",
//   fontSize: 12,
//   fontWeight: 800,
// };
// const closedDot = {
//   width: 8,
//   height: 8,
//   borderRadius: "50%",
//   background: "linear-gradient(180deg,#F87171,#DC2626)",
//   boxShadow: "0 0 0 3px #FFE2E2",
// };

// const checkRow = {
//   display: "flex",
//   alignItems: "center",
//   justifyContent: "space-between",
//   padding: "8px 0",
//   borderBottom: "1px dashed #eef0f5",
// };
// const checkLabel = { display: "flex", alignItems: "center", gap: 8, fontWeight: 600 };
// const pillDone = {
//   background: "#DCFCE7",
//   border: "1px solid #86EFAC",
//   color: "#166534",
//   padding: "2px 8px",
//   borderRadius: 999,
//   fontSize: 12,
//   fontWeight: 800,
// };

// const notesBox = {
//   width: "100%",
//   border: "1px solid #e5e7eb",
//   borderRadius: 10,
//   padding: 10,
//   outline: "none",
//   fontFamily: "inherit",
// };

// const backdrop = {
//   position: "fixed",
//   inset: 0,
//   background: "rgba(0,0,0,0.45)",
//   display: "flex",
//   alignItems: "center",
//   justifyContent: "center",
//   padding: 16,
//   zIndex: 50,
// };
// const modal = {
//   width: "min(900px, 96vw)",
//   background: "#fff",
//   borderRadius: 18,
//   border: "1px solid #EDF0F5",
//   boxShadow: "0 18px 60px rgba(0,0,0,0.20)",
//   padding: 16,
// };
// const modalHead = { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 };
// const modalX = {
//   appearance: "none",
//   border: 0,
//   background: "#f3f4f6",
//   color: "#111827",
//   width: 36,
//   height: 36,
//   borderRadius: 10,
//   cursor: "pointer",
// };

// const memberList = { listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 10, maxHeight: "60vh", overflow: "auto" };
// const memberItem = {
//   display: "flex",
//   alignItems: "center",
//   gap: 10,
//   padding: "12px 14px",
//   border: "1px solid #eef0f5",
//   borderRadius: 12,
//   background: "#fff",
// };
// const avatar = {
//   width: 34,
//   height: 34,
//   borderRadius: "50%",
//   display: "grid",
//   placeItems: "center",
//   fontWeight: 800,
//   color: "#111827",
//   border: "1px solid #e5e7eb",
// };

// frontend/src/pages/GroupDetail.jsx
import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { toast } from "react-toastify";
import ChatDock from "../components/ChatDock";
import MeetingRequestModal from "../components/MeetingRequestModal.jsx";

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

/* small helpers */
const fmtTime = (iso) =>
  iso ? new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "—";
const initials = (name = "", email = "") => {
  const src = name || email || "?";
  const parts = src.replace(/\s+/g, " ").trim().split(" ");
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
};
const colorFromString = (s) => {
  const palette = ["#D6E4FF", "#FDE68A", "#FBD5D5", "#D1FAE5", "#E9D5FF", "#C7F9FF", "#FFE4E6", "#F5F3FF"];
  let h = 0;
  for (let i = 0; i < (s || "").length; i++) h = (h * 31 + s.charCodeAt(i)) % 9973;
  return palette[h % palette.length];
};

export default function GroupDetail() {
  const { gid } = useParams();
  const navigate = useNavigate();

  const me = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}");
    } catch {
      return {};
    }
  }, []);
  const myId = useMemo(() => String(me?._id ?? me?.id ?? me?.userId ?? ""), [me]);

  const [loading, setLoading] = useState(true);
  const [group, setGroup] = useState(null);

  // members modal
  const [membersOpen, setMembersOpen] = useState(false);
  const [members, setMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(false);

  // local-only extras
  const [notes, setNotes] = useState("");
  const [checklist, setChecklist] = useState(() => {
    const saved = localStorage.getItem("gd-checklist");
    return saved
      ? JSON.parse(saved)
      : [
          { id: "read", label: "Review this week's readings", done: false },
          { id: "lab", label: "Prepare lab notebook", done: false },
          { id: "quiz", label: "Practice quiz questions", done: false },
          { id: "meet", label: "Confirm next study session time", done: false },
        ];
  });

  // confirm modal
  const [confirmState, setConfirmState] = useState({ open: false, title: "", message: "", onConfirm: null });
  const askConfirm = (title, message, onConfirm) => setConfirmState({ open: true, title, message, onConfirm });
  const closeConfirm = () => setConfirmState({ open: false, title: "", message: "", onConfirm: null });

  // meeting request modal
  const [meetOpen, setMeetOpen] = useState(false);
  const [meetTarget, setMeetTarget] = useState(null); // { id, name, email }
  const [meetInitial, setMeetInitial] = useState(null);
  const [savedSlots, setSavedSlots] = useState([]);

  const loadGroup = async () => {
    try {
      setLoading(true);
      const g = await apiGet(`/api/groups/${gid}`);
      setGroup(g);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load group");
    } finally {
      setLoading(false);
    }
  };

  const loadMyAvailability = async () => {
    try {
      const mine = await apiGet(`/api/availability/list`);
      setSavedSlots(
        (Array.isArray(mine) ? mine : []).map((r) => ({ day: r.day, from: r.from, to: r.to }))
      );
    } catch {
      setSavedSlots([]);
    }
  };

  useEffect(() => {
    loadGroup();
  }, [gid, myId]);

  useEffect(() => {
    const key = `gd-notes-${gid}`;
    const savedNotes = localStorage.getItem(key);
    if (savedNotes != null) setNotes(savedNotes);
  }, [gid]);

  useEffect(() => {
    localStorage.setItem("gd-checklist", JSON.stringify(checklist));
  }, [checklist]);

  const isOwner = !!group?.isOwner;
  const amMember = group?.myJoinStatus === "member";
  const canSeeMembers = isOwner || amMember;
  const canChat = isOwner || amMember;
  const membersCount = group?.membersCount ?? group?.members?.length ?? 0;

  const leave = () =>
    askConfirm("Leave group?", "Are you sure you want to leave this group?", async () => {
      try {
        await apiPost(`/api/groups/leave/${gid}`);
        toast.success("Left group");
        navigate("/dashboard");
      } catch {
        toast.error("Could not leave group");
      } finally {
        closeConfirm();
      }
    });

  const goBack = () =>
    askConfirm("Back to dashboard?", "You'll return to your groups.", () => {
      closeConfirm();
      navigate("/dashboard");
    });

  const isSelf = useCallback(
    (m) => {
      const mid = String(m?._id ?? m?.id ?? m?.userId ?? "");
      if (myId && mid && myId === mid) return true;
      if (m?.email && me?.email && m.email.toLowerCase() === me.email.toLowerCase()) return true;
      return false;
    },
    [me?.email, myId]
  );

  const openMembers = async () => {
    setMembersOpen(true);
    if (!canSeeMembers) {
      setMembers([]);
      return;
    }
    try {
      setMembersLoading(true);
      const rows = await apiGet(`/api/groups/${gid}/members`);
      setMembers(Array.isArray(rows) ? rows : []);
    } catch {
      setMembers([]);
      toast.error("Could not load members");
    } finally {
      setMembersLoading(false);
    }
  };
  const closeMembers = () => {
    setMembersOpen(false);
    setMembers([]);
  };

  // open meeting modal for a chosen member
  const requestMeetingFor = async (member) => {
    const id = String(member?._id ?? member?.id ?? member?.userId ?? "");
    setMeetTarget({ id, name: member?.name || "", email: member?.email || "" });
    setMeetInitial(null);
    await loadMyAvailability();
    setMeetOpen(true);
  };

  // send meeting request
  const sendMeeting = async (slot) => {
    try {
      await apiPost(`/api/meetings/request`, {
        receiver_id: String(meetTarget?.id),
        slot, // {day,from,to}
      });
      toast.success("Meeting request sent");
      // window.dispatchEvent(
      //   new CustomEvent("sgh:notify", {
      //     detail: { type: "meeting_request", title: "New meeting request", slot },
      //   })
      // );
    } catch (e) {
      console.error(e);
      toast.error("Could not send meeting request");
      throw e;
    }
  };

  if (loading) return <div style={{ padding: 24, color: "#667085" }}>Loading…</div>;
  if (!group) return <div style={{ padding: 24, color: "#ef4444" }}>Group not found.</div>;

  return (
    <>
      <div style={pageWrap}>
        <div style={container}>
          {/* Top Bar */}
          <div style={topRow}>
            <button style={chipLink} onClick={goBack}>← Back to dashboard</button>
            <Link to={`/group/${gid}/polls`} style={chipLinkPoll}>Open polls →</Link>
          </div>

          {/* Hero */}
          <div style={heroCard}>
            <div style={courseRow}>
              <span style={courseCode}>{group.course || "Course"}</span>
              <span style={{ width: 8 }} />
              <span style={group.isOpen ? openChip : closedChip}>
                <span style={group.isOpen ? openDot : closedDot} /> {group.isOpen ? "Open to join" : "Closed"}
              </span>
            </div>

            <h3 style={h1}>{group.title}</h3>
            {group.description && <div style={subtitle}>{group.description}</div>}

            <div style={statsWrap}>
              <StatCard label="Your role" value={isOwner ? "Owner" : amMember ? "Member" : "Visitor"} />
              <StatCard label="Created" value={fmtTime(group.createdAt)} />
              <StatCard
                label="Members"
                value={
                  <button type="button" onClick={openMembers} style={membersLinkBtn}>
                    {membersCount} {membersCount === 1 ? "member" : "members"}
                  </button>
                }
              />
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
              {(amMember || isOwner) && <button style={btnGhost} onClick={leave}>Leave group</button>}
              <Link
                to={`/group/${gid}/polls`}
                style={{
                  background: "#4f46e5",
                  color: "#ffffff",
                  border: "1px solid #4f46e5",
                  padding: "8px 12px",
                  borderRadius: 999,
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: "pointer",
                  textDecoration: "none",
                }}
              >
                Manage polls
              </Link>
            </div>
          </div>

          {/* Content Grid */}
          <div style={grid}>
            {/* LEFT */}
            <div style={col}>
              <section style={section}>
                <h3 style={sectionTitle}>About this group</h3>
                <p style={pMuted}>
                  {group.longDescription ||
                    "Use this space to coordinate study sessions, share notes, and plan labs or assignments. Check polls to choose times and topics."}
                </p>
                <div style={tagWrap}>
                  {(group.tags?.length ? group.tags : ["forensics", "lab", "assignment", "exam-prep"]).map((t) => (
                    <span key={t} style={tagChip}>#{t}</span>
                  ))}
                </div>
              </section>

              <section style={section}>
                <h3 style={sectionTitle}>Study checklist</h3>
                <ul style={listPlain}>
                  {checklist.map((item) => (
                    <li key={item.id} style={checkRow}>
                      <label style={checkLabel}>
                        <input
                          type="checkbox"
                          checked={item.done}
                          onChange={(e) => {
                            setChecklist((prev) =>
                              prev.map((x) => (x.id === item.id ? { ...x, done: e.target.checked } : x))
                            );
                          }}
                        />
                        <span>{item.label}</span>
                      </label>
                      {item.done && <span style={pillDone}>Done</span>}
                    </li>
                  ))}
                </ul>
              </section>

              <section style={section}>
                <h3 style={sectionTitle}>Quick links</h3>
                <div style={quickGrid}>
                  <Link to={`/group/${gid}/polls`} style={quickBtn}>Open polls</Link>
                  <button style={quickBtn} onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
                    Go to top
                  </button>
                </div>
              </section>
            </div>

            {/* RIGHT */}
            <div style={col}>
              <section style={section}>
                <h3 style={sectionTitle}>Group guidelines</h3>
                <ul style={bullets}>
                  <li>Be respectful and stay on-topic.</li>
                  <li>Use polls for decisions (meeting time, topic, deadlines).</li>
                  <li>Share resources with clear titles.</li>
                  <li>Keep chat threads concise. Start a new thread for new topics.</li>
                </ul>
              </section>

              <section style={section}>
                <h3 style={sectionTitle}>My notes</h3>
                <textarea
                  placeholder="Write reminders or TODOs for this group. (Saved only on this browser)"
                  value={notes}
                  onChange={(e) => {
                    setNotes(e.target.value);
                    localStorage.setItem(`gd-notes-${gid}`, e.target.value);
                  }}
                  style={notesBox}
                  rows={5}
                />
                <div style={{ marginTop: 8, fontSize: 12, color: "#6b7280" }}>
                  Notes are stored locally and are private to you.
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>

      {/* Chat */}
      <div data-chat-dock>
        <ChatDock gid={gid} groupTitle={group?.title} canChat={canChat} myId={myId} me={me} />
      </div>

      {/* Members modal */}
      {membersOpen && (
        <div style={backdrop} onClick={closeMembers}>
          <div role="dialog" aria-modal="true" style={modal} onClick={(e) => e.stopPropagation()}>
            <div style={modalHead}>
              <h3 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Members · {group.title}</h3>
              <button style={modalX} onClick={closeMembers} aria-label="Close">✕</button>
            </div>

            {!canSeeMembers ? (
              <div style={{ padding: 12, color: "#6b7280" }}>Only group members can view the member list.</div>
            ) : membersLoading ? (
              <div style={{ padding: 12, color: "#6b7280" }}>Loading members…</div>
            ) : members.length === 0 ? (
              <div style={{ padding: 12, color: "#6b7280" }}>No members yet.</div>
            ) : (
              <ul style={memberList}>
                {members.map((m) => {
                  const id = String(m?._id ?? m?.id ?? m?.userId ?? "");
                  const bg = colorFromString(m.name || m.email);
                  const you = isSelf(m);
                  return (
                    <li key={id || m.email} style={memberItem}>
                      <div style={{ ...avatar, background: bg }} aria-hidden>{initials(m.name, m.email)}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }} title={m.name || m.email}>
                            {m.name || m.email}{you ? " (You)" : ""}
                          </div>
                          {m.isOwner && (
                            <span style={ownerChip} title="Group owner"><span style={ownerDot} /> Owner</span>
                          )}
                        </div>
                        {m.email && <div style={emailSub}>{m.email}</div>}
                      </div>

                      {!you && id && (
                        <button style={btnReq} onClick={() => requestMeetingFor(m)} title="Propose a meeting">
                          Request meeting
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Meeting modal */}
      {meetOpen && (
        <MeetingRequestModal
          open={meetOpen}
          onClose={() => setMeetOpen(false)}
          onSend={sendMeeting}
          savedSlots={savedSlots}
          initial={meetInitial}
          receiverId={meetTarget?.id}
          receiverName={meetTarget?.name}
          receiverEmail={meetTarget?.email}
        />
      )}

      {/* Confirm modal */}
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

/* small presentational bits (unchanged except for btnReq) */
function StatCard({ label, value }) {
  return (
    <div style={statCard}>
      <div>
        <div style={{ color: "#6b7280", fontSize: 12, fontWeight: 700 }}>{label}</div>
        <div style={{ fontWeight: 800, whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden", maxWidth: 260 }}>
          {value}
        </div>
      </div>
    </div>
  );
}

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

/* =============== styles (same as yours; + btnReq) =============== */
const pageWrap = { padding: "32px 16px 72px", minHeight: "calc(100vh - 80px)", background: "linear-gradient(180deg,#f8f9ff 0%, #ffffff 100%)" };
const container = { width: "min(1100px, 96vw)", margin: "0 auto" };
const topRow = { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 };
const heroCard = { width: "100%", background: "linear-gradient(180deg,#ffffff,#fafaff)", borderRadius: 16, border: "1px solid #EEF0F5", boxShadow: "0 18px 60px rgba(2,6,23,0.06)", padding: 18 };
const courseRow = { display: "flex", alignItems: "center", gap: 6, color: "#6b7280", fontWeight: 700 };
const courseCode = { background: "#EEF2FF", border: "1px solid #E0E7FF", color: "#4f46e5", padding: "2px 8px", borderRadius: 999, fontWeight: 800, fontSize: 12 };
const h1 = { margin: "8px 0 6px", fontSize: 24, lineHeight: 1.15, fontWeight: 800 };
const subtitle = { color: "#111827" };
const statsWrap = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10, marginTop: 10 };
const statCard = { border: "1px solid #EEF0F5", borderRadius: 12, background: "#fff", padding: 12 };
const chipLink = { background: "#F4F6FF", color: "#4f46e5", border: "1px solid #E3E8FF", padding: "8px 12px", borderRadius: 999, fontWeight: 700, fontSize: 14, cursor: "pointer" };
const chipLinkPoll = { ...chipLink, textDecoration: "none" };
const btnGhost = { background: "#fff", color: "#6b7280", border: "1px solid #e5e7eb", padding: "10px 14px", borderRadius: 10, fontWeight: 700, cursor: "pointer" };
const btnPrimary = { background: "linear-gradient(180deg,#5b7cfa,#4f46e5)", color: "#fff", border: 0, padding: "10px 14px", borderRadius: 10, fontWeight: 800, cursor: "pointer" };
const btnReq = { background: "#EEF2FF", color: "#4f46e5", border: "1px solid #DBE2FF", padding: "8px 12px", borderRadius: 999, fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap" };
const membersLinkBtn = { appearance: "none", background: "transparent", border: 0, color: "#4f46e5", fontWeight: 800, fontSize: 14, padding: 0, textDecoration: "none", cursor: "pointer" };
const grid = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 };
const col = { display: "flex", flexDirection: "column", gap: 16 };
const section = { border: "1px solid #EEF0F5", background: "#fff", borderRadius: 14, padding: 14, boxShadow: "0 6px 24px rgba(2,6,23,0.04)" };
const sectionTitle = { margin: 0, marginBottom: 8, fontSize: 16, fontWeight: 900 };
const tagWrap = { display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 };
const tagChip = { background: "#F5F3FF", border: "1px solid #EDE9FE", color: "#6D28D9", padding: "4px 10px", borderRadius: 999, fontWeight: 800, fontSize: 12 };
const listPlain = { listStyle: "none", padding: 0, margin: 0 };
const pMuted = { color: "#374151", margin: 0 };
const quickGrid = { display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 8 };
const quickBtn = { ...btnGhost, textAlign: "center", borderRadius: 999, padding: "10px 12px", textDecoration: "none" };
const bullets = { margin: "4px 0 0 18px", color: "#374151" };
const emailSub = { color: "#6b7280", fontSize: 12, whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden", marginTop: 2 };
const ownerChip = { display: "inline-flex", alignItems: "center", gap: 6, padding: "2px 8px", borderRadius: 999, background: "#FFF7E6", border: "1px solid #FFE3A3", color: "#A16207", fontSize: 12, fontWeight: 700, lineHeight: 1 };
const ownerDot = { width: 8, height: 8, borderRadius: "50%", background: "linear-gradient(180deg,#F59E0B,#D97706)", boxShadow: "0 0 0 3px #FFF2CC" };
const openChip = { display: "inline-flex", alignItems: "center", gap: 6, padding: "2px 8px", borderRadius: 999, background: "#ECFEFF", border: "1px solid #BAE6FD", color: "#075985", fontSize: 12, fontWeight: 800 };
const openDot = { width: 8, height: 8, borderRadius: "50%", background: "linear-gradient(180deg,#38BDF8,#0EA5E9)", boxShadow: "0 0 0 3px #DFF5FF" };
const closedChip = { display: "inline-flex", alignItems: "center", gap: 6, padding: "2px 8px", borderRadius: 999, background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", fontSize: 12, fontWeight: 800 };
const closedDot = { width: 8, height: 8, borderRadius: "50%", background: "linear-gradient(180deg,#F87171,#DC2626)", boxShadow: "0 0 0 3px #FFE2E2" };
const checkRow = { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px dashed #eef0f5" };
const checkLabel = { display: "flex", alignItems: "center", gap: 8, fontWeight: 600 };
const pillDone = { background: "#DCFCE7", border: "1px solid #86EFAC", color: "#166534", padding: "2px 8px", borderRadius: 999, fontSize: 12, fontWeight: 800 };
const notesBox = { width: "100%", border: "1px solid #e5e7eb", borderRadius: 10, padding: 10, outline: "none", fontFamily: "inherit" };
const backdrop = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 50 };
const modal = { width: "min(900px, 96vw)", background: "#fff", borderRadius: 18, border: "1px solid #EDF0F5", boxShadow: "0 18px 60px rgba(0,0,0,0.20)", padding: 16 };
const modalHead = { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 };
const modalX = { appearance: "none", border: 0, background: "#f3f4f6", color: "#111827", width: 36, height: 36, borderRadius: 10, cursor: "pointer" };
const memberList = { listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 10, maxHeight: "60vh", overflow: "auto" };
const memberItem = { display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", border: "1px solid #eef0f5", borderRadius: 12, background: "#fff" };
const avatar = { width: 34, height: 34, borderRadius: "50%", display: "grid", placeItems: "center", fontWeight: 800, color: "#111827", border: "1px solid #e5e7eb" };
