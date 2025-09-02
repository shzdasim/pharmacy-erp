import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import Select from "react-select";
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
} from "recharts";

/* ===================== Helpers ===================== */

// Local ISO date (avoid UTC off-by-one)
const localISODate = (d = new Date()) => {
  const tzOffsetMs = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffsetMs).toISOString().slice(0, 10);
};

const todayStr = () => localISODate();

const firstDayOfMonthStr = () => {
  const d = new Date();
  return localISODate(new Date(d.getFullYear(), d.getMonth(), 1));
};

const fmtCurrency = (n) => {
  const v = Number(n || 0);
  return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const sum = (arr) => arr.reduce((a, b) => a + (Number(b) || 0), 0);

const dateKey = (d) =>
  typeof d === "string" ? d.substring(0, 10) : new Date(d).toISOString().substring(0, 10);

const inclusiveDaysUTC = (fromStr, toStr) => {
  const a = new Date(fromStr),
    b = new Date(toStr);
  const ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.floor((ub - ua) / 86400000) + 1;
};

// Build an empty series for a given date range (ensures continuous x-axis).
const scaffoldSeries = (from, to) => {
  const days = inclusiveDaysUTC(from, to);
  const data = [];
  const start = new Date(from);
  for (let i = 0; i < days; i++) {
    const d = new Date(Date.UTC(start.getFullYear(), start.getMonth(), start.getDate() + i));
    const key = d.toISOString().substring(0, 10);
    data.push({ date: key, value: 0 });
  }
  return data;
};

// Merge raw points ({date, value}) into scaffold ensuring continuity
const mergeSeries = (base, points) => {
  const map = new Map(base.map((p) => [p.date, { ...p }]));
  for (const pt of points || []) {
    const k = dateKey(pt.date);
    map.set(k, { date: k, value: (map.get(k)?.value || 0) + Number(pt.value || 0) });
  }
  return Array.from(map.values());
};

// Merge two series arrays (same date domain) into {date, a, b}
function mergeTwo(a = [], b = []) {
  const map = new Map();
  for (const r of a) map.set(r.date, { date: r.date, a: Number(r.value || 0), b: 0 });
  for (const r of b) {
    const row = map.get(r.date) || { date: r.date, a: 0, b: 0 };
    row.b += Number(r.value || 0);
    map.set(r.date, row);
  }
  return Array.from(map.values());
}

function buildNetSeries(series) {
  const map = new Map();
  for (const row of series.sales || []) map.set(row.date, (map.get(row.date) || 0) + Number(row.value || 0));
  for (const row of series.saleReturns || [])
    map.set(row.date, (map.get(row.date) || 0) - Number(row.value || 0));
  return Array.from(map.entries()).map(([date, value]) => ({ date, value }));
}

/* ===================== React-Select styles (compact) ===================== */
const smallSelectStyles = {
  control: (base, state) => ({
    ...base,
    minHeight: 34,
    height: 34,
    paddingLeft: 4,
    borderColor: state.isFocused ? "#3b82f6" : base.borderColor,
    boxShadow: state.isFocused ? "0 0 0 1px #3b82f6" : "none",
    "&:hover": { borderColor: "#3b82f6" },
    fontSize: "0.875rem",
  }),
  valueContainer: (base) => ({ ...base, padding: "0 6px" }),
  indicatorsContainer: (base) => ({ ...base, height: 34 }),
  dropdownIndicator: (base) => ({ ...base, padding: "0 6px" }),
  clearIndicator: (base) => ({ ...base, padding: "0 6px" }),
  input: (base) => ({ ...base, margin: 0, padding: 0 }),
  option: (base, state) => ({
    ...base,
    fontSize: "0.875rem",
    backgroundColor: state.isFocused ? "#eff6ff" : state.isSelected ? "#dbeafe" : "white",
    color: "#111827",
  }),
  menu: (base) => ({ ...base, zIndex: 30 }),
};

/* ===================== Component ===================== */
export default function Dashboard() {
  // Filters — default to *today*
  const [from, setFrom] = useState(todayStr());
  const [to, setTo] = useState(todayStr());

  // Near Expiry filters
  const [expiryMonths, setExpiryMonths] = useState(3); // default 3 months
  const [supplierId, setSupplierId] = useState("");
  const [brandId, setBrandId] = useState("");

  // react-select values
  const [supplierValue, setSupplierValue] = useState({ value: "", label: "All Suppliers" });
  const [brandValue, setBrandValue] = useState({ value: "", label: "All Brands" });

  // options for react-select
  const [supplierOptions, setSupplierOptions] = useState([{ value: "", label: "All Suppliers" }]);
  const [brandOptions, setBrandOptions] = useState([{ value: "", label: "All Brands" }]);

  const [nearExpiryRows, setNearExpiryRows] = useState([]);
  const [loadingExpiry, setLoadingExpiry] = useState(false);

  // Cards & charts
  const [loading, setLoading] = useState(false);
  const [cards, setCards] = useState({
    sales: 0,
    purchases: 0,
    saleReturns: 0,
    purchaseReturns: 0,
  });
  const [series, setSeries] = useState({
    sales: [],
    purchases: [],
    saleReturns: [],
    purchaseReturns: [],
  });

  const netSales = useMemo(() => (cards.sales || 0) - (cards.saleReturns || 0), [cards]);

  /* ===================== Effects ===================== */
  useEffect(() => {
    fetchAll();
    const onKey = (e) => {
      if (e.altKey && (e.key === "r" || e.key === "R")) {
        e.preventDefault();
        fetchAll();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

  useEffect(() => {
    // Load Supplier/Brand options once
    fetchExpiryFilters();
  }, []);

  useEffect(() => {
    // Fetch near-expiry whenever filters change
    fetchNearExpiry();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expiryMonths, supplierId, brandId]);

  /* ===================== API Calls ===================== */
  async function fetchExpiryFilters() {
    try {
      const { data } = await axios.get("/api/dashboard/near-expiry/filters");
      const sup = (data?.suppliers || []).map((s) => ({ value: String(s.id), label: s.name }));
      const br = (data?.brands || []).map((b) => ({ value: String(b.id), label: b.name }));

      const supOpts = [{ value: "", label: "All Suppliers" }, ...sup];
      const brOpts = [{ value: "", label: "All Brands" }, ...br];

      setSupplierOptions(supOpts);
      setBrandOptions(brOpts);

      // Keep previously-selected value in list if possible
      const currentSup = supOpts.find((o) => o.value === supplierValue.value) || supOpts[0];
      const currentBr = brOpts.find((o) => o.value === brandValue.value) || brOpts[0];
      setSupplierValue(currentSup);
      setBrandValue(currentBr);
    } catch (err) {
      console.error(err);
      // Soft fail
    }
  }

  async function fetchNearExpiry() {
    setLoadingExpiry(true);
    try {
      const params = {
        months: expiryMonths,
        supplier_id: supplierId || undefined,
        brand_id: brandId || undefined,
      };
      const { data } = await axios.get("/api/dashboard/near-expiry", { params });
      setNearExpiryRows(Array.isArray(data?.rows) ? data.rows : []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load near expiry data.");
    } finally {
      setLoadingExpiry(false);
    }
  }

  async function fetchAll() {
    const f = from || todayStr();
    const t = to || todayStr();
    setLoading(true);

    // Preferred: aggregated endpoint
    try {
      const { data } = await axios.get("/api/dashboard/summary", {
        params: { date_from: f, date_to: t },
      });

      const scaf = scaffoldSeries(f, t);
      setCards({
        sales: Number(data?.totals?.sales || 0),
        purchases: Number(data?.totals?.purchases || 0),
        saleReturns: Number(data?.totals?.sale_returns || 0),
        purchaseReturns: Number(data?.totals?.purchase_returns || 0),
      });
      setSeries({
        sales: mergeSeries(scaf, data?.series?.sales || []),
        purchases: mergeSeries(scaf, data?.series?.purchases || []),
        saleReturns: mergeSeries(scaf, data?.series?.sale_returns || []),
        purchaseReturns: mergeSeries(scaf, data?.series?.purchase_returns || []),
      });
      setLoading(false);
      return;
    } catch (e) {
      // Fall through to client-side build if aggregated API is not available
    }

    // Fallback: build client-side from index lists
    try {
      const [salesRes, purchaseRes, sretRes, pretRes] = await Promise.all([
        axios.get("/api/sale-invoices"),
        axios.get("/api/purchase-invoices"),
        axios.get("/api/sale-returns"),
        axios.get("/api/purchase-returns"),
      ]);

      const inRange = (dstr) => {
        const k = dateKey(dstr);
        return k >= f && k <= t;
      };

      const sales = (salesRes.data || []).filter((x) => inRange(x.date));
      // purchases business date: posted_date (fallback to created_at or date)
      const purchases = (purchaseRes.data || []).filter((x) =>
        inRange(x.posted_date || x.created_at || x.date)
      );
      const saleReturns = (sretRes.data || []).filter((x) => inRange(x.date));
      const purchaseReturns = (pretRes.data || []).filter((x) => inRange(x.date));

      const totalSales = sum(sales.map((x) => Number(x.total || 0)));
      const totalPurchases = sum(purchases.map((x) => Number(x.total_amount || 0)));
      const totalSaleReturns = sum(saleReturns.map((x) => Number(x.total || 0)));
      const totalPurchaseReturns = sum(purchaseReturns.map((x) => Number(x.total || 0)));

      const scaf = scaffoldSeries(f, t);
      const grp = (rows, dateGetter, totalGetter) => {
        const map = new Map();
        for (const r of rows) {
          const k = dateKey(dateGetter(r));
          map.set(k, (map.get(k) || 0) + Number(totalGetter(r)));
        }
        return Array.from(map.entries()).map(([date, value]) => ({ date, value }));
      };

      setCards({
        sales: totalSales,
        purchases: totalPurchases,
        saleReturns: totalSaleReturns,
        purchaseReturns: totalPurchaseReturns,
      });
      setSeries({
        sales: mergeSeries(scaf, grp(sales, (r) => r.date, (r) => r.total || 0)),
        purchases: mergeSeries(
          scaf,
          grp(purchases, (r) => r.posted_date || r.created_at || r.date, (r) => r.total_amount || 0)
        ),
        saleReturns: mergeSeries(scaf, grp(saleReturns, (r) => r.date, (r) => r.total || 0)),
        purchaseReturns: mergeSeries(scaf, grp(purchaseReturns, (r) => r.date, (r) => r.total || 0)),
      });
    } catch (err) {
      console.error(err);
      toast.error("Failed to load dashboard.");
    } finally {
      setLoading(false);
    }
  }

  /* ===================== UI ===================== */
  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-semibold">Business Dashboard</h1>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-2 text-sm">
        <div className="flex flex-col">
          <label className="text-gray-700">From</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="border rounded px-2 py-1 h-9"
          />
        </div>
        <div className="flex flex-col">
          <label className="text-gray-700">To</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="border rounded px-2 py-1 h-9"
          />
        </div>

        {/* Preset buttons in a single row */}
        <div
          className="
            md:col-span-3 col-span-1
            flex items-end gap-2
            flex-nowrap whitespace-nowrap overflow-x-auto
            py-1
          "
        >
          <button
            onClick={() => {
              setFrom(todayStr());
              setTo(todayStr());
            }}
            className="bg-gray-100 border px-2 py-1 rounded hover:bg-gray-200 shrink-0"
          >
            Today
          </button>
          <button
            onClick={() => {
              setFrom(firstDayOfMonthStr());
              setTo(todayStr());
            }}
            className="bg-gray-100 border px-2 py-1 rounded hover:bg-gray-200 shrink-0"
          >
            This Month
          </button>
          <button
            onClick={() => {
              const d = new Date();
              const toStr = todayStr();
              const fromDate = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate() - 6));
              const fromStr = fromDate.toISOString().substring(0, 10);
              setFrom(fromStr);
              setTo(toStr);
            }}
            className="bg-gray-100 border px-2 py-1 rounded hover:bg-gray-200 shrink-0"
          >
            Last 7 Days
          </button>
          <button
            onClick={() => {
              const d = new Date();
              const toStr = todayStr();
              const fromDate = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate() - 29));
              const fromStr = fromDate.toISOString().substring(0, 10);
              setFrom(fromStr);
              setTo(toStr);
            }}
            className="bg-gray-100 border px-2 py-1 rounded hover:bg-gray-200 shrink-0"
          >
            Last 30 Days
          </button>
        </div>

        <div className="flex items-end justify-end">
          <button
            onClick={fetchAll}
            disabled={loading}
            className="bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700 disabled:opacity-60"
            title="Alt+R"
          >
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="Sales" value={`Rs ${fmtCurrency(cards.sales)}`} series={series.sales} color="#2563eb" />
        <StatCard title="Purchases" value={`Rs ${fmtCurrency(cards.purchases)}`} series={series.purchases} color="#16a34a" />
        <StatCard title="Sale Returns" value={`Rs ${fmtCurrency(cards.saleReturns)}`} series={series.saleReturns} color="#dc2626" />
        <StatCard title="Purchase Returns" value={`Rs ${fmtCurrency(cards.purchaseReturns)}`} series={series.purchaseReturns} color="#a855f7" />
      </div>

      {/* ===== Near Expiry Table (compact, modern) ===== */}
      <div className="rounded-lg border shadow-sm">
        <div className="px-3 pt-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold">Near Expiry</h2>

            {/* Single-line compact header controls */}
            <div className="flex items-center gap-2 flex-nowrap overflow-x-auto whitespace-nowrap py-1">
              {/* Months range buttons */}
              <div className="flex items-center gap-1">
                {[
                  { m: 1, label: "1 mo" },
                  { m: 3, label: "3 mo" },
                  { m: 6, label: "6 mo" },
                  { m: 12, label: "1 yr" },
                  { m: 18, label: "1.5 yr" },
                ].map((opt) => (
                  <button
                    key={opt.m}
                    onClick={() => setExpiryMonths(opt.m)}
                    className={`px-2 py-1 rounded border text-sm shrink-0 ${
                      expiryMonths === opt.m
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-gray-100 hover:bg-gray-200"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Supplier select (react-select searchable) */}
              <div className="flex items-center gap-1 shrink-0" style={{ minWidth: 210 }}>
                <span className="text-gray-700 text-sm">Supplier</span>
                <div className="w-40">
                  <Select
                    classNamePrefix="rs"
                    isSearchable
                    menuPlacement="auto"
                    options={supplierOptions}
                    value={supplierValue}
                    onChange={(opt) => {
                      setSupplierValue(opt || { value: "", label: "All Suppliers" });
                      setSupplierId(opt?.value || "");
                    }}
                    styles={smallSelectStyles}
                  />
                </div>
              </div>

              {/* Brand select (react-select searchable) */}
              <div className="flex items-center gap-1 shrink-0" style={{ minWidth: 190 }}>
                <span className="text-gray-700 text-sm">Brand</span>
                <div className="w-40">
                  <Select
                    classNamePrefix="rs"
                    isSearchable
                    menuPlacement="auto"
                    options={brandOptions}
                    value={brandValue}
                    onChange={(opt) => {
                      setBrandValue(opt || { value: "", label: "All Brands" });
                      setBrandId(opt?.value || "");
                    }}
                    styles={smallSelectStyles}
                  />
                </div>
              </div>

              <button
                onClick={() => {
                  const sup = { value: "", label: "All Suppliers" };
                  const br = { value: "", label: "All Brands" };
                  setSupplierValue(sup);
                  setBrandValue(br);
                  setSupplierId("");
                  setBrandId("");
                }}
                className="border px-2 py-1 rounded bg-gray-50 hover:bg-gray-100 text-sm shrink-0"
                title="Clear supplier/brand filters"
              >
                Clear
              </button>

              <button
                onClick={fetchNearExpiry}
                disabled={loadingExpiry}
                className="border px-3 py-1 rounded bg-white hover:bg-gray-50 disabled:opacity-60 text-sm shrink-0"
              >
                {loadingExpiry ? "Loading…" : "Refresh"}
              </button>
            </div>
          </div>
        </div>

        <div className="p-0 overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 bg-white/90 backdrop-blur z-10 border-b">
              <tr className="text-left text-gray-600">
                <th className="px-3 py-2 font-medium">Product</th>
                <th className="px-3 py-2 font-medium">Supplier</th>
                <th className="px-3 py-2 font-medium">Brand</th>
                <th className="px-3 py-2 font-medium">Batch #</th>
                <th className="px-3 py-2 font-medium">Expiry</th>
                <th className="px-3 py-2 font-medium text-right">Qty</th>
              </tr>
            </thead>
            <tbody>
              {nearExpiryRows.length === 0 ? (
                <tr>
                  <td className="px-3 py-4 text-gray-500" colSpan={6}>
                    {loadingExpiry ? "Loading…" : "No near-expiry items found for the selected filters."}
                  </td>
                </tr>
              ) : (
                nearExpiryRows.map((r) => (
                  <tr
                    key={`b-${r.batch_id}`}
                    className="odd:bg-white even:bg-gray-50 hover:bg-blue-50 transition-colors"
                  >
                    <td className="px-3 py-2">
                      <div className="max-w-[280px] truncate" title={r.product_name}>
                        {r.product_name}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="max-w-[220px] truncate" title={r.supplier_name || "—"}>
                        {r.supplier_name || "—"}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="max-w-[200px] truncate" title={r.brand_name || "—"}>
                        {r.brand_name || "—"}
                      </div>
                    </td>
                    <td className="px-3 py-2">{r.batch_number}</td>
                    <td className="px-3 py-2">{(r.expiry_date || "").slice(0, 10)}</td>
                    <td className="px-3 py-2 text-right">
                      {Number(r.quantity ?? 0).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Net Sales Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-3 border rounded p-3">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold">Net Sales Trend</h2>
            <div className="text-sm text-gray-600">Net = Sales − Sale Returns</div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={buildNetSeries(series)} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="netColor" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(val) => `Rs ${fmtCurrency(val)}`} />
                <Area type="monotone" dataKey="value" stroke="#0ea5e9" fill="url(#netColor)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Purchases vs Purchase Returns & Sales vs Sale Returns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="border rounded p-3">
          <h2 className="font-semibold mb-2">Purchases vs Returns</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={mergeTwo(series.purchases, series.purchaseReturns)}
                margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(val) => `Rs ${fmtCurrency(val)}`} />
                <Line type="monotone" dataKey="a" stroke="#16a34a" name="Purchases" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="b" stroke="#a855f7" name="Purchase Returns" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="border rounded p-3">
          <h2 className="font-semibold mb-2">Sales vs Sale Returns</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={mergeTwo(series.sales, series.saleReturns)} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(val) => `Rs ${fmtCurrency(val)}`} />
                <Line type="monotone" dataKey="a" stroke="#2563eb" name="Sales" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="b" stroke="#dc2626" name="Sale Returns" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ===================== Stat Card ===================== */
function StatCard({ title, value, series, color = "#2563eb" }) {
  return (
    <div className="border rounded p-3 flex flex-col gap-2">
      <div className="text-sm text-gray-600">{title}</div>
      <div className="text-2xl font-semibold">{value}</div>
      <div className="h-16">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={series || []} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`${title}-grad`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.5} />
                <stop offset="95%" stopColor={color} stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="value" stroke={color} fill={`url(#${title}-grad)`} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
