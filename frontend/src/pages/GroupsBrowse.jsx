import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../lib/api";
import styles from "./Groups.module.css";

export default function GroupsBrowse() {
  const [q, setQ] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await api.get("/groups/browse", { params: { q } });
    setItems(data || []);
    setLoading(false);
  };

  useEffect(() => { load();  }, []);

  const join = async (id) => {
    await api.post(`/groups/join/${id}`);
    await load();
  };

  return (
    <div className={styles.page}>
      <div className={styles.headRow}>
        <h1 className={styles.h1}>Groups</h1>
        <div className={styles.searchRow}>
          <input
            className={styles.input}
            placeholder="Search by title or course code…"
            value={q}
            onChange={(e)=>setQ(e.target.value)}
            onKeyDown={(e)=>e.key==="Enter" && load()}
          />
          <button className={styles.btnSecondary} onClick={load}>Search</button>
          <Link to="/groups/create" className={styles.btnPrimary}>+ Create</Link>
        </div>
      </div>

      {loading && <div className={styles.state}>Loading…</div>}
      {!loading && items.length === 0 && <div className={styles.state}>No groups found.</div>}

      <div className={styles.grid}>
        {items.map(g => (
          <article key={g._id} className={styles.card}>
            <div className={styles.cardHead}>
              <div className={styles.dot} />
              <h3 className={styles.cardTitle}>{g.title}</h3>
            </div>
            <p className={styles.cardMeta}>{g.course?.code}{g.course?.title ? ` · ${g.course.title}` : ""}</p>
            {g.description && <p className={styles.cardDesc}>{g.description}</p>}
            <div className={styles.cardFoot}>
              <Link className={styles.btnGhost} to={`/group/${g._id}`}>Open</Link>
              <button className={styles.btnPrimary} onClick={()=>join(g._id)}>Join</button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
