import React, {
  useState,
  useEffect,
  useRef,
  forwardRef,
  useImperativeHandle,
  useMemo,
} from "react";
import { createPortal } from "react-dom";

const ProductSearchInput = forwardRef(
  ({ value, onChange, products, onRefreshProducts, onKeyDown: onKeyDownProp }, ref) => {
    const [query, setQuery] = useState("");
    const [showDropdown, setShowDropdown] = useState(false);
    const [highlightIndex, setHighlightIndex] = useState(0);

    const wrapperRef = useRef(null);
    const inputRef = useRef(null);
    const dropdownRef = useRef(null);

    const didRefreshRef = useRef(false);
    const debounceRef = useRef(null);

    // === NEW: portal position state (keeps menu above sticky footer) ===
    const [menuPos, setMenuPos] = useState(null); // {left, top, width}

    const items = useMemo(() => {
      if (Array.isArray(products)) return products;
      if (products && Array.isArray(products.data)) return products.data;
      return [];
    }, [products]);

    // Reset highlight if list shrinks
    useEffect(() => {
      if (highlightIndex >= items.length) setHighlightIndex(0);
    }, [items, highlightIndex]);

    // Refresh when opening (once per open)
    useEffect(() => {
      if (showDropdown && onRefreshProducts && !didRefreshRef.current) {
        didRefreshRef.current = true;
        Promise.resolve(onRefreshProducts(query)).catch(() => {});
      }
      if (!showDropdown) didRefreshRef.current = false;
    }, [showDropdown, onRefreshProducts, query]);

    // Listen to product:created events
    useEffect(() => {
      const handleProductCreated = () => {
        if (onRefreshProducts) onRefreshProducts(query);
      };
      window.addEventListener("product:created", handleProductCreated);
      return () => window.removeEventListener("product:created", handleProductCreated);
    }, [onRefreshProducts, query]);

    // Expose methods
    useImperativeHandle(ref, () => ({
      focus: () => inputRef.current?.focus(),
      refresh: () => onRefreshProducts?.(query),
      openMenu: () => setShowDropdown(true),
      closeMenu: () => setShowDropdown(false),
    }));

    // Close on outside click
    useEffect(() => {
      function handleClickOutside(e) {
        if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
          setShowDropdown(false);
        }
      }
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // === UPDATED: Sync query to selected value (id OR object) ===
    useEffect(() => {
      if (!value) return;
      if (typeof value === "object") {
        setQuery(value?.name || "");
        return;
      }
      const selected = items.find((p) => p?.id === value);
      if (selected) setQuery(selected.name || "");
    }, [value, items]);

    // Local filter (fallback if remote not used)
    const filtered = useMemo(() => {
      const q = (query || "").toLowerCase().trim();
      if (!q) return items;
      return items.filter((p) => (p?.name || "").toLowerCase().includes(q));
    }, [items, query]);

    const handleSelect = (product) => {
      setQuery(product?.name || "");
      onChange?.(product);
      setShowDropdown(false);
    };

    // Scroll highlighted row into view
    useEffect(() => {
      if (!showDropdown) return;
      const rows = dropdownRef.current?.querySelectorAll("tbody tr");
      if (!rows || rows.length === 0) return;
      const el = rows[highlightIndex];
      if (el) el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }, [highlightIndex, showDropdown, filtered.length]);

    const internalKeyDown = (e) => {
      if (!showDropdown) {
        if (e.key === "Enter") {
          e.preventDefault();
          // Let parent decide field navigation; we do not select here
        }
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightIndex((prev) => (prev < filtered.length - 1 ? prev + 1 : prev));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightIndex((prev) => (prev > 0 ? prev - 1 : 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filtered[highlightIndex]) handleSelect(filtered[highlightIndex]);
      } else if (e.key === "Escape") {
        e.preventDefault();
        setShowDropdown(false);
      }
    };

    // Debounce remote typeahead
    useEffect(() => {
      if (!onRefreshProducts) return;
      if (!showDropdown) return;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onRefreshProducts(query);
      }, 200);
      return () => clearTimeout(debounceRef.current);
    }, [query, onRefreshProducts, showDropdown]);

    // Fallback getters
    const getPackSize = (p) => p?.pack_size ?? p?.packSize ?? p?.packsize ?? "";
    const getSupplierName = (p) => p?.supplier?.name || p?.supplier_name || "-";
    const getBrandName = (p) => p?.brand?.name || p?.brand_name || "-";
    const getMargin = (p) => p?.margin ?? p?.margin_percentage ?? p?.marginPercent ?? "-";
    const getAvgPrice = (p) => p?.avg_price ?? p?.average_price ?? p?.avgPrice ?? "-";

    // === NEW: compute portal position under the input ===
    const computeMenuPos = () => {
      const el = wrapperRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setMenuPos({
        left: rect.left + window.scrollX,
        top: rect.bottom + window.scrollY, // just under the input
        width: Math.max(rect.width, 800),  // keep your old w-[800px] behavior
      });
    };

    useEffect(() => {
      if (!showDropdown) return;
      computeMenuPos();
      const onScroll = () => computeMenuPos();
      const onResize = () => computeMenuPos();
      window.addEventListener("scroll", onScroll, true);
      window.addEventListener("resize", onResize);
      return () => {
        window.removeEventListener("scroll", onScroll, true);
        window.removeEventListener("resize", onResize);
      };
    }, [showDropdown]);

    // Portal dropdown markup
    const dropdownNode =
      showDropdown && filtered.length > 0 && menuPos
        ? createPortal(
            <div
              ref={dropdownRef}
              style={{
                position: "absolute",
                left: `${menuPos.left}px`,
                top: `${menuPos.top}px`,
                width: `${menuPos.width}px`,
                zIndex: 9999, // stays above sticky footers
              }}
              className="max-h-60 overflow-auto border bg-white shadow-lg text-[11px]"
            >
              <table className="w-full border-collapse">
                <thead className="bg-gray-100 sticky top-0">
                  <tr className="text-left text-[10px]">
                    <th colSpan="3" className="border px-1 w-1/3">Name</th>
                    <th className="border px-1">Pack Size</th>
                    <th className="border px-1">Quantity</th>
                    <th className="border px-1">Pack Purchase</th>
                    <th className="border px-1">Pack Sale</th>
                    <th className="border px-1">Supplier</th>
                    <th className="border px-1">Brand</th>
                    <th className="border px-1">Margin %</th>
                    <th className="border px-1">Avg. Price</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p, idx) => (
                    <tr
                      key={p.id}
                      onClick={() => handleSelect(p)}
                      className={`cursor-pointer ${idx === highlightIndex ? "bg-blue-100" : ""}`}
                    >
                      <td colSpan="3" className="border px-1 w-1/3">{p?.name}</td>
                      <td className="border px-1">{getPackSize(p)}</td>
                      <td className="border px-1">{p?.quantity}</td>
                      <td className="border px-1">{p?.pack_purchase_price}</td>
                      <td className="border px-1">{p?.pack_sale_price}</td>
                      <td className="border px-1">{getSupplierName(p)}</td>
                      <td className="border px-1">{getBrandName(p)}</td>
                      <td className="border px-1">{getMargin(p)}</td>
                      <td className="border px-1">{getAvgPrice(p)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>,
            document.body
          )
        : null;

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
          onKeyDown={(e) => {
            internalKeyDown(e);
            if (!e.defaultPrevented) onKeyDownProp?.(e);
          }}
          className="border w-full h-6 text-[11px] px-1"
          placeholder="Search product..."
        />

        {/* Fallback absolute (kept for safety if portal not mounted yet) */}
        {showDropdown && filtered.length > 0 && !menuPos && (
          <div
            ref={dropdownRef}
            className="absolute left-0 right-0 max-h-60 overflow-auto 
                       border bg-white shadow-lg z-[9999] text-[11px] w-[800px]"
          >
            <table className="w-full border-collapse">
              <thead className="bg-gray-100 sticky top-0">
                <tr className="text-left text-[10px]">
                  <th colSpan="3" className="border px-1 w-1/3">Name</th>
                  <th className="border px-1">Pack Size</th>
                  <th className="border px-1">Quantity</th>
                  <th className="border px-1">Pack Purchase</th>
                  <th className="border px-1">Pack Sale</th>
                  <th className="border px-1">Supplier</th>
                  <th className="border px-1">Brand</th>
                  <th className="border px-1">Margin %</th>
                  <th className="border px-1">Avg. Price</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, idx) => (
                  <tr
                    key={p.id}
                    onClick={() => handleSelect(p)}
                    className={`cursor-pointer ${idx === highlightIndex ? "bg-blue-100" : ""}`}
                  >
                    <td colSpan="3" className="border px-1 w-1/3">{p?.name}</td>
                    <td className="border px-1">{getPackSize(p)}</td>
                    <td className="border px-1">{p?.quantity}</td>
                    <td className="border px-1">{p?.pack_purchase_price}</td>
                    <td className="border px-1">{p?.pack_sale_price}</td>
                    <td className="border px-1">{getSupplierName(p)}</td>
                    <td className="border px-1">{getBrandName(p)}</td>
                    <td className="border px-1">{getMargin(p)}</td>
                    <td className="border px-1">{getAvgPrice(p)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Portal menu */}
        {dropdownNode}
      </div>
    );
  }
);

ProductSearchInput.displayName = "ProductSearchInput";
export default ProductSearchInput;
