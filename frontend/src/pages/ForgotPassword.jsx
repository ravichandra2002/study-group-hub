
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../lib/api";
import { toast } from "react-toastify";
import styles from "./ForgotPassword.module.css";

export default function ForgotPassword() {
  const nav = useNavigate();

  const [step, setStep] = useState(1); // 1 = request code, 2 = reset password
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Clear sensitive fields when moving to step 2
  useEffect(() => {
    if (step === 2) {
      setCode("");
      setNewPassword("");
      setConfirmPassword("");
    }
  }, [step]);

  const requestCode = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("Please enter your university email");
      return;
    }

    try {
      setLoading(true);
      await api.post("/auth/forgot-password", { email });
      toast.success("If this email exists, a reset code has been sent.");
      setStep(2);
    } catch (err) {
      toast.error(err?.response?.data?.error || "Could not send reset code");
    } finally {
      setLoading(false);
    }
  };

  const submitNewPassword = async (e) => {
    e.preventDefault();

    if (!code.trim()) {
      toast.error("Enter the 6-digit code from your email");
      return;
    }
    if (!newPassword || !confirmPassword) {
      toast.error("Enter and confirm your new password");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    try {
      setLoading(true);
      const { data } = await api.post("/auth/reset-password", {
        email,
        code,
        newPassword,
      });

      toast.success(data?.message || "Password updated. Please log in.");
      nav("/login", { replace: true });
    } catch (err) {
      toast.error(err?.response?.data?.error || "Could not reset password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.wrap}>
        {/* LEFT HERO – keep the SAME look as your old one */}
        <section className={styles.hero}>
          <div className={styles.brand}>
            <span className={styles.badge} />
            Study Group Hub
          </div>
          <h1>Forgot your password?</h1>
          <p>
            Enter your university email, get a one-time code, and choose a new
            password securely.
          </p>
        </section>

        {/* RIGHT CARD – smaller, tighter, no big empty gap */}
        <section className={styles.card}>
          <h2 className={styles.title}>
            {step === 1 ? "Reset password" : "Set a new password"}
          </h2>

          <form
            className={styles.form}
            onSubmit={step === 1 ? requestCode : submitNewPassword}
          >
            <input
              className={styles.input}
              placeholder="University email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              // once we are in step 2, keep the email visible but locked
              readOnly={step === 2}
            />

            {step === 2 && (
              <>
                <input
                  className={styles.input}
                  placeholder="One-time code (6 digits)"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  maxLength={6}
                  required
                />

                <input
                  className={styles.input}
                  placeholder="New password"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />

                <input
                  className={styles.input}
                  placeholder="Confirm new password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />

                <p className={styles.tip}>
                  Tip: your new password must be at least 8 characters and
                  include uppercase, lowercase, a number, and a special
                  character.
                </p>
              </>
            )}

            <button
              className={styles.btnPrimary}
              type="submit"
              disabled={loading}
            >
              {loading
                ? "Please wait…"
                : step === 1
                ? "Send code"
                : "Update password"}
            </button>

            <div className={styles.linkBack}>
              Remembered it? <Link to="/login">Back to login</Link>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
