import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../lib/api";
import { toast } from "react-toastify";
import styles from "./Login.module.css";

export default function Login() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (localStorage.getItem("token")) nav("/dashboard", { replace: true });
  }, [nav]);

  const submit = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.post("/auth/login", { email, password });
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      toast.success("Login successful!");
      nav("/dashboard", { replace: true });
    } catch (err) {
      toast.error(err?.response?.data?.error || "Login failed");
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.wrap}>
        <section className={styles.hero}>
          <div className={styles.brand}>
            <span className={styles.badge} />
            Study Group Hub
          </div>
          <h1>Focus more. Coordinate better.</h1>
          <p>Create or join course-based groups, share notes, and schedule sessions without the noise of social media.</p>
        </section>

        <section className={styles.card}>
          <span className={styles.title}>Log in</span>
          <form className={styles.form} onSubmit={submit}>
            <input className={styles.input} placeholder="Email" type="email"
              value={email} onChange={(e) => setEmail(e.target.value)} required />
            <input className={styles.input} placeholder="Password" type="password"
              value={password} onChange={(e) => setPassword(e.target.value)} required />
            <button className={styles.btnPrimary} type="submit">Login</button>
            <span className={styles.helper}>New here? <Link to="/signup">Create account</Link></span>
          </form>
        </section>
      </div>
    </div>
  );
}
