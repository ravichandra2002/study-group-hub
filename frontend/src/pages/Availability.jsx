import { useEffect, useState } from "react";
import api from "../lib/api";
import styles from "./Availability.module.css";

const DAYS = ["mon","tue","wed","thu","fri","sat","sun"];
const LABELS = {mon:"Mon",tue:"Tue",wed:"Wed",thu:"Thu",fri:"Fri",sat:"Sat",sun:"Sun"};

export default function Availability() {
  const [slots, setSlots] = useState(() =>
    ({mon:[],tue:[],wed:[],thu:[],fri:[],sat:[],sun:[]})
  );
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data } = await api.get("/groups/availability/me");
    setSlots({mon:[],tue:[],wed:[],thu:[],fri:[],sat:[],sun:[], ...(data||{})});
  };

  useEffect(()=>{ load(); }, []);

  const add = (d) => setSlots(p => ({...p, [d]: [...p[d], ["09:00","10:00"]]}));
  const setRange = (d, i, pos, val) => setSlots(p => {
    const copy = p[d].map(r=>[...r]); copy[i][pos] = val; return {...p, [d]: copy};
  });
  const remove = (d, i) => setSlots(p => ({...p, [d]: p[d].filter((_,idx)=>idx!==i)}));

  const save = async () => {
    setSaving(true);
    await api.put("/groups/availability", slots);
    setSaving(false);
  };

  return (
    <div className={styles.page}>
      <h1 className={styles.h1}>Weekly availability</h1>

      <div className={styles.grid}>
        {DAYS.map(d => (
          <div key={d} className={styles.dayCard}>
            <div className={styles.dayHead}>
              <span className={styles.badge}>{LABELS[d]}</span>
              <button className={styles.add} onClick={()=>add(d)}>+ Add</button>
            </div>
            {slots[d].length === 0 && <div className={styles.empty}>No slots</div>}
            {slots[d].map((r, idx) => (
              <div key={idx} className={styles.row}>
                <input type="time" value={r[0]} onChange={e=>setRange(d, idx, 0, e.target.value)} />
                <span className={styles.to}>to</span>
                <input type="time" value={r[1]} onChange={e=>setRange(d, idx, 1, e.target.value)} />
                <button className={styles.remove} onClick={()=>remove(d, idx)}>✕</button>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className={styles.actions}>
        <button className={styles.btnPrimary} onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save availability"}
        </button>
      </div>
    </div>
  );
}
