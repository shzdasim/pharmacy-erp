// resources/js/pages/Reports/SaleDetailReport.jsx
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

import { ArrowDownOnSquareIcon, PencilSquareIcon, CheckCircleIcon, XCircleIcon } from "@heroicons/react/24/solid";

/* ======================
   Helpers
   ====================== */


const todayStr = () => new Date().toISOString().split("T")[0];
const yesterdayStr = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0];
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
      // keep trying next path
    }
  }
  throw lastErr;
}

export default function SaleDetailReport() {
  // ✅ Default date range: Yesterday → Today
  const [fromDate, setFromDate] = useState(yesterdayStr());
  const [toDate, setToDate] = useState(todayStr());

  // Filters
  const [customerValue, setCustomerValue] = useState(null);
  const [customerId, setCustomerId] = useState("");
  const [productValue, setProductValue] = useState(null);
  const [productId, setProductId] = useState("");

  // Data + States
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

const perms = usePermissions();
const canView = perms?.has?.("report.sale-detail.view");
const canExport = perms?.has?.("report.sale-detail.export");
const canEdit = perms?.has?.("report.sale-detail.edit"); // ✅ ADD THIS

// Get dark mode state
const { isDark } = useTheme();


  /* ============ Async loaders ============ */
  const loadCustomers = useMemo(
    () => async (input) => {
      const q = String(input || "").trim();
      if (!q) return [{ value: "", label: "All Customers" }];
      try {
        const res = await tryEndpoints(
          ["/api/customers/search", "/customers/search"],
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
        }));
      } catch {
        toast.error("Customer search failed");
        return [{ value: "", label: "No results" }];
      }
    },
    []
  );

  const loadProducts = useMemo(
    () => async (input) => {
      const q = String(input || "").trim();
      if (!q) return [{ value: "", label: "All Products" }];
      try {
        const res = await tryEndpoints(
          ["/api/products/search", "/products/search"],
          { q, limit: 30 }
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
    []
  );

  /* ============ Fetch report ============ */
  const fetchReport = async () => {
    if (!canView) return toast.error("You don't have permission to view this report.");
    if (fromDate > toDate) return toast.error("'From' date cannot be after 'To' date.");

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
      const rows = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data?.data)
        ? res.data.data
        : [];
      setData(rows);
      if (!rows.length) toast("No data found for selected range.", { icon: "ℹ️" });
    } catch (err) {
      console.error(err);
      toast.error("Failed to fetch Sale Detail report");
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  // Auto-load once permissions confirmed
  useEffect(() => {
  }, [canView]);


const [editingInvoiceId, setEditingInvoiceId] = useState(null);
const [editDoctor, setEditDoctor] = useState("");
const [editPatient, setEditPatient] = useState("");
const [saving, setSaving] = useState(false);

const saveInvoiceMeta = (inv) => async () => {
  setSaving(true);
  try {
    const res = await axios.put(
      `/api/sale-invoices/${inv.id}/meta`,
      {
        doctor_name: editDoctor,
        patient_name: editPatient,
      }
    );

    setData((prev) =>
      prev.map((x) =>
        x.id === inv.id
          ? {
              ...x,
              doctor_name: res.data.doctor_name,
              patient_name: res.data.patient_name,
            }
          : x
      )
    );

    toast.success("Updated");
    setEditingInvoiceId(null);
  } catch {
    toast.error("Update failed");
  } finally {
    setSaving(false);
  }
};


  /* ============ Export PDF ============ */
  const exportPdf = async () => {
    if (!canExport) return toast.error("You don't have permission to export PDF.");
    setPdfLoading(true);
    try {
      const res = await axios.get("/api/reports/sale-detail/pdf", {
        params: {
          from: fromDate,
          to: toDate,
          customer_id: customerId || undefined,
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
                title="Reset to Default (Yesterday → Today)"
                onClick={() => {
                  setFromDate(yesterdayStr());
                  setToDate(todayStr());
                  setData([]);
                }}
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
            {/* Dates */}
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

            {/* Keep your existing search filters */}
            <div className="md:col-span-4">
              <label className="text-sm text-gray-700 dark:text-gray-300 mb-1 block">Customer</label>
              <AsyncSelect
                cacheOptions
                defaultOptions={[{ value: "", label: "All Customers" }]}
                loadOptions={loadCustomers}
                isClearable
                value={customerValue}
                onChange={(opt) => {
                  setCustomerValue(opt);
                  setCustomerId(opt?.value || "");
                }}
                styles={getSelectStyles(isDark)}
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
                styles={getSelectStyles(isDark)}
                menuPortalTarget={document.body}  // 🟢 Added
                filterOption={createFilter({
                  matchFrom: "start",
                  trim: true,
                })}
              />
            </div>

            {/* Buttons */}
            <div className="md:col-span-12 flex flex-wrap gap-2">
              <GlassBtn
                type="submit"
                className={`h-9 min-w-[110px] ${tintSlate}`}
                disabled={loading}
              >
                Apply
              </GlassBtn>

              {/* ✅ Quick filters */}
              <GlassBtn
                className={`h-9 ${tintGlass}`}
                onClick={() => {
                  const end = new Date();
                const start = new Date();
                start.setDate(end.getDate() - 1);
                setFromDate(start.toISOString().slice(0, 10));
                setToDate(end.toISOString().slice(0, 10));
                  fetchReport();
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
                  fetchReport();
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
                  fetchReport();
                }}
              >
                7 Days
              </GlassBtn>

              <GlassBtn
                className={`h-9 flex items-center gap-2 ${canExport ? tintGlass : "opacity-60"}`}
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
            {data.map((inv, idxInv) => (
              <GlassCard
                key={idxInv + "-" + (inv.posted_number ?? "") + "-" + (inv.invoice_date ?? "")}
                className="overflow-hidden transition-all duration-200 hover:bg-white/70 hover:backdrop-blur-md hover:shadow-[0_12px_30px_-12px_rgba(37,99,235,0.25)] dark:hover:bg-slate-800/70 dark:hover:backdrop-blur-md"
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
                      {editingInvoiceId === inv.id ? (
                        <>
                          <GlassInput
                            className="h-7"
                            placeholder="Doctor"
                            value={editDoctor}
                            onChange={(e) => setEditDoctor(e.target.value)}
                          />
                          <GlassInput
                            className="h-7"
                            placeholder="Patient"
                            value={editPatient}
                            onChange={(e) => setEditPatient(e.target.value)}
                          />
                        </>
                      ) : (
                        <>
                          <KV label="Doctor:" value={inv.doctor_name || "-"} />
                          <KV label="Patient:" value={inv.patient_name || "-"} />
                        </>
                      )}
                    </div>
                  }
                  right={
                    canEdit && (
                      editingInvoiceId === inv.id ? (
                        <div className="flex gap-1">
                          {/* SAVE */}
                          <GlassBtn
                            className="h-8 px-2 bg-emerald-600/90 text-white hover:bg-emerald-600"
                            disabled={saving}
                            title="Save"
                            onClick={saveInvoiceMeta(inv)}
                          >
                            <CheckCircleIcon className="w-5 h-5" />
                          </GlassBtn>

                          {/* CANCEL */}
                          <GlassBtn
                            className="h-8 px-2 bg-rose-500/90 text-white hover:bg-rose-500"
                            title="Cancel"
                            onClick={() => setEditingInvoiceId(null)}
                          >
                            <XCircleIcon className="w-5 h-5" />
                          </GlassBtn>
                        </div>
                      ) : (
                        <GlassBtn
                          className="h-8 px-2 bg-sky-500/90 text-white hover:bg-sky-500"
                          title="Edit Doctor / Patient"
                          onClick={() => {
                            setEditingInvoiceId(inv.id);
                            setEditDoctor(inv.doctor_name || "");
                            setEditPatient(inv.patient_name || "");
                          }}
                        >
                          <PencilSquareIcon className="w-5 h-5" />
                        </GlassBtn>
                      )
                    )
                  }
                />

                {/* Items Table */}
                <div className="relative max-w-full overflow-x-auto">
                  <table className="w-full min-w-[900px] text-sm text-gray-900 dark:text-gray-100">
                    <thead className="sticky top-0 bg-white/85 backdrop-blur-sm border-b border-gray-200/70 dark:bg-slate-800/90 dark:border-slate-700/60">
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
                          className="transition-all duration-150 odd:bg-white/90 even:bg-white/70 hover:bg-white/80 hover:backdrop-blur-[2px] dark:odd:bg-slate-800/60 dark:even:bg-slate-700/40 dark:hover:bg-slate-700/70 dark:backdrop-blur-sm"
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
                          <td colSpan={9} className="px-3 py-6 text-center text-gray-500 dark:text-slate-400">
                            No items match this filter in this invoice.
                          </td>
                        </tr>
                      )}
                    </tbody>

                    <tfoot className="bg-white/70 backdrop-blur-[2px] dark:bg-slate-700/50 dark:backdrop-blur-sm">
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
