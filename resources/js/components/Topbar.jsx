import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import {
  ClipboardDocumentListIcon, // Purchase Invoice
  ShoppingCartIcon,          // Sale Invoice
} from "@heroicons/react/24/solid";

export default function Topbar() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const openInNewTab = (path) => window.open(path, "_blank", "noopener,noreferrer");

  // Global keyboard shortcuts: Alt+1 (purchase), Alt+2 (sale)
  useEffect(() => {
    const onKeyDown = (e) => {
      if (!e.altKey) return;

      // avoid triggering while typing in inputs/textareas/selects or contentEditable
      const tag = (e.target?.tagName || "").toLowerCase();
      const isTyping =
        ["input", "textarea", "select"].includes(tag) || e.target?.isContentEditable;
      if (isTyping) return;

      // layout-independent (works even if Option+1 types "¡" on some keyboards)
      if (e.code === "Digit1" || e.code === "Numpad1") {
        e.preventDefault();
        openInNewTab("/purchase-invoices/create");
      } else if (e.code === "Digit2" || e.code === "Numpad2") {
        e.preventDefault();
        openInNewTab("/sale-invoices/create");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <header className="bg-white shadow flex items-center justify-between p-4">
      <h1 className="text-xl font-semibold">Dashboard</h1>

      <div className="flex items-center gap-2">
        {/* Quick actions */}
        <button
          onClick={() => openInNewTab("/purchase-invoices/create")}
          aria-keyshortcuts="Alt+1"
          title="Open Purchase Invoice (Alt+1) in a new tab"
          className="inline-flex items-center gap-2 rounded-md bg-emerald-600 text-white px-3 py-2 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <ClipboardDocumentListIcon className="w-5 h-5" />
          <span className="hidden sm:inline">Purchase Invoice</span>
          <span className="ml-1 text-[11px] opacity-80 border border-white/40 rounded px-1 py-0.5">
            Alt+1
          </span>
        </button>

        <button
          onClick={() => openInNewTab("/sale-invoices/create")}
          aria-keyshortcuts="Alt+2"
          title="Open Sale Invoice (Alt+2) in a new tab"
          className="inline-flex items-center gap-2 rounded-md bg-indigo-600 text-white px-3 py-2 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <ShoppingCartIcon className="w-5 h-5" />
          <span className="hidden sm:inline">Sale Invoice</span>
          <span className="ml-1 text-[11px] opacity-80 border border-white/40 rounded px-1 py-0.5">
            Alt+2
          </span>
        </button>

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setOpen(!open)}
            className="flex items-center space-x-2 rounded px-2 py-2 hover:bg-gray-100"
          >
            <span>{user?.name || "User"}</span>
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {open && (
            <div className="absolute right-0 mt-2 bg-white rounded-md shadow-md w-44 overflow-hidden border">
              <button
                onClick={() => {
                  setOpen(false);
                  navigate("/profile");
                }}
                className="block w-full px-4 py-2 text-left hover:bg-gray-100"
              >
                Profile
              </button>
              <button
                onClick={() => {
                  fetch("/api/logout", {
                    method: "POST",
                    headers: {
                      Authorization: `Bearer ${localStorage.getItem("token")}`,
                    },
                  }).finally(() => {
                    logout();
                    navigate("/");
                  });
                }}
                className="block w-full px-4 py-2 text-left hover:bg-gray-100"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
