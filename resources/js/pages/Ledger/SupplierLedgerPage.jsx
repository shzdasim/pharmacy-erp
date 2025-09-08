// resources/js/pages/SupplierLedgerPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import SupplierSearchInput from "../../components/SupplierSearchInput.jsx";

export default function SupplierLedgerPage() {
  const [suppliers, setSuppliers] = useState([]);   // [{id,name}, ...]
  const [supplierId, setSupplierId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({
    total_invoiced: 0,
    paid_on_invoice: 0,
    payments_debited: 0,
    net_balance: 0,
  });

  // ---------- utils ----------
  const fmt = (v) => {
    if (v === null || v === undefined || v === "") return "0";
    const n = Number(v);
    if (!Number.isFinite(n)) return "0";
    return new Intl.NumberFormat(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(n);
  };

  // hotkey: Alt+S -> open Save confirm modal
  useEffect(() => {
    const onKey = (e) => {
      if (e.altKey && (e.key || "").toLowerCase() === "s") {
        e.preventDefault();
        openSaveModal();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rows, supplierId]);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await axios.get("/api/suppliers", { params: { limit: 500 } });
        const list = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
        setSuppliers(list);
      } catch {
        toast.error("Failed to load suppliers");
        setSuppliers([]);
      }
    })();
  }, []);

  const fetchData = async () => {
    if (!supplierId) return toast.error("Select a supplier first");
    try {
      const { data } = await axios.get("/api/supplier-ledger", {
        params: { supplier_id: supplierId, from, to },
      });
      const clean = (data.data || []).map(r => {
        const c = { ...r };
        Object.keys(c).forEach(k => { if (k.endsWith("_input")) delete c[k]; });
        return c;
      });
      setRows(clean);
      setSummary(
        data.summary || {
          total_invoiced: 0,
          paid_on_invoice: 0,
          payments_debited: 0,
          net_balance: 0,
        }
      );
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to load ledger");
    }
  };

  const rebuild = async () => {
    if (!supplierId) return toast.error("Select a supplier first");
    try {
      await axios.post("/api/supplier-ledger/rebuild", { supplier_id: supplierId });
      toast.success("Rebuilt from invoices");
      await fetchData();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Rebuild failed");
    }
  };

  // ---------- number editing helpers (no forced .00 while typing) ----------
  const getInput = (row, field) => {
    if (row[`${field}_input`] !== undefined) return row[`${field}_input`];
    const v = row[field];
    if (v === undefined || v === null) return "";
    return String(v);
  };
  const setInput = (idx, field, raw) => {
    setRows(prev => {
      const next = [...prev];
      const r = { ...next[idx] };
      r[`${field}_input`] = raw;
      next[idx] = r;
      return next;
    });
  };
  const commitNumber = (idx, field) => {
    setRows(prev => {
      const next = [...prev];
      const r = { ...next[idx] };
      const raw = r[`${field}_input`];
      const parsed =
        raw === undefined || String(raw).trim() === ""
          ? 0
          : parseFloat(String(raw).replace(/,/g, ""));
      r[field] = Number.isFinite(parsed) ? Number(parsed) : 0;
      delete r[`${field}_input`];

      if (["invoice", "manual"].includes(r.entry_type)) {
        const credit = Number(((r.invoice_total || 0) - (r.total_paid || 0)).toFixed(2));
        r.credit_remaining = credit < 0 ? 0 : credit;
      }
      next[idx] = r;
      return next;
    });
  };
  const handleField = (idx, field, value) => {
    setRows(prev => {
      const next = [...prev];
      const r = { ...next[idx], [field]: value };
      if (["invoice", "manual"].includes(r.entry_type) && (field === "invoice_total" || field === "total_paid")) {
        const credit = Number(((r.invoice_total || 0) - (r.total_paid || 0)).toFixed(2));
        r.credit_remaining = credit < 0 ? 0 : credit;
      }
      next[idx] = r;
      return next;
    });
  };

  // ---------- add row (behind confirm modal) ----------
  const addPaymentNow = () => {
    if (!supplierId) return toast.error("Select a supplier first");
    const today = new Date().toISOString().slice(0, 10);
    setRows(prev => ([
      ...prev,
      {
        id: undefined,
        supplier_id: supplierId,
        entry_type: "payment",
        entry_date: today,
        debited_amount: 0,
        payment_ref: "",
        description: "Payment received",
        invoice_total: 0,
        total_paid: 0,
        credit_remaining: 0,
        is_manual: true,
      },
    ]));
  };
  const addManualNow = () => {
    if (!supplierId) return toast.error("Select a supplier first");
    const today = new Date().toISOString().slice(0, 10);
    setRows(prev => ([
      ...prev,
      {
        id: undefined,
        supplier_id: supplierId,
        entry_type: "manual",
        entry_date: today,
        posted_number: "",
        invoice_number: "",
        invoice_total: 0,
        total_paid: 0,
        credit_remaining: 0,
        debited_amount: 0,
        payment_ref: "",
        description: "",
        is_manual: true,
      },
    ]));
  };

  // ---------- bulk save (actual) ----------
  const doBulkSave = async () => {
    const news = rows.filter(r => !r.id);
    const updates = rows.filter(r => r.id);
    try {
      for (const n of news) {
        const payload = {
          supplier_id: supplierId,
          entry_date: n.entry_date,
          description: n.description,
          posted_number: n.posted_number,
          invoice_number: n.invoice_number,
          invoice_total: n.invoice_total || 0,
          total_paid: n.total_paid || 0,
          debited_amount: n.debited_amount || 0,
          payment_ref: n.payment_ref,
          purchase_invoice_id: n.purchase_invoice_id || null,
        };
        await axios.post("/api/supplier-ledger", payload);
      }
      if (updates.length) {
        await axios.put("/api/supplier-ledger/bulk", {
          rows: updates.map(u => ({
            id: u.id,
            entry_date: u.entry_date,
            description: u.description,
            posted_number: u.posted_number,
            invoice_number: u.invoice_number,
            invoice_total: u.invoice_total || 0,
            total_paid: u.total_paid || 0,
            debited_amount: u.debited_amount || 0,
            payment_ref: u.payment_ref,
          })),
        });
      }
      toast.success("Ledger saved");
      await fetchData();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Save failed");
    }
  };

  // ---------- delete (secure: confirm -> password) ----------
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteStep, setDeleteStep] = useState(1); // 1 confirm, 2 password
  const [deletingIdx, setDeletingIdx] = useState(null); // original index in rows
  const [password, setPassword] = useState("");
  const [deleting, setDeleting] = useState(false);

  const openDeleteModal = (originalIdx) => {
    setDeletingIdx(originalIdx);
    setPassword("");
    setDeleteStep(1);
    setDeleteModalOpen(true);
  };
  const closeDeleteModal = () => {
    if (deleting) return;
    setDeleteModalOpen(false);
    setDeletingIdx(null);
    setDeleteStep(1);
    setPassword("");
  };
  const proceedDeletePassword = () => setDeleteStep(2);

  const confirmAndDelete = async () => {
    if (deletingIdx === null) return;
    const r = rows[deletingIdx];
    try {
      setDeleting(true);
      await axios.post("/api/auth/confirm-password", { password }); // verify user

      if (r.id && !r.is_manual && r.entry_type === "invoice") {
        toast.error("Cannot delete invoice row");
      } else if (r.id) {
        await axios.delete(`/api/supplier-ledger/${r.id}`);
        toast.success("Row deleted");
        await fetchData();
      } else {
        setRows(prev => prev.filter((_, i) => i !== deletingIdx));
        toast.success("Row removed");
      }
      closeDeleteModal();
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        (err?.response?.status === 422 ? "Incorrect password" : "Delete failed");
      toast.error(msg);
    } finally {
      setDeleting(false);
    }
  };

  // ---------- confirm add modals ----------
  const [addModal, setAddModal] = useState({ open: false, type: null }); // 'payment' | 'manual'
  const openAddPayment = () => setAddModal({ open: true, type: "payment" });
  const openAddManual  = () => setAddModal({ open: true, type: "manual" });
  const closeAddModal  = () => setAddModal({ open: false, type: null });
  const confirmAdd = () => {
    if (addModal.type === "payment") addPaymentNow();
    if (addModal.type === "manual")  addManualNow();
    closeAddModal();
  };

  // ---------- confirm save modal ----------
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const openSaveModal = () => setSaveModalOpen(true);
  const closeSaveModal = () => setSaveModalOpen(false);
  const confirmSave = async () => {
    setSaveModalOpen(false);
    await doBulkSave();
  };

  // ---------- derived running balance (keeps original index as __i) ----------
  const derivedRows = useMemo(() => {
    const indexed = rows.map((r, i) => ({ r, i }));
    indexed.sort((a, b) => {
      const ad = (a.r.entry_date || "").slice(0, 10);
      const bd = (b.r.entry_date || "").slice(0, 10);
      if (ad === bd) {
        const ai = a.r.id ?? Number.MAX_SAFE_INTEGER;
        const bi = b.r.id ?? Number.MAX_SAFE_INTEGER;
        return ai - bi;
      }
      return ad < bd ? -1 : 1;
    });
    let balance = 0;
    return indexed.map(({ r, i }) => {
      const isInvoiceLike = r.entry_type === "invoice" || r.entry_type === "manual";
      const isPayment = r.entry_type === "payment";
      const invInc = (Number(r.invoice_total || 0) - Number(r.total_paid || 0));
      const payDec = Number(r.debited_amount || 0);
      if (isInvoiceLike) balance += invInc;
      if (isPayment) balance -= payDec;
      return { ...r, running_balance: Number(balance.toFixed(2)), __i: i };
    });
  }, [rows]);

  const newCount = rows.filter(r => !r.id).length;
  const updCount = rows.filter(r => r.id).length;

  // ---------- UI ----------
  return (
    <div className="p-3 space-y-2 text-xs">
      <h2 className="text-base font-semibold">Supplier Ledger</h2>

      <div className="flex gap-2 items-end flex-wrap">
        <div className="flex flex-col min-w-[240px]">
          <label className="text-[11px] text-gray-600">Supplier *</label>
          <SupplierSearchInput
            value={supplierId}
            onChange={(id) => setSupplierId(id)}
            suppliers={suppliers}
            autoFocus
          />
        </div>
        <div className="flex flex-col">
          <label className="text-[11px] text-gray-600">From</label>
          <input type="date" className="border rounded px-2 py-1 text-xs" value={from} onChange={e=>setFrom(e.target.value)} />
        </div>
        <div className="flex flex-col">
          <label className="text-[11px] text-gray-600">To</label>
          <input type="date" className="border rounded px-2 py-1 text-xs" value={to} onChange={e=>setTo(e.target.value)} />
        </div>
        <button className="bg-blue-600 text-white rounded px-3 py-1 text-xs" onClick={fetchData} disabled={!supplierId}>Load</button>

        <div className="flex-1" />

        <button className="border rounded px-2 py-1 text-xs" onClick={openAddPayment} disabled={!supplierId}>+ Payment</button>
        <button className="border rounded px-2 py-1 text-xs" onClick={openAddManual} disabled={!supplierId}>+ Manual</button>
        <button className="border rounded px-2 py-1 text-xs" onClick={rebuild} disabled={!supplierId}>Rebuild</button>
        <button className="bg-green-600 text-white rounded px-3 py-1 text-xs" onClick={openSaveModal} title="Alt+S" disabled={!supplierId}>Save (Alt+S)</button>
      </div>

      {supplierId && (
        <div className="border rounded p-2 bg-gray-50 flex gap-5">
          <div><span className="text-gray-600">Total Invoiced:</span> <b>{fmt(summary.total_invoiced)}</b></div>
          <div><span className="text-gray-600">Paid on Invoice:</span> <b>{fmt(summary.paid_on_invoice)}</b></div>
          <div><span className="text-gray-600">Payments (Debited):</span> <b>{fmt(summary.payments_debited)}</b></div>
          <div><span className="text-gray-600">Net Balance:</span> <b>{fmt(summary.net_balance)}</b></div>
        </div>
      )}

      <div className="overflow-auto">
        <table className="min-w-[1000px] w-full border border-gray-200 text-xs">
          <thead className="bg-gray-100">
            <tr>
              <th className="border px-1 py-1 text-left">Date</th>
              <th className="border px-1 py-1 text-left">Type</th>
              <th className="border px-1 py-1 text-left">Posted #</th>
              <th className="border px-1 py-1 text-left">Invoice #</th>
              <th className="border px-1 py-1 text-right">Invoice Total</th>
              <th className="border px-1 py-1 text-right">Paid on Invoice</th>
              <th className="border px-1 py-1 text-right">Payment (Debit)</th>
              <th className="border px-1 py-1 text-left">Payment Ref</th>
              <th className="border px-1 py-1 text-right">Credit Remaining</th>
              <th className="border px-1 py-1 text-right">Balance</th>
              <th className="border px-1 py-1 text-left">Description</th>
              <th className="border px-1 py-1 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {!supplierId && (
              <tr><td colSpan={12} className="text-center text-gray-500 py-4">Select a supplier to view ledger.</td></tr>
            )}

            {supplierId && derivedRows.map((r) => {
              const isInvoice = r.entry_type === "invoice";
              const isPayment = r.entry_type === "payment";
              return (
                <tr key={r.id ?? `new-${r.__i}`} className="align-top">
                  <td className="border px-1 py-1">
                    <input
                      type="date"
                      className="w-full outline-none px-1 py-0.5 text-xs"
                      value={(r.entry_date || "").slice(0,10)}
                      onChange={e => handleField(r.__i, "entry_date", e.target.value)}
                    />
                  </td>

                  <td className="border px-1 py-1">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] ${isInvoice ? "bg-blue-100 text-blue-700" : isPayment ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-700"}`}>
                      {r.entry_type?.toUpperCase()}
                    </span>
                  </td>

                  <td className="border px-1 py-1">
                    <input
                      type="text" className="w-full px-1 py-0.5"
                      value={r.posted_number ?? ""}
                      onChange={e => handleField(r.__i, "posted_number", e.target.value)}
                      disabled={isInvoice}
                      title={isInvoice ? "Synced from invoice" : "Editable"}
                    />
                  </td>

                  <td className="border px-1 py-1">
                    <input
                      type="text" className="w-full px-1 py-0.5"
                      value={r.invoice_number ?? ""}
                      onChange={e => handleField(r.__i, "invoice_number", e.target.value)}
                      disabled={isInvoice}
                      title={isInvoice ? "Synced from invoice" : "Editable"}
                    />
                  </td>

                  {/* Amounts as text; commit on blur */}
                  <td className="border px-1 py-1 text-right">
                    <input
                      type="text" inputMode="decimal"
                      className="w-full text-right px-1 py-0.5"
                      value={getInput(r, "invoice_total")}
                      onChange={e => setInput(r.__i, "invoice_total", e.target.value)}
                      onBlur={() => commitNumber(r.__i, "invoice_total")}
                      disabled={isInvoice ? true : false}
                      title={isInvoice ? "Synced from invoice" : "Editable"}
                    />
                  </td>

                  <td className="border px-1 py-1 text-right">
                    <input
                      type="text" inputMode="decimal"
                      className="w-full text-right px-1 py-0.5"
                      value={getInput(r, "total_paid")}
                      onChange={e => setInput(r.__i, "total_paid", e.target.value)}
                      onBlur={() => commitNumber(r.__i, "total_paid")}
                      disabled={isInvoice ? true : false}
                      title={isInvoice ? "Synced from invoice" : "Editable"}
                    />
                  </td>

                  <td className="border px-1 py-1 text-right">
                    <input
                      type="text" inputMode="decimal"
                      className="w-full text-right px-1 py-0.5"
                      value={getInput(r, "debited_amount")}
                      onChange={e => setInput(r.__i, "debited_amount", e.target.value)}
                      onBlur={() => commitNumber(r.__i, "debited_amount")}
                      disabled={!isPayment && !r.is_manual}
                      title={isPayment ? "Payment amount" : (r.is_manual ? "Editable" : "Not a payment row")}
                    />
                  </td>

                  <td className="border px-1 py-1">
                    {(isPayment || r.is_manual) ? (
                      <input
                        type="text" className="w-full px-1 py-0.5"
                        value={r.payment_ref ?? ""}
                        onChange={e => handleField(r.__i, "payment_ref", e.target.value)}
                      />
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>

                  <td className="border px-1 py-1 text-right">
                    {fmt(r.credit_remaining ?? 0)}
                  </td>

                  <td className="border px-1 py-1 text-right">
                    {fmt(r.running_balance ?? 0)}
                  </td>

                  <td className="border px-1 py-1">
                    <input
                      type="text" className="w-full px-1 py-0.5"
                      value={r.description ?? ""}
                      onChange={e => handleField(r.__i, "description", e.target.value)}
                    />
                  </td>

                  <td className="border px-1 py-1">
                    <button className="text-red-600 hover:underline" onClick={() => openDeleteModal(r.__i)}>Delete</button>
                  </td>
                </tr>
              );
            })}

            {supplierId && !rows.length && (
              <tr><td colSpan={12} className="text-center text-gray-500 py-4">No entries. Click “Rebuild” or add a payment.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ========== MODALS ========== */}

      {/* Add row (small confirm) */}
      {addModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
             onClick={(e) => { if (e.target === e.currentTarget) closeAddModal(); }}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5">
            <h2 className="text-lg font-semibold mb-2">
              {addModal.type === "payment" ? "Add Payment row?" : "Add Manual row?"}
            </h2>
            <p className="text-sm text-gray-600">
              A new {addModal.type} row will be appended for the selected supplier.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button className="px-3 py-1 rounded border" onClick={closeAddModal}>Cancel</button>
              <button className="px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700" onClick={confirmAdd}>
                Add row
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save (confirm counts) */}
      {saveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
             onClick={(e) => { if (e.target === e.currentTarget) closeSaveModal(); }}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-5">
            <h2 className="text-lg font-semibold mb-2">Save changes?</h2>
            <p className="text-sm text-gray-600">
              You’re about to save <b>{newCount}</b> new {newCount === 1 ? "row" : "rows"} and update{" "}
              <b>{updCount}</b> existing {updCount === 1 ? "row" : "rows"} for this supplier.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button className="px-3 py-1 rounded border" onClick={closeSaveModal}>Cancel</button>
              <button className="px-3 py-1 rounded bg-green-600 text-white hover:bg-green-700" onClick={confirmSave}>
                Yes, Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete (2-step confirm + password) */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
             onClick={(e) => { if (e.target === e.currentTarget) closeDeleteModal(); }}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-5">
            {deleteStep === 1 && (
              <div>
                <h2 className="text-lg font-semibold mb-2">Delete ledger row?</h2>
                <p className="text-sm text-gray-600">
                  Are you sure you want to delete this row? This action cannot be undone.
                </p>
                <div className="mt-4 flex justify-end gap-2">
                  <button className="px-3 py-1 rounded border" onClick={closeDeleteModal}>Cancel</button>
                  <button className="px-3 py-1 rounded bg-red-600 text-white hover:bg-red-700" onClick={proceedDeletePassword}>
                    Yes, continue
                  </button>
                </div>
              </div>
            )}

            {deleteStep === 2 && (
              <div>
                <h2 className="text-lg font-semibold mb-2">Confirm with password</h2>
                <p className="text-sm text-gray-600">
                  For security, please re-enter your password to delete this row.
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
                  <button className="px-3 py-1 rounded border" onClick={() => setDeleteStep(1)} disabled={deleting}>
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

      {/* Add row confirm modal controller buttons live above (openAddPayment / openAddManual) */}
    </div>
  );
}
