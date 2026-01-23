import React, { createContext, useContext, useState, useEffect } from "react";
import axios from "axios";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  // Safely parse user from localStorage - handle null, undefined, or corrupted values
  const getStoredUser = () => {
    try {
      const userData = localStorage.getItem("user");
      if (!userData || userData === "undefined" || userData === "null") {
        return null;
      }
      return JSON.parse(userData);
    } catch (error) {
      console.error("Error parsing user from localStorage:", error);
      return null;
    }
  };

  const [user, setUser] = useState(getStoredUser());
  const token = localStorage.getItem("token");

  useEffect(() => {
    if (token && !user) {
      axios.get("/api/user", {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(res => {
        setUser(res.data);
        localStorage.setItem("user", JSON.stringify(res.data));
      })
      .catch(() => {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
      });
    }
  }, [token]);

  const login = (userData, tokenValue, additionalData = {}) => {
    localStorage.setItem("token", tokenValue);
    localStorage.setItem("user", JSON.stringify(userData));
    setUser(userData);
    axios.defaults.headers.common["Authorization"] = `Bearer ${tokenValue}`;

    // If license was revoked (software moved to new device), redirect to activation
    if (additionalData.license_revoked) {
      // Clear any cached user data that might cause issues
      localStorage.removeItem("user");
      // Redirect to activation page
      window.location.href = "/activate";
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("productModalPos");
    localStorage.removeItem("productModalSize");

    setUser(null);
    delete axios.defaults.headers.common["Authorization"];
  };

  return (
    <AuthContext.Provider value={{ user, setUser, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
