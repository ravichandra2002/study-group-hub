// frontend/src/pages/GroupDetail.jsx
import {
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { toast } from "react-toastify";
import ChatDock from "../components/ChatDock";
import MeetingRequestModal from "../components/MeetingRequestModal.jsx";
import {
  presenceJoinGroup,
  presenceLeaveGroup,
} from "../lib/socket";

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
  iso
    ? new Date(iso).toLocaleString([], {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "—";
const timeShort = (iso) =>
  iso
    ? new Date(iso).toLocaleString([], {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "";
const initials = (name = "", email = "") => {
  const src = (name || email || "?").trim();
  const parts = src.replace(/\s+/g, " ").split(" ");
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
};
const colorFromString = (s) => {
  const palette = [
    "#D6E4FF",
    "#FDE68A",
    "#FBD5D5",
    "#D1FAE5",
    "#E9D5FF",
    "#C7F9FF",
    "#FFE4E6",
    "#F5F3FF",
  ];
  let h = 0;
  for (let i = 0; i < (s || "").length; i++)
    h = (h * 31 + s.charCodeAt(i)) % 9973;
  return palette[h % palette.length];
};
const prettySize = (n) => {
  if (n === 0) return "0 B";
  if (!n) return "";
  const k = 1024,
    u = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(n) / Math.log(k));
  return `${(n / Math.pow(k, i)).toFixed(i ? 1 : 0)} ${u[i]}`;
};
const domainFromUrl = (u) => {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};
function cryptoId() {
  try {
    return crypto.randomUUID();
  } catch {
    return Math.random().toString(36).slice(2, 10);
  }
}

/* ====================================================================== */

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
  const myId = useMemo(
    () => String(me?._id ?? me?.id ?? me?.userId ?? ""),
    [me]
  );

  const [loading, setLoading] = useState(true);
  const [group, setGroup] = useState(null);

  // members modal
  const [membersOpen, setMembersOpen] = useState(false);
  const [members, setMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(false);

  // confirm modal
  const [confirmState, setConfirmState] = useState({
    open: false,
    title: "",
    message: "",
    onConfirm: null,
  });
  const askConfirm = (title, message, onConfirm) =>
    setConfirmState({ open: true, title, message, onConfirm });
  const closeConfirm = () =>
    setConfirmState({ open: false, title: "", message: "", onConfirm: null });

  // meeting request modal
  const [meetOpen, setMeetOpen] = useState(false);
  const [meetTarget, setMeetTarget] = useState(null);
  const [meetInitial, setMeetInitial] = useState(null);
  const [savedSlots, setSavedSlots] = useState([]);

  // resources (recent)
  const [resources, setResources] = useState([]);
  const [resBusy, setResBusy] = useState(false);

  // discussion reply badge (unread replies)
  const [unreadDiscussCount, setUnreadDiscussCount] = useState(0);

  // discussion points counter
  const [discussionPoints, setDiscussionPoints] = useState(0);

  // 👉 presence state: who is online in this group
  const [onlineMembers, setOnlineMembers] = useState([]); // [{_id,name,email,lastSeen}]
  const onlineCount = onlineMembers.length;

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
    {
      id: cryptoId(),
      label: "Confirm next study session time",
      done: false,
    },
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
      setSavedSlots(
        (Array.isArray(mine) ? mine : []).map((r) => ({
          day: r.day,
          from: r.from,
          to: r.to,
        }))
      );
    } catch {
      setSavedSlots([]);
    }
  };

  const loadRecentResources = async () => {
    try {
      setResBusy(true);
      const list = await apiGet(
        `/api/resources/list?group_id=${encodeURIComponent(gid)}`
      );
      const arr = Array.isArray(list) ? list.slice(0, 5) : [];
      setResources(arr);
    } catch (e) {
      console.error(e);
      setResources([]);
    } finally {
      setResBusy(false);
    }
  };

  useEffect(() => {
    loadGroup();
  }, [gid, myId]);

  useEffect(() => {
    loadRecentResources();
  }, [gid]);

  // ========= UNREAD DISCUSSION REPLIES BADGE =========
  const loadDiscussionBadge = async () => {
    console.log("[GroupDetail] loadDiscussionBadge() for gid =", gid);
    if (!gid) {
      console.log("[GroupDetail] No gid, skipping badge load");
      return;
    }

    try {
      const data = await apiGet(
        `/api/discussions/replies/unread?group_id=${encodeURIComponent(gid)}`
      );
      console.log("[GroupDetail] replies/unread summary:", data);

      let totalReplies = 0;

      if (Array.isArray(data)) {
        totalReplies = data.reduce(
          (sum, r) => sum + (r.replyCount ?? r.count ?? 1),
          0
        );
      } else if (data && typeof data === "object") {
        if (typeof data.total === "number") totalReplies = data.total;
        else if (typeof data.count === "number") totalReplies = data.count;
        else if (Array.isArray(data.rows)) {
          totalReplies = data.rows.reduce(
            (sum, r) => sum + (r.replyCount ?? r.count ?? 1),
            0
          );
        }
      }

      setUnreadDiscussCount(totalReplies);

      if (totalReplies > 0) {
        console.log(
          `[GroupDetail] You have ${totalReplies} replies on your threads in this group`
        );
      } else {
        console.log(
          "[GroupDetail] No replies on your threads in this group (from other users)"
        );
      }
    } catch (e) {
      console.error("[GroupDetail] loadDiscussionBadge FAILED:", e);
      setUnreadDiscussCount(0);
    }
  };

  // ========= DISCUSSION POINTS COUNTER =========
  const loadDiscussionPoints = async () => {
    console.log("[GroupDetail] loadDiscussionPoints() for gid =", gid);
    if (!gid) return;

    try {
      const data = await apiGet(
        `/api/discussions/points/summary?group_id=${encodeURIComponent(gid)}`
      );
      console.log("[GroupDetail] points summary:", data);
      const total = Number(data?.totalPoints ?? data?.points ?? 0);
      setDiscussionPoints(Number.isFinite(total) ? total : 0);
    } catch (e) {
      console.error("[GroupDetail] loadDiscussionPoints FAILED:", e);
      setDiscussionPoints(0);
    }
  };

  useEffect(() => {
    console.log(
      "[GroupDetail] mounting / gid changed, calling loadDiscussionBadge + loadDiscussionPoints"
    );
    loadDiscussionBadge();
    loadDiscussionPoints();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gid]);

  // -------- mark replies as seen (called when user opens discussions) -----
  const markRepliesSeen = async () => {
    if (!gid) return;
    try {
      await apiPost("/api/discussions/replies/mark_seen", {
        group_id: gid,
      });
      console.log("[GroupDetail] marked replies as seen for group", gid);
    } catch (e) {
      console.error("[GroupDetail] mark_seen failed:", e);
    }
  };

  const goBack = () => navigate("/dashboard");

  // when user clicks Open discussions
  const openDiscussions = () => {
    // optimistic UI: hide badge immediately
    setUnreadDiscussCount(0);

    // tell backend these replies are seen
    markRepliesSeen();

    // navigate to discussions page
    navigate(`/group/${gid}/discussions`);
  };

  // ---------- PRESENCE: join on mount, listen for updates ----------
  useEffect(() => {
    if (!gid || !myId) return;

    // join presence for this group
    presenceJoinGroup(gid);

    const handler = (evt) => {
      const detail = evt.detail || {};
      if (String(detail.groupId || "") !== String(gid)) return;
      const list = Array.isArray(detail.online) ? detail.online : [];
      setOnlineMembers(list);
    };

    window.addEventListener("sgh:presence", handler);

    return () => {
      // leave presence when leaving group page
      presenceLeaveGroup(gid, myId);
      window.removeEventListener("sgh:presence", handler);
    };
  }, [gid, myId]);

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
    if (saveNotesDebounced.current)
      clearTimeout(saveNotesDebounced.current);
    saveNotesDebounced.current = setTimeout(() => {
      localStorage.setItem(noteKey, notesRef.current);
    }, 400);
    return () => clearTimeout(saveNotesDebounced.current);
  }, [noteKey]);

  const onNotesChange = (val) => {
    notesRef.current = val;
    setNotes(val);
    if (saveNotesDebounced.current)
      clearTimeout(saveNotesDebounced.current);
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
    try {
      await navigator.clipboard.writeText(notes);
      toast.success("Copied notes");
    } catch {
      toast.error("Copy failed");
    }
  };
  const downloadNotes = () => {
    const blob = new Blob([notes], {
      type: "text/plain;charset=utf-8",
    });
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
      try {
        setChecklist(JSON.parse(saved));
      } catch {
        setChecklist(defaultChecklist);
      }
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
    setChecklist((prev) => [
      ...prev,
      { id: cryptoId(), label, done: false },
    ]);
    setNewItem("");
  };
  const toggleItem = (id, done) => {
    setChecklist((prev) =>
      prev.map((x) => (x.id === id ? { ...x, done } : x))
    );
  };
  const editItem = (id, label) => {
    setChecklist((prev) =>
      prev.map((x) => (x.id === id ? { ...x, label } : x))
    );
  };
  const removeItem = (id) =>
    setChecklist((prev) => prev.filter((x) => !x.done || x.id !== id));
  const markAll = (value) =>
    setChecklist((prev) =>
      prev.map((x) => ({ ...x, done: value }))
    );
  const clearCompleted = () =>
    setChecklist((prev) => prev.filter((x) => !x.done));
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
    return {
      done,
      total,
      pct: Math.round((done / total) * 100),
    };
  }, [checklist]);

  const isOwner = !!group?.isOwner;
  const amMember = group?.myJoinStatus === "member";
  const canSeeMembers = isOwner || amMember;
  const canChat = isOwner || amMember;
  const membersCount = group?.membersCount ?? group?.members?.length ?? 0;

  const leave = () =>
    askConfirm(
      "Leave group?",
      "Are you sure you want to leave this group?",
      async () => {
        try {
          await apiPost(`/api/groups/leave/${gid}`);
          toast.success("Left group");
          navigate("/dashboard");
        } catch {
          toast.error("Could not leave group");
        } finally {
          closeConfirm();
        }
      }
    );

  const isSelf = useCallback(
    (m) => {
      const mid = String(m?._id ?? m?.id ?? m?.userId ?? "");
      if (myId && mid && myId === mid) return true;
      if (
        m?.email &&
        me?.email &&
        m.email.toLowerCase() === me.email.toLowerCase()
      )
        return true;
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
    setMeetTarget({
      id,
      name: member?.name || "",
      email: member?.email || "",
    });
    setMeetInitial(null);
    await loadMyAvailability();
    setMeetOpen(true);
  };

  const sendMeeting = async (slot) => {
    try {
      await apiPost(`/api/meetings/request`, {
        receiver_id: String(meetTarget?.id),
        slot,
      });
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
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
        },
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
  if (!group)
    return (
      <div style={{ padding: 24, color: "#ef4444" }}>
        Group not found.
      </div>
    );

  return (
    <>
      <div style={pageWrap}>
        <div style={container}>
          {/* Top Bar */}
          <div style={topRow}>
            <button style={chipLink} onClick={goBack}>
              ← Back to dashboard
            </button>
            <Link to={`/group/${gid}/polls`} style={pillLinkStrong}>
              Open polls
            </Link>
          </div>

          {/* Hero */}
          <div style={heroCard}>
            {/* header row: left = basic info, right = discussion points */}
            <div style={heroHeaderRow}>
              <div style={heroMainInfo}>
                <div style={courseRow}>
                  <span style={courseCode}>{group.course || "Course"}</span>
                  <span style={{ width: 6 }} />
                  <span style={group.isOpen ? openChip : closedChip}>
                    <span style={group.isOpen ? openDot : closedDot} />{" "}
                    {group.isOpen ? "Open to join" : "Closed"}
                  </span>
                </div>

                <h1 style={h1}>{group.title}</h1>
                {group.description && (
                  <div style={subtitle}>{group.description}</div>
                )}
              </div>

              <DiscussionPointsCard points={discussionPoints} />
            </div>

            <div style={statsWrap}>
              <StatCard
                label="Your role"
                value={isOwner ? "Owner" : amMember ? "Member" : "Visitor"}
              />
              <StatCard label="Created" value={fmtTime(group.createdAt)} />
              <StatCard
                label="Members"
                value={
                  <button
                    type="button"
                    onClick={openMembers}
                    style={membersLinkBtn}
                  >
                    {membersCount}{" "}
                    {membersCount === 1 ? "member" : "members"}
                  </button>
                }
              />
              {/* 👉 Online presence stat */}
              <StatCard
                label="Online now"
                value={
                  onlineCount > 0 ? (
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <span style={presenceDot} />
                      {onlineCount}{" "}
                      {onlineCount === 1 ? "member" : "members"}
                    </span>
                  ) : (
                    "No one online"
                  )
                }
              />
            </div>

            <div
              style={{
                display: "flex",
                gap: 8,
                marginTop: 10,
                flexWrap: "wrap",
              }}
            >
              {(amMember || isOwner) && (
                <button style={btnGhost} onClick={leave}>
                  Leave group
                </button>
              )}
              <Link to={`/group/${gid}/polls`} style={pillPrimary}>
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
                  {(group.tags?.length
                    ? group.tags
                    : ["forensics", "lab", "assignment", "exam-prep"]
                  ).map((t) => (
                    <span key={t} style={tagChip}>
                      #{t}
                    </span>
                  ))}
                </div>
              </section>

              {/* Checklist */}
              <section style={section}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 8,
                    gap: 8,
                    flexWrap: "wrap",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <h3 style={sectionTitle}>Study checklist</h3>
                    <span style={counterChip}>
                      {progress.done}/{progress.total}
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <button
                      style={miniGhost}
                      onClick={() => markAll(true)}
                      title="Mark all done"
                    >
                      Mark all
                    </button>
                    <button
                      style={miniGhost}
                      onClick={() => markAll(false)}
                      title="Unmark all"
                    >
                      Unmark
                    </button>
                    <button
                      style={miniGhost}
                      onClick={clearCompleted}
                      title="Clear completed"
                    >
                      Clear ✓
                    </button>
                    <button
                      style={miniGhost}
                      onClick={resetDefaults}
                      title="Reset to defaults"
                    >
                      Reset
                    </button>
                  </div>
                </div>

                <div style={progWrap} aria-label="progress">
                  <div
                    style={{
                      ...progBar,
                      width: `${progress.pct}%`,
                    }}
                  />
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
                  <button style={btnPrimary} onClick={addItem}>
                    Add
                  </button>
                </div>

                <ul style={listPlain}>
                  {checklist.map((item, idx) => (
                    <li key={item.id} style={checkRow}>
                      <label style={checkLabel}>
                        <input
                          type="checkbox"
                          checked={item.done}
                          onChange={(e) =>
                            toggleItem(item.id, e.target.checked)
                          }
                        />
                        <input
                          value={item.label}
                          onChange={(e) => editItem(item.id, e.target.value)}
                          style={editInput(item.done)}
                        />
                      </label>
                      <div
                        style={{
                          display: "flex",
                          gap: 4,
                        }}
                      >
                        <button
                          style={miniIcon}
                          title="Move up"
                          onClick={() => moveItem(idx, -1)}
                        >
                          ↑
                        </button>
                        <button
                          style={miniIcon}
                          title="Move down"
                          onClick={() => moveItem(idx, +1)}
                        >
                          ↓
                        </button>
                        <button
                          style={miniDanger}
                          title="Delete"
                          onClick={() => removeItem(item.id)}
                        >
                          ✕
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>

              <section style={section}>
                <h3 style={sectionTitle}>Quick links</h3>
                <div style={quickGrid}>
                  <Link to={`/group/${gid}/polls`} style={quickBtn}>
                    Open polls
                  </Link>

                  <Link
                    to={`/group/${gid}/resources`}
                    style={{
                      ...quickBtn,
                      color: "#4f46e5",
                      borderColor: "#dbe2ff",
                      background: "#eef2ff",
                    }}
                  >
                    Open resources
                  </Link>

                  {/* Open discussions button + UNREAD BADGE ONLY */}
                  <button
                    type="button"
                    style={quickBtn}
                    onClick={openDiscussions}
                  >
                    <span>Open discussions</span>
                    {unreadDiscussCount > 0 && (
                      <span style={discussionBadge}>
                        {unreadDiscussCount}
                      </span>
                    )}
                  </button>

                  <button
                    style={quickBtn}
                    onClick={() =>
                      window.scrollTo({
                        top: 0,
                        behavior: "smooth",
                      })
                    }
                  >
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
                  <li>
                    Keep chat threads concise. Start a new thread for new topics.
                  </li>
                </ul>
              </section>

              {/* Recent resources */}
              <section style={section}>
                <div style={resHeader}>
                  <h3 style={sectionTitle}>Recent resources</h3>
                  <Link to={`/group/${gid}/resources`} style={pillLink}>
                    View all
                  </Link>
                </div>

                {resBusy ? (
                  <div style={{ color: "#6b7280" }}>Loading…</div>
                ) : resources.length === 0 ? (
                  <div style={{ color: "#6b7280" }}>Nothing shared yet.</div>
                ) : (
                  <div
                    style={{
                      display: "grid",
                      gap: 6,
                    }}
                  >
                    {resources.slice(0, 4).map((r) => {
                      const isFile = r.type === "file";
                      const title =
                        r.title ||
                        (isFile ? r.filename || "File" : r.url || "Link");
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
                            <div style={resIcon} aria-hidden>
                              {isFile ? "📄" : "🔗"}
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <div title={title} style={resTitle}>
                                {title}
                              </div>
                              <div style={resMeta}>
                                {metaBits.map((m, i) => (
                                  <span key={i} style={metaBit}>
                                    {m}
                                    {i < metaBits.length - 1 ? (
                                      <span style={metaDot}>•</span>
                                    ) : null}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                          <div style={resRight}>
                            {isFile ? (
                              <button
                                onClick={() =>
                                  downloadRes(r._id, r.filename || "file")
                                }
                                style={btnPill}
                              >
                                Download
                              </button>
                            ) : (
                              <a
                                href={r.url}
                                target="_blank"
                                rel="noreferrer"
                                style={btnPill}
                              >
                                Open
                              </a>
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
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 6,
                  }}
                >
                  <h3 style={sectionTitle}>My notes</h3>
                  <div
                    style={{
                      display: "flex",
                      gap: 6,
                      alignItems: "center",
                    }}
                  >
                    <span
                      style={{
                        color: "#6b7280",
                        fontSize: 12,
                      }}
                    >
                      {notesCounts.words} words · {notesCounts.chars} chars
                    </span>
                    <button style={miniGhost} onClick={copyNotes}>
                      Copy
                    </button>
                    <button style={miniGhost} onClick={downloadNotes}>
                      Download
                    </button>
                    <button style={miniDanger} onClick={clearNotes}>
                      Clear
                    </button>
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: 6,
                    flexWrap: "wrap",
                    marginBottom: 6,
                  }}
                >
                  {[
                    "Action items:\n- \n- \n- ",
                    "Meeting summary:\n• Topic: \n• Key points: \n• Next steps: ",
                    "Study plan:\nWeek:\n1) \n2) \n3) ",
                  ].map((tpl, i) => (
                    <button
                      key={i}
                      style={chipSmall}
                      onClick={() =>
                        onNotesChange(
                          (notes || "") +
                            (notes && !notes.endsWith("\n") ? "\n" : "") +
                            tpl
                        )
                      }
                    >
                      +
                      {i === 0
                        ? " Action items"
                        : i === 1
                        ? " Meeting summary"
                        : " Study plan"}
                    </button>
                  ))}
                </div>

                <textarea
                  placeholder="Write reminders or TODOs for this group. (Saved only on this browser)"
                  value={notes}
                  onChange={(e) => onNotesChange(e.target.value)}
                  style={notesBox}
                  rows={9}
                />
                <div
                  style={{
                    marginTop: 6,
                    fontSize: 12,
                    color: "#6b7280",
                  }}
                >
                  Notes are stored locally and are private to you.
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>

      {/* Chat */}
      <div data-chat-dock>
        <ChatDock
          gid={gid}
          groupTitle={group?.title}
          canChat={canChat}
          myId={myId}
          me={me}
        />
      </div>

      {/* Members modal */}
      {membersOpen && (
        <div style={backdrop} onClick={closeMembers}>
          <div
            role="dialog"
            aria-modal="true"
            style={modal}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={modalHead}>
              <h3
                style={{
                  margin: 0,
                  fontSize: 20,
                  fontWeight: 800,
                }}
              >
                Members · {group.title}
              </h3>
              <button style={modalX} onClick={closeMembers} aria-label="Close">
                ✕
              </button>
            </div>

            {!canSeeMembers ? (
              <div
                style={{
                  padding: 12,
                  color: "#6b7280",
                }}
              >
                Only group members can view the member list.
              </div>
            ) : membersLoading ? (
              <div
                style={{
                  padding: 12,
                  color: "#6b7280",
                }}
              >
                Loading members…
              </div>
            ) : members.length === 0 ? (
              <div
                style={{
                  padding: 12,
                  color: "#6b7280",
                }}
              >
                No members yet.
              </div>
            ) : (
              <ul style={memberList}>
                {members.map((m) => {
                  const id = String(m?._id ?? m?.id ?? m?.userId ?? "");
                  const bg = colorFromString(m.name || m.email);
                  const you = isSelf(m);
                  const isOnline = onlineMembers.some(
                    (o) => String(o?._id || "") === id
                  );
                  return (
                    <li key={id || m.email} style={memberItem}>
                      <div
                        style={{
                          ...avatar,
                          background: bg,
                        }}
                        aria-hidden
                      >
                        {initials(m.name, m.email)}
                      </div>
                      <div
                        style={{
                          flex: 1,
                          minWidth: 0,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            minWidth: 0,
                            flexWrap: "wrap",
                          }}
                        >
                          <div
                            style={{
                              fontWeight: 700,
                              whiteSpace: "nowrap",
                              textOverflow: "ellipsis",
                              overflow: "hidden",
                            }}
                            title={m.name || m.email}
                          >
                            {m.name || m.email}
                            {you ? " (You)" : ""}
                          </div>
                          {m.isOwner && (
                            <span style={ownerChip} title="Group owner">
                              <span style={ownerDot} /> Owner
                            </span>
                          )}
                          {isOnline && (
                            <span style={presenceChip} title="Online now">
                              <span style={presenceDot} /> Online
                            </span>
                          )}
                        </div>
                        {m.email && <div style={emailSub}>{m.email}</div>}
                      </div>

                      {!you && id && (
                        <button
                          style={btnReq}
                          onClick={() => requestMeetingFor(m)}
                          title="Propose a meeting"
                        >
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

/* ---------------- Small presentational bits ---------------- */

function StatCard({ label, value }) {
  return (
    <div style={statCard}>
      <div>
        <div
          style={{
            color: "#6b7280",
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontWeight: 800,
            whiteSpace: "nowrap",
            textOverflow: "ellipsis",
            overflow: "hidden",
            maxWidth: 260,
          }}
        >
          {value}
        </div>
      </div>
    </div>
  );
}

// 🔹 New: discussion points card shown on the top-right of the hero
function DiscussionPointsCard({ points }) {
  const [hovered, setHovered] = useState(false);

  let level = "No activity yet";
  let accent = "#6b7280";
  let bg = "linear-gradient(135deg,#f3f4f6,#e5e7eb)";

  if (points >= 40) {
    level = "Group legend";
    accent = "#7c3aed";
    bg = "linear-gradient(135deg,#ede9fe,#ddd6fe)";
  } else if (points >= 25) {
    level = "Discussion pro";
    accent = "#2563eb";
    bg = "linear-gradient(135deg,#dbeafe,#bfdbfe)";
  } else if (points >= 10) {
    level = "Active member";
    accent = "#16a34a";
    bg = "linear-gradient(135deg,#dcfce7,#bbf7d0)";
  } else if (points >= 1) {
    level = "Nice start";
    accent = "#f97316";
    bg = "linear-gradient(135deg,#ffedd5,#fed7aa)";
  }

  const cardStyle = {
    minWidth: 190,
    maxWidth: 220,
    padding: 10,
    borderRadius: 14,
    border: `1px solid ${accent}`,
    background: bg,
    color: "#111827",
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    justifyContent: "center",
    boxShadow: hovered
      ? "0 16px 35px rgba(15,23,42,0.25)"
      : "0 10px 24px rgba(15,23,42,0.12)",
    transform: hovered ? "translateY(-2px) scale(1.02)" : "translateY(0) scale(1)",
    transition: "transform 0.18s ease, box-shadow 0.18s ease",
  };

  return (
    <div
      style={cardStyle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: 0.06,
          color: "#374151",
          marginBottom: 4,
        }}
      >
        Discussion points
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 6,
        }}
      >
        <span
          style={{
            fontSize: 26,
            fontWeight: 900,
            lineHeight: 1,
          }}
        >
          {points}
        </span>
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            textTransform: "uppercase",
          }}
        >
          pts
        </span>
      </div>

      <div
        style={{
          marginTop: 6,
          padding: "3px 8px",
          borderRadius: 999,
          border: "1px solid rgba(15,23,42,0.08)",
          background: "rgba(255,255,255,0.65)",
          fontSize: 11,
          fontWeight: 700,
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: accent,
            boxShadow: "0 0 0 3px rgba(255,255,255,0.8)",
          }}
        />
        <span>{level}</span>
      </div>
    </div>
  );
}

function ConfirmModal({ open, title, message, onCancel, onConfirm }) {
  if (!open) return null;
  return (
    <div style={backdrop} onClick={onCancel}>
      <div
        role="dialog"
        aria-modal="true"
        style={modal}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={modalHead}>
          <h3
            style={{
              margin: 0,
              fontSize: 18,
              fontWeight: 800,
            }}
          >
            {title || "Are you sure?"}
          </h3>
          <button style={modalX} onClick={onCancel} aria-label="Close">
            ✕
          </button>
        </div>
        <div
          style={{
            color: "#374151",
            marginBottom: 10,
            fontSize: 13,
          }}
        >
          {message || ""}
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 6,
          }}
        >
          <button style={btnGhost} onClick={onCancel}>
            Cancel
          </button>
          <button
            style={btnPrimary}
            onClick={() => onConfirm && onConfirm()}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================== styles ============================== */
const pageWrap = {
  padding: "28px 14px 60px",
  minHeight: "calc(100vh - 80px)",
  background: "linear-gradient(180deg,#f8f9ff 0%, #ffffff 100%)",
};
const container = {
  width: "min(1100px, 96vw)",
  margin: "0 auto",
};

const topRow = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 12,
};
const chipLink = {
  background: "#F4F6FF",
  color: "#4f46e5",
  border: "1px solid #E3E8FF",
  padding: "6px 10px",
  borderRadius: 999,
  fontWeight: 700,
  fontSize: 12,
  cursor: "pointer",
};
const pillLinkStrong = { ...chipLink, textDecoration: "none" };

const heroCard = {
  width: "100%",
  background: "linear-gradient(180deg,#ffffff,#fafaff)",
  borderRadius: 14,
  border: "1px solid #EEF0F5",
  boxShadow: "0 18px 60px rgba(2,6,23,0.06)",
  padding: 16,
};

const heroHeaderRow = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
};
const heroMainInfo = {
  flex: 1,
  minWidth: 0,
};

const courseRow = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  color: "#6b7280",
  fontWeight: 700,
};
const courseCode = {
  background: "#EEF2FF",
  border: "1px solid #E0E7FF",
  color: "#4f46e5",
  padding: "2px 8px",
  borderRadius: 999,
  fontWeight: 800,
  fontSize: 11,
};
const h1 = {
  margin: "6px 0 4px",
  fontSize: 22,
  lineHeight: 1.2,
  fontWeight: 900,
};
const subtitle = { color: "#111827", fontSize: 13 };
const statsWrap = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 8,
  marginTop: 8,
};
const statCard = {
  border: "1px solid #EEF0F5",
  borderRadius: 10,
  background: "#fff",
  padding: 10,
};

const btnGhost = {
  background: "#fff",
  color: "#6b7280",
  border: "1px solid #e5e7eb",
  padding: "8px 12px",
  borderRadius: 9,
  fontWeight: 700,
  cursor: "pointer",
  fontSize: 12,
};
const btnPrimary = {
  background: "linear-gradient(180deg,#5b7cfa,#4f46e5)",
  color: "#fff",
  border: 0,
  padding: "8px 12px",
  borderRadius: 9,
  fontWeight: 800,
  cursor: "pointer",
  fontSize: 12,
};
const pillPrimary = {
  background: "#4f46e5",
  color: "#fff",
  border: "1px solid #4f46e5",
  padding: "6px 10px",
  borderRadius: 999,
  fontWeight: 800,
  fontSize: 12,
  textDecoration: "none",
};
const membersLinkBtn = {
  appearance: "none",
  background: "transparent",
  border: 0,
  color: "#4f46e5",
  fontWeight: 800,
  fontSize: 13,
  padding: 0,
  textDecoration: "none",
  cursor: "pointer",
};

const grid = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 12,
  marginTop: 12,
};
const col = { display: "flex", flexDirection: "column", gap: 12 };
const section = {
  border: "1px solid #EEF0F5",
  background: "#fff",
  borderRadius: 12,
  padding: 12,
  boxShadow: "0 6px 24px rgba(2,6,23,0.04)",
};
const sectionTitle = {
  margin: 0,
  marginBottom: 6,
  fontSize: 15,
  fontWeight: 900,
};

const tagWrap = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
  marginTop: 8,
};
const tagChip = {
  background: "#F5F3FF",
  border: "1px solid #EDE9FE",
  color: "#6D28D9",
  padding: "3px 8px",
  borderRadius: 999,
  fontWeight: 800,
  fontSize: 11,
};
const listPlain = { listStyle: "none", padding: 0, margin: 0 };
const pMuted = { color: "#374151", margin: 0, fontSize: 13 };

const quickGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0,1fr))",
  gap: 6,
};
const quickBtn = {
  ...btnGhost,
  textAlign: "center",
  borderRadius: 999,
  padding: "8px 10px",
  textDecoration: "none",
  fontSize: 12,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  position: "relative", // needed for top-right badge
  overflow: "visible",
};

const bullets = {
  margin: "2px 0 0 18px",
  color: "#374151",
  fontSize: 13,
};
const emailSub = {
  color: "#6b7280",
  fontSize: 12,
  whiteSpace: "nowrap",
  textOverflow: "ellipsis",
  overflow: "hidden",
  marginTop: 2,
};
const ownerChip = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "2px 8px",
  borderRadius: 999,
  background: "#FFF7E6",
  border: "1px solid #FFE3A3",
  color: "#A16207",
  fontSize: 11,
  fontWeight: 700,
  lineHeight: 1,
};
const ownerDot = {
  width: 8,
  height: 8,
  borderRadius: "50%",
  background: "linear-gradient(180deg,#F59E0B,#D97706)",
  boxShadow: "0 0 0 3px #FFF2CC",
};

const openChip = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "2px 8px",
  borderRadius: 999,
  background: "#ECFEFF",
  border: "1px solid #BAE6FD",
  color: "#075985",
  fontSize: 11,
  fontWeight: 800,
};
const openDot = {
  width: 8,
  height: 8,
  borderRadius: "50%",
  background: "linear-gradient(180deg,#38BDF8,#0EA5E9)",
  boxShadow: "0 0 0 3px #DFF5FF",
};
const closedChip = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "2px 8px",
  borderRadius: 999,
  background: "#FEF2F2",
  border: "1px solid #FECACA",
  color: "#991B1B",
  fontSize: 11,
  fontWeight: 800,
};
const closedDot = {
  width: 8,
  height: 8,
  borderRadius: "50%",
  background: "linear-gradient(180deg,#F87171,#DC2626)",
  boxShadow: "0 0 0 3px #FFE2E2",
};

/* presence chip styles */
const presenceDot = {
  width: 8,
  height: 8,
  borderRadius: "50%",
  background: "linear-gradient(180deg,#22C55E,#16A34A)",
  boxShadow: "0 0 0 3px #DCFCE7",
};
const presenceChip = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "2px 8px",
  borderRadius: 999,
  background: "#ECFDF3",
  border: "1px solid #BBF7D0",
  color: "#15803D",
  fontSize: 11,
  fontWeight: 700,
  lineHeight: 1,
};

/* checklist styles */
const counterChip = {
  background: "#EEF2FF",
  border: "1px solid #DBE2FF",
  color: "#4f46e5",
  padding: "3px 8px",
  borderRadius: 999,
  fontWeight: 800,
  fontSize: 11,
  lineHeight: 1,
};
const progWrap = {
  position: "relative",
  height: 10,
  background: "#F3F4F6",
  borderRadius: 999,
  border: "1px solid #E5E7EB",
  marginTop: 2,
};
const progBar = {
  position: "absolute",
  inset: 0,
  height: "100%",
  background: "linear-gradient(90deg,#34d399,#4ade80)",
  borderRadius: 999,
};
const progCaption = {
  marginTop: 4,
  fontSize: 11,
  color: "#6b7280",
  fontWeight: 700,
};
const addRow = {
  display: "flex",
  gap: 6,
  marginTop: 8,
  marginBottom: 6,
};
const addInput = {
  flex: 1,
  border: "1px solid #e5e7eb",
  borderRadius: 10,
  padding: "8px 10px",
  outline: "none",
  fontFamily: "inherit",
  boxSizing: "border-box",
  fontSize: 13,
};
const editInput = (done) => ({
  border: 0,
  outline: "none",
  background: "transparent",
  fontWeight: 600,
  textDecoration: done ? "line-through" : "none",
  color: done ? "#6b7280" : "#111827",
  width: "100%",
  fontSize: 13,
});

const checkRow = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "6px 0",
  borderBottom: "1px dashed #eef0f5",
};
const checkLabel = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  fontWeight: 600,
};

const miniGhost = {
  background: "#fff",
  color: "#4f46e5",
  border: "1px solid #dbe2ff",
  padding: "5px 9px",
  borderRadius: 999,
  fontWeight: 700,
  cursor: "pointer",
  fontSize: 12,
};
const miniDanger = {
  background: "#fff1f2",
  color: "#be123c",
  border: "1px solid #fecdd3",
  padding: "5px 9px",
  borderRadius: 999,
  fontWeight: 700,
  cursor: "pointer",
  fontSize: 12,
};
const miniIcon = { ...miniGhost, padding: "3px 7px" };

/* notes styles */
const chipSmall = {
  background: "#F4F6FF",
  color: "#4f46e5",
  border: "1px solid #E3E8FF",
  padding: "3px 7px",
  borderRadius: 999,
  fontWeight: 700,
  fontSize: 12,
  cursor: "pointer",
};
const notesBox = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid #e5e7eb",
  borderRadius: 10,
  padding: 10,
  outline: "none",
  fontFamily: "inherit",
  lineHeight: 1.45,
  resize: "vertical",
  minHeight: 160,
  background: "#fff",
  fontSize: 13,
};

/* members modal styles & misc */
const backdrop = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 14,
  zIndex: 50,
};
const modal = {
  width: "min(900px, 96vw)",
  background: "#fff",
  borderRadius: 16,
  border: "1px solid #EDF0F5",
  boxShadow: "0 18px 60px rgba(0,0,0,0.20)",
  padding: 14,
};
const modalHead = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 10,
};
const modalX = {
  appearance: "none",
  border: 0,
  background: "#f3f4f6",
  color: "#111827",
  width: 32,
  height: 32,
  borderRadius: 8,
  cursor: "pointer",
};
const memberList = {
  listStyle: "none",
  padding: 0,
  margin: 0,
  display: "grid",
  gap: 8,
  maxHeight: "60vh",
  overflow: "auto",
};
const memberItem = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "10px 12px",
  border: "1px solid #eef0f5",
  borderRadius: 10,
  background: "#fff",
};
const avatar = {
  width: 30,
  height: 30,
  borderRadius: "50%",
  display: "grid",
  placeItems: "center",
  fontWeight: 800,
  color: "#111827",
  border: "1px solid #e5e7eb",
  fontSize: 11,
};
const btnReq = {
  background: "#EEF2FF",
  color: "#4f46e5",
  border: "1px solid #DBE2FF",
  padding: "6px 10px",
  borderRadius: 999,
  fontWeight: 800,
  cursor: "pointer",
  whiteSpace: "nowrap",
  fontSize: 12,
};

/* recent resources styles */
const resHeader = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 4,
};
const pillLink = {
  background: "#F4F6FF",
  color: "#4f46e5",
  border: "1px solid #E3E8FF",
  padding: "5px 9px",
  borderRadius: 999,
  fontWeight: 800,
  fontSize: 12,
  textDecoration: "none",
};
const resItem = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  padding: "8px 10px",
  border: "1px solid #EEF0F5",
  background: "#fff",
  borderRadius: 10,
};
const resLeft = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  minWidth: 0,
  flex: 1,
};
const resIcon = {
  width: 30,
  height: 30,
  display: "grid",
  placeItems: "center",
  borderRadius: 8,
  background: "#F3F4FF",
  color: "#4f46e5",
  border: "1px solid #E8EAFF",
  fontSize: 15,
};
const resTitle = {
  fontWeight: 800,
  color: "#111827",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  maxWidth: 520,
  fontSize: 13,
};
const resMeta = {
  color: "#6b7280",
  fontSize: 12,
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
};
const metaBit = { display: "inline-flex", alignItems: "center" };
const metaDot = { margin: "0 6px", color: "#CBD5E1" };
const resRight = { display: "flex", alignItems: "center" };

/* skeletons */
const skeletonHero = {
  height: 150,
  borderRadius: 14,
  border: "1px solid #EEF0F5",
  background:
    "linear-gradient(90deg,#f3f4f6 0%, #f9fafb 20%, #f3f4f6 40%)",
  backgroundSize: "200% 100%",
  animation: "s 1.2s linear infinite",
};
const skeletonSection = {
  height: 260,
  borderRadius: 12,
  border: "1px solid #EEF0F5",
  background:
    "linear-gradient(90deg,#f3f4f6 0%, #f9fafb 20%, #f3f4f6 40%)",
  backgroundSize: "200% 100%",
  animation: "s 1.2s linear infinite",
};

const btnPill = {
  background: "#EEF2FF",
  color: "#4f46e5",
  border: "1px solid #DBE2FF",
  padding: "6px 10px",
  borderRadius: 999,
  fontWeight: 800,
  cursor: "pointer",
  textDecoration: "none",
  fontSize: 12,
};

const discussionBadge = {
  position: "absolute",
  top: -6,
  right: -6,
  minWidth: 20,
  height: 20,
  borderRadius: 999,
  background: "#ef4444",
  color: "#fff",
  fontSize: 11,
  fontWeight: 800,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "0 6px",
  boxShadow: "0 0 0 2px #ffffff",
};

