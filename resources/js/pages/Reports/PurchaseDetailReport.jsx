// resources/js/pages/PurchaseDetailReport.jsx
import { useMemo, useRef, useState } from "react";
import axios from "axios";
import AsyncSelect from "react-select/async";
import { createFilter } from "react-select";
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
import {
  ArrowPathIcon,
  ArrowDownOnSquareIcon,
} from "@heroicons/react/24/solid";

/* ------------------ Helpers ------------------ */
const todayStr = () => new Date().toISOString().split("T")[0];
const yesterdayStr = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0];
};
const n = (v) => (isFinite(Number(v)) ? Number(v) : 0);
const fmtCurrency = (v) =>
  n(v).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const smallSelectStyles = {
  control: (base) => ({
    ...base,
    minHeight: 32,
    height: 32,
    borderRadius: 12,
    borderColor: "rgba(229,231,235,0.8)",
    backgroundColor: "rgba(255,255,255,0.7)",
    backdropFilter: "blur(6px)",
    boxShadow: "0 1px 2px rgba(15,23,42,0.06)",
  }),
  controlDark: (base) => ({
    ...base,
    minHeight: 32,
    height: 32,
    borderRadius: 12,
    borderColor: "rgba(71,85,105,0.8)",
    backgroundColor: "rgba(51,65,85,0.7)",
    backdropFilter: "blur(6px)",
    boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
  }),
  valueContainer: (base) => ({ ...base, height: 32, padding: "0 8px" }),
  indicatorsContainer: (base) => ({ ...base, height: 32 }),
  menuPortal: (base) => ({ ...base, zIndex: 9999 }),
  menu: (base) => ({
    ...base,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.95)",
    backdropFilter: "blur(10px)",
    boxShadow: "0 10px 30px -10px rgba(30,64,175,0.18)",
  }),
  menuDark: (base) => ({
    ...base,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "rgba(30,41,59,0.95)",
    backdropFilter: "blur(10px)",
    boxShadow: "0 10px 30px -10px rgba(0,0,0,0.4)",
    border: "1px solid rgba(71,85,105,0.5)",
  }),
  option: (base) => ({
    ...base,
    backgroundColor: "rgba(255,255,255,1)",
    color: "#111827",
  }),
  optionDark: (base) => ({
    ...base,
    backgroundColor: "rgba(51,65,85,1)",
    color: "#f1f5f9",
  }),
  singleValue: (base) => ({ ...base, color: "#111827" }),
  singleValueDark: (base) => ({ ...base, color: "#f1f5f9" }),
  placeholder: (base) => ({ ...base, color: "#9ca3af" }),
  placeholderDark: (base) => ({ ...base, color: "#64748b" }),
  input: (base) => ({ ...base, color: "#111827" }),
  inputDark: (base) => ({ ...base, color: "#f1f5f9" }),
};

// Helper to merge dark mode styles - returns function-based styles for react-select
const getSmallSelectStyles = (isDark = false) => ({
  control: (base) => ({
    ...base,
    minHeight: 32,
    height: 32,
    borderRadius: 12,
    borderColor: isDark ? "rgba(71,85,105,0.8)" : "rgba(229,231,235,0.8)",
    backgroundColor: isDark ? "rgba(51,65,85,0.7)" : "rgba(255,255,255,0.7)",
    backdropFilter: "blur(6px)",
    boxShadow: isDark ? "0 1px 2px rgba(0,0,0,0.2)" : "0 1px 2px rgba(15,23,42,0.06)",
  }),
  valueContainer: (base) => ({ ...base, height: 32, padding: "0 8px" }),
  indicatorsContainer: (base) => ({ ...base, height: 32 }),
  input: (base) => ({ ...base, margin: 0, padding: 0, color: isDark ? "#f1f5f9" : "#111827" }),
  menuPortal: (base) => ({ ...base, zIndex: 9999 }),
  menu: (base) => ({
    ...base,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: isDark ? "rgba(30,41,59,0.95)" : "rgba(255,255,255,0.95)",
    backdropFilter: "blur(10px)",
    boxShadow: isDark ? "0 10px 30px -10px rgba(0,0,0,0.4)" : "0 10px 30px -10px rgba(30,64,175,0.18)",
    border: isDark ? "1px solid rgba(71,85,105,0.5)" : "none",
  }),
  option: (base, state) => ({
    ...base,
    backgroundColor: isDark
      ? state.isFocused
        ? "rgba(71,85,105,1)"
        : "rgba(51,65,85,1)"
      : state.isFocused
        ? "rgba(241,245,249,1)"
        : "rgba(255,255,255,1)",
    color: isDark ? "#f1f5f9" : "#111827",
    cursor: "pointer",
  }),
  singleValue: (base) => ({
    ...base,
    color: isDark ? "#f1f5f9" : "#111827",
  }),
  placeholder: (base) => ({
    ...base,
    color: isDark ? "#64748b" : "#9ca3af",
  }),
});

/* ------------------ Helper to try multiple endpoints ------------------ */
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

/* ------------------ Component ------------------ */
export default function PurchaseDetailReport() {
  // Default: yesterday → today
  const [fromDate, setFromDate] = useState(yesterdayStr());
  const [toDate, setToDate] = useState(todayStr());
  const [supplierId, setSupplierId] = useState("");
  const [supplierValue, setSupplierValue] = useState(null);
  const [productId, setProductId] = useState("");
  const [productValue, setProductValue] = useState(null);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  const perms = usePermissions();
  const canView = perms?.has?.("report.purchase-detail.view");
  const canExport = perms?.has?.("report.purchase-detail.export");

  // Get dark mode state
  const { isDark } = useTheme();

  /* ------------------ Async Selects ------------------ */
  const loadSuppliers = useMemo(
    () =>
      async (input) => {
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
          return rows.map((r) => ({ value: r.id, label: r.name ?? `#${r.id}` }));
        } catch {
          toast.error("Supplier search failed");
          return [{ value: "", label: "No results" }];
        }
      },
    []
  );

  const loadProducts = useMemo(
    () =>
      async (input) => {
        const q = String(input || "").trim();
        if (!q) return [{ value: "", label: "All Products" }];
        try {
          const res = await tryEndpoints(
            ["/api/products/search", "/products/search"],
            { q, limit: 30, supplier_id: supplierId || undefined }
          );
          const rows = Array.isArray(res.data)
            ? res.data
            : Array.isArray(res.data?.data)
            ? res.data.data
            : [];
          return rows.map((p) => ({
            value: p.id,
            label: p.name || p.product_code || `#${p.id}`,
          }));
        } catch {
          toast.error("Product search failed");
          return [{ value: "", label: "No results" }];
        }
      },
    [supplierId]
  );

  /* ------------------ Fetch report ------------------ */
  const fetchReport = async () => {
    if (!canView) return toast.error("You don't have permission to view this report.");
    if (fromDate > toDate)
      return toast.error("'From' date cannot be after 'To' date.");

    setLoading(true);
    try {
      const res = await axios.get("/api/reports/purchase-detail", {
        params: {
          from: fromDate,
          to: toDate,
          supplier_id: supplierId || undefined,
          product_id: productId || undefined,
        },
      });
      const rows = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data?.data)
        ? res.data.data
        : [];
      setData(rows);
      if (!rows.length) toast("No data found for selected range.", { icon: "ℹ️" });
    } catch (err) {
      console.error(err);
      toast.error("Failed to fetch Purchase Detail report");
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  const exportPdf = async () => {
    if (!canExport) return toast.error("You don't have permission to export PDF.");
    setPdfLoading(true);
    try {
      const res = await axios.get("/api/reports/purchase-detail/pdf", {
        params: {
          from: fromDate,
          to: toDate,
          supplier_id: supplierId || undefined,
          product_id: productId || undefined,
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

  // tints (match other glass pages)
  const tintSlate = "bg-slate-900/80 text-white ring-1 ring-white/15 shadow-[0_6px_20px_-6px_rgba(15,23,42,0.45)] hover:bg-slate-900/90";
  const tintGlass = "bg-white/60 text-slate-700 ring-1 ring-white/30 hover:bg-white/80";

  return (
     <div className="p-4 md:p-6 space-y-4">
      <GlassCard>
        <GlassSectionHeader
          title={<span className="font-semibold">Purchase Detail Report</span>}
          right={
            <div className="flex gap-2">
              <GlassBtn
                className={`h-9 ${tintGlass}`}
                onClick={() => {
                  setFromDate(yesterdayStr());
                  setToDate(todayStr());
                  setSupplierId("");
                  setSupplierValue(null);
                  setProductId("");
                  setProductValue(null);
                  setData([]);
                }}
              >
                Reset
              </GlassBtn>
              <GlassBtn
                className={`h-9 flex flex-row items-center gap-2 ${tintSlate}`}
                onClick={fetchReport}
                disabled={loading || !canView}
              >
                <ArrowPathIcon className="w-5 h-5" />
                {loading ? "Loading…" : "Load"}
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
            <div className="md:col-span-2">
              <label className="text-sm text-gray-700 dark:text-gray-300 mb-1 block">From</label>
              <GlassInput
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-sm text-gray-700 dark:text-gray-300 mb-1 block">To</label>
              <GlassInput
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>

            <div className="md:col-span-4">
              <label className="text-sm text-gray-700 dark:text-gray-300 mb-1 block">Supplier</label>
              <AsyncSelect
                cacheOptions
                defaultOptions={[{ value: "", label: "All Suppliers" }]}
                loadOptions={loadSuppliers}
                isClearable
                value={supplierValue}
                onChange={(opt) => {
                  setSupplierValue(opt);
                  setSupplierId(opt?.value || "");
                  setProductId("");
                  setProductValue(null);
                }}
                styles={getSmallSelectStyles(isDark)}
                menuPortalTarget={document.body}
                filterOption={createFilter({
                  matchFrom: "start",
                  trim: true,
                })}
              />
            </div>

            <div className="md:col-span-4">
              <label className="text-sm text-gray-700 dark:text-gray-300 mb-1 block">Product</label>
              <AsyncSelect
                cacheOptions
                defaultOptions={[{ value: "", label: "All Products" }]}
                loadOptions={loadProducts}
                isClearable
                value={productValue}
                onChange={(opt) => {
                  setProductValue(opt);
                  setProductId(opt?.value || "");
                }}
                styles={getSmallSelectStyles(isDark)}
                menuPortalTarget={document.body}
                filterOption={createFilter({
                  matchFrom: "start",
                  trim: true,
                })}
              />
            </div>

            <div className="md:col-span-12 flex flex-wrap gap-2">
              <GlassBtn
                type="submit"
                className={`h-9 min-w-[110px] ${tintSlate}`}
                disabled={loading}
              >
                Apply
              </GlassBtn>

              {/* ✅ Quick range filters */}
              <GlassBtn
                className={`h-9 ${tintGlass}`}
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
                className={`h-9 ${tintGlass}`}
                onClick={() => {
                  const end = new Date();
                  const start = new Date();
                  start.setDate(end.getDate() - 3);
                  setFromDate(start.toISOString().slice(0, 10));
                  setToDate(end.toISOString().slice(0, 10));
                  setTimeout(() => fetchReport(), 0);
                }}
              >
                3 Days
              </GlassBtn>

              <GlassBtn
                className={`h-9 ${tintGlass}`}
                onClick={() => {
                  const end = new Date();
                  const start = new Date();
                  start.setDate(end.getDate() - 7);
                  setFromDate(start.toISOString().slice(0, 10));
                  setToDate(end.toISOString().slice(0, 10));
                  setTimeout(() => fetchReport(), 0);
                }}
              >
                7 Days
              </GlassBtn>

              <GlassBtn
                className={`h-9 flex flex-row items-center gap-2 ${canExport ? tintGlass : "opacity-60"}`}
                onClick={exportPdf}
                disabled={pdfLoading || !canExport}
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
          <div className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">Checking permissions…</div>
        </GlassCard>
      )}
      {canView === false && (
        <GlassCard>
          <div className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">You don't have permission to view this report.</div>
        </GlassCard>
      )}

      {/* ===== Results ===== */}
      {canView === true && (
        <>
          {data.length === 0 && !loading && (
            <GlassCard>
              <div className="px-4 py-4 text-sm text-gray-600 dark:text-gray-400">No data found for the selected filters.</div>
            </GlassCard>
          )}

          <div className="flex flex-col gap-4">
            {data.map((inv) => (
              <GlassCard
                key={inv.id || `${inv.posted_number}-${inv.invoice_number}-${inv.invoice_date}`}
                className="overflow-hidden transition-all duration-200 hover:bg-white/70 hover:backdrop-blur-md hover:shadow-[0_12px_30px_-12px_rgba(37,99,235,0.25)] dark:hover:bg-slate-800/70 dark:hover:backdrop-blur-md"
              >
                {/* Header (glassy band) */}
                <GlassSectionHeader
                  className="rounded-t-2xl"
                  title={
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-x-3 gap-y-1 text-sm">
                      <KV label="Supplier:" value={inv.supplier_name || "-"} />
                      <KV label="Posted #:" value={inv.posted_number || "-"} />
                      <KV label="Invoice #:" value={inv.invoice_number || "-"} />
                      <KV label="Date:" value={inv.invoice_date || "-"} />
                    </div>
                  }
                />

                {/* Items table */}
                <div className="relative max-w-full overflow-x-auto">
                  <table className="w-full min-w-[900px] text-sm text-gray-900 dark:text-gray-100">
                    <colgroup>
                      <col style={{ width: 180 }} />
                      <col style={{ width: 100 }} />
                      <col style={{ width: 100 }} />
                      {Array.from({ length: 9 }).map((_, i) => (
                        <col key={i} style={{ width: 90 }} />
                      ))}
                    </colgroup>

                    <thead className="sticky top-0 bg-white/85 backdrop-blur-sm border-b border-gray-200/70 dark:bg-slate-800/90 dark:border-slate-700/60">
                      <tr className="text-left">
                        <Th>Product Name</Th>
                        <Th>Batch</Th>
                        <Th>Expiry</Th>
                        <Th align="right">Pack Qty</Th>
                        <Th align="right">Pack Size</Th>
                        <Th align="right">Pack Purchase</Th>
                        <Th align="right">Pack Sale</Th>
                        <Th align="right">Pack Bonus</Th>
                        <Th align="right">Item Disc %</Th>
                        <Th align="right">Margin</Th>
                        <Th align="right">Sub Total</Th>
                        <Th align="right">Quantity</Th>
                      </tr>
                    </thead>

                    <tbody className="tabular-nums">
                      {(inv.items || []).map((it, idx) => (
                        <tr
                          key={(it.id ?? idx) + "-" + (it.product_id ?? "p") + "-" + idx}
                          className="transition-all duration-150 odd:bg-white/90 even:bg-white/70 hover:bg-white/80 hover:backdrop-blur-[2px] dark:odd:bg-slate-800/60 dark:even:bg-slate-700/40 dark:hover:bg-slate-700/70 dark:backdrop-blur-sm"
                        >
                          <Td>{it.product_name || "-"}</Td>
                          <Td>{it.batch || "-"}</Td>
                          <Td>{it.expiry || "-"}</Td>
                          <Td align="right">{it.pack_quantity ?? 0}</Td>
                          <Td align="right">{it.pack_size ?? 0}</Td>
                          <Td align="right">{fmtCurrency(it.pack_purchase_price)}</Td>
                          <Td align="right">{fmtCurrency(it.pack_sale_price)}</Td>
                          <Td align="right">{it.pack_bonus ?? 0}</Td>
                          <Td align="right">{(it.item_discount_percentage ?? 0).toFixed(2)}</Td>
                          <Td align="right">{(it.margin ?? 0).toFixed(2)}</Td>
                          <Td align="right">{fmtCurrency(it.sub_total)}</Td>
                          <Td align="right">{it.quantity ?? 0}</Td>
                        </tr>
                      ))}

                      {(!inv.items || !inv.items.length) && (
                        <tr>
                          <td colSpan={12} className="px-3 py-6 text-center text-gray-500 dark:text-slate-400">
                            No items match this filter in this invoice.
                          </td>
                        </tr>
                      )}
                    </tbody>

                    <tfoot className="bg-white/70 backdrop-blur-[2px] dark:bg-slate-700/50 dark:backdrop-blur-sm">
                      <tr>
                        <Td colSpan={6} align="right" strong>Tax %</Td>
                        <Td colSpan={2} align="right">{(inv.tax_percentage ?? 0).toFixed(2)}</Td>
                        <Td colSpan={2} align="right" strong>Tax Amount</Td>
                        <Td colSpan={2} align="right">{fmtCurrency(inv.tax_amount)}</Td>
                      </tr>
                      <tr>
                        <Td colSpan={6} align="right" strong>Discount %</Td>
                        <Td colSpan={2} align="right">{(inv.discount_percentage ?? 0).toFixed(2)}</Td>
                        <Td colSpan={2} align="right" strong>Discount Amount</Td>
                        <Td colSpan={2} align="right">{fmtCurrency(inv.discount_amount)}</Td>
                      </tr>
                      <tr>
                        <Td colSpan={10} align="right" strong className="!font-semibold">Total Amount</Td>
                        <Td colSpan={2} align="right" className="!font-semibold">{fmtCurrency(inv.total_amount)}</Td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </GlassCard>
            ))}
          </div>
        </>
      )}

      {/* Print & typographic niceties */}
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

/* ===== Small helpers to keep JSX tidy ===== */
function KV({ label, value }) {
  return (
    <div className="text-sm">
      <span className="text-gray-600 dark:text-slate-400">{label}</span>{" "}
      <span className="font-semibold text-gray-900 dark:text-gray-100">{value}</span>
    </div>
  );
}

function Th({ children, align = "left" }) {
  return (
    <th className={`px-3 py-2 font-medium ${align === "right" ? "text-right" : "text-left"} dark:text-gray-200`}>
      {children}
    </th>
  );
}

function Td({ children, align = "left", colSpan, strong = false, className = "" }) {
  return (
    <td
      colSpan={colSpan}
      className={[
        "px-3 py-2 border-t border-gray-200/70 dark:border-slate-700/60 dark:text-gray-200",
        align === "right" ? "text-right" : "text-left",
        strong ? "font-medium text-gray-800 dark:text-gray-100" : "",
        className,
      ].join(" ")}
    >
      {children}
    </td>
  );
}

