import axios from "axios";

export function initAxiosAuth() {
  axios.defaults.headers.common["X-Requested-With"] = "XMLHttpRequest";

  const t = localStorage.getItem("token");
  if (t) {
    axios.defaults.headers.common["Authorization"] = `Bearer ${t}`;
  } else {
    delete axios.defaults.headers.common["Authorization"];
  }

  axios.interceptors.response.use(
    (r) => r,
    (err) => {
      const status = err?.response?.status;
      const url = err?.config?.url || "";

      // 🔒 If server says "Payment Required", send user to Activate page
      const isLicenseApi = url.includes("/license/");
      const isAuth = url.includes("/login") || url.includes("/user") || url.includes("/me");

      if (status === 402 && !isLicenseApi) {
        // stop console spam & bounce to activate
        window.location.assign("/activate");
        return; // don't rethrow
      }

      // Optional: handle 401 globally
      if (status === 401 && !isAuth) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        // window.location.href = "/login";
      }

      return Promise.reject(err);
    }
  );
}
