// resources/js/pages/CostOfSaleReport.jsx
import { useMemo, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { usePermissions } from "@/api/usePermissions";
import { useTheme } from "@/context/ThemeContext";
import {
  GlassCard,
  GlassSectionHeader,
  GlassToolbar,
  GlassInput,
  GlassBtn,
} from "@/components/glass.jsx";
import { ArrowPathIcon } from "@heroicons/react/24/solid";

/* ========== Helpers ========== */
const todayStr = () => new Date().toISOString().split("T")[0];
const yesterdayStr = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0];
};
const n = (v) => (isFinite(Number(v)) ? Number(v) : 0);
const fmtCurrency = (v) =>
  n(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtPct = (v) =>
  n(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "%";

export default function CostOfSaleReport() {
  // Default from = yesterday, to = today
  const [fromDate, setFromDate] = useState(yesterdayStr());
  const [toDate, setToDate] = useState(todayStr());
  const [invoiceType, setInvoiceType] = useState("all"); // all, credit, debit
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const perms = usePermissions();
  const hasFn = perms?.has;
  const permsReady = typeof hasFn === "function";
  const canView = permsReady ? !!hasFn("report.cost-of-sale.view") : null;

  // Get dark mode state
  const { isDark } = useTheme();

  // tints
  const tintPrimary =
    "bg-slate-900/80 text-white ring-1 ring-white/15 shadow-[0_6px_20px_-6px_rgba(15,23,42,0.45)] hover:bg-slate-900/90";
  const tintGhost = isDark ? "bg-slate-800/60 text-slate-200 ring-1 ring-slate-700/50 hover:bg-slate-800/80" : "bg-white/60 text-slate-700 ring-1 ring-white/30 hover:bg-white/75";

  // === Fetch report only when user clicks Apply/Load ===
  const fetchReport = async ({ silentDenied = false } = {}) => {
    if (canView !== true) {
      if (!silentDenied) toast.error("You don't have permission to view this report.");
      return;
    }
    if (!fromDate || !toDate) return toast.error("Please select both dates.");
    if (fromDate > toDate) return toast.error("From Date cannot be after To Date.");

    setLoading(true);
    try {
      const res = await axios.get("/api/reports/cost-of-sale", {
        params: { from: fromDate, to: toDate, invoice_type: invoiceType },
      });
      const data = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data?.data)
        ? res.data.data
        : [];
      setRows(
        data.map((r) => ({
          sale_date: r.sale_date || r.date || "",
          gross_sale: n(r.gross_sale),
          item_discount: n(r.item_discount),
          discount_amount: n(r.discount_amount),
          tax_amount: n(r.tax_amount),
          total_sales: n(r.total_sales),
          sale_return: n(r.sale_return),
          cost_of_sales: n(r.cost_of_sales),
        }))
      );
    } catch (err) {
      console.error(err);
      toast.error("Failed to load Cost of Sale report");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  // Remove auto-load effect on mount (no useEffect)

  const computed = useMemo(() => {
    const withDerived = rows.map((r) => {
      const net_sale = n(r.total_sales) - n(r.sale_return);
      const gp_amount = net_sale - n(r.cost_of_sales);
      const gp_pct = net_sale > 0 ? (gp_amount / net_sale) * 100 : 0;
      return { ...r, net_sale, gp_amount, gp_pct };
    });

    const totals = withDerived.reduce(
      (acc, r) => {
        acc.gross_sale += r.gross_sale;
        acc.item_discount += r.item_discount;
        acc.discount_amount += r.discount_amount;
        acc.tax_amount += r.tax_amount;
        acc.total_sales += r.total_sales;
        acc.sale_return += r.sale_return;
        acc.net_sale += r.net_sale;
        acc.cost_of_sales += r.cost_of_sales;
        acc.gp_amount += r.gp_amount;
        return acc;
      },
      {
        gross_sale: 0,
        item_discount: 0,
        discount_amount: 0,
        tax_amount: 0,
        total_sales: 0,
        sale_return: 0,
        net_sale: 0,
        cost_of_sales: 0,
        gp_amount: 0,
      }
    );
    const totals_gp_pct = totals.net_sale > 0 ? (totals.gp_amount / totals.net_sale) * 100 : 0;

    return { withDerived, totals, totals_gp_pct };
  }, [rows]);

  const applyRange = () => {
    fetchReport({ silentDenied: false });
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header + Filters */}
      <GlassCard>
        <GlassSectionHeader
          title={<span className={`font-semibold ${isDark ? "text-slate-200" : ""}`}>Cost of Sale Report</span>}
          right={
            <div className="flex gap-2">
              <GlassBtn
                className={`h-9 ${tintGhost}`}
                title="Reset to Default (Yesterday → Today)"
                onClick={() => {
                  setFromDate(yesterdayStr());
                  setToDate(todayStr());
                  setRows([]);
                }}
              >
                Reset
              </GlassBtn>
              <GlassBtn
                className={`h-9 ${tintPrimary}`}
                title="Load / Refresh"
                onClick={() => fetchReport()}
                disabled={canView !== true || loading}
              >
                <span className="inline-flex items-center gap-2">
                  <ArrowPathIcon className="w-5 h-5" />
                  {loading ? "Loading…" : "Load"}
                </span>
              </GlassBtn>
            </div>
          }
        />

        {/* Filter toolbar */}
        <GlassToolbar className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-8 gap-3">
          <div className="sm:col-span-1 lg:col-span-2">
            <label className={`text-sm mb-1 block ${isDark ? "text-slate-300" : "text-gray-700"}`}>From</label>
            <GlassInput type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-full" />
          </div>
          <div className="sm:col-span-1 lg:col-span-2">
            <label className={`text-sm mb-1 block ${isDark ? "text-slate-300" : "text-gray-700"}`}>To</label>
            <GlassInput type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-full" />
          </div>
          
          {/* Invoice Type Filter - Dropdown */}
          <div className="sm:col-span-1 lg:col-span-2">
            <label className={`text-sm mb-1 block ${isDark ? "text-slate-300" : "text-gray-700"}`}>Sale Type</label>
            <div className="relative">
              <select
                value={invoiceType}
                onChange={(e) => setInvoiceType(e.target.value)}
                className={`w-full h-9 px-3 pr-8 text-sm border-2 rounded-lg appearance-none focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 cursor-pointer transition-all duration-200 ${
                  isDark 
                    ? "bg-slate-800 border-slate-600 text-slate-200" 
                    : "bg-white border-gray-200 text-gray-900"
                }`}
              >
                <option value="all">All Sales</option>
                <option value="credit">Credit Sales</option>
                <option value="debit">Debit Sales</option>
              </select>
              {/* Custom dropdown arrow */}
              <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                <svg className={`w-4 h-4 ${isDark ? "text-slate-400" : "text-gray-500"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

          <div className="sm:col-span-1 lg:col-span-2 flex flex-wrap items-end gap-2">
            <GlassBtn
              className={`h-9 min-w-[100px] ${tintPrimary}`}
              onClick={applyRange}
              title="Apply"
              disabled={canView !== true || loading}
            >
              Apply
            </GlassBtn>

            {/* Quick date filters */}
            <GlassBtn
              className={`h-9 ${tintGhost}`}
              onClick={() => {
                const end = new Date();
                const start = new Date();
                start.setDate(end.getDate() - 1);
                setFromDate(start.toISOString().slice(0, 10));
                setToDate(end.toISOString().slice(0, 10));
              }}
            >
              Today
            </GlassBtn>

            <GlassBtn
              className={`h-9 ${tintGhost}`}
              onClick={() => {
                const end = new Date();
                const start = new Date();
                start.setDate(end.getDate() - 3);
                setFromDate(start.toISOString().slice(0, 10));
                setToDate(end.toISOString().slice(0, 10));
              }}
            >
              3 Days
            </GlassBtn>

            <GlassBtn
              className={`h-9 ${tintGhost}`}
              onClick={() => {
                const end = new Date();
                const start = new Date();
                start.setDate(end.getDate() - 7);
                setFromDate(start.toISOString().slice(0, 10));
                setToDate(end.toISOString().slice(0, 10));
              }}
            >
              7 Days
            </GlassBtn>
          </div>
        </GlassToolbar>
      </GlassCard>

      {/* Permission & Data Views */}
      {canView === null && (
        <GlassCard>
          <div className={`px-4 py-3 text-sm ${isDark ? "text-slate-300" : "text-gray-700"}`}>Checking permissions…</div>
        </GlassCard>
      )}
      {canView === false && (
        <GlassCard>
          <div className={`px-4 py-3 text-sm ${isDark ? "text-slate-300" : "text-gray-700"}`}>
            You don't have permission to view this report.
          </div>
        </GlassCard>
      )}

      {canView === true && (
        <>
          {/* Table */}
          <GlassCard className="relative z-10">
            <div className="max-h-[75vh] overflow-auto rounded-b-2xl">
              <table className="min-w-[1100px] w-full text-sm">
                <thead className={`sticky top-0 backdrop-blur-sm z-10 border-b ${isDark ? "bg-slate-800/90" : "bg-white/90"}`}>
                  <tr className={`text-left ${isDark ? "text-slate-200" : "text-gray-900"}`}>
                    <th className="px-3 py-2 font-medium">Date</th>
                    <th className="px-3 py-2 font-medium text-right">Gross Sale</th>
                    <th className="px-3 py-2 font-medium text-right">Item Disc.</th>
                    <th className="px-3 py-2 font-medium text-right">Flat Disc.</th>
                    <th className="px-3 py-2 font-medium text-right">Tax</th>
                    <th className="px-3 py-2 font-medium text-right">Total Sales</th>
                    <th className="px-3 py-2 font-medium text-right">Sale Return</th>
                    <th className="px-3 py-2 font-medium text-right">Net Sale</th>
                    <th className="px-3 py-2 font-medium text-right">Cost of Sales</th>
                    <th className="px-3 py-2 font-medium text-right">GP (Amt)</th>
                    <th className="px-3 py-2 font-medium text-right">GP %</th>
                  </tr>
                </thead>

                <tbody>
                  {computed.withDerived.length === 0 && !loading && (
                    <tr>
                      <td colSpan={11} className={`px-3 py-10 text-center ${isDark ? "text-slate-400" : "text-gray-600"}`}>
                        No data for the selected date range.
                      </td>
                    </tr>
                  )}

                  {computed.withDerived.map((r, idx) => (
                    <tr
                      key={r.sale_date + "_" + idx}
                      className={`transition-all duration-200 ${
                        isDark 
                          ? "odd:bg-slate-800/80 even:bg-slate-800/60 hover:bg-slate-700/80" 
                          : "odd:bg-white/80 even:bg-white/60 hover:bg-white/80"
                      }`}
                    >
                      <td className={`px-3 py-2 ${isDark ? "text-slate-300" : ""}`}>{r.sale_date}</td>
                      <td className={`px-3 py-2 text-right tabular-nums ${isDark ? "text-slate-300" : ""}`}>{fmtCurrency(r.gross_sale)}</td>
                      <td className={`px-3 py-2 text-right tabular-nums ${isDark ? "text-slate-300" : ""}`}>{fmtCurrency(r.item_discount)}</td>
                      <td className={`px-3 py-2 text-right tabular-nums ${isDark ? "text-slate-300" : ""}`}>{fmtCurrency(r.discount_amount)}</td>
                      <td className={`px-3 py-2 text-right tabular-nums ${isDark ? "text-slate-300" : ""}`}>{fmtCurrency(r.tax_amount)}</td>
                      <td className={`px-3 py-2 text-right tabular-nums ${isDark ? "text-slate-300" : ""}`}>{fmtCurrency(r.total_sales)}</td>
                      <td className={`px-3 py-2 text-right tabular-nums ${isDark ? "text-slate-300" : ""}`}>{fmtCurrency(r.sale_return)}</td>
                      <td className={`px-3 py-2 text-right tabular-nums font-medium ${isDark ? "text-slate-200" : ""}`}>{fmtCurrency(r.net_sale)}</td>
                      <td className={`px-3 py-2 text-right tabular-nums ${isDark ? "text-slate-300" : ""}`}>{fmtCurrency(r.cost_of_sales)}</td>
                      <td className={`px-3 py-2 text-right tabular-nums font-medium ${isDark ? "text-slate-200" : ""}`}>{fmtCurrency(r.gp_amount)}</td>
                      <td className={`px-3 py-2 text-right tabular-nums ${isDark ? "text-slate-300" : ""}`}>{fmtPct(r.gp_pct)}</td>
                    </tr>
                  ))}
                </tbody>

                <tfoot className={`border-t ${isDark ? "border-slate-600 bg-slate-800/80" : "border-gray-200 bg-white/80"} backdrop-blur-sm`}>
                  <tr className={`font-semibold ${isDark ? "text-slate-200" : "text-gray-800"}`}>
                    <td className="px-3 py-2 text-right">Total</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtCurrency(computed.totals.gross_sale)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtCurrency(computed.totals.item_discount)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtCurrency(computed.totals.discount_amount)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtCurrency(computed.totals.tax_amount)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtCurrency(computed.totals.total_sales)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtCurrency(computed.totals.sale_return)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtCurrency(computed.totals.net_sale)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtCurrency(computed.totals.cost_of_sales)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtCurrency(computed.totals.gp_amount)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtPct(computed.totals_gp_pct)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </GlassCard>

          {/* KPI Summary */}
          <GlassCard>
            <div className="px-4 py-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 text-sm">
              <Stat isDark={isDark} label="Net Sale" highlight value={fmtCurrency(computed.totals.net_sale)} />
              <Stat isDark={isDark} label="Cost of Sales" value={fmtCurrency(computed.totals.cost_of_sales)} />
              <Stat isDark={isDark} label="Gross Profit (Amt)" value={fmtCurrency(computed.totals.gp_amount)} />
              <Stat isDark={isDark} label="Gross Profit %" value={fmtPct(computed.totals_gp_pct)} />
              <Stat isDark={isDark} label="Gross Sale" value={fmtCurrency(computed.totals.gross_sale)} />
              <Stat isDark={isDark} label="Total Sales" value={fmtCurrency(computed.totals.total_sales)} />
            </div>
          </GlassCard>
        </>
      )}

      <style>{`
        .tabular-nums { font-variant-numeric: tabular-nums; }
        @media print {
          input, button, select, [role="button"], .rs__control { display: none !important; }
          table { font-size: 11px; }
          thead { position: sticky; top: 0; }
        }
      `}</style>
    </div>
  );
}

/* ===== KPI Tile ===== */
function Stat({ isDark, label, value, highlight = false }) {
  return (
    <div
      className={[
        "group rounded-xl px-3 py-2 backdrop-blur-sm ring-1 shadow-sm transition-all duration-200",
        isDark 
          ? "bg-slate-800/55 ring-slate-700/50 hover:bg-slate-800/80 hover:ring-slate-600/40" 
          : "bg-white/55 ring-white/30 hover:bg-white/80 hover:ring-white/40",
        highlight ? "outline outline-1 outline-blue-200/50" : "",
      ].join(" ")}
    >
      <div className={`text-xs ${isDark ? "text-slate-400" : "text-gray-600"}`}>{label}</div>
      <div className={`text-base font-semibold tabular-nums ${isDark ? "text-slate-200" : ""}`}>{value}</div>
    </div>
  );
}

