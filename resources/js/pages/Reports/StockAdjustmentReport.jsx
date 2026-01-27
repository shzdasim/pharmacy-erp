import { useEffect, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { usePermissions } from "@/api/usePermissions";
import { useTheme } from "@/context/ThemeContext";

// glass primitives
import {
  GlassCard,
  GlassSectionHeader,
  GlassToolbar,
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
const fmtDate = (v) => {
  if (!v) return "-";
  // Handle both "YYYY-MM-DD" strings and Date objects
  if (typeof v === "string") {
    // Check if already in YYYY-MM-DD format
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
    // Try to parse
    const d = new Date(v);
    return isNaN(d.getTime()) ? v : d.toISOString().split("T")[0];
  }
  if (v instanceof Date) {
    return v.toISOString().split("T")[0];
  }
  return v;
};

/* ======================
   Main Component
   ====================== */

export default function StockAdjustmentReport() {
  // Filters
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Data + States
  const [data, setData] = useState({ rows: [], summary: {} });
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  const perms = usePermissions();
  const canView = perms?.has?.("report.stock-adjustment.view");
  const canExport = perms?.has?.("report.stock-adjustment.export");

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

    // Format as YYYY-MM-DD
    const formatYMD = (date) => date.toISOString().split("T")[0];

    if (!fromDate) setFromDate(formatYMD(firstDay));
    if (!toDate) setFromDate(formatYMD(lastDay));
  }, []);

  /* ============ Fetch report ============ */
  const fetchReport = async () => {
    if (!canView) return toast.error("You don't have permission to view this report.");

    setLoading(true);
    try {
      const res = await axios.get("/api/reports/stock-adjustment", {
        params: {
          from: fromDate || undefined,
          to: toDate || undefined,
        },
      });

      const responseData = res.data || {};
      const rows = Array.isArray(responseData.rows) ? responseData.rows : [];
      const summary = responseData.summary || {};

      setData({ rows, summary });
      if (!rows.length) toast("No stock adjustments found for the selected date range.", { icon: "ℹ️" });
    } catch (err) {
      console.error(err);
      toast.error("Failed to fetch Stock Adjustment report");
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
      const res = await axios.get("/api/reports/stock-adjustment/pdf", {
        params: {
          from: fromDate || undefined,
          to: toDate || undefined,
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
    setData({ rows: [], summary: {} });
  };

  // Computed values
  const { rows, summary } = data;

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* ===== Header + Filters ===== */}
      <GlassCard>
        <GlassSectionHeader
          title={<span className={`font-semibold ${isDark ? "text-slate-200" : ""}`}>Stock Adjustment Report</span>}
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
                className={`w-full h-9 px-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-400/60 text-sm ${
                  isDark 
                    ? "bg-slate-800 border-slate-600 text-slate-200" 
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
                className={`w-full h-9 px-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-400/60 text-sm ${
                  isDark 
                    ? "bg-slate-800 border-slate-600 text-slate-200" 
                    : "bg-white/60 border-gray-200/70 text-gray-900"
                }`}
              />
            </div>

            {/* Buttons */}
            <div className="md:col-span-6 flex flex-wrap gap-2 items-end">
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
                No stock adjustments found. Adjust filters and click "Load Report".
              </div>
            </GlassCard>
          )}

          {rows.length > 0 && (
            <>
              {/* ===== Summary KPI Cards ===== */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <KpiCard isDark={isDark} label="Total Adjustments" value={fmtNumber(summary.total_adjustments)} icon="📋" />
                <KpiCard isDark={isDark} label="Total Items" value={fmtNumber(summary.total_items)} icon="📦" />
                <KpiCard isDark={isDark} label="Worth Adjusted" value={fmtCurrency(summary.total_worth_adjusted)} icon="💰" />
                <KpiCard isDark={isDark} label="Positive Adj." value={fmtNumber(summary.positive_adjustments)} icon="⬆️" />
                <KpiCard isDark={isDark} label="Negative Adj." value={fmtNumber(summary.negative_adjustments)} icon="⬇️" />
              </div>

              {/* ===== Data Table ===== */}
              <GlassCard className="relative z-10">
                <div className="max-h-[75vh] overflow-auto rounded-b-2xl">
                  <table className="min-w-[1400px] w-full text-sm">
                    <thead className={`sticky top-0 backdrop-blur-sm z-10 border-b ${isDark ? "bg-slate-800/90" : "bg-white/90"}`}>
                      <tr className={`text-left ${isDark ? "bg-slate-700/80 text-slate-200" : "bg-gray-50/80 text-gray-900"}`}>
                        <Th isDark={isDark}>#</Th>
                        <Th isDark={isDark}>Adjustment #</Th>
                        <Th isDark={isDark}>Date</Th>
                        <Th isDark={isDark}>Product</Th>
                        <Th isDark={isDark}>Batch</Th>
                        <Th isDark={isDark}>Expiry</Th>
                        <Th align="right" isDark={isDark}>Prev Qty</Th>
                        <Th align="right" isDark={isDark}>Actual Qty</Th>
                        <Th align="right" isDark={isDark}>Diff Qty</Th>
                        <Th align="right" isDark={isDark}>Unit Price</Th>
                        <Th align="right" isDark={isDark}>Worth Adj.</Th>
                        <Th isDark={isDark}>Reason/Note</Th>
                        <Th isDark={isDark}>User</Th>
                      </tr>
                    </thead>

                    <tbody className="tabular-nums">
                      {rows.map((row, idx) => {
                        const items = row.items || [];
                        if (items.length === 0) {
                          return (
                            <tr key={`row-${row.id || idx}`} className={isDark ? "odd:bg-slate-800/90 even:bg-slate-800/70" : "odd:bg-white/90 even:bg-white/70"}>
                              <Td colSpan={13} isDark={isDark} className={isDark ? "text-slate-400 italic" : "text-gray-400 italic"}>
                                No items in this adjustment
                              </Td>
                            </tr>
                          );
                        }
                        return items.map((item, itemIdx) => {
                          const isPositive = item.diff_qty > 0;
                          const isNegative = item.diff_qty < 0;
                          return (
                            <tr
                              key={`${row.id}-${item.id || itemIdx}`}
                              className={`transition-all duration-150 ${
                                isDark 
                                  ? "odd:bg-slate-800/90 even:bg-slate-800/70 hover:bg-slate-700/80" 
                                  : "odd:bg-white/90 even:bg-white/70 hover:bg-white/80"
                              }`}
                            >
                              <Td isDark={isDark}>{idx + 1}</Td>
                              <Td isDark={isDark} className={`font-medium ${isDark ? "text-slate-300" : ""}`}>{row.posted_number || "-"}</Td>
                              <Td isDark={isDark} className={isDark ? "text-slate-300" : ""}>{fmtDate(row.posted_date)}</Td>
                              <Td isDark={isDark} className={`font-medium ${isDark ? "text-slate-300" : ""}`}>
                                {item.product_name || "-"}
                                <div className={`text-xs ${isDark ? "text-slate-500" : "text-gray-500"}`}>{item.product_code}</div>
                              </Td>
                              <Td isDark={isDark} className={isDark ? "text-slate-300" : ""}>{item.batch_number || "-"}</Td>
                              <Td isDark={isDark} className={isDark ? "text-slate-300" : ""}>{fmtDate(item.expiry)}</Td>
                              <Td align="right" isDark={isDark} className={isDark ? "text-slate-300" : ""}>{fmtNumber(item.previous_qty)}</Td>
                              <Td align="right" isDark={isDark} className={isDark ? "text-slate-300" : ""}>{fmtNumber(item.actual_qty)}</Td>
                              <Td
                                align="right"
                                isDark={isDark}
                                className={`font-semibold ${
                                  isPositive
                                    ? isDark ? "text-green-400" : "text-green-600"
                                    : isNegative
                                      ? isDark ? "text-red-400" : "text-red-600"
                                      : ""
                                }`}
                              >
                                {item.diff_qty > 0 ? "+" : ""}
                                {fmtNumber(item.diff_qty)}
                              </Td>
                              <Td align="right" isDark={isDark} className={isDark ? "text-slate-300" : ""}>{fmtCurrency(item.unit_purchase_price)}</Td>
                              <Td
                                align="right"
                                isDark={isDark}
                                className={item.worth_adjusted >= 0 ? (isDark ? "text-emerald-400" : "text-emerald-700") : (isDark ? "text-red-400" : "text-red-700")}
                              >
                                {fmtCurrency(item.worth_adjusted)}
                              </Td>
                              <Td isDark={isDark} className={`max-w-xs truncate ${isDark ? "text-slate-300" : ""}`} title={row.note}>
                                {row.note || "-"}
                              </Td>
                              <Td isDark={isDark} className={isDark ? "text-slate-300" : ""}>{row.user_name || "-"}</Td>
                            </tr>
                          );
                        });
                      })}

                      {(!rows || rows.length === 0) && (
                        <tr>
                          <td colSpan={13} className={`px-3 py-6 text-center ${isDark ? "text-slate-400" : "text-gray-500"}`}>
                            No stock adjustments found.
                          </td>
                        </tr>
                      )}
                    </tbody>

                    <tfoot className={`border-t-2 ${isDark ? "border-slate-600 bg-slate-800/80" : "border-gray-300 bg-white/80"} backdrop-blur-sm font-semibold`}>
                      <tr className={isDark ? "bg-slate-700/50 text-slate-200" : "bg-gray-50 text-gray-800"}>
                        <Td colSpan={6} align="right" strong isDark={isDark}>TOTALS</Td>
                        <Td align="right" isDark={isDark}>-</Td>
                        <Td align="right" isDark={isDark}>-</Td>
                        <Td align="right" isDark={isDark}>-</Td>
                        <Td align="right" isDark={isDark}>-</Td>
                        <Td align="right" isDark={isDark} className={isDark ? "text-emerald-400" : "text-emerald-800"}>
                          {fmtCurrency(summary.total_worth_adjusted)}
                        </Td>
                        <Td colSpan={4} isDark={isDark}></Td>
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
function KpiCard({ isDark, label, value, icon, highlight = false }) {
  return (
    <div
      className={[
        "group rounded-xl px-4 py-3 backdrop-blur-sm ring-1 shadow-sm transition-all duration-200",
        isDark 
          ? "bg-slate-800/55 ring-slate-700/50 hover:bg-slate-800/80 hover:ring-slate-600/40" 
          : "bg-white/55 ring-white/30 hover:bg-white/80 hover:ring-white/40",
        highlight ? "outline outline-1 outline-emerald-200/50" : "",
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
        isDark ? "border-slate-700/70" : "border-gray-200/70",
        align === "right" ? "text-right" : "text-left",
        strong ? (isDark ? "font-medium text-slate-200" : "font-medium text-gray-800") : "",
        className,
      ].join(" ")}
    >
      {children}
    </td>
  );
}

