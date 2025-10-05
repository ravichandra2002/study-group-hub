// const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5050";

// async function apiGet(path) {
//   const r = await fetch(`${API_BASE}${path}`, {
//     headers: { Authorization: `Bearer ${localStorage.getItem("token") || ""}` },
//   });
//   if (!r.ok) throw new Error(await r.text());
//   return r.json();
// }
// async function apiPost(path, body) {
//   const r = await fetch(`${API_BASE}${path}`, {
//     method: "POST",
//     headers: {
//       "Content-Type": "application/json",
//       Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
//     },
//     body: JSON.stringify(body),
//   });
//   if (!r.ok) throw new Error(await r.text());
//   return r.json();
// }

// /**
//  * Read meeting mode the user chose during signup from localStorage
//  * and push it to the server if the server doesn't have one yet.
//  * Accepted: "online" | "offline" | "either"
//  */
// export async function syncMeetingPrefFromLocalStorage() {
//   try {
//     // try a few likely keys you may already be using:
//     const raw =
//       localStorage.getItem("meetingMode") ||
//       localStorage.getItem("profile.meetingMode") ||
//       localStorage.getItem("signup.meetingMode") ||
//       "";
//     const value = String(raw).trim().toLowerCase();

//     // If server already has a pref, do nothing
//     const me = await apiGet(`/api/groups/me/prefs`);
//     if (me?.meetingMode) return;

//     if (["online", "offline", "either"].includes(value)) {
//       await apiPost(`/api/groups/me/prefs`, { meetingMode: value });
//       // You can also keep it in localStorage if you want
//       localStorage.setItem("meetingMode", value);
//     }
//   } catch {
//     /* ignore */
//   }
// }
