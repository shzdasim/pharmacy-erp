import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function Topbar() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  return (
    <header className="bg-white shadow flex justify-between p-4">
      <h1 className="text-xl font-semibold">Dashboard</h1>
      <div className="relative">
        <button onClick={() => setOpen(!open)} className="flex items-center space-x-2">
          <span>{user?.name || "User"}</span>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {open && (
          <div className="absolute right-0 mt-2 bg-white rounded-md shadow-md w-40">
            <button
              onClick={() => navigate("/profile")}
              className="block w-full px-4 py-2 text-left hover:bg-gray-100"
            >
              Profile
            </button>
            <button
              onClick={() => {
                logout();
                navigate("/");
              }}
              className="block w-full px-4 py-2 text-left hover:bg-gray-100"
            >
              Logout
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
