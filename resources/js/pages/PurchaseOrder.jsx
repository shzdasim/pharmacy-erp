// src/pages/purchase-orders/forecast.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import Select from "react-select";
import {
  ArrowPathIcon,
  PlayCircleIcon,
  PrinterIcon,
} from "@heroicons/react/24/solid";
import { usePermissions } from "@/api/usePermissions.js";

// 🧊 glass primitives
import {
  GlassCard,
  GlassSectionHeader,
  GlassToolbar,
  GlassInput,
  GlassBtn,
} from "@/components/glass.jsx";

export default function PurchaseOrder() {
  const today = new Date().toISOString().split("T")[0];

  // 🔒 permissions (support both has() and canFor())
  const { loading: permsLoading, has, canFor } = usePermissions?.() || {};
  const canView =
    typeof has === "function"
      ? has("purchase-order.view")
      : typeof canFor === "function"
      ? !!canFor("purchase-order")?.view
      : true;
  const canGenerate =
    typeof has === "function"
      ? has("purchase-order.generate")
      : typeof canFor === "function"
      ? !!canFor("purchase-order")?.create
      : true;

  // 🧊 tint palette
  const tintBlue   = "bg-blue-500/85 text-white shadow-[0_6px_20px_-6px_rgba(37,99,235,0.45)] ring-1 ring-white/20 hover:bg-blue-500/95";
  const tintSlate  = "bg-slate-900/80 text-white shadow-[0_6px_20px_-6px_rgba(15,23,42,0.45)] ring-1 ring-white/15 hover:bg-slate-900/90";
  const tintGlass  = "bg-white/60 text-slate-700 ring-1 ring-white/30 hover:bg-white/75";
  const tintGreen  = "bg-emerald-500/85 text-white shadow-[0_6px_20px_-6px_rgba(16,185,129,0.45)] ring-1 ring-white/20 hover:bg-emerald-500/95";

  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [projectedDays, setProjectedDays] = useState(7);

  const [supplier, setSupplier] = useState(null);
  const [brand, setBrand] = useState(null);
  const [supplierOptions, setSupplierOptions] = useState([]);
  const [brandOptions, setBrandOptions] = useState([]);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const printBtnRef = useRef(null);

  // hydrate select options
  useEffect(() => {
    if (permsLoading || !canView) return;
    (async () => {
      try {
        const [supRes, brRes] = await Promise.all([
          axios.get("/api/suppliers"),
          axios.get("/api/brands"),
        ]);
        const supList = Array.isArray(supRes.data) ? supRes.data : (supRes.data?.data || []);
        const brList  = Array.isArray(brRes.data)  ? brRes.data  : (brRes.data?.data || []);
        setSupplierOptions(supList.map((s) => ({ value: s.id, label: s.name })));
        setBrandOptions(brList.map((b) => ({ value: b.id, label: b.name })));
      } catch (e) {
        // non-blocking
        console.warn(e);
      }
    })();
  }, [permsLoading, canView]);

  // Alt+P: print
  useEffect(() => {
    const onKey = (e) => {
      if (!e.altKey) return;
      const key = (e.key || "").toLowerCase();
      if (key !== "p") return;
      e.preventDefault();
      doPrint();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rows, canView]);

  const doPrint = () => {
    if (!canView) return toast.error("You don't have permission to view/print.");
    if (!rows.length) return toast.error("Nothing to print.");
    window.print();
  };

  const fmt2 = (v) => Number(v ?? 0).toFixed(2);

  const handleFetch = async () => {
    if (!canGenerate) return toast.error("You don't have permission to generate.");
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

  // ⬇️ IMPORTANT: portal + high z-index to ensure menus are above the table
  const selectStyles = {
    control: (base) => ({
      ...base,
      minHeight: 36,
      height: 36,
      fontSize: 13,
      background: "rgba(255,255,255,0.7)",
      backdropFilter: "blur(6px)",
      borderRadius: 12,
      borderColor: "rgba(226,232,240,0.7)",
    }),
    valueContainer: (base) => ({ ...base, height: 36, padding: "0 10px" }),
    indicatorsContainer: (base) => ({ ...base, height: 36 }),
    input: (base) => ({ ...base, margin: 0, padding: 0 }),
    menu: (base) => ({ ...base, fontSize: 13, borderRadius: 12, overflow: "hidden" }),
    option: (base) => ({ ...base, fontSize: 13 }),
    menuPortal: (base) => ({ ...base, zIndex: 9999 }), // ← keeps menu above sticky/overflow areas
  };

  if (permsLoading) return <div className="p-6">Loading…</div>;
  if (!canView) return <div className="p-6 text-sm text-gray-700">You don’t have permission to view Purchase Order (Forecast).</div>;

  return (
    <div className="p-4 md:p-6 space-y-4 print:p-0">
      {/* ===== Header ===== */}
      <GlassCard>
        <GlassSectionHeader
          title={
            <span className="inline-flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-600" />
              <span>Purchase Order (Forecast)</span>
            </span>
          }
          right={
            <div className="flex items-center gap-2">
              <GlassBtn
                className={`h-10 min-w-[120px] ${tintSlate}`}
                onClick={() => window.location.reload()}
                title="Refresh"
                aria-label="Refresh page"
              >
                <span className="inline-flex items-center gap-2">
                  <ArrowPathIcon className="w-5 h-5" />
                  Refresh
                </span>
              </GlassBtn>

              <GlassBtn
                ref={printBtnRef}
                onClick={doPrint}
                className={`h-10 min-w-[120px] ${tintGlass}`}
                title="Print (Alt+P)"
              >
                <span className="inline-flex items-center gap-2">
                  <PrinterIcon className="w-5 h-5" />
                  Print
                </span>
              </GlassBtn>
            </div>
          }
        />

        {/* Filters */}
        <GlassToolbar className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-sm text-gray-700">From</label>
            <GlassInput type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm text-gray-700">To</label>
            <GlassInput type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm text-gray-700">Projected Days</label>
            <GlassInput
              type="number"
              min={1}
              value={projectedDays}
              onChange={(e) => setProjectedDays(parseInt(e.target.value || 0, 10))}
              className="w-full"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm text-gray-700">Supplier (optional)</label>
            <Select
              classNamePrefix="rs"
              styles={selectStyles}
              options={supplierOptions}
              value={supplier}
              onChange={setSupplier}
              placeholder="Supplier"
              isClearable
              menuPortalTarget={typeof document !== "undefined" ? document.body : null}
              menuPosition="fixed"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm text-gray-700">Brand (optional)</label>
            <Select
              classNamePrefix="rs"
              styles={selectStyles}
              options={brandOptions}
              value={brand}
              onChange={setBrand}
              placeholder="Brand"
              isClearable
              menuPortalTarget={typeof document !== "undefined" ? document.body : null}
              menuPosition="fixed"
            />
          </div>

          <div className="flex items-end gap-2">
            <GlassBtn
              onClick={handleFetch}
              disabled={loading || !canGenerate}
              className={`h-10 min-w-[140px] ${canGenerate ? tintGreen : tintGlass} ${!canGenerate ? "opacity-60 cursor-not-allowed" : ""}`}
              title={!canGenerate ? "Not permitted" : "Generate forecast"}
            >
              <span className="inline-flex items-center gap-2">
                <PlayCircleIcon className="w-5 h-5" />
                {loading ? "Loading…" : "Generate"}
              </span>
            </GlassBtn>
          </div>
        </GlassToolbar>
      </GlassCard>

      {/* ===== Table ===== */}
      <GlassCard>
        <div className="max-h-[75vh] overflow-auto rounded-b-2xl">
          <table className="min-w-[1200px] w-full text-sm text-gray-900">
            <thead className="sticky top-0 bg-white/90 backdrop-blur-sm z-10 border-b border-gray-200/70">
              <tr className="text-left">
                <th className="px-3 py-2 font-medium">#</th>
                <th className="px-3 py-2 font-medium">Product</th>
                <th className="px-3 py-2 font-medium">Brand/Supplier</th>
                <th className="px-3 py-2 font-medium text-right">Pack Size</th>
                <th className="px-3 py-2 font-medium text-right">Units Sold</th>
                <th className="px-3 py-2 font-medium text-right">Packs Sold</th>
                <th className="px-3 py-2 font-medium text-right">Days</th>
                <th className="px-3 py-2 font-medium text-right">Daily Packs</th>
                <th className="px-3 py-2 font-medium text-right">Stock (U)</th>
                <th className="px-3 py-2 font-medium text-right">Stock (P)</th>
                <th className="px-3 py-2 font-medium text-right">Pack Price</th>
                <th className="px-3 py-2 font-medium text-right">Suggested (P)</th>
                <th className="px-3 py-2 font-medium text-right">Order Packs</th>
                <th className="px-3 py-2 font-medium text-right">Order Units</th>
                <th className="px-3 py-2 font-medium text-right">Order Amount</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((r, idx) => (
                <tr key={r._rowId} className="transition-colors odd:bg-white/90 even:bg-white/70 hover:bg-blue-50 border-b">
                  <td className="px-3 py-2">{idx + 1}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{r.product_name}</div>
                    {r.product_code && <div className="text-[10px] text-gray-500">{r.product_code}</div>}
                  </td>
                  <td className="px-3 py-2">
                    <div className="text-xs text-gray-700">{r.brand_name || "-"} / {r.supplier_name || "-"}</div>
                  </td>
                  <td className="px-3 py-2 text-right">{r.pack_size}</td>
                  <td className="px-3 py-2 text-right">{r.units_sold}</td>
                  <td className="px-3 py-2 text-right">{fmt2(r.packs_sold)}</td>
                  <td className="px-3 py-2 text-right">{r.days_in_range}</td>
                  <td className="px-3 py-2 text-right">{fmt2(r.daily_packs)}</td>
                  <td className="px-3 py-2 text-right">{r.current_stock_units}</td>
                  <td className="px-3 py-2 text-right">{fmt2(r.current_stock_packs)}</td>
                  <td className="px-3 py-2 text-right">{fmt2(r.pack_price)}</td>
                  <td className="px-3 py-2 text-right">{r.suggested_packs}</td>
                  <td className="px-3 py-2 text-right">
                    <GlassInput
                      type="number"
                      min={0}
                      value={r.order_packs}
                      onChange={(e) => updateOrderPacks(r._rowId, e.target.value)}
                      className="w-24 h-8 text-right"
                    />
                  </td>
                  <td className="px-3 py-2 text-right">{r.order_units}</td>
                  <td className="px-3 py-2 text-right">{fmt2(r.order_amount)}</td>
                </tr>
              ))}

              {!rows.length && (
                <tr>
                  <td colSpan={15} className="px-3 py-10 text-center text-gray-600">
                    No data. Choose filters and click <b>Generate</b>.
                  </td>
                </tr>
              )}
            </tbody>

            {rows.length > 0 && (
              <tfoot>
                <tr className="bg-white/90 backdrop-blur-sm border-t border-gray-200/70 font-semibold">
                  <td className="px-3 py-2" colSpan={12}>Totals</td>
                  <td className="px-3 py-2 text-right">{totals.packs}</td>
                  <td className="px-3 py-2 text-right">{totals.units}</td>
                  <td className="px-3 py-2 text-right">{fmt2(totals.amount)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </GlassCard>

      {/* Print styles */}
      <style>{`
        @media print {
          .print\\:p-0 { padding: 0 !important; }
          .rs__control, .rs__menu, input, select, button, [role="button"] { display: none !important; }
          table { font-size: 11px; }
          thead { position: sticky; top: 0; }
        }
      `}</style>
    </div>
  );
}
