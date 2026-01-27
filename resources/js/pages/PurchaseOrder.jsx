// src/pages/purchase-orders/forecast.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import AsyncSelect from "react-select/async";
import {
  ArrowPathIcon,
  PlayCircleIcon,
  PrinterIcon,
} from "@heroicons/react/24/solid";
import { usePermissions } from "@/api/usePermissions.js";
import { useTheme } from "@/context/ThemeContext.jsx";

// 🧊 glass primitives
import {
  GlassCard,
  GlassSectionHeader,
  GlassToolbar,
  GlassInput,
  GlassBtn,
} from "@/components/glass.jsx";

export default function PurchaseOrder() {
  const today = new Date().toISOString().split("T")[0];

  // 🔒 permissions (support both has() and canFor())
  const { loading: permsLoading, has, canFor } = usePermissions?.() || {};
  const canView =
    typeof has === "function"
      ? has("purchase-order.view")
      : typeof canFor === "function"
      ? !!canFor("purchase-order")?.view
      : true;
  const canGenerate =
    typeof has === "function"
      ? has("purchase-order.generate")
      : typeof canFor === "function"
      ? !!canFor("purchase-order")?.create
      : true;

  // Get dark mode state
  const { isDark } = useTheme();

  const tintSlate  = "bg-slate-900/80 text-white shadow-[0_6px_20px_-6px_rgba(15,23,42,0.45)] ring-1 ring-white/15 hover:bg-slate-900/90";
  const tintGlass  = "bg-white/60 text-slate-700 ring-1 ring-white/30 hover:bg-white/75";
  const tintGreen  = "bg-emerald-500/85 text-white ring-1 ring-white/20 hover:bg-emerald-500/95";
  const tintBlue   = "bg-blue-500/85 text-white ring-1 ring-white/20 hover:bg-blue-500/95";

  // Dark mode button variants
  const tintSlateDark  = "bg-slate-700/90 text-slate-200 shadow-[0_6px_20px_-6px_rgba(15,23,42,0.45)] ring-1 ring-slate-600/50 hover:bg-slate-700";
  const tintGlassDark  = "bg-slate-800/60 text-slate-300 ring-1 ring-slate-700/50 hover:bg-slate-800";
  const tintGreenDark  = "bg-emerald-600/85 text-white ring-1 ring-slate-600/50 hover:bg-emerald-600";
  const tintBlueDark   = "bg-blue-600/85 text-white ring-1 ring-slate-600/50 hover:bg-blue-600";

  // Dark mode glass button
  const glassBtnDark = "bg-slate-800/80 text-slate-200 ring-1 ring-slate-700/60 hover:bg-slate-700/80 backdrop-blur-sm";

  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [projectedDays, setProjectedDays] = useState(7);

  const [safetyPacks, setSafetyPacks] = useState(1); // knob (packs)
  const [moqPacks, setMoqPacks] = useState(0);       // knob (packs)

  const [supplier, setSupplier] = useState(null);
  const [brand, setBrand] = useState(null);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  // === keyboard navigation state/refs ===
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const tableWrapRef = useRef(null);
  const inputRefs = useRef({}); // {rowId: HTMLInputElement}
  const rowRefs = useRef({});   // {rowId: HTMLTableRowElement}

  const printBtnRef = useRef(null);

  // Alt+P: print
  useEffect(() => {
    const onKey = (e) => {
      if (!e.altKey) return;
      const key = (e.key || "").toLowerCase();
      if (key !== "p") return;
      e.preventDefault();
      doPrint();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rows, canView]);

  const doPrint = () => {
    if (!canView) return toast.error("You don't have permission to view/print.");
    if (!rows.length) return toast.error("Nothing to print.");
    window.print();
  };

  const fmt2 = (v) => Number(v ?? 0).toFixed(2);

  const handleFetch = async () => {
    if (!canGenerate) return toast.error("You don't have permission to generate.");
    if (!dateFrom || !dateTo) return toast.error("Please select both dates.");
    if (!projectedDays || projectedDays <= 0) return toast.error("Projected Days must be at least 1.");

    setLoading(true);
    try {
      const params = {
        date_from: dateFrom,
        date_to: dateTo,
        projected_days: projectedDays,
        safety_packs: safetyPacks,
        moq_packs: moqPacks,
      };
      if (supplier) params.supplier_id = supplier.value;
      if (brand) params.brand_id = brand.value;

      const { data } = await axios.get("/api/purchase-orders/forecast", { params });

      const mapped = (data.items || []).map((r, idx) => {
        const order_packs = r.suggested_packs ?? 0;
        const order_units = order_packs * (r.pack_size ?? 1);
        const order_amount = order_packs * (r.pack_price ?? 0);
        return { ...r, order_packs, order_units, order_amount, _rowId: `${r.product_id}-${idx}` };
      });

      setRows(mapped);
      // select first row for quick keyboard flow
      setSelectedIndex(mapped.length ? 0 : -1);
      toast.success("Forecast ready.");
    } catch (err) {
      console.error(err);
      toast.error("Failed to load forecast.");
    } finally {
      setLoading(false);
    }
  };

  // Remove products with NO pack purchase price (<= 0 or null)
  const pruneNoPackPrice = () => {
    if (!rows.length) return;
    const before = rows.length;
    const kept = rows.filter((r) => Number(r.pack_purchase_price || 0) > 0);
    const removed = before - kept.length;
    setRows(kept);
    setSelectedIndex((i) => {
      const newLen = kept.length;
      if (newLen === 0) return -1;
      return Math.min(i, newLen - 1);
    });
    toast[removed > 0 ? "success" : "custom"](
      removed > 0 ? `Removed ${removed} item(s) without pack purchase price.` : "No rows without pack purchase price."
    );
  };

  const totals = useMemo(() => {
    let packs = 0, units = 0, amount = 0;
    for (const r of rows) {
      packs  += Number(r.order_packs || 0);
      units  += Number(r.order_units || 0);
      amount += Number(r.order_amount || 0);
    }
    return { packs, units, amount };
  }, [rows]);

  const updateOrderPacks = (rowId, value) => {
    setRows((prev) =>
      prev.map((r, idx) => {
        if (r._rowId !== rowId) return r;
        const v = Math.max(0, parseInt(value || 0, 10));
        const units = v * (r.pack_size ?? 1);
        const amt   = v * (r.pack_price ?? 0);
        return { ...r, order_packs: v, order_units: units, order_amount: amt };
      })
    );
  };

  // =============== Async server-side search (prefix only) ===============
  const makeLoadOptions = (endpoint) => {
    let timeoutId = null;
    let lastReject = null;

    return (inputValue, callback) => {
      if (lastReject) {
        lastReject("Aborted");
        lastReject = null;
      }
      if (timeoutId) clearTimeout(timeoutId);

      const query = (inputValue || "").trim();
      if (!query) {
        callback([]);
        return;
      }

      timeoutId = setTimeout(async () => {
        try {
          const controller = new AbortController();
          lastReject = controller.abort.bind(controller);
          const { data } = await axios.get(endpoint, {
            signal: controller.signal,
            params: { q: query, mode: "prefix", limit: 30 },
          });

          const list = Array.isArray(data) ? data : (data?.data || []);
          const options = list.map((x) => ({ value: x.id, label: x.name }));
          callback(options);
        } catch (e) {
          if (axios.isCancel?.(e)) return;
          console.warn(e);
          callback([]);
        } finally {
          lastReject = null;
        }
      }, 250);
    };
  };

  const loadSupplierOptions = makeLoadOptions("/api/suppliers/search");
  const loadBrandOptions    = makeLoadOptions("/api/brands/search");

  // Dynamic select styles based on dark mode
  const getSelectStyles = (isDarkMode = false) => ({
    control: (base) => ({
      ...base,
      minHeight: 32,
      height: 32,
      fontSize: 12,
      background: isDarkMode ? "rgba(51,65,85,0.7)" : "rgba(255,255,255,0.7)",
      backdropFilter: "blur(6px)",
      borderRadius: 10,
      borderColor: isDarkMode ? "rgba(71,85,105,0.8)" : "rgba(226,232,240,0.7)",
      boxShadow: isDarkMode ? "0 1px 2px rgba(0,0,0,0.2)" : "none",
      color: isDarkMode ? "#f1f5f9" : "#111827",
    }),
    valueContainer: (base) => ({ ...base, height: 32, padding: "0 8px" }),
    indicatorsContainer: (base) => ({ ...base, height: 32 }),
    input: (base) => ({ ...base, margin: 0, padding: 0, color: isDarkMode ? "#f1f5f9" : "#111827" }),
    singleValue: (base) => ({ ...base, color: isDarkMode ? "#f1f5f9" : "#111827" }),
    placeholder: (base) => ({ ...base, color: isDarkMode ? "#64748b" : "#9ca3af" }),
    menu: (base) => ({ 
      ...base, 
      fontSize: 12, 
      borderRadius: 10, 
      overflow: "hidden",
      backgroundColor: isDarkMode ? "rgba(30,41,59,0.95)" : "rgba(255,255,255,0.95)",
      backdropFilter: "blur(10px)",
      boxShadow: isDarkMode ? "0 10px 30px -10px rgba(0,0,0,0.4)" : "0 10px 30px -10px rgba(30,64,175,0.18)",
      border: isDarkMode ? "1px solid rgba(71,85,105,0.5)" : "none",
    }),
    option: (base, state) => ({ 
      ...base, 
      fontSize: 12,
      backgroundColor: isDarkMode
        ? state.isFocused
          ? "rgba(71,85,105,1)"
          : "rgba(51,65,85,1)"
        : state.isFocused
          ? "rgba(241,245,249,1)"
          : "rgba(255,255,255,1)",
      color: isDarkMode ? "#f1f5f9" : "#111827",
      cursor: "pointer",
    }),
    menuPortal: (base) => ({ ...base, zIndex: 9999 }),
  });

  // === keyboard navigation handlers ===
  // focus active row's input and ensure visibility
  useEffect(() => {
    if (selectedIndex < 0 || selectedIndex >= rows.length) return;
    const row = rows[selectedIndex];
    const inputEl = inputRefs.current[row._rowId];
    const trEl = rowRefs.current[row._rowId];

    if (trEl && tableWrapRef.current) {
      const wrap = tableWrapRef.current;
      const trBox = trEl.getBoundingClientRect();
      const wrapBox = wrap.getBoundingClientRect();
      // Scroll into view if row is outside viewport of wrapper
      if (trBox.top < wrapBox.top + 40 || trBox.bottom > wrapBox.bottom - 40) {
        trEl.scrollIntoView({ block: "nearest" });
      }
    }
    if (inputEl) {
      requestAnimationFrame(() => {
        inputEl.focus();
        inputEl.select();
      });
    }
  }, [selectedIndex, rows]);

  const onKeyDownTable = (e) => {
    // ignore when user is typing in a text input other than our table wrapper
    const tag = (e.target?.tagName || "").toLowerCase();
    const isInput = tag === "input" || tag === "textarea";
    const isNumberField = isInput && e.target.type === "number";
    // We still want Up/Down to navigate when inside our number inputs:
    const key = e.key;
    if (key === "ArrowDown" || key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((idx) => {
        const next =
          key === "ArrowDown"
            ? Math.min((idx < 0 ? -1 : idx) + 1, rows.length - 1)
            : Math.max((idx < 0 ? 0 : idx) - 1, 0);
        return next;
      });
    }
  };

  if (permsLoading) return <div className={`p-6 ${isDark ? "text-slate-400" : ""}`}>Loading…</div>;
  if (!canView) return <div className={`p-6 text-sm ${isDark ? "text-slate-400" : "text-gray-700"}`}>You don't have permission to view Purchase Order (Forecast).</div>;

  return (
    <div className={`p-4 md:p-6 space-y-4 print:p-0 ${isDark ? "bg-slate-900" : "bg-gray-50"}`} onKeyDown={onKeyDownTable}>
      {/* ===== Header ===== */}
      <GlassCard className={isDark ? "bg-slate-800/80 border-slate-700" : ""}>
        <GlassSectionHeader
          title={
            <span className={`inline-flex items-center gap-2 ${isDark ? "text-slate-200" : "text-gray-800"}`}>
              <span className="w-2 h-2 rounded-full bg-blue-600" />
              <span>Purchase Order (Forecast)</span>
            </span>
          }
          right={
            <div className="flex items-center gap-2 flex-wrap">
              <GlassBtn
                className={`h-9 px-3 text-sm ${isDark ? tintSlateDark : tintSlate}`}
                onClick={() => window.location.reload()}
                title="Refresh"
                aria-label="Refresh page"
              >
                <span className="inline-flex items-center gap-2">
                  <ArrowPathIcon className="w-4 h-4" />
                  Refresh
                </span>
              </GlassBtn>

              <GlassBtn
                ref={printBtnRef}
                onClick={doPrint}
                className={`h-9 px-3 text-sm ${isDark ? glassBtnDark : tintGlass}`}
                title="Print (Alt+P)"
              >
                <span className="inline-flex items-center gap-2">
                  <PrinterIcon className="w-4 h-4" />
                  Print
                </span>
              </GlassBtn>
            </div>
          }
        />

        {/* Filters */}
        <GlassToolbar className={`grid grid-cols-1 md:grid-cols-9 gap-2 ${isDark ? "bg-slate-800/50" : ""}`}>
          <div className="flex flex-col gap-0.5">
            <label className={`text-xs ${isDark ? "text-slate-400" : "text-gray-700"}`}>From</label>
            <GlassInput type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={`w-full h-8 text-xs ${isDark ? "bg-slate-700 border-slate-600 text-slate-200" : ""}`} />
          </div>
          <div className="flex flex-col gap-0.5">
            <label className={`text-xs ${isDark ? "text-slate-400" : "text-gray-700"}`}>To</label>
            <GlassInput type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={`w-full h-8 text-xs ${isDark ? "bg-slate-700 border-slate-600 text-slate-200" : ""}`} />
          </div>
          <div className="flex flex-col gap-0.5">
            <label className={`text-xs ${isDark ? "text-slate-400" : "text-gray-700"}`}>Projected Days</label>
            <GlassInput
              type="number"
              min={1}
              value={projectedDays}
              onChange={(e) => setProjectedDays(parseInt(e.target.value || 0, 10))}
              className={`w-full h-8 text-xs ${isDark ? "bg-slate-700 border-slate-600 text-slate-200" : ""}`}
            />
          </div>

          <div className="flex flex-col gap-0.5">
            <label className={`text-xs ${isDark ? "text-slate-400" : "text-gray-700"}`}>Safety Stock (packs)</label>
            <GlassInput
              type="number"
              min={0}
              value={safetyPacks}
              onChange={(e)=>setSafetyPacks(parseInt(e.target.value || 0, 10))}
              className={`w-full h-8 text-xs ${isDark ? "bg-slate-700 border-slate-600 text-slate-200" : ""}`}
            />
          </div>

          <div className="flex flex-col gap-0.5">
            <label className={`text-xs ${isDark ? "text-slate-400" : "text-gray-700"}`}>MOQ (packs)</label>
            <GlassInput
              type="number"
              min={0}
              value={moqPacks}
              onChange={(e)=>setMoqPacks(parseInt(e.target.value || 0, 10))}
              className={`w-full h-8 text-xs ${isDark ? "bg-slate-700 border-slate-600 text-slate-200" : ""}`}
            />
          </div>

          <div className="flex flex-col gap-0.5">
            <label className={`text-xs ${isDark ? "text-slate-400" : "text-gray-700"}`}>Supplier (server)</label>
            <AsyncSelect
              cacheOptions={false}
              defaultOptions={[]}
              loadOptions={loadSupplierOptions}
              styles={getSelectStyles(isDark)}
              value={supplier}
              onChange={setSupplier}
              placeholder="Type to search…"
              isClearable
              filterOption={() => true}
              menuPortalTarget={typeof document !== "undefined" ? document.body : null}
              menuPosition="fixed"
              classNamePrefix="rs"
            />
          </div>

          <div className="flex flex-col gap-0.5">
            <label className={`text-xs ${isDark ? "text-slate-400" : "text-gray-700"}`}>Brand (server)</label>
            <AsyncSelect
              cacheOptions={false}
              defaultOptions={[]}
              loadOptions={loadBrandOptions}
              styles={getSelectStyles(isDark)}
              value={brand}
              onChange={setBrand}
              placeholder="Type to search…"
              isClearable
              filterOption={() => true}
              menuPortalTarget={typeof document !== "undefined" ? document.body : null}
              menuPosition="fixed"
              classNamePrefix="rs"
            />
          </div>

          <div className="flex items-end gap-2 col-span-1 md:col-span-2">
            <GlassBtn
              onClick={handleFetch}
              disabled={loading || !canGenerate}
              className={`h-9 px-3 text-sm ${canGenerate ? (isDark ? tintGreenDark : tintGreen) : (isDark ? glassBtnDark : tintGlass)} ${!canGenerate ? "opacity-60 cursor-not-allowed" : ""}`}
              title={!canGenerate ? "Not permitted" : "Generate forecast"}
            >
              <span className="inline-flex items-center gap-2">
                <PlayCircleIcon className="w-4 h-4" />
                {loading ? "Loading…" : "Generate"}
              </span>
            </GlassBtn>

            <GlassBtn
              onClick={pruneNoPackPrice}
              disabled={!rows.length}
              className={`h-9 px-3 text-sm ${rows.length ? (isDark ? tintBlueDark : tintBlue) : (isDark ? glassBtnDark : tintGlass)}`}
              title="Remove products with no Pack Purchase Price"
            >
              Remove&nbsp;Zero
            </GlassBtn>
          </div>
        </GlassToolbar>
      </GlassCard>

      {/* ===== Table (bordered + keyboard nav) ===== */}
      <GlassCard className={isDark ? "bg-slate-800/80 border-slate-700" : ""}>
        <div
          ref={tableWrapRef}
          className={`max-h-[75vh] overflow-auto rounded-b-2xl outline-none ${isDark ? "bg-slate-800" : "bg-white"}`}
          tabIndex={0} // allow wrapper to receive keydown even if inputs not focused
        >
          <table className={`min-w-[880px] w-full text-[12px] border border-collapse ${isDark ? "border-slate-700 text-slate-200" : "border-slate-200/80 text-gray-900"}`}>
            <thead className={`sticky top-0 z-10 ${isDark ? "bg-slate-700/95 backdrop-blur-sm" : "bg-white/95 backdrop-blur-sm"}`}>
              <tr className="text-left">
                {["#", "Product", "Pack Size", "Units Sold", "Stock (U)", "Pack Price", "Suggested (P)", "Order Packs", "Order Units", "Order Amount"]
                  .map((h, i) => (
                  <th
                    key={h}
                   className={[
                      "px-2 py-1 font-medium border-b",
                      i === 0 ? "w-8" : "",
                      [2,3,4,5,6,7,8,9].includes(i) ? "text-right" : "",
                      h === "Stock (U)" ? (isDark ? "bg-rose-600 text-white font-bold" : "bg-red-500 text-white font-bold") : ""
                    ].join(" ")}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {rows.map((r, idx) => {
                const isActive = idx === selectedIndex;
                return (
                  <tr
                    key={r._rowId}
                    ref={(el) => (rowRefs.current[r._rowId] = el)}
                    onClick={() => setSelectedIndex(idx)}
                    className={[
                      "transition-colors border-t",
                      idx % 2 
                        ? (isDark ? "bg-slate-800/80" : "bg-white/80") 
                        : (isDark ? "bg-slate-800/60" : "bg-white/60"),
                      isActive ? (isDark ? "bg-blue-900/50 ring-2 ring-blue-600/60" : "bg-blue-50 ring-2 ring-blue-300/60") : (isDark ? "hover:bg-slate-700" : "hover:bg-blue-50")
                    ].join(" ")}
                  >
                    <td className="px-2 py-1">{idx + 1}</td>
                    <td className="px-2 py-1">
                      <div className="font-medium truncate max-w-[320px]" title={r.product_name}>{r.product_name}</div>
                      {r.product_code && <div className={`text-[10px] ${isDark ? "text-slate-500" : "text-gray-500"}`}>{r.product_code}</div>}
                    </td>
                    <td className={`px-2 py-1 text-right tabular-nums whitespace-nowrap border-l ${isDark ? "border-slate-700" : "border-slate-200/60"}`}>{r.pack_size}</td>
                    <td className="px-2 py-1 text-right tabular-nums whitespace-nowrap">{r.units_sold}</td>
                    <td className={`px-2 py-1 text-center tabular-nums whitespace-nowrap font-bold ${isDark ? "bg-rose-600 text-white" : "bg-red-500 text-white"}`}>{r.current_stock_units}</td>
                    <td className="px-2 py-1 text-right tabular-nums whitespace-nowrap">{fmt2(r.pack_price)}</td>
                    <td className="px-2 py-1 text-right tabular-nums whitespace-nowrap">{r.suggested_packs}</td>
                    <td className="px-2 py-1 text-right">
                      <GlassInput
                        type="number"
                        min={0}
                        value={r.order_packs}
                        onFocus={() => setSelectedIndex(idx)}
                        onChange={(e) => updateOrderPacks(r._rowId, e.target.value)}
                        ref={(el) => (inputRefs.current[r._rowId] = el)}
                        className={`w-16 h-7 font-bold text-right text-[12px] no-spinners ${isDark ? "text-rose-400 bg-slate-700 border-slate-600" : "text-red-500 bg-white border-gray-300"}`}
                        inputMode="numeric"
                      />
                    </td>
                    <td className="px-2 py-1 text-right tabular-nums whitespace-nowrap">{r.order_units}</td>
                    <td className="px-2 py-1 text-right tabular-nums whitespace-nowrap">{fmt2(r.order_amount)}</td>
                  </tr>
                );
              })}

              {!rows.length && (
                <tr>
                  <td colSpan={10} className={`px-3 py-10 text-center border-t ${isDark ? "text-slate-400 border-slate-700" : "text-gray-600 border-slate-200/80"}`}>
                    No data. Choose filters and click <b>Generate</b>.
                  </td>
                </tr>
              )}
            </tbody>

            {rows.length > 0 && (
              <tfoot>
                <tr className={`font-semibold ${isDark ? "bg-slate-700/90 backdrop-blur-sm border-t border-slate-600 text-slate-200" : "bg-white/90 backdrop-blur-sm border-t border-slate-200/80 text-gray-900"}`}>
                  <td className="px-2 py-1" colSpan={7}>Totals</td>
                  <td className="px-2 py-1 text-right tabular-nums">{totals.packs}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{totals.units}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{fmt2(totals.amount)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </GlassCard>

      {/* Print + number-input spinner removal */}
      <style>{`
        @media print {
          .print\\:p-0 { padding: 0 !important; }
          .rs__control, .rs__menu, input, select, button, [role="button"] { display: none !important; }
          table { font-size: 10px; }
          thead { position: sticky; top: 0; }
        }
        /* Remove spinners in number inputs (Chrome, Edge, Safari) */
        .no-spinners::-webkit-outer-spin-button,
        .no-spinners::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        /* Firefox */
        .no-spinners[type=number] { -moz-appearance: textfield; }
      `}</style>
    </div>
  );
}

