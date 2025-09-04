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
    // Displayed text in the small cell input
    const [display, setDisplay] = useState("");
    // Modal state
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [highlightIndex, setHighlightIndex] = useState(0);

    // Refs
    const triggerRef = useRef(null);
    const searchRef = useRef(null);
    const tableRef = useRef(null);

    const didRefreshRef = useRef(false);
    const debounceRef = useRef(null);

    // Normalize products => array
    const items = useMemo(() => {
      if (Array.isArray(products)) return products;
      if (products && Array.isArray(products.data)) return products.data;
      return [];
    }, [products]);

    // Keep highlight in bounds when list changes
    useEffect(() => {
      if (highlightIndex >= items.length) setHighlightIndex(0);
    }, [items.length, highlightIndex]);

    // Sync display from value (works for id OR object)
    useEffect(() => {
      if (!value) {
        setDisplay("");
        return;
      }
      if (typeof value === "object") {
        setDisplay(value?.name || "");
        return;
      }
      const selected = items.find((p) => p?.id === value);
      if (selected) setDisplay(selected.name || "");
    }, [value, items]);

    // Expose methods to parent
    useImperativeHandle(ref, () => ({
      focus: () => triggerRef.current?.focus(),
      refresh: () => onRefreshProducts?.(search),
      openMenu: () => openModal(),
      closeMenu: () => closeModal(),
    }));

    // Open/Close helpers
    const openModal = (seedChar) => {
      setIsOpen(true);
      setHighlightIndex(0);
      // Start with current display (easy refinement) or seed first typed char
      setSearch(
        typeof seedChar === "string" && seedChar.length === 1
          ? seedChar
          : (display || "")
      );
    };
    const closeModal = () => setIsOpen(false);

    // Lock page scroll while modal open
    useEffect(() => {
      if (!isOpen) return;
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }, [isOpen]);

    // Autofocus search input on open
    useEffect(() => {
      if (isOpen) {
        // small delay to ensure portal is attached
        setTimeout(() => searchRef.current?.focus(), 0);
      }
    }, [isOpen]);

    // Refresh once per open
    useEffect(() => {
      if (isOpen && onRefreshProducts && !didRefreshRef.current) {
        didRefreshRef.current = true;
        Promise.resolve(onRefreshProducts(search)).catch(() => {});
      }
      if (!isOpen) didRefreshRef.current = false;
    }, [isOpen, onRefreshProducts, search]);

    // Listen to "product:created" to refresh list
    useEffect(() => {
      const handler = () => onRefreshProducts?.(search);
      window.addEventListener("product:created", handler);
      return () => window.removeEventListener("product:created", handler);
    }, [onRefreshProducts, search]);

    // Debounce remote typeahead while modal is open
    useEffect(() => {
      if (!onRefreshProducts || !isOpen) return;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => onRefreshProducts(search), 200);
      return () => clearTimeout(debounceRef.current);
    }, [search, onRefreshProducts, isOpen]);

    // Local filter (fallback if remote not used)
    const filtered = useMemo(() => {
      const q = (search || "").toLowerCase().trim();
      if (!q) return items;
      return items.filter((p) => (p?.name || "").toLowerCase().includes(q));
    }, [items, search]);

    // Helpers for columns
    const getPackSize = (p) => p?.pack_size ?? p?.packSize ?? p?.packsize ?? "";
    const getSupplierName = (p) => p?.supplier?.name || p?.supplier_name || "-";
    const getBrandName = (p) => p?.brand?.name || p?.brand_name || "-";
    const getMargin = (p) => p?.margin ?? p?.margin_percentage ?? p?.marginPercent ?? "-";
    const getAvgPrice = (p) => p?.avg_price ?? p?.average_price ?? p?.avgPrice ?? "-";

    // Select handler
    const handleSelect = (product) => {
      setDisplay(product?.name || "");
      onChange?.(product);     // parent will navigate to next field
      closeModal();
    };

    // Keep highlighted row visible
    useEffect(() => {
      if (!isOpen) return;
      const rows = tableRef.current?.querySelectorAll("tbody tr");
      if (!rows || rows.length === 0) return;
      const el = rows[highlightIndex];
      if (el) el.scrollIntoView({ block: "nearest" });
    }, [highlightIndex, isOpen, filtered.length]);

    // Keyboard inside modal
    const handleModalKeyDown = (e) => {
      if (!isOpen) return;
      if (e.key === "Escape") {
        e.preventDefault();
        closeModal();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightIndex((i) => (i < filtered.length - 1 ? i + 1 : i));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightIndex((i) => (i > 0 ? i - 1 : 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filtered[highlightIndex]) handleSelect(filtered[highlightIndex]);
      }
    };

    return (
      <>
        {/* Trigger (small cell input) */}
        <input
          ref={triggerRef}
          type="text"
          value={display}
          readOnly
          placeholder="Search product…"
          className="border w-full h-6 text-[11px] px-1 cursor-text"
          onFocus={() => openModal()}
          onClick={() => openModal()}
          onKeyDown={(e) => {
            // If user starts typing, open modal and seed the first character
            if (
              !e.ctrlKey &&
              !e.metaKey &&
              !e.altKey &&
              e.key.length === 1
            ) {
              e.preventDefault();
              openModal(e.key);
              return;
            }
            if (e.key === "Enter" || e.key === "ArrowDown") {
              e.preventDefault();
              openModal();
              return;
            }
            // Allow parent to handle arrows/enter when modal isn't opening
            onKeyDownProp?.(e);
          }}
        />

        {/* Modal */}
        {isOpen &&
          createPortal(
            <div
              className="fixed inset-0 z-[10000] flex items-center justify-center"
              onKeyDown={handleModalKeyDown}
            >
              {/* Backdrop */}
              <div
                className="absolute inset-0 bg-black/40"
                onClick={closeModal}
              />
              {/* Dialog */}
              <div className="relative bg-white w-[92vw] max-w-5xl rounded-xl shadow-2xl border">
                {/* Header */}
                <div className="px-4 py-3 border-b flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Select Product</h3>
                  <button
                    type="button"
                    onClick={closeModal}
                    className="text-xs px-2 py-1 rounded hover:bg-gray-100"
                    aria-label="Close"
                  >
                    ✕
                  </button>
                </div>

                {/* Search */}
                <div className="p-3">
                  <input
                    ref={searchRef}
                    type="text"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setHighlightIndex(0);
                    }}
                    placeholder="Type to search… (Enter to select, Esc to close)"
                    className="border w-full h-8 text-sm px-2 rounded"
                  />
                </div>

                {/* Results */}
                <div className="px-3 pb-3">
                  <div className="border rounded overflow-hidden">
                    <div className="max-h-[60vh] overflow-auto">
                      <table ref={tableRef} className="w-full border-collapse text-[11px]">
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
                              className={`cursor-pointer ${
                                idx === highlightIndex ? "bg-blue-100" : ""
                              }`}
                              onMouseEnter={() => setHighlightIndex(idx)}
                            >
                              <td colSpan="3" className="border px-1 text-[15px] w-1/3">{p?.name}</td>
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
                          {filtered.length === 0 && (
                            <tr>
                              <td colSpan={11} className="text-center py-6 text-gray-500">
                                No products found
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Footer (tips) */}
                <div className="px-4 py-2 border-t text-[10px] text-gray-600">
                  ↑/↓ to navigate • Enter to select • Esc to close
                </div>
              </div>
            </div>,
            document.body
          )}
      </>
    );
  }
);

ProductSearchInput.displayName = "ProductSearchInput";
export default ProductSearchInput;
