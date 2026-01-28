// /src/pages/purchase-invoices/Show.jsx
import { useEffect, useRef, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import { usePermissions, Guard } from "@/api/usePermissions.js";

// Common anti-autofill props
const antiFill = {
  autoComplete: "off",
  autoCorrect: "off",
  autoCapitalize: "off",
  spellCheck: false,
};

const to2 = (n) => Number(parseFloat(n || 0).toFixed(2));

export default function PurchaseInvoiceShow() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [inv, setInv] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteStep, setDeleteStep] = useState(1);
  const [password, setPassword] = useState("");

  // glassy button presets
  const btnBlueGlass =
    "bg-blue-500/85 text-white ring-1 ring-white/20 backdrop-blur-sm shadow-[0_6px_20px_-6px_rgba(37,99,235,0.45)] hover:bg-blue-500/95";
  const btnRoseGlass =
    "bg-rose-500/85 text-white ring-1 ring-white/20 backdrop-blur-sm shadow-[0_6px_20px_-6px_rgba(244,63,94,0.45)] hover:bg-rose-500/95";
  const btnSlateGlass =
    "bg-slate-600/85 text-white ring-1 ring-white/20 backdrop-blur-sm shadow-[0_6px_20px_-6px_rgba(15,23,42,0.45)] hover:bg-slate-600/95 dark:bg-slate-700/85 dark:hover:bg-slate-700/95";
  const btnGreenGlass =
    "bg-green-600/85 text-white ring-1 ring-white/20 backdrop-blur-sm shadow-[0_6px_20px_-6px_rgba(22,163,74,0.45)] hover:bg-green-600/95";
  const btnAmberGlass =
    "bg-amber-500/85 text-white ring-1 ring-white/20 backdrop-blur-sm shadow-[0_6px_20px_-6px_rgba(245,158,11,0.45)] hover:bg-amber-500/95";
  const chip =
    "px-1 py-0.5 border rounded bg-gray-50 dark:bg-slate-700 text-[10px] leading-none text-gray-700 dark:text-gray-300";

  // 🔒 permissions
  const { loading: permsLoading, canFor } = usePermissions?.() || {};
  const can = useMemo(
    () =>
      (typeof canFor === "function"
        ? canFor("purchase-invoice")
        : { view: false, create: false, update: false, delete: false, import: false, export: false }),
    [canFor]
  );

  // Fetch invoice
  useEffect(() => {
    (async () => {
      try {
        const { data } = await axios.get(`/api/purchase-invoices/${id}`);
        setInv(data);
      } catch {
        toast.error("Failed to load invoice");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  // Calculate totals
  const totalAmount = useMemo(() => to2(inv?.total_amount), [inv]);
  const totalPaid = useMemo(() => to2(inv?.total_paid), [inv]);
  const remainingAmount = useMemo(() => Math.max(totalAmount - totalPaid, 0), [totalAmount, totalPaid]);
  const invoiceAmount = useMemo(() => Number(inv?.invoice_amount || 0), [inv]);
  const difference = useMemo(() => invoiceAmount - totalAmount, [invoiceAmount, totalAmount]);

  // After delete, go to previous or index
  const goToPrevOrIndex = async (deletedId) => {
    try {
      const res = await axios.get("/api/purchase-invoices", { params: { per_page: 100 } });
      const list = Array.isArray(res.data?.data) ? res.data.data : Array.isArray(res.data) ? res.data : [];
      const prev = list
        .filter((x) => Number(x?.id) < Number(deletedId))
        .sort((a, b) => Number(b?.id) - Number(a?.id))[0];

      if (prev?.id) navigate(`/purchase-invoices/${prev.id}`);
      else navigate("/purchase-invoices");
    } catch {
      navigate("/purchase-invoices");
    }
  };

  // ===== Delete flow =====
  const openDeleteModal = () => {
    if (!can.delete) return toast.error("You don't have permission to delete purchase invoices.");
    setPassword("");
    setDeleteStep(1);
    setDeleteModalOpen(true);
  };
  const closeDeleteModal = () => {
    if (deleting) return;
    setDeleteModalOpen(false);
    setDeleteStep(1);
    setPassword("");
  };

  const confirmAndDelete = async () => {
    if (!id) return;
    if (!can.delete) return toast.error("You don't have permission to delete purchase invoices.");
    try {
      setDeleting(true);
      await axios.post("/api/auth/confirm-password", { password });
      await axios.delete(`/api/purchase-invoices/${id}`);
      toast.success("Purchase invoice deleted");
      await goToPrevOrIndex(id);
      closeDeleteModal();
    } catch (e) {
      const msg =
        e?.response?.data?.message ||
        (e?.response?.status === 422 ? "Incorrect password" : "Failed to delete invoice");
      toast.error(msg);
    } finally {
      setDeleting(false);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e) => {
      if (!e.altKey) return;
      const k = (e.key || "").toLowerCase();
      if (k === "b") { e.preventDefault(); navigate(-1); }
      if (k === "e") {
        if (!can.update) return;
        e.preventDefault();
        navigate(`/purchase-invoices/${id}/edit`);
      }
      if (k === "d") {
        if (!can.delete) return;
        e.preventDefault();
        openDeleteModal();
      }
      if (k === "n") {
        if (!can.create) return;
        e.preventDefault();
        navigate("/purchase-invoices/create");
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [navigate, id, can]);

  if (loading || permsLoading) return <div className="p-4 text-sm dark:text-gray-400">Loading…</div>;
  if (!inv) return <div className="p-4 text-sm dark:text-gray-400">Invoice not found.</div>;

  const fmt = (v) => ((v ?? "") === "" ? "" : String(v));

  return (
    <div
      className="flex flex-col dark:bg-slate-800"
      style={{ minHeight: "74vh", maxHeight: "80vh" }}
      autoComplete="off"
    >
      {/* ================= HEADER SECTION ================= */}
      <div className="sticky top-0 bg-white dark:bg-slate-800 shadow p-2 z-10 dark:shadow-slate-700" autoComplete="off">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-bold dark:text-gray-200">
            Purchase Invoice View (Alt+E Edit, Alt+D Delete, Alt+N New, Alt+B Back)
          </h2>
          
          {/* Invoice Type Radio Buttons (read-only) */}
          <div className="flex items-center gap-3 bg-gray-50 dark:bg-slate-700 px-3 py-1.5 rounded border dark:border-slate-600">
            <label className="flex items-center gap-1 cursor-not-allowed opacity-70">
              <input
                type="radio"
                name="invoice_type"
                value="debit"
                checked={inv.invoice_type === "debit"}
                readOnly
                className="cursor-not-allowed"
              />
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Debit</span>
            </label>
            <label className="flex items-center gap-1 cursor-not-allowed opacity-70">
              <input
                type="radio"
                name="invoice_type"
                value="credit"
                checked={inv.invoice_type === "credit"}
                readOnly
                className="cursor-not-allowed"
              />
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Credit</span>
            </label>
          </div>
        </div>
        
        <table className="w-full border-collapse text-xs">
          <tbody>
            <tr>
              <td className="border p-1 w-1/12 dark:border-slate-600">
                <label className="block text-[10px] dark:text-gray-400">Posted Number</label>
                <input
                  type="text"
                  inputMode="decimal"
                  name="posted_number"
                  readOnly
                  value={fmt(inv.posted_number)}
                  className="bg-gray-100 dark:bg-slate-700 dark:text-gray-200 border dark:border-slate-600 rounded w-full p-1 h-7 text-xs"
                  {...antiFill}
                />
              </td>
              <td className="border p-1 w-1/6 dark:border-slate-600">
                <label className="block text-[10px] dark:text-gray-400">Posted Date</label>
                <input
                  type="text"
                  name="posted_date"
                  readOnly
                  value={fmt(inv.posted_date)}
                  className="border dark:border-slate-600 rounded w-full p-1 h-7 text-xs bg-gray-100 dark:bg-slate-700 dark:text-gray-200"
                  {...antiFill}
                />
              </td>
              <td className="border p-1 w-1/3 dark:border-slate-600">
                <label className="block text-[10px] dark:text-gray-400">Supplier</label>
                <input
                  type="text"
                  readOnly
                  value={inv.supplier?.name ?? inv.supplier_id ?? ""}
                  className="border dark:border-slate-600 rounded w-full p-1 h-7 text-xs bg-gray-100 dark:bg-slate-700 dark:text-gray-200"
                  {...antiFill}
                />
              </td>
              <td className="border p-1 w-1/8 dark:border-slate-600">
                <label className="block text-[10px] dark:text-gray-400">Invoice Number</label>
                <input
                  type="text"
                  name="invoice_number"
                  readOnly
                  value={fmt(inv.invoice_number)}
                  className="border dark:border-slate-600 rounded w-full p-1 h-7 text-xs bg-gray-100 dark:bg-slate-700 dark:text-gray-200"
                  {...antiFill}
                />
              </td>
              <td className="border p-1 w-1/8 dark:border-slate-600">
                <label className="block text-[10px] dark:text-gray-400">Invoice Amount</label>
                <input
                  type="text"
                  name="invoice_amount"
                  readOnly
                  value={fmt(inv.invoice_amount)}
                  className="border dark:border-slate-600 rounded w-full p-1 h-7 text-xs bg-gray-100 dark:bg-slate-700 dark:text-gray-200"
                  {...antiFill}
                />
              </td>
              <td className="border p-1 w-1/8 dark:border-slate-600">
                <label className="block text-[10px] dark:text-gray-400">Difference</label>
                <input
                  type="text"
                  readOnly
                  value={difference.toFixed(2)}
                  className={`border dark:border-slate-600 rounded w-full p-1 h-7 text-xs font-bold text-center bg-gray-100 dark:bg-slate-700 dark:text-gray-200 ${
                    difference !== 0 ? "text-red-600 dark:text-red-400" : "text-gray-700 dark:text-gray-300"
                  }`}
                  {...antiFill}
                />
              </td>
              <td className="border p-1 w-1/6 dark:border-slate-600">
                <label className="block text-[10px] dark:text-gray-400">Remarks</label>
                <input
                  type="text"
                  name="remarks"
                  readOnly
                  value={fmt(inv.remarks)}
                  className="border dark:border-slate-600 rounded w-full p-1 h-7 text-xs bg-gray-100 dark:bg-slate-700 dark:text-gray-200"
                  {...antiFill}
                />
              </td>
            </tr>
          </tbody>
        </table>

        {/* Action Buttons */}
        <div className="mt-2 flex items-center gap-2">
          <Guard when={can.update}>
            <button
              type="button"
              onClick={() => navigate(`/purchase-invoices/${id}/edit`)}
              className={`px-4 py-1.5 rounded text-xs ${btnAmberGlass}`}
              title="Alt+E"
            >
              ✏️ Edit (Alt+E)
            </button>
          </Guard>
          <Guard when={can.delete}>
            <button
              type="button"
              onClick={openDeleteModal}
              className={`px-4 py-1.5 rounded text-xs ${btnRoseGlass}`}
              title="Alt+D"
            >
              🗑 Delete (Alt+D)
            </button>
          </Guard>
          <Guard when={can.create}>
            <button
              type="button"
              onClick={() => navigate("/purchase-invoices/create")}
              className={`px-4 py-1.5 rounded text-xs ${btnBlueGlass}`}
              title="Alt+N"
            >
              ➕ New (Alt+N)
            </button>
          </Guard>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className={`px-4 py-1.5 rounded text-xs ${btnSlateGlass}`}
            title="Alt+B"
          >
            ← Back (Alt+B)
          </button>
        </div>
      </div>

      {/* ================= ITEMS SECTION ================= */}
      <div className="flex-1 overflow-auto p-1 dark:bg-slate-800" autoComplete="off">
        <h2 className="text-xs font-bold mb-1 dark:text-gray-200">Items</h2>

        <table className="w-full border-collapse text-[11px]">
          <thead className="sticky top-0 bg-gray-100 dark:bg-slate-700 z-5">
            <tr>
              <th rowSpan={2} className="border w-6 dark:border-slate-600 dark:text-gray-200">#</th>
              <th rowSpan={2} colSpan={1} className="border w-[80px] dark:border-slate-600 dark:text-gray-200">Product</th>
              <th colSpan={3} className="border dark:border-slate-600 dark:text-gray-200">Pack Size / Batch / Expiry</th>
              <th colSpan={2} className="border dark:border-slate-600 dark:text-gray-200">Qty (Pack / Unit)</th>
              <th colSpan={2} className="border dark:border-slate-600 dark:text-gray-200">Purchase Price (P / U)</th>
              <th colSpan={3} className="border dark:border-slate-600 dark:text-gray-200">Disc % / Bonus (P / U)</th>
              <th colSpan={2} className="border dark:border-slate-600 dark:text-gray-200">Sale Price (P / U)</th>
              <th colSpan={3} className="border dark:border-slate-600 dark:text-gray-200">Margin % / Avg / Sub Total</th>
            </tr>

            <tr>
              <th className="border w-14 dark:border-slate-600 dark:text-gray-200">PSize</th>
              <th className="border w-16 dark:border-slate-600 dark:text-gray-200">Batch</th>
              <th className="border w-20 dark:border-slate-600 dark:text-gray-200">Exp</th>
              <th className="border w-12 dark:border-slate-600 dark:text-gray-200">Pack.Q</th>
              <th className="border w-12 dark:border-slate-600 dark:text-gray-200">Unit.Q</th>
              <th className="border w-14 dark:border-slate-600 dark:text-gray-200">Pack.P</th>
              <th className="border w-14 dark:border-slate-600 dark:text-gray-200">Unit.P</th>
              <th className="border w-14 dark:border-slate-600 dark:text-gray-200">Disc%</th>
              <th className="border w-14 dark:border-slate-600 dark:text-gray-200">PBonus</th>
              <th className="border w-14 dark:border-slate-600 dark:text-gray-200">UBonus</th>
              <th className="border w-14 dark:border-slate-600 dark:text-gray-200">Pack.S</th>
              <th className="border w-14 dark:border-slate-600 dark:text-gray-200">Unit.S</th>
              <th className="border w-14 dark:border-slate-600 dark:text-gray-200">Margin%</th>
              <th className="border w-16 dark:border-slate-600 dark:text-gray-200">Avg</th>
              <th className="border w-20 dark:border-slate-600 dark:text-gray-200">Sub Total</th>
            </tr>
          </thead>

          <tbody>
            {(inv.items || []).map((item, i) => (
              <tr key={i} className="text-center dark:text-gray-300">
                {/* Row Number */}
                <td className="border px-1 dark:border-slate-600">{i + 1}</td>

                {/* Product */}
                <td className="border px-1 text-left dark:border-slate-600">{fmt(item.product?.name ?? item.product_id)}</td>

                {/* Pack Size */}
                <td className="border w-14 dark:border-slate-600">
                  <input
                    type="number"
                    readOnly
                    value={fmt(item.pack_size)}
                    className="border dark:border-slate-600 bg-gray-100 dark:bg-slate-700 dark:text-gray-200 w-full h-6 text-[11px] px-1"
                    {...antiFill}
                  />
                </td>

                {/* Batch */}
                <td className="border w-16 dark:border-slate-600">
                  <input
                    type="text"
                    readOnly
                    value={fmt(item.batch)}
                    className="border dark:border-slate-600 bg-gray-100 dark:bg-slate-700 dark:text-gray-200 w-full h-6 text-[11px] px-1"
                    {...antiFill}
                  />
                </td>

                {/* Expiry */}
                <td className="border w-20 dark:border-slate-600">
                  <input
                    type="text"
                    readOnly
                    value={fmt(item.expiry)}
                    className="border dark:border-slate-600 bg-gray-100 dark:bg-slate-700 dark:text-gray-200 w-full h-6 text-[11px] px-1"
                    {...antiFill}
                  />
                </td>

                {/* Pack Qty */}
                <td className="border dark:border-slate-600">
                  <input
                    type="text"
                    readOnly
                    value={fmt(item.pack_quantity)}
                    className="border dark:border-slate-600 bg-gray-100 dark:bg-slate-700 dark:text-gray-200 w-full h-6 text-[11px] px-1"
                    {...antiFill}
                  />
                </td>

                {/* Unit Qty */}
                <td className="border dark:border-slate-600">
                  <input
                    type="text"
                    readOnly
                    value={fmt(item.unit_quantity)}
                    className="border dark:border-slate-600 bg-gray-100 dark:bg-slate-700 dark:text-gray-200 w-full h-6 text-[11px] px-1"
                    {...antiFill}
                  />
                </td>

                {/* Pack Purchase */}
                <td className="border dark:border-slate-600">
                  <input
                    type="text"
                    readOnly
                    value={fmt(item.pack_purchase_price)}
                    className="border dark:border-slate-600 bg-gray-100 dark:bg-slate-700 dark:text-gray-200 w-full h-6 text-[11px] px-1"
                    {...antiFill}
                  />
                </td>

                {/* Unit Purchase */}
                <td className="border dark:border-slate-600">
                  <input
                    type="text"
                    readOnly
                    value={fmt(item.unit_purchase_price)}
                    className="border dark:border-slate-600 bg-gray-100 dark:bg-slate-700 dark:text-gray-200 w-full h-6 text-[11px] px-1"
                    {...antiFill}
                  />
                </td>

                {/* Disc% */}
                <td className="border dark:border-slate-600">
                  <input
                    type="text"
                    readOnly
                    value={fmt(item.item_discount_percentage)}
                    className="border dark:border-slate-600 bg-gray-100 dark:bg-slate-700 dark:text-gray-200 w-full h-6 text-[11px] px-1"
                    {...antiFill}
                  />
                </td>

                {/* Pack Bonus */}
                <td className="border dark:border-slate-600">
                  <input
                    type="text"
                    readOnly
                    value={fmt(item.pack_bonus)}
                    className="border dark:border-slate-600 bg-gray-100 dark:bg-slate-700 dark:text-gray-200 w-full h-6 text-[11px] px-1"
                    {...antiFill}
                  />
                </td>

                {/* Unit Bonus */}
                <td className="border dark:border-slate-600">
                  <input
                    type="text"
                    readOnly
                    value={fmt(item.unit_bonus)}
                    className="border dark:border-slate-600 bg-gray-100 dark:bg-slate-700 dark:text-gray-200 w-full h-6 text-[11px] px-1"
                    {...antiFill}
                  />
                </td>

                {/* Pack Sale */}
                <td className="border dark:border-slate-600">
                  <input
                    type="text"
                    readOnly
                    value={fmt(item.pack_sale_price)}
                    className="border dark:border-slate-600 bg-gray-100 dark:bg-slate-700 dark:text-gray-200 w-full h-6 text-[11px] px-1"
                    {...antiFill}
                  />
                </td>

                {/* Unit Sale */}
                <td className="border dark:border-slate-600">
                  <input
                    type="text"
                    readOnly
                    value={fmt(item.unit_sale_price)}
                    className="border dark:border-slate-600 bg-gray-100 dark:bg-slate-700 dark:text-gray-200 w-full h-6 text-[11px] px-1"
                    {...antiFill}
                  />
                </td>

                {/* Margin % */}
                <td className="border dark:border-slate-600">
                  <input
                    type="number"
                    readOnly
                    value={fmt(item.margin)}
                    className="border dark:border-slate-600 bg-gray-100 dark:bg-slate-700 dark:text-gray-200 w-full h-6 text-[11px] px-1"
                    {...antiFill}
                  />
                </td>

                {/* Avg Price */}
                <td className="border dark:border-slate-600">
                  <input
                    type="number"
                    readOnly
                    value={fmt(item.avg_price)}
                    className="border dark:border-slate-600 bg-gray-100 dark:bg-slate-700 dark:text-gray-200 w-full h-6 text-[11px] px-1"
                    {...antiFill}
                  />
                </td>

                {/* Sub Total */}
                <td className="border dark:border-slate-600">
                  <input
                    type="number"
                    readOnly
                    value={fmt(item.sub_total)}
                    className="border dark:border-slate-600 bg-gray-100 dark:bg-slate-700 dark:text-gray-200 w-full h-6 text-[11px] px-1"
                    {...antiFill}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ================= FOOTER SECTION ================= */}
      <div className="sticky bottom-0 bg-white dark:bg-slate-800 shadow p-2 z-10 dark:shadow-slate-700" autoComplete="off">
        <table className="w-full border-collapse text-xs">
          <tbody>
            <tr>
              <td className="border p-1 w-1/8 dark:border-slate-600">
                <label className="block text-[10px] dark:text-gray-400">Tax %</label>
                <input
                  type="text"
                  name="tax_percentage"
                  readOnly
                  value={fmt(inv.tax_percentage)}
                  className="border dark:border-slate-600 rounded w-full p-1 h-7 text-xs bg-gray-100 dark:bg-slate-700 dark:text-gray-200"
                  {...antiFill}
                />
              </td>
              <td className="border p-1 w-1/8 dark:border-slate-600">
                <label className="block text-[10px] dark:text-gray-400">Tax Amount</label>
                <input
                  type="text"
                  name="tax_amount"
                  readOnly
                  value={fmt(inv.tax_amount)}
                  className="border dark:border-slate-600 rounded w-full p-1 h-7 text-xs bg-gray-100 dark:bg-slate-700 dark:text-gray-200"
                  {...antiFill}
                />
              </td>
              <td className="border p-1 w-1/8 dark:border-slate-600">
                <label className="block text-[10px] dark:text-gray-400">Discount %</label>
                <input
                  type="text"
                  name="discount_percentage"
                  readOnly
                  value={fmt(inv.discount_percentage)}
                  className="border dark:border-slate-600 rounded w-full p-1 h-7 text-xs bg-gray-100 dark:bg-slate-700 dark:text-gray-200"
                  {...antiFill}
                />
              </td>
              <td className="border p-1 w-1/8 dark:border-slate-600">
                <label className="block text-[10px] dark:text-gray-400">Discount Amount</label>
                <input
                  type="text"
                  name="discount_amount"
                  readOnly
                  value={fmt(inv.discount_amount)}
                  className="border dark:border-slate-600 rounded w-full p-1 h-7 text-xs bg-gray-100 dark:bg-slate-700 dark:text-gray-200"
                  {...antiFill}
                />
              </td>
              <td className="border p-1 w-1/8 dark:border-slate-600">
                <label className="block text-[10px] dark:text-gray-400">Total Amount</label>
                <input
                  type="number"
                  name="total_amount"
                  readOnly
                  value={totalAmount.toFixed(2)}
                  className="border dark:border-slate-600 rounded w-full p-1 h-7 text-xs bg-gray-100 dark:bg-slate-700 dark:text-gray-200 font-bold"
                  {...antiFill}
                />
              </td>
              <td className="border p-1 w-1/8 dark:border-slate-600">
                <label className="block text-[10px] dark:text-gray-400">Total Paid</label>
                <input
                  type="text"
                  name="total_paid"
                  readOnly
                  value={totalPaid.toFixed(2)}
                  className="border dark:border-slate-600 rounded w-full p-1 h-7 text-xs bg-gray-100 dark:bg-slate-700 dark:text-gray-200"
                  {...antiFill}
                />
              </td>
              <td className="border p-1 w-1/8 dark:border-slate-600">
                <label className="block text-[10px] dark:text-gray-400">Remaining</label>
                <input
                  type="number"
                  name="remaining_amount"
                  readOnly
                  value={remainingAmount.toFixed(2)}
                  className="border dark:border-slate-600 rounded w-full p-1 h-7 text-xs bg-gray-100 dark:bg-slate-700 dark:text-gray-200"
                  {...antiFill}
                />
              </td>
              <td className="border p-1 w-1/8 text-center align-middle dark:border-slate-600">
                <button
                  type="button"
                  onClick={() => navigate(`/purchase-invoices/${id}/edit`)}
                  className={`w-full px-3 py-2 rounded text-xs ${btnAmberGlass} mb-1`}
                >
                  ✏️ Edit
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/purchase-invoices/create")}
                  className={`w-full px-3 py-2 rounded text-xs ${btnBlueGlass}`}
                >
                  ➕ New Invoice
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ===== Delete Modal ===== */}
      {deleteModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={(e) => { if (e.target === e.currentTarget) closeDeleteModal(); }}
        >
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md p-5">
            {deleteStep === 1 && (
              <div>
                <h2 className="text-lg font-semibold mb-2 dark:text-gray-200">Delete purchase invoice?</h2>
                <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                  <div><b className="dark:text-gray-300">Posted #:</b> {fmt(inv?.posted_number)}</div>
                  <div><b className="dark:text-gray-300">Invoice No:</b> {fmt(inv?.invoice_number)}</div>
                  <div><b className="dark:text-gray-300">Supplier:</b> {fmt(inv.supplier?.name ?? "N/A")}</div>
                  <div><b className="dark:text-gray-300">Total:</b> {totalAmount.toLocaleString()}</div>
                  <div><b className="dark:text-gray-300">Paid:</b> {totalPaid.toLocaleString()}</div>
                  <div><b className="dark:text-gray-300">Remaining:</b> {remainingAmount.toLocaleString()}</div>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">This action cannot be undone.</p>
                <div className="mt-4 flex justify-end gap-2">
                  <button className="px-3 py-1 rounded border dark:border-slate-600 dark:text-gray-300 dark:bg-slate-700" onClick={closeDeleteModal}>
                    Cancel
                  </button>
                  <button
                    className="px-3 py-1 rounded bg-red-600 text-white hover:bg-red-700"
                    onClick={() => setDeleteStep(2)}
                  >
                    Yes, continue
                  </button>
                </div>
              </div>
            )}

            {deleteStep === 2 && (
              <div>
                <h2 className="text-lg font-semibold mb-2 dark:text-gray-200">Confirm with password</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  For security, please re-enter your password to delete this purchase invoice.
                </p>
                <input
                  type="password"
                  autoFocus
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your password"
                  className="mt-3 w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-gray-200 dark:placeholder-gray-500"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") confirmAndDelete();
                    if (e.key === "Escape") closeDeleteModal();
                  }}
                />
                <div className="mt-4 flex justify-between">
                  <button
                    className="px-3 py-1 rounded border dark:border-slate-600 dark:text-gray-300 dark:bg-slate-700"
                    onClick={() => setDeleteStep(1)}
                    disabled={deleting}
                  >
                    ← Back
                  </button>
                  <div className="flex gap-2">
                    <button className="px-3 py-1 rounded border dark:border-slate-600 dark:text-gray-300 dark:bg-slate-700" onClick={closeDeleteModal} disabled={deleting}>
                      Cancel
                    </button>
                    <button
                      className="px-3 py-1 rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
                      onClick={confirmAndDelete}
                      disabled={deleting || password.trim() === ""}
                    >
                      {deleting ? "Deleting…" : "Confirm & Delete"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

