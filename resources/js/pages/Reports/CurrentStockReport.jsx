// resources/js/pages/Reports/CurrentStockReport.jsx
import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import AsyncSelect from "react-select/async";
import { createFilter } from "react-select";
import toast from "react-hot-toast";
import { usePermissions } from "@/api/usePermissions";
import { useTheme } from "@/context/ThemeContext";

// 🧊 glass primitives
import {
  GlassCard,
  GlassSectionHeader,
  GlassToolbar,
  GlassInput,
  GlassBtn,
} from "@/components/glass.jsx";

import { ArrowDownOnSquareIcon, ArrowPathIcon } from "@heroicons/react/24/solid";

/* ======================
   Helpers
   ====================== */

const n = (v) => (isFinite(Number(v)) ? Number(v) : 0);
const fmtCurrency = (v) =>
  n(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtNumber = (v) =>
  n(v).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });

/* react-select → glassy control */
const getSelectStyles = (isDarkMode = false) => ({
  control: (base) => ({
    ...base,
    minHeight: 36,
    height: 36,
    borderColor: isDarkMode ? "rgba(71,85,105,0.8)" : "rgba(229,231,235,0.8)",
    backgroundColor: isDarkMode ? "rgba(51,65,85,0.7)" : "rgba(255,255,255,0.7)",
    backdropFilter: "blur(6px)",
    boxShadow: isDarkMode ? "0 1px 2px rgba(0,0,0,0.2)" : "0 1px 2px rgba(15,23,42,0.06)",
    borderRadius: 12,
    transition: "all .2s ease",
    "&:hover": {
      borderColor: isDarkMode ? "rgba(100,116,139,0.9)" : "rgba(148,163,184,0.9)",
      backgroundColor: isDarkMode ? "rgba(51,65,85,0.85)" : "rgba(255,255,255,0.85)",
    },
  }),
  valueContainer: (base) => ({ ...base, height: 36, padding: "0 10px" }),
  indicatorsContainer: (base) => ({ ...base, height: 36 }),
  input: (base) => ({
    ...base,
    margin: 0,
    padding: 0,
    color: isDarkMode ? "#f1f5f9" : "#111827",
  }),
  menuPortal: (base) => ({ ...base, zIndex: 9999 }),
  menu: (base) => ({
    ...base,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: isDarkMode ? "rgba(30,41,59,0.95)" : "rgba(255,255,255,0.9)",
    backdropFilter: "blur(10px)",
    boxShadow: isDarkMode ? "0 10px 30px -10px rgba(0,0,0,0.4)" : "0 10px 30px -10px rgba(30,64,175,0.18)",
    border: isDarkMode ? "1px solid rgba(71,85,105,0.5)" : "none",
  }),
  option: (base, state) => ({
    ...base,
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
  singleValue: (base) => ({
    ...base,
    color: isDarkMode ? "#f1f5f9" : "#111827",
  }),
  placeholder: (base) => ({
    ...base,
    color: isDarkMode ? "#64748b" : "#9ca3af",
  }),
});

// helper to try /api/... then /...
async function tryEndpoints(paths, params) {
  let lastErr;
  for (const path of paths) {
    try {
      const res = await axios.get(path, { params, withCredentials: true });
      return res;
    } catch (e) {
      lastErr = e;
      // keep trying next path
    }
  }
  throw lastErr;
}

export default function CurrentStockReport() {
  // Filters
  const [categoryValue, setCategoryValue] = useState(null);
  const [categoryId, setCategoryId] = useState("");
  const [brandValue, setBrandValue] = useState(null);
  const [brandId, setBrandId] = useState("");
  const [supplierValue, setSupplierValue] = useState(null);
  const [supplierId, setSupplierId] = useState("");

  // Data + States
  const [data, setData] = useState({ rows: [], summary: {} });
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  const perms = usePermissions();
  const canView = perms?.has?.("report.current-stock.view");
  const canExport = perms?.has?.("report.current-stock.export");

  // Get dark mode state
  const { isDark } = useTheme();

  // tints
  const tintPrimary =
    "bg-slate-900/80 text-white ring-1 ring-white/15 shadow-[0_6px_20px_-6px_rgba(15,23,42,0.45)] hover:bg-slate-900/90";
  const tintGhost = isDark ? "bg-slate-800/60 text-slate-200 ring-1 ring-slate-700/50 hover:bg-slate-800/80" : "bg-white/60 text-slate-700 ring-1 ring-white/30 hover:bg-white/75";

  /* ============ Async loaders ============ */
  const loadCategories = useMemo(
    () => async (input) => {
      const q = String(input || "").trim();
      if (!q) return [{ value: "", label: "All Categories" }];
      try {
        const res = await tryEndpoints(
          ["/api/categories/search", "/categories/search"],
          { q, limit: 30 }
        );
        const rows = Array.isArray(res.data?.data)
          ? res.data.data
          : Array.isArray(res.data)
          ? res.data
          : [];
        return rows.map((r) => ({
          value: r.id,
          label: r.name ?? r.label ?? `#${r.id}`,
        }));
      } catch {
        toast.error("Category search failed");
        return [{ value: "", label: "No results" }];
      }
    },
    []
  );

  const loadBrands = useMemo(
    () => async (input) => {
      const q = String(input || "").trim();
      if (!q) return [{ value: "", label: "All Brands" }];
      try {
        const res = await tryEndpoints(
          ["/api/brands/search", "/brands/search"],
          { q, limit: 30 }
        );
        const rows = Array.isArray(res.data?.data)
          ? res.data.data
          : Array.isArray(res.data)
          ? res.data
          : [];
        return rows.map((r) => ({
          value: r.id,
          label: r.name ?? r.label ?? `#${r.id}`,
        }));
      } catch {
        toast.error("Brand search failed");
        return [{ value: "", label: "No results" }];
      }
    },
    []
  );

  const loadSuppliers = useMemo(
    () => async (input) => {
      const q = String(input || "").trim();
      if (!q) return [{ value: "", label: "All Suppliers" }];
      try {
        const res = await tryEndpoints(
          ["/api/suppliers/search", "/suppliers/search"],
          { q, limit: 30 }
        );
        const rows = Array.isArray(res.data?.data)
          ? res.data.data
          : Array.isArray(res.data)
          ? res.data
          : [];
        return rows.map((r) => ({
          value: r.id,
          label: r.name ?? r.label ?? `#${r.id}`,
        }));
      } catch {
        toast.error("Supplier search failed");
        return [{ value: "", label: "No results" }];
      }
    },
    []
  );

  /* ============ Fetch report ============ */
  const fetchReport = async () => {
    if (!canView) return toast.error("You don't have permission to view this report.");

    setLoading(true);
    try {
      const res = await axios.get("/api/reports/current-stock", {
        params: {
          category_id: categoryId || undefined,
          brand_id: brandId || undefined,
          supplier_id: supplierId || undefined,
        },
      });

      const responseData = res.data || {};
      // Client-side filter to ensure only products with quantity > 0 are displayed
      const allRows = Array.isArray(responseData.rows) ? responseData.rows : [];
      const rows = allRows.filter(row => (Number(row.quantity) || 0) > 0);
      
      // Recalculate summary based on filtered rows
      const summary = {
        total_items: rows.length,
        total_quantity: rows.reduce((sum, row) => sum + (Number(row.quantity) || 0), 0),
        total_purchase_value: rows.reduce((sum, row) => sum + (Number(row.total_purchase_value) || 0), 0),
        total_sale_value: rows.reduce((sum, row) => sum + (Number(row.total_sale_value) || 0), 0),
      };

      setData({ rows, summary });
      if (!rows.length) toast("No stock items found with quantity > 0.", { icon: "ℹ️" });
    } catch (err) {
      console.error(err);
      toast.error("Failed to fetch Current Stock report");
      setData({ rows: [], summary: {} });
    } finally {
      setLoading(false);
    }
  };

  /* ============ Export PDF ============ */
  const exportPdf = async () => {
    if (!canExport) return toast.error("You don't have permission to export PDF.");
    setPdfLoading(true);
    try {
      const res = await axios.get("/api/reports/current-stock/pdf", {
        params: {
          category_id: categoryId || undefined,
          brand_id: brandId || undefined,
          supplier_id: supplierId || undefined,
        },
        responseType: "blob",
      });
      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      toast.error("Failed to generate PDF");
    } finally {
      setPdfLoading(false);
    }
  };

  /* ============ Reset filters ============ */
  const resetFilters = () => {
    setCategoryValue(null);
    setCategoryId("");
    setBrandValue(null);
    setBrandId("");
    setSupplierValue(null);
    setSupplierId("");
    setData({ rows: [], summary: {} });
  };

  // Computed values
  const { rows, summary } = data;
  const totalPurchaseValue = n(summary.total_purchase_value);
  const totalSaleValue = n(summary.total_sale_value);
  const potentialProfit = totalSaleValue - totalPurchaseValue;

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* ===== Header + Filters ===== */}
      <GlassCard>
        <GlassSectionHeader
          title={<span className={`font-semibold ${isDark ? "text-slate-200" : ""}`}>Current Stock Report</span>}
          right={
            <div className="flex gap-2">
              <GlassBtn
                className={`h-9 ${tintGhost}`}
                title="Reset Filters"
                onClick={resetFilters}
              >
                Reset
              </GlassBtn>
            </div>
          }
        />

        {/* Filters */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            fetchReport();
          }}
        >
          <GlassToolbar className="grid grid-cols-1 md:grid-cols-12 gap-3">
            {/* Category */}
            <div className="md:col-span-4">
              <label className={`text-sm mb-1 block ${isDark ? "text-slate-300" : "text-gray-700"}`}>Category</label>
              <AsyncSelect
                cacheOptions
                defaultOptions={[{ value: "", label: "All Categories" }]}
                loadOptions={loadCategories}
                isClearable
                value={categoryValue}
                onChange={(opt) => {
                  setCategoryValue(opt);
                  setCategoryId(opt?.value || "");
                }}
                styles={getSelectStyles(isDark)}
                menuPortalTarget={document.body}
                filterOption={createFilter({
                  matchFrom: "start",
                  trim: true,
                })}
              />
            </div>

            {/* Brand */}
            <div className="md:col-span-4">
              <label className={`text-sm mb-1 block ${isDark ? "text-slate-300" : "text-gray-700"}`}>Brand</label>
              <AsyncSelect
                cacheOptions
                defaultOptions={[{ value: "", label: "All Brands" }]}
                loadOptions={loadBrands}
                isClearable
                value={brandValue}
                onChange={(opt) => {
                  setBrandValue(opt);
                  setBrandId(opt?.value || "");
                }}
                styles={getSelectStyles(isDark)}
                menuPortalTarget={document.body}
                filterOption={createFilter({
                  matchFrom: "start",
                  trim: true,
                })}
              />
            </div>

            {/* Supplier */}
            <div className="md:col-span-4">
              <label className={`text-sm mb-1 block ${isDark ? "text-slate-300" : "text-gray-700"}`}>Supplier</label>
              <AsyncSelect
                cacheOptions
                defaultOptions={[{ value: "", label: "All Suppliers" }]}
                loadOptions={loadSuppliers}
                isClearable
                value={supplierValue}
                onChange={(opt) => {
                  setSupplierValue(opt);
                  setSupplierId(opt?.value || "");
                }}
                styles={getSelectStyles(isDark)}
                menuPortalTarget={document.body}
                filterOption={createFilter({
                  matchFrom: "start",
                  trim: true,
                })}
              />
            </div>

            {/* Buttons */}
            <div className="md:col-span-12 flex flex-wrap gap-2">
              <GlassBtn
                type="submit"
                className={`h-9 min-w-[110px] ${tintPrimary}`}
                disabled={loading}
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <ArrowPathIcon className="w-5 h-5 animate-spin" />
                    Loading…
                  </span>
                ) : (
                  "Load Report"
                )}
              </GlassBtn>

              <GlassBtn
                className={`h-9 flex items-center gap-2 ${canExport ? tintGhost : "opacity-60"}`}
                onClick={exportPdf}
                disabled={pdfLoading || !canExport || rows.length === 0}
              >
                <ArrowDownOnSquareIcon className="w-5 h-5" />
                {pdfLoading ? "Generating…" : "Export PDF"}
              </GlassBtn>
            </div>
          </GlassToolbar>
        </form>
      </GlassCard>

      {/* ===== Permission states ===== */}
      {canView === null && (
        <GlassCard>
          <div className={`px-4 py-3 text-sm ${isDark ? "text-slate-300" : "text-gray-700"}`}>Checking permissions…</div>
        </GlassCard>
      )}
      {canView === false && (
        <GlassCard>
          <div className={`px-4 py-3 text-sm ${isDark ? "text-slate-300" : "text-gray-700"}`}>You don't have permission to view this report.</div>
        </GlassCard>
      )}

      {/* ===== Results ===== */}
      {canView === true && (
        <>
          {rows.length === 0 && !loading && (
            <GlassCard>
              <div className={`px-4 py-4 text-sm ${isDark ? "text-slate-400" : "text-gray-600"}`}>
                No stock items found. Apply filters and click "Load Report".
              </div>
            </GlassCard>
          )}

          {rows.length > 0 && (
            <>
              {/* ===== Summary KPI Cards ===== */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <KpiCard
                  label="Total Items"
                  value={fmtNumber(summary.total_items)}
                  icon="📦"
                  isDark={isDark}
                />
                <KpiCard
                  label="Total Quantity"
                  value={fmtNumber(summary.total_quantity)}
                  icon="🔢"
                  isDark={isDark}
                />
                <KpiCard
                  label="Purchase Value"
                  value={fmtCurrency(summary.total_purchase_value)}
                  icon="💰"
                  highlight={false}
                  isDark={isDark}
                />
                <KpiCard
                  label="Sale Value"
                  value={fmtCurrency(summary.total_sale_value)}
                  icon="🏷️"
                  highlight={false}
                  isDark={isDark}
                />
                <KpiCard
                  label="Potential Profit"
                  value={fmtCurrency(potentialProfit)}
                  icon="📈"
                  highlight={true}
                  isDark={isDark}
                />
              </div>

              {/* ===== Data Table ===== */}
              <GlassCard className="relative z-10">
                <div className="max-h-[75vh] overflow-auto rounded-b-2xl">
                  <table className={`min-w-[1200px] w-full text-sm ${isDark ? "text-slate-200" : "text-gray-900"}`}>
                    <thead className={`sticky top-0 backdrop-blur-sm z-10 border-b ${isDark ? "bg-slate-800/90" : "bg-white/90"} ${isDark ? "border-slate-600/70" : "border-gray-200/70"}`}>
                      <tr className="text-left">
                        <Th isDark={isDark}>#</Th>
                        <Th isDark={isDark}>Product Name</Th>
                        <Th isDark={isDark}>Category</Th>
                        <Th isDark={isDark}>Brand</Th>
                        <Th isDark={isDark}>Supplier</Th>
                        <Th align="right" isDark={isDark}>Pack Size</Th>
                        <Th align="right" isDark={isDark}>Quantity</Th>
                        <Th align="right" isDark={isDark}>Pack Purchase</Th>
                        <Th align="right" isDark={isDark}>Pack Sale</Th>
                        <Th align="right" isDark={isDark}>Total Purchase</Th>
                        <Th align="right" isDark={isDark}>Total Sale</Th>
                      </tr>
                    </thead>

                    <tbody className="tabular-nums">
                      {rows.map((row, idx) => (
                        <tr
                          key={row.id ?? idx}
                          className={`transition-all duration-150 hover:backdrop-blur-[2px] ${
                            isDark
                              ? "odd:bg-slate-800/80 even:bg-slate-800/60 hover:bg-slate-700/80"
                              : "odd:bg-white/90 even:bg-white/70 hover:bg-white/80"
                          }`}
                        >
                          <Td isDark={isDark}>{idx + 1}</Td>
                          <Td isDark={isDark} className="font-medium">{row.name || "-"}</Td>
                          <Td isDark={isDark}>{row.category_name || "-"}</Td>
                          <Td isDark={isDark}>{row.brand_name || "-"}</Td>
                          <Td isDark={isDark}>{row.supplier_name || "-"}</Td>
                          <Td align="right" isDark={isDark}>{fmtNumber(row.pack_size)}</Td>
                          <Td align="right" isDark={isDark} className="font-semibold text-blue-700">
                            {fmtNumber(row.quantity)}
                          </Td>
                          <Td align="right" isDark={isDark}>{fmtCurrency(row.pack_purchase_price)}</Td>
                          <Td align="right" isDark={isDark}>{fmtCurrency(row.pack_sale_price)}</Td>
                          <Td align="right" isDark={isDark} className="text-emerald-700">
                            {fmtCurrency(row.total_purchase_value)}
                          </Td>
                          <Td align="right" isDark={isDark} className="text-indigo-700">
                            {fmtCurrency(row.total_sale_value)}
                          </Td>
                        </tr>
                      ))}

                      {(!rows || rows.length === 0) && (
                        <tr>
                          <td colSpan={11} className={`px-3 py-6 text-center ${isDark ? "text-slate-400" : "text-gray-500"}`}>
                            No stock items found.
                          </td>
                        </tr>
                      )}
                    </tbody>

                    <tfoot className={`border-t-2 backdrop-blur-sm font-semibold ${isDark ? "border-slate-600 bg-slate-800/80" : "border-gray-300 bg-white/80"}`}>
                      <tr className={isDark ? "bg-slate-700" : "bg-gray-50"}>
                        <Td colSpan={5} align="right" strong isDark={isDark}>TOTALS</Td>
                        <Td align="right" isDark={isDark}>-</Td>
                        <Td align="right" isDark={isDark} className="text-blue-800">
                          {fmtNumber(summary.total_quantity)}
                        </Td>
                        <Td align="right" isDark={isDark}>-</Td>
                        <Td align="right" isDark={isDark}>-</Td>
                        <Td align="right" isDark={isDark} className="text-emerald-800">
                          {fmtCurrency(summary.total_purchase_value)}
                        </Td>
                        <Td align="right" isDark={isDark} className="text-indigo-800">
                          {fmtCurrency(summary.total_sale_value)}
                        </Td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </GlassCard>
            </>
          )}
        </>
      )}

      <style>{`
        .tabular-nums { font-variant-numeric: tabular-nums; }
        @media print {
          input, button, select, [role="button"], .rs__control { display: none !important; }
          table { font-size: 10px; }
          thead { position: sticky; top: 0; }
        }
      `}</style>
    </div>
  );
}

/* ===== KPI Card Component ===== */
function KpiCard({ label, value, icon, highlight = false }) {
  return (
    <div
      className={[
        "group rounded-xl px-4 py-3 backdrop-blur-sm bg-white/55 ring-1 ring-white/30 shadow-sm",
        "transition-all duration-200",
        "hover:bg-white/80 hover:backdrop-blur-md hover:shadow-[0_10px_30px_-10px_rgba(59,130,246,0.35)]",
        "hover:ring-white/40",
        highlight ? "outline outline-1 outline-emerald-200/50" : "",
      ].join(" ")}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">{icon}</span>
        <span className="text-xs text-gray-600 uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-xl font-bold tabular-nums text-gray-900">{value}</div>
    </div>
  );
}

/* ===== Table Helpers ===== */
function Th({ children, align = "left", isDark = false }) {
  return (
    <th className={`px-3 py-2 font-medium ${align === "right" ? "text-right" : "text-left"} ${isDark ? "text-slate-200" : ""}`}>
      {children}
    </th>
  );
}

function Td({ children, align = "left", colSpan, strong = false, className = "", isDark = false }) {
  return (
    <td
      colSpan={colSpan}
      className={[
        "px-3 py-2 border-t",
        isDark ? "border-slate-600/70" : "border-gray-200/70",
        align === "right" ? "text-right" : "text-left",
        strong ? (isDark ? "font-medium text-slate-200" : "font-medium text-gray-800") : "",
        className,
      ].join(" ")}
    >
      {children}
    </td>
  );
}

