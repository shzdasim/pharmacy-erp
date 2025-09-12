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
import { GlassCard, GlassSectionHeader, GlassToolbar, GlassInput, GlassBtn } from "@/components/Glass";

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
  const a = new Date(fromStr), b = new Date(toStr);
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

/* ===================== React-Select styles (compact, glass-friendly) ===================== */
const smallSelectStyles = {
  control: (base, state) => ({
    ...base,
    minHeight: 36,
    height: 36,
    paddingLeft: 4,
    borderColor: state.isFocused ? "#3b82f6" : "rgba(229,231,235,0.7)",
    boxShadow: state.isFocused ? "0 0 0 2px rgba(59,130,246,0.4)" : "none",
    backgroundColor: "rgba(255,255,255,0.7)",
    backdropFilter: "blur(4px)",
    borderRadius: 12,
    fontSize: "0.875rem",
  }),
  valueContainer: (base) => ({ ...base, padding: "0 8px" }),
  indicatorsContainer: (base) => ({ ...base, height: 36 }),
  dropdownIndicator: (base) => ({ ...base, padding: "0 6px" }),
  clearIndicator: (base) => ({ ...base, padding: "0 6px" }),
  input: (base) => ({ ...base, margin: 0, padding: 0 }),
  option: (base, state) => ({
    ...base,
    fontSize: "0.875rem",
    backgroundColor: state.isFocused ? "#eff6ff" : state.isSelected ? "#dbeafe" : "white",
    color: "#111827",
  }),
  menu: (base) => ({ ...base, zIndex: 30, borderRadius: 12 }),
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
    <div className="p-4 space-y-4 bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Business Dashboard</h1>
        <GlassBtn onClick={fetchAll} disabled={loading} variant="primary" title="Alt+R">
          {loading ? "Loading…" : "Refresh"}
        </GlassBtn>
      </div>

      {/* Filters */}
      <GlassCard>
        <GlassToolbar className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <div className="flex flex-col">
            <label className="text-gray-700 text-sm">From</label>
            <GlassInput type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="flex flex-col">
            <label className="text-gray-700 text-sm">To</label>
            <GlassInput type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>

          {/* Presets */}
          <div className="md:col-span-3 col-span-1 flex items-end gap-2 overflow-x-auto whitespace-nowrap">
            <GlassBtn variant="ghost" onClick={() => { setFrom(todayStr()); setTo(todayStr()); }}>
              Today
            </GlassBtn>
            <GlassBtn variant="ghost" onClick={() => { setFrom(firstDayOfMonthStr()); setTo(todayStr()); }}>
              This Month
            </GlassBtn>
            <GlassBtn variant="ghost" onClick={() => {
              const d = new Date();
              const toStr = todayStr();
              const fromDate = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate() - 6));
              setFrom(fromDate.toISOString().substring(0, 10));
              setTo(toStr);
            }}>
              Last 7 Days
            </GlassBtn>
            <GlassBtn variant="ghost" onClick={() => {
              const d = new Date();
              const toStr = todayStr();
              const fromDate = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate() - 29));
              setFrom(fromDate.toISOString().substring(0, 10));
              setTo(toStr);
            }}>
              Last 30 Days
            </GlassBtn>
          </div>
        </GlassToolbar>
      </GlassCard>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="Sales" value={`Rs ${fmtCurrency(cards.sales)}`} series={series.sales} color="#2563eb" />
        <StatCard title="Purchases" value={`Rs ${fmtCurrency(cards.purchases)}`} series={series.purchases} color="#16a34a" />
        <StatCard title="Sale Returns" value={`Rs ${fmtCurrency(cards.saleReturns)}`} series={series.saleReturns} color="#dc2626" />
        <StatCard title="Purchase Returns" value={`Rs ${fmtCurrency(cards.purchaseReturns)}`} series={series.purchaseReturns} color="#a855f7" />
      </div>

      {/* ===== Near Expiry Table ===== */}
      <GlassCard>
        <GlassSectionHeader
          title="Near Expiry"
          right={
            <div className="flex items-center gap-2">
              {/* Months chips */}
              <div className="flex items-center gap-1">
                {[
                  { m: 1, label: "1 mo" },
                  { m: 3, label: "3 mo" },
                  { m: 6, label: "6 mo" },
                  { m: 12, label: "1 yr" },
                  { m: 18, label: "1.5 yr" },
                ].map((opt) => (
                  <GlassBtn
                    key={opt.m}
                    variant="chip"
                    onClick={() => setExpiryMonths(opt.m)}
                    className={expiryMonths === opt.m ? "bg-blue-600 text-white border-blue-600" : ""}
                  >
                    {opt.label}
                  </GlassBtn>
                ))}
              </div>

              {/* Supplier */}
              <div className="flex items-center gap-2 shrink-0" style={{ minWidth: 220 }}>
                <span className="text-gray-700 text-sm">Supplier</span>
                <div className="w-44 relative z-50">
                  <Select
                    classNamePrefix="rs"
                    isSearchable
                    menuPlacement="auto"
                    menuPosition="fixed"
                    menuPortalTarget={document.body}
                    options={supplierOptions}
                    value={supplierValue}
                    onChange={(opt) => {
                      setSupplierValue(opt || { value: "", label: "All Suppliers" });
                      setSupplierId(opt?.value || "");
                    }}
                    styles={{
                      ...smallSelectStyles,
                      menu: (base) => ({ ...base, zIndex: 9999 }),
                      menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                    }}
                  />
                </div>
              </div>

              {/* Brand */}
              <div className="flex items-center gap-2 shrink-0" style={{ minWidth: 200 }}>
                <span className="text-gray-700 text-sm">Brand</span>
                <div className="w-44 relative z-50">
                  <Select
                    classNamePrefix="rs"
                    isSearchable
                    menuPlacement="auto"
                    menuPosition="fixed"
                    menuPortalTarget={document.body}
                    options={brandOptions}
                    value={brandValue}
                    onChange={(opt) => {
                      setBrandValue(opt || { value: "", label: "All Brands" });
                      setBrandId(opt?.value || "");
                    }}
                    styles={{
                      ...smallSelectStyles,
                      menu: (base) => ({ ...base, zIndex: 9999 }),
                      menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                    }}
                  />
                </div>
              </div>

              <GlassBtn
                variant="ghost"
                onClick={() => {
                  const sup = { value: "", label: "All Suppliers" };
                  const br = { value: "", label: "All Brands" };
                  setSupplierValue(sup);
                  setBrandValue(br);
                  setSupplierId("");
                  setBrandId("");
                }}
                title="Clear supplier/brand filters"
              >
                Clear
              </GlassBtn>

              <GlassBtn onClick={fetchNearExpiry} disabled={loadingExpiry} variant="ghost">
                {loadingExpiry ? "Loading…" : "Refresh"}
              </GlassBtn>
            </div>
          }
        />

        <div className="p-0 overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="sticky top-[56px] bg-white/80 backdrop-blur-sm z-10 border-b border-gray-200/70">
              <tr className="text-left text-gray-700">
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
                  <td className="px-3 py-6 text-gray-500" colSpan={6}>
                    {loadingExpiry ? "Loading…" : "No near-expiry items found for the selected filters."}
                  </td>
                </tr>
              ) : (
                nearExpiryRows.map((r) => (
                  <tr
                    key={`b-${r.batch_id}`}
                    className="odd:bg-white/60 even:bg-white/40 hover:bg-blue-50/60 transition-colors"
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
      </GlassCard>

      {/* Net Sales Trend */}
      <GlassCard>
        <GlassSectionHeader title="Net Sales Trend" right={<div className="text-sm text-gray-600 px-2">Net = Sales − Sale Returns</div>} />
        <div className="p-3">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={buildNetSeries(series)} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="netColor" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.55} />
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.06} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(val) => `Rs ${fmtCurrency(val)}`} />
                <Area type="monotone" dataKey="value" stroke="#0ea5e9" fill="url(#netColor)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </GlassCard>

      {/* Purchases vs Purchase Returns & Sales vs Sale Returns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <GlassCard>
          <GlassSectionHeader title="Purchases vs Returns" />
          <div className="p-3">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={mergeTwo(series.purchases, series.purchaseReturns)}
                  margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(val) => `Rs ${fmtCurrency(val)}`} />
                  <Line type="monotone" dataKey="a" stroke="#16a34a" name="Purchases" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="b" stroke="#a855f7" name="Purchase Returns" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </GlassCard>

        <GlassCard>
          <GlassSectionHeader title="Sales vs Sale Returns" />
          <div className="p-3">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={mergeTwo(series.sales, series.saleReturns)} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(val) => `Rs ${fmtCurrency(val)}`} />
                  <Line type="monotone" dataKey="a" stroke="#2563eb" name="Sales" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="b" stroke="#dc2626" name="Sale Returns" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

/* ===================== Stat Card (glassy) ===================== */
function StatCard({ title, value, series, color = "#2563eb" }) {
  return (
    <GlassCard>
      <div className="px-4 pt-4">
        <div className="text-sm text-gray-600">{title}</div>
        <div className="text-2xl font-semibold">{value}</div>
      </div>
      <div className="h-16 px-2 pb-3">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={series || []} margin={{ top: 6, right: 6, left: 6, bottom: 0 }}>
            <defs>
              <linearGradient id={`${title}-grad`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.45} />
                <stop offset="95%" stopColor={color} stopOpacity={0.06} />
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="value" stroke={color} fill={`url(#${title}-grad)`} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </GlassCard>
  );
}
