// /src/pages/sales/Show.jsx
import { useEffect, useRef, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
// 🔒 permissions
import { usePermissions, Guard } from "@/api/usePermissions.js";

export default function SaleInvoiceShow() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [inv, setInv] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [printerType, setPrinterType] = useState("a4");
  const popupRef = useRef(null);

  // glassy button presets (same vibe as SaleInvoiceForm)
  const btnBlueGlass =
    "bg-blue-500/85 text-white ring-1 ring-white/20 backdrop-blur-sm shadow-[0_6px_20px_-6px_rgba(37,99,235,0.45)] hover:bg-blue-500/95";
  const btnRoseGlass =
    "bg-rose-500/85 text-white ring-1 ring-white/20 backdrop-blur-sm shadow-[0_6px_20px_-6px_rgba(244,63,94,0.45)] hover:bg-rose-500/95";
  const btnSlateGlass =
    "bg-slate-600/85 text-white ring-1 ring-white/20 backdrop-blur-sm shadow-[0_6px_20px_-6px_rgba(15,23,42,0.45)] hover:bg-slate-600/95 dark:bg-slate-700/85 dark:hover:bg-slate-700/95";
  const btnGreenGlass =
    "bg-green-600/85 text-white ring-1 ring-white/20 backdrop-blur-sm shadow-[0_6px_20px_-6px_rgba(22,163,74,0.45)] hover:bg-green-600/95";
  const chip =
    "px-1 py-0.5 border rounded bg-gray-50 dark:bg-slate-700 text-[10px] leading-none text-gray-700 dark:text-gray-300";

  // 🔒 permissions
  const { loading: permsLoading, canFor } = usePermissions?.() || {};
  const can = useMemo(
    () =>
      (typeof canFor === "function"
        ? canFor("sale-invoice")
        : { view: false, create: false, update: false, delete: false, import: false, export: false }),
    [canFor]
  );

  // ===== Delete modal state =====
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteStep, setDeleteStep] = useState(1);
  const [deleteMode, setDeleteMode] = useState("none"); // 'credit' | 'refund' | 'none'
  const [password, setPassword] = useState("");

  // New: items scroller ref (to mimic form table scroll)
  const itemsScrollRef = useRef(null);

  // Fetch invoice + settings
  useEffect(() => {
    (async () => {
      try {
        const [invRes, setRes] = await Promise.all([
          axios.get(`/api/sale-invoices/${id}`),
          axios.get("/api/settings").catch(() => null),
        ]);
        setInv(invRes.data);
        if (setRes?.data?.printer_type) {
          setPrinterType(String(setRes.data.printer_type).toLowerCase());
        }
      } catch {
        toast.error("Failed to load invoice");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  // Derived numbers for summary
  const invTotal = useMemo(
    () => Number(inv?.total ?? inv?.grand_total ?? inv?.gross_amount ?? 0),
    [inv]
  );
  const invReceived = useMemo(
    () => Number(inv?.total_receive ?? inv?.total_recieve ?? inv?.received ?? 0),
    [inv]
  );
  const invRemaining = useMemo(
    () => Math.max(invTotal - invReceived, 0),
    [invTotal, invReceived]
  );
  const needsChoice = invReceived > 0;

  // After delete, go to previous or index
  const goToPrevOrIndex = async (deletedId) => {
    try {
      const res = await axios.get("/api/sale-invoices");
      const list = Array.isArray(res.data) ? res.data : [];
      const prev = list
        .filter((x) => Number(x?.id) < Number(deletedId))
        .sort((a, b) => Number(b?.id) - Number(a?.id))[0];

      if (prev?.id) navigate(`/sale-invoices/${prev.id}`);
      else navigate("/sale-invoices");
    } catch {
      navigate("/sale-invoices");
    }
  };

  // ===== Delete flow =====
  const openDeleteModal = () => {
    if (!can.delete) return toast.error("You don't have permission to delete sale invoices.");
    setDeleteMode("none");
    setPassword("");
    setDeleteStep(1);
    setDeleteModalOpen(true);
  };
  const closeDeleteModal = () => {
    if (deleting) return;
    setDeleteModalOpen(false);
    setDeleteStep(1);
    setDeleteMode("none");
    setPassword("");
  };
  const proceedAfterConfirm = () => {
    if (needsChoice) {
      setDeleteMode("credit");
      setDeleteStep(2);
    } else {
      setDeleteStep(3);
    }
  };
  const proceedToPassword = () => setDeleteStep(3);

  const confirmAndDelete = async () => {
    if (!id) return;
    if (!can.delete) return toast.error("You don't have permission to delete sale invoices.");
    try {
      setDeleting(true);
      await axios.post("/api/auth/confirm-password", { password });
      await axios.delete(`/api/sale-invoices/${id}`, { params: { mode: deleteMode } });
      toast.success("Sale invoice deleted");
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

  // Print popup logic
  const handlePrint = () => {
    if (!id) return;

    const WEB_BASE =
      (import.meta.env.VITE_BACKEND_WEB_BASE || "").replace(/\/$/, "") ||
      window.location.origin;

    const url = `${WEB_BASE}/print/sale-invoices/${id}`;

    const width = 900;
    const height = 700;
    const left = Math.max(
      0,
      (window.screenX || window.screenLeft || 0) + (window.outerWidth - width) / 2
    );
    const top = Math.max(
      0,
      (window.screenY || window.screenTop || 0) + (window.outerHeight - height) / 2
    );

    const features = [
      `width=${Math.round(width)}`,
      `height=${Math.round(height)}`,
      `left=${Math.round(left)}`,
      `top=${Math.round(top)}`,
      "menubar=no",
      "toolbar=no",
      "location=no",
      "status=no",
      "scrollbars=yes",
      "resizable=yes",
    ].join(",");

    let w = popupRef.current;

    if (!w || w.closed) {
      w = window.open("about:blank", "salePrintWin", features);
      if (!w) {
        toast.error("Popup blocked. Please allow popups to print.");
        return;
      }
      try { w.opener = null; } catch {}
      popupRef.current = w;
    } else {
      try { w.focus(); } catch {}
    }

    try {
      w.location.replace(url);
    } catch {
      const w2 = window.open(url, "salePrintWin", features);
      if (!w2) {
        toast.error("Popup blocked. Please allow popups to print.");
        return;
      }
      try { w2.opener = null; } catch {}
      popupRef.current = w2;
      w = w2;
    }

    try {
      w.onload = () => {
        try { w.focus(); w.print(); } catch {}
      };
    } catch {}

    const timer = setInterval(() => {
      try {
        if (w.document?.readyState === "complete") {
          w.focus(); w.print(); clearInterval(timer);
        }
      } catch {}
      if (w.closed) clearInterval(timer);
    }, 400);
  };

  // Keyboard shortcuts (mimic form topbar)
  useEffect(() => {
    const onKey = (e) => {
      if (!e.altKey) return;
      const k = (e.key || "").toLowerCase();
      if (k === "b") { e.preventDefault(); navigate(-1); }
      if (k === "p") { e.preventDefault(); handlePrint(); }
      if (k === "e") {
        if (!can.update) return;
        e.preventDefault();
        navigate(`/sale-invoices/${id}/edit`);
      }
      if (k === "d") {
        if (!can.delete) return;
        e.preventDefault();
        openDeleteModal();
      }
      if (k === "n") {
        if (!can.create) return;
        e.preventDefault();
        navigate("/sale-invoices/create");
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [navigate, id, can]);

  if (loading || permsLoading) return <div className="p-4 text-sm dark:text-gray-400">Loading…</div>;
  if (!inv) return <div className="p-4 text-sm dark:text-gray-400">Invoice not found.</div>;

  const fmt = (v) => ((v ?? "") === "" ? "" : String(v));

  return (
    <div className="h-[calc(95vh-100px)] flex flex-col bg-white dark:bg-slate-800">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-table th, .print-table td { border: 1px solid #000; }
        }
      `}</style>

      {/* === Top Bar (glassy, same placement as Form) === */}
      <div className="shrink-0 sticky top-0 z-30 border-b bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm dark:border-slate-700">
        <div className="px-2 py-1 flex items-center gap-2">
          <div className="text-xs font-semibold dark:text-gray-200">Sale Invoice</div>

          {/* Inline shortcuts (same zone as Alt+S in form) */}
          <div className="ml-auto flex items-center gap-2 text-[10px] text-gray-600 dark:text-gray-400 no-print">
            <span className="hidden sm:inline-flex items-center gap-1">
              <span className={chip}>Alt</span><span>+</span><span className={chip}>E</span><span>Edit</span>
            </span>
            <span className="hidden sm:inline">•</span>
            <span className="hidden sm:inline-flex items-center gap-1">
              <span className={chip}>Alt</span><span>+</span><span className={chip}>P</span><span>Print</span>
            </span>
            <span className="hidden sm:inline">•</span>
            <span className="hidden sm:inline-flex items-center gap-1">
              <span className={chip}>Alt</span><span>+</span><span className={chip}>B</span><span>Back</span>
            </span>

            {/* Actions (right) */}
            <div className="ml-2 flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrint}
                className={`px-3 py-1.5 rounded text-[11px] ${btnGreenGlass}`}
                title="Alt+P"
              >
                🖨️ Print
              </button>
              <Guard when={can.update}>
                <button
                  type="button"
                  onClick={() => navigate(`/sale-invoices/${id}/edit`)}
                  className={`px-3 py-1.5 rounded text-[11px] ${btnBlueGlass}`}
                  title="Alt+E"
                >
                  ✏️ Edit
                </button>
              </Guard>
              <Guard when={can.delete}>
                <button
                  type="button"
                  onClick={openDeleteModal}
                  className={`px-3 py-1.5 rounded text-[11px] ${btnRoseGlass}`}
                  title="Alt+D"
                >
                  🗑 Delete
                </button>
              </Guard>
              <Guard when={can.create}>
              <button
                type="button"
                onClick={() => navigate("/sale-invoices/create")}
                className={`px-3 py-1.5 rounded text-[11px] ${btnBlueGlass}`}
                title="Alt+N"
              >
                ➕ New
              </button>
            </Guard>
              <button
                type="button"
                onClick={() => navigate(-1)}
                className={`px-3 py-1.5 rounded text-[11px] ${btnSlateGlass}`}
                title="Alt+B"
              >
                ← Back
              </button>
            </div>
          </div>
        </div>

        {/* Meta strip (super compact, same grid rhythm as form) */}
        <div className="px-2 pb-1 grid grid-cols-12 gap-1 text-[11px]">
          <div className="col-span-2">
            <label className="block text-[9px] mb-0.5 dark:text-gray-400">Posted #</label>
            <input
              type="text"
              value={fmt(inv.posted_number)}
              readOnly
              className="w-full h-7 border-2 border-black dark:border-slate-600 rounded px-1 bg-gray-100 dark:bg-slate-700 dark:text-gray-200"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-[9px] mb-0.5 dark:text-gray-400">Date</label>
            <input
              type="text"
              value={fmt(inv.date)}
              readOnly
              className="w-full h-7 border-2 border-black dark:border-slate-600 rounded px-1 bg-gray-100 dark:bg-slate-700 dark:text-gray-200"
            />
          </div>
          <div className="col-span-4">
            <label className="block text-[9px] mb-0.5 dark:text-gray-400">Customer</label>
            <input
              type="text"
              value={inv.customer?.name ?? inv.customer_id ?? ""}
              readOnly
              className="w-full h-7 border-2 border-black dark:border-slate-600 rounded px-1 bg-gray-100 dark:bg-slate-700 dark:text-gray-200"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-[9px] mb-0.5 dark:text-gray-400">Doctor</label>
            <input
              type="text"
              value={fmt(inv.doctor_name)}
              readOnly
              className="w-full h-7 border-2 border-black dark:border-slate-600 rounded px-1 bg-gray-100 dark:bg-slate-700 dark:text-gray-200"
            />
          </div>
            <div className="col-span-2">
            <label className="block text-[9px] mb-0.5 dark:text-gray-400">Patient</label>
            <input
              type="text"
              value={fmt(inv.patient_name)}
              readOnly
              className="w-full h-7 border-2 border-black dark:border-slate-600 rounded px-1 bg-gray-100 dark:bg-slate-700 dark:text-gray-200"
            />
          </div>

          <div className="col-span-10">
            <label className="block text-[9px] mb-0.5 dark:text-gray-400">Remarks</label>
            <input
              type="text"
              value={fmt(inv.remarks)}
              readOnly
              className="w-full h-7 border-2 border-black dark:border-slate-600 rounded px-1 bg-gray-100 dark:bg-slate-700 dark:text-gray-200"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-[9px] mb-0.5 dark:text-gray-400">Items</label>
            <input
              type="text"
              value={(inv.items || []).length}
              readOnly
              className="w-full h-7 border-2 border-black dark:border-slate-600 rounded px-1 bg-gray-100 dark:bg-slate-700 dark:text-gray-200 text-center"
            />
          </div>
        </div>
      </div>

      {/* === Main workspace: Items (fluid) + Summary (240px) === */}
      <div className="flex-1 grid grid-cols-[1fr_240px] gap-2 px-2 py-2 overflow-hidden">
        {/* LEFT: Items table (same scroll & sticky header as form) */}
        <div className="flex flex-col min-h-0">
          <div className="text-[11px] font-semibold mb-1 dark:text-gray-200">Items</div>
          <div
            ref={itemsScrollRef}
            className="flex-1 overflow-auto border-2 rounded relative dark:border-slate-600"
          >
            <table className="w-full text-[11px] table-fixed border-collapse print-table">
              <thead className="sticky top-0 z-20 bg-white/80 dark:bg-slate-700/80 backdrop-blur-sm border-b border-gray-200/70 dark:border-slate-600">
                <tr className="[&>th]:py-1 [&>th]:px-1 [&>th]:text-left dark:[&>th]:text-gray-200">
                  <th className="w-7 text-center dark:text-gray-200">#</th>
                  <th className="w-[180px] dark:text-gray-200">Product</th>
                  <th className="w-14 text-center dark:text-gray-200">PSize</th>
                  <th className="w-24 dark:text-gray-200">Batch</th>
                  <th className="w-15 text-center dark:text-gray-200">Expiry</th>
                  <th className="w-25 text-center dark:text-gray-200">Qty</th>
                  <th className="w-22 text-center dark:text-gray-200">Price</th>
                  <th className="w-18 text-center dark:text-gray-200">Disc%</th>
                  <th className="w-26 text-center dark:text-gray-200">Sub Total</th>
                </tr>
              </thead>
              <tbody className="[&>tr>td]:py-1 [&>tr>td]:px-0.5 dark:[&>tr>td]:text-gray-300">
                {(inv.items || []).map((it, i) => (
                  <tr key={i} className="border-b dark:border-slate-600 text-center dark:text-gray-300">
                    <td className="px-1">{i + 1}</td>
                    <td className="px-1 text-left">{it.product?.name ?? it.product_id}</td>
                    <td className="px-1">{fmt(it.pack_size)}</td>
                    <td className="px-1">{fmt(it.batch_number)}</td>
                    <td className="px-1">{fmt(it.expiry)}</td>
                    <td className="px-1">{fmt(it.quantity)}</td>
                    <td className="px-1">{fmt(it.price)}</td>
                    <td className="px-1">{fmt(it.item_discount_percentage)}</td>
                    <td className="px-1">{fmt(it.sub_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* RIGHT: Slim summary (read-only, mirrors form layout) */}
        <div className="min-h-0">
          <div className="sticky top-[20px] space-y-2">
            <div className="border-2 rounded p-2 dark:border-slate-600 dark:bg-slate-800/50">
              <div className="text-[18px] font-semibold mb-1 dark:text-gray-200">Summary</div>
              <div className="grid grid-cols-2 gap-1 text-[11px]">
                <label className="text-[13px] font-bold self-center dark:text-gray-300">Tax %</label>
                <input
                  type="text"
                  readOnly
                  value={fmt(inv.tax_percentage)}
                  className="h-7 border-2 border-black dark:border-slate-600 rounded px-1 bg-gray-100 dark:bg-slate-700 dark:text-gray-200"
                />

                <label className="text-[13px] font-bold self-center dark:text-gray-300">Tax Amt</label>
                <input
                  type="text"
                  readOnly
                  value={fmt(inv.tax_amount)}
                  className="h-7 border-2 border-black dark:border-slate-600 rounded px-1 bg-gray-100 dark:bg-slate-700 dark:text-gray-200"
                />

                <label className="text-[13px] font-bold self-center dark:text-gray-300">Disc %</label>
                <input
                  type="text"
                  readOnly
                  value={fmt(inv.discount_percentage)}
                  className="h-7 border-2 border-black dark:border-slate-600 rounded px-1 bg-gray-100 dark:bg-slate-700 dark:text-gray-200"
                />

                <label className="text-[13px] font-bold self-center dark:text-gray-300">Disc Amt</label>
                <input
                  type="text"
                  readOnly
                  value={fmt(inv.discount_amount)}
                  className="h-7 border-2 border-black dark:border-slate-600 rounded px-1 bg-gray-100 dark:bg-slate-700 dark:text-gray-200"
                />

                <label className="text-[13px] font-bold self-center dark:text-gray-300">Gross</label>
                <input
                  type="text"
                  readOnly
                  value={fmt(inv.gross_amount)}
                  className="h-7 border-2 border-black dark:border-slate-600 rounded px-1 bg-gray-100 dark:bg-slate-700 dark:text-gray-200"
                />

                <label className="text-[13px] font-bold self-center dark:text-gray-300">Total</label>
                <input
                  type="text"
                  readOnly
                  value={fmt(inv.total)}
                  className="h-7 border-2 border-black dark:border-slate-600 rounded px-1 bg-gray-100 dark:bg-slate-700 dark:text-gray-200 font-extrabold text-red-600 dark:text-red-400 text-lg"
                />

                <label className="text-[13px] font-bold self-center dark:text-gray-300">Receive</label>
                <input
                  type="text"
                  readOnly
                  value={invReceived.toLocaleString()}
                  className="h-7 border-2 border-black dark:border-slate-600 rounded px-1 bg-gray-100 dark:bg-slate-700 dark:text-gray-200"
                />

                <label className="text-[13px] font-bold self-center dark:text-gray-300">Remaining</label>
                <input
                  type="text"
                  readOnly
                  value={invRemaining.toLocaleString()}
                  className="h-7 border-2 border-black dark:border-slate-600 rounded px-1 bg-gray-100 dark:bg-slate-700 dark:text-gray-200"
                />
              </div>

              {/* Printer info (matches your show page) */}
              <div className="pt-2 text-[11px] text-gray-500 dark:text-gray-400">
                Using printer template: <b className="dark:text-gray-300">{(printerType || "a4").toUpperCase()}</b>
              </div>

              {/* Primary actions (mirror top bar; kept for convenience on long lists) */}
              <div className="pt-2 grid grid-cols-2 gap-2 no-print">
                <button
                  type="button"
                  onClick={handlePrint}
                  className={`h-9 rounded text-white text-[12px] ${btnGreenGlass}`}
                  title="Alt+P"
                >
                  🖨️ Print
                </button>
                
                <Guard when={can.update}>
                  <button
                    type="button"
                    onClick={() => navigate(`/sale-invoices/${id}/edit`)}
                    className={`h-9 rounded text-white text-[12px] ${btnBlueGlass}`}
                    title="Alt+E"
                  >
                    ✏️ Edit
                  </button>
                </Guard>
                <Guard when={can.create}>
                  <button
                    type="button"
                    onClick={() => navigate("/sale-invoices/create")}
                    className={`col-span-2 h-9 rounded text-white text-[12px] ${btnBlueGlass}`}
                    title="Alt+N"
                  >
                    ➕ New
                  </button>
                </Guard>
                <Guard when={can.delete}>
                  <button
                    type="button"
                    onClick={openDeleteModal}
                    className={`col-span-2 h-9 rounded text-white text-[12px] ${btnRoseGlass}`}
                    title="Alt+D"
                  >
                    🗑 Delete
                  </button>
                </Guard>
                <button
                  type="button"
                  onClick={() => navigate(-1)}
                  className={`col-span-2 h-9 rounded text-white text-[12px] ${btnSlateGlass}`}
                  title="Alt+B"
                >
                  ← Back
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== Delete confirmation / choice / password modal ===== */}
      {deleteModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={(e) => { if (e.target === e.currentTarget) closeDeleteModal(); }}
        >
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md p-5">
            {/* Step 1: Confirm delete */}
            {deleteStep === 1 && (
              <div>
                <h2 className="text-lg font-semibold mb-2 dark:text-gray-200">Delete sale invoice?</h2>
                <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                  <div><b className="dark:text-gray-300">Posted #:</b> {inv?.posted_number}</div>
                  <div><b className="dark:text-gray-300">Total:</b> {invTotal.toLocaleString()}</div>
                  <div><b className="dark:text-gray-300">Received:</b> {invReceived.toLocaleString()}</div>
                  <div><b className="dark:text-gray-300">Remaining:</b> {invRemaining.toLocaleString()}</div>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">This action cannot be undone.</p>
                <div className="mt-4 flex justify-end gap-2">
                  <button className="px-3 py-1 rounded border dark:border-slate-600 dark:text-gray-300 dark:bg-slate-700" onClick={closeDeleteModal}>
                    Cancel
                  </button>
                  <button
                    className="px-3 py-1 rounded bg-red-600 text-white hover:bg-red-700"
                    onClick={proceedAfterConfirm}
                  >
                    Yes, continue
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Choose Credit or Refund */}
            {deleteStep === 2 && (
              <div>
                <h2 className="text-lg font-semibold mb-2 dark:text-gray-200">Credit or Refund?</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  This invoice has <b className="dark:text-gray-300">Received {invReceived.toLocaleString()}</b> and
                  <b className="dark:text-gray-300"> Remaining {invRemaining.toLocaleString()}</b>. Choose how to handle the money:
                </p>
                <div className="space-y-2 text-sm dark:text-gray-300">
                  <label className="flex items-start gap-2">
                    <input
                      type="radio"
                      className="mt-1"
                      checked={deleteMode === "credit"}
                      onChange={() => setDeleteMode("credit")}
                    />
                    <span>
                      <b>Credit the customer (recommended)</b><br />
                      Keep the received amount as an unapplied credit in the ledger.
                    </span>
                  </label>
                  <label className="flex items-start gap-2">
                    <input
                      type="radio"
                      className="mt-1"
                      checked={deleteMode === "refund"}
                      onChange={() => setDeleteMode("refund")}
                    />
                    <span>
                      <b>Refund the customer</b><br />
                      Record a refund payment for the received amount.
                    </span>
                  </label>
                </div>
                <div className="mt-4 flex justify-between">
                  <button className="px-3 py-1 rounded border dark:border-slate-600 dark:text-gray-300 dark:bg-slate-700" onClick={() => setDeleteStep(1)}>
                    ← Back
                  </button>
                  <button
                    className="px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
                    onClick={proceedToPassword}
                  >
                    Continue
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Password confirm */}
            {deleteStep === 3 && (
              <div>
                <h2 className="text-lg font-semibold mb-2 dark:text-gray-200">Confirm with password</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  For security, please re-enter your password to delete this sale invoice.
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
                    onClick={() => setDeleteStep(needsChoice ? 2 : 1)}
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

