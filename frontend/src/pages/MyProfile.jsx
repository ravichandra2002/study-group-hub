// // frontend/src/pages/MyProfile.jsx
// import { useEffect, useState } from "react";
// import { useNavigate } from "react-router-dom";
// import { toast } from "react-toastify";
// import api from "../lib/api";

// export default function MyProfile() {
//   const navigate = useNavigate();

//   const [loading, setLoading] = useState(true);
//   const [saving, setSaving] = useState(false);
//   const [pwdSaving, setPwdSaving] = useState(false);

//   const [profile, setProfile] = useState({
//     fullName: "",
//     email: "",
//     timezone: "",
//     department: "",
//     program: "",
//     yearOfStudy: 1,
//     currentSemester: "",
//     studyMode: "",
//     meetingMode: "",
//     notifyEmail: true,
//     notifyRemindersHours: 1,
//     allowDMs: true,
//     visibility: "SameCourseOnly",
//     createdAt: "",
//     lastLoginAt: "",
//   });

//   const [pwdForm, setPwdForm] = useState({
//     currentPassword: "",
//     newPassword: "",
//     confirmNewPassword: "",
//   });

//   // Load profile on mount
//   useEffect(() => {
//     let cancelled = false;

//     async function load() {
//       try {
//         setLoading(true);
//         const { data } = await api.get("/me/profile");
//         if (!data?.ok) throw new Error(data?.error || "Failed to load profile");
//         if (cancelled) return;

//         setProfile((prev) => ({
//           ...prev,
//           ...(data.profile || {}),
//         }));
//       } catch (err) {
//         console.error(err);
//         toast.error(
//           err.response?.data?.error ||
//             err.message ||
//             "Could not load profile"
//         );
//         if (err.response?.status === 401) {
//           // token invalid, send to login
//           localStorage.removeItem("token");
//           localStorage.removeItem("user");
//           navigate("/login");
//         }
//       } finally {
//         if (!cancelled) setLoading(false);
//       }
//     }

//     load();
//     return () => {
//       cancelled = true;
//     };
//   }, [navigate]);

//   const onChange = (field, value) => {
//     setProfile((p) => ({ ...p, [field]: value }));
//   };

//   const onToggle = (field) => {
//     setProfile((p) => ({ ...p, [field]: !p[field] }));
//   };

//   const saveProfile = async (e) => {
//     e.preventDefault();
//     try {
//       setSaving(true);
//       const payload = {
//         fullName: profile.fullName,
//         timezone: profile.timezone,
//         department: profile.department,
//         program: profile.program,
//         yearOfStudy: profile.yearOfStudy,
//         currentSemester: profile.currentSemester,
//         studyMode: profile.studyMode,
//         meetingMode: profile.meetingMode,
//         notifyEmail: profile.notifyEmail,
//         notifyRemindersHours: profile.notifyRemindersHours,
//         allowDMs: profile.allowDMs,
//         visibility: profile.visibility,
//       };

//       const { data } = await api.patch("/me/profile", payload);
//       if (!data?.ok) throw new Error(data?.error || "Failed to save profile");

//       // also refresh cached user name in localStorage, so header shows updated name
//       const stored = localStorage.getItem("user");
//       if (stored) {
//         try {
//           const u = JSON.parse(stored);
//           u.name = profile.fullName;
//           localStorage.setItem("user", JSON.stringify(u));
//         } catch {
//           /* ignore */
//         }
//       }

//       toast.success("Profile updated");
//     } catch (err) {
//       console.error(err);
//       toast.error(
//         err.response?.data?.error ||
//           err.message ||
//           "Could not update profile"
//       );
//     } finally {
//       setSaving(false);
//     }
//   };

//   const changePassword = async (e) => {
//     e.preventDefault();
//     if (!pwdForm.currentPassword || !pwdForm.newPassword) {
//       toast.error("Please fill all password fields");
//       return;
//     }
//     if (pwdForm.newPassword !== pwdForm.confirmNewPassword) {
//       toast.error("New password and confirm password do not match");
//       return;
//     }

//     try {
//       setPwdSaving(true);
//       const { data } = await api.post("/me/change-password", {
//         currentPassword: pwdForm.currentPassword,
//         newPassword: pwdForm.newPassword,
//       });

//       if (!data?.ok) throw new Error(data?.error || "Failed to change password");

//       toast.success("Password updated successfully");
//       setPwdForm({
//         currentPassword: "",
//         newPassword: "",
//         confirmNewPassword: "",
//       });
//     } catch (err) {
//       console.error(err);
//       toast.error(
//         err.response?.data?.error ||
//           err.message ||
//           "Could not change password"
//       );
//     } finally {
//       setPwdSaving(false);
//     }
//   };

//   if (loading) {
//     return (
//       <div style={pageWrap}>
//         <div style={container}>
//           <h1 style={h1}>My profile</h1>
//           <div style={skeletonCard} />
//         </div>
//       </div>
//     );
//   }

//   return (
//     <div style={pageWrap}>
//       <div style={container}>
//         <h1 style={h1}>My profile</h1>
//         <p style={subtitle}>
//           Update your personal details and manage your password. This
//           information is visible to other students based on your visibility
//           settings.
//         </p>

//         <div style={grid}>
//           {/* PROFILE CARD */}
//           <section style={card}>
//             <h2 style={cardTitle}>Account details</h2>

//             <form onSubmit={saveProfile}>
//               <div style={formGrid}>
//                 <Field
//                   label="Full name"
//                   value={profile.fullName}
//                   onChange={(v) => onChange("fullName", v)}
//                 />
//                 <Field
//                   label="Email"
//                   value={profile.email}
//                   disabled
//                   hint="University email cannot be changed here"
//                 />
//                 <Field
//                   label="Timezone"
//                   value={profile.timezone}
//                   onChange={(v) => onChange("timezone", v)}
//                 />
//                 <Field
//                   label="Department"
//                   value={profile.department}
//                   onChange={(v) => onChange("department", v)}
//                 />
//                 <Field
//                   label="Program"
//                   value={profile.program}
//                   onChange={(v) => onChange("program", v)}
//                 />
//                 <Field
//                   label="Year of study"
//                   type="number"
//                   value={profile.yearOfStudy}
//                   onChange={(v) =>
//                     onChange("yearOfStudy", Number(v) || 1)
//                   }
//                 />
//                 <Field
//                   label="Current semester"
//                   value={profile.currentSemester}
//                   onChange={(v) => onChange("currentSemester", v)}
//                   placeholder="e.g., Fall 2025"
//                 />
//                 <Field
//                   label="Study mode"
//                   value={profile.studyMode}
//                   onChange={(v) => onChange("studyMode", v)}
//                   placeholder="e.g., Problem-Solving"
//                 />
//                 <Field
//                   label="Preferred meeting mode"
//                   value={profile.meetingMode}
//                   onChange={(v) => onChange("meetingMode", v)}
//                   placeholder="Either, Online, On-campus"
//                 />
//                 <Field
//                   label="Reminder lead time (hours)"
//                   type="number"
//                   value={profile.notifyRemindersHours}
//                   onChange={(v) =>
//                     onChange(
//                       "notifyRemindersHours",
//                       Number(v) || 1
//                     )
//                   }
//                   hint="How many hours before a meeting to send a reminder"
//                 />
//                 <Field
//                   label="Visibility"
//                   value={profile.visibility}
//                   onChange={(v) => onChange("visibility", v)}
//                   placeholder="SameCourseOnly / SameUniversity / Private"
//                 />
//               </div>

//               <div style={toggleRow}>
//                 <label style={toggleLabel}>
//                   <input
//                     type="checkbox"
//                     checked={profile.notifyEmail}
//                     onChange={() => onToggle("notifyEmail")}
//                   />
//                   <span>Send me email notifications</span>
//                 </label>
//                 <label style={toggleLabel}>
//                   <input
//                     type="checkbox"
//                     checked={profile.allowDMs}
//                     onChange={() => onToggle("allowDMs")}
//                   />
//                   <span>Allow direct messages from classmates</span>
//                 </label>
//               </div>

//               <div style={metaRow}>
//                 {profile.createdAt && (
//                   <span>
//                     Joined:{" "}
//                     <strong>
//                       {new Date(profile.createdAt).toLocaleString()}
//                     </strong>
//                   </span>
//                 )}
//                 {profile.lastLoginAt && (
//                   <span>
//                     Last login:{" "}
//                     <strong>
//                       {new Date(profile.lastLoginAt).toLocaleString()}
//                     </strong>
//                   </span>
//                 )}
//               </div>

//               <button type="submit" style={primaryBtn} disabled={saving}>
//                 {saving ? "Saving..." : "Save changes"}
//               </button>
//             </form>
//           </section>

//           {/* PASSWORD CARD */}
//           <section style={card}>
//             <h2 style={cardTitle}>Change password</h2>
//             <p style={smallText}>
//               Password must be at least 8 characters and include uppercase,
//               lowercase, a number, and a special character.
//             </p>
//             <form onSubmit={changePassword}>
//               <Field
//                 label="Current password"
//                 type="password"
//                 value={pwdForm.currentPassword}
//                 onChange={(v) =>
//                   setPwdForm((f) => ({ ...f, currentPassword: v }))
//                 }
//               />
//               <Field
//                 label="New password"
//                 type="password"
//                 value={pwdForm.newPassword}
//                 onChange={(v) =>
//                   setPwdForm((f) => ({ ...f, newPassword: v }))
//                 }
//               />
//               <Field
//                 label="Confirm new password"
//                 type="password"
//                 value={pwdForm.confirmNewPassword}
//                 onChange={(v) =>
//                   setPwdForm((f) => ({
//                     ...f,
//                     confirmNewPassword: v,
//                   }))
//                 }
//               />

//               <button
//                 type="submit"
//                 style={dangerBtn}
//                 disabled={pwdSaving}
//               >
//                 {pwdSaving ? "Updating..." : "Update password"}
//               </button>
//             </form>
//           </section>
//         </div>
//       </div>
//     </div>
//   );
// }

// /* ---------- Small reusable field component ---------- */

// function Field({
//   label,
//   value,
//   onChange,
//   type = "text",
//   placeholder = "",
//   disabled = false,
//   hint,
// }) {
//   return (
//     <div style={fieldWrap}>
//       <label style={labelStyle}>{label}</label>
//       <input
//         style={inputStyle}
//         type={type}
//         value={value ?? ""}
//         onChange={(e) => onChange && onChange(e.target.value)}
//         placeholder={placeholder}
//         disabled={disabled}
//       />
//       {hint && <div style={hintStyle}>{hint}</div>}
//     </div>
//   );
// }

// /* ---------- styles (inline, similar to GroupDetail) ---------- */

// const pageWrap = {
//   padding: "28px 14px 60px",
//   minHeight: "calc(100vh - 80px)",
//   background: "linear-gradient(180deg,#f8f9ff 0%, #ffffff 100%)",
// };

// const container = {
//   width: "min(1100px, 96vw)",
//   margin: "0 auto",
// };

// const h1 = {
//   margin: 0,
//   fontSize: 24,
//   fontWeight: 900,
// };

// const subtitle = {
//   marginTop: 6,
//   marginBottom: 16,
//   fontSize: 13,
//   color: "#4b5563",
// };

// const grid = {
//   display: "grid",
//   gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1.2fr)",
//   gap: 14,
//   alignItems: "flex-start",
// };

// const card = {
//   borderRadius: 14,
//   border: "1px solid #EEF0F5",
//   background: "#fff",
//   boxShadow: "0 10px 40px rgba(15,23,42,0.06)",
//   padding: 14,
// };

// const cardTitle = {
//   margin: "0 0 10px",
//   fontSize: 18,
//   fontWeight: 800,
// };

// const formGrid = {
//   display: "grid",
//   gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
//   gap: 10,
// };

// const fieldWrap = {
//   display: "flex",
//   flexDirection: "column",
//   gap: 4,
// };

// const labelStyle = {
//   fontSize: 12,
//   fontWeight: 700,
//   color: "#4b5563",
// };

// const inputStyle = {
//   borderRadius: 10,
//   border: "1px solid #e5e7eb",
//   padding: "7px 9px",
//   fontSize: 13,
//   outline: "none",
//   boxSizing: "border-box",
// };

// const hintStyle = {
//   fontSize: 11,
//   color: "#9ca3af",
// };

// const toggleRow = {
//   display: "flex",
//   flexWrap: "wrap",
//   gap: 10,
//   marginTop: 12,
//   marginBottom: 8,
// };

// const toggleLabel = {
//   display: "flex",
//   alignItems: "center",
//   gap: 6,
//   fontSize: 12,
//   color: "#374151",
// };

// const metaRow = {
//   display: "flex",
//   flexWrap: "wrap",
//   gap: 12,
//   fontSize: 11,
//   color: "#6b7280",
//   marginBottom: 10,
// };

// const primaryBtn = {
//   background: "linear-gradient(180deg,#5b7cfa,#4f46e5)",
//   color: "#fff",
//   border: 0,
//   padding: "8px 14px",
//   borderRadius: 999,
//   fontWeight: 800,
//   cursor: "pointer",
//   fontSize: 13,
// };

// const dangerBtn = {
//   background: "#ef4444",
//   color: "#fff",
//   border: 0,
//   padding: "8px 14px",
//   borderRadius: 999,
//   fontWeight: 800,
//   cursor: "pointer",
//   fontSize: 13,
//   marginTop: 4,
// };

// const smallText = {
//   fontSize: 12,
//   color: "#6b7280",
//   marginBottom: 10,
// };

// const skeletonCard = {
//   marginTop: 12,
//   height: 260,
//   borderRadius: 14,
//   border: "1px solid #EEF0F5",
//   background:
//     "linear-gradient(90deg,#f3f4f6 0%, #f9fafb 20%, #f3f4f6 40%)",
//   backgroundSize: "200% 100%",
//   animation: "s 1.2s linear infinite",
// };


// frontend/src/pages/MyProfile.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import api from "../lib/api";

export default function MyProfile() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pwdSaving, setPwdSaving] = useState(false);

  const [profile, setProfile] = useState({
    fullName: "",
    email: "",
    timezone: "",
    department: "",
    program: "",
    yearOfStudy: 1,
    currentSemester: "",
    studyMode: "",
    meetingMode: "",
    notifyEmail: true,
    notifyRemindersHours: 1,
    allowDMs: true,
    visibility: "SameCourseOnly",
    createdAt: "",
    lastLoginAt: "",
  });

  const [pwdForm, setPwdForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmNewPassword: "",
  });

  // Load profile on mount
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        const { data } = await api.get("/me/profile");
        if (!data?.ok) throw new Error(data?.error || "Failed to load profile");
        if (cancelled) return;

        setProfile((prev) => ({
          ...prev,
          ...(data.profile || {}),
        }));
      } catch (err) {
        console.error(err);
        toast.error(
          err.response?.data?.error ||
            err.message ||
            "Could not load profile"
        );
        if (err.response?.status === 401) {
          // token invalid, send to login
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          navigate("/login");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const onChange = (field, value) => {
    setProfile((p) => ({ ...p, [field]: value }));
  };

  const onToggle = (field) => {
    setProfile((p) => ({ ...p, [field]: !p[field] }));
  };

  const saveProfile = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      const payload = {
        fullName: profile.fullName,
        timezone: profile.timezone,
        department: profile.department,
        program: profile.program,
        yearOfStudy: profile.yearOfStudy,
        currentSemester: profile.currentSemester,
        studyMode: profile.studyMode,
        meetingMode: profile.meetingMode,
        notifyEmail: profile.notifyEmail,
        // keep reminder value in backend, but we don't show it in UI
        notifyRemindersHours: profile.notifyRemindersHours,
        allowDMs: profile.allowDMs,
        visibility: profile.visibility,
      };

      const { data } = await api.patch("/me/profile", payload);
      if (!data?.ok) throw new Error(data?.error || "Failed to save profile");

      // refresh cached user name in localStorage, so header shows updated name
      const stored = localStorage.getItem("user");
      if (stored) {
        try {
          const u = JSON.parse(stored);
          u.name = profile.fullName;
          localStorage.setItem("user", JSON.stringify(u));
        } catch {
          /* ignore */
        }
      }

      toast.success("Profile updated");
    } catch (err) {
      console.error(err);
      toast.error(
        err.response?.data?.error ||
          err.message ||
          "Could not update profile"
      );
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    if (!pwdForm.currentPassword || !pwdForm.newPassword) {
      toast.error("Please fill all password fields");
      return;
    }
    if (pwdForm.newPassword !== pwdForm.confirmNewPassword) {
      toast.error("New password and confirm password do not match");
      return;
    }

    try {
      setPwdSaving(true);
      const { data } = await api.post("/me/change-password", {
        currentPassword: pwdForm.currentPassword,
        newPassword: pwdForm.newPassword,
      });

      if (!data?.ok) throw new Error(data?.error || "Failed to change password");

      toast.success("Password updated successfully");
      setPwdForm({
        currentPassword: "",
        newPassword: "",
        confirmNewPassword: "",
      });
    } catch (err) {
      console.error(err);
      toast.error(
        err.response?.data?.error ||
          err.message ||
          "Could not change password"
      );
    } finally {
      setPwdSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={pageWrap}>
        <div style={container}>
          <h1 style={h1}>My profile</h1>
          <div style={skeletonCard} />
        </div>
      </div>
    );
  }

  // helpers for splitting "Fall 2025"
  const [semTermRaw, semYearRaw] = String(profile.currentSemester || "").split(" ");
  const semesterTerm = semTermRaw || "Fall";
  const semesterYear = semYearRaw || "2025";

  return (
    <div style={pageWrap}>
      <div style={container}>
        <h1 style={h1}>My profile</h1>
        <p style={subtitle}>
          Update your personal details and manage your password. This
          information is visible to other students based on your visibility
          settings.
        </p>

        <div style={grid}>
          {/* PROFILE CARD */}
          <section style={card}>
            <h2 style={cardTitle}>Account details</h2>

            <form onSubmit={saveProfile}>
              <div style={formGrid}>
                <Field
                  label="Full name"
                  value={profile.fullName}
                  onChange={(v) => onChange("fullName", v)}
                />
                <Field
                  label="Email"
                  value={profile.email}
                  disabled
                  hint="University email cannot be changed here"
                />
                <Field
                  label="Timezone"
                  value={profile.timezone}
                  onChange={(v) => onChange("timezone", v)}
                />
                <Field
                  label="Department"
                  value={profile.department}
                  disabled
                  hint="Department cannot be changed"
                />

                <SelectField
                  label="Program"
                  value={profile.program || "Masters"}
                  onChange={(v) => onChange("program", v)}
                  options={["Bachelors", "Masters", "PhD", "Diploma", "Other"]}
                />

                <Field
                  label="Year of study"
                  type="number"
                  value={profile.yearOfStudy}
                  onChange={(v) =>
                    onChange("yearOfStudy", Number(v) || 1)
                  }
                />

                {/* Semester term + year dropdowns */}
                <SelectField
                  label="Semester term"
                  value={semesterTerm}
                  onChange={(term) =>
                    onChange("currentSemester", `${term} ${semesterYear}`)
                  }
                  options={["Fall", "Spring", "Summer"]}
                />
                <SelectField
                  label="Semester year"
                  value={semesterYear}
                  onChange={(year) =>
                    onChange("currentSemester", `${semesterTerm} ${year}`)
                  }
                  options={[
                    "2024",
                    "2025",
                    "2026",
                    "2027",
                    "2028",
                    "2029",
                    "2030",
                    "2031",
                  ]}
                />

                <SelectField
                  label="Study mode"
                  value={profile.studyMode || "Problem-Solving"}
                  onChange={(v) => onChange("studyMode", v)}
                  options={[
                    "Problem-Solving",
                    "Discussion",
                    "Quiet-Individual",
                    "Mixed",
                  ]}
                />

                <SelectField
                  label="Preferred meeting mode"
                  value={profile.meetingMode || "Either"}
                  onChange={(v) => onChange("meetingMode", v)}
                  options={["Either", "Online", "On-Campus"]}
                />

                <Field
                  label="Visibility"
                  value={profile.visibility}
                  onChange={(v) => onChange("visibility", v)}
                  placeholder="SameCourseOnly / SameUniversity / Private"
                />
              </div>

              <div style={toggleRow}>
                <label style={toggleLabel}>
                  <input
                    type="checkbox"
                    checked={profile.notifyEmail}
                    onChange={() => onToggle("notifyEmail")}
                  />
                  <span>Send me email notifications</span>
                </label>
                <label style={toggleLabel}>
                  <input
                    type="checkbox"
                    checked={profile.allowDMs}
                    onChange={() => onToggle("allowDMs")}
                  />
                  <span>Allow direct messages from classmates</span>
                </label>
              </div>

              <div style={metaRow}>
                {profile.createdAt && (
                  <span>
                    Joined:{" "}
                    <strong>
                      {new Date(profile.createdAt).toLocaleString()}
                    </strong>
                  </span>
                )}
                {profile.lastLoginAt && (
                  <span>
                    Last login:{" "}
                    <strong>
                      {new Date(profile.lastLoginAt).toLocaleString()}
                    </strong>
                  </span>
                )}
              </div>

              <button type="submit" style={primaryBtn} disabled={saving}>
                {saving ? "Saving..." : "Save changes"}
              </button>
            </form>
          </section>

          {/* PASSWORD CARD */}
          <section style={card}>
            <h2 style={cardTitle}>Change password</h2>
            <p style={smallText}>
              Password must be at least 8 characters and include uppercase,
              lowercase, a number, and a special character.
            </p>
            <form onSubmit={changePassword}>
              <Field
                label="Current password"
                type="password"
                value={pwdForm.currentPassword}
                onChange={(v) =>
                  setPwdForm((f) => ({ ...f, currentPassword: v }))
                }
              />
              <Field
                label="New password"
                type="password"
                value={pwdForm.newPassword}
                onChange={(v) =>
                  setPwdForm((f) => ({ ...f, newPassword: v }))
                }
              />
              <Field
                label="Confirm new password"
                type="password"
                value={pwdForm.confirmNewPassword}
                onChange={(v) =>
                  setPwdForm((f) => ({
                    ...f,
                    confirmNewPassword: v,
                  }))
                }
              />

              <button
                type="submit"
                style={dangerBtn}
                disabled={pwdSaving}
              >
                {pwdSaving ? "Updating..." : "Update password"}
              </button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}

/* ---------- Small reusable field components ---------- */

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder = "",
  disabled = false,
  hint,
}) {
  return (
    <div style={fieldWrap}>
      <label style={labelStyle}>{label}</label>
      <input
        style={inputStyle}
        type={type}
        value={value ?? ""}
        onChange={(e) => onChange && onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
      />
      {hint && <div style={hintStyle}>{hint}</div>}
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options = [],
  disabled = false,
  hint,
}) {
  return (
    <div style={fieldWrap}>
      <label style={labelStyle}>{label}</label>
      <select
        style={inputStyle}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange && onChange(e.target.value)}
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
      {hint && <div style={hintStyle}>{hint}</div>}
    </div>
  );
}

/* ---------- styles (inline, similar to GroupDetail) ---------- */

const pageWrap = {
  padding: "28px 14px 60px",
  minHeight: "calc(100vh - 80px)",
  background: "linear-gradient(180deg,#f8f9ff 0%, #ffffff 100%)",
};

const container = {
  width: "min(1100px, 96vw)",
  margin: "0 auto",
};

const h1 = {
  margin: 0,
  fontSize: 24,
  fontWeight: 900,
};

const subtitle = {
  marginTop: 6,
  marginBottom: 16,
  fontSize: 13,
  color: "#4b5563",
};

const grid = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1.2fr)",
  gap: 14,
  alignItems: "flex-start",
};

const card = {
  borderRadius: 14,
  border: "1px solid #EEF0F5",
  background: "#fff",
  boxShadow: "0 10px 40px rgba(15,23,42,0.06)",
  padding: 14,
};

const cardTitle = {
  margin: "0 0 10px",
  fontSize: 18,
  fontWeight: 800,
};

const formGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
  gap: 10,
};

const fieldWrap = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
};

const labelStyle = {
  fontSize: 12,
  fontWeight: 700,
  color: "#4b5563",
};

const inputStyle = {
  borderRadius: 10,
  border: "1px solid #e5e7eb",
  padding: "7px 9px",
  fontSize: 13,
  outline: "none",
  boxSizing: "border-box",
};

const hintStyle = {
  fontSize: 11,
  color: "#9ca3af",
};

const toggleRow = {
  display: "flex",
  flexWrap: "wrap",
  gap: 10,
  marginTop: 12,
  marginBottom: 8,
};

const toggleLabel = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  fontSize: 12,
  color: "#374151",
};

const metaRow = {
  display: "flex",
  flexWrap: "wrap",
  gap: 12,
  fontSize: 11,
  color: "#6b7280",
  marginBottom: 10,
};

const primaryBtn = {
  background: "linear-gradient(180deg,#5b7cfa,#4f46e5)",
  color: "#fff",
  border: 0,
  padding: "8px 14px",
  borderRadius: 999,
  fontWeight: 800,
  cursor: "pointer",
  fontSize: 13,
};

const dangerBtn = {
  background: "#ef4444",
  color: "#fff",
  border: 0,
  padding: "8px 14px",
  borderRadius: 999,
  fontWeight: 800,
  cursor: "pointer",
  fontSize: 13,
  marginTop: 4,
};

const smallText = {
  fontSize: 12,
  color: "#6b7280",
  marginBottom: 10,
};

const skeletonCard = {
  marginTop: 12,
  height: 260,
  borderRadius: 14,
  border: "1px solid #EEF0F5",
  background:
    "linear-gradient(90deg,#f3f4f6 0%, #f9fafb 20%, #f3f4f6 40%)",
  backgroundSize: "200% 100%",
  animation: "s 1.2s linear infinite",
};

