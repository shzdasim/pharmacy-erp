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
        rounded-full transition-colors duration-200 ease-in-out
        focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:ring-offset-2
        cursor-pointer
        ${isDark 
          ? "bg-slate-700 ring-1 ring-slate-600/50" 
          : "bg-gradient-to-br from-amber-100 via-white to-amber-50 ring-1 ring-amber-200/50"
        }
        ${className}
      `}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {/* Sun Icon - visible in light mode */}
      <SunIcon
        className={`
          relative z-10 h-5 w-5 text-amber-500 transition-opacity duration-200
          ${isDark ? "opacity-0" : "opacity-100"}
        `}
      />

      {/* Moon Icon - visible in dark mode */}
      <MoonIcon
        className={`
          absolute h-5 w-5 text-indigo-200 transition-opacity duration-200
          ${isDark ? "opacity-100" : "opacity-0"}
        `}
      />
    </button>
  );
}

