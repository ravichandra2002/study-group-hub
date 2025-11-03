// // frontend/src/pages/GroupDetail.jsx
// import { useEffect, useMemo, useState, useCallback, useRef } from "react";
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

// /* ---------------- Small helpers ---------------- */
// const fmtTime = (iso) =>
//   iso ? new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "—";
// const timeShort = (iso) =>
//   iso ? new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "";
// const initials = (name = "", email = "") => {
//   const src = (name || email || "?").trim();
//   const parts = src.replace(/\s+/g, " ").split(" ");
//   if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
//   return (parts[0][0] + parts[1][0]).toUpperCase();
// };
// const colorFromString = (s) => {
//   const palette = ["#D6E4FF", "#FDE68A", "#FBD5D5", "#D1FAE5", "#E9D5FF", "#C7F9FF", "#FFE4E6", "#F5F3FF"];
//   let h = 0;
//   for (let i = 0; i < (s || "").length; i++) h = (h * 31 + s.charCodeAt(i)) % 9973;
//   return palette[h % palette.length];
// };
// const prettySize = (n) => {
//   if (n === 0) return "0 B";
//   if (!n) return "";
//   const k = 1024, u = ["B", "KB", "MB", "GB", "TB"];
//   const i = Math.floor(Math.log(n) / Math.log(k));
//   return `${(n / Math.pow(k, i)).toFixed(i ? 1 : 0)} ${u[i]}`;
// };
// const domainFromUrl = (u) => {
//   try { return new URL(u).hostname.replace(/^www\./, ""); }
//   catch { return ""; }
// };

// /* ====================================================================== */

// export default function GroupDetail() {
//   const { gid } = useParams();
//   const navigate = useNavigate();

//   const me = useMemo(() => {
//     try { return JSON.parse(localStorage.getItem("user") || "{}"); }
//     catch { return {}; }
//   }, []);
//   const myId = useMemo(() => String(me?._id ?? me?.id ?? me?.userId ?? ""), [me]);

//   const [loading, setLoading] = useState(true);
//   const [group, setGroup] = useState(null);

//   // members modal
//   const [membersOpen, setMembersOpen] = useState(false);
//   const [members, setMembers] = useState([]);
//   const [membersLoading, setMembersLoading] = useState(false);

//   // confirm modal
//   const [confirmState, setConfirmState] = useState({ open: false, title: "", message: "", onConfirm: null });
//   const askConfirm = (title, message, onConfirm) => setConfirmState({ open: true, title, message, onConfirm });
//   const closeConfirm = () => setConfirmState({ open: false, title: "", message: "", onConfirm: null });

//   // meeting request modal
//   const [meetOpen, setMeetOpen] = useState(false);
//   const [meetTarget, setMeetTarget] = useState(null);
//   const [meetInitial, setMeetInitial] = useState(null);
//   const [savedSlots, setSavedSlots] = useState([]);

//   // resources (recent)
//   const [resources, setResources] = useState([]);
//   const [resBusy, setResBusy] = useState(false);

//   /* ---------------- Notes (per-group, autosave, tools) ---------------- */
//   const noteKey = `gd-notes-${gid}`;
//   const [notes, setNotes] = useState("");
//   const notesRef = useRef("");
//   const saveNotesDebounced = useRef(null);

//   /* ---------------- Checklist (per-group with CRUD/reorder) ----------- */
//   const listKey = `gd-checklist-${gid}`;
//   const defaultChecklist = [
//     { id: cryptoId(), label: "Review this week's readings", done: false },
//     { id: cryptoId(), label: "Prepare lab notebook", done: false },
//     { id: cryptoId(), label: "Practice quiz questions", done: false },
//     { id: cryptoId(), label: "Confirm next study session time", done: false },
//   ];
//   const [checklist, setChecklist] = useState(defaultChecklist);
//   const [newItem, setNewItem] = useState("");

//   // helpers
//   function cryptoId() {
//     try { return crypto.randomUUID(); }
//     catch { return Math.random().toString(36).slice(2, 10); }
//   }

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

//   const loadMyAvailability = async () => {
//     try {
//       const mine = await apiGet(`/api/availability/list`);
//       setSavedSlots(
//         (Array.isArray(mine) ? mine : []).map((r) => ({ day: r.day, from: r.from, to: r.to }))
//       );
//     } catch {
//       setSavedSlots([]);
//     }
//   };

//   const loadRecentResources = async () => {
//     try {
//       setResBusy(true);
//       const list = await apiGet(`/api/resources/list?group_id=${encodeURIComponent(gid)}`);
//       const arr = Array.isArray(list) ? list.slice(0, 5) : [];
//       setResources(arr);
//     } catch (e) {
//       console.error(e);
//       setResources([]);
//     } finally {
//       setResBusy(false);
//     }
//   };

//   useEffect(() => { loadGroup(); }, [gid, myId]);
//   useEffect(() => { loadRecentResources(); }, [gid]);

//   // Notes: load + autosave with debounce
//   useEffect(() => {
//     const saved = localStorage.getItem(noteKey);
//     if (saved != null) {
//       setNotes(saved);
//       notesRef.current = saved;
//     } else {
//       setNotes("");
//       notesRef.current = "";
//     }
//   }, [noteKey]);

//   useEffect(() => {
//     if (saveNotesDebounced.current) clearTimeout(saveNotesDebounced.current);
//     saveNotesDebounced.current = setTimeout(() => {
//       localStorage.setItem(noteKey, notesRef.current);
//     }, 400);
//     return () => clearTimeout(saveNotesDebounced.current);
//   }, [noteKey]); // recompute timer base when key changes

//   const onNotesChange = (val) => {
//     notesRef.current = val;
//     setNotes(val);
//     if (saveNotesDebounced.current) clearTimeout(saveNotesDebounced.current);
//     saveNotesDebounced.current = setTimeout(() => {
//       localStorage.setItem(noteKey, notesRef.current);
//     }, 400);
//   };

//   const notesCounts = useMemo(() => {
//     const words = (notes.trim().match(/\S+/g) || []).length;
//     const chars = notes.length;
//     return { words, chars };
//   }, [notes]);

//   const copyNotes = async () => {
//     try { await navigator.clipboard.writeText(notes); toast.success("Copied notes"); }
//     catch { toast.error("Copy failed"); }
//   };
//   const downloadNotes = () => {
//     const blob = new Blob([notes], { type: "text/plain;charset=utf-8" });
//     const a = document.createElement("a");
//     a.href = URL.createObjectURL(blob);
//     a.download = `${(group?.title || "notes").replace(/\s+/g, "_")}.txt`;
//     document.body.appendChild(a);
//     a.click();
//     a.remove();
//     setTimeout(() => URL.revokeObjectURL(a.href), 1000);
//   };
//   const clearNotes = () => onNotesChange("");

//   // Checklist: load/save
//   useEffect(() => {
//     const saved = localStorage.getItem(listKey);
//     if (saved) {
//       try { setChecklist(JSON.parse(saved)); }
//       catch { setChecklist(defaultChecklist); }
//     } else {
//       setChecklist(defaultChecklist);
//     }
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [listKey]);

//   useEffect(() => {
//     localStorage.setItem(listKey, JSON.stringify(checklist));
//   }, [listKey, checklist]);

//   const addItem = () => {
//     const label = newItem.trim();
//     if (!label) return;
//     setChecklist((prev) => [...prev, { id: cryptoId(), label, done: false }]);
//     setNewItem("");
//   };
//   const toggleItem = (id, done) => {
//     setChecklist((prev) => prev.map((x) => (x.id === id ? { ...x, done } : x)));
//   };
//   const editItem = (id, label) => {
//     setChecklist((prev) => prev.map((x) => (x.id === id ? { ...x, label } : x)));
//   };
//   const removeItem = (id) => setChecklist((prev) => prev.filter((x) => x.id !== id));
//   const markAll = (value) => setChecklist((prev) => prev.map((x) => ({ ...x, done: value })));
//   const clearCompleted = () => setChecklist((prev) => prev.filter((x) => !x.done));
//   const resetDefaults = () => setChecklist(defaultChecklist);
//   const moveItem = (idx, dir) => {
//     setChecklist((prev) => {
//       const arr = prev.slice();
//       const j = idx + dir;
//       if (j < 0 || j >= arr.length) return prev;
//       [arr[idx], arr[j]] = [arr[j], arr[idx]];
//       return arr;
//     });
//   };

//   const progress = useMemo(() => {
//     const total = checklist.length || 1;
//     const done = checklist.filter((x) => x.done).length;
//     return { done, total, pct: Math.round((done / total) * 100) };
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

//   const goBack = () => navigate("/dashboard");

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

//   const requestMeetingFor = async (member) => {
//     const id = String(member?._id ?? member?.id ?? member?.userId ?? "");
//     setMeetTarget({ id, name: member?.name || "", email: member?.email || "" });
//     setMeetInitial(null);
//     await loadMyAvailability();
//     setMeetOpen(true);
//   };

//   const sendMeeting = async (slot) => {
//     try {
//       await apiPost(`/api/meetings/request`, { receiver_id: String(meetTarget?.id), slot });
//       toast.success("Meeting request sent");
//     } catch (e) {
//       console.error(e);
//       toast.error("Could not send meeting request");
//       throw e;
//     }
//   };

//   const downloadRes = async (rid, filename = "file") => {
//     try {
//       const url = `${API_BASE}/api/resources/download/${rid}`;
//       const res = await fetch(url, {
//         headers: { Authorization: `Bearer ${localStorage.getItem("token") || ""}` },
//       });
//       if (!res.ok) throw new Error(await res.text());
//       const blob = await res.blob();
//       const a = document.createElement("a");
//       a.href = URL.createObjectURL(blob);
//       a.download = filename;
//       document.body.appendChild(a);
//       a.click();
//       a.remove();
//       setTimeout(() => URL.revokeObjectURL(a.href), 3000);
//     } catch (e) {
//       console.error(e);
//       toast.error("Download failed");
//     }
//   };

//   if (loading) {
//     return (
//       <div style={pageWrap}>
//         <div style={container}>
//           <div style={skeletonHero} />
//           <div style={grid}>
//             <div style={skeletonSection} />
//             <div style={skeletonSection} />
//           </div>
//         </div>
//       </div>
//     );
//   }
//   if (!group) return <div style={{ padding: 24, color: "#ef4444" }}>Group not found.</div>;

//   return (
//     <>
//       <div style={pageWrap}>
//         <div style={container}>
//           {/* Top Bar */}
//           <div style={topRow}>
//             <button style={chipLink} onClick={goBack}>← Back to dashboard</button>
//             <Link to={`/group/${gid}/polls`} style={pillLinkStrong}>Open polls</Link>
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

//             <h1 style={h1}>{group.title}</h1>
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
//               {(amMember || isOwner) && <button style={btnGhost} onClick={leave}>Leave group</button>}
//               <Link to={`/group/${gid}/polls`} style={pillPrimary}>Manage polls</Link>
//             </div>
//           </div>

//           {/* Content Grid */}
//           <div style={grid}>
//             {/* LEFT */}
//             <div style={col}>
//               <section style={section}>
//                 <h3 style={sectionTitle}>About this group</h3>
//                 <p style={pMuted}>
//                   {group.longDescription ||
//                     "Use this space to coordinate study sessions, share notes, and plan labs or assignments. Check polls to choose times and topics."}
//                 </p>
//                 <div style={tagWrap}>
//                   {(group.tags?.length ? group.tags : ["forensics", "lab", "assignment", "exam-prep"]).map((t) => (
//                     <span key={t} style={tagChip}>#{t}</span>
//                   ))}
//                 </div>
//               </section>

//               {/* ---- Checklist: enhanced ---- */}
//               <section style={section}>
//                 <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
//                   <h3 style={sectionTitle}>Study checklist</h3>
//                   <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
//                     <button style={miniGhost} onClick={() => markAll(true)} title="Mark all done">Mark all</button>
//                     <button style={miniGhost} onClick={() => markAll(false)} title="Unmark all">Unmark</button>
//                     <button style={miniGhost} onClick={clearCompleted} title="Clear completed">Clear ✓</button>
//                     <button style={miniGhost} onClick={resetDefaults} title="Reset to defaults">Reset</button>
//                   </div>
//                 </div>

//                 {/* Progress */}
//                 <div style={progWrap} aria-label="progress">
//                   <div style={{ ...progBar, width: `${progress.pct}%` }} />
//                   <div style={progText}>{progress.done}/{progress.total}</div>
//                 </div>

//                 {/* Add new */}
//                 <div style={addRow}>
//                   <input
//                     value={newItem}
//                     onChange={(e) => setNewItem(e.target.value)}
//                     onKeyDown={(e) => e.key === "Enter" && addItem()}
//                     placeholder="Add a task…"
//                     style={addInput}
//                   />
//                   <button style={btnPrimary} onClick={addItem}>Add</button>
//                 </div>

//                 {/* List */}
//                 <ul style={listPlain}>
//                   {checklist.map((item, idx) => (
//                     <li key={item.id} style={checkRow}>
//                       <label style={checkLabel}>
//                         <input
//                           type="checkbox"
//                           checked={item.done}
//                           onChange={(e) => toggleItem(item.id, e.target.checked)}
//                         />
//                         <input
//                           value={item.label}
//                           onChange={(e) => editItem(item.id, e.target.value)}
//                           style={editInput(item.done)}
//                         />
//                       </label>
//                       <div style={{ display: "flex", gap: 6 }}>
//                         <button style={miniIcon} title="Move up" onClick={() => moveItem(idx, -1)}>↑</button>
//                         <button style={miniIcon} title="Move down" onClick={() => moveItem(idx, +1)}>↓</button>
//                         <button style={miniDanger} title="Delete" onClick={() => removeItem(item.id)}>✕</button>
//                       </div>
//                     </li>
//                   ))}
//                 </ul>
//               </section>

//               <section style={section}>
//                 <h3 style={sectionTitle}>Quick links</h3>
//                 <div style={quickGrid}>
//                   <Link to={`/group/${gid}/polls`} style={quickBtn}>Open polls</Link>
//                   <Link to={`/group/${gid}/resources`} style={{ ...quickBtn, color: "#4f46e5", borderColor: "#dbe2ff", background: "#eef2ff" }}>
//                     Open resources
//                   </Link>
//                   <button style={quickBtn} onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
//                     Go to top
//                   </button>
//                 </div>
//               </section>
//             </div>

//             {/* RIGHT */}
//             <div style={col}>
//               <section style={section}>
//                 <h3 style={sectionTitle}>Group guidelines</h3>
//                 <ul style={bullets}>
//                   <li>Be respectful and stay on-topic.</li>
//                   <li>Use polls for decisions (meeting time, topic, deadlines).</li>
//                   <li>Share resources with clear titles.</li>
//                   <li>Keep chat threads concise. Start a new thread for new topics.</li>
//                 </ul>
//               </section>

//               {/* Recent resources */}
//               <section style={section}>
//                 <div style={resHeader}>
//                   <h3 style={sectionTitle}>Recent resources</h3>
//                   <Link to={`/group/${gid}/resources`} style={pillLink}>View all</Link>
//                 </div>

//                 {resBusy ? (
//                   <div style={{ color: "#6b7280" }}>Loading…</div>
//                 ) : resources.length === 0 ? (
//                   <div style={{ color: "#6b7280" }}>Nothing shared yet.</div>
//                 ) : (
//                   <div style={{ display: "grid", gap: 8 }}>
//                     {resources.slice(0, 4).map((r) => {
//                       const isFile = r.type === "file";
//                       const title = r.title || (isFile ? (r.filename || "File") : (r.url || "Link"));
//                       const uploader =
//                         (r.createdByName && r.createdByName.trim()) ||
//                         (r.createdByEmail && r.createdByEmail.split("@")[0]) ||
//                         (String(r.createdBy) === myId ? "you" : "member");
//                       const metaBits = [
//                         isFile ? prettySize(r.size) : domainFromUrl(r.url),
//                         uploader,
//                         timeShort(r.createdAt),
//                       ].filter(Boolean);

//                       return (
//                         <div key={r._id} style={resItem}>
//                           <div style={resLeft}>
//                             <div style={resIcon} aria-hidden>{isFile ? "📄" : "🔗"}</div>
//                             <div style={{ minWidth: 0 }}>
//                               <div title={title} style={resTitle}>{title}</div>
//                               <div style={resMeta}>
//                                 {metaBits.map((m, i) => (
//                                   <span key={i} style={metaBit}>
//                                     {m}{i < metaBits.length - 1 ? <span style={metaDot}>•</span> : null}
//                                   </span>
//                                 ))}
//                               </div>
//                             </div>
//                           </div>
//                           <div style={resRight}>
//                             {isFile ? (
//                               <button onClick={() => downloadRes(r._id, r.filename || "file")} style={btnPill}>Download</button>
//                             ) : (
//                               <a href={r.url} target="_blank" rel="noreferrer" style={btnPill}>Open</a>
//                             )}
//                           </div>
//                         </div>
//                       );
//                     })}
//                   </div>
//                 )}
//               </section>

//               {/* ---- Notes: enhanced ---- */}
//               <section style={section}>
//                 <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
//                   <h3 style={sectionTitle}>My notes</h3>
//                   <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
//                     <span style={{ color: "#6b7280", fontSize: 12 }}>
//                       {notesCounts.words} words · {notesCounts.chars} chars
//                     </span>
//                     <button style={miniGhost} onClick={copyNotes}>Copy</button>
//                     <button style={miniGhost} onClick={downloadNotes}>Download</button>
//                     <button style={miniDanger} onClick={clearNotes}>Clear</button>
//                   </div>
//                 </div>

//                 {/* quick templates */}
//                 <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
//                   {[
//                     "Action items:\n- \n- \n- ",
//                     "Meeting summary:\n• Topic: \n• Key points: \n• Next steps: ",
//                     "Study plan:\nWeek:\n1) \n2) \n3) ",
//                   ].map((tpl, i) => (
//                     <button
//                       key={i}
//                       style={chipSmall}
//                       onClick={() => onNotesChange((notes || "") + (notes && !notes.endsWith("\n") ? "\n" : "") + tpl)}
//                     >
//                       + {i === 0 ? "Action items" : i === 1 ? "Meeting summary" : "Study plan"}
//                     </button>
//                   ))}
//                 </div>

//                 <textarea
//                   placeholder="Write reminders or TODOs for this group. (Saved only on this browser)"
//                   value={notes}
//                   onChange={(e) => onNotesChange(e.target.value)}
//                   style={notesBox}
//                   rows={8}
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
//               <button style={modalX} onClick={closeMembers} aria-label="Close">✕</button>
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
//                       <div style={{ ...avatar, background: bg }} aria-hidden>{initials(m.name, m.email)}</div>
//                       <div style={{ flex: 1, minWidth: 0 }}>
//                         <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
//                           <div style={{ fontWeight: 700, whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }} title={m.name || m.email}>
//                             {m.name || m.email}{you ? " (You)" : ""}
//                           </div>
//                           {m.isOwner && (
//                             <span style={ownerChip} title="Group owner"><span style={ownerDot} /> Owner</span>
//                           )}
//                         </div>
//                         {m.email && <div style={emailSub}>{m.email}</div>}
//                       </div>

//                       {!you && id && (
//                         <button style={btnReq} onClick={() => requestMeetingFor(m)} title="Propose a meeting">
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

//       {/* Meeting modal */}
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

// /* ---------------- Small presentational bit ---------------- */
// function StatCard({ label, value }) {
//   return (
//     <div style={statCard}>
//       <div>
//         <div style={{ color: "#6b7280", fontSize: 12, fontWeight: 700 }}>{label}</div>
//         <div style={{ fontWeight: 800, whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden", maxWidth: 260 }}>
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

// /* ============================== styles ============================== */
// const pageWrap = { padding: "32px 16px 72px", minHeight: "calc(100vh - 80px)", background: "linear-gradient(180deg,#f8f9ff 0%, #ffffff 100%)" };
// const container = { width: "min(1100px, 96vw)", margin: "0 auto" };

// const topRow = { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 };
// const chipLink = { background: "#F4F6FF", color: "#4f46e5", border: "1px solid #E3E8FF", padding: "8px 12px", borderRadius: 999, fontWeight: 700, fontSize: 14, cursor: "pointer" };
// const pillLinkStrong = { ...chipLink, textDecoration: "none" };

// const heroCard = { width: "100%", background: "linear-gradient(180deg,#ffffff,#fafaff)", borderRadius: 16, border: "1px solid #EEF0F5", boxShadow: "0 18px 60px rgba(2,6,23,0.06)", padding: 18 };
// const courseRow = { display: "flex", alignItems: "center", gap: 6, color: "#6b7280", fontWeight: 700 };
// const courseCode = { background: "#EEF2FF", border: "1px solid #E0E7FF", color: "#4f46e5", padding: "2px 8px", borderRadius: 999, fontWeight: 800, fontSize: 12 };
// const h1 = { margin: "8px 0 6px", fontSize: 26, lineHeight: 1.2, fontWeight: 900 };
// const subtitle = { color: "#111827" };
// const statsWrap = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10, marginTop: 10 };
// const statCard = { border: "1px solid #EEF0F5", borderRadius: 12, background: "#fff", padding: 12 };

// const btnGhost = { background: "#fff", color: "#6b7280", border: "1px solid #e5e7eb", padding: "10px 14px", borderRadius: 10, fontWeight: 700, cursor: "pointer" };
// const btnPrimary = { background: "linear-gradient(180deg,#5b7cfa,#4f46e5)", color: "#fff", border: 0, padding: "10px 14px", borderRadius: 10, fontWeight: 800, cursor: "pointer" };
// const pillPrimary = { background: "#4f46e5", color: "#fff", border: "1px solid #4f46e5", padding: "8px 12px", borderRadius: 999, fontWeight: 800, fontSize: 14, textDecoration: "none" };
// const membersLinkBtn = { appearance: "none", background: "transparent", border: 0, color: "#4f46e5", fontWeight: 800, fontSize: 14, padding: 0, textDecoration: "none", cursor: "pointer" };

// const grid = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 };
// const col = { display: "flex", flexDirection: "column", gap: 16 };
// const section = { border: "1px solid #EEF0F5", background: "#fff", borderRadius: 14, padding: 14, boxShadow: "0 6px 24px rgba(2,6,23,0.04)" };
// const sectionTitle = { margin: 0, marginBottom: 8, fontSize: 16, fontWeight: 900 };

// const tagWrap = { display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 };
// const tagChip = { background: "#F5F3FF", border: "1px solid #EDE9FE", color: "#6D28D9", padding: "4px 10px", borderRadius: 999, fontWeight: 800, fontSize: 12 };
// const listPlain = { listStyle: "none", padding: 0, margin: 0 };
// const pMuted = { color: "#374151", margin: 0 };

// const quickGrid = { display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 8 };
// const quickBtn = { ...btnGhost, textAlign: "center", borderRadius: 999, padding: "10px 12px", textDecoration: "none" };

// const bullets = { margin: "4px 0 0 18px", color: "#374151" };
// const emailSub = { color: "#6b7280", fontSize: 12, whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden", marginTop: 2 };
// const ownerChip = { display: "inline-flex", alignItems: "center", gap: 6, padding: "2px 8px", borderRadius: 999, background: "#FFF7E6", border: "1px solid #FFE3A3", color: "#A16207", fontSize: 12, fontWeight: 700, lineHeight: 1 };
// const ownerDot = { width: 8, height: 8, borderRadius: "50%", background: "linear-gradient(180deg,#F59E0B,#D97706)", boxShadow: "0 0 0 3px #FFF2CC" };

// const openChip = { display: "inline-flex", alignItems: "center", gap: 6, padding: "2px 8px", borderRadius: 999, background: "#ECFEFF", border: "1px solid #BAE6FD", color: "#075985", fontSize: 12, fontWeight: 800 };
// const openDot = { width: 8, height: 8, borderRadius: "50%", background: "linear-gradient(180deg,#38BDF8,#0EA5E9)", boxShadow: "0 0 0 3px #DFF5FF" };
// const closedChip = { display: "inline-flex", alignItems: "center", gap: 6, padding: "2px 8px", borderRadius: 999, background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", fontSize: 12, fontWeight: 800 };
// const closedDot = { width: 8, height: 8, borderRadius: "50%", background: "linear-gradient(180deg,#F87171,#DC2626)", boxShadow: "0 0 0 3px #FFE2E2" };

// /* checklist styles */
// const progWrap = { position: "relative", height: 12, background: "#F3F4F6", borderRadius: 999, border: "1px solid #E5E7EB", marginBottom: 10 };
// const progBar = { position: "absolute", inset: 0, height: "100%", background: "linear-gradient(90deg,#34d399,#4ade80)", borderRadius: 999 };
// const progText = { position: "absolute", top: -20, right: 0, fontSize: 12, color: "#6b7280" };
// const addRow = { display: "flex", gap: 8, marginBottom: 8 };
// const addInput = { flex: 1, border: "1px solid #e5e7eb", borderRadius: 10, padding: "10px 12px", outline: "none", fontFamily: "inherit" };
// const editInput = (done) => ({
//   border: 0,
//   outline: "none",
//   background: "transparent",
//   fontWeight: 600,
//   textDecoration: done ? "line-through" : "none",
//   color: done ? "#6b7280" : "#111827",
//   width: "100%",
// });

// const checkRow = { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px dashed #eef0f5" };
// const checkLabel = { display: "flex", alignItems: "center", gap: 8, fontWeight: 600 };

// const miniGhost = { background: "#fff", color: "#4f46e5", border: "1px solid #dbe2ff", padding: "6px 10px", borderRadius: 999, fontWeight: 700, cursor: "pointer", fontSize: 12 };
// const miniDanger = { background: "#fff1f2", color: "#be123c", border: "1px solid #fecdd3", padding: "6px 10px", borderRadius: 999, fontWeight: 700, cursor: "pointer", fontSize: 12 };
// const miniIcon = { ...miniGhost, padding: "4px 8px" };

// /* notes styles */
// const chipSmall = { background: "#F4F6FF", color: "#4f46e5", border: "1px solid #E3E8FF", padding: "4px 8px", borderRadius: 999, fontWeight: 700, fontSize: 12, cursor: "pointer" };
// const notesBox = { width: "100%", border: "1px solid #e5e7eb", borderRadius: 10, padding: 10, outline: "none", fontFamily: "inherit" };

// /* members modal styles & misc */
// const listPlainModal = { listStyle: "none", padding: 0, margin: 0 };
// const pMutedModal = { color: "#374151", margin: 0 };

// const backdrop = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 50 };
// const modal = { width: "min(900px, 96vw)", background: "#fff", borderRadius: 18, border: "1px solid #EDF0F5", boxShadow: "0 18px 60px rgba(0,0,0,0.20)", padding: 16 };
// const modalHead = { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 };
// const modalX = { appearance: "none", border: 0, background: "#f3f4f6", color: "#111827", width: 36, height: 36, borderRadius: 10, cursor: "pointer" };
// const memberList = { listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 10, maxHeight: "60vh", overflow: "auto" };
// const memberItem = { display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", border: "1px solid #eef0f5", borderRadius: 12, background: "#fff" };
// const avatar = { width: 34, height: 34, borderRadius: "50%", display: "grid", placeItems: "center", fontWeight: 800, color: "#111827", border: "1px solid #e5e7eb" };
// const btnReq = { background: "#EEF2FF", color: "#4f46e5", border: "1px solid #DBE2FF", padding: "8px 12px", borderRadius: 999, fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap" };

// /* recent resources styles */
// const resHeader = { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 };
// const pillLink = { background: "#F4F6FF", color: "#4f46e5", border: "1px solid #E3E8FF", padding: "6px 10px", borderRadius: 999, fontWeight: 800, fontSize: 13, textDecoration: "none" };
// const resItem = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 12px", border: "1px solid #EEF0F5", background: "#fff", borderRadius: 12 };
// const resLeft = { display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 };
// const resIcon = { width: 34, height: 34, display: "grid", placeItems: "center", borderRadius: 10, background: "#F3F4FF", color: "#4f46e5", border: "1px solid #E8EAFF", fontSize: 16 };
// const resTitle = { fontWeight: 800, color: "#111827", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 520 };
// const resMeta = { color: "#6b7280", fontSize: 12, display: "flex", alignItems: "center", flexWrap: "wrap" };
// const metaBit = { display: "inline-flex", alignItems: "center" };
// const metaDot = { margin: "0 6px", color: "#CBD5E1" };
// const resRight = { display: "flex", alignItems: "center" };
// const btnPill = { background: "#EEF2FF", color: "#4f46e5", border: "1px solid #DBE2FF", padding: "8px 12px", borderRadius: 999, fontWeight: 800, cursor: "pointer", textDecoration: "none" };

// /* skeletons */
// const skeletonHero = { height: 160, borderRadius: 16, border: "1px solid #EEF0F5", background: "linear-gradient(90deg,#f3f4f6 0%, #f9fafb 20%, #f3f4f6 40%)", backgroundSize: "200% 100%", animation: "s 1.2s linear infinite" };
// const skeletonSection = { height: 280, borderRadius: 14, border: "1px solid #EEF0F5", background: "linear-gradient(90deg,#f3f4f6 0%, #f9fafb 20%, #f3f4f6 40%)", backgroundSize: "200% 100%", animation: "s 1.2s linear infinite" };



// frontend/src/pages/GroupDetail.jsx
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
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

/* ---------------- Small helpers ---------------- */
const fmtTime = (iso) =>
  iso ? new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "—";
const timeShort = (iso) =>
  iso ? new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "";
const initials = (name = "", email = "") => {
  const src = (name || email || "?").trim();
  const parts = src.replace(/\s+/g, " ").split(" ");
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
};
const colorFromString = (s) => {
  const palette = ["#D6E4FF", "#FDE68A", "#FBD5D5", "#D1FAE5", "#E9D5FF", "#C7F9FF", "#FFE4E6", "#F5F3FF"];
  let h = 0;
  for (let i = 0; i < (s || "").length; i++) h = (h * 31 + s.charCodeAt(i)) % 9973;
  return palette[h % palette.length];
};
const prettySize = (n) => {
  if (n === 0) return "0 B";
  if (!n) return "";
  const k = 1024, u = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(n) / Math.log(k));
  return `${(n / Math.pow(k, i)).toFixed(i ? 1 : 0)} ${u[i]}`;
};
const domainFromUrl = (u) => {
  try { return new URL(u).hostname.replace(/^www\./, ""); }
  catch { return ""; }
};
function cryptoId() {
  try { return crypto.randomUUID(); }
  catch { return Math.random().toString(36).slice(2, 10); }
}

/* ====================================================================== */

export default function GroupDetail() {
  const { gid } = useParams();
  const navigate = useNavigate();

  const me = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("user") || "{}"); }
    catch { return {}; }
  }, []);
  const myId = useMemo(() => String(me?._id ?? me?.id ?? me?.userId ?? ""), [me]);

  const [loading, setLoading] = useState(true);
  const [group, setGroup] = useState(null);

  // members modal
  const [membersOpen, setMembersOpen] = useState(false);
  const [members, setMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(false);

  // confirm modal
  const [confirmState, setConfirmState] = useState({ open: false, title: "", message: "", onConfirm: null });
  const askConfirm = (title, message, onConfirm) => setConfirmState({ open: true, title, message, onConfirm });
  const closeConfirm = () => setConfirmState({ open: false, title: "", message: "", onConfirm: null });

  // meeting request modal
  const [meetOpen, setMeetOpen] = useState(false);
  const [meetTarget, setMeetTarget] = useState(null);
  const [meetInitial, setMeetInitial] = useState(null);
  const [savedSlots, setSavedSlots] = useState([]);

  // resources (recent)
  const [resources, setResources] = useState([]);
  const [resBusy, setResBusy] = useState(false);

  /* ---------------- Notes (per-group, autosave, tools) ---------------- */
  const noteKey = `gd-notes-${gid}`;
  const [notes, setNotes] = useState("");
  const notesRef = useRef("");
  const saveNotesDebounced = useRef(null);

  /* ---------------- Checklist (per-group with CRUD/reorder) ----------- */
  const listKey = `gd-checklist-${gid}`;
  const defaultChecklist = [
    { id: cryptoId(), label: "Review this week's readings", done: false },
    { id: cryptoId(), label: "Prepare lab notebook", done: false },
    { id: cryptoId(), label: "Practice quiz questions", done: false },
    { id: cryptoId(), label: "Confirm next study session time", done: false },
  ];
  const [checklist, setChecklist] = useState(defaultChecklist);
  const [newItem, setNewItem] = useState("");

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
      setSavedSlots((Array.isArray(mine) ? mine : []).map((r) => ({ day: r.day, from: r.from, to: r.to })));
    } catch {
      setSavedSlots([]);
    }
  };

  const loadRecentResources = async () => {
    try {
      setResBusy(true);
      const list = await apiGet(`/api/resources/list?group_id=${encodeURIComponent(gid)}`);
      const arr = Array.isArray(list) ? list.slice(0, 5) : [];
      setResources(arr);
    } catch (e) {
      console.error(e);
      setResources([]);
    } finally {
      setResBusy(false);
    }
  };

  useEffect(() => { loadGroup(); }, [gid, myId]);
  useEffect(() => { loadRecentResources(); }, [gid]);

  // Notes: load + autosave with debounce
  useEffect(() => {
    const saved = localStorage.getItem(noteKey);
    if (saved != null) {
      setNotes(saved);
      notesRef.current = saved;
    } else {
      setNotes("");
      notesRef.current = "";
    }
  }, [noteKey]);

  useEffect(() => {
    if (saveNotesDebounced.current) clearTimeout(saveNotesDebounced.current);
    saveNotesDebounced.current = setTimeout(() => {
      localStorage.setItem(noteKey, notesRef.current);
    }, 400);
    return () => clearTimeout(saveNotesDebounced.current);
  }, [noteKey]);

  const onNotesChange = (val) => {
    notesRef.current = val;
    setNotes(val);
    if (saveNotesDebounced.current) clearTimeout(saveNotesDebounced.current);
    saveNotesDebounced.current = setTimeout(() => {
      localStorage.setItem(noteKey, notesRef.current);
    }, 400);
  };

  const notesCounts = useMemo(() => {
    const words = (notes.trim().match(/\S+/g) || []).length;
    const chars = notes.length;
    return { words, chars };
  }, [notes]);

  const copyNotes = async () => {
    try { await navigator.clipboard.writeText(notes); toast.success("Copied notes"); }
    catch { toast.error("Copy failed"); }
  };
  const downloadNotes = () => {
    const blob = new Blob([notes], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${(group?.title || "notes").replace(/\s+/g, "_")}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const clearNotes = () => onNotesChange("");

  // Checklist: load/save
  useEffect(() => {
    const saved = localStorage.getItem(listKey);
    if (saved) {
      try { setChecklist(JSON.parse(saved)); }
      catch { setChecklist(defaultChecklist); }
    } else {
      setChecklist(defaultChecklist);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listKey]);

  useEffect(() => {
    localStorage.setItem(listKey, JSON.stringify(checklist));
  }, [listKey, checklist]);

  const addItem = () => {
    const label = newItem.trim();
    if (!label) return;
    setChecklist((prev) => [...prev, { id: cryptoId(), label, done: false }]);
    setNewItem("");
  };
  const toggleItem = (id, done) => {
    setChecklist((prev) => prev.map((x) => (x.id === id ? { ...x, done } : x)));
  };
  const editItem = (id, label) => {
    setChecklist((prev) => prev.map((x) => (x.id === id ? { ...x, label } : x)));
  };
  const removeItem = (id) => setChecklist((prev) => prev.filter((x) => x.id !== id));
  const markAll = (value) => setChecklist((prev) => prev.map((x) => ({ ...x, done: value })));
  const clearCompleted = () => setChecklist((prev) => prev.filter((x) => !x.done));
  const resetDefaults = () => setChecklist(defaultChecklist);
  const moveItem = (idx, dir) => {
    setChecklist((prev) => {
      const arr = prev.slice();
      const j = idx + dir;
      if (j < 0 || j >= arr.length) return prev;
      [arr[idx], arr[j]] = [arr[j], arr[idx]];
      return arr;
    });
  };

  const progress = useMemo(() => {
    const total = checklist.length || 1;
    const done = checklist.filter((x) => x.done).length;
    return { done, total, pct: Math.round((done / total) * 100) };
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

  const goBack = () => navigate("/dashboard");

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

  const requestMeetingFor = async (member) => {
    const id = String(member?._id ?? member?.id ?? member?.userId ?? "");
    setMeetTarget({ id, name: member?.name || "", email: member?.email || "" });
    setMeetInitial(null);
    await loadMyAvailability();
    setMeetOpen(true);
  };

  const sendMeeting = async (slot) => {
    try {
      await apiPost(`/api/meetings/request`, { receiver_id: String(meetTarget?.id), slot });
      toast.success("Meeting request sent");
    } catch (e) {
      console.error(e);
      toast.error("Could not send meeting request");
      throw e;
    }
  };

  const downloadRes = async (rid, filename = "file") => {
    try {
      const url = `${API_BASE}/api/resources/download/${rid}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token") || ""}` },
      });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 3000);
    } catch (e) {
      console.error(e);
      toast.error("Download failed");
    }
  };

  if (loading) {
    return (
      <div style={pageWrap}>
        <div style={container}>
          <div style={skeletonHero} />
          <div style={grid}>
            <div style={skeletonSection} />
            <div style={skeletonSection} />
          </div>
        </div>
      </div>
    );
  }
  if (!group) return <div style={{ padding: 24, color: "#ef4444" }}>Group not found.</div>;

  return (
    <>
      <div style={pageWrap}>
        <div style={container}>
          {/* Top Bar */}
          <div style={topRow}>
            <button style={chipLink} onClick={goBack}>← Back to dashboard</button>
            <Link to={`/group/${gid}/polls`} style={pillLinkStrong}>Open polls</Link>
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

            <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
              {(amMember || isOwner) && <button style={btnGhost} onClick={leave}>Leave group</button>}
              <Link to={`/group/${gid}/polls`} style={pillPrimary}>Manage polls</Link>
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

              {/* Checklist */}
              <section style={section}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, gap: 8, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <h3 style={sectionTitle}>Study checklist</h3>
                    <span style={counterChip}>{progress.done}/{progress.total}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button style={miniGhost} onClick={() => markAll(true)} title="Mark all done">Mark all</button>
                    <button style={miniGhost} onClick={() => markAll(false)} title="Unmark all">Unmark</button>
                    <button style={miniGhost} onClick={clearCompleted} title="Clear completed">Clear ✓</button>
                    <button style={miniGhost} onClick={resetDefaults} title="Reset to defaults">Reset</button>
                  </div>
                </div>

                <div style={progWrap} aria-label="progress">
                  <div style={{ ...progBar, width: `${progress.pct}%` }} />
                </div>
                <div style={progCaption}>{progress.pct}% complete</div>

                <div style={addRow}>
                  <input
                    value={newItem}
                    onChange={(e) => setNewItem(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addItem()}
                    placeholder="Add a task…"
                    style={addInput}
                  />
                  <button style={btnPrimary} onClick={addItem}>Add</button>
                </div>

                <ul style={listPlain}>
                  {checklist.map((item, idx) => (
                    <li key={item.id} style={checkRow}>
                      <label style={checkLabel}>
                        <input
                          type="checkbox"
                          checked={item.done}
                          onChange={(e) => toggleItem(item.id, e.target.checked)}
                        />
                        <input
                          value={item.label}
                          onChange={(e) => editItem(item.id, e.target.value)}
                          style={editInput(item.done)}
                        />
                      </label>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button style={miniIcon} title="Move up" onClick={() => moveItem(idx, -1)}>↑</button>
                        <button style={miniIcon} title="Move down" onClick={() => moveItem(idx, +1)}>↓</button>
                        <button style={miniDanger} title="Delete" onClick={() => removeItem(item.id)}>✕</button>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>

              <section style={section}>
                <h3 style={sectionTitle}>Quick links</h3>
                <div style={quickGrid}>
                  <Link to={`/group/${gid}/polls`} style={quickBtn}>Open polls</Link>
                  <Link to={`/group/${gid}/resources`} style={{ ...quickBtn, color: "#4f46e5", borderColor: "#dbe2ff", background: "#eef2ff" }}>
                    Open resources
                  </Link>
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

              {/* Recent resources */}
              <section style={section}>
                <div style={resHeader}>
                  <h3 style={sectionTitle}>Recent resources</h3>
                  <Link to={`/group/${gid}/resources`} style={pillLink}>View all</Link>
                </div>

                {resBusy ? (
                  <div style={{ color: "#6b7280" }}>Loading…</div>
                ) : resources.length === 0 ? (
                  <div style={{ color: "#6b7280" }}>Nothing shared yet.</div>
                ) : (
                  <div style={{ display: "grid", gap: 8 }}>
                    {resources.slice(0, 4).map((r) => {
                      const isFile = r.type === "file";
                      const title = r.title || (isFile ? (r.filename || "File") : (r.url || "Link"));
                      const uploader =
                        (r.createdByName && r.createdByName.trim()) ||
                        (r.createdByEmail && r.createdByEmail.split("@")[0]) ||
                        (String(r.createdBy) === myId ? "you" : "member");
                      const metaBits = [
                        isFile ? prettySize(r.size) : domainFromUrl(r.url),
                        uploader,
                        timeShort(r.createdAt),
                      ].filter(Boolean);

                      return (
                        <div key={r._id} style={resItem}>
                          <div style={resLeft}>
                            <div style={resIcon} aria-hidden>{isFile ? "📄" : "🔗"}</div>
                            <div style={{ minWidth: 0 }}>
                              <div title={title} style={resTitle}>{title}</div>
                              <div style={resMeta}>
                                {metaBits.map((m, i) => (
                                  <span key={i} style={metaBit}>
                                    {m}{i < metaBits.length - 1 ? <span style={metaDot}>•</span> : null}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                          <div style={resRight}>
                            {isFile ? (
                              <button onClick={() => downloadRes(r._id, r.filename || "file")} style={btnPill}>Download</button>
                            ) : (
                              <a href={r.url} target="_blank" rel="noreferrer" style={btnPill}>Open</a>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* Notes */}
              <section style={section}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <h3 style={sectionTitle}>My notes</h3>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ color: "#6b7280", fontSize: 12 }}>
                      {notesCounts.words} words · {notesCounts.chars} chars
                    </span>
                    <button style={miniGhost} onClick={copyNotes}>Copy</button>
                    <button style={miniGhost} onClick={downloadNotes}>Download</button>
                    <button style={miniDanger} onClick={clearNotes}>Clear</button>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                  {[
                    "Action items:\n- \n- \n- ",
                    "Meeting summary:\n• Topic: \n• Key points: \n• Next steps: ",
                    "Study plan:\nWeek:\n1) \n2) \n3) ",
                  ].map((tpl, i) => (
                    <button
                      key={i}
                      style={chipSmall}
                      onClick={() => onNotesChange((notes || "") + (notes && !notes.endsWith("\n") ? "\n" : "") + tpl)}
                    >
                      + {i === 0 ? "Action items" : i === 1 ? "Meeting summary" : "Study plan"}
                    </button>
                  ))}
                </div>

                <textarea
                  placeholder="Write reminders or TODOs for this group. (Saved only on this browser)"
                  value={notes}
                  onChange={(e) => onNotesChange(e.target.value)}
                  style={notesBox}
                  rows={10}
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

/* ---------------- Small presentational bit ---------------- */
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

/* ============================== styles ============================== */
const pageWrap = { padding: "32px 16px 72px", minHeight: "calc(100vh - 80px)", background: "linear-gradient(180deg,#f8f9ff 0%, #ffffff 100%)" };
const container = { width: "min(1100px, 96vw)", margin: "0 auto" };

const topRow = { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 };
const chipLink = { background: "#F4F6FF", color: "#4f46e5", border: "1px solid #E3E8FF", padding: "8px 12px", borderRadius: 999, fontWeight: 700, fontSize: 14, cursor: "pointer" };
const pillLinkStrong = { ...chipLink, textDecoration: "none" };

const heroCard = { width: "100%", background: "linear-gradient(180deg,#ffffff,#fafaff)", borderRadius: 16, border: "1px solid #EEF0F5", boxShadow: "0 18px 60px rgba(2,6,23,0.06)", padding: 18 };
const courseRow = { display: "flex", alignItems: "center", gap: 6, color: "#6b7280", fontWeight: 700 };
const courseCode = { background: "#EEF2FF", border: "1px solid #E0E7FF", color: "#4f46e5", padding: "2px 8px", borderRadius: 999, fontWeight: 800, fontSize: 12 };
const h1 = { margin: "8px 0 6px", fontSize: 26, lineHeight: 1.2, fontWeight: 900 };
const subtitle = { color: "#111827" };
const statsWrap = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10, marginTop: 10 };
const statCard = { border: "1px solid #EEF0F5", borderRadius: 12, background: "#fff", padding: 12 };

const btnGhost = { background: "#fff", color: "#6b7280", border: "1px solid #e5e7eb", padding: "10px 14px", borderRadius: 10, fontWeight: 700, cursor: "pointer" };
const btnPrimary = { background: "linear-gradient(180deg,#5b7cfa,#4f46e5)", color: "#fff", border: 0, padding: "10px 14px", borderRadius: 10, fontWeight: 800, cursor: "pointer" };
const pillPrimary = { background: "#4f46e5", color: "#fff", border: "1px solid #4f46e5", padding: "8px 12px", borderRadius: 999, fontWeight: 800, fontSize: 14, textDecoration: "none" };
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

/* checklist styles */
const counterChip = {
  background: "#EEF2FF",
  border: "1px solid #DBE2FF",
  color: "#4f46e5",
  padding: "4px 10px",
  borderRadius: 999,
  fontWeight: 800,
  fontSize: 12,
  lineHeight: 1
};
const progWrap = { position: "relative", height: 12, background: "#F3F4F6", borderRadius: 999, border: "1px solid #E5E7EB" };
const progBar  = { position: "absolute", inset: 0, height: "100%", background: "linear-gradient(90deg,#34d399,#4ade80)", borderRadius: 999 };
const progCaption = { marginTop: 6, fontSize: 12, color: "#6b7280", fontWeight: 700 };
const addRow = { display: "flex", gap: 8, marginTop: 10, marginBottom: 8 };
const addInput = {
  flex: 1,
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: "10px 12px",
  outline: "none",
  fontFamily: "inherit",
  boxSizing: "border-box"
};
const editInput = (done) => ({
  border: 0,
  outline: "none",
  background: "transparent",
  fontWeight: 600,
  textDecoration: done ? "line-through" : "none",
  color: done ? "#6b7280" : "#111827",
  width: "100%",
});

const checkRow = { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px dashed #eef0f5" };
const checkLabel = { display: "flex", alignItems: "center", gap: 8, fontWeight: 600 };

const miniGhost = { background: "#fff", color: "#4f46e5", border: "1px solid #dbe2ff", padding: "6px 10px", borderRadius: 999, fontWeight: 700, cursor: "pointer", fontSize: 12 };
const miniDanger = { background: "#fff1f2", color: "#be123c", border: "1px solid #fecdd3", padding: "6px 10px", borderRadius: 999, fontWeight: 700, cursor: "pointer", fontSize: 12 };
const miniIcon = { ...miniGhost, padding: "4px 8px" };

/* notes styles */
const chipSmall = { background: "#F4F6FF", color: "#4f46e5", border: "1px solid #E3E8FF", padding: "4px 8px", borderRadius: 999, fontWeight: 700, fontSize: 12, cursor: "pointer" };
const notesBox = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: 12,
  outline: "none",
  fontFamily: "inherit",
  lineHeight: 1.5,
  resize: "vertical",
  minHeight: 180,
  background: "#fff"
};

/* members modal styles & misc */
const backdrop = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 50 };
const modal = { width: "min(900px, 96vw)", background: "#fff", borderRadius: 18, border: "1px solid #EDF0F5", boxShadow: "0 18px 60px rgba(0,0,0,0.20)", padding: 16 };
const modalHead = { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 };
const modalX = { appearance: "none", border: 0, background: "#f3f4f6", color: "#111827", width: 36, height: 36, borderRadius: 10, cursor: "pointer" };
const memberList = { listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 10, maxHeight: "60vh", overflow: "auto" };
const memberItem = { display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", border: "1px solid #eef0f5", borderRadius: 12, background: "#fff" };
const avatar = { width: 34, height: 34, borderRadius: "50%", display: "grid", placeItems: "center", fontWeight: 800, color: "#111827", border: "1px solid #e5e7eb" };
const btnReq = { background: "#EEF2FF", color: "#4f46e5", border: "1px solid #DBE2FF", padding: "8px 12px", borderRadius: 999, fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap" };

/* recent resources styles */
const resHeader = { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 };
const pillLink = { background: "#F4F6FF", color: "#4f46e5", border: "1px solid #E3E8FF", padding: "6px 10px", borderRadius: 999, fontWeight: 800, fontSize: 13, textDecoration: "none" };
const resItem = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 12px", border: "1px solid #EEF0F5", background: "#fff", borderRadius: 12 };
const resLeft = { display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 };
const resIcon = { width: 34, height: 34, display: "grid", placeItems: "center", borderRadius: 10, background: "#F3F4FF", color: "#4f46e5", border: "1px solid #E8EAFF", fontSize: 16 };
const resTitle = { fontWeight: 800, color: "#111827", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 520 };
const resMeta = { color: "#6b7280", fontSize: 12, display: "flex", alignItems: "center", flexWrap: "wrap" };
const metaBit = { display: "inline-flex", alignItems: "center" };
const metaDot = { margin: "0 6px", color: "#CBD5E1" };
const resRight = { display: "flex", alignItems: "center" };

/* skeletons */
const skeletonHero = { height: 160, borderRadius: 16, border: "1px solid #EEF0F5", background: "linear-gradient(90deg,#f3f4f6 0%, #f9fafb 20%, #f3f4f6 40%)", backgroundSize: "200% 100%", animation: "s 1.2s linear infinite" };
const skeletonSection = { height: 280, borderRadius: 14, border: "1px solid #EEF0F5", background: "linear-gradient(90deg,#f3f4f6 0%, #f9fafb 20%, #f3f4f6 40%)", backgroundSize: "200% 100%", animation: "s 1.2s linear infinite" };

const btnPill = {
  background: "#EEF2FF",
  color: "#4f46e5",
  border: "1px solid #DBE2FF",
  padding: "8px 12px",
  borderRadius: 999,
  fontWeight: 800,
  cursor: "pointer",
  textDecoration: "none"
};
