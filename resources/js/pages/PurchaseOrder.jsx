import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import Select from "react-select";

export default function PurchaseOrder() {
  const today = new Date().toISOString().split("T")[0];

  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [projectedDays, setProjectedDays] = useState(7);

  const [supplier, setSupplier] = useState(null); // optional
  const [brand, setBrand] = useState(null);       // optional
  const [supplierOptions, setSupplierOptions] = useState([]);
  const [brandOptions, setBrandOptions] = useState([]);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const printBtnRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const [supRes, brRes] = await Promise.all([
          axios.get("/api/suppliers"),
          axios.get("/api/brands"),
        ]);
        setSupplierOptions((supRes.data || []).map((s) => ({ value: s.id, label: s.name })));
        setBrandOptions((brRes.data || []).map((b) => ({ value: b.id, label: b.name })));
      } catch (e) {
        console.warn(e);
      }
    })();
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.altKey && (e.key === "p" || e.key === "P")) {
        e.preventDefault();
        doPrint();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const doPrint = () => {
    if (!rows.length) return toast.error("Nothing to print.");
    window.print();
  };

  const fmt2 = (v) => Number(v ?? 0).toFixed(2);

  const handleFetch = async () => {
    if (!dateFrom || !dateTo) return toast.error("Please select both dates.");
    if (!projectedDays || projectedDays <= 0) return toast.error("Projected Days must be at least 1.");

    setLoading(true);
    try {
      const params = {
        date_from: dateFrom,
        date_to: dateTo,
        projected_days: projectedDays,
      };
      if (supplier) params.supplier_id = supplier.value;
      if (brand) params.brand_id = brand.value;

      const { data } = await axios.get("/api/purchase-orders/forecast", { params });

      const mapped = (data.items || []).map((r, idx) => {
        const order_packs = r.suggested_packs ?? 0;
        const order_units = order_packs * (r.pack_size ?? 1);
        const order_amount = order_packs * (r.pack_price ?? 0);
        return { ...r, order_packs, order_units, order_amount, _rowId: `${r.product_id}-${idx}` };
      });

      setRows(mapped);
      toast.success("Forecast ready.");
    } catch (err) {
      console.error(err);
      toast.error("Failed to load forecast.");
    } finally {
      setLoading(false);
    }
  };

  const totals = useMemo(() => {
    let packs = 0, units = 0, amount = 0;
    for (const r of rows) {
      packs  += Number(r.order_packs || 0);
      units  += Number(r.order_units || 0);
      amount += Number(r.order_amount || 0);
    }
    return { packs, units, amount };
  }, [rows]);

  const updateOrderPacks = (rowId, value) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r._rowId !== rowId) return r;
        const v = Math.max(0, parseInt(value || 0, 10));
        const units = v * (r.pack_size ?? 1);
        const amt   = v * (r.pack_price ?? 0);
        return { ...r, order_packs: v, order_units: units, order_amount: amt };
      })
    );
  };

  // compact react-select styles
  const selectStyles = {
    control: (base) => ({ ...base, minHeight: 30, height: 30, fontSize: 12 }),
    valueContainer: (base) => ({ ...base, height: 30, padding: '0 6px' }),
    indicatorsContainer: (base) => ({ ...base, height: 30 }),
    input: (base) => ({ ...base, margin: 0, padding: 0 }),
    menu: (base) => ({ ...base, fontSize: 12 }),
  };

  return (
    <div className="p-3 print:p-0">
      <h1 className="text-xl font-semibold mb-3">Purchase Order (Forecast)</h1>

      {/* Compact filters */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-2 mb-3 text-xs">
        <div className="flex flex-col">
          <label className="text-gray-700">From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="border rounded px-2 py-1 h-8 text-xs"
          />
        </div>
        <div className="flex flex-col">
          <label className="text-gray-700">To</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="border rounded px-2 py-1 h-8 text-xs"
          />
        </div>
        <div className="flex flex-col">
          <label className="text-gray-700">Projected Days</label>
          <input
            type="number"
            min={1}
            value={projectedDays}
            onChange={(e) => setProjectedDays(parseInt(e.target.value || 0, 10))}
            className="border rounded px-2 py-1 h-8 text-xs"
            placeholder="7"
          />
        </div>
        <div className="flex flex-col">
          <label className="text-gray-700">Supplier (optional)</label>
          <Select
            classNamePrefix="rs"
            styles={selectStyles}
            options={supplierOptions}
            value={supplier}
            onChange={setSupplier}
            placeholder="Supplier"
            isClearable
          />
        </div>
        <div className="flex flex-col">
          <label className="text-gray-700">Brand (optional)</label>
          <Select
            classNamePrefix="rs"
            styles={selectStyles}
            options={brandOptions}
            value={brand}
            onChange={setBrand}
            placeholder="Brand"
            isClearable
          />
        </div>
        <div className="flex items-end gap-2">
          <button
            onClick={handleFetch}
            disabled={loading}
            className="bg-blue-600 text-white px-2 py-1 h-8 text-xs rounded hover:bg-blue-700 disabled:opacity-60"
          >
            {loading ? "Loading..." : "Generate"}
          </button>
          <button
            ref={printBtnRef}
            onClick={doPrint}
            className="bg-gray-800 text-white px-2 py-1 h-8 text-xs rounded hover:bg-black"
            title="Alt+P"
          >
            Print
          </button>
        </div>
      </div>

      {/* Results */}
      <div className="overflow-auto border rounded">
        <table className="min-w-[1200px] w-full text-xs">
          <thead className="bg-gray-100 border-b">
            <tr>
              <th className="text-left p-2">#</th>
              <th className="text-left p-2">Product</th>
              <th className="text-left p-2">Brand/Supplier</th>
              <th className="text-right p-2">Pack Size</th>
              <th className="text-right p-2">Units Sold</th>
              <th className="text-right p-2">Packs Sold</th>
              <th className="text-right p-2">Days</th>
              <th className="text-right p-2">Daily Packs</th>
              <th className="text-right p-2">Stock (U)</th>
              <th className="text-right p-2">Stock (P)</th>
              <th className="text-right p-2">Pack Price</th>
              <th className="text-right p-2">Suggested (P)</th>
              <th className="text-right p-2">Order Packs</th>
              <th className="text-right p-2">Order Units</th>
              <th className="text-right p-2">Order Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr key={r._rowId} className="border-b hover:bg-gray-50">
                <td className="p-2">{idx + 1}</td>
                <td className="p-2">
                  <div className="font-medium">{r.product_name}</div>
                  {r.product_code && <div className="text-[10px] text-gray-500">{r.product_code}</div>}
                </td>
                <td className="p-2">
                  <div className="text-[11px] text-gray-700">
                    {r.brand_name || "-"} / {r.supplier_name || "-"}
                  </div>
                </td>
                <td className="p-2 text-right">{r.pack_size}</td>
                <td className="p-2 text-right">{r.units_sold}</td>
                <td className="p-2 text-right">{fmt2(r.packs_sold)}</td>
                <td className="p-2 text-right">{r.days_in_range}</td>
                <td className="p-2 text-right">{fmt2(r.daily_packs)}</td>
                <td className="p-2 text-right">{r.current_stock_units}</td>
                <td className="p-2 text-right">{fmt2(r.current_stock_packs)}</td>
                <td className="p-2 text-right">{fmt2(r.pack_price)}</td>
                <td className="p-2 text-right">{r.suggested_packs}</td>
                <td className="p-2 text-right">
                  <input
                    type="number"
                    min={0}
                    className="border rounded px-2 py-1 w-20 text-right h-7"
                    value={r.order_packs}
                    onChange={(e) => updateOrderPacks(r._rowId, e.target.value)}
                  />
                </td>
                <td className="p-2 text-right">{r.order_units}</td>
                <td className="p-2 text-right">{fmt2(r.order_amount)}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={15} className="p-6 text-center text-gray-500">
                  No data. Choose filters and click “Generate”.
                </td>
              </tr>
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="bg-gray-100 font-semibold">
                <td className="p-2" colSpan={12}>Totals</td>
                <td className="p-2 text-right">{totals.packs}</td>
                <td className="p-2 text-right">{totals.units}</td>
                <td className="p-2 text-right">{fmt2(totals.amount)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          .print\\:p-0 { padding: 0 !important; }
          button, input, .rs__control { display: none !important; }
          table { font-size: 11px; }
        }
      `}</style>
    </div>
  );
}
