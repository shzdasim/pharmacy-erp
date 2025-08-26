// resources/js/components/SupplierSearchInput.jsx
import React, { useState, useEffect, useRef } from "react";

export default function SupplierSearchInput({ value, onChange, suppliers }) {
  const [query, setQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const wrapperRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Update query if external value changes
  useEffect(() => {
    const selected = suppliers.find((s) => s.id === value);
    if (selected) setQuery(selected.name);
  }, [value, suppliers]);

  // Filter suppliers by query
  const filtered = suppliers.filter((s) =>
    s.name.toLowerCase().includes(query.toLowerCase())
  );

  const handleSelect = (supplier) => {
    setQuery(supplier.name);
    onChange(supplier.id);
    setShowDropdown(false);
  };

  // Scroll to highlighted row
  useEffect(() => {
    if (showDropdown && filtered.length > 0) {
      const highlightedElement = document.querySelector(`tr.bg-blue-100`);
      if (highlightedElement) {
        highlightedElement.scrollIntoView({
          block: "nearest",
          behavior: "smooth",
        });
      }
    }
  }, [highlightIndex, showDropdown, filtered.length]);

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (!showDropdown) {
      if (e.key === "Enter") {
        e.preventDefault();
        if (onChange) onChange(value);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((prev) =>
        prev < filtered.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[highlightIndex]) handleSelect(filtered[highlightIndex]);
    } else if (e.key === "Escape") {
      setShowDropdown(false);
    }
  };

  return (
    <div ref={wrapperRef} className="relative w-full">
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setShowDropdown(true);
          setHighlightIndex(0);
        }}
        onFocus={() => setShowDropdown(true)}
        onKeyDown={handleKeyDown}
        className="border w-full h-6 text-[11px] px-1"
        placeholder="Search supplier..."
      />
      {showDropdown && filtered.length > 0 && (
        <div
          className="absolute left-0 right-0 max-h-60 overflow-auto
                     border bg-white shadow-lg z-20 text-[11px] w-[400px]"
        >
          <table className="w-full border-collapse">
            <thead className="bg-gray-100 sticky top-0">
              <tr className="text-left text-[10px]">
                <th className="border px-1">Name</th>
                <th className="border px-1">Phone</th>
                <th className="border px-1">Address</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, idx) => (
                <tr
                  key={s.id}
                  onClick={() => handleSelect(s)}
                  className={`cursor-pointer ${
                    idx === highlightIndex ? "bg-blue-100" : ""
                  }`}
                >
                  <td className="border px-1">{s.name}</td>
                  <td className="border px-1">{s.phone || "-"}</td>
                  <td className="border px-1">{s.address || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
