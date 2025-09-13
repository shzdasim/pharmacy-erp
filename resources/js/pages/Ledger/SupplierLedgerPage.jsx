// resources/js/pages/SupplierLedgerPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import SupplierSearchInput from "../../components/SupplierSearchInput.jsx";
import { usePermissions, Guard } from "@/api/usePermissions.js";

import {
  ArrowPathIcon,
  PrinterIcon,
  PlusCircleIcon,
  WrenchScrewdriverIcon,
  ArrowDownOnSquareIcon,
  ShieldExclamationIcon,
  XMarkIcon,
} from "@heroicons/react/24/solid";

// 🧊 glass primitives
import {
  GlassCard,
  GlassSectionHeader,
  GlassToolbar,
  GlassInput,
  GlassBtn,
} from "@/components/glass.jsx";

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

  // perms
  const { loading: permsLoading, canFor } = usePermissions();
  const can = useMemo(
    () =>
      (typeof canFor === "function" ? canFor("supplier-ledger") : {
        view:false, create:false, update:false, delete:false, import:false, export:false
      }),
    [canFor]
  );

  // tints
  const tintBlue   = "bg-blue-500/85 text-white ring-1 ring-white/20 shadow-[0_6px_20px_-6px_rgba(37,99,235,0.45)] hover:bg-blue-500/95";
  const tintGreen  = "bg-emerald-500/85 text-white ring-1 ring-white/20 shadow-[0_6px_20px_-6px_rgba(16,185,129,0.45)] hover:bg-emerald-500/95";
  const tintSlate  = "bg-slate-900/80 text-white ring-1 ring-white/15 shadow-[0_6px_20px_-6px_rgba(15,23,42,0.45)] hover:bg-slate-900/90";
  const tintAmber  = "bg-amber-500/85 text-white ring-1 ring-white/20 shadow-[0_6px_20px_-6px_rgba(245,158,11,0.45)] hover:bg-amber-500/95";
  const tintRed    = "bg-rose-500/85 text-white ring-1 ring-white/20 shadow-[0_6px_20px_-6px_rgba(244,63,94,0.45)] hover:bg-rose-500/95";
  const tintGlass  = "bg-white/60 text-slate-700 ring-1 ring-white/30 hover:bg-white/75";

  // utils
  const fmt = (v) => {
    if (v === null || v === undefined || v === "") return "0";
    const n = Number(v);
    if (!Number.isFinite(n)) return "0";
    return new Intl.NumberFormat(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n);
  };

  // hotkeys
  useEffect(() => {
    const onKeyS = (e) => {
      if (e.altKey && (e.key || "").toLowerCase() === "s") {
        e.preventDefault();
        if (!can.create && !can.update) return;
        openSaveModal();
      }
    };
    const onKeyP = (e) => {
      if (e.altKey && (e.key || "").toLowerCase() === "p") {
        e.preventDefault();
        if (!can.view) return;
        handlePrint();
      }
    };
    window.addEventListener("keydown", onKeyS);
    window.addEventListener("keydown", onKeyP);
    return () => {
      window.removeEventListener("keydown", onKeyS);
      window.removeEventListener("keydown", onKeyP);
    };
  }, [can.create, can.update, can.view]);

  useEffect(() => {
    if (permsLoading || !can.view) return;
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
  }, [permsLoading, can.view]);

  const fetchData = async () => {
    if (!can.view) return toast.error("You don't have permission to view supplier ledger.");
    if (!supplierId) return toast.error("Select a supplier first");
    try {
      const { data } = await axios.get("/api/supplier-ledger", { params: { supplier_id: supplierId, from, to } });
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
    if (!can.update) return toast.error("You don't have permission to rebuild.");
    if (!supplierId) return toast.error("Select a supplier first");
    try {
      await axios.post("/api/supplier-ledger/rebuild", { supplier_id: supplierId });
      toast.success("Rebuilt from invoices");
      await fetchData();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Rebuild failed");
    }
  };

  // number editing helpers
  const getInput = (row, field) => (row[`${field}_input`] !== undefined ? row[`${field}_input`] : (row[field] ?? "") + "");
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
      const parsed = raw === undefined || String(raw).trim() === "" ? 0 : parseFloat(String(raw).replace(/,/g, ""));
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

  // add row
  const addPaymentNow = () => {
    if (!can.create) return toast.error("You don't have permission to add payments.");
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
    if (!can.create) return toast.error("You don't have permission to add manual rows.");
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

  // bulk save
  const doBulkSave = async () => {
    const news = rows.filter(r => !r.id);
    const updates = rows.filter(r => r.id);
    if (news.length && !can.create) return toast.error("You don't have permission to create ledger rows.");
    if (updates.length && !can.update) return toast.error("You don't have permission to update ledger rows.");
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

  // delete (secure)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteStep, setDeleteStep] = useState(1); // 1 confirm, 2 password
  const [deletingIdx, setDeletingIdx] = useState(null);
  const [password, setPassword] = useState("");
  const [deleting, setDeleting] = useState(false);

  const openDeleteModal = (originalIdx) => {
    if (!can.delete) return toast.error("You don't have permission to delete ledger rows.");
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
    if (!can.delete) return toast.error("You don't have permission to delete ledger rows.");
    const r = rows[deletingIdx];
    try {
      setDeleting(true);
      await axios.post("/api/auth/confirm-password", { password });

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

  // add/ save modals
  const [addModal, setAddModal] = useState({ open: false, type: null }); // 'payment' | 'manual'
  const openAddPayment = () => setAddModal({ open: true, type: "payment" });
  const openAddManual  = () => setAddModal({ open: true, type: "manual" });
  const closeAddModal  = () => setAddModal({ open: false, type: null });
  const confirmAdd = () => {
    if (addModal.type === "payment") addPaymentNow();
    if (addModal.type === "manual")  addManualNow();
    closeAddModal();
  };

  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const openSaveModal = () => setSaveModalOpen(true);
  const closeSaveModal = () => setSaveModalOpen(false);
  const confirmSave = async () => {
    setSaveModalOpen(false);
    await doBulkSave();
  };

  // derived running balance
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

  const handlePrint = (type /* 'a4'|'thermal' optional */) => {
    if (!can.view) return toast.error("You don't have permission to print.");
    if (!supplierId) return toast.error("Select a supplier first");
    const qs = new URLSearchParams();
    qs.set("supplier_id", supplierId);
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);
    if (type) qs.set("type", type);
    window.open(`/supplier-ledger/print?${qs.toString()}`, "_blank", "noopener");
  };

  // UI gates
  if (permsLoading) return <div className="p-6">Loading…</div>;
  if (!can.view) return <div className="p-6 text-sm text-gray-700">You don’t have permission to view supplier ledger.</div>;

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* ===== Controls (stacked) ===== */}
      <GlassCard className="relative z-30">
        <GlassSectionHeader
          title={<span className="inline-flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-600" />
            <span>Supplier Ledger</span>
          </span>}
        />

        {/* Row 1: Supplier + Date + Load/Print */}
        <GlassToolbar className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-5">
            <label className="block text-sm text-gray-700 mb-1">Supplier *</label>
            <SupplierSearchInput
              value={supplierId}
              onChange={(id) => setSupplierId(id)}
              suppliers={suppliers}
              autoFocus
              /* Ensure dropdown renders over the table */
              menuPortalTarget={typeof document !== "undefined" ? document.body : null}
              menuPosition="fixed"
              styles={{
                menuPortal: base => ({ ...base, zIndex: 9999 }),
              }}
            />
          </div>

          <div className="md:col-span-2">
            <label className="text-sm text-gray-700 mb-1">From</label>
            <GlassInput type="date" value={from} onChange={(e)=>setFrom(e.target.value)} className="w-full" />
          </div>

          <div className="md:col-span-2">
            <label className="text-sm text-gray-700 mb-1">To</label>
            <GlassInput type="date" value={to} onChange={(e)=>setTo(e.target.value)} className="w-full" />
          </div>

          <div className="md:col-span-3 flex flex-wrap gap-2 items-end">
            <GlassBtn
              className={`h-10 min-w-[120px] ${supplierId ? tintSlate : tintGlass}`}
              onClick={fetchData}
              disabled={!supplierId}
              title="Load / Refresh"
            >
              <span className="inline-flex items-center gap-2">
                <ArrowPathIcon className="w-5 h-5" />
                Load
              </span>
            </GlassBtn>

            <GlassBtn
              onClick={() => handlePrint()}
              disabled={!supplierId}
              className={`h-10 min-w-[110px] ${supplierId ? tintGlass : tintGlass + " opacity-60 cursor-not-allowed"}`}
              title="Print (Alt+P)"
            >
              <span className="inline-flex items-center gap-2">
                <PrinterIcon className="w-5 h-5" />
                Print
              </span>
            </GlassBtn>
          </div>
        </GlassToolbar>

        {/* Row 2: Actions stacked and always visible */}
        <GlassToolbar className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-0">
          <Guard when={can.create}>
            <GlassBtn className={`h-10 ${supplierId ? tintBlue : tintGlass} w-full`} onClick={openAddPayment} disabled={!supplierId} title="+ Payment row">
              <span className="inline-flex items-center justify-center gap-2">
                <PlusCircleIcon className="w-5 h-5" />
                Payment
              </span>
            </GlassBtn>
          </Guard>

          <Guard when={can.create}>
            <GlassBtn className={`h-10 ${supplierId ? tintAmber : tintGlass} w-full`} onClick={openAddManual} disabled={!supplierId} title="+ Manual row">
              <span className="inline-flex items-center justify-center gap-2">
                <WrenchScrewdriverIcon className="w-5 h-5" />
                Manual
              </span>
            </GlassBtn>
          </Guard>

          <Guard when={can.update}>
            <GlassBtn className={`h-10 ${supplierId ? tintSlate : tintGlass} w-full`} onClick={rebuild} disabled={!supplierId} title="Rebuild from invoices">
              <span className="inline-flex items-center justify-center gap-2">
                <ArrowPathIcon className="w-5 h-5" />
                Rebuild
              </span>
            </GlassBtn>
          </Guard>

          <Guard when={can.update}>
            <GlassBtn className={`h-10 ${supplierId ? tintGreen : tintGlass} w-full`} onClick={openSaveModal} disabled={!supplierId} title="Save (Alt+S)">
              <span className="inline-flex items-center justify-center gap-2">
                <ArrowDownOnSquareIcon className="w-5 h-5" />
                Save (Alt+S)
              </span>
            </GlassBtn>
          </Guard>
        </GlassToolbar>
      </GlassCard>

      {/* ===== Summary ===== */}
      {supplierId && (
        <GlassCard>
          <div className="px-4 py-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <Stat label="Total Invoiced" value={fmt(summary.total_invoiced)} />
            <Stat label="Paid on Invoice" value={fmt(summary.paid_on_invoice)} />
            <Stat label="Payments (Debited)" value={fmt(summary.payments_debited)} />
            <Stat label="Net Balance" value={fmt(summary.net_balance)} />
          </div>
        </GlassCard>
      )}

      {/* ===== Table ===== */}
      <GlassCard className="relative z-10">
        <div className="max-h-[75vh] overflow-auto rounded-b-2xl">
          <table className="min-w-[1000px] w-full text-sm text-gray-900">
            <thead className="sticky top-0 bg-white/90 backdrop-blur-sm z-10 border-b border-gray-200/70">
              <tr className="text-left">
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">Posted #</th>
                <th className="px-3 py-2 font-medium">Invoice #</th>
                <th className="px-3 py-2 font-medium text-right">Invoice Total</th>
                <th className="px-3 py-2 font-medium text-right">Paid on Invoice</th>
                <th className="px-3 py-2 font-medium text-right">Payment (Debit)</th>
                <th className="px-3 py-2 font-medium">Payment Ref</th>
                <th className="px-3 py-2 font-medium text-right">Credit Remaining</th>
                <th className="px-3 py-2 font-medium text-right">Balance</th>
                <th className="px-3 py-2 font-medium">Description</th>
                <th className="px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>

            <tbody>
              {!supplierId && (
                <tr>
                  <td colSpan={12} className="px-3 py-10 text-center text-gray-600">
                    Select a supplier to view ledger.
                  </td>
                </tr>
              )}

              {supplierId && derivedRows.map((r) => {
                const isInvoice = r.entry_type === "invoice";
                const isPayment = r.entry_type === "payment";
                return (
                  <tr key={r.id ?? `new-${r.__i}`} className="transition-colors odd:bg-white/90 even:bg-white/70 hover:bg-blue-50 align-top">
                    <td className="px-3 py-2">
                      <GlassInput
                        type="date"
                        value={(r.entry_date || "").slice(0,10)}
                        onChange={(e) => handleField(r.__i, "entry_date", e.target.value)}
                        className="w-full"
                      />
                    </td>

                    <td className="px-3 py-2">
                      <span className={`px-2 py-1 rounded-xl text-xs ${
                        isInvoice ? "bg-blue-100 text-blue-700" :
                        isPayment ? "bg-emerald-100 text-emerald-700" :
                        "bg-gray-100 text-gray-700"
                      }`}>
                        {r.entry_type?.toUpperCase()}
                      </span>
                    </td>

                    <td className="px-3 py-2">
                      <GlassInput
                        type="text"
                        value={r.posted_number ?? ""}
                        onChange={(e) => handleField(r.__i, "posted_number", e.target.value)}
                        disabled={isInvoice}
                        title={isInvoice ? "Synced from invoice" : "Editable"}
                        className="w-full"
                      />
                    </td>

                    <td className="px-3 py-2">
                      <GlassInput
                        type="text"
                        value={r.invoice_number ?? ""}
                        onChange={(e) => handleField(r.__i, "invoice_number", e.target.value)}
                        disabled={isInvoice}
                        title={isInvoice ? "Synced from invoice" : "Editable"}
                        className="w-full"
                      />
                    </td>

                    <td className="px-3 py-2 text-right">
                      <GlassInput
                        type="text" inputMode="decimal"
                        value={getInput(r, "invoice_total")}
                        onChange={(e) => setInput(r.__i, "invoice_total", e.target.value)}
                        onBlur={() => commitNumber(r.__i, "invoice_total")}
                        disabled={isInvoice}
                        title={isInvoice ? "Synced from invoice" : "Editable"}
                        className="w-full text-right"
                      />
                    </td>

                    <td className="px-3 py-2 text-right">
                      <GlassInput
                        type="text" inputMode="decimal"
                        value={getInput(r, "total_paid")}
                        onChange={(e) => setInput(r.__i, "total_paid", e.target.value)}
                        onBlur={() => commitNumber(r.__i, "total_paid")}
                        disabled={isInvoice}
                        title={isInvoice ? "Synced from invoice" : "Editable"}
                        className="w-full text-right"
                      />
                    </td>

                    <td className="px-3 py-2 text-right">
                      <GlassInput
                        type="text" inputMode="decimal"
                        value={getInput(r, "debited_amount")}
                        onChange={(e) => setInput(r.__i, "debited_amount", e.target.value)}
                        onBlur={() => commitNumber(r.__i, "debited_amount")}
                        disabled={!isPayment && !r.is_manual}
                        title={isPayment ? "Payment amount" : (r.is_manual ? "Editable" : "Not a payment row")}
                        className="w-full text-right"
                      />
                    </td>

                    <td className="px-3 py-2">
                      {(isPayment || r.is_manual) ? (
                        <GlassInput
                          type="text"
                          value={r.payment_ref ?? ""}
                          onChange={(e) => handleField(r.__i, "payment_ref", e.target.value)}
                          className="w-full"
                        />
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>

                    <td className="px-3 py-2 text-right">{fmt(r.credit_remaining ?? 0)}</td>
                    <td className="px-3 py-2 text-right">{fmt(r.running_balance ?? 0)}</td>

                    <td className="px-3 py-2">
                      <GlassInput
                        type="text"
                        value={r.description ?? ""}
                        onChange={(e) => handleField(r.__i, "description", e.target.value)}
                        className="w-full"
                      />
                    </td>

                    <td className="px-3 py-2">
                      <Guard when={can.delete}>
                        <GlassBtn
                          onClick={() => openDeleteModal(r.__i)}
                          className={`h-8 px-3 ${tintRed}`}
                          title="Delete row"
                        >
                          Delete
                        </GlassBtn>
                      </Guard>
                    </td>
                  </tr>
                );
              })}

              {supplierId && !rows.length && (
                <tr>
                  <td colSpan={12} className="px-3 py-10 text-center text-gray-600">
                    No entries. Click <b>Rebuild</b> or add a payment.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* ===== Add Row modal ===== */}
      {addModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={(e)=>{ if(e.target===e.currentTarget) closeAddModal(); }}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative w-full max-w-sm">
            <GlassCard>
              <GlassSectionHeader
                title={<span className="font-semibold">{addModal.type === "payment" ? "Add Payment row?" : "Add Manual row?"}</span>}
                right={<GlassBtn className={`h-8 px-3 ${tintGlass}`} onClick={closeAddModal}><XMarkIcon className="w-5 h-5" /></GlassBtn>}
              />
              <div className="px-4 py-4">
                <p className="text-sm text-gray-700">
                  A new <b>{addModal.type}</b> row will be appended for the selected supplier.
                </p>
                <div className="mt-4 flex justify-end gap-2">
                  <GlassBtn className={`min-w-[100px] ${tintGlass}`} onClick={closeAddModal}>Cancel</GlassBtn>
                  <GlassBtn className={`min-w-[120px] ${tintBlue}`} onClick={confirmAdd}>Add row</GlassBtn>
                </div>
              </div>
            </GlassCard>
          </div>
        </div>
      )}

      {/* ===== Save confirm modal ===== */}
      {saveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={(e)=>{ if(e.target===e.currentTarget) closeSaveModal(); }}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative w-full max-w-md">
            <GlassCard>
              <GlassSectionHeader
                title={<span className="inline-flex items-center gap-2">
                  <ArrowDownOnSquareIcon className="w-5 h-5 text-emerald-600" />
                  <span>Save changes?</span>
                </span>}
                right={<GlassBtn className={`h-8 px-3 ${tintGlass}`} onClick={closeSaveModal}><XMarkIcon className="w-5 h-5" /></GlassBtn>}
              />
              <div className="px-4 py-4">
                <p className="text-sm text-gray-700">
                  You’re about to save <b>{newCount}</b> new {newCount === 1 ? "row" : "rows"} and update{" "}
                  <b>{updCount}</b> existing {updCount === 1 ? "row" : "rows"} for this supplier.
                </p>
                <div className="mt-4 flex justify-end gap-2">
                  <GlassBtn className={`min-w-[100px] ${tintGlass}`} onClick={closeSaveModal}>Cancel</GlassBtn>
                  <GlassBtn className={`min-w-[120px] ${tintGreen}`} onClick={confirmSave}>Yes, Save</GlassBtn>
                </div>
              </div>
            </GlassCard>
          </div>
        </div>
      )}

      {/* ===== Delete (2-step) modal ===== */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={(e)=>{ if(e.target===e.currentTarget) closeDeleteModal(); }}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative w-full max-w-md">
            <GlassCard>
              <GlassSectionHeader
                title={<span className="inline-flex items-center gap-2">
                  <ShieldExclamationIcon className="w-5 h-5 text-rose-600" />
                  <span>Delete ledger row</span>
                </span>}
                right={<GlassBtn className={`h-8 px-3 ${tintGlass}`} onClick={closeDeleteModal}><XMarkIcon className="w-5 h-5" /></GlassBtn>}
              />
              <div className="px-4 py-4 space-y-4">
                {deleteStep === 1 ? (
                  <>
                    <p className="text-sm text-gray-700">
                      Are you sure you want to delete this row? This action cannot be undone.
                    </p>
                    <div className="flex justify-end gap-2">
                      <GlassBtn className={`min-w-[100px] ${tintGlass}`} onClick={closeDeleteModal}>Cancel</GlassBtn>
                      <GlassBtn className={`min-w-[140px] ${tintRed}`} onClick={proceedDeletePassword}>Yes, continue</GlassBtn>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-gray-700">
                      For security, please re-enter your password to delete this row.
                    </p>
                    <GlassInput
                      type="password"
                      autoFocus
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Your password"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") confirmAndDelete();
                        if (e.key === "Escape") closeDeleteModal();
                      }}
                      className="w-full"
                    />
                    <div className="flex justify-between">
                      <GlassBtn className={`min-w-[90px] ${tintGlass}`} onClick={() => setDeleteStep(1)} disabled={deleting}>
                        ← Back
                      </GlassBtn>
                      <div className="flex gap-2">
                        <GlassBtn className={`min-w-[100px] ${tintGlass}`} onClick={closeDeleteModal} disabled={deleting}>
                          Cancel
                        </GlassBtn>
                        <GlassBtn
                          className={`min-w-[170px] ${tintRed} disabled:opacity-60`}
                          onClick={confirmAndDelete}
                          disabled={deleting || password.trim() === ""}
                        >
                          {deleting ? "Deleting…" : "Confirm & Delete"}
                        </GlassBtn>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </GlassCard>
          </div>
        </div>
      )}

      {/* print + portal helpers */}
      <style>{`
        @media print {
          input, button, select, [role="button"], .rs__control { display: none !important; }
          table { font-size: 11px; }
          thead { position: sticky; top: 0; }
        }
        /* Ensure any react-select portal rises above the table */
        .rs__menu-portal, .rs__menu-portal > div { z-index: 9999 !important; }
      `}</style>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-xl bg-white/60 ring-1 ring-gray-200/60 px-3 py-2 backdrop-blur-sm shadow-sm">
      <div className="text-xs text-gray-600">{label}</div>
      <div className="text-base font-semibold">{value}</div>
    </div>
  );
}
