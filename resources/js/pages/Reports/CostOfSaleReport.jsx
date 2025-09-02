// CostOfSaleReport.jsx
import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";

// ===== Helpers =====
const todayStr = () => new Date().toISOString().split("T")[0];
const firstDayOfMonthStr = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split("T")[0];
};
const n = (v) => (isFinite(Number(v)) ? Number(v) : 0);
const fmtCurrency = (v) =>
  n(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtPct = (v) =>
  n(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "%";

export default function CostOfSaleReport() {
  const [fromDate, setFromDate] = useState(firstDayOfMonthStr());
  const [toDate, setToDate] = useState(todayStr());
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  // Fetch report (expects API: GET /api/reports/cost-of-sale?from=YYYY-MM-DD&to=YYYY-MM-DD)
  const fetchReport = async () => {
    setLoading(true);
    try {
      const res = await axios.get("/api/reports/cost-of-sale", {
        params: { from: fromDate, to: toDate },
      });
      const data = Array.isArray(res.data) ? res.data : Array.isArray(res.data?.data) ? res.data.data : [];
      setRows(
        data.map((r) => ({
          sale_date: r.sale_date || r.date || "",
          gross_sale: n(r.gross_sale),
          item_discount: n(r.item_discount),
          discount_amount: n(r.discount_amount), // Flat Discount
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

  useEffect(() => {
    fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const onSubmit = (e) => {
    e.preventDefault();
    // Basic guard
    if (!fromDate || !toDate) {
      toast.error("Please select both dates.");
      return;
    }
    if (fromDate > toDate) {
      toast.error("From Date cannot be after To Date.");
      return;
    }
    fetchReport();
  };

  return (
    <div className="p-4">
      {/* Heading */}
      <h1 className="text-xl font-semibold mb-3">Cost Of Sale Report</h1>

      {/* Filter Form */}
      <form onSubmit={onSubmit} className="mb-4 bg-white rounded-lg p-3 shadow-sm border border-gray-200">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col">
            <label className="text-sm text-gray-600 mb-1">From Date</label>
            <input
              type="date"
              className="border rounded-md px-2 py-1.5 text-sm min-w-[180px] focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>

          <div className="flex flex-col">
            <label className="text-sm text-gray-600 mb-1">To Date</label>
            <input
              type="date"
              className="border rounded-md px-2 py-1.5 text-sm min-w-[180px] focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>

          <button
            type="submit"
            className="h-9 px-4 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            disabled={loading}
            title="Submit (Fetch Report)"
          >
            {loading ? "Loading..." : "Submit"}
          </button>
        </div>
      </form>

      {/* Table */}
      <div className="overflow-auto bg-white rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-[1100px] w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
            <tr className="text-gray-700">
              <th className="text-left px-3 py-2">Sale Date</th>
              <th className="text-right px-3 py-2">Gross Sale</th>
              <th className="text-right px-3 py-2">Item Discount</th>
              <th className="text-right px-3 py-2">Flat Discount</th>
              <th className="text-right px-3 py-2">Tax Amount</th>
              <th className="text-right px-3 py-2">Total Sales</th>
              <th className="text-right px-3 py-2">Sale Return</th>
              <th className="text-right px-3 py-2">Net Sale</th>
              <th className="text-right px-3 py-2">Cost of Sales</th>
              <th className="text-right px-3 py-2">Gross Profit (Amt)</th>
              <th className="text-right px-3 py-2">Gross Profit %</th>
            </tr>
          </thead>

          <tbody>
            {computed.withDerived.length === 0 && !loading && (
              <tr>
                <td colSpan={11} className="px-3 py-6 text-center text-gray-500">
                  No data found for the selected dates.
                </td>
              </tr>
            )}

            {computed.withDerived.map((r, idx) => (
              <tr
                key={r.sale_date + "_" + idx}
                className={idx % 2 ? "bg-white" : "bg-gray-50/50"}
              >
                <td className="px-3 py-2 text-gray-800">{r.sale_date}</td>
                <td className="px-3 py-2 text-right">{fmtCurrency(r.gross_sale)}</td>
                <td className="px-3 py-2 text-right">{fmtCurrency(r.item_discount)}</td>
                <td className="px-3 py-2 text-right">{fmtCurrency(r.discount_amount)}</td>
                <td className="px-3 py-2 text-right">{fmtCurrency(r.tax_amount)}</td>
                <td className="px-3 py-2 text-right">{fmtCurrency(r.total_sales)}</td>
                <td className="px-3 py-2 text-right">{fmtCurrency(r.sale_return)}</td>
                <td className="px-3 py-2 text-right font-medium">{fmtCurrency(r.net_sale)}</td>
                <td className="px-3 py-2 text-right">{fmtCurrency(r.cost_of_sales)}</td>
                <td className="px-3 py-2 text-right font-medium">
                  {fmtCurrency(r.gp_amount)}
                </td>
                <td className="px-3 py-2 text-right">
                  {fmtPct(r.gp_pct)}
                </td>
              </tr>
            ))}
          </tbody>

          {/* Totals */}
          <tfoot className="border-t border-gray-200 bg-gray-50">
            <tr className="font-semibold text-gray-800">
              <td className="px-3 py-2 text-right">Totals:</td>
              <td className="px-3 py-2 text-right">{fmtCurrency(computed.totals.gross_sale)}</td>
              <td className="px-3 py-2 text-right">{fmtCurrency(computed.totals.item_discount)}</td>
              <td className="px-3 py-2 text-right">{fmtCurrency(computed.totals.discount_amount)}</td>
              <td className="px-3 py-2 text-right">{fmtCurrency(computed.totals.tax_amount)}</td>
              <td className="px-3 py-2 text-right">{fmtCurrency(computed.totals.total_sales)}</td>
              <td className="px-3 py-2 text-right">{fmtCurrency(computed.totals.sale_return)}</td>
              <td className="px-3 py-2 text-right">{fmtCurrency(computed.totals.net_sale)}</td>
              <td className="px-3 py-2 text-right">{fmtCurrency(computed.totals.cost_of_sales)}</td>
              <td className="px-3 py-2 text-right">{fmtCurrency(computed.totals.gp_amount)}</td>
              <td className="px-3 py-2 text-right">{fmtPct(computed.totals_gp_pct)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}


