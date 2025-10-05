// import { useEffect, useMemo, useState, useCallback } from "react";
// import { useNavigate, useParams } from "react-router-dom";
// import { toast } from "react-toastify";
// import ChatDock from "../components/ChatDock";

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

// /* --------------- Helpers --------------- */
// const MODE_LABEL = { either: "Either", online: "Online", oncampus: "On-Campus" };
// const normalizeMode = (v) => {
//   const s = String(v || "").toLowerCase().trim();
//   if (["on-campus", "campus", "offline"].includes(s)) return "oncampus";
//   if (s === "online") return "online";
//   return "either";
// };
// const fmtTime = (iso) =>
//   iso ? new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "—";

// const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

// /* Derive a pastel color from a string (for avatar) */
// function colorFromString(s) {
//   const palette = ["#D6E4FF", "#FDE68A", "#FBD5D5", "#D1FAE5", "#E9D5FF", "#C7F9FF", "#FFE4E6", "#F5F3FF"];
//   let h = 0;
//   for (let i = 0; i < (s || "").length; i++) h = (h * 31 + s.charCodeAt(i)) % 9973;
//   return palette[h % palette.length];
// }
// const initials = (name = "", email = "") => {
//   const src = name || email || "?";
//   const parts = src.replace(/\s+/g, " ").trim().split(" ");
//   if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
//   return (parts[0][0] + parts[1][0]).toUpperCase();
// };

// /* ================== PAGE ================== */
// export default function GroupDetail() {
//   const { gid } = useParams();
//   const navigate = useNavigate();

//   const me = useMemo(() => {
//     try { return JSON.parse(localStorage.getItem("user") || "{}"); } catch { return {}; }
//   }, []);
//   const myId = useMemo(() => String(me?._id ?? me?.id ?? me?.userId ?? ""), [me]);

//   const [loading, setLoading] = useState(true);
//   const [group, setGroup] = useState(null);

//   // members modal
//   const [membersOpen, setMembersOpen] = useState(false);
//   const [members, setMembers] = useState([]);
//   const [membersLoading, setMembersLoading] = useState(false);

//   // meeting mode (my pref)
//   const [modeLoading, setModeLoading] = useState(true);
//   const [meetingMode, setMeetingMode] = useState("either");
//   const [savedMode, setSavedMode] = useState("either");
//   const [savingMode, setSavingMode] = useState(false);

//   // create poll modal
//   const [pollOpen, setPollOpen] = useState(false);
//   const [pollTitle, setPollTitle] = useState("");
//   const [pollMode, setPollMode] = useState("either");
//   const [slotInputs, setSlotInputs] = useState(["", "", ""]); // dynamic UI
//   const [creating, setCreating] = useState(false);

//   // polls list + vote modal
//   const [pollsLoading, setPollsLoading] = useState(false);
//   const [polls, setPolls] = useState([]);
//   const [voteOpen, setVoteOpen] = useState(false);
//   const [activePoll, setActivePoll] = useState(null);
//   const [selectedSlotId, setSelectedSlotId] = useState(""); // single-choice
//   const [submittingVote, setSubmittingVote] = useState(false);

//   // confirmation modal (generic)
//   const [confirmState, setConfirmState] = useState({ open: false, title: "", message: "", onConfirm: null });
//   const askConfirm = (title, message, onConfirm) => setConfirmState({ open: true, title, message, onConfirm });
//   const closeConfirm = () => setConfirmState({ open: false, title: "", message: "", onConfirm: null });

//   /* ---------- load group & my prefs ---------- */
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
//   const loadMyPrefs = async () => {
//     try {
//       setModeLoading(true);
//       const r = await apiGet("/api/me/prefs");
//       const m = normalizeMode(r?.meetingMode);
//       setMeetingMode(m);
//       setSavedMode(m);
//       setPollMode(m);
//     } catch {/* ignore */}
//     finally { setModeLoading(false); }
//   };
//   const loadPolls = async () => {
//     try {
//       setPollsLoading(true);
//       const rows = await apiGet(`/api/groups/${gid}/meeting-polls`);
//       setPolls(Array.isArray(rows) ? rows : []);
//     } catch {
//       setPolls([]);
//     } finally { setPollsLoading(false); }
//   };

//   useEffect(() => {
//     loadGroup();
//     loadMyPrefs();
//     loadPolls();
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [gid, myId]);

//   const isOwner = !!group?.isOwner;
//   const amMember = group?.myJoinStatus === "member";
//   const canSeeMembers = isOwner || amMember;
//   const canChat = isOwner || amMember;
//   const membersCount = group?.membersCount ?? group?.members?.length ?? 0;

//   /* ---------- actions ---------- */
//   const leave = () =>
//     askConfirm("Leave group?", "Are you sure you want to leave this group?", async () => {
//       try {
//         await apiPost(`/api/groups/leave/${gid}`);
//         toast.success("Left group");
//         navigate("/dashboard");
//       } catch {
//         toast.error("Could not leave group");
//       } finally { closeConfirm(); }
//     });

//   const goBack = () =>
//     askConfirm("Back to dashboard?", "You'll return to your groups.", () => {
//       closeConfirm();
//       navigate("/dashboard");
//     });

//   const saveMeetingMode = async () => {
//     try {
//       setSavingMode(true);
//       const r = await apiPost("/api/me/prefs", { meetingMode });
//       const saved = normalizeMode(r?.meetingMode);
//       setSavedMode(saved); setMeetingMode(saved); setPollMode(saved);
//       toast.success("Meeting mode saved");
//     } catch { toast.error("Could not save meeting mode"); }
//     finally { setSavingMode(false); }
//   };

//   /* ---------- Create Poll (modal) ---------- */
//   const openCreatePoll = () => {
//     setPollTitle(""); setPollMode(meetingMode);
//     setSlotInputs(["", "", ""]);
//     setPollOpen(true);
//   };
//   const closeCreatePoll = () => setPollOpen(false);

//   const addSlotInput = () => {
//     setSlotInputs((arr) => (arr.length >= 6 ? arr : [...arr, ""]));
//   };
//   const removeSlotInput = (idx) => {
//     setSlotInputs((arr) => arr.filter((_, i) => i !== idx));
//   };

//   const createPoll = async () => {
//     const slots = slotInputs
//       .filter(Boolean)
//       .map((v) => {
//         const d = new Date(v);
//         return isNaN(d.getTime()) ? null : d.toISOString();
//       })
//       .filter(Boolean);

//     if (!pollTitle.trim()) return toast.warn("Give the poll a title.");
//     if (slots.length === 0) return toast.warn("Add at least one valid time slot.");

//     try {
//       setCreating(true);
//       await apiPost(`/api/groups/${gid}/meeting-polls`, { title: pollTitle.trim(), mode: pollMode, slots });
//       toast.success("Poll created");
//       setPollOpen(false);
//       loadPolls();
//     } catch { toast.error("Could not create poll"); }
//     finally { setCreating(false); }
//   };

//   /* ---------- vote modal ---------- */
//   const openVote = (poll) => {
//     setActivePoll(poll);
//     const voted = (poll?.slots || []).find((s) => !!s.voted);
//     setSelectedSlotId(voted?.slotId || "");
//     setVoteOpen(true);
//   };
//   const closeVote = () => { setActivePoll(null); setSelectedSlotId(""); setVoteOpen(false); };

//   const submitVote = async () => {
//     if (!activePoll) return;
//     if (!selectedSlotId) return toast.warn("Pick one time slot.");
//     askConfirm("Save vote?", "Confirm your selected meeting time.", async () => {
//       try {
//         setSubmittingVote(true);
//         await apiPost(`/api/groups/${gid}/meeting-polls/${activePoll.id || activePoll._id}/vote`, { slotId: selectedSlotId });
//         toast.success("Vote saved");
//         closeVote();
//         loadPolls();
//       } catch { toast.error("Could not save vote"); }
//       finally { setSubmittingVote(false); closeConfirm(); }
//     });
//   };

//   /* ---------- members modal helpers ---------- */
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
//     if (!canSeeMembers) { setMembers([]); return; }
//     try {
//       setMembersLoading(true);
//       const rows = await apiGet(`/api/groups/${gid}/members`);
//       setMembers(Array.isArray(rows) ? rows : []);
//     } catch {
//       setMembers([]); toast.error("Could not load members");
//     } finally { setMembersLoading(false); }
//   };
//   const closeMembers = () => { setMembersOpen(false); setMembers([]); };

//   useEffect(() => {
//     if (!membersOpen && !pollOpen && !voteOpen) return;
//     const onKey = (e) =>
//       e.key === "Escape" &&
//       (membersOpen ? closeMembers() : pollOpen ? closeCreatePoll() : closeVote());
//     window.addEventListener("keydown", onKey);
//     return () => window.removeEventListener("keydown", onKey);
//   }, [membersOpen, pollOpen, voteOpen]);

//   if (loading) {
//     return (
//       <div style={pageWrap}>
//         <div style={heroCard}>
//           <div style={{ height: 28, width: 320, background: "#EEF1FF", borderRadius: 8 }} />
//           <div style={{ marginTop: 8, height: 14, width: 160, background: "#F3F4F6", borderRadius: 6 }} />
//         </div>
//         <div style={{ ...cardWide, marginTop: 16 }}>
//           <div style={{ height: 120, background: "#FAFAFA", borderRadius: 12 }} />
//         </div>
//       </div>
//     );
//   }
//   if (!group) return <div style={{ padding: 24, color: "#ef4444" }}>Group not found.</div>;

//   const isOwnerOrMember = isOwner || amMember;

//   /* === derived for poll progress bars === */
//   const memberBase = Math.max(1, Number(membersCount || 1)); // avoid /0

//   return (
//     <>
//       {/* page chrome */}
//       <div style={pageWrap}>
//         <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
//           <button style={chipLink} onClick={goBack}>← Back to dashboard</button>
//         </div>

//         {/* hero */}
//         <div style={heroCard}>
//           <div>
//             <div style={courseRow}>
//               <span style={courseCode}>{group.course || "Course"}</span>
//               <span style={{ width: 8 }} />
//               <StatusBadge open={group.isOpen} />
//             </div>
//             <h1 style={h1}>{group.title}</h1>
//             {group.description && <div style={subtitle}>{group.description}</div>}
//           </div>

//           {/* quick stats */}
//           <div style={statsWrap}>
//             <StatCard icon={<IconShield />} label="Your role" value={isOwner ? "Owner" : amMember ? "Member" : "Visitor"} />
//             <StatCard icon={<IconClock />}  label="Created"   value={group.createdAt ? new Date(group.createdAt).toLocaleString() : "—"} />
//             <StatCard icon={<IconUsers />}  label="Members"   value={
//               <button type="button" onClick={openMembers} style={membersLinkBtn}>
//                 {membersCount} {membersCount === 1 ? "member" : "members"}
//               </button>
//             } />
//           </div>

//           <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
//             {(amMember || isOwner) && <button style={btnGhost} onClick={leave}>Leave group</button>}
//             <button style={btnPill} onClick={goBack}>Back to My groups</button>
//           </div>
//         </div>

//         {/* meeting mode row */}
//         <div style={{ ...cardWide, marginTop: 16 }}>
//           <div style={modeBar}>
//             <div style={modeLabel}>Meeting preference</div>
//             <select value={meetingMode} onChange={(e) => setMeetingMode(e.target.value)} style={modeSelect} disabled={modeLoading}>
//               <option value="either">Either</option>
//               <option value="online">Online</option>
//               <option value="oncampus">On-Campus</option>
//             </select>
//             <button onClick={saveMeetingMode} disabled={savingMode} style={modeSave}>
//               {savingMode ? "Saving…" : "Save"}
//             </button>
//             {isOwnerOrMember && (
//               <button style={modeCreateBtn} onClick={openCreatePoll}>+ Create poll</button>
//             )}
//           </div>
//         </div>

//         {/* ===== Polls ===== */}
//         <div style={{ ...cardWide, marginTop: 12 }}>
//           <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
//             <h3 style={h3}>Meeting polls</h3>
//             {isOwnerOrMember && <button onClick={openCreatePoll} style={btnPill}>+ Create poll</button>}
//           </div>

//           {pollsLoading ? (
//             <div style={{ color: "#6b7280" }}>Loading polls…</div>
//           ) : polls.length === 0 ? (
//             <EmptyState
//               title="No polls yet"
//               text="Create a quick poll with a few time slots so members can vote."
//               actionText="+ Create poll"
//               onAction={openCreatePoll}
//             />
//           ) : (
//             <div style={pollList}>
//               {polls.map((p) => {
//                 const youVoted = (p?.slots || []).some((s) => !!s.voted);
//                 return (
//                   <div key={p.id || p._id} style={pollCard}>
//                     <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between" }}>
//                       <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
//                         <div style={{ fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={p.title}>
//                           {p.title}
//                         </div>
//                         <span style={modeChip}>{MODE_LABEL[normalizeMode(p.mode)] || "Either"}</span>
//                         {youVoted && <span style={youVotedChip}>You voted</span>}
//                       </div>
//                       <div style={{ color: "#6b7280", fontSize: 12 }}>{fmtTime(p.createdAt)}</div>
//                     </div>

//                     <div style={slotRow}>
//                       {(p.slots || []).map((s) => {
//                         const id = s.slotId || s.id || s._id;
//                         const votes = Number(s.count || 0);
//                         const pct = clamp(Math.round((votes / memberBase) * 100), 0, 100);
//                         return (
//                           <div key={id} style={slotChip} title={fmtTime(s.at)}>
//                             <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 6 }}>
//                               <div style={{ fontWeight: 700 }}>{fmtTime(s.at)}</div>
//                               <div style={{ color: "#6b7280", fontSize: 12 }}>{votes} vote{votes === 1 ? "" : "s"}</div>
//                             </div>
//                             <div style={barTrack}>
//                               <div style={{ ...barFill, width: `${Math.max(8, pct)}%` }} />
//                             </div>
//                           </div>
//                         );
//                       })}
//                     </div>

//                     <div style={{ display: "flex", justifyContent: "flex-end" }}>
//                       <button style={btnPrimary} onClick={() => openVote(p)}>Vote</button>
//                     </div>
//                   </div>
//                 );
//               })}
//             </div>
//           )}
//         </div>
//       </div>

//       {/* Floating chat */}
//       <ChatDock gid={gid} groupTitle={group?.title} canChat={canChat} myId={myId} me={me} />

//       {/* Members modal */}
//       <Modal open={membersOpen} onClose={closeMembers} title={`Members · ${group.title}`}>
//         {!canSeeMembers ? (
//           <div style={{ padding: 12, color: "#6b7280" }}>Only group members can view the member list.</div>
//         ) : membersLoading ? (
//           <div style={{ padding: 12, color: "#6b7280" }}>Loading members…</div>
//         ) : members.length === 0 ? (
//           <div style={{ padding: 12, color: "#6b7280" }}>No members yet.</div>
//         ) : (
//           <ul style={memberList}>
//             {members.map((m) => {
//               const isMe = isSelf(m);
//               const bg = colorFromString(m.name || m.email);
//               return (
//                 <li key={m._id || m.email} style={memberItem}>
//                   <div style={{ ...avatar, background: bg }} aria-hidden>{initials(m.name, m.email)}</div>
//                   <div style={{ flex: 1, minWidth: 0 }}>
//                     <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
//                       <div
//                         style={{ fontWeight: 700, whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}
//                         title={m.name || m.email}
//                       >
//                         {m.name || m.email}
//                       </div>
//                       {isMe && (
//                         <span style={youSelfChip} title="This is you">
//                           <span style={youDot} /> You
//                         </span>
//                       )}
//                       {m.isOwner && (
//                         <span style={ownerChip} title="Group owner">
//                           <span style={ownerDot} /> Owner
//                         </span>
//                       )}
//                     </div>
//                     {m.email && <div style={emailSub}>{m.email}</div>}
//                   </div>
//                 </li>
//               );
//             })}
//           </ul>
//         )}
//       </Modal>

//       {/* Vote modal (single-choice) */}
//       <Modal open={voteOpen && !!activePoll} onClose={closeVote} title={activePoll ? `Vote · ${activePoll.title}` : "Vote"}>
//         {activePoll && (
//           <>
//             <div style={{ marginBottom: 8, color: "#6b7280" }}>
//               Mode: <b>{MODE_LABEL[normalizeMode(activePoll.mode)] || "Either"}</b>
//             </div>
//             <div style={{ display: "grid", gap: 10 }}>
//               {(activePoll.slots || []).map((s) => {
//                 const sid = s.slotId || s.id || s._id;
//                 const checked = selectedSlotId === sid;
//                 const votes = Number(s.count || 0);
//                 const pct = clamp(Math.round((votes / memberBase) * 100), 0, 100);
//                 return (
//                   <label key={sid} style={voteRow}>
//                     <input type="radio" name="meeting-slot" checked={checked} onChange={() => setSelectedSlotId(sid)} />
//                     <div style={{ flex: 1 }}>
//                       <div style={{ fontWeight: 700 }}>{fmtTime(s.at)}</div>
//                       <div style={{ color: "#6b7280", fontSize: 12 }}>{votes} vote{votes === 1 ? "" : "s"}</div>
//                       <div style={{ marginTop: 6, ...barTrack }}>
//                         <div style={{ ...barFill, width: `${Math.max(8, pct)}%` }} />
//                       </div>
//                     </div>
//                   </label>
//                 );
//               })}
//             </div>
//             <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
//               <button style={btnGhost} onClick={closeVote}>Cancel</button>
//               <button
//                 style={{ ...btnPrimary, opacity: submittingVote ? 0.7 : 1, pointerEvents: submittingVote ? "none" : "auto" }}
//                 onClick={submitVote}
//               >
//                 {submittingVote ? "Saving…" : "Save vote"}
//               </button>
//             </div>
//           </>
//         )}
//       </Modal>

//       {/* Create poll modal */}
//       <Modal open={pollOpen} onClose={closeCreatePoll} title="Create meeting poll">
//         <div style={{ display: "grid", gap: 10 }}>
//           <label style={fld}>
//             <div style={lbl}>Title</div>
//             <input value={pollTitle} onChange={(e) => setPollTitle(e.target.value)} style={inp} placeholder="e.g., Sunday catch-up" />
//           </label>

//           <label style={fld}>
//             <div style={lbl}>Mode</div>
//             <select value={pollMode} onChange={(e) => setPollMode(e.target.value)} style={inp}>
//               <option value="either">Either</option>
//               <option value="online">Online</option>
//               <option value="oncampus">On-Campus</option>
//             </select>
//           </label>

//           <div style={{ ...lbl, marginTop: 6 }}>Time slots</div>
//           <div style={{ display: "grid", gap: 8 }}>
//             {slotInputs.map((v, i) => (
//               <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
//                 <input type="datetime-local" value={v} onChange={(e) => {
//                   const next = [...slotInputs]; next[i] = e.target.value; setSlotInputs(next);
//                 }} style={inp} />
//                 <button style={btnGhost} onClick={() => removeSlotInput(i)} disabled={slotInputs.length <= 1}>Remove</button>
//               </div>
//             ))}
//             <div>
//               <button style={btnPill} onClick={addSlotInput}>+ Add slot</button>
//             </div>
//           </div>

//           <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 6 }}>
//             <button style={btnGhost} onClick={closeCreatePoll}>Cancel</button>
//             <button
//               style={{ ...btnPrimary, opacity: creating ? 0.7 : 1, pointerEvents: creating ? "none" : "auto" }}
//               onClick={createPoll}
//             >
//               {creating ? "Creating…" : "Create poll"}
//             </button>
//           </div>
//         </div>
//       </Modal>

//       {/* Global confirm modal */}
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

// /* ================= small presentational bits ================= */
// function StatusBadge({ open }) {
//   return (
//     <span style={open ? openChip : closedChip}>
//       <span style={open ? openDot : closedDot} /> {open ? "Open to join" : "Closed"}
//     </span>
//   );
// }
// function StatCard({ icon, label, value }) {
//   return (
//     <div style={statCard}>
//       <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
//         <div style={statIcon}>{icon}</div>
//         <div>
//           <div style={{ color: "#6b7280", fontSize: 12, fontWeight: 700 }}>{label}</div>
//           <div style={{ fontWeight: 800, whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden", maxWidth: 260 }}>
//             {value}
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }
// function EmptyState({ title, text, actionText, onAction }) {
//   return (
//     <div style={emptyCard}>
//       <div style={{ fontWeight: 800, fontSize: 16 }}>{title}</div>
//       <div style={{ color: "#6b7280", marginTop: 6 }}>{text}</div>
//       {onAction && (
//         <div style={{ marginTop: 10 }}>
//           <button style={btnPrimary} onClick={onAction}>{actionText}</button>
//         </div>
//       )}
//     </div>
//   );
// }

// /* ================= Modals ================= */
// function Modal({ open, onClose, title, children }) {
//   if (!open) return null;
//   return (
//     <div style={backdrop} onClick={onClose}>
//       <div role="dialog" aria-modal="true" style={modal} onClick={(e) => e.stopPropagation()}>
//         <div style={modalHead}>
//           <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>{title || ""}</h3>
//           <button style={modalX} onClick={onClose} aria-label="Close">✕</button>
//         </div>
//         {children}
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
//           <button style={modalX} onClick={onCancel} aria-label="Close">✕</button>
//         </div>
//         <div style={{ color: "#374151", marginBottom: 12 }}>{message || ""}</div>
//         <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
//           <button style={btnGhost} onClick={onCancel}>Cancel</button>
//           <button style={btnPrimary} onClick={() => onConfirm && onConfirm()}>Confirm</button>
//         </div>
//       </div>
//     </div>
//   );
// }

// /* ================= Icons (inline SVG) ================= */
// function IconUsers() {
//   return (
//     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
//       <path d="M16 11c1.657 0 3-1.79 3-4s-1.343-4-3-4-3 1.79-3 4 1.343 4 3 4zm-8 0c1.657 0 3-1.79 3-4S9.657 3 8 3 5 4.79 5 7s1.343 4 3 4zm0 2c-2.671 0-8 1.336-8 4v2h16v-2c0-2.664-5.329-4-8-4zm8 0c-.29 0-.614.02-.963.055C16.92 14.67 19 15.93 19 17v2h5v-2c0-2.664-5.329-4-8-4z" fill="#4f46e5"/>
//     </svg>
//   );
// }
// function IconClock() {
//   return (
//     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
//       <path d="M12 1a11 11 0 1011 11A11.013 11.013 0 0012 1zm1 11.59V6h-2v8l7 3.74.9-1.79z" fill="#4f46e5"/>
//     </svg>
//   );
// }
// function IconShield() {
//   return (
//     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
//       <path d="M12 2l7 4v6c0 5-3.5 9-7 10-3.5-1-7-5-7-10V6l7-4z" fill="#4f46e5"/>
//     </svg>
//   );
// }

// /* ================= styles ================= */
// const pageWrap = { padding: "24px 16px 40px" };

// const heroCard = {
//   width: "min(1100px, 96vw)",
//   background: "linear-gradient(180deg,#ffffff,#fafaff)",
//   borderRadius: 16,
//   border: "1px solid #EEF0F5",
//   boxShadow: "0 18px 60px rgba(2,6,23,0.06)",
//   padding: 18,
// };

// const courseRow = { display: "flex", alignItems: "center", gap: 6, color: "#6b7280", fontWeight: 700 };
// const courseCode = { background: "#EEF2FF", border: "1px solid #E0E7FF", color: "#4f46e5", padding: "2px 8px", borderRadius: 999, fontWeight: 800, fontSize: 12 };

// const h1 = { margin: "8px 0 6px", fontSize: 32, lineHeight: 1.15, fontWeight: 800 };
// const subtitle = { color: "#111827" };

// const statsWrap = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10, marginTop: 10 };

// const statCard = { border: "1px solid #EEF0F5", borderRadius: 12, background: "#fff", padding: 12 };
// const statIcon  = { width: 30, height: 30, borderRadius: 8, background: "#EEF2FF", display: "grid", placeItems: "center", border: "1px solid #E0E7FF" };

// const chipLink = { background: "#F4F6FF", color: "#4f46e5", border: "1px solid #E3E8FF", padding: "8px 12px", borderRadius: 999, fontWeight: 700, fontSize: 14, cursor: "pointer" };

// const cardWide = { width: "min(1100px, 96vw)", background: "#fff", borderRadius: 16, border: "1px solid #EEF0F5", boxShadow: "0 18px 60px rgba(2,6,23,0.06)", padding: 18 };

// const membersLinkBtn = { appearance: "none", background: "transparent", border: 0, color: "#4f46e5", fontWeight: 800, fontSize: 14, padding: 0, textDecoration: "none", cursor: "pointer" };

// const modeBar = {
//   display: "grid",
//   gridTemplateColumns: "140px 1fr auto auto",
//   gap: 8,
//   alignItems: "center",
//   width: "100%",
// };
// const modeLabel = { fontWeight: 700, color: "#374151" };
// const modeSelect = { border: "1px solid #E5E7EB", borderRadius: 10, padding: "10px 12px", background: "#fff", fontWeight: 600 };
// const modeSave = { background: "linear-gradient(180deg,#5b7cfa,#4f46e5)", color: "#fff", border: 0, padding: "10px 14px", borderRadius: 10, fontWeight: 800, cursor: "pointer" };
// const modeCreateBtn = { marginLeft: 6, background: "#eef2ff", color: "#4f46e5", border: "1px solid #dbe2ff", padding: "10px 14px", borderRadius: 10, fontWeight: 800, cursor: "pointer" };

// const btnPill = { background: "#eef2ff", color: "#4f46e5", border: "1px solid #dbe2ff", padding: "10px 14px", borderRadius: 999, fontWeight: 800, cursor: "pointer" };
// const btnGhost = { background: "#fff", color: "#6b7280", border: "1px solid #e5e7eb", padding: "10px 14px", borderRadius: 10, fontWeight: 700, cursor: "pointer" };
// const btnPrimary = { background: "linear-gradient(180deg,#5b7cfa,#4f46e5)", color: "#fff", border: 0, padding: "10px 14px", borderRadius: 10, fontWeight: 800, cursor: "pointer" };

// const h3 = { margin: 0, fontSize: 18, fontWeight: 800 };

// const pollList = { display: "grid", gap: 10 };
// const pollCard = { border: "1px solid #eef0f5", borderRadius: 12, padding: 12, background: "#fff", display: "grid", gap: 10 };
// const modeChip = { background: "#eef2ff", color: "#4f46e5", border: "1px solid #dbe2ff", padding: "2px 8px", borderRadius: 999, fontWeight: 700, fontSize: 12 };
// const youVotedChip  = { background: "#ecfdf5", color: "#065f46", border: "1px solid #a7f3d0", padding: "2px 8px", borderRadius: 999, fontWeight: 700, fontSize: 12 };

// const slotRow  = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 8 };
// const slotChip = { border: "1px solid #e5e7eb", borderRadius: 12, padding: 10, background: "#fafafa" };
// const barTrack = { height: 8, background: "#E5E7EB", borderRadius: 999, overflow: "hidden", marginTop: 6 };
// const barFill  = { height: "100%", background: "linear-gradient(90deg,#5b7cfa,#4f46e5)", borderRadius: 999 };

// const backdrop = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 50 };
// const modal    = { width: "min(760px, 96vw)", background: "#fff", borderRadius: 18, border: "1px solid #EDF0F5", boxShadow: "0 18px 60px rgba(0,0,0,0.20)", padding: 16 };
// const modalHead= { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 };
// const modalX   = { appearance: "none", border: 0, background: "#f3f4f6", color: "#111827", width: 36, height: 36, borderRadius: 10, cursor: "pointer" };

// const fld = { display: "grid", gap: 6 };
// const lbl = { fontWeight: 700, color: "#374151" };
// const inp = { border: "1px solid #E5E7EB", borderRadius: 10, padding: "10px 12px", background: "#fff", fontWeight: 600 };

// const memberList = { listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 10, maxHeight: "60vh", overflow: "auto" };
// const memberItem = { display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", border: "1px solid #eef0f5", borderRadius: 12, background: "#fff" };
// const avatar     = { width: 34, height: 34, borderRadius: "50%", display: "grid", placeItems: "center", fontWeight: 800, color: "#111827", border: "1px solid #e5e7eb" };

// const ownerChip  = { display: "inline-flex", alignItems: "center", gap: 6, padding: "2px 8px", borderRadius: 999, background: "#FFF7E6", border: "1px solid #FFE3A3", color: "#A16207", fontSize: 12, fontWeight: 700, lineHeight: 1 };
// const ownerDot   = { width: 8, height: 8, borderRadius: "50%", background: "linear-gradient(180deg,#F59E0B,#D97706)", boxShadow: "0 0 0 3px #FFF2CC" };
// const emailSub   = { color: "#6b7280", fontSize: 12, whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden", marginTop: 2 };
// const voteRow    = { display: "flex", alignItems: "center", gap: 10, border: "1px solid #e5e7eb", borderRadius: 10, padding: "8px 10px", background: "#fafafa" };

// const youSelfChip = { display: "inline-flex", alignItems: "center", gap: 6, padding: "2px 8px", borderRadius: 999, background: "#E6F6FF", border: "1px solid #A3E1FF", color: "#075985", fontSize: 12, fontWeight: 700, lineHeight: 1 };
// const youDot = { width: 8, height: 8, borderRadius: "50%", background: "linear-gradient(180deg,#38BDF8,#0EA5E9)", boxShadow: "0 0 0 3px #DFF5FF" };

// const openChip  = { display: "inline-flex", alignItems: "center", gap: 6, padding: "2px 8px", borderRadius: 999, background: "#ECFEFF", border: "1px solid #BAE6FD", color: "#075985", fontSize: 12, fontWeight: 800 };
// const openDot   = { width: 8, height: 8, borderRadius: "50%", background: "linear-gradient(180deg,#38BDF8,#0EA5E9)", boxShadow: "0 0 0 3px #DFF5FF" };
// const closedChip= { display: "inline-flex", alignItems: "center", gap: 6, padding: "2px 8px", borderRadius: 999, background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", fontSize: 12, fontWeight: 800 };
// const closedDot = { width: 8, height: 8, borderRadius: "50%", background: "linear-gradient(180deg,#F87171,#DC2626)", boxShadow: "0 0 0 3px #FFE2E2" };

// const emptyCard = { border: "1px dashed #E5E7EB", borderRadius: 12, padding: 16, background: "#FCFCFF" };

import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { toast } from "react-toastify";
import ChatDock from "../components/ChatDock";

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
  const palette = ["#D6E4FF","#FDE68A","#FBD5D5","#D1FAE5","#E9D5FF","#C7F9FF","#FFE4E6","#F5F3FF"];
  let h = 0; for (let i=0;i<(s||"").length;i++) h=(h*31+s.charCodeAt(i))%9973;
  return palette[h % palette.length];
};

export default function GroupDetail() {
  const { gid } = useParams();
  const navigate = useNavigate();

  const me = useMemo(() => { try { return JSON.parse(localStorage.getItem("user") || "{}"); } catch { return {}; }}, []);
  const myId = useMemo(() => String(me?._id ?? me?.id ?? me?.userId ?? ""), [me]);

  const [loading, setLoading] = useState(true);
  const [group, setGroup] = useState(null);

  // members modal
  const [membersOpen, setMembersOpen] = useState(false);
  const [members, setMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(false);

  // confirm modal
  const [confirmState, setConfirmState] = useState({ open:false, title:"", message:"", onConfirm:null });
  const askConfirm = (title, message, onConfirm) => setConfirmState({ open:true, title, message, onConfirm });
  const closeConfirm = () => setConfirmState({ open:false, title:"", message:"", onConfirm:null });

  const loadGroup = async () => {
    try { setLoading(true); const g = await apiGet(`/api/groups/${gid}`); setGroup(g); }
    catch (e) { console.error(e); toast.error("Failed to load group"); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadGroup(); }, [gid, myId]);

  const isOwner = !!group?.isOwner;
  const amMember = group?.myJoinStatus === "member";
  const canSeeMembers = isOwner || amMember;
  const canChat = isOwner || amMember;
  const membersCount = group?.membersCount ?? group?.members?.length ?? 0;

  const leave = () =>
    askConfirm("Leave group?", "Are you sure you want to leave this group?", async () => {
      try { await apiPost(`/api/groups/leave/${gid}`); toast.success("Left group"); navigate("/dashboard"); }
      catch { toast.error("Could not leave group"); }
      finally { closeConfirm(); }
    });

  const goBack = () =>
    askConfirm("Back to dashboard?", "You'll return to your groups.", () => { closeConfirm(); navigate("/dashboard"); });

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
    if (!canSeeMembers) { setMembers([]); return; }
    try { setMembersLoading(true); const rows = await apiGet(`/api/groups/${gid}/members`); setMembers(Array.isArray(rows)?rows:[]); }
    catch { setMembers([]); toast.error("Could not load members"); }
    finally { setMembersLoading(false); }
  };
  const closeMembers = () => { setMembersOpen(false); setMembers([]); };

  useEffect(() => {
    if (!membersOpen) return;
    const onKey = (e) => e.key === "Escape" && closeMembers();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [membersOpen]);

  if (loading) return <div style={{ padding: 24, color: "#667085" }}>Loading…</div>;
  if (!group)  return <div style={{ padding: 24, color: "#ef4444" }}>Group not found.</div>;

  return (
    <>
      <div style={pageWrap}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <button style={chipLink} onClick={goBack}>← Back to dashboard</button>
          <Link to={`/group/${gid}/polls`} style={{ ...btnPill, textDecoration: "none" }}>Open polls →</Link>
        </div>

        {/* hero */}
        <div style={heroCard}>
          <div style={courseRow}>
            <span style={courseCode}>{group.course || "Course"}</span>
            <span style={{ width: 8 }} />
            <span style={group.isOpen ? openChip : closedChip}>
              <span style={group.isOpen ? openDot : closedDot} /> {group.isOpen ? "Open to join" : "Closed"}
            </span>
          </div>
          <h1 style={h1}>{group.title}</h1>
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

          <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
            {(amMember || isOwner) && <button style={btnGhost} onClick={leave}>Leave group</button>}
            <Link to={`/group/${gid}/polls`} style={{ ...btnPrimary, textDecoration: "none" }}>Manage polls</Link>
          </div>
        </div>
      </div>

      {/* Chat */}
      <ChatDock gid={gid} groupTitle={group?.title} canChat={canChat} myId={myId} me={me} />

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
                  const bg = colorFromString(m.name || m.email);
                  return (
                    <li key={m._id || m.email} style={memberItem}>
                      <div style={{ ...avatar, background: bg }} aria-hidden>{initials(m.name, m.email)}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }} title={m.name || m.email}>
                            {m.name || m.email}{isSelf(m) ? " (You)" : ""}
                          </div>
                          {m.isOwner && (
                            <span style={ownerChip} title="Group owner"><span style={ownerDot} /> Owner</span>
                          )}
                        </div>
                        {m.email && <div style={emailSub}>{m.email}</div>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
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

/* small presentational bits */
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

/* =============== styles =============== */
const pageWrap = { padding: "24px 16px 40px" };

const heroCard = {
  width: "min(1100px, 96vw)",
  background: "linear-gradient(180deg,#ffffff,#fafaff)",
  borderRadius: 16,
  border: "1px solid #EEF0F5",
  boxShadow: "0 18px 60px rgba(2,6,23,0.06)",
  padding: 18,
};

const courseRow = { display: "flex", alignItems: "center", gap: 6, color: "#6b7280", fontWeight: 700 };
const courseCode = { background: "#EEF2FF", border: "1px solid #E0E7FF", color: "#4f46e5", padding: "2px 8px", borderRadius: 999, fontWeight: 800, fontSize: 12 };

const h1 = { margin: "8px 0 6px", fontSize: 32, lineHeight: 1.15, fontWeight: 800 };
const subtitle = { color: "#111827" };

const statsWrap = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10, marginTop: 10 };
const statCard = { border: "1px solid #EEF0F5", borderRadius: 12, background: "#fff", padding: 12 };

const chipLink = { background: "#F4F6FF", color: "#4f46e5", border: "1px solid #E3E8FF", padding: "8px 12px", borderRadius: 999, fontWeight: 700, fontSize: 14, cursor: "pointer" };
const btnPill = { background: "#eef2ff", color: "#4f46e5", border: "1px solid #dbe2ff", padding: "10px 14px", borderRadius: 999, fontWeight: 800, cursor: "pointer" };
const btnGhost = { background: "#fff", color: "#6b7280", border: "1px solid #e5e7eb", padding: "10px 14px", borderRadius: 10, fontWeight: 700, cursor: "pointer" };
const btnPrimary = { background: "linear-gradient(180deg,#5b7cfa,#4f46e5)", color: "#fff", border: 0, padding: "10px 14px", borderRadius: 10, fontWeight: 800, cursor: "pointer" };

const membersLinkBtn = { appearance: "none", background: "transparent", border: 0, color: "#4f46e5", fontWeight: 800, fontSize: 14, padding: 0, textDecoration: "none", cursor: "pointer" };

const backdrop = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 50 };
const modal    = { width: "min(760px, 96vw)", background: "#fff", borderRadius: 18, border: "1px solid #EDF0F5", boxShadow: "0 18px 60px rgba(0,0,0,0.20)", padding: 16 };
const modalHead= { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 };
const modalX   = { appearance: "none", border: 0, background: "#f3f4f6", color: "#111827", width: 36, height: 36, borderRadius: 10, cursor: "pointer" };

const memberList = { listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 10, maxHeight: "60vh", overflow: "auto" };
const memberItem = { display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", border: "1px solid #eef0f5", borderRadius: 12, background: "#fff" };
const avatar     = { width: 34, height: 34, borderRadius: "50%", display: "grid", placeItems: "center", fontWeight: 800, color: "#111827", border: "1px solid #e5e7eb" };

const ownerChip  = { display: "inline-flex", alignItems: "center", gap: 6, padding: "2px 8px", borderRadius: 999, background: "#FFF7E6", border: "1px solid #FFE3A3", color: "#A16207", fontSize: 12, fontWeight: 700, lineHeight: 1 };
const ownerDot   = { width: 8, height: 8, borderRadius: "50%", background: "linear-gradient(180deg,#F59E0B,#D97706)", boxShadow: "0 0 0 3px #FFF2CC" };
const emailSub   = { color: "#6b7280", fontSize: 12, whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden", marginTop: 2 };

const openChip  = { display: "inline-flex", alignItems: "center", gap: 6, padding: "2px 8px", borderRadius: 999, background: "#ECFEFF", border: "1px solid #BAE6FD", color: "#075985", fontSize: 12, fontWeight: 800 };
const openDot   = { width: 8, height: 8, borderRadius: "50%", background: "linear-gradient(180deg,#38BDF8,#0EA5E9)", boxShadow: "0 0 0 3px #DFF5FF" };
const closedChip= { display: "inline-flex", alignItems: "center", gap: 6, padding: "2px 8px", borderRadius: 999, background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", fontSize: 12, fontWeight: 800 };
const closedDot = { width: 8, height: 8, borderRadius: "50%", background: "linear-gradient(180deg,#F87171,#DC2626)", boxShadow: "0 0 0 3px #FFE2E2" };
