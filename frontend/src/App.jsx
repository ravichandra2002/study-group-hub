
import { Routes, Route, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import Login from "./pages/Login.jsx";
import Signup from "./pages/Signup.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import nav from "./components/Navbar.module.css";
import modal from "./components/Modal.module.css"; // new css file

export default function App() {
  const location = useLocation();
  const [isAuthed, setIsAuthed] = useState(!!localStorage.getItem("token"));
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);

  useEffect(() => {
    setIsAuthed(!!localStorage.getItem("token"));
  }, [location]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    toast.success("Logged out");
    setShowLogoutDialog(false);

    setTimeout(() => {
      window.location.href = "/login";
    }, 600);
  };

  return (
    <>
      {isAuthed && (
        <header className={nav.bar}>
          <div className={nav.inner}>
            <div className={nav.brand}>
              <span className={nav.badge} />
              Study Group Hub
            </div>
            <div className={nav.actions}>
              <button onClick={() => setShowLogoutDialog(true)} className={nav.btnPrimary}>
                Logout
              </button>
            </div>
          </div>
        </header>
      )}

      {/* Logout confirmation modal */}
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

      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="*" element={isAuthed ? <Dashboard /> : <Login />} />
      </Routes>
    </>
  );
}
