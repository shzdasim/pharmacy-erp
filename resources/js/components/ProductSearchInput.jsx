// resources/js/components/ProductSearchInput.jsx
import React, { useState, useEffect, useRef } from "react";

export default function ProductSearchInput({ value, onChange, products }) {
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

  // Update query with selected product name if value changes
  useEffect(() => {
    const selected = products.find((p) => p.id === value);
    if (selected) setQuery(selected.name);
  }, [value, products]);

  // Filter products by query
  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(query.toLowerCase())
  );

  const handleSelect = (product) => {
    setQuery(product.name);
    onChange(product.id);
    setShowDropdown(false);
  };

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (!showDropdown) return;

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
        placeholder="Search product..."
      />
      {showDropdown && filtered.length > 0 && (
        <div
          className="absolute left-0 right-0 max-h-60 overflow-auto 
                     border bg-white shadow-lg z-20 text-[11px] w-[600px]"
        >
          <table className="w-full border-collapse">
            <thead className="bg-gray-100 sticky top-0">
              <tr className="text-left text-[10px]">
                <th className="border px-1">Name</th>
                <th className="border px-1">Pack Size</th>
                <th className="border px-1">Pack Purchase</th>
                <th className="border px-1">Pack Sale</th>
                <th className="border px-1">Supplier</th>
                <th className="border px-1">Brand</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, idx) => (
                <tr
                  key={p.id}
                  onClick={() => handleSelect(p)}
                  className={`cursor-pointer ${
                    idx === highlightIndex ? "bg-blue-100" : ""
                  }`}
                >
                  <td className="border px-1">{p.name}</td>
                  <td className="border px-1">{p.pack_size}</td>
                  <td className="border px-1">{p.pack_purchase_price}</td>
                  <td className="border px-1">{p.pack_sale_price}</td>
                  <td className="border px-1">{p.supplier?.name || "-"}</td>
                  <td className="border px-1">{p.brand?.name || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
