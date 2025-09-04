// PurchaseDetailReport.jsx
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

const smallSelectStyles = {
  control: (base) => ({
    ...base,
    minHeight: 28,
    height: 28,
    borderColor: "#D1D5DB",
    boxShadow: "none",
    "&:hover": { borderColor: "#9CA3AF" },
  }),
  valueContainer: (base) => ({ ...base, height: 28, padding: "0 6px" }),
  indicatorsContainer: (base) => ({ ...base, height: 28 }),
  input: (base) => ({ ...base, margin: 0, padding: 0 }),
  menuPortal: (base) => ({ ...base, zIndex: 9999 }),
};

export default function PurchaseDetailReport() {
  // Dates
  const [fromDate, setFromDate] = useState(firstDayOfMonthStr());
  const [toDate, setToDate] = useState(todayStr());

  // Filters
  const [supplierOptions, setSupplierOptions] = useState([]);
  const [supplierValue, setSupplierValue] = useState(null);
  const [supplierId, setSupplierId] = useState("");

  const [productOptions, setProductOptions] = useState([]);
  const [productValue, setProductValue] = useState(null);
  const [productId, setProductId] = useState("");

  // Data
  const [data, setData] = useState([]); // array of invoices (each with items[])
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  // Refs (for focus flow)
  const fromRef = useRef(null);
  const toRef = useRef(null);
  const supplierRef = useRef(null);
  const productRef = useRef(null);
  const submitRef = useRef(null);

  // ===== Load options =====
  useEffect(() => {
    (async () => {
      try {
        // Suppliers
        const s = await axios.get("/api/suppliers", { params: { simple: 1 } }).catch(() => null);
        const sRows = Array.isArray(s?.data) ? s.data : Array.isArray(s?.data?.data) ? s.data.data : [];
        const sOpts = sRows.map((r) => ({
          value: r.id ?? r.value,
          label: r.name ?? r.label ?? r.title ?? `#${r.id}`,
        }));
        setSupplierOptions([{ value: "", label: "All Suppliers" }, ...sOpts]);

        // Products
        const p = await axios.get("/api/products", { params: { simple: 1 } }).catch(() => null);
        const pRows = Array.isArray(p?.data) ? p.data : Array.isArray(p?.data?.data) ? p.data.data : [];
        const pOpts = pRows.map((r) => ({
          value: r.id ?? r.value,
          label: r.name ?? r.label ?? r.title ?? `#${r.id}`,
          supplier_id: r.supplier_id ?? r.supplierId ?? null,
        }));
        setProductOptions([{ value: "", label: "All Products" }, ...pOpts]);
      } catch {
        // keep form usable
      }
    })();
  }, []);

  // Filter product options by supplier (client-side)
  const filteredProductOptions = useMemo(() => {
    if (!supplierId) return productOptions;
    return productOptions.filter((o) => !o.supplier_id || o.supplier_id === supplierId || o.value === "");
  }, [productOptions, supplierId]);

  // ===== Fetch report =====
  const fetchReport = async () => {
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
      const rows = Array.isArray(res.data) ? res.data : Array.isArray(res.data?.data) ? res.data.data : [];
      setData(rows);
      if (!rows.length) toast("No results for selected filters.", { icon: "ℹ️" });
    } catch (err) {
      console.error(err);
      toast.error("Failed to load Purchase Detail report");
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
      const res = await axios.get("/api/reports/purchase-detail/pdf", {
        params: {
          from: fromDate,
          to: toDate,
          supplier_id: supplierId || undefined,
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
      try {
        win.close();
      } catch {}
      toast.error("Could not open PDF.");
    } finally {
      setPdfLoading(false);
    }
  };

  // Keyboard flow for date inputs (don't override React-Select behavior)
  const nextFocus = (ref) => ref?.current?.focus?.();
  const onKeyDownEnter = (e, next) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (next) nextFocus(next);
    }
  };

  return (
    <div className="p-2 w-full overflow-x-hidden">
      {/* Ultra-compact style just for this component */}
      <style>{`
        .tight-table { border-collapse: collapse; table-layout: fixed; }
        .tight-table th, .tight-table td { padding: 0 !important; line-height: 1.05; font-size: 12px; }
        .tight-table th { background: #f8fafc; font-weight: 600; color: #374151; }
        .tight-table .num { text-align: right; }
        .tight-table .nowrap { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .tight-table tr:nth-child(even) { background: #f9fafb; }
        .tight-card { margin-bottom: 6px; border-radius: 6px; }
        .tight-card-hd { padding: 4px 6px; }
        .tight-hd-text { font-size: 10px; }
      `}</style>

      <h1 className="text-[12px] font-semibold mb-1 tracking-tight">Purchase Detail Report</h1>

      {/* Filter Form (compact) */}
      <form
        onSubmit={handleSubmit}
        className="mb-2 bg-white rounded-md p-2 shadow-sm border border-gray-200 text-[11px]"
      >
        <div className="flex flex-wrap items-end gap-2">
          {/* From */}
          <div className="flex flex-col">
            <label className="text-[10px] text-gray-600 mb-0.5">From</label>
            <input
              ref={fromRef}
              type="date"
              className="border rounded px-1 py-[2px] text-[11px] w-[130px] focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              onKeyDown={(e) => onKeyDownEnter(e, toRef)}
            />
          </div>

          {/* To */}
          <div className="flex flex-col">
            <label className="text-[10px] text-gray-600 mb-0.5">To</label>
            <input
              ref={toRef}
              type="date"
              className="border rounded px-1 py-[2px] text-[11px] w-[130px] focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              onKeyDown={(e) => onKeyDownEnter(e, { current: supplierRef.current?.inputRef })}
            />
          </div>

          {/* Supplier */}
          <div className="flex flex-col" style={{ minWidth: 210 }}>
            <label className="text-[10px] text-gray-600 mb-0.5">Supplier</label>
            <Select
              ref={supplierRef}
              classNamePrefix="rs"
              isSearchable
              menuPlacement="auto"
              options={supplierOptions}
              value={supplierValue}
              placeholder="All Suppliers"
              styles={smallSelectStyles}
              onChange={(opt) => {
                setSupplierValue(opt);
                const id = opt?.value || "";
                setSupplierId(id);
                setProductValue(null);
                setProductId("");
                setTimeout(() => {
                  productRef.current?.focus?.();
                  productRef.current?.inputRef?.focus?.();
                }, 0);
              }}
            />
          </div>

          {/* Product */}
          <div className="flex flex-col" style={{ minWidth: 220 }}>
            <label className="text-[10px] text-gray-600 mb-0.5">Product</label>
            <Select
              ref={productRef}
              classNamePrefix="rs"
              isSearchable
              menuPlacement="auto"
              options={filteredProductOptions}
              value={productValue}
              placeholder="All Products"
              styles={smallSelectStyles}
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
            className="h-7 px-2 rounded bg-indigo-600 text-white text-[11px] font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            disabled={loading}
            title="Submit"
          >
            {loading ? "Loading..." : "Submit"}
          </button>

          {/* Export PDF */}
          <button
            type="button"
            onClick={exportPdf}
            className="h-7 px-2 rounded bg-emerald-600 text-white text-[11px] font-medium hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            disabled={pdfLoading}
            title="Export PDF"
          >
            {pdfLoading ? "Generating…" : "Export PDF"}
          </button>
        </div>
      </form>

      {/* Results */}
      {data.length === 0 && !loading && (
        <div className="text-[11px] text-gray-600">No data found for the selected filters.</div>
      )}

      <div className="flex flex-col gap-2">
        {data.map((inv) => (
          <div
            key={inv.id || `${inv.posted_number}-${inv.invoice_number}-${inv.invoice_date}`}
            className="bg-white rounded-md border border-gray-200 shadow-sm overflow-hidden tight-card"
          >
            {/* Header */}
            <div className="px-2 py-1 border-b border-gray-200 bg-gray-50 text-[10px] grid grid-cols-2 md:grid-cols-4 gap-x-2 gap-y-0.5 tight-card-hd">
              <div className="tight-hd-text">
                <span className="text-gray-600">Supplier:</span>{" "}
                <span className="font-medium text-gray-800">{inv.supplier_name || "-"}</span>
              </div>
              <div className="tight-hd-text">
                <span className="text-gray-600">Posted #:</span>{" "}
                <span className="font-medium text-gray-800">{inv.posted_number || "-"}</span>
              </div>
              <div className="tight-hd-text">
                <span className="text-gray-600">Invoice #:</span>{" "}
                <span className="font-medium text-gray-800">{inv.invoice_number || "-"}</span>
              </div>
              <div className="tight-hd-text">
                <span className="text-gray-600">Date:</span>{" "}
                <span className="font-medium text-gray-800">{inv.invoice_date || "-"}</span>
              </div>
            </div>

            {/* Table — compact, fixed layout, narrow widths */}
            <div className="relative max-w-full overflow-x-auto">
              <table className="tight-table w-full min-w-[1120px] border border-gray-200">
                <colgroup>
                  <col style={{ width: 140 }} />
                  <col style={{ width: 50 }} />
                  <col style={{ width: 50 }} />
                  {/* 13 numeric columns @ 60px each */}
                  {Array.from({ length: 13 }).map((_, i) => (
                    <col key={i} style={{ width: 60 }} />
                  ))}
                </colgroup>

                <thead>
                  <tr>
                    <th className="border border-gray-200 text-left nowrap">Product Name</th>
                    <th className="border border-gray-200 text-left nowrap">Batch</th>
                    <th className="border border-gray-200 text-left nowrap">Expiry</th>
                    <th className="border border-gray-200 num nowrap">Pack Qty</th>
                    <th className="border border-gray-200 num nowrap">Pack Size</th>
                    <th className="border border-gray-200 num nowrap">Unit Qty</th>
                    <th className="border border-gray-200 num nowrap">Pack Purchase</th>
                    <th className="border border-gray-200 num nowrap">Unit Purchase</th>
                    <th className="border border-gray-200 num nowrap">Pack Sale</th>
                    <th className="border border-gray-200 num nowrap">Unit Sale</th>
                    <th className="border border-gray-200 num nowrap">Pack Bonus</th>
                    <th className="border border-gray-200 num nowrap">Unit Bonus</th>
                    <th className="border border-gray-200 num nowrap">Item Disc %</th>
                    <th className="border border-gray-200 num nowrap">Margin</th>
                    <th className="border border-gray-200 num nowrap">Sub Total</th>
                    <th className="border border-gray-200 num nowrap">Quantity</th>
                  </tr>
                </thead>

                <tbody className="tabular-nums">
                  {(inv.items || []).map((it, idx) => (
                    <tr key={(it.id ?? idx) + "-" + (it.product_id ?? "p") + "-" + idx}>
                      <td className="border border-gray-200 text-left nowrap">{it.product_name || "-"}</td>
                      <td className="border border-gray-200 text-left nowrap">{it.batch || "-"}</td>
                      <td className="border border-gray-200 text-left nowrap">{it.expiry || "-"}</td>
                      <td className="border border-gray-200 num nowrap">{it.pack_quantity ?? 0}</td>
                      <td className="border border-gray-200 num nowrap">{it.pack_size ?? 0}</td>
                      <td className="border border-gray-200 num nowrap">{it.unit_quantity ?? 0}</td>
                      <td className="border border-gray-200 num nowrap">{fmtCurrency(it.pack_purchase_price)}</td>
                      <td className="border border-gray-200 num nowrap">{fmtCurrency(it.unit_purchase_price)}</td>
                      <td className="border border-gray-200 num nowrap">{fmtCurrency(it.pack_sale_price)}</td>
                      <td className="border border-gray-200 num nowrap">{fmtCurrency(it.unit_sale_price)}</td>
                      <td className="border border-gray-200 num nowrap">{it.pack_bonus ?? 0}</td>
                      <td className="border border-gray-200 num nowrap">{it.unit_bonus ?? 0}</td>
                      <td className="border border-gray-200 num nowrap">
                        {(it.item_discount_percentage ?? 0).toFixed(2)}
                      </td>
                      <td className="border border-gray-200 num nowrap">{(it.margin ?? 0).toFixed(2)}</td>
                      <td className="border border-gray-200 num nowrap">{fmtCurrency(it.sub_total)}</td>
                      <td className="border border-gray-200 num nowrap">{it.quantity ?? 0}</td>
                    </tr>
                  ))}

                  {(!inv.items || !inv.items.length) && (
                    <tr>
                      <td colSpan={16} className="border border-gray-200 text-center text-gray-500">
                        No items match this filter in this invoice.
                      </td>
                    </tr>
                  )}
                </tbody>

                <tfoot>
                  <tr>
                    <td className="border border-gray-200 text-right font-medium" colSpan={9}>
                      Tax %
                    </td>
                    <td className="border border-gray-200 num" colSpan={2}>
                      {(inv.tax_percentage ?? 0).toFixed(2)}
                    </td>
                    <td className="border border-gray-200 text-right font-medium" colSpan={3}>
                      Tax Amount
                    </td>
                    <td className="border border-gray-200 num" colSpan={2}>
                      {fmtCurrency(inv.tax_amount)}
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-gray-200 text-right font-medium" colSpan={9}>
                      Discount %
                    </td>
                    <td className="border border-gray-200 num" colSpan={2}>
                      {(inv.discount_percentage ?? 0).toFixed(2)}
                    </td>
                    <td className="border border-gray-200 text-right font-medium" colSpan={3}>
                      Discount Amount
                    </td>
                    <td className="border border-gray-200 num" colSpan={2}>
                      {fmtCurrency(inv.discount_amount)}
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-gray-200 text-right font-semibold" colSpan={14}>
                      Total Amount
                    </td>
                    <td className="border border-gray-200 num font-semibold" colSpan={2}>
                      {fmtCurrency(inv.total_amount)}
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
