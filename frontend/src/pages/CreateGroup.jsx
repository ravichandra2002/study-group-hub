import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";

export default function GroupCreate() {
  const nav = useNavigate();
  const [form, setForm] = useState({
    title: "",
    courseCode: "",
    courseTitle: "",
    description: "",
  });
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    const title = form.title.trim();
    const code = form.courseCode.trim();
    const ctitle = form.courseTitle.trim();
    if (!title || !code) return;

    const course = ctitle ? `${code} · ${ctitle}` : code;

    try {
      const res = await api.post("/groups", {
        title,
        course,
        courseCode: code,
        courseTitle: ctitle,
        description: form.description.trim(),
      });
      const id = res?.data?._id || res?._id || res?.data?.id;
      nav(`/group/${id}`);
    } catch (err) {
      console.error(err);
      // optionally toast
    }
  };

  return (
    <div style={page}>
      <div style={headRow}>
        <h1 style={h1}>Create group</h1>
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" style={chipLink} onClick={() => nav("/dashboard")}>
            ← Back to dashboard
          </button>
          <button type="button" style={chipLink} onClick={() => nav("/browse")}>
            🔎 Browse groups
          </button>
        </div>
      </div>

      <form style={card} onSubmit={submit}>
        <div style={field}>
          <label style={label}>Title</label>
          <input
            style={input}
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="e.g., Algorithms"
            required
          />
        </div>

        <div style={twoUp}>
          <div style={field}>
            <label style={label}>Course</label>
            <input
              style={input}
              value={form.courseCode}
              onChange={(e) => set("courseCode", e.target.value)}
              placeholder="e.g., CS-502"
              required
            />
          </div>
          
          {/* <div style={field}>
            <label style={label}>Course title (optional)</label>
            <input
              style={input}
              value={form.courseTitle}
              onChange={(e) => set("courseTitle", e.target.value)}
              placeholder="e.g., Algorithms"
            />
          </div> */}
        </div>

        <div style={field}>
          <label style={label}>Description (optional)</label>
          <textarea
            style={{ ...input, minHeight: 140, resize: "vertical" }}
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="What this group is about…"
          />
        </div>

        <div style={actions}>
          <button type="submit" style={btnPrimary}>Create group</button>
          <button type="button" style={btnGhost} onClick={() => nav("/dashboard")}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

/* ---------- styles ---------- */
const page = { padding: "24px 16px 40px" };

const headRow = {
  maxWidth: 1100,
  margin: "0 auto 14px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
};

const h1 = { margin: 0, fontSize: 28, fontWeight: 800, lineHeight: 1.15 };

const chipLink = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  background: "#F4F6FF",
  color: "#4f46e5",
  border: "1px solid #E3E8FF",
  padding: "10px 14px",
  borderRadius: 999,
  fontWeight: 600,     // lighter
  fontSize: 14,
  cursor: "pointer",
};

const card = {
  width: "min(900px, 96vw)",     // a bit narrower for comfy padding
  margin: "0 auto",
  background: "#fff",
  border: "1px solid #EDF0F5",
  borderRadius: 16,
  boxShadow: "0 22px 60px rgba(2,6,23,0.06)",
  padding: 16,
  boxSizing: "border-box",
  // IMPORTANT: no clipping, so child inputs keep their full rounded corners
  overflow: "visible",
};

const field = { marginBottom: 14 };

const label = { display: "block", fontWeight: 700, marginBottom: 6, color: "#111827" };

const input = {
  width: "100%",
  display: "block",
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid #E5E7EB",
  outline: "none",
  boxSizing: "border-box",
  background: "#fff",
};

const twoUp = {
  display: "grid",
  gridTemplateColumns: "1fr",  
};

const actions = { display: "flex", gap: 10, marginTop: 8 };

const btnPrimary = {
  background: "linear-gradient(180deg,#5b7cfa,#4f46e5)",
  color: "#fff",
  border: 0,
  padding: "10px 14px",
  borderRadius: 12,
  fontWeight: 800,
  cursor: "pointer",
};

const btnGhost = {
  background: "#fff",
  color: "#6b7280",
  border: "1px solid #E5E7EB",
  padding: "10px 14px",
  borderRadius: 12,
  fontWeight: 700,
  cursor: "pointer",
};
