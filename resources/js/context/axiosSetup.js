// src/axiosSetup.js
import axios from "axios";

export function initAxiosAuth() {
  axios.defaults.headers.common["X-Requested-With"] = "XMLHttpRequest";
  const t = localStorage.getItem("token");
  if (t) {
    axios.defaults.headers.common["Authorization"] = `Bearer ${t}`;
  } else {
    delete axios.defaults.headers.common["Authorization"];
  }

  // Optional: handle 401 globally
  axios.interceptors.response.use(
    r => r,
    err => {
      if (err?.response?.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        // window.location.href = "/"; // uncomment if you want an auto-redirect
      }
      return Promise.reject(err);
    }
  );
}
