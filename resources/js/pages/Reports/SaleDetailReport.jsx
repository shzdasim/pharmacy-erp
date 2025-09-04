// SaleDetailReport.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import Select from "react-select";
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

const selectStyles = {
  control: (base) => ({
    ...base,
    minHeight: 34,
    height: 34,
    borderColor: "#D1D5DB",
    boxShadow: "none",
    "&:hover": { borderColor: "#9CA3AF" },
  }),
  valueContainer: (base) => ({ ...base, height: 34, padding: "0 8px" }),
  indicatorsContainer: (base) => ({ ...base, height: 34 }),
  input: (base) => ({ ...base, margin: 0, padding: 0 }),
  menuPortal: (base) => ({ ...base, zIndex: 9999 }),
};

export default function SaleDetailReport() {
  // Dates
  const [fromDate, setFromDate] = useState(firstDayOfMonthStr());
  const [toDate, setToDate] = useState(todayStr());

  // Filters
  const [customerOptions, setCustomerOptions] = useState([]);
  const [customerValue, setCustomerValue] = useState(null);
  const [customerId, setCustomerId] = useState("");

  const [productOptions, setProductOptions] = useState([]);
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

  // ===== Load options =====
  useEffect(() => {
    (async () => {
      try {
        const c = await axios.get("/api/customers", { params: { simple: 1 } }).catch(() => null);
        const cRows = Array.isArray(c?.data) ? c.data : Array.isArray(c?.data?.data) ? c.data.data : [];
        const cOpts = cRows.map((r) => ({
          value: r.id ?? r.value,
          label: r.name ?? r.label ?? r.title ?? `#${r.id}`,
        }));
        setCustomerOptions([{ value: "", label: "All Customers" }, ...cOpts]);

        const p = await axios.get("/api/products", { params: { simple: 1 } }).catch(() => null);
        const pRows = Array.isArray(p?.data) ? p.data : Array.isArray(p?.data?.data) ? p.data.data : [];
        const pOpts = pRows.map((r) => ({
          value: r.id ?? r.value,
          label: r.name ?? r.label ?? r.title ?? `#${r.id}`,
        }));
        setProductOptions([{ value: "", label: "All Products" }, ...pOpts]);
      } catch {}
    })();
  }, []);

  const filteredProductOptions = useMemo(() => productOptions, [productOptions]);

  // ===== Fetch report =====
  const fetchReport = async () => {
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
    fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Submit handler
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!fromDate || !toDate) return toast.error("Please select both dates.");
    if (fromDate > toDate) return toast.error("From Date cannot be after To Date.");
    fetchReport();
  };

  // PDF export (popup-safe)
  const exportPdf = async () => {
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

  return (
    <div className="p-3 w-full overflow-x-hidden">
      {/* Clean, larger typography just for this component */}
      <style>{`
        .clean-table { border-collapse: collapse; table-layout: auto; }
        .clean-table th, .clean-table td { padding: 8px 10px !important; line-height: 1.35; font-size: 13px; }
        .clean-table th { background: #F3F4F6; font-weight: 700; color: #111827; }
        .clean-table .num { text-align: right; }
        .clean-table .nowrap { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .clean-table tbody tr:nth-child(even) { background: #FAFAFA; }
        .clean-card { margin-bottom: 10px; border-radius: 8px; }
        .clean-card-hd { padding: 8px 10px; }
        .clean-hd-text { font-size: 13px; }
        .hdr-label { color:#6B7280 }
        .hdr-val { color:#111827; font-weight:600 }
        .sticky-head th { position: sticky; top: 0; z-index: 1; }
      `}</style>

      <h1 className="text-[15px] font-semibold mb-2 tracking-tight">Sale Detail Report</h1>

      {/* Filters */}
      <form
        onSubmit={handleSubmit}
        className="mb-3 bg-white rounded-md p-3 shadow-sm border border-gray-200 text-[13px]"
      >
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col">
            <label className="text-[12px] text-gray-600 mb-0.5">From</label>
            <input
              ref={fromRef}
              type="date"
              className="border rounded px-2 py-1.5 text-[13px] w-[160px] focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              onKeyDown={(e) => onKeyDownEnter(e, toRef)}
            />
          </div>

          <div className="flex flex-col">
            <label className="text-[12px] text-gray-600 mb-0.5">To</label>
            <input
              ref={toRef}
              type="date"
              className="border rounded px-2 py-1.5 text-[13px] w-[160px] focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              onKeyDown={(e) => onKeyDownEnter(e, { current: customerRef.current?.inputRef })}
            />
          </div>

          {/* Customer */}
          <div className="flex flex-col" style={{ minWidth: 260 }}>
            <label className="text-[12px] text-gray-600 mb-0.5">Customer</label>
            <Select
              ref={customerRef}
              classNamePrefix="rs"
              isSearchable
              menuPlacement="auto"
              options={customerOptions}
              value={customerValue}
              placeholder="All Customers"
              styles={selectStyles}
              onChange={(opt) => {
                setCustomerValue(opt);
                const id = opt?.value || "";
                setCustomerId(id);
                setTimeout(() => {
                  productRef.current?.focus?.();
                  productRef.current?.inputRef?.focus?.();
                }, 0);
              }}
            />
          </div>

          {/* Product */}
          <div className="flex flex-col" style={{ minWidth: 260 }}>
            <label className="text-[12px] text-gray-600 mb-0.5">Product</label>
            <Select
              ref={productRef}
              classNamePrefix="rs"
              isSearchable
              menuPlacement="auto"
              options={filteredProductOptions}
              value={productValue}
              placeholder="All Products"
              styles={selectStyles}
              onChange={(opt) => {
                setProductValue(opt);
                setProductId(opt?.value || "");
                setTimeout(() => submitRef.current?.focus?.(), 0);
              }}
            />
          </div>

          {/* Submit */}
          <button
            ref={submitRef}
            type="submit"
            className="h-9 px-3 rounded bg-indigo-600 text-white text-[13px] font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            disabled={loading}
            title="Submit"
          >
            {loading ? "Loading..." : "Submit"}
          </button>

          {/* Export PDF */}
          <button
            type="button"
            onClick={exportPdf}
            className="h-9 px-3 rounded bg-emerald-600 text-white text-[13px] font-medium hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            disabled={pdfLoading}
            title="Export PDF"
          >
            {pdfLoading ? "Generating…" : "Export PDF"}
          </button>
        </div>
      </form>

      {/* Results */}
      {data.length === 0 && !loading && (
        <div className="text-[13px] text-gray-600">No data found for the selected filters.</div>
      )}

      <div className="flex flex-col gap-3">
        {data.map((inv, idxInv) => (
          <div
            key={idxInv + "-" + (inv.posted_number ?? "") + "-" + (inv.invoice_date ?? "")}
            className="bg-white rounded-md border border-gray-200 shadow-sm overflow-hidden clean-card"
          >
            {/* Header */}
            <div className="px-3 py-2 border-b border-gray-200 bg-gray-50 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-x-3 gap-y-1 clean-card-hd">
              <div className="clean-hd-text"><span className="hdr-label">Posted #:</span> <span className="hdr-val">{inv.posted_number || "-"}</span></div>
              <div className="clean-hd-text"><span className="hdr-label">Date:</span> <span className="hdr-val">{inv.invoice_date || "-"}</span></div>
              <div className="clean-hd-text"><span className="hdr-label">Customer:</span> <span className="hdr-val">{inv.customer_name || "-"}</span></div>
              <div className="clean-hd-text"><span className="hdr-label">User:</span> <span className="hdr-val">{inv.user_name || "-"}</span></div>
              <div className="clean-hd-text"><span className="hdr-label">Doctor:</span> <span className="hdr-val">{inv.doctor_name || "-"}</span></div>
              <div className="clean-hd-text"><span className="hdr-label">Patient:</span> <span className="hdr-val">{inv.patient_name || "-"}</span></div>
            </div>

            {/* Table — clean, readable, not cramped */}
            <div className="relative max-w-full overflow-x-auto">
              <table className="clean-table w-full min-w-[900px] border border-gray-200">
                <thead className="sticky-head">
                  <tr>
                    <th className="border border-gray-200 text-left nowrap">Product Name</th>
                    <th className="border border-gray-200 num nowrap">Pack Size</th>
                    <th className="border border-gray-200 text-left nowrap">Batch #</th>
                    <th className="border border-gray-200 text-left nowrap">Expiry</th>
                    <th className="border border-gray-200 num nowrap">Current Qty</th>
                    <th className="border border-gray-200 num nowrap">Qty</th>
                    <th className="border border-gray-200 num nowrap">Price</th>
                    <th className="border border-gray-200 num nowrap">Item Disc %</th>
                    <th className="border border-gray-200 num nowrap">Sub Total</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {(inv.items || []).map((it, idx) => (
                    <tr key={(it.id ?? idx) + "-" + (it.product_id ?? "p") + "-" + idx}>
                      <td className="border border-gray-200 text-left nowrap">{it.product_name || "-"}</td>
                      <td className="border border-gray-200 num nowrap">{it.pack_size ?? 0}</td>
                      <td className="border border-gray-200 text-left nowrap">{it.batch_number || "-"}</td>
                      <td className="border border-gray-200 text-left nowrap">{it.expiry || "-"}</td>
                      <td className="border border-gray-200 num nowrap">{it.current_quantity ?? 0}</td>
                      <td className="border border-gray-200 num nowrap">{it.quantity ?? 0}</td>
                      <td className="border border-gray-200 num nowrap">{fmtCurrency(it.price)}</td>
                      <td className="border border-gray-200 num nowrap">{(it.item_discount_percentage ?? 0).toFixed(2)}</td>
                      <td className="border border-gray-200 num nowrap">{fmtCurrency(it.sub_total)}</td>
                    </tr>
                  ))}

                  {(!inv.items || !inv.items.length) && (
                    <tr>
                      <td colSpan={9} className="border border-gray-200 text-center text-gray-500">
                        No items match this filter in this invoice.
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr>
                    <td className="border border-gray-200 text-right font-medium" colSpan={6}>
                      Discount %
                    </td>
                    <td className="border border-gray-200 num" colSpan={1}>
                      {(inv.discount_percentage ?? 0).toFixed(2)}
                    </td>
                    <td className="border border-gray-200 text-right font-medium" colSpan={1}>
                      Discount Amt
                    </td>
                    <td className="border border-gray-200 num" colSpan={1}>
                      {fmtCurrency(inv.discount_amount)}
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-gray-200 text-right font-medium" colSpan={6}>
                      Tax %
                    </td>
                    <td className="border border-gray-200 num" colSpan={1}>
                      {(inv.tax_percentage ?? 0).toFixed(2)}
                    </td>
                    <td className="border border-gray-200 text-right font-medium" colSpan={1}>
                      Tax Amt
                    </td>
                    <td className="border border-gray-200 num" colSpan={1}>
                      {fmtCurrency(inv.tax_amount)}
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-gray-200 text-right font-medium" colSpan={8}>
                      Item Discount
                    </td>
                    <td className="border border-gray-200 num" colSpan={1}>
                      {fmtCurrency(inv.item_discount)}
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-gray-200 text-right font-medium" colSpan={8}>
                      Gross Amount
                    </td>
                    <td className="border border-gray-200 num" colSpan={1}>
                      {fmtCurrency(inv.gross_amount)}
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-gray-200 text-right font-semibold" colSpan={8}>
                      Total
                    </td>
                    <td className="border border-gray-200 num font-semibold" colSpan={1}>
                      {fmtCurrency(inv.total)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
