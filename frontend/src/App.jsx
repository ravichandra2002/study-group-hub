
import { Routes, Route, useLocation, useNavigate, Link, Navigate } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";

import Login from "./pages/Login.jsx";
import Signup from "./pages/Signup.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import MyGroups from "./pages/MyGroups.jsx";
import GroupDetail from "./pages/GroupDetail.jsx";
import GroupPolls from "./pages/GroupPolls.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import BrowseOpenGroups from "./pages/BrowseOpenGroups.jsx";
import CreateGroup from "./pages/CreateGroup.jsx";
import Availability from "./pages/Availability.jsx";
import Meetings from "./pages/Meetings.jsx";
import GroupResources from "./pages/GroupResources.jsx";
import nav from "./components/Navbar.module.css";
import modal from "./components/Modal.module.css";
import GroupDiscussions from "./pages/GroupDiscussions.jsx";
import MyProfile from "./pages/MyProfile.jsx";


import api from "./lib/api";
import { notifySocket, joinUserRoom } from "./lib/socket";
import "./styles/fonts.css";

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();

  /* ---------------- auth ---------------- */
  const [isAuthed, setIsAuthed] = useState(!!localStorage.getItem("token"));
  useEffect(() => setIsAuthed(!!localStorage.getItem("token")), [location]);

  /* ---------------- user ---------------- */
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}");
    } catch {
      return {};
    }
  });
  useEffect(() => {
    try {
      setUser(JSON.parse(localStorage.getItem("user") || "{}") || {});
    } catch {
      setUser({});
    }
  }, [location, isAuthed]);

  const myId = useMemo(
    () => String(user?.id ?? user?._id ?? user?.uid ?? user?.userId ?? ""),
    [user]
  );

  /* ---------------- logout ---------------- */
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const handleLogout = () => {
    try {
      notifySocket.removeAllListeners();
      notifySocket.disconnect();
    } catch {}
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    toast.success("Logged out");
    setShowLogoutDialog(false);
    setTimeout(() => (window.location.href = "/login"), 300);
  };

  /* --------------- notifications --------------- */
const [notifs, setNotifs] = useState([]);
const [menuOpen, setMenuOpen] = useState(false);
const unreadCount = notifs.filter((n) => !n.read).length;

const bellBtnRef = useRef(null);
const dropdownRef = useRef(null);
const prevUserIdRef = useRef(null);

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5050";

const textFrom = (p) => {
  if (!p) return "";
  switch (p.type) {
    case "join_approved":
    case "join_approved_local":
      return `You were approved to join “${p.title || "a group"}”.`;
    case "join_rejected":
      return `Your request to join “${p.title || "a group"}” was rejected.`;
    case "join_request": {
      const who = p.requestor?.name || p.requestor?.email || "Someone";
      return `${who} requested to join “${p.title || "a group"}”.`;
    }
    case "meeting_request":
      return p.title || "New meeting request";
    case "meeting_accepted":
      return p.title || "Your meeting request was accepted";
    case "meeting_rejected":
      return p.title || "Your meeting request was rejected";
    case "debug":
      return p.text || "Debug message";
    case "meeting_reminder":
      return "Reminder: upcoming meeting";  
    default:
      return p.title || "Notification";
  }
};

// de-dupe by _id when possible; fall back to a type+timestamp key
const mergeNotifs = (existing = [], incoming = []) => {
  const seen = new Set();
  const merged = [...incoming, ...existing].reduce((acc, n) => {
    const key = n._id || n.id || `${n.type || "n"}-${n.at}`;
    if (seen.has(key)) return acc;
    seen.add(key);
    acc.push(n);
    return acc;
  }, []);
  merged.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  return merged.slice(0, 50);
};

// --- API helpers
const markRead = async (notifId) => {
  try {
    await fetch(`${API_BASE}/api/notifications/mark-read`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
      },
      body: JSON.stringify({ id: notifId }),
    });
  } catch (err) {
    console.error("[notifications] mark-read error:", err);
  }
};

// Load *my* unread notifications only (backend should already filter to unread)
const loadPersistedNotifs = async () => {
  try {
    const res = await api.get("/notifications/list");
    const arr = Array.isArray(res?.data ?? res) ? (res.data ?? res) : [];

    // guard: ignore self-sent meeting_request if one ever slips through
    const filtered = arr.filter(
      (n) => !(n.type === "meeting_request" && n?.requestor?._id === myId)
    );

    const mapped = filtered.map((n) => ({
      id: n._id || `${Date.now()}-${Math.random()}`,
      _id: n._id,
      text: textFrom(n),
      at: n.createdAt || new Date().toISOString(),
      read: !!n.read, // should be false for unread list
      type: n.type,
      slot: n.slot,
      groupId: n.groupId || n.group_id || n.gid,
    }));

    setNotifs((prev) => mergeNotifs(prev, mapped));
  } catch (err) {
    const server = err?.response?.data;
    console.error(
      "[notifications] fetch failed:",
      err?.message,
      server ? `\nserver says: ${JSON.stringify(server)}` : ""
    );
  }
};

useEffect(() => {
  window.debugFetchNotifications = loadPersistedNotifs;
}, []);

const attachSocketHandlers = () => {
  const onNotify = (payload) => {
    // Ignore my own "meeting_request" (sender shouldn't see it)
    if (payload?.type === "meeting_request" && payload?.requestor?._id === myId) {
      return;
    }
    setNotifs((prev) =>
      mergeNotifs(prev, [
        {
          id: `${Date.now()}-${Math.random()}`,
          _id: payload?._id, // if server includes it
          text: textFrom(payload),
          at: payload?.at || new Date().toISOString(),
          read: false,
          type: payload?.type,
          slot: payload?.slot,
          groupId: payload?.groupId || payload?.group_id || payload?.gid,
        },
      ])
    );
  };

  const onConnect = () => {
    if (myId) joinUserRoom(myId);
  };

  notifySocket.on("connect", onConnect);
  notifySocket.on("notify", onNotify);
  notifySocket.on("notify_user", onNotify);

  return () => {
    notifySocket.off("connect", onConnect);
    notifySocket.off("notify", onNotify);
    notifySocket.off("notify_user", onNotify);
  };
};

useEffect(() => {
  if (!isAuthed || !myId) {
    try {
      notifySocket.removeAllListeners();
      notifySocket.disconnect();
    } catch {}
    prevUserIdRef.current = null;
    return;
  }

  const prevId = prevUserIdRef.current;
  if (prevId && prevId !== myId) {
    try {
      notifySocket.removeAllListeners();
      notifySocket.disconnect();
    } catch {}
  }
  prevUserIdRef.current = myId;

  const detach = attachSocketHandlers();

  if (!notifySocket.connected) {
    notifySocket.connect();
  } else {
    joinUserRoom(myId);
  }

  const onLocalNotify = (ev) => {
    const payload = ev?.detail || {};
    if (payload?.type === "meeting_request" && payload?.requestor?._id === myId) {
      return;
    }
    setNotifs((prev) =>
      mergeNotifs(prev, [
        {
          id: `${Date.now()}-${Math.random()}`,
          _id: payload?._id,
          text: textFrom(payload),
          at: payload?.at || new Date().toISOString(),
          read: false,
          type: payload?.type,
          slot: payload?.slot,
          groupId: payload?.groupId || payload?.group_id || payload?.gid,
        },
      ])
    );
  };
  window.addEventListener("sgh:notify", onLocalNotify);

  return () => {
    detach();
    window.removeEventListener("sgh:notify", onLocalNotify);
  };
}, [isAuthed, myId]);

// load my notifications when authed / user id changes
useEffect(() => {
  if (isAuthed && myId) {
    loadPersistedNotifs();
  }
}, [isAuthed, myId]);

const toggleMenu = async () => {
  const next = !menuOpen;
  setMenuOpen(next);
  if (next && notifs.length === 0) {
    await loadPersistedNotifs();
  }
};

useEffect(() => {
  if (!menuOpen) return;

  const onPointerDown = (e) => {
    const btn = bellBtnRef.current;
    const dd = dropdownRef.current;
    const insideBtn = btn && btn.contains(e.target);
    const insideDd = dd && dd.contains(e.target);
    if (!insideBtn && !insideDd) setMenuOpen(false);
  };
  const onKeyDown = (e) => e.key === "Escape" && setMenuOpen(false);

  document.addEventListener("pointerdown", onPointerDown);
  document.addEventListener("keydown", onKeyDown);
  return () => {
    document.removeEventListener("pointerdown", onPointerDown);
    document.removeEventListener("keydown", onKeyDown);
  };
}, [menuOpen]);

useEffect(() => setMenuOpen(false), [location]);

const clearNotifs = async () => {
  try {
    await api.post("/notifications/clear");
  } catch (e) {
    console.warn("[notifications] clear failed:", e);
  } finally {
    setNotifs([]); // clear locally
  }
};

// route on click + mark read server-side and remove it locally
const handleNotifClick = async (n) => {
  // Optimistic: remove immediately
  setNotifs((prev) => prev.filter((x) => (n._id ? x._id !== n._id : x.id !== n.id)));

  // Tell backend it's read
  if (n._id) {
    await markRead(n._id);
  }

  // Navigate based on type
  if (n.type && n.type.startsWith("meeting_")) {
    navigate("/meetings");
    setMenuOpen(false);
    return;
  }
  if (n.type === "join_request" || n.type === "join_approved" || n.type === "join_rejected") {
    if (n.groupId) {
      navigate(`/group/${n.groupId}`);
    } else {
      navigate("/my-groups");
    }
    setMenuOpen(false);
    return;
  }

  console.log("Notification clicked:", n);
};

  /* ---------------- drawer ---------------- */
  const [drawerOpen, setDrawerOpen] = useState(false);
  const openDrawer = () => setDrawerOpen(true);
  const closeDrawer = () => setDrawerOpen(false);
  useEffect(() => closeDrawer(), [location]);
  useEffect(() => {
    const onEsc = (e) => e.key === "Escape" && setDrawerOpen(false);
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, []);

  return (
    <>
      {isAuthed && (
        <header className={nav.bar}>
          <div className={nav.inner}>
            {/* HAMBURGER */}
            <button className={nav.menuBtn} aria-label="Open menu" onClick={openDrawer}>
              <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>

            {/* BRAND */}
            <div className={nav.brand}>
              <span className={nav.badge} />
              Study Group Hub
            </div>

            {/* RIGHT ACTIONS */}
            <div className={nav.actions}>
              {/* Notifications */}
              <div className={nav.bellWrap}>
                <button
                  ref={bellBtnRef}
                  className={nav.bellBtn}
                  type="button"
                  onClick={toggleMenu}
                  aria-label="Notifications"
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                >
                  <span aria-hidden>🔔</span>
                  {unreadCount > 0 && <span className={nav.badgeCount}>{unreadCount}</span>}
                </button>
                {menuOpen && (
                  <div
                    ref={dropdownRef}
                    className={nav.dropdown}
                    role="menu"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className={nav.ddHeader}>
                      <span>Notifications</span>
                      {notifs.length > 0 && (
                        <button className={nav.clearBtn} onClick={clearNotifs}>
                          Clear
                        </button>
                      )}
                    </div>
                    {notifs.length === 0 ? (
                      <div className={nav.empty}>No notifications</div>
                    ) : (
                      <ul className={nav.list}>
                        {[...notifs]
                          .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
                          .slice(0, 30)
                          .map((n) => (
                            <li
                              key={n.id}
                              className={`${nav.item} ${n.read ? "" : nav.unread}`}
                              onClick={() => handleNotifClick(n)}
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => (e.key === "Enter" ? handleNotifClick(n) : null)}
                              style={{ cursor: "pointer" }}
                              title="Open notification"
                            >
                              <div>{n.text}</div>
                              <div className={nav.time}>{new Date(n.at).toLocaleString()}</div>
                              {n.type?.startsWith("meeting_") && n.slot && (
                                <div className={nav.time}>
                                  {n.slot?.day} {n.slot?.from}–{n.slot?.to}
                                </div>
                              )}
                            </li>
                          ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>

              <button onClick={() => setShowLogoutDialog(true)} className={nav.btnPrimary}>
                Logout
              </button>
            </div>
          </div>
        </header>
      )}
{/* LEFT DRAWER + OVERLAY */}
{isAuthed && (
  <>
    <div
      className={`${nav.drawer} ${drawerOpen ? nav.drawerOpen : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label="Main menu"
    >
      <div className={nav.drawerHeader}>
        <div className={nav.brandMini}>
          <span className={nav.badge} />
          <span>Study Group Hub</span>
        </div>
        <button
          className={nav.drawerClose}
          onClick={closeDrawer}
          aria-label="Close menu"
        >
          ✕
        </button>
      </div>

      <nav className={nav.drawerLinks}>
        <Link
          className={nav.drawerLink}
          to="/browse"
          onClick={closeDrawer}
        >
          Browse groups
        </Link>
        <Link
          className={nav.drawerLink}
          to="/dashboard"
          onClick={closeDrawer}
        >
          My groups
        </Link>
        <Link
          className={nav.drawerLink}
          to="/availability"
          onClick={closeDrawer}
        >
          Availability
        </Link>
        <Link
          className={nav.drawerLink}
          to="/meetings"
          onClick={closeDrawer}
        >
          Meetings
        </Link>
        {/* NEW: My profile */}
        <Link
          className={nav.drawerLink}
          to="/profile"
          onClick={closeDrawer}
        >
          My profile
        </Link>
      </nav>

      <div className={nav.drawerFooter}>
        <button
          className={nav.drawerLogout}
          onClick={() => {
            closeDrawer();
            setShowLogoutDialog(true);
          }}
        >
          Logout
        </button>
      </div>
    </div>

    {drawerOpen && <div className={nav.overlay} onClick={closeDrawer} />}
  </>
)}


      {/* Logout modal */}
      {showLogoutDialog && (
        <div className={modal.backdrop}>
          <div className={modal.dialog}>
            <h3>Confirm Logout</h3>
            <p>Are you sure you want to log out?</p>
            <div className={modal.actions}>
              <button className={modal.cancelBtn} onClick={() => setShowLogoutDialog(false)}>
                Cancel
              </button>
              <button className={modal.logoutBtn} onClick={handleLogout}>
                Logout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Routes */}
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/my-groups" element={<ProtectedRoute><MyGroups /></ProtectedRoute>} />
        <Route path="/create" element={<ProtectedRoute><CreateGroup /></ProtectedRoute>} />
        <Route path="/group/:gid" element={<ProtectedRoute><GroupDetail /></ProtectedRoute>} />
        <Route path="/group/:gid/polls" element={<ProtectedRoute><GroupPolls /></ProtectedRoute>} />
        <Route path="/browse" element={<ProtectedRoute><BrowseOpenGroups /></ProtectedRoute>} />

        <Route path="/availability" element={<ProtectedRoute><Availability /></ProtectedRoute>} />
        <Route path="/meetings" element={<ProtectedRoute><Meetings /></ProtectedRoute>} />
         <Route path="/group/:gid/resources" element={<ProtectedRoute><GroupResources /></ProtectedRoute>} />
        <Route
  path="/group/:gid/discussions"
  element={
    <ProtectedRoute>
      <GroupDiscussions />
    </ProtectedRoute>
  }
/>
<Route
  path="/profile"
  element={
    <ProtectedRoute>
      <MyProfile />
    </ProtectedRoute>
  }
/>

        <Route path="/" element={<Navigate to={isAuthed ? "/dashboard" : "/login"} replace />} />
        <Route path="*" element={<Navigate to={isAuthed ? "/dashboard" : "/login"} replace />} />
      </Routes>
    </>
  );
}
