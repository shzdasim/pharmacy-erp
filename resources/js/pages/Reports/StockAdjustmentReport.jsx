import { useEffect, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { usePermissions } from "@/api/usePermissions";

// 🧊 glass primitives
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

  // tints
  const tintPrimary =
    "bg-slate-900/80 text-white ring-1 ring-white/15 shadow-[0_6px_20px_-6px_rgba(15,23,42,0.45)] hover:bg-slate-900/90";
  const tintGhost = "bg-white/60 text-slate-700 ring-1 ring-white/30 hover:bg-white/75";

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
          title={<span className="font-semibold">Stock Adjustment Report</span>}
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
              <label className="text-sm text-gray-700 mb-1 block">From Date</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full h-9 px-3 rounded-xl border border-gray-200/70 bg-white/60 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-blue-400/60 text-sm"
              />
            </div>

            {/* To Date */}
            <div className="md:col-span-3">
              <label className="text-sm text-gray-700 mb-1 block">To Date</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full h-9 px-3 rounded-xl border border-gray-200/70 bg-white/60 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-blue-400/60 text-sm"
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
          <div className="px-4 py-3 text-sm text-gray-700">Checking permissions…</div>
        </GlassCard>
      )}
      {canView === false && (
        <GlassCard>
          <div className="px-4 py-3 text-sm text-gray-700">You don't have permission to view this report.</div>
        </GlassCard>
      )}

      {/* ===== Results ===== */}
      {canView === true && (
        <>
          {rows.length === 0 && !loading && (
            <GlassCard>
              <div className="px-4 py-4 text-sm text-gray-600">
                No stock adjustments found. Adjust filters and click "Load Report".
              </div>
            </GlassCard>
          )}

          {rows.length > 0 && (
            <>
              {/* ===== Summary KPI Cards ===== */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <KpiCard
                  label="Total Adjustments"
                  value={fmtNumber(summary.total_adjustments)}
                  icon="📋"
                />
                <KpiCard
                  label="Total Items"
                  value={fmtNumber(summary.total_items)}
                  icon="📦"
                />
                <KpiCard
                  label="Worth Adjusted"
                  value={fmtCurrency(summary.total_worth_adjusted)}
                  icon="💰"
                />
                <KpiCard
                  label="Positive Adj."
                  value={fmtNumber(summary.positive_adjustments)}
                  icon="⬆️"
                />
                <KpiCard
                  label="Negative Adj."
                  value={fmtNumber(summary.negative_adjustments)}
                  icon="⬇️"
                />
              </div>

              {/* ===== Data Table ===== */}
              <GlassCard className="relative z-10">
                <div className="max-h-[75vh] overflow-auto rounded-b-2xl">
                  <table className="min-w-[1400px] w-full text-sm text-gray-900">
                    <thead className="sticky top-0 bg-white/90 backdrop-blur-sm z-10 border-b border-gray-200/70">
                      <tr className="text-left bg-gray-50/80">
                        <Th>#</Th>
                        <Th>Adjustment #</Th>
                        <Th>Date</Th>
                        <Th>Product</Th>
                        <Th>Batch</Th>
                        <Th>Expiry</Th>
                        <Th align="right">Prev Qty</Th>
                        <Th align="right">Actual Qty</Th>
                        <Th align="right">Diff Qty</Th>
                        <Th align="right">Unit Price</Th>
                        <Th align="right">Worth Adj.</Th>
                        <Th>Reason/Note</Th>
                        <Th>User</Th>
                      </tr>
                    </thead>

                    <tbody className="tabular-nums">
                      {rows.map((row, idx) => {
                        const items = row.items || [];
                        if (items.length === 0) {
                          return (
                            <tr key={`row-${row.id || idx}`} className="odd:bg-white/90 even:bg-white/70">
                              <Td colSpan={13} className="text-gray-400 italic">
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
                              className="transition-all duration-150 odd:bg-white/90 even:bg-white/70 hover:bg-white/80 hover:backdrop-blur-[2px]"
                            >
                              <Td>{idx + 1}</Td>
                              <Td className="font-medium">{row.posted_number || "-"}</Td>
                              <Td>{fmtDate(row.posted_date)}</Td>
                              <Td className="font-medium">
                                {item.product_name || "-"}
                                <div className="text-xs text-gray-500">{item.product_code}</div>
                              </Td>
                              <Td>{item.batch_number || "-"}</Td>
                              <Td>{fmtDate(item.expiry)}</Td>
                              <Td align="right">{fmtNumber(item.previous_qty)}</Td>
                              <Td align="right">{fmtNumber(item.actual_qty)}</Td>
                              <Td
                                align="right"
                                className={`font-semibold ${
                                  isPositive ? "text-green-600" : isNegative ? "text-red-600" : ""
                                }`}
                              >
                                {item.diff_qty > 0 ? "+" : ""}
                                {fmtNumber(item.diff_qty)}
                              </Td>
                              <Td align="right">{fmtCurrency(item.unit_purchase_price)}</Td>
                              <Td
                                align="right"
                                className={item.worth_adjusted >= 0 ? "text-emerald-700" : "text-red-700"}
                              >
                                {fmtCurrency(item.worth_adjusted)}
                              </Td>
                              <Td className="max-w-xs truncate" title={row.note}>
                                {row.note || "-"}
                              </Td>
                              <Td>{row.user_name || "-"}</Td>
                            </tr>
                          );
                        });
                      })}

                      {(!rows || rows.length === 0) && (
                        <tr>
                          <td colSpan={13} className="px-3 py-6 text-center text-gray-500">
                            No stock adjustments found.
                          </td>
                        </tr>
                      )}
                    </tbody>

                    <tfoot className="border-t-2 border-gray-300 bg-white/80 backdrop-blur-sm font-semibold">
                      <tr className="bg-gray-50">
                        <Td colSpan={6} align="right" strong>TOTALS</Td>
                        <Td align="right">-</Td>
                        <Td align="right">-</Td>
                        <Td align="right">-</Td>
                        <Td align="right">-</Td>
                        <Td align="right" className="text-emerald-800">
                          {fmtCurrency(summary.total_worth_adjusted)}
                        </Td>
                        <Td colSpan={4}></Td>
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
function Th({ children, align = "left" }) {
  return (
    <th className={`px-3 py-2 font-medium ${align === "right" ? "text-right" : "text-left"}`}>
      {children}
    </th>
  );
}

function Td({ children, align = "left", colSpan, strong = false, className = "" }) {
  return (
    <td
      colSpan={colSpan}
      className={[
        "px-3 py-2 border-t border-gray-200/70",
        align === "right" ? "text-right" : "text-left",
        strong ? "font-medium text-gray-800" : "",
        className,
      ].join(" ")}
    >
      {children}
    </td>
  );
}

