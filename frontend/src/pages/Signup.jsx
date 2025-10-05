// frontend/src/pages/Signup.jsx
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../lib/api";
import { toast } from "react-toastify";
import styles from "./Signup.module.css";
import { FaEye, FaEyeSlash } from "react-icons/fa";

import departments from "../data/departments.json";

// --- Email + password validators -------------------------------------------
const FREE_MAIL = new Set([
  "gmail.com", "googlemail.com",
  "yahoo.com", "ymail.com",
  "outlook.com", "hotmail.com", "live.com", "msn.com",
  "icloud.com", "me.com", "mac.com",
  "proton.me", "protonmail.com",
  "aol.com", "gmx.com", "yandex.com",
  "zoho.com", "mail.com",
]);

function extractDomain(email = "") {
  const idx = email.indexOf("@");
  if (idx === -1) return "";
  return email.slice(idx + 1).trim().toLowerCase();
}

function isAcademicDomain(domain = "") {
  if (!domain) return false;
  if (FREE_MAIL.has(domain)) return false;
  // allow *.edu or *.edu.* or *.ac.*
  if (domain.endsWith(".edu") || domain.includes(".edu.")) return true;
  if (domain.includes(".ac.")) return true;
  return false;
}

function isAcademicEmail(email = "") {
  const domain = extractDomain(email);
  return isAcademicDomain(domain);
}

// Strong password: 8+ chars, 1 upper, 1 lower, 1 number, 1 special
const STRONG_PASS_RE =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

export default function Signup() {
  const nav = useNavigate();

  const buildYears = (startOffset = -1, ahead = 6) => {
    const thisYear = new Date().getFullYear();
    return Array.from(
      { length: ahead - startOffset + 1 },
      (_, i) => thisYear + startOffset + i
    );
  };

  const defaultTerm = (() => {
    const m = new Date().getMonth();
    if (m >= 0 && m <= 4) return "Spring";
    if (m >= 5 && m <= 7) return "Summer";
    return "Fall";
  })();

  const years = buildYears(-1, 6);

  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    timezone:
      Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York",
    department: "",
    program: "Masters",
    yearOfStudy: 1,
    semesterTerm: defaultTerm,
    semesterYear: new Date().getFullYear(),
    studyMode: "Problem-Solving",
    meetingMode: "Either",
  });

  const [showPass, setShowPass] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (localStorage.getItem("token")) nav("/dashboard");
  }, [nav]);

  const setField = (key, val) => setForm((p) => ({ ...p, [key]: val }));

  const validate = () => {
    if (!form.fullName.trim()) return "Full name is required.";

    if (!isAcademicEmail(form.email)) {
      return "Please use your university email (e.g., *.edu or *.ac.*). Personal emails like Gmail/Outlook/Yahoo are not allowed.";
    }

    if (!STRONG_PASS_RE.test(form.password)) {
      return "Password must be at least 8 characters and include uppercase, lowercase, number, and special character.";
    }

    if (!form.timezone) return "Timezone is required.";
    if (!form.department.trim()) return "Department is required.";
    if (!form.semesterTerm || !form.semesterYear)
      return "Select your current semester and year.";
    return null;
  };

  const submit = async (e) => {
    e.preventDefault();
    const err = validate();
    if (err) return toast.error(err);

    try {
      setSubmitting(true);
      const payload = {
        ...form,
        currentSemester: `${form.semesterTerm} ${form.semesterYear}`,
      };
      delete payload.semesterTerm;
      delete payload.semesterYear;

      await api.post("/auth/signup", payload);
      toast.success("Signup successful! Please login");
      nav("/login");
    } catch (e) {
      toast.error(e?.response?.data?.error || "Signup failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.wrap}>
        {/* Left hero */}
        <section className={styles.hero} aria-label="About Study Group Hub">
          <div className={styles.brand}>
            <span className={styles.badge} />
            Study Group Hub
          </div>
          <h1>Find your study crew.</h1>
          <p>
            Smart matching by course, availability, and study style. Organize
            online sessions with auto-generated meeting links.
          </p>
        </section>

        {/* Form card */}
        <section className={styles.card} aria-labelledby="signup-title">
          <span id="signup-title" className={styles.title}>
            Create account
          </span>

          <form className={styles.formTwoCol} onSubmit={submit} noValidate>
            {/* LEFT COLUMN */}
            <div className={styles.col}>
              <input
                className={styles.input}
                placeholder="Full name"
                value={form.fullName}
                onChange={(e) => setField("fullName", e.target.value)}
                required
                autoComplete="name"
              />

              <div className={styles.inputWrap}>
                <input
                  className={styles.input}
                  placeholder="University email (e.g., yourname@kent.edu or ab123@cam.ac.uk)"
                  type="email"
                  value={form.email}
                  onChange={(e) => setField("email", e.target.value)}
                  required
                  autoComplete="email"
                  title="Use your university email (*.edu or *.ac.*). No Gmail/Outlook/Yahoo."
                />
              </div>
              <small className={styles.hint}>
                Use your university email (e.g., <code>*.edu</code> or{" "}
                <code>*.ac.*</code>). Personal providers like Gmail, Outlook,
                Yahoo are not accepted.
              </small>

              {/* Password with eye toggle */}
              <div className={styles.inputWrap}>
                <input
                  className={styles.input}
                  placeholder="Password"
                  type={showPass ? "text" : "password"}
                  value={form.password}
                  onChange={(e) => setField("password", e.target.value)}
                  required
                  autoComplete="new-password"
                  pattern="^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,}$"
                  title="Minimum 8 chars with uppercase, lowercase, number, and special character"
                />
                <button
                  type="button"
                  className={styles.eyeBtn}
                  aria-label={showPass ? "Hide password" : "Show password"}
                  onClick={() => setShowPass((s) => !s)}
                >
                  {showPass ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>

              <small className={styles.hint}>
                Minimum 8 characters with uppercase, lowercase, number, and
                special character.
              </small>

              <div>
                <label className={styles.label} htmlFor="tz">
                  Timezone
                </label>
                <select
                  id="tz"
                  className={styles.input}
                  value={form.timezone}
                  onChange={(e) => setField("timezone", e.target.value)}
                  required
                >
                  <option value="">Select your timezone</option>
                  <option value="America/New_York">Eastern Time (ET)</option>
                  <option value="America/Chicago">Central Time (CT)</option>
                  <option value="America/Denver">Mountain Time (MT)</option>
                  <option value="America/Phoenix">
                    Mountain Time - Arizona (no DST)
                  </option>
                  <option value="America/Los_Angeles">Pacific Time (PT)</option>
                  <option value="America/Anchorage">Alaska Time (AKT)</option>
                  <option value="Pacific/Honolulu">Hawaii Time (HST)</option>
                </select>
              </div>

              {/* Department */}
              <div>
                <label className={styles.label} htmlFor="dept">
                  Department
                </label>
                <select
                  id="dept"
                  className={styles.input}
                  value={form.department}
                  onChange={(e) => setField("department", e.target.value)}
                  required
                >
                  <option value="">Select your department</option>
                  {departments.map((dept, i) => (
                    <option key={i} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* RIGHT COLUMN */}
            <div className={styles.col}>
              <div>
                <label className={styles.label} htmlFor="program">
                  Program
                </label>
                <select
                  id="program"
                  className={styles.input}
                  value={form.program}
                  onChange={(e) => setField("program", e.target.value)}
                >
                  <option>Bachelors</option>
                  <option>Masters</option>
                  <option>PhD</option>
                  <option>Diploma</option>
                  <option>Other</option>
                </select>
              </div>

              <div>
                <label className={styles.label} htmlFor="yos">
                  Year of Study
                </label>
                <input
                  id="yos"
                  className={styles.input}
                  type="number"
                  min={1}
                  max={6}
                  value={form.yearOfStudy}
                  onChange={(e) =>
                    setField("yearOfStudy", Number(e.target.value))
                  }
                />
              </div>

              {/* Semester */}
              <div className={styles.twoUp}>
                <div>
                  <label className={styles.label} htmlFor="semesterTerm">
                    Semester
                  </label>
                  <select
                    id="semesterTerm"
                    className={styles.input}
                    value={form.semesterTerm}
                    onChange={(e) => setField("semesterTerm", e.target.value)}
                  >
                    <option>Fall</option>
                    <option>Spring</option>
                    <option>Summer</option>
                  </select>
                </div>
                <div>
                  <label className={styles.label} htmlFor="semesterYear">
                    Year
                  </label>
                  <select
                    id="semesterYear"
                    className={styles.input}
                    value={form.semesterYear}
                    onChange={(e) =>
                      setField("semesterYear", Number(e.target.value))
                    }
                  >
                    {years.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Preferences */}
              <div className={styles.twoUp}>
                <div>
                  <label className={styles.label} htmlFor="studyMode">
                    Study mode
                  </label>
                  <select
                    id="studyMode"
                    className={styles.input}
                    value={form.studyMode}
                    onChange={(e) => setField("studyMode", e.target.value)}
                  >
                    <option>Problem-Solving</option>
                    <option>Discussion</option>
                    <option>Quiet-Individual</option>
                    <option>Mixed</option>
                  </select>
                </div>
                <div>
                  <label className={styles.label} htmlFor="meetingMode">
                    Meeting mode
                  </label>
                  <select
                    id="meetingMode"
                    className={styles.input}
                    value={form.meetingMode}
                    onChange={(e) => setField("meetingMode", e.target.value)}
                  >
                    <option>Either</option>
                    <option>Online</option>
                    <option>On-Campus</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Bottom row */}
            <div className={styles.actions}>
              <button
                className={styles.btnPrimary}
                type="submit"
                disabled={submitting}
              >
                {submitting ? "Creating..." : "Sign up"}
              </button>
              <span className={styles.helper}>
                Already have an account? <Link to="/login">Back to login</Link>
              </span>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
