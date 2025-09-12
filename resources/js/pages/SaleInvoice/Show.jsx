import { useEffect, useRef, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
// 🔒 add permissions
import { usePermissions, Guard } from "@/api/usePermissions.js";

export default function SaleInvoiceShow() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [inv, setInv] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [printerType, setPrinterType] = useState("a4"); // from Settings
  const popupRef = useRef(null);

  // 🔒 permissions
  const { loading: permsLoading, canFor } = usePermissions();
  const can = useMemo(
    () =>
      (typeof canFor === "function" ? canFor("sale-invoice") : {
        view:false, create:false, update:false, delete:false, import:false, export:false
      }),
    [canFor]
  );

  // ===== Delete modal state (same flow as index) =====
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteStep, setDeleteStep] = useState(1); // 1 confirm -> 2 choose -> 3 password
  const [deleteMode, setDeleteMode] = useState("none"); // 'credit' | 'refund' | 'none'
  const [password, setPassword] = useState("");

  // Fetch invoice + settings (keep your original logic)
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

  // Derived numbers for display + delete decision
  const invTotal = useMemo(() => Number(inv?.total ?? inv?.grand_total ?? inv?.gross_amount ?? 0), [inv]);
  const invReceived = useMemo(
    () => Number(inv?.total_receive ?? inv?.total_recieve ?? inv?.received ?? 0),
    [inv]
  );
  const invRemaining = useMemo(() => Math.max(invTotal - invReceived, 0), [invTotal, invReceived]);
  const needsChoice = (invReceived > 0) || (Math.abs(invRemaining) > 0.0001);

  // After delete: go to previous invoice (by id), else index
  const goToPrevOrIndex = async (deletedId) => {
    try {
      const res = await axios.get("/api/sale-invoices");
      const list = Array.isArray(res.data) ? res.data : [];
      const prev = list
        .filter((x) => Number(x?.id) < Number(deletedId))
        .sort((a, b) => Number(b?.id) - Number(a?.id))[0];

      if (prev?.id) {
        navigate(`/sale-invoices/${prev.id}`);
      } else {
        navigate("/sale-invoices");
      }
    } catch {
      navigate("/sale-invoices");
    }
  };

  // ===== Delete flow =====
  const openDeleteModal = () => {
    // 🔒 respect can.delete
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
      setDeleteMode("credit"); // default
      setDeleteStep(2);
    } else {
      setDeleteStep(3);
    }
  };
  const proceedToPassword = () => setDeleteStep(3);

  const confirmAndDelete = async () => {
    if (!id) return;
    // 🔒 respect can.delete
    if (!can.delete) return toast.error("You don't have permission to delete sale invoices.");
    try {
      setDeleting(true);
      // 1) password confirm
      await axios.post("/api/auth/confirm-password", { password });
      // 2) delete with mode
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

  // Print
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

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e) => {
      if (!e.altKey) return;
      const k = (e.key || "").toLowerCase();
      if (k === "n") { 
        // 🔒 respect can.create
        if (!can.create) return;
        e.preventDefault(); 
        navigate("/sale-invoices/create"); 
      }
      if (k === "b") { e.preventDefault(); navigate(-1); }
      if (k === "p") { 
        // 🔒 printing allowed for viewers; if you want to guard, use !can.view check here
        e.preventDefault(); 
        handlePrint(); 
      }
      if (k === "d") { 
        // 🔒 respect can.delete
        if (!can.delete) return;
        e.preventDefault(); 
        openDeleteModal(); 
      }
      if (k === "e") { 
        // 🔒 respect can.update
        if (!can.update) return;
        e.preventDefault(); 
        navigate(`/sale-invoices/${id}/edit`); 
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [navigate, id, can]);

  if (loading || permsLoading) return <div className="p-4 text-sm">Loading…</div>;
  if (!inv) return <div className="p-4 text-sm">Invoice not found.</div>;

  const fmt = (v) => ((v ?? "") === "" ? "" : String(v));

  return (
    <div className="p-3 space-y-3">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-table th, .print-table td { border: 1px solid #000; }
        }
      `}</style>

      <h2 className="text-lg font-bold">Sale Invoice</h2>

      {/* Header */}
      <table className="w-full border-collapse text-xs">
        <tbody>
          <tr>
            <td className="border p-1 w-28">
              <div className="text-[10px]">Posted Number</div>
              <div className="font-semibold">{fmt(inv.posted_number)}</div>
            </td>
            <td className="border p-1 w-32">
              <div className="text-[10px]">Date</div>
              <div>{fmt(inv.date)}</div>
            </td>
            <td className="border p-1 w-[28%]">
              <div className="text-[10px]">Customer</div>
              <div>{inv.customer?.name ?? inv.customer_id}</div>
            </td>
            <td className="border p-1 w-[22%]">
              <div className="text-[10px]">Doctor Name</div>
              <div>{fmt(inv.doctor_name)}</div>
            </td>
            <td className="border p-1 w-[22%]">
              <div className="text-[10px]">Patient Name</div>
              <div>{fmt(inv.patient_name)}</div>
            </td>
          </tr>
          <tr>
            <td className="border p-1" colSpan={5}>
              <div className="text-[10px]">Remarks</div>
              <div>{fmt(inv.remarks)}</div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Items */}
      <div>
        <h3 className="text-xs font-bold mb-1">Items</h3>
        <table className="w-full border-collapse text-[11px] print-table">
          <thead className="bg-gray-100">
            <tr>
              <th className="border p-1">#</th>
              <th className="border p-1 text-left">Product</th>
              <th className="border p-1">PSize</th>
              <th className="border p-1">Batch</th>
              <th className="border p-1">Expiry</th>
              <th className="border p-1">Qty</th>
              <th className="border p-1">Price</th>
              <th className="border p-1">Disc%</th>
              <th className="border p-1">Sub Total</th>
            </tr>
          </thead>
          <tbody>
            {(inv.items || []).map((it, i) => (
              <tr key={i} className="text-center">
                <td className="border p-1">{i + 1}</td>
                <td className="border p-1 text-left">{it.product?.name ?? it.product_id}</td>
                <td className="border p-1">{fmt(it.pack_size)}</td>
                <td className="border p-1">{fmt(it.batch_number)}</td>
                <td className="border p-1">{fmt(it.expiry)}</td>
                <td className="border p-1">{fmt(it.quantity)}</td>
                <td className="border p-1">{fmt(it.price)}</td>
                <td className="border p-1">{fmt(it.item_discount_percentage)}</td>
                <td className="border p-1">{fmt(it.sub_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer totals — now includes Total Receive & Remaining */}
      <table className="w-full border-collapse text-xs">
        <tbody>
          <tr>
            <td className="border p-1 w-1/8">
              <div className="text-[10px]">Tax %</div>
              <div>{fmt(inv.tax_percentage)}</div>
            </td>
            <td className="border p-1 w-1/8">
              <div className="text-[10px]">Tax Amount</div>
              <div>{fmt(inv.tax_amount)}</div>
            </td>
            <td className="border p-1 w-1/8">
              <div className="text-[10px]">Discount %</div>
              <div>{fmt(inv.discount_percentage)}</div>
            </td>
            <td className="border p-1 w-1/8">
              <div className="text-[10px]">Discount Amount</div>
              <div>{fmt(inv.discount_amount)}</div>
            </td>
            <td className="border p-1 w-1/8">
              <div className="text-[10px]">Gross Amount</div>
              <div>{fmt(inv.gross_amount)}</div>
            </td>
            <td className="border p-1 w-1/8">
              <div className="text-[10px]">Total</div>
              <div className="font-semibold">{fmt(inv.total)}</div>
            </td>
            <td className="border p-1 w-1/8">
              <div className="text-[10px]">Total Receive</div>
              <div className="font-semibold">{invReceived.toLocaleString()}</div>
            </td>
            <td className="border p-1 w-1/8">
              <div className="text-[10px]">Remaining</div>
              <div className="font-semibold">{invRemaining.toLocaleString()}</div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Actions */}
      <div className="no-print flex flex-wrap gap-2 justify-end pt-2">
        {/* 🔒 guard Delete/Edit/Create buttons only */}
        <Guard when={can.delete}>
          <button
            className="bg-red-600 text-white px-4 py-2 rounded text-sm disabled:opacity-60"
            onClick={openDeleteModal}
            disabled={deleting}
            title="Alt+D"
          >
            🗑 Delete
          </button>
        </Guard>
        <Guard when={can.update}>
          <button
            className="bg-yellow-600 text-white px-4 py-2 rounded text-sm"
            onClick={() => navigate(`/sale-invoices/${id}/edit`)}
            title="Alt+E"
          >
            ✏️ Edit Invoice
          </button>
        </Guard>
        <Guard when={can.create}>
          <button
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm"
            onClick={() => navigate("/sale-invoices/create")}
            title="Alt+N"
          >
            + Add New Invoice
          </button>
        </Guard>
        <button
          className="bg-gray-500 text-white px-4 py-2 rounded text-sm"
          onClick={() => navigate(-1)}
          title="Alt+B"
        >
          ← Go Back
        </button>
        {/* Print left as-is (viewers can print); if you want, wrap in <Guard when={can.view}> */}
        <button
          className="bg-green-600 text-white px-4 py-2 rounded text-sm"
          onClick={handlePrint}
          title="Alt+P"
        >
          🖨️ Print Invoice
        </button>
      </div>

      <div className="no-print text-[11px] text-gray-500">
        Using printer template: <b>{printerType?.toUpperCase?.() || "A4"}</b> (from Settings)
      </div>

      {/* ===== Delete confirmation / choice / password modal ===== */}
      {deleteModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={(e) => { if (e.target === e.currentTarget) closeDeleteModal(); }}
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-5">
            {/* Step 1: Confirm delete */}
            {deleteStep === 1 && (
              <div>
                <h2 className="text-lg font-semibold mb-2">Delete sale invoice?</h2>
                <div className="text-xs text-gray-600 mb-2">
                  <div><b>Posted #:</b> {inv?.posted_number}</div>
                  <div><b>Total:</b> {invTotal.toLocaleString()}</div>
                  <div><b>Received:</b> {invReceived.toLocaleString()}</div>
                  <div><b>Remaining:</b> {invRemaining.toLocaleString()}</div>
                </div>
                <p className="text-sm text-gray-600">This action cannot be undone.</p>
                <div className="mt-4 flex justify-end gap-2">
                  <button className="px-3 py-1 rounded border" onClick={closeDeleteModal}>
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

            {/* Step 2: Choose Credit or Refund (only when needed) */}
            {deleteStep === 2 && (
              <div>
                <h2 className="text-lg font-semibold mb-2">Credit or Refund?</h2>
                <p className="text-sm text-gray-600 mb-3">
                  This invoice has <b>Received {invReceived.toLocaleString()}</b> and
                  <b> Remaining {invRemaining.toLocaleString()}</b>. Choose how to handle the money:
                </p>
                <div className="space-y-2 text-sm">
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
                  <button className="px-3 py-1 rounded border" onClick={() => setDeleteStep(1)}>
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
                <h2 className="text-lg font-semibold mb-2">Confirm with password</h2>
                <p className="text-sm text-gray-600">
                  For security, please re-enter your password to delete this sale invoice.
                </p>
                <input
                  type="password"
                  autoFocus
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your password"
                  className="mt-3 w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") confirmAndDelete();
                    if (e.key === "Escape") closeDeleteModal();
                  }}
                />
                <div className="mt-4 flex justify-between">
                  <button
                    className="px-3 py-1 rounded border"
                    onClick={() => setDeleteStep(needsChoice ? 2 : 1)}
                    disabled={deleting}
                  >
                    ← Back
                  </button>
                  <div className="flex gap-2">
                    <button className="px-3 py-1 rounded border" onClick={closeDeleteModal} disabled={deleting}>
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
