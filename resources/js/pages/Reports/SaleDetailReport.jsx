// resources/js/pages/SaleDetailReport.jsx
import { useEffect, useMemo, useRef, useState } from "react";
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

import { ArrowPathIcon, ArrowDownOnSquareIcon } from "@heroicons/react/24/solid";

/* ======================
   Helpers
   ====================== */
const todayStr = () => new Date().toISOString().split("T")[0];
const firstDayOfMonthStr = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split("T")[0];
};
const n = (v) => (isFinite(Number(v)) ? Number(v) : 0);
const fmtCurrency = (v) =>
  n(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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

// map your /products/search rich row → react-select option
const mapProductToOption = (p) => ({
  value: p.id,
  label: p.name ? p.name : p.product_code ? p.product_code : `#${p.id}`,
  _row: p,
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

let warnedOnceProducts = false;
let warnedOnceCustomers = false;

export default function SaleDetailReport() {
  // Dates
  const [fromDate, setFromDate] = useState(firstDayOfMonthStr());
  const [toDate, setToDate] = useState(todayStr());

  // Selected filters
  const [customerValue, setCustomerValue] = useState(null);
  const [customerId, setCustomerId] = useState("");

  const [productValue, setProductValue] = useState(null);
  const [productId, setProductId] = useState("");

  // Data
  const [data, setData] = useState([]); // array of sale invoices (each with items[])
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  // Refs
  const fromRef = useRef(null);
  const toRef = useRef(null);
  const customerRef = useRef(null);
  const productRef = useRef(null);
  const submitRef = useRef(null);

  // --- Permissions (tri-state)
  const perms = usePermissions();
  const hasFn = perms?.has;
  const permsReady = typeof hasFn === "function";
  const canView = permsReady ? !!hasFn("report.sale-detail.view") : null;
  const canExport = permsReady ? !!hasFn("report.sale-detail.export") : null;

  /* ======================
     Async loaders (promise-based)
     ====================== */

  // Customers: prefix-only search (your backend route may be /api/customers/search or /customers/search)
  const loadCustomers = useMemo(
    () =>
      async (input) => {
        const q = String(input || "").trim();
        if (!q) return [{ value: "", label: "All Customers" }];

        try {
          const res = await tryEndpoints(
            ["/api/customers/search", "/customers/search"],
            { q, limit: 30, mode: "starts" }
          );

          const rows = Array.isArray(res.data?.data)
            ? res.data.data
            : Array.isArray(res.data)
            ? res.data
            : [];

          const opts = rows.map((r) => ({
            value: r.id ?? r.value,
            label: r.name ?? r.label ?? r.title ?? `#${r.id}`,
            _row: r,
          }));

          return opts.length ? opts : [{ value: "", label: "No matches" }];
        } catch (e) {
          if (!warnedOnceCustomers) {
            warnedOnceCustomers = true;
            toast.error("Customer search failed (check route/permissions).");
          }
          return [{ value: "", label: "No matches" }];
        }
      },
    []
  );

  // Products: uses your existing ProductController::search (q%)
  const loadProducts = useMemo(
    () =>
      async (input) => {
        const q = String(input || "").trim();
        if (!q) return [{ value: "", label: "All Products" }];

        try {
          const res = await tryEndpoints(
            ["/api/products/search", "/products/search"],
            { q, limit: 30 }
          );

          // Your controller returns an array of product rows
          const rows = Array.isArray(res.data) ? res.data : [];
          const opts = rows.map(mapProductToOption);

          return opts.length ? opts : [{ value: "", label: "No matches" }];
        } catch (e) {
          if (!warnedOnceProducts) {
            warnedOnceProducts = true;
            toast.error("Product search failed (check route/permissions).");
          }
          return [{ value: "", label: "No matches" }];
        }
      },
    []
  );

  /* ======================
     Fetch report
     ====================== */
  const fetchReport = async ({ silentDenied = false } = {}) => {
    if (canView !== true) {
      if (!silentDenied) toast.error("You don't have permission to view this report.");
      return;
    }
    setLoading(true);
    try {
      const res = await axios.get("/api/reports/sale-detail", {
        params: {
          from: fromDate,
          to: toDate,
          customer_id: customerId || undefined,
          product_id: productId || undefined,
        },
      });
      const rows = Array.isArray(res.data) ? res.data : Array.isArray(res.data?.data) ? res.data.data : [];
      setData(rows);
      if (!rows.length) toast("No results for selected filters.", { icon: "ℹ️" });
    } catch (err) {
      console.error(err);
      toast.error("Failed to load Sale Detail report");
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canView === true) fetchReport({ silentDenied: true });
  }, [canView]); // eslint-disable-line react-hooks/exhaustive-deps

  // Submit handler
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!fromDate || !toDate) return toast.error("Please select both dates.");
    if (fromDate > toDate) return toast.error("From Date cannot be after To Date.");
    fetchReport({ silentDenied: false });
  };

  // PDF export (popup-safe)
  const exportPdf = async () => {
    if (canExport !== true) return toast.error("You don't have permission to export PDF.");
    const win = window.open("", "_blank");
    if (!win) {
      toast.error("Please allow pop-ups for this site to view the PDF.");
      return;
    }
    try {
      setPdfLoading(true);
      const res = await axios.get("/api/reports/sale-detail/pdf", {
        params: {
          from: fromDate,
          to: toDate,
          customer_id: customerId || undefined,
          product_id: productId || undefined,
        },
        responseType: "blob",
        withCredentials: true,
      });

      const contentType =
        (res.headers && (res.headers["content-type"] || res.headers["Content-Type"])) || "";
      if (!contentType.includes("application/pdf")) {
        const text = typeof res.data?.text === "function" ? await res.data.text() : "";
        win.close();
        toast.error(text?.slice(0, 200) || "Failed to generate PDF.");
        return;
      }

      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      win.location.href = url;

      const cleanup = () => URL.revokeObjectURL(url);
      const timer = setTimeout(cleanup, 60000);
      const i = setInterval(() => {
        if (win.closed) {
          clearInterval(i);
          clearTimeout(timer);
          cleanup();
        }
      }, 3000);
    } catch (e) {
      console.error(e);
      try { win.close(); } catch {}
      toast.error("Could not open PDF.");
    } finally {
      setPdfLoading(false);
    }
  };

  // Keyboard flow
  const nextFocus = (ref) => ref?.current?.focus?.();
  const onKeyDownEnter = (e, next) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (next) nextFocus(next);
    }
  };

  // tints (match other glass pages)
  const tintSlate =
    "bg-slate-900/80 text-white ring-1 ring-white/15 shadow-[0_6px_20px_-6px_rgba(15,23,42,0.45)] hover:bg-slate-900/90";
  const tintGlass = "bg-white/60 text-slate-700 ring-1 ring-white/30 hover:bg-white/80";

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* ===== Header + Filters ===== */}
      <GlassCard>
        <GlassSectionHeader
          title={<span className="font-semibold">Sale Detail Report</span>}
          right={
            <div className="flex gap-2">
              <GlassBtn
                className={`h-9 ${tintGlass}`}
                title="Reset to This Month"
                onClick={() => {
                  setFromDate(firstDayOfMonthStr());
                  setToDate(todayStr());
                  setCustomerValue(null);
                  setCustomerId("");
                  setProductValue(null);
                  setProductId("");
                }}
              >
                Reset
              </GlassBtn>
              <GlassBtn
                className={`h-9 ${tintSlate}`}
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

        <form onSubmit={handleSubmit}>
          <GlassToolbar className="grid grid-cols-1 md:grid-cols-12 gap-3">
            {/* Dates */}
            <div className="md:col-span-2">
              <label className="text-sm text-gray-700 mb-1 block">From</label>
              <GlassInput
                ref={fromRef}
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                onKeyDown={(e) => onKeyDownEnter(e, toRef)}
                className="w-full"
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-sm text-gray-700 mb-1 block">To</label>
              <GlassInput
                ref={toRef}
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                onKeyDown={(e) =>
                  onKeyDownEnter(e, { current: customerRef.current?.inputRef })
                }
                className="w-full"
              />
            </div>

            {/* Customer (Async, prefix-only) */}
            <div className="md:col-span-4">
              <label className="text-sm text-gray-700 mb-1 block">Customer</label>
              <AsyncSelect
                ref={customerRef}
                classNamePrefix="rs"
                cacheOptions
                defaultOptions={[{ value: "", label: "All Customers" }]}
                loadOptions={loadCustomers}
                isClearable
                menuPlacement="auto"
                menuPortalTarget={typeof document !== "undefined" ? document.body : null}
                placeholder="Type to search customers…"
                styles={selectStyles}
                filterOption={createFilter({ matchFrom: "start", ignoreAccents: false, trim: true })}
                onChange={(opt) => {
                  setCustomerValue(opt);
                  const id = opt?.value || "";
                  setCustomerId(id);
                  setTimeout(() => {
                    productRef.current?.focus?.();
                    productRef.current?.inputRef?.focus?.();
                  }, 0);
                }}
                noOptionsMessage={({ inputValue }) =>
                  inputValue ? "No matches (prefix only)" : "Type at least 1 character…"
                }
                loadingMessage={() => "Searching…"}
              />
            </div>

            {/* Product (Async, prefix-only via your controller) */}
            <div className="md:col-span-4">
              <label className="text-sm text-gray-700 mb-1 block">Product</label>
              <AsyncSelect
                ref={productRef}
                classNamePrefix="rs"
                cacheOptions
                defaultOptions={[{ value: "", label: "All Products" }]}
                loadOptions={loadProducts}
                isClearable
                menuPlacement="auto"
                menuPortalTarget={typeof document !== "undefined" ? document.body : null}
                placeholder="Type to search products…"
                styles={selectStyles}
                filterOption={createFilter({ matchFrom: "start", ignoreAccents: false, trim: true })}
                onChange={(opt) => {
                  setProductValue(opt);
                  setProductId(opt?.value || "");
                  setTimeout(() => submitRef.current?.focus?.(), 0);
                }}
                noOptionsMessage={({ inputValue }) =>
                  inputValue ? "No matches (prefix only)" : "Type at least 1 character…"
                }
                loadingMessage={() => "Searching…"}
              />
            </div>

            {/* Actions */}
            <div className="md:col-span-12 flex flex-wrap gap-2">
              <GlassBtn
                ref={submitRef}
                type="submit"
                className={`h-9 min-w-[110px] ${tintSlate}`}
                disabled={loading}
                title="Submit"
              >
                Apply
              </GlassBtn>

              <GlassBtn
                type="button"
                onClick={() => {
                  const end = new Date();
                  const start = new Date();
                  start.setDate(end.getDate() - 6);
                  setFromDate(start.toISOString().slice(0, 10));
                  setToDate(end.toISOString().slice(0, 10));
                }}
                className={`h-9 ${tintGlass}`}
                title="Last 7 Days"
              >
                Last 7 Days
              </GlassBtn>

              <GlassBtn
                type="button"
                onClick={exportPdf}
                className={`h-9 ${
                  canExport ? tintGlass : tintGlass + " opacity-60 cursor-not-allowed"
                }`}
                disabled={pdfLoading || !canExport}
                title="Export PDF"
              >
                <span className="inline-flex items-center gap-2">
                  <ArrowDownOnSquareIcon className="w-5 h-5" />
                  {pdfLoading ? "Generating…" : "Export PDF"}
                </span>
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
          <div className="px-4 py-3 text-sm text-gray-700">You don’t have permission to view this report.</div>
        </GlassCard>
      )}

      {/* ===== Results ===== */}
      {canView === true && (
        <>
          {data.length === 0 && !loading && (
            <GlassCard>
              <div className="px-4 py-4 text-sm text-gray-600">No data found for the selected filters.</div>
            </GlassCard>
          )}

          <div className="flex flex-col gap-4">
            {data.map((inv, idxInv) => (
              <GlassCard
                key={idxInv + "-" + (inv.posted_number ?? "") + "-" + (inv.invoice_date ?? "")}
                className="overflow-hidden transition-all duration-200 hover:bg-white/70 hover:backdrop-blur-md hover:shadow-[0_12px_30px_-12px_rgba(37,99,235,0.25)]"
              >
                {/* Invoice Header */}
                <GlassSectionHeader
                  className="rounded-t-2xl"
                  title={
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-x-3 gap-y-1 text-sm">
                      <KV label="Posted #:" value={inv.posted_number || "-"} />
                      <KV label="Date:" value={inv.invoice_date || "-"} />
                      <KV label="Customer:" value={inv.customer_name || "-"} />
                      <KV label="User:" value={inv.user_name || "-"} />
                      <KV label="Doctor:" value={inv.doctor_name || "-"} />
                      <KV label="Patient:" value={inv.patient_name || "-"} />
                    </div>
                  }
                />

                {/* Items Table */}
                <div className="relative max-w-full overflow-x-auto">
                  <table className="w-full min-w-[900px] text-sm text-gray-900">
                    <thead className="sticky top-0 bg-white/85 backdrop-blur-sm border-b border-gray-200/70">
                      <tr className="text-left">
                        <Th>Product Name</Th>
                        <Th align="right">Pack Size</Th>
                        <Th>Batch #</Th>
                        <Th>Expiry</Th>
                        <Th align="right">Current Qty</Th>
                        <Th align="right">Qty</Th>
                        <Th align="right">Price</Th>
                        <Th align="right">Item Disc %</Th>
                        <Th align="right">Sub Total</Th>
                      </tr>
                    </thead>

                    <tbody className="tabular-nums">
                      {(inv.items || []).map((it, idx) => (
                        <tr
                          key={(it.id ?? idx) + "-" + (it.product_id ?? "p") + "-" + idx}
                          className="transition-all duration-150 odd:bg-white/90 even:bg-white/70 hover:bg-white/80 hover:backdrop-blur-[2px]"
                        >
                          <Td>{it.product_name || "-"}</Td>
                          <Td align="right">{it.pack_size ?? 0}</Td>
                          <Td>{it.batch_number || "-"}</Td>
                          <Td>{it.expiry || "-"}</Td>
                          <Td align="right">{it.current_quantity ?? 0}</Td>
                          <Td align="right">{it.quantity ?? 0}</Td>
                          <Td align="right">{fmtCurrency(it.price)}</Td>
                          <Td align="right">{(it.item_discount_percentage ?? 0).toFixed(2)}</Td>
                          <Td align="right">{fmtCurrency(it.sub_total)}</Td>
                        </tr>
                      ))}

                      {(!inv.items || !inv.items.length) && (
                        <tr>
                          <td colSpan={9} className="px-3 py-6 text-center text-gray-500">
                            No items match this filter in this invoice.
                          </td>
                        </tr>
                      )}
                    </tbody>

                    <tfoot className="bg-white/70 backdrop-blur-[2px]">
                      <tr>
                        <Td colSpan={6} align="right" strong>Discount %</Td>
                        <Td colSpan={1} align="right">{(inv.discount_percentage ?? 0).toFixed(2)}</Td>
                        <Td colSpan={1} align="right" strong>Discount Amt</Td>
                        <Td colSpan={1} align="right">{fmtCurrency(inv.discount_amount)}</Td>
                      </tr>
                      <tr>
                        <Td colSpan={6} align="right" strong>Tax %</Td>
                        <Td colSpan={1} align="right">{(inv.tax_percentage ?? 0).toFixed(2)}</Td>
                        <Td colSpan={1} align="right" strong>Tax Amt</Td>
                        <Td colSpan={1} align="right">{fmtCurrency(inv.tax_amount)}</Td>
                      </tr>
                      <tr>
                        <Td colSpan={8} align="right" strong>Item Discount</Td>
                        <Td colSpan={1} align="right">{fmtCurrency(inv.item_discount)}</Td>
                      </tr>
                      <tr>
                        <Td colSpan={8} align="right" strong>Gross Amount</Td>
                        <Td colSpan={1} align="right">{fmtCurrency(inv.gross_amount)}</Td>
                      </tr>
                      <tr>
                        <Td colSpan={8} align="right" strong className="!font-semibold">Total</Td>
                        <Td colSpan={1} align="right" className="!font-semibold">{fmtCurrency(inv.total)}</Td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </GlassCard>
            ))}
          </div>
        </>
      )}

      {/* Print & table niceties */}
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

/* ===== Small helpers to keep JSX clean while staying glassy ===== */
function KV({ label, value }) {
  return (
    <div className="text-sm">
      <span className="text-gray-600">{label}</span>{" "}
      <span className="font-semibold text-gray-900">{value}</span>
    </div>
  );
}

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
