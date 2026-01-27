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
  ComposedChart,
  Legend,
  Line,
  Bar,
} from "recharts";
import {
  CurrencyDollarIcon,
  ShoppingCartIcon,
  ArrowUturnLeftIcon,
  ArrowUturnDownIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  BanknotesIcon,
  ClipboardDocumentListIcon,
  CubeIcon,
  ScaleIcon,
  ClockIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";
import { GlassCard, GlassSectionHeader, GlassToolbar, GlassInput, GlassBtn } from "@/components/Glass";

// Modern color palette for charts
const COLORS = {
  primary: ["#6366f1", "#8b5cf6", "#a855f7", "#d946ef", "#ec4899", "#f43f5e"],
  success: ["#10b981", "#34d399", "#6ee7b7", "#a7f3d0", "#d1fae5"],
};

// Custom tooltip style
const customTooltipStyle = {
  backgroundColor: "rgba(255, 255, 255, 0.95)",
  backdropFilter: "blur(10px)",
  border: "1px solid rgba(255, 255, 255, 0.3)",
  borderRadius: "12px",
  boxShadow: "0 10px 40px rgba(0, 0, 0, 0.1)",
  padding: "12px 16px",
};

/* ===================== Helpers ===================== */
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

const mergeSeries = (base, points) => {
  const map = new Map(base.map((p) => [p.date, { ...p }]));
  for (const pt of points || []) {
    const k = dateKey(pt.date);
    map.set(k, { date: k, value: (map.get(k)?.value || 0) + Number(pt.value || 0) });
  }
  return Array.from(map.values());
};

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

/* ===================== React-Select styles ===================== */
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
  option: (base, state) => ({
    ...base,
    fontSize: "0.875rem",
    backgroundColor: state.isFocused ? "#eff6ff" : state.isSelected ? "#dbeafe" : "white",
    color: "#111827",
  }),
};

/* ===================== Component ===================== */
export default function Dashboard() {
  const [from, setFrom] = useState(todayStr());
  const [to, setTo] = useState(todayStr());
  const [expiryMonths, setExpiryMonths] = useState(3);
  const [supplierId, setSupplierId] = useState("");
  const [brandId, setBrandId] = useState("");
  const [supplierValue, setSupplierValue] = useState({ value: "", label: "All Suppliers" });
  const [brandValue, setBrandValue] = useState({ value: "", label: "All Brands" });
  const [supplierOptions, setSupplierOptions] = useState([{ value: "", label: "All Suppliers" }]);
  const [brandOptions, setBrandOptions] = useState([{ value: "", label: "All Brands" }]);
  const [nearExpiryRows, setNearExpiryRows] = useState([]);
  const [loadingExpiry, setLoadingExpiry] = useState(false);
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

  const [invoiceCounts, setInvoiceCounts] = useState({ total: 0, sale_invoices: 0, purchase_invoices: 0 });
  const [kpiMetrics, setKpiMetrics] = useState({
    active_products: 0,
    suppliers: 0,
    brands: 0,
    categories: 0,
    near_expiry: 0,
  });

  const netSales = useMemo(() => (cards.sales || 0) - (cards.saleReturns || 0), [cards]);

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
  }, [from, to]);

  useEffect(() => {
    fetchExpiryFilters();
  }, []);

  useEffect(() => {
    fetchNearExpiry();
  }, [expiryMonths, supplierId, brandId]);

  useEffect(() => {
    fetchDashboardMetrics();
  }, [from, to]);

  async function fetchDashboardMetrics() {
    try {
      const params = { date_from: from, date_to: to };
      const [invoiceRes, kpiRes] = await Promise.allSettled([
        axios.get("/api/dashboard/invoice-counts"),
        axios.get("/api/dashboard/kpi-metrics", { params }),
      ]);

      if (invoiceRes.status === 'fulfilled') {
        setInvoiceCounts(invoiceRes.value.data || { total: 0 });
      }
      if (kpiRes.status === 'fulfilled') {
        setKpiMetrics(kpiRes.value.data || {});
      }
    } catch (err) {
      console.error("Failed to fetch dashboard metrics:", err);
    }
  }

  async function fetchExpiryFilters() {
    try {
      const { data } = await axios.get("/api/dashboard/near-expiry/filters");
      const sup = (data?.suppliers || []).map((s) => ({ value: String(s.id), label: s.name }));
      const br = (data?.brands || []).map((b) => ({ value: String(b.id), label: b.name }));
      setSupplierOptions([{ value: "", label: "All Suppliers" }, ...sup]);
      setBrandOptions([{ value: "", label: "All Brands" }, ...br]);
    } catch (err) {
      console.error(err);
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
    } catch (err) {
      console.error(err);
      toast.error("Failed to load dashboard.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-4 space-y-4 bg-gradient-to-br from-slate-50 via-white to-blue-50/30 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Business Dashboard</h1>
        <GlassBtn onClick={fetchAll} disabled={loading} variant="primary" title="Alt+R">
          {loading ? "Loading…" : "Refresh"}
        </GlassBtn>
      </div>

      {/* Filters */}
      <GlassCard>
        <GlassToolbar className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <div className="flex flex-col">
            <label className="text-gray-700 dark:text-gray-300 text-sm">From</label>
            <GlassInput type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="flex flex-col">
            <label className="text-gray-700 dark:text-gray-300 text-sm">To</label>
            <GlassInput type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <ModernStatCard 
          title="Total Sales" 
          value={`Rs ${fmtCurrency(cards.sales)}`}
          icon={<CurrencyDollarIcon className="w-6 h-6" />}
          color="#6366f1"
          gradient="from-violet-500 to-purple-600"
        />
        <ModernStatCard 
          title="Total Purchases" 
          value={`Rs ${fmtCurrency(cards.purchases)}`}
          icon={<ShoppingCartIcon className="w-6 h-6" />}
          color="#10b981"
          gradient="from-emerald-500 to-teal-600"
        />
        <ModernStatCard 
          title="Sale Returns" 
          value={`Rs ${fmtCurrency(cards.saleReturns)}`}
          icon={<ArrowUturnLeftIcon className="w-6 h-6" />}
          color="#ef4444"
          gradient="from-red-500 to-rose-600"
        />
        <ModernStatCard 
          title="Purchase Returns" 
          value={`Rs ${fmtCurrency(cards.purchaseReturns)}`}
          icon={<ArrowUturnDownIcon className="w-6 h-6" />}
          color="#f59e0b"
          gradient="from-amber-500 to-orange-600"
        />
      </div>

      {/* KPI Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <MetricCard 
          label="Net Sales" 
          value={`Rs ${fmtCurrency(netSales)}`}
          icon={<BanknotesIcon className="w-5 h-5" />}
          bgColor="bg-gradient-to-br from-blue-500 to-indigo-600"
        />
        <MetricCard 
          label="Total Invoices" 
          value={invoiceCounts.total}
          subValue={`${invoiceCounts.sale_invoices} sales, ${invoiceCounts.purchase_invoices} purchases`}
          icon={<ClipboardDocumentListIcon className="w-5 h-5" />}
          bgColor="bg-gradient-to-br from-purple-500 to-pink-600"
        />
        <MetricCard 
          label="Products" 
          value={kpiMetrics.active_products || 0}
          icon={<CubeIcon className="w-5 h-5" />}
          bgColor="bg-gradient-to-br from-emerald-500 to-cyan-600"
        />
        <MetricCard 
          label="Suppliers" 
          value={kpiMetrics.suppliers || 0}
          icon={<ScaleIcon className="w-5 h-5" />}
          bgColor="bg-gradient-to-br from-orange-500 to-amber-600"
        />
        <MetricCard 
          label="Near Expiry" 
          value={kpiMetrics.near_expiry || nearExpiryRows.length}
          icon={<ClockIcon className="w-5 h-5" />}
          bgColor={(kpiMetrics.near_expiry || nearExpiryRows.length) > 0 ? "bg-gradient-to-br from-red-500 to-rose-600" : "bg-gradient-to-br from-gray-400 to-gray-500"}
        />
        <MetricCard 
          label="Brands" 
          value={kpiMetrics.brands || 0}
          icon={<CheckCircleIcon className="w-5 h-5" />}
          bgColor="bg-gradient-to-br from-violet-500 to-fuchsia-600"
        />
      </div>

      {/* Near Expiry Table */}
      <GlassCard>
        <GlassSectionHeader
          title="Near Expiry"
          right={
            <div className="flex items-center gap-2">
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
              <div className="flex items-center gap-2 shrink-0" style={{ minWidth: 220 }}>
                <span className="text-gray-700 dark:text-gray-300 text-sm">Supplier</span>
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
              <div className="flex items-center gap-2 shrink-0" style={{ minWidth: 200 }}>
                <span className="text-gray-700 dark:text-gray-300 text-sm">Brand</span>
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
              <GlassBtn variant="ghost" onClick={() => {
                setSupplierValue({ value: "", label: "All Suppliers" });
                setBrandValue({ value: "", label: "All Brands" });
                setSupplierId("");
                setBrandId("");
              }}>
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
            <thead className="sticky top-[56px] bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm z-10 border-b border-gray-200/70 dark:border-white/10">
              <tr className="text-left text-gray-700 dark:text-gray-300">
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
                    {loadingExpiry ? "Loading…" : "No near-expiry items found."}
                  </td>
                </tr>
              ) : (
                nearExpiryRows.map((r) => (
                  <tr key={`b-${r.batch_id}`} className="odd:bg-white/60 even:bg-white/40 hover:bg-blue-50/60">
                    <td className="px-3 py-2">
                      <div className="max-w-[280px] truncate" title={r.product_name}>{r.product_name}</div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="max-w-[220px] truncate">{r.supplier_name || "—"}</div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="max-w-[200px] truncate">{r.brand_name || "—"}</div>
                    </td>
                    <td className="px-3 py-2">{r.batch_number}</td>
                    <td className="px-3 py-2">{(r.expiry_date || "").slice(0, 10)}</td>
                    <td className="px-3 py-2 text-right">{Number(r.quantity ?? 0).toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* Net Sales Trend */}
      <GlassCard>
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg">
              <ArrowTrendingUpIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Net Sales Trend</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Sales − Sale Returns</p>
            </div>
          </div>
        </div>
        <div className="p-4">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={buildNetSeries(series)} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="netColor" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.8} />
                    <stop offset="50%" stopColor="#8b5cf6" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#a855f7" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="netStroke" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#6366f1" />
                    <stop offset="100%" stopColor="#ec4899" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} stroke="#6366f1" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={{ stroke: '#e5e7eb' }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} tickFormatter={(val) => `Rs ${(val / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={customTooltipStyle} formatter={(val) => [`Rs ${fmtCurrency(val)}`, 'Net Sales']} labelFormatter={(label) => `Date: ${label}`} />
                <Area type="monotone" dataKey="value" stroke="url(#netStroke)" strokeWidth={3} fill="url(#netColor)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </GlassCard>

      {/* Comparison Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <GlassCard>
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl shadow-lg">
                <ShoppingCartIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Purchases vs Returns</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Track your purchase efficiency</p>
              </div>
            </div>
          </div>
          <div className="p-4">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={mergeTwo(series.purchases, series.purchaseReturns)} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} stroke="#10b981" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={{ stroke: '#e5e7eb' }} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} tickFormatter={(val) => `Rs ${(val / 1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={customTooltipStyle} formatter={(val, name) => [`Rs ${fmtCurrency(val)}`, name === 'a' ? 'Purchases' : 'Returns']} />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '10px' }} />
                  <Area type="monotone" dataKey="a" name="Purchases" fill="url(#purchaseGrad)" stroke="#10b981" strokeWidth={2} />
                  <Line type="monotone" dataKey="b" name="Purchase Returns" stroke="#f59e0b" strokeWidth={2} dot={{ fill: '#f59e0b', r: 3 }} />
                  <defs>
                    <linearGradient id="purchaseGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.8} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0.1} />
                    </linearGradient>
                  </defs>
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </GlassCard>

        <GlassCard>
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl shadow-lg">
                <CurrencyDollarIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Sales vs Sale Returns</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Monitor your revenue health</p>
              </div>
            </div>
          </div>
          <div className="p-4">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={mergeTwo(series.sales, series.saleReturns)} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} stroke="#8b5cf6" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={{ stroke: '#e5e7eb' }} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} tickFormatter={(val) => `Rs ${(val / 1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={customTooltipStyle} formatter={(val, name) => [`Rs ${fmtCurrency(val)}`, name === 'a' ? 'Sales' : 'Returns']} />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '10px' }} />
                  <Bar dataKey="a" name="Sales" fill="url(#salesGrad)" radius={[4, 4, 0, 0]} barSize={12} />
                  <Line type="monotone" dataKey="b" name="Sale Returns" stroke="#ef4444" strokeWidth={2} dot={{ fill: '#ef4444', r: 3 }} />
                  <defs>
                    <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.8} />
                      <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.1} />
                    </linearGradient>
                  </defs>
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

function ModernStatCard({ title, value, icon, color, gradient }) {
  return (
    <GlassCard className="relative overflow-hidden group">
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-300`} />
      <div className="p-4 relative z-10">
        <div className="flex items-center gap-2 mb-1">
          <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${color}15` }}>
            <div style={{ color }}>{icon}</div>
          </div>
          <span className="text-sm text-gray-500 font-medium">{title}</span>
        </div>
        <div className="text-2xl font-bold text-gray-800">{value}</div>
        <div className="h-8 mt-3">
          <svg viewBox="0 0 100 30" className="w-full h-full" preserveAspectRatio="none">
            <path d="M0 25 Q 15 20, 25 22 T 50 18 T 75 20 T 100 15" fill="none" stroke={color} strokeWidth="2" className="opacity-60" />
            <path d="M0 25 Q 15 20, 25 22 T 50 18 T 75 20 T 100 15 L 100 30 L 0 30 Z" fill={`url(#${title.replace(/\s+/g, '')}-spark)`} />
            <defs>
              <linearGradient id={`${title.replace(/\s+/g, '')}-spark`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>
    </GlassCard>
  );
}

function MetricCard({ label, value, subValue, icon, bgColor }) {
  return (
    <div className={`${bgColor} rounded-xl p-3 text-white shadow-lg hover:shadow-xl transition-shadow duration-300`}>
      <div className="flex items-center gap-2 mb-2">
        <div className="p-1.5 bg-white/20 rounded-lg backdrop-blur-sm">{icon}</div>
        <span className="text-xs font-medium text-white/80">{label}</span>
      </div>
      <div className="text-xl font-bold">{value}</div>
      {subValue && <div className="text-xs text-white/70 mt-1">{subValue}</div>}
    </div>
  );
}

