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
    minHeight: 30,
    height: 30,
    borderColor: "#D1D5DB",
    boxShadow: "none",
    "&:hover": { borderColor: "#9CA3AF" },
  }),
  valueContainer: (base) => ({ ...base, height: 30, padding: "0 6px" }),
  indicatorsContainer: (base) => ({ ...base, height: 30 }),
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

  // PDF export
// PDF export (popup-safe)
const exportPdf = async () => {
  // open a blank tab immediately (keeps browsers from blocking it)
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
      // withCredentials helps if you rely on cookies/Sanctum
      withCredentials: true,
    });

    const contentType =
      (res.headers && (res.headers["content-type"] || res.headers["Content-Type"])) || "";

    // If server returned an error (HTML/JSON), show it nicely and close the pre-opened tab
    if (!contentType.includes("application/pdf")) {
      // Try to read error text from the blob
      const text = typeof res.data?.text === "function" ? await res.data.text() : "";
      win.close();
      toast.error(text?.slice(0, 200) || "Failed to generate PDF.");
      return;
    }

    // Success: build a blob URL and point the already-opened tab at it
    const blob = new Blob([res.data], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    win.location.href = url;

    // Cleanup: revoke the object URL after use
    const cleanup = () => URL.revokeObjectURL(url);
    // Revoke after tab navigates away or after a minute as a fallback
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
    // Close the pre-opened tab if something failed
    try { win.close(); } catch {}
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
    <div className="p-3 w-full overflow-x-hidden">
      <h1 className="text-sm font-semibold mb-2 tracking-tight">Purchase Detail Report</h1>

      {/* Filter Form (compact) */}
      <form
        onSubmit={handleSubmit}
        className="mb-3 bg-white rounded-md p-2 shadow-sm border border-gray-200 text-[12px]"
      >
        <div className="flex flex-wrap items-end gap-2">
          {/* From */}
          <div className="flex flex-col">
            <label className="text-[11px] text-gray-600 mb-0.5">From</label>
            <input
              ref={fromRef}
              type="date"
              className="border rounded px-1 py-1 text-[12px] w-[150px] focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              onKeyDown={(e) => onKeyDownEnter(e, toRef)}
            />
          </div>

          {/* To */}
          <div className="flex flex-col">
            <label className="text-[11px] text-gray-600 mb-0.5">To</label>
            <input
              ref={toRef}
              type="date"
              className="border rounded px-1 py-1 text-[12px] w-[150px] focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              onKeyDown={(e) => onKeyDownEnter(e, { current: supplierRef.current?.inputRef })}
            />
          </div>

          {/* Supplier */}
          <div className="flex flex-col" style={{ minWidth: 220 }}>
            <label className="text-[11px] text-gray-600 mb-0.5">Supplier</label>
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
                // reset product when supplier changes
                setProductValue(null);
                setProductId("");
                // after the menu closes, focus next field
                setTimeout(() => {
                  productRef.current?.focus?.();
                  productRef.current?.inputRef?.focus?.();
                }, 0);
              }}
            />
          </div>

          {/* Product */}
          <div className="flex flex-col" style={{ minWidth: 240 }}>
            <label className="text-[11px] text-gray-600 mb-0.5">Product</label>
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
            className="h-8 px-3 rounded bg-indigo-600 text-white text-[12px] font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            disabled={loading}
            title="Submit"
          >
            {loading ? "Loading..." : "Submit"}
          </button>

          {/* Export PDF */}
          <button
            type="button"
            onClick={exportPdf}
            className="h-8 px-3 rounded bg-emerald-600 text-white text-[12px] font-medium hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            disabled={pdfLoading}
            title="Export PDF"
          >
            {pdfLoading ? "Generating…" : "Export PDF"}
          </button>
        </div>
      </form>

      {/* Results */}
      {data.length === 0 && !loading && (
        <div className="text-[12px] text-gray-600">No data found for the selected filters.</div>
      )}

      <div className="flex flex-col gap-3">
        {data.map((inv) => (
          <div
            key={inv.id || `${inv.posted_number}-${inv.invoice_number}-${inv.invoice_date}`}
            className="bg-white rounded-md border border-gray-200 shadow-sm overflow-hidden"
          >
            {/* Header */}
            <div className="px-2 py-1 border-b border-gray-200 bg-gray-50 text-[11px] grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1">
              <div>
                <span className="text-gray-600">Supplier:</span>{" "}
                <span className="font-medium text-gray-800">{inv.supplier_name || "-"}</span>
              </div>
              <div>
                <span className="text-gray-600">Posted #:</span>{" "}
                <span className="font-medium text-gray-800">{inv.posted_number || "-"}</span>
              </div>
              <div>
                <span className="text-gray-600">Invoice #:</span>{" "}
                <span className="font-medium text-gray-800">{inv.invoice_number || "-"}</span>
              </div>
              <div>
                <span className="text-gray-600">Date:</span>{" "}
                <span className="font-medium text-gray-800">{inv.invoice_date || "-"}</span>
              </div>
            </div>

            {/* Table — only the table area scrolls horizontally */}
            <div className="relative max-w-full overflow-x-auto overscroll-x-contain">
              <table className="min-w-[1800px] w-full table-auto border border-gray-200 border-collapse text-[11px] leading-tight">
                <thead className="bg-gray-50">
                  <tr className="text-gray-700">
                    <th className="px-1 py-[2px] border border-gray-200 text-left whitespace-nowrap">Product Name</th>
                    <th className="px-1 py-[2px] border border-gray-200 text-left whitespace-nowrap">Batch</th>
                    <th className="px-1 py-[2px] border border-gray-200 text-left whitespace-nowrap">Expiry</th>
                    <th className="px-1 py-[2px] border border-gray-200 text-right whitespace-nowrap">Pack Qty</th>
                    <th className="px-1 py-[2px] border border-gray-200 text-right whitespace-nowrap">Pack Size</th>
                    <th className="px-1 py-[2px] border border-gray-200 text-right whitespace-nowrap">Unit Qty</th>
                    <th className="px-1 py-[2px] border border-gray-200 text-right whitespace-nowrap">Pack Purchase</th>
                    <th className="px-1 py-[2px] border border-gray-200 text-right whitespace-nowrap">Unit Purchase</th>
                    <th className="px-1 py-[2px] border border-gray-200 text-right whitespace-nowrap">Pack Sale</th>
                    <th className="px-1 py-[2px] border border-gray-200 text-right whitespace-nowrap">Unit Sale</th>
                    <th className="px-1 py-[2px] border border-gray-200 text-right whitespace-nowrap">Pack Bonus</th>
                    <th className="px-1 py-[2px] border border-gray-200 text-right whitespace-nowrap">Unit Bonus</th>
                    <th className="px-1 py-[2px] border border-gray-200 text-right whitespace-nowrap">Item Disc %</th>
                    <th className="px-1 py-[2px] border border-gray-200 text-right whitespace-nowrap">Margin</th>
                    <th className="px-1 py-[2px] border border-gray-200 text-right whitespace-nowrap">Sub Total</th>
                    <th className="px-1 py-[2px] border border-gray-200 text-right whitespace-nowrap">Quantity</th>
                  </tr>
                </thead>

                <tbody className="tabular-nums">
                  {(inv.items || []).map((it, idx) => (
                    <tr
                      key={(it.id ?? idx) + "-" + (it.product_id ?? "p") + "-" + idx}
                      className="odd:bg-white even:bg-gray-50/60"
                    >
                      <td className="px-1 py-[2px] border border-gray-200 text-left truncate">
                        {it.product_name || it.product?.name || "-"}
                      </td>
                      <td className="px-1 py-[2px] border border-gray-200 text-left truncate">{it.batch || "-"}</td>
                      <td className="px-1 py-[2px] border border-gray-200 text-left truncate">{it.expiry || "-"}</td>
                      <td className="px-1 py-[2px] border border-gray-200 text-right whitespace-nowrap">
                        {it.pack_quantity ?? 0}
                      </td>
                      <td className="px-1 py-[2px] border border-gray-200 text-right whitespace-nowrap">
                        {it.pack_size ?? 0}
                      </td>
                      <td className="px-1 py-[2px] border border-gray-200 text-right whitespace-nowrap">
                        {it.unit_quantity ?? 0}
                      </td>
                      <td className="px-1 py-[2px] border border-gray-200 text-right whitespace-nowrap">
                        {fmtCurrency(it.pack_purchase_price)}
                      </td>
                      <td className="px-1 py-[2px] border border-gray-200 text-right whitespace-nowrap">
                        {fmtCurrency(it.unit_purchase_price)}
                      </td>
                      <td className="px-1 py-[2px] border border-gray-200 text-right whitespace-nowrap">
                        {fmtCurrency(it.pack_sale_price)}
                      </td>
                      <td className="px-1 py-[2px] border border-gray-200 text-right whitespace-nowrap">
                        {fmtCurrency(it.unit_sale_price)}
                      </td>
                      <td className="px-1 py-[2px] border border-gray-200 text-right whitespace-nowrap">
                        {it.pack_bonus ?? 0}
                      </td>
                      <td className="px-1 py-[2px] border border-gray-200 text-right whitespace-nowrap">
                        {it.unit_bonus ?? 0}
                      </td>
                      <td className="px-1 py-[2px] border border-gray-200 text-right whitespace-nowrap">
                        {(it.item_discount_percentage ?? 0).toFixed(2)}
                      </td>
                      <td className="px-1 py-[2px] border border-gray-200 text-right whitespace-nowrap">
                        {(it.margin ?? 0).toFixed(2)}
                      </td>
                      <td className="px-1 py-[2px] border border-gray-200 text-right whitespace-nowrap">
                        {fmtCurrency(it.sub_total)}
                      </td>
                      <td className="px-1 py-[2px] border border-gray-200 text-right whitespace-nowrap">
                        {it.quantity ?? 0}
                      </td>
                    </tr>
                  ))}

                  {(!inv.items || !inv.items.length) && (
                    <tr>
                      <td colSpan={16} className="px-1 py-2 border border-gray-200 text-center text-gray-500">
                        No items match this filter in this invoice.
                      </td>
                    </tr>
                  )}
                </tbody>

                <tfoot className="bg-gray-50 tabular-nums">
                  <tr className="text-gray-800">
                    <td className="px-1 py-[2px] border border-gray-200 text-right font-medium" colSpan={9}>
                      Tax %
                    </td>
                    <td className="px-1 py-[2px] border border-gray-200 text-right" colSpan={2}>
                      {(inv.tax_percentage ?? 0).toFixed(2)}
                    </td>
                    <td className="px-1 py-[2px] border border-gray-200 text-right font-medium" colSpan={3}>
                      Tax Amount
                    </td>
                    <td className="px-1 py-[2px] border border-gray-200 text-right" colSpan={2}>
                      {fmtCurrency(inv.tax_amount)}
                    </td>
                  </tr>
                  <tr className="text-gray-800">
                    <td className="px-1 py-[2px] border border-gray-200 text-right font-medium" colSpan={9}>
                      Discount %
                    </td>
                    <td className="px-1 py-[2px] border border-gray-200 text-right" colSpan={2}>
                      {(inv.discount_percentage ?? 0).toFixed(2)}
                    </td>
                    <td className="px-1 py-[2px] border border-gray-200 text-right font-medium" colSpan={3}>
                      Discount Amount
                    </td>
                    <td className="px-1 py-[2px] border border-gray-200 text-right" colSpan={2}>
                      {fmtCurrency(inv.discount_amount)}
                    </td>
                  </tr>
                  <tr className="text-gray-900">
                    <td className="px-1 py-[2px] border border-gray-200 text-right font-semibold" colSpan={14}>
                      Total Amount
                    </td>
                    <td className="px-1 py-[2px] border border-gray-200 text-right font-semibold" colSpan={2}>
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
