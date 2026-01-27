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
    const [display, setDisplay] = useState("");
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [highlightIndex, setHighlightIndex] = useState(0);
    const [isInvalidInput, setIsInvalidInput] = useState(false);

    const [windowPos, setWindowPos] = useState(() => {
      const saved = localStorage.getItem("productModalPos");
      if (saved) return JSON.parse(saved);

      // Default center
      const width = 1000;
      const height = 600;
      const x = (window.innerWidth - width) / 2;
      const y = (window.innerHeight - height) / 2;
      return { x, y };
    });


    const [windowSize, setWindowSize] = useState(() => {
      const saved = localStorage.getItem("productModalSize");
      return saved
        ? JSON.parse(saved)
        : { width: 900, height: 600 }; // default size
    });

    const triggerRef = useRef(null);
    const searchRef = useRef(null);
    const tableRef = useRef(null);
    const modalRef = useRef(null);

    const didRefreshRef = useRef(false);
    const debounceRef = useRef(null);
    const dragRef = useRef({ isDragging: false, offsetX: 0, offsetY: 0 });
    const resizeRef = useRef({ isResizing: false, startX: 0, startY: 0, startWidth: 0, startHeight: 0 });

    const items = useMemo(() => {
      if (Array.isArray(products)) return products;
      if (products && Array.isArray(products.data)) return products.data;
      return [];
    }, [products]);

    useEffect(() => {
      if (highlightIndex >= items.length) setHighlightIndex(0);
    }, [items.length, highlightIndex]);

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

    useImperativeHandle(ref, () => ({
      focus: () => triggerRef.current?.focus(),
      refresh: () => onRefreshProducts?.(search),
      openMenu: () => openModal(),
      closeMenu: () => closeModal(),
    }));

    const openModal = (seedChar) => {
      setIsOpen(true);
      setHighlightIndex(0);
      setSearch(
        typeof seedChar === "string" && seedChar.length === 1
          ? seedChar
          : (display || "")
      );
    };
    const closeModal = () => setIsOpen(false);

    useEffect(() => {
      if (!isOpen) return;
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => (document.body.style.overflow = prev);
    }, [isOpen]);

    useEffect(() => {
      if (isOpen) setTimeout(() => searchRef.current?.focus(), 0);
    }, [isOpen]);

    useEffect(() => {
      if (isOpen && onRefreshProducts && !didRefreshRef.current) {
        didRefreshRef.current = true;
        Promise.resolve(onRefreshProducts(search)).catch(() => {});
      }
      if (!isOpen) didRefreshRef.current = false;
    }, [isOpen, onRefreshProducts, search]);

    useEffect(() => {
      const handler = () => onRefreshProducts?.(search);
      window.addEventListener("product:created", handler);
      return () => window.removeEventListener("product:created", handler);
    }, [onRefreshProducts, search]);

    useEffect(() => {
      if (!onRefreshProducts || !isOpen) return;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => onRefreshProducts(search), 200);
      return () => clearTimeout(debounceRef.current);
    }, [search, onRefreshProducts, isOpen]);

    // Local filter
    const filtered = useMemo(() => {
      const q = (search || "").toLowerCase().trim();
      if (!q) return items;
      const starts = (val) => (val ?? "").toString().toLowerCase().startsWith(q);
      return items.filter(
        (p) => starts(p?.name) || starts(p?.product_code) || starts(p?.barcode)
      );
    }, [items, search]);

    // Infinite scroll
    useEffect(() => {
      const container = tableRef.current?.parentElement;
      if (!container) return;
      const handleScroll = () => {
        if (
          container.scrollTop + container.clientHeight >=
          container.scrollHeight - 50
        ) {
          onRefreshProducts?.(search);
        }
      };
      container.addEventListener("scroll", handleScroll);
      return () => container.removeEventListener("scroll", handleScroll);
    }, [onRefreshProducts, search]);

    const getPackSize = (p) => p?.pack_size ?? p?.packSize ?? p?.packsize ?? "";
    const getSupplierName = (p) => p?.supplier?.name || p?.supplier_name || "-";
    const getBrandName = (p) => p?.brand?.name || p?.brand_name || "-";
    const getMargin = (p) =>
      p?.margin ?? p?.margin_percentage ?? p?.marginPercent ?? "-";
    const getAvgPrice = (p) =>
      p?.avg_price ?? p?.average_price ?? p?.avgPrice ?? "-";

    const handleSelect = (product) => {
      setDisplay(product?.name || "");
      onChange?.(product);
      closeModal();
    };

    useEffect(() => {
      if (!isOpen) return;
      const rows = tableRef.current?.querySelectorAll("tbody tr");
      if (!rows || rows.length === 0) return;
      const el = rows[highlightIndex];
      if (el) el.scrollIntoView({ block: "nearest" });
    }, [highlightIndex, isOpen, filtered.length]);

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

    const handleSearchChange = (e) => {
      const val = e.target.value;
      const valid = /^[a-zA-Z0-9-.()/\s]*$/;
      if (!valid.test(val)) {
        setIsInvalidInput(true);
        setTimeout(() => setIsInvalidInput(false), 200);
        return;
      }
      setSearch(val);
      setHighlightIndex(0);
    };

    // --- Dragging Logic ---
    const startDrag = (e) => {
      if (!modalRef.current) return;
      dragRef.current = {
        isDragging: true,
        offsetX: e.clientX - windowPos.x,
        offsetY: e.clientY - windowPos.y,
      };
      document.addEventListener("mousemove", handleDrag);
      document.addEventListener("mouseup", stopDrag);
    };

    const handleDrag = (e) => {
      if (!dragRef.current.isDragging) return;
      setWindowPos({
        x: e.clientX - dragRef.current.offsetX,
        y: e.clientY - dragRef.current.offsetY,
      });
    };

    const stopDrag = () => {
      dragRef.current.isDragging = false;
      localStorage.setItem("productModalPos", JSON.stringify(windowPos));
      document.removeEventListener("mousemove", handleDrag);
      document.removeEventListener("mouseup", stopDrag);
    };

    // --- Resizing Logic ---
    const startResize = (e) => {
      resizeRef.current = {
        isResizing: true,
        startX: e.clientX,
        startY: e.clientY,
        startWidth: windowSize.width,
        startHeight: windowSize.height,
      };
      document.addEventListener("mousemove", handleResize);
      document.addEventListener("mouseup", stopResize);
    };

    const handleResize = (e) => {
      if (!resizeRef.current.isResizing) return;
      const newWidth = Math.max(600, resizeRef.current.startWidth + (e.clientX - resizeRef.current.startX));
      const newHeight = Math.max(400, resizeRef.current.startHeight + (e.clientY - resizeRef.current.startY));
      setWindowSize({ width: newWidth, height: newHeight });
    };

    const stopResize = () => {
      resizeRef.current.isResizing = false;
      localStorage.setItem("productModalSize", JSON.stringify(windowSize));
      document.removeEventListener("mousemove", handleResize);
      document.removeEventListener("mouseup", stopResize);
    };

    return (
      <>
        {/* Trigger Input */}
        <input
          ref={triggerRef}
          type="text"
          value={display}
          readOnly
          placeholder="Search product…"
          className="border w-full h-6 text-[11px] px-1 cursor-text rounded-lg bg-white dark:bg-slate-700 border-gray-200 dark:border-slate-600 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-400/40 dark:focus:ring-indigo-400/40"
          onFocus={() => openModal()}
          onClick={() => openModal()}
          onKeyDown={(e) => {
            if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.length === 1) {
              e.preventDefault();
              openModal(e.key);
              return;
            }
            if (e.key === "Enter" || e.key === "ArrowDown") {
              e.preventDefault();
              openModal();
              return;
            }
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
              <div className="absolute inset-0 bg-black/40" onClick={closeModal} />

              {/* Draggable + Resizable Dialog */}
              <div
                ref={modalRef}
                className="absolute bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-gray-200 dark:border-slate-600 flex flex-col"
                style={{
                  left: `${windowPos.x}px`,
                  top: `${windowPos.y}px`,
                  width: `${windowSize.width}px`,
                  height: `${windowSize.height}px`,
                  minWidth: "600px",
                  minHeight: "400px",
                }}
              >
                {/* Header (Draggable) */}
                <div
                  className="px-4 py-3 border-b flex items-center justify-between cursor-move bg-gray-50 dark:bg-slate-700 rounded-t-xl border-gray-200 dark:border-slate-600"
                  onMouseDown={startDrag}
                >
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Select Product</h3>
                  <button
                    type="button"
                    onClick={closeModal}
                    className="text-xs px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-slate-600 text-gray-900 dark:text-gray-100"
                  >
                    ✕
                  </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-hidden flex flex-col">
                  {/* Search */}
                  <div className="p-3">
                    <input
                      ref={searchRef}
                      type="text"
                      value={search}
                      onChange={handleSearchChange}
                      placeholder="Type to search… (Enter to select, Esc to close)"
                      className={`border w-full h-8 text-sm px-2 rounded-lg bg-white dark:bg-slate-700 border-gray-200 dark:border-slate-600 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-400/40 dark:focus:ring-indigo-400/40 ${
                        isInvalidInput ? "animate-shake border-red-400" : ""
                      }`}
                    />
                  </div>

                  {/* Results */}
                  <div className="px-3 pb-3 flex-1 overflow-auto">
                    <div className="border rounded overflow-hidden h-full border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800">
                      <div className="max-h-full overflow-auto">
                        <table ref={tableRef} className="w-full border-collapse text-[11px]">
                          <thead className="bg-gray-100 dark:bg-slate-700 sticky top-0">
                            <tr className="text-left text-[10px]">
                              <th colSpan="3" className="border px-1 w-1/3 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-slate-600">Name</th>
                              <th className="border px-1 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-slate-600">Pack Size</th>
                              <th className="border px-1 font-bold text-gray-900 dark:text-gray-100 border-gray-200 dark:border-slate-600">Quantity</th>
                              <th className="border px-1 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-slate-600">Pack Purchase</th>
                              <th className="border px-1 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-slate-600">Unit Purchase Price</th>
                              <th className="border px-1 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-slate-600">Pack Sale</th>
                              <th className="border px-1 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-slate-600">Unit Sale Price</th>
                              <th className="border px-1 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-slate-600">Supplier</th>
                              <th className="border px-1 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-slate-600">Brand</th>
                              <th className="border px-1 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-slate-600">Margin %</th>
                              <th className="border px-1 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-slate-600">Avg. Price</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filtered.map((p, idx) => (
                              <tr
                                key={p.id}
                                onClick={() => handleSelect(p)}
                                className={`cursor-pointer ${
                                  idx === highlightIndex
                                    ? "bg-green-600 text-white"
                                    : "odd:bg-white/90 even:bg-white/70 dark:odd:bg-slate-700/60 dark:even:bg-slate-800/60 hover:bg-gray-100 dark:hover:bg-slate-600"
                                }`}
                                onMouseEnter={() => setHighlightIndex(idx)}
                              >
                                <td colSpan="3" className="border px-1 text-[13px] w-1/3 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-slate-600">{p?.name}</td>
                                <td className="border px-1 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-slate-600">{getPackSize(p)}</td>
                                <td className="border px-1 font-bold text-gray-900 dark:text-gray-100 border-gray-200 dark:border-slate-600">{p?.quantity}</td>
                                <td className="border px-1 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-slate-600">{p?.pack_purchase_price}</td>
                                <td className="border px-1 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-slate-600">{p?.unit_purchase_price}</td>
                                <td className="border px-1 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-slate-600">{p?.pack_sale_price}</td>
                                <td className="border px-1 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-slate-600">{p?.unit_sale_price}</td>
                                <td className="border px-1 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-slate-600">{getSupplierName(p)}</td>
                                <td className="border px-1 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-slate-600">{getBrandName(p)}</td>
                                <td className="border px-1 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-slate-600">{getMargin(p)}</td>
                                <td className="border px-1 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-slate-600">{getAvgPrice(p)}</td>
                              </tr>
                            ))}
                            {filtered.length === 0 && (
                              <tr>
                                <td
                                  colSpan={13}
                                  className="text-center py-6 text-gray-500 dark:text-gray-400"
                                >
                                  No products found
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="px-4 py-2 border-t text-[10px] text-gray-600 dark:text-gray-400 border-gray-200 dark:border-slate-600">
                    ↑/↓ to navigate • Enter to select • Esc to close
                  </div>
                </div>

                {/* Resize Handle */}
                <div
                  onMouseDown={startResize}
                  className="absolute bottom-1 right-1 w-3 h-3 bg-gray-400 dark:bg-slate-500 cursor-se-resize rounded-sm"
                  title="Resize"
                />
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
