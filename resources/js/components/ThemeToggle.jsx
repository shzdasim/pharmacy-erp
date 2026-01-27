import React, { useCallback } from "react";
import { SunIcon, MoonIcon } from "@heroicons/react/24/solid";
import { useTheme } from "../context/ThemeContext.jsx";

export default function ThemeToggle({ className = "" }) {
  const { theme, toggleTheme, isDark } = useTheme();

  const handleClick = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log("ThemeToggle: Button clicked, current theme:", theme);
    toggleTheme();
  }, [toggleTheme, theme]);

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`
        relative inline-flex h-9 w-9 items-center justify-center
        rounded-full transition-all duration-300 ease-in-out
        focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:ring-offset-2
        cursor-pointer
        ${className}
      `}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {/* Background with gradient - changes based on theme */}
      <div
        className={`
          absolute inset-0 rounded-full
          transition-all duration-300 ease-in-out
          ${isDark 
            ? "bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900 ring-1 ring-slate-600/50 shadow-slate-800/50" 
            : "bg-gradient-to-br from-amber-100 via-white to-amber-50 ring-1 ring-amber-200/50 shadow-amber-500/20"
          }
          shadow-lg
        `}
      />

      {/* Sun Icon - visible in light mode, hidden in dark mode */}
      <SunIcon
        className={`
          relative z-10 h-5 w-5 text-amber-500 transition-all duration-300
          ${isDark ? "opacity-0 scale-50 rotate-90" : "opacity-100 scale-100 rotate-0"}
        `}
      />

      {/* Moon Icon - visible in dark mode, hidden in light mode */}
      <MoonIcon
        className={`
          absolute h-5 w-5 text-indigo-200 transition-all duration-300
          ${isDark ? "opacity-100 scale-100 rotate-0" : "opacity-0 scale-50 -rotate-90"}
        `}
      />

      {/* Glow effect in dark mode */}
      {isDark && (
        <div
          className="absolute inset-0 rounded-full bg-indigo-500/30 blur-xl animate-pulse"
        />
      )}
    </button>
  );
}

