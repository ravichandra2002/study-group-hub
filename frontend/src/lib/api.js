// frontend/src/lib/api.js
import axios from "axios";

// Prefer VITE_API_URL if set; otherwise fall back to localhost:5050 in dev.
const API_BASE =
  (import.meta.env && import.meta.env.VITE_API_URL) || "http://localhost:5050";

const api = axios.create({
  baseURL: `${API_BASE.replace(/\/$/, "")}/api`,
  // withCredentials stays false because we pass JWT via Authorization header
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
