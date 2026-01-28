// src/components/Topbar.jsx
import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { ClipboardDocumentListIcon, ShoppingCartIcon, ClockIcon } from "@heroicons/react/24/solid";
import { useLicense } from "@/context/LicenseContext.jsx";
import ProductSearch from "@/components/ProductSearch.jsx";
import ThemeToggle from "./ThemeToggle.jsx";

function formatRemaining(ms) {
  if (ms == null) return "Perpetual";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

export default function Topbar() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const btnRef = useRef(null);

  const navigate = useNavigate();
  const { user, logout } = useAuth();

  // License status
  const { loading: licLoading, valid: licValid, remainingMs } = useLicense();
  const leftTxt = formatRemaining(remainingMs);

  const openInNewTab = (path) => window.open(path, "_blank", "noopener,noreferrer");

  useEffect(() => {
    const onKeyDown = (e) => {
      if (!e.altKey) return;
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
    <div
      className="sticky top-0 z-40 px-3 pt-3 bg-transparent
      after:content-[''] after:pointer-events-none after:absolute after:left-0 after:right-0 after:top-[78px]
      after:h-4 after:bg-gradient-to-b after:from-white/50 after:to-transparent
      dark:after:from-slate-900/50 dark:after:to-transparent"
    >
      <header
        role="banner"
        className={[
          "mx-auto rounded-2xl bg-white/55 backdrop-blur-sm ring-1 ring-white/30 dark:bg-slate-800/70 dark:ring-white/10 shadow-[0_10px_30px_-12px_rgba(15,23,42,0.25)]",
          "relative px-4 py-3",
          "before:absolute before:inset-0 before:rounded-2xl before:ring-1 before:ring-white/30 dark:before:ring-white/10",
        ].join(" ")}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Left: Search */}
          <div className="flex-1 min-w-[200px] max-w-[480px]">
            <ProductSearch />
          </div>

          {/* Right: License badge + Quick actions + Theme Toggle + User */}
          <div className="flex items-center gap-2">
            {/* Theme Toggle */}
            <ThemeToggle />

            {/* License badge */}
            <button
              onClick={() => navigate("/activate")}
              className={[
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-white text-xs font-semibold",
                "bg-gradient-to-r from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/30",
                "transition-all hover:shadow-emerald-500/40 hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-emerald-400/50",
              ].join(" ")}
              title={licValid ? "License is active" : "License required – click to activate"}
            >
              <ClockIcon className="w-3.5 h-3.5" />
              {licLoading ? "Checking…" : licValid ? `${leftTxt} left` : "Activate"}
            </button>

            <button
              onClick={() => openInNewTab("/purchase-invoices/create")}
              aria-keyshortcuts="Alt+1"
              title="Open Purchase Invoice (Alt+1) in a new tab"
              className={[
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-white text-xs font-semibold",
                "bg-gradient-to-r from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/30",
                "transition-all hover:shadow-emerald-500/40 hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-emerald-400/50",
              ].join(" ")}
            >
              <ClipboardDocumentListIcon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Purchase</span>
            </button>

            <button
              onClick={() => openInNewTab("/sale-invoices/create")}
              aria-keyshortcuts="Alt+2"
              title="Open Sale Invoice (Alt+2) in a new tab"
              className={[
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-white text-xs font-semibold",
                "bg-gradient-to-r from-indigo-500 to-indigo-600 shadow-lg shadow-indigo-500/30",
                "transition-all hover:shadow-indigo-500/40 hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-indigo-400/50",
              ].join(" ")}
            >
              <ShoppingCartIcon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sale</span>
            </button>

            <div className="mx-1 h-6 w-px bg-gradient-to-b from-transparent via-slate-300/60 to-transparent" />

            {/* User menu */}
            <div className="relative">
              <button
                ref={btnRef}
                onClick={() => setOpen((v) => !v)}
                className={[
                  "flex items-center gap-1.5 rounded-full px-3 py-1",
                  "bg-gradient-to-r from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/30",
                  "transition-all hover:shadow-blue-500/40 hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-400/50",
                ].join(" ")}
                aria-haspopup="menu"
                aria-expanded={open}
                aria-controls="topbar-user-menu"
              >
                <span className="inline-grid h-5 w-5 place-items-center rounded-full bg-white/90 text-blue-600 text-xs font-bold shadow">
                  {(user?.name || "U").slice(0, 1).toUpperCase()}
                </span>
                <span className="hidden sm:inline text-xs font-semibold text-white">
                  {user?.name || "User"}
                </span>
                <svg className="w-3 h-3 text-white/90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {open && (
                <div
                  id="topbar-user-menu"
                  ref={menuRef}
                  role="menu"
                  className={[
                    "absolute right-0 mt-2 w-48 rounded-xl overflow-hidden",
                    "bg-white/95 backdrop-blur ring-1 ring-gray-200/70 shadow-xl",
                  ].join(" ")}
                >
                  <button
                    role="menuitem"
                    onClick={() => {
                      setOpen(false);
                      navigate("/profile");
                    }}
                    className="block w-full px-4 py-2 text-left text-sm hover:bg-white/80 focus:bg-white/80 focus:outline-none"
                  >
                    Profile
                  </button>
                  <button
                    role="menuitem"
                    onClick={() => {
                      setOpen(false);
                      fetch("/api/logout", {
                        method: "POST",
                        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
                      }).finally(() => {
                        logout();
                        navigate("/");
                      });
                    }}
                    className="block w-full px-4 py-2 text-left text-sm hover:bg-white/80 focus:bg-white/80 focus:outline-none"
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

