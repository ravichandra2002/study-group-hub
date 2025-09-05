// src/pages/Dashboard.jsx
import { useEffect, useState } from "react";
import api from "../lib/api";
import styles from "./Dashboard.module.css";

export default function Dashboard() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      const { data } = await api.get("/groups/");
      setGroups(Array.isArray(data) ? data : []);
      setMsg("");
    } catch (e) {
      console.error("Error loading groups:", e);
      setMsg("Could not load groups. Are you logged in and is the backend running?");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const user = JSON.parse(localStorage.getItem("user") || "{}");

  return (
    <div className={styles.page}>
      <div className={styles.wrap}>
        {/* Simple heading */}
        <h1 className={styles.pageTitle}>
          Welcome {user.name || "there"} 
        </h1>

        {/* Content */}
        <section className={styles.section}>
          {loading && (
            <div className={styles.stateCard}>
              <div className={styles.spinner} aria-hidden />
              <p>Loading your groups…</p>
            </div>
          )}

          {!loading && msg && (
            <div className={`${styles.stateCard} ${styles.error}`}>
              <p>{msg}</p>
            </div>
          )}

          {!loading && !msg && groups.length === 0 && (
            <div className={styles.stateCard}>
              <h3>No groups yet</h3>
              <p className={styles.muted}>
                Create a group or join one from your course to get started.
              </p>
            </div>
          )}

          {!loading && !msg && groups.length > 0 && (
            <div className={styles.grid}>
              {groups.map((g) => (
                <article key={g._id} className={styles.card}>
                  <div className={styles.cardHead}>
                    <div className={styles.dot} />
                    <h3 className={styles.cardTitle}>{g.title || "Untitled group"}</h3>
                  </div>
                  <p className={styles.cardMeta}>
                    {g.course || "Course N/A"} · {g.members?.length ?? 0} members
                  </p>
                  {g.description && (
                    <p className={styles.cardDesc}>{g.description}</p>
                  )}
                  <div className={styles.cardFoot}>
                    <button className={styles.btnSecondary} type="button">
                      Open
                    </button>
                    <button className={styles.btnPrimary} type="button">
                      Join chat
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
