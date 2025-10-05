import { Routes, Route, useLocation, useNavigate, Link, Navigate } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";

import Login from "./pages/Login.jsx";
import Signup from "./pages/Signup.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import MyGroups from "./pages/MyGroups.jsx";
import GroupDetail from "./pages/GroupDetail.jsx";
import GroupPolls from "./pages/GroupPolls.jsx"; // ensure extension matches your file
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import BrowseOpenGroups from "./pages/BrowseOpenGroups.jsx";
import CreateGroup from "./pages/CreateGroup.jsx";

import nav from "./components/Navbar.module.css";
import modal from "./components/Modal.module.css";

import api from "./lib/api";
import { notifySocket, joinUserRoom } from "./lib/socket";
import "./styles/fonts.css";

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();

  const [isAuthed, setIsAuthed] = useState(!!localStorage.getItem("token"));
  useEffect(() => setIsAuthed(!!localStorage.getItem("token")), [location]);

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
    () => user?.id || user?._id || user?.uid || user?.userId || null,
    [user]
  );

  const prevUserIdRef = useRef(null);

  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const handleLogout = () => {
    try {
      notifySocket.removeAllListeners();
      notifySocket.disconnect();
    } catch {
      /* noop */
    }
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    toast.success("Logged out");
    setShowLogoutDialog(false);
    setTimeout(() => (window.location.href = "/login"), 300);
  };

  // --- notifications UI state
  const [notifs, setNotifs] = useState([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const unreadCount = notifs.filter((n) => !n.read).length;

  // refs for click-outside
  const bellBtnRef = useRef(null);
  const dropdownRef = useRef(null);

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
      case "debug":
        return p.text || "Debug message";
      default:
        return p.title || "Notification";
    }
  };

  const mergeNotifs = (existing = [], incoming = []) => {
    const seen = new Set(existing.map((n) => n._id || n.id));
    const out = [...existing];
    for (const n of incoming) {
      const key = n._id || n.id;
      if (!seen.has(key)) out.unshift(n);
    }
    return out.slice(0, 50);
  };

  const loadPersistedNotifs = async () => {
    try {
      const res = await api.get("/groups/notifications"); // returns recent 50
      const arr = Array.isArray(res?.data ?? res) ? (res.data ?? res) : [];
      const mapped = arr
        .filter((n) => !n.read)
        .map((n) => ({
          id: n._id || `${Date.now()}-${Math.random()}`,
          _id: n._id,
          text: textFrom(n),
          at: n.createdAt || new Date().toISOString(),
          read: false,
        }));
      setNotifs((prev) => mergeNotifs(prev, mapped));
    } catch {
      // ignore; dropdown will just show “No notifications”.
    }
  };

  const attachSocketHandlers = () => {
    const onConnect = () => {
      if (myId) joinUserRoom(myId);
    };
    const onConnected = () => {
      if (myId) joinUserRoom(myId);
    };
    const onSystem = () => {};
    const onNotify = (payload) => {
      setNotifs((prev) =>
        mergeNotifs(prev, [
          {
            id: `${Date.now()}-${Math.random()}`,
            text: textFrom(payload),
            at: new Date().toISOString(),
            read: false,
          },
        ])
      );
    };
    const onError = () => {};
    const onDisconnect = () => {};

    notifySocket.on("connect", onConnect);
    notifySocket.on("connected", onConnected);
    notifySocket.on("system", onSystem);
    notifySocket.on("notify", onNotify);
    notifySocket.on("connect_error", onError);
    notifySocket.on("disconnect", onDisconnect);

    return () => {
      notifySocket.off("connect", onConnect);
      notifySocket.off("connected", onConnected);
      notifySocket.off("system", onSystem);
      notifySocket.off("notify", onNotify);
      notifySocket.off("connect_error", onError);
      notifySocket.off("disconnect", onDisconnect);
    };
  };

  useEffect(() => {
    if (!isAuthed || !myId) {
      notifySocket.removeAllListeners();
      notifySocket.disconnect();
      prevUserIdRef.current = null;
      return;
    }

    const prevId = prevUserIdRef.current;
    if (prevId && prevId !== myId) {
      try {
        notifySocket.removeAllListeners();
        notifySocket.disconnect();
      } catch {
        /* noop */
      }
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
      setNotifs((prev) =>
        mergeNotifs(prev, [
          {
            id: `${Date.now()}-${Math.random()}`,
            text: textFrom(payload),
            at: new Date().toISOString(),
            read: false,
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

  // Load unread persisted notifications after login
  useEffect(() => {
    if (isAuthed && myId) loadPersistedNotifs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      const ids = notifs.filter((n) => !n.read && n._id).map((n) => n._id);
      if (ids.length) {
        await api.post("/groups/notifications/read", { ids });
      }
    } catch {
      // ignore backend errors; still clear locally to respect user's action
    } finally {
      setNotifs([]);
    }
  };

  // ---- Side drawer (hamburger) state
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
                        {notifs.slice(0, 30).map((n) => (
                          <li key={n.id} className={`${nav.item} ${n.read ? "" : nav.unread}`}>
                            <div>{n.text}</div>
                            <div className={nav.time}>{new Date(n.at).toLocaleString()}</div>
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
              <button className={nav.drawerClose} onClick={closeDrawer} aria-label="Close menu">
                ✕
              </button>
            </div>

            <nav className={nav.drawerLinks}>
              <Link className={nav.drawerLink} to="/browse" onClick={closeDrawer}>
                Browse groups
              </Link>
              <Link className={nav.drawerLink} to="/dashboard" onClick={closeDrawer}>
                My groups
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

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/my-groups"
          element={
            <ProtectedRoute>
              <MyGroups />
            </ProtectedRoute>
          }
        />

        <Route
          path="/create"
          element={
            <ProtectedRoute>
              <CreateGroup />
            </ProtectedRoute>
          }
        />

        <Route
          path="/group/:gid"
          element={
            <ProtectedRoute>
              <GroupDetail />
            </ProtectedRoute>
          }
        />

        {/* Dedicated polls page */}
        <Route
          path="/group/:gid/polls"
          element={
            <ProtectedRoute>
              <GroupPolls />
            </ProtectedRoute>
          }
        />

        <Route
          path="/browse"
          element={
            <ProtectedRoute>
              <BrowseOpenGroups />
            </ProtectedRoute>
          }
        />

        {/* Root redirect */}
        <Route path="/" element={<Navigate to={isAuthed ? "/dashboard" : "/login"} replace />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to={isAuthed ? "/dashboard" : "/login"} replace />} />
      </Routes>
    </>
  );
}
 