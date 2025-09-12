// src/components/Topbar.jsx
import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import {
  ClipboardDocumentListIcon, // Purchase Invoice
  ShoppingCartIcon,          // Sale Invoice
} from "@heroicons/react/24/solid";

export default function Topbar() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const btnRef = useRef(null);

  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const openInNewTab = (path) => window.open(path, "_blank", "noopener,noreferrer");

  // Global keyboard shortcuts: Alt+1 (purchase), Alt+2 (sale)
  useEffect(() => {
    const onKeyDown = (e) => {
      if (!e.altKey) return;

      // avoid triggering while typing
      const tag = (e.target?.tagName || "").toLowerCase();
      const isTyping =
        ["input", "textarea", "select"].includes(tag) || e.target?.isContentEditable;
      if (isTyping) return;

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

  // Close dropdown on click outside / Escape
  useEffect(() => {
    function onClick(e) {
      if (!open) return;
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target) &&
        btnRef.current &&
        !btnRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    }
    function onEsc(e) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onEsc);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  return (
    // Sticky + floating shell with bottom fade shadow
    <div className="sticky top-0 z-40 px-3 pt-3 bg-transparent
      after:content-[''] after:pointer-events-none after:absolute after:left-0 after:right-0 after:top-[72px]
      after:h-4 after:bg-gradient-to-b after:from-white/70 after:to-transparent">
      <header
        className="mx-auto rounded-2xl bg-white/70 backdrop-blur-sm ring-1 ring-gray-200/60 shadow-xl
        px-4 py-3"
        role="banner"
      >
        <div className="flex flex-wrap items-center gap-3 justify-between">
          {/* Left: Title (auto falls back to Dashboard) */}
          <h1 className="text-lg font-semibold text-gray-900">
            Dashboard
          </h1>

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            
            <button
              onClick={() => openInNewTab("/purchase-invoices/create")}
              aria-keyshortcuts="Alt+1"
              title="Open Purchase Invoice (Alt+1) in a new tab"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 text-white px-3 py-2
              hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/70"
            >
              <ClipboardDocumentListIcon className="w-5 h-5" />
              <span className="hidden sm:inline">Purchase Invoice</span>
              <span className="ml-1 text-[11px] opacity-90 border border-white/40 rounded px-1 py-0.5">
                Alt+1
              </span>
            </button>

            <button
              onClick={() => openInNewTab("/sale-invoices/create")}
              aria-keyshortcuts="Alt+2"
              title="Open Sale Invoice (Alt+2) in a new tab"
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 text-white px-3 py-2
              hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/70"
            >
              <ShoppingCartIcon className="w-5 h-5" />
              <span className="hidden sm:inline">Sale Invoice</span>
              <span className="ml-1 text-[11px] opacity-90 border border-white/40 rounded px-1 py-0.5">
                Alt+2
              </span>
            </button>

            {/* User menu */}
            <div className="relative">
              <button
                ref={btnRef}
                onClick={() => setOpen((v) => !v)}
                className="flex items-center gap-2 rounded-xl px-3 py-2
                hover:bg-white/80 hover:shadow focus:outline-none focus:ring-2 focus:ring-blue-400/60"
                aria-haspopup="menu"
                aria-expanded={open}
                aria-controls="topbar-user-menu"
              >
                <span className="inline-block h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 text-white place-items-center font-semibold">
                  {(user?.name || "U").slice(0,1).toUpperCase()}
                </span>
                <span className="hidden sm:inline text-sm">{user?.name || "User"}</span>
                <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {open && (
                <div
                  id="topbar-user-menu"
                  ref={menuRef}
                  role="menu"
                  className="absolute right-0 mt-2 w-48 rounded-xl bg-white/95 backdrop-blur border border-gray-200/70 shadow-xl overflow-hidden"
                >
                  <button
                    role="menuitem"
                    onClick={() => {
                      setOpen(false);
                      navigate("/profile");
                    }}
                    className="block w-full px-4 py-2 text-left text-sm hover:bg-gray-50 focus:bg-gray-50 focus:outline-none"
                  >
                    Profile
                  </button>
                  <button
                    role="menuitem"
                    onClick={() => {
                      setOpen(false);
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
                    className="block w-full px-4 py-2 text-left text-sm hover:bg-gray-50 focus:bg-gray-50 focus:outline-none"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>
    </div>
  );
}
