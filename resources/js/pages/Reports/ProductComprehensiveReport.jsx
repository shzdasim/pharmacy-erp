import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import AsyncSelect from "react-select/async";
import { createFilter } from "react-select";
import toast from "react-hot-toast";
import { usePermissions } from "@/api/usePermissions";

// 🧊 glass primitives
import {
  GlassCard,
  GlassSectionHeader,
  GlassToolbar,
  GlassInput,
  GlassBtn,
} from "@/components/glass.jsx";
import { useTheme } from "@/context/ThemeContext";

import { ArrowDownOnSquareIcon, ArrowPathIcon } from "@heroicons/react/24/solid";

/* ======================
   Helpers
   ====================== */

const n = (v) => (isFinite(Number(v)) ? Number(v) : 0);
const fmtCurrency = (v) =>
  n(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtNumber = (v) =>
  n(v).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtDate = (v) => {
  if (!v) return "-";
  if (typeof v === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
    const d = new Date(v);
    return isNaN(d.getTime()) ? v : d.toISOString().split("T")[0];
  }
  if (v instanceof Date) {
    return v.toISOString().split("T")[0];
  }
  return v;
};

/* react-select → glassy control */
const selectStyles = {
  control: (base) => ({
    ...base,
    minHeight: 36,
    height: 36,
    borderColor: "rgba(229,231,235,0.8)",
    backgroundColor: "rgba(255,255,255,0.7)",
    backdropFilter: "blur(6px)",
    boxShadow: "0 1px 2px rgba(15,23,42,0.06)",
    borderRadius: 12,
    transition: "all .2s ease",
    "&:hover": { borderColor: "rgba(148,163,184,0.9)", backgroundColor: "rgba(255,255,255,0.85)" },
  }),
  valueContainer: (base) => ({ ...base, height: 36, padding: "0 10px" }),
  indicatorsContainer: (base) => ({ ...base, height: 36 }),
  input: (base) => ({ ...base, margin: 0, padding: 0 }),
  menuPortal: (base) => ({ ...base, zIndex: 9999 }),
  menu: (base) => ({
    ...base,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.9)",
    backdropFilter: "blur(10px)",
    boxShadow: "0 10px 30px -10px rgba(30,64,175,0.18)",
  }),
};

// Helper to merge dark mode styles - returns function-based styles for react-select
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
    }
  }
  throw lastErr;
}

export default function ProductComprehensiveReport() {
  // Filters
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [productValue, setProductValue] = useState(null);
  const [productId, setProductId] = useState("");

  // Data + States
  const [data, setData] = useState({ product: null, transactions: [], summary: {} });
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  const perms = usePermissions();
  const canView = perms?.has?.("report.product-comprehensive.view");
  const canExport = perms?.has?.("report.product-comprehensive.export");

  // Get dark mode state
  const { isDark } = useTheme();

  // tints
  const tintPrimary =
    "bg-slate-900/80 text-white ring-1 ring-white/15 shadow-[0_6px_20px_-6px_rgba(15,23,42,0.45)] hover:bg-slate-900/90";
  const tintGhost = isDark ? "bg-slate-800/60 text-slate-200 ring-1 ring-slate-700/50 hover:bg-slate-800/80" : "bg-white/60 text-slate-700 ring-1 ring-white/30 hover:bg-white/75";

  /* ============ Set default date range on mount ============ */
  useEffect(() => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const formatYMD = (date) => date.toISOString().split("T")[0];

    if (!fromDate) setFromDate(formatYMD(firstDay));
    if (!toDate) setToDate(formatYMD(lastDay));
  }, []);

  /* ============ Async product loader ============ */
  const loadProducts = useMemo(
    () => async (input) => {
      const q = String(input || "").trim();
      if (!q) return [{ value: "", label: "Search products..." }];
      try {
        const res = await tryEndpoints(
          ["/api/products/search", "/products/search"],
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
          product_code: r.product_code,
        }));
      } catch {
        toast.error("Product search failed");
        return [{ value: "", label: "No results" }];
      }
    },
    []
  );

  /* ============ Fetch report ============ */
  const fetchReport = async () => {
    if (!canView) return toast.error("You don't have permission to view this report.");

    if (!productId) {
      return toast.error("Please select a product first.");
    }

    setLoading(true);
    try {
      const res = await axios.get("/api/reports/product-comprehensive", {
        params: {
          from: fromDate || undefined,
          to: toDate || undefined,
          product_id: productId,
        },
      });

      const responseData = res.data || {};
      setData({
        product: responseData.product || null,
        transactions: Array.isArray(responseData.transactions) ? responseData.transactions : [],
        summary: responseData.summary || {},
      });

      if (!responseData.transactions?.length) {
        toast("No transactions found for this product.", { icon: "ℹ️" });
      }
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.message || "Failed to fetch Product Comprehensive report";
      toast.error(msg);
      setData({ product: null, transactions: [], summary: {} });
    } finally {
      setLoading(false);
    }
  };

  /* ============ Export PDF ============ */
  const exportPdf = async () => {
    if (!canExport) return toast.error("You don't have permission to export PDF.");
    if (!productId) return toast.error("Please select a product first.");

    setPdfLoading(true);
    try {
      const res = await axios.get("/api/reports/product-comprehensive/pdf", {
        params: {
          from: fromDate || undefined,
          to: toDate || undefined,
          product_id: productId,
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
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const formatYMD = (date) => date.toISOString().split("T")[0];

    setFromDate(formatYMD(firstDay));
    setToDate(formatYMD(lastDay));
    setProductValue(null);
    setProductId("");
    setData({ product: null, transactions: [], summary: {} });
  };

  // Computed values
  const { product, transactions, summary } = data;

  // Row type classes
  const getRowClass = (type) => {
    switch (type) {
      case "purchase":
        return isDark ? "bg-green-900/30" : "bg-green-50/80";
      case "sale":
        return isDark ? "bg-red-900/30" : "bg-red-50/80";
      case "purchase_return":
        return isDark ? "bg-amber-900/30" : "bg-amber-50/80";
      case "sale_return":
        return isDark ? "bg-purple-900/30" : "bg-purple-50/80";
      default:
        return isDark ? "hover:bg-slate-800/50" : "hover:bg-white/80";
    }
  };

  const getTypeBadge = (type) => {
    switch (type) {
      case "purchase":
        return <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
          isDark ? "bg-green-800 text-green-200" : "bg-green-200 text-green-800"
        }`}>PURCHASE</span>;
      case "sale":
        return <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
          isDark ? "bg-red-800 text-red-200" : "bg-red-200 text-red-800"
        }`}>SALE</span>;
      case "purchase_return":
        return <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
          isDark ? "bg-amber-800 text-amber-200" : "bg-amber-200 text-amber-800"
        }`}>P.RETURN</span>;
      case "sale_return":
        return <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
          isDark ? "bg-purple-800 text-purple-200" : "bg-purple-200 text-purple-800"
        }`}>S.RETURN</span>;
      default:
        return null;
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* ===== Header + Filters ===== */}
      <GlassCard>
        <GlassSectionHeader
          title={<span className={`font-semibold ${isDark ? "text-slate-200" : ""}`}>Product Comprehensive Report</span>}
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
            {/* From Date */}
            <div className="md:col-span-3">
              <label className={`text-sm mb-1 block ${isDark ? "text-slate-300" : "text-gray-700"}`}>From Date</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className={`w-full h-9 px-3 rounded-xl border backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-blue-400/60 text-sm transition-colors ${
                  isDark
                    ? "bg-slate-800/60 border-slate-600/70 text-slate-200 placeholder-slate-500"
                    : "bg-white/60 border-gray-200/70 text-gray-900"
                }`}
              />
            </div>

            {/* To Date */}
            <div className="md:col-span-3">
              <label className={`text-sm mb-1 block ${isDark ? "text-slate-300" : "text-gray-700"}`}>To Date</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className={`w-full h-9 px-3 rounded-xl border backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-blue-400/60 text-sm transition-colors ${
                  isDark
                    ? "bg-slate-800/60 border-slate-600/70 text-slate-200 placeholder-slate-500"
                    : "bg-white/60 border-gray-200/70 text-gray-900"
                }`}
              />
            </div>

            {/* Product Selector */}
            <div className="md:col-span-4">
              <label className={`text-sm mb-1 block ${isDark ? "text-slate-300" : "text-gray-700"}`}>Product</label>
              <AsyncSelect
                cacheOptions
                loadOptions={loadProducts}
                isClearable
                value={productValue}
                onChange={(opt) => {
                  setProductValue(opt);
                  setProductId(opt?.value || "");
                }}
                styles={getSelectStyles(isDark)}
                menuPortalTarget={document.body}
                filterOption={createFilter({
                  matchFrom: "start",
                  trim: true,
                })}
                placeholder="Search product by name..."
              />
            </div>

            {/* Buttons */}
            <div className="md:col-span-2 flex flex-wrap gap-2 items-end">
              <GlassBtn
                type="submit"
                className={`h-9 min-w-[100px] ${tintPrimary}`}
                disabled={loading}
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <ArrowPathIcon className="w-5 h-5 animate-spin" />
                    Loading…
                  </span>
                ) : (
                  "Load"
                )}
              </GlassBtn>

              <GlassBtn
                className={`h-9 flex items-center gap-2 ${canExport ? tintGhost : "opacity-60"}`}
                onClick={exportPdf}
                disabled={pdfLoading || !canExport || transactions.length === 0}
              >
                <ArrowDownOnSquareIcon className="w-5 h-5" />
                {pdfLoading ? "..." : "PDF"}
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
          {/* Product Info Card */}
          {product && (
            <GlassCard>
              <div className={`flex flex-wrap items-center gap-4 p-4 rounded-xl border ${
                isDark
                  ? "bg-blue-900/30 border-blue-700/50"
                  : "bg-blue-50/80 border-blue-200/60"
              }`}>
                <div className="flex-1">
                  <h3 className={`text-lg font-semibold ${isDark ? "text-blue-300" : "text-blue-900"}`}>{product.name}</h3>
                  <div className={`flex flex-wrap gap-4 mt-1 text-sm ${isDark ? "text-blue-200" : "text-blue-800"}`}>
                    {product.product_code && <span>Code: <strong>{product.product_code}</strong></span>}
                    {product.category_name && <span>Category: <strong>{product.category_name}</strong></span>}
                    {product.brand_name && <span>Brand: <strong>{product.brand_name}</strong></span>}
                    {product.pack_size && <span>Pack Size: <strong>{product.pack_size}</strong></span>}
                  </div>
                </div>
                <div className={`text-center px-6 py-3 rounded-xl border shadow-sm ${
                  isDark ? "bg-slate-800/80 border-blue-700/50" : "bg-white/80 border-blue-200"
                }`}>
                  <div className={`text-xs uppercase tracking-wide ${isDark ? "text-blue-400" : "text-blue-600"}`}>Current Stock</div>
                  <div className={`text-2xl font-bold ${isDark ? "text-blue-200" : "text-blue-900"}`}>{fmtNumber(product.current_quantity)}</div>
                </div>
              </div>
            </GlassCard>
          )}

          {transactions.length === 0 && !loading && (
            <GlassCard>
              <div className={`px-4 py-4 text-sm ${isDark ? "text-slate-400" : "text-gray-600"}`}>
                {product ? "No transactions found for this product in the selected date range." : "Select a product and click Load to view the report."}
              </div>
            </GlassCard>
          )}

          {transactions.length > 0 && (
            <>
              {/* ===== Summary KPI Cards ===== */}
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                <KpiCard
                  label="Total Purchase Price"
                  value={fmtCurrency(summary.total_purchases)}
                  icon="📥"
                  isDark={isDark}
                />
                <KpiCard
                  label="Purchase Returns Price"
                  value={fmtCurrency(summary.total_purchase_returns)}
                  icon="📤"
                  isDark={isDark}
                />
                <KpiCard
                  label="Net Purchase Price"
                  value={fmtCurrency(summary.net_purchases)}
                  icon="💰"
                  highlight={true}
                  isDark={isDark}
                />
                <KpiCard
                  label="Total Sale Price"
                  value={fmtCurrency(summary.total_sales)}
                  icon="📤"
                  isDark={isDark}
                />
                <KpiCard
                  label="Sale Returns Price"
                  value={fmtCurrency(summary.total_sale_returns)}
                  icon="📥"
                  isDark={isDark}
                />
                <KpiCard
                  label="Net Sale Price"
                  value={fmtCurrency(summary.net_sales)}
                  icon="💰"
                  highlight={true}
                  isDark={isDark}
                />
              </div>

              {/* ===== Quantity Summary ===== */}
              <GlassCard>
                <div className={`flex justify-around py-3 ${isDark ? "text-slate-200" : ""}`}>
                  <div className="text-center">
                    <div className={`text-xs uppercase ${isDark ? "text-slate-400" : "text-gray-500"}`}>Total In</div>
                    <div className={`text-xl font-bold ${isDark ? "text-green-400" : "text-green-600"}`}>{fmtNumber(summary.total_quantity_in)}</div>
                  </div>
                  <div className="text-center">
                    <div className={`text-xs uppercase ${isDark ? "text-slate-400" : "text-gray-500"}`}>Total Out</div>
                    <div className={`text-xl font-bold ${isDark ? "text-red-400" : "text-red-600"}`}>{fmtNumber(summary.total_quantity_out)}</div>
                  </div>
                </div>
              </GlassCard>

              {/* ===== Data Table ===== */}
              <GlassCard className="relative z-10">
                <div className="max-h-[70vh] overflow-auto rounded-b-2xl">
                  <table className="min-w-[1200px] w-full text-sm">
                    <thead className={`sticky top-0 backdrop-blur-sm z-10 border-b ${
                      isDark ? "bg-slate-800/90" : "bg-white/90"
                    }`}>
                      <tr className={isDark ? "text-left text-slate-300" : "text-left bg-gray-50/80"}>
                        <Th isDark={isDark}>#</Th>
                        <Th isDark={isDark}>Date</Th>
                        <Th isDark={isDark}>Type</Th>
                        <Th isDark={isDark}>Ref #</Th>
                        <Th isDark={isDark}>Supplier/Customer</Th>
                        <Th isDark={isDark}>Batch</Th>
                        <Th isDark={isDark}>Expiry</Th>
                        <Th isDark={isDark} align="right">Qty In</Th>
                        <Th isDark={isDark} align="right">Qty Out</Th>
                        <Th isDark={isDark} align="right">Unit Price</Th>
                        <Th isDark={isDark} align="right">Subtotal</Th>
                      </tr>
                    </thead>

                    <tbody className="tabular-nums">
                      {transactions.map((txn, idx) => (
                        <tr
                          key={idx}
                          className={`transition-all duration-150 ${
                            isDark ? "hover:bg-slate-700/50 text-slate-200" : "hover:bg-white/80 text-gray-900"
                          } ${getRowClass(txn.type)}`}
                        >
                          <Td isDark={isDark}>{idx + 1}</Td>
                          <Td isDark={isDark}>{fmtDate(txn.date)}</Td>
                          <Td isDark={isDark}>{getTypeBadge(txn.type)}</Td>
                          <Td isDark={isDark} className="font-medium">{txn.reference_number || "-"}</Td>
                          <Td isDark={isDark}>{txn.counter_party || "-"}</Td>
                          <Td isDark={isDark}>{txn.batch || "-"}</Td>
                          <Td isDark={isDark}>{fmtDate(txn.expiry)}</Td>
                          <Td isDark={isDark} align="right" className={isDark ? "text-green-400 font-medium" : "text-green-700 font-medium"}>
                            {txn.quantity_in > 0 ? fmtNumber(txn.quantity_in) : "-"}
                          </Td>
                          <Td isDark={isDark} align="right" className={isDark ? "text-red-400 font-medium" : "text-red-700 font-medium"}>
                            {txn.quantity_out > 0 ? fmtNumber(txn.quantity_out) : "-"}
                          </Td>
                          <Td isDark={isDark} align="right">{fmtCurrency(txn.unit_price)}</Td>
                          <Td isDark={isDark} align="right" className="font-medium">
                            {fmtCurrency(txn.sub_total)}
                          </Td>
                        </tr>
                      ))}

                      {transactions.length === 0 && (
                        <tr>
                          <td colSpan={11} className={`px-3 py-6 text-center ${isDark ? "text-slate-500" : "text-gray-500"}`}>
                            No transactions found.
                          </td>
                        </tr>
                      )}
                    </tbody>

                    <tfoot className={`border-t-2 backdrop-blur-sm font-semibold ${
                      isDark ? "bg-slate-800/80 border-slate-700" : "bg-white/80 border-gray-300"
                    }`}>
                      <tr className={isDark ? "text-slate-300" : "bg-gray-50"}>
                        <Td isDark={isDark} colSpan={7} align="right" strong>TOTALS</Td>
                        <Td isDark={isDark} align="right" className={isDark ? "text-green-400" : "text-green-800"}>
                          {fmtNumber(summary.total_quantity_in)}
                        </Td>
                        <Td isDark={isDark} align="right" className={isDark ? "text-red-400" : "text-red-800"}>
                          {fmtNumber(summary.total_quantity_out)}
                        </Td>
                        <Td isDark={isDark} align="right">-</Td>
                        <Td isDark={isDark} align="right">-</Td>
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
function KpiCard({ label, value, icon, highlight = false, isDark = false }) {
  return (
    <div
      className={[
        "group rounded-xl px-4 py-3 backdrop-blur-sm ring-1 shadow-sm",
        "transition-all duration-200",
        "hover:backdrop-blur-md hover:shadow-[0_10px_30px_-10px_rgba(59,130,246,0.35)]",
        "hover:ring-white/40",
        highlight ? "outline outline-1 outline-emerald-200/50" : "",
        isDark
          ? "bg-slate-800/55 ring-slate-700/30 hover:bg-slate-800/80"
          : "bg-white/55 ring-white/30 hover:bg-white/80",
      ].join(" ")}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">{icon}</span>
        <span className={`text-xs uppercase tracking-wide ${isDark ? "text-slate-400" : "text-gray-600"}`}>{label}</span>
      </div>
      <div className={`text-xl font-bold tabular-nums ${isDark ? "text-slate-200" : "text-gray-900"}`}>{value}</div>
    </div>
  );
}

/* ===== Table Helpers ===== */
function Th({ children, align = "left", isDark = false }) {
  return (
    <th className={`px-3 py-2 font-medium ${align === "right" ? "text-right" : "text-left"} ${
      isDark ? "text-slate-300" : "text-gray-700"
    }`}>
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
        align === "right" ? "text-right" : "text-left",
        strong ? "font-medium" : "",
        isDark ? "border-slate-700 text-slate-300" : "border-gray-200/70 text-gray-900",
        className,
      ].join(" ")}
    >
      {children}
    </td>
  );
}

