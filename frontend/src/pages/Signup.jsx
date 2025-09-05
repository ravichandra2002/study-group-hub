// import { useEffect, useState } from "react";
// import { Link, useNavigate } from "react-router-dom";
// import api from "../lib/api";
// import { toast } from "react-toastify";
// import styles from "./Signup.module.css";

// const KENT_RE = /^[^@\s]+@kent\.edu$/i;

// export default function Signup() {
//   const nav = useNavigate();

//   const [form, setForm] = useState({
//     fullName: "",
//     email: "",
//     password: "",
//     timezone:
//       Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York",

//     department: "",
//     program: "Masters",
//     yearOfStudy: 1,
//     currentSemester: "",

//     courses: [{ courseCode: "", courseTitle: "" }],

//     studyMode: "Problem-Solving",
//     meetingMode: "Either",
//   });

//   const [submitting, setSubmitting] = useState(false);

//   useEffect(() => {
//     if (localStorage.getItem("token")) nav("/dashboard");
//   }, [nav]);

//   const setField = (key, val) => setForm((p) => ({ ...p, [key]: val }));

//   // Courses helpers
//   const updateCourse = (idx, key, val) => {
//     const copy = [...form.courses];
//     copy[idx] = { ...copy[idx], [key]: val };
//     setField("courses", copy);
//   };
//   const addCourse = () =>
//     setField("courses", [...form.courses, { courseCode: "", courseTitle: "" }]);
//   const removeCourse = (idx) =>
//     setField("courses", form.courses.filter((_, i) => i !== idx));

//   // Validate before submit
//   const validate = () => {
//     if (!form.fullName.trim()) return "Full name is required.";
//     if (!KENT_RE.test(form.email)) return "Use your @kent.edu email.";
//     if (!form.password || form.password.length < 6)
//       return "Password must be at least 6 characters.";
//     if (!form.timezone) return "Timezone is required.";
//     if (!form.department.trim()) return "Department is required.";
//     if (!form.currentSemester.trim()) return "Current semester is required.";
//     if (!form.courses.length) return "Add at least one course.";
//     for (const c of form.courses) {
//       if (!c.courseCode.trim() || !c.courseTitle.trim()) {
//         return "Each course needs a code and a title.";
//       }
//     }
//     return null;
//   };

//   const submit = async (e) => {
//     e.preventDefault();
//     const err = validate();
//     if (err) {
//       toast.error(err);
//       return;
//     }
//     try {
//       setSubmitting(true);
//       await api.post("/auth/signup", form);
//       toast.success("Signup successful! Please login");
//       nav("/login");
//     } catch (e) {
//       toast.error(e?.response?.data?.error || "Signup failed");
//     } finally {
//       setSubmitting(false);
//     }
//   };

//   return (
//     <div className={styles.page}>
//       <div className={styles.wrap}>
//         {/* Left hero */}
//         <section className={styles.hero} aria-label="About Study Group Hub">
//           <div className={styles.brand}>
//             <span className={styles.badge} />
//             Study Group Hub
//           </div>
//           <h1>Find your study crew.</h1>
//           <p>
//             Smart matching by course, availability, and study style. Organize online
//             sessions with auto-generated meeting links.
//           </p>
//         </section>

//         {/* Right card with two columns */}
//         <section className={styles.card} aria-labelledby="signup-title">
//           <span id="signup-title" className={styles.title}>
//             Create account
//           </span>

//           <form className={styles.formTwoCol} onSubmit={submit} noValidate>
//             {/* LEFT COLUMN */}
//             <div className={styles.col}>
//               <input
//                 className={styles.input}
//                 placeholder="Full name"
//                 aria-label="Full name"
//                 autoComplete="name"
//                 value={form.fullName}
//                 onChange={(e) => setField("fullName", e.target.value)}
//                 required
//               />

//               <input
//                 className={styles.input}
//                 placeholder="Kent email (yourname@kent.edu)"
//                 aria-label="Kent email"
//                 type="email"
//                 inputMode="email"
//                 autoComplete="email"
//                 pattern="^[^@\s]+@kent\.edu$"
//                 title="Please use your @kent.edu email"
//                 value={form.email}
//                 onChange={(e) => setField("email", e.target.value)}
//                 required
//               />

//               <input
//                 className={styles.input}
//                 placeholder="Password"
//                 aria-label="Password"
//                 type="password"
//                 autoComplete="new-password"
//                 minLength={6}
//                 value={form.password}
//                 onChange={(e) => setField("password", e.target.value)}
//                 required
//               />

//               <div>
//                 <label className={styles.label} htmlFor="tz">
//                   Timezone
//                 </label>
//                 <input
//                   id="tz"
//                   className={styles.input}
//                   aria-label="Timezone"
//                   value={form.timezone}
//                   onChange={(e) => setField("timezone", e.target.value)}
//                   required
//                 />
//               </div>

//               <div>
//                 <label className={styles.label} htmlFor="dept">
//                   Department
//                 </label>
//                 <input
//                   id="dept"
//                   className={styles.input}
//                   placeholder="Computer Science"
//                   aria-label="Department"
//                   value={form.department}
//                   onChange={(e) => setField("department", e.target.value)}
//                   required
//                 />
//               </div>
//             </div>

//             {/* RIGHT COLUMN */}
//             <div className={styles.col}>
//               <div>
//                 <label className={styles.label} htmlFor="program">
//                   Program
//                 </label>
//                 <select
//                   id="program"
//                   className={styles.input}
//                   aria-label="Program"
//                   value={form.program}
//                   onChange={(e) => setField("program", e.target.value)}
//                 >
//                   <option>Bachelors</option>
//                   <option>Masters</option>
//                   <option>PhD</option>
//                   <option>Diploma</option>
//                   <option>Other</option>
//                 </select>
//               </div>

//               <div>
//                 <label className={styles.label} htmlFor="yos">
//                   Year of Study
//                 </label>
//                 <input
//                   id="yos"
//                   className={styles.input}
//                   aria-label="Year of Study"
//                   type="number"
//                   min={1}
//                   max={6}
//                   value={form.yearOfStudy}
//                   onChange={(e) =>
//                     setField("yearOfStudy", Number(e.target.value))
//                   }
//                 />
//               </div>

//               <div>
//                 <label className={styles.label} htmlFor="semester">
//                   Current semester
//                 </label>
//                 <input
//                   id="semester"
//                   className={styles.input}
//                   placeholder="Fall 2025"
//                   aria-label="Current semester"
//                   value={form.currentSemester}
//                   onChange={(e) => setField("currentSemester", e.target.value)}
//                   required
//                 />
//               </div>

//               {/* Courses */}
//               <div>
//                 <label className={styles.label}>Courses this term</label>
//                 {form.courses.map((c, idx) => (
//                   <div key={idx} className={styles.courseRow}>
//                     <input
//                       className={styles.input}
//                       placeholder="Course code (CS-502)"
//                       aria-label={`Course ${idx + 1} code`}
//                       value={c.courseCode}
//                       onChange={(e) =>
//                         updateCourse(idx, "courseCode", e.target.value)
//                       }
//                     />
//                     <input
//                       className={styles.input}
//                       placeholder="Title (Algorithms)"
//                       aria-label={`Course ${idx + 1} title`}
//                       value={c.courseTitle}
//                       onChange={(e) =>
//                         updateCourse(idx, "courseTitle", e.target.value)
//                       }
//                     />
//                     {form.courses.length > 1 && (
//                       <button
//                         type="button"
//                         className={styles.iconBtn}
//                         onClick={() => removeCourse(idx)}
//                         aria-label={`Remove course ${idx + 1}`}
//                         title="Remove course"
//                       >
//                         ✕
//                       </button>
//                     )}
//                   </div>
//                 ))}
//                 <button
//                   type="button"
//                   className={styles.btnSecondary}
//                   onClick={addCourse}
//                 >
//                   + Add course
//                 </button>
//               </div>

//               {/* Preferences */}
//               <div className={styles.twoUp}>
//                 <div>
//                   <label className={styles.label} htmlFor="studyMode">
//                     Study mode
//                   </label>
//                   <select
//                     id="studyMode"
//                     className={styles.input}
//                     aria-label="Study mode"
//                     value={form.studyMode}
//                     onChange={(e) => setField("studyMode", e.target.value)}
//                   >
//                     <option>Problem-Solving</option>
//                     <option>Discussion</option>
//                     <option>Quiet-Individual</option>
//                     <option>Mixed</option>
//                   </select>
//                 </div>
//                 <div>
//                   <label className={styles.label} htmlFor="meetingMode">
//                     Meeting mode
//                   </label>
//                   <select
//                     id="meetingMode"
//                     className={styles.input}
//                     aria-label="Meeting mode"
//                     value={form.meetingMode}
//                     onChange={(e) => setField("meetingMode", e.target.value)}
//                   >
//                     <option>Either</option>
//                     <option>Online</option>
//                     <option>On-Campus</option>
//                   </select>
//                 </div>
//               </div>
//             </div>

//             {/* Bottom row (full width) */}
//             <div className={styles.actions}>
//               <button
//                 className={styles.btnPrimary}
//                 type="submit"
//                 disabled={submitting}
//                 aria-busy={submitting ? "true" : "false"}
//               >
//                 {submitting ? "Creating..." : "Sign up"}
//               </button>
//               <span className={styles.helper}>
//                 Already have an account? <Link to="/login">Back to login</Link>
//               </span>
//             </div>
//           </form>
//         </section>
//       </div>
//     </div>
//   );
// }


// src/pages/Signup.jsx
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../lib/api";
import { toast } from "react-toastify";
import styles from "./Signup.module.css";

// ✅ import department list
import departments from "../data/departments.json";

const KENT_RE = /^[^@\s]+@kent\.edu$/i;

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
    meetingMode: "Either"
  });

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (localStorage.getItem("token")) nav("/dashboard");
  }, [nav]);

  const setField = (key, val) => setForm((p) => ({ ...p, [key]: val }));

  const validate = () => {
    if (!form.fullName.trim()) return "Full name is required.";
    if (!KENT_RE.test(form.email)) return "Use your @kent.edu email.";
    if (!form.password || form.password.length < 6)
      return "Password must be at least 6 characters.";
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
        currentSemester: `${form.semesterTerm} ${form.semesterYear}`
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
              />

              <input
                className={styles.input}
                placeholder="Kent email (yourname@kent.edu)"
                type="email"
                value={form.email}
                onChange={(e) => setField("email", e.target.value)}
                required
              />

              <input
                className={styles.input}
                placeholder="Password"
                type="password"
                minLength={6}
                value={form.password}
                onChange={(e) => setField("password", e.target.value)}
                required
              />

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
