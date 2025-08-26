// resources/js/components/BatchSearchInput.jsx
import React, {
  useState,
  useEffect,
  useRef,
  forwardRef,
  useImperativeHandle,
} from "react";

const BatchSearchInput = forwardRef(
  ({ value, onChange, batches, usedBatches = [], onKeyDown }, ref) => {
    const [query, setQuery] = useState("");
    const [showDropdown, setShowDropdown] = useState(false);
    const [highlightIndex, setHighlightIndex] = useState(0);
    const wrapperRef = useRef(null);
    const inputRef = useRef(null);

    // ✅ Expose API to parent
    useImperativeHandle(ref, () => ({
      focus: () => inputRef.current?.focus(),
      openMenu: () => setShowDropdown(true),
      closeMenu: () => setShowDropdown(false),
    }));

    // Close dropdown on outside click
    useEffect(() => {
      function handleClickOutside(event) {
        if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
          setShowDropdown(false);
        }
      }
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Update query if value changes externally
    useEffect(() => {
      if (value) setQuery(value);
    }, [value]);

    // Filter batches by query + exclude already used
    const filtered = batches
      .filter((b) => !usedBatches.includes(b.batch_number))
      .filter((b) =>
        b.batch_number.toLowerCase().includes(query.toLowerCase())
      );

    const handleSelect = (batch) => {
      setQuery(batch.batch_number);
      onChange(batch.batch_number);
      setShowDropdown(false);
    };

    // Keyboard navigation
    const handleKeyDown = (e) => {
      if (!showDropdown) {
        if (e.key === "Enter") {
          e.preventDefault();
          if (onChange) onChange(value);
        }
        if (onKeyDown) onKeyDown(e);
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

      if (onKeyDown) onKeyDown(e);
    };

    return (
      <div ref={wrapperRef} className="relative w-full">
        <input
          ref={inputRef}
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
          placeholder="Search batch..."
        />
        {showDropdown && filtered.length > 0 && (
          <div
            className="absolute left-0 right-0 max-h-40 overflow-auto 
                       border bg-white shadow-lg z-20 text-[11px]"
          >
            <ul>
              {filtered.map((b, idx) => (
                <li
                  key={b.batch_number}
                  onClick={() => handleSelect(b)}
                  className={`px-2 py-1 cursor-pointer ${
                    idx === highlightIndex ? "bg-blue-100" : ""
                  }`}
                >
                  {b.batch_number}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }
);

BatchSearchInput.displayName = "BatchSearchInput";
export default BatchSearchInput;
