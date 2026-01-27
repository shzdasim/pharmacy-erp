// resources/js/pages/SupplierLedgerPage.jsx
import React, { useEffect, useMemo, useState, useRef } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import SupplierSearchInput from "../../components/SupplierSearchInput.jsx";
import { usePermissions, Guard } from "@/api/usePermissions.js";
import { useTheme } from "@/context/ThemeContext.jsx";

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

/* =========================
   Supplier Ledger Page (Simple, Layman-Friendly)
   ========================= */
export default function SupplierLedgerPage() {
  const [suppliers, setSuppliers] = useState([]);
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

  // theme
  const { isDark } = useTheme();

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
      // For payment rows, calculate the remaining balance based on debited_amount
      if (r.entry_type === "payment") {
        r.credit_remaining = 0;
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
      // For payment rows, update credit_remaining to 0
      if (r.entry_type === "payment") {
        r.credit_remaining = 0;
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
        description: "Payment made",
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
    const updates = rows.filter(r => r.id && (r.entry_type === "payment" || r.entry_type === "manual" || r.is_manual));
    if (news.length && !can.create) return toast.error("You don't have permission to create ledger rows.");
    if (updates.length && !can.update) return toast.error("You don't have permission to update ledger rows.");

    try {
      for (const n of news) {
        const payload = {
          supplier_id: supplierId,
          entry_type: n.entry_type,
          is_manual: !!n.is_manual,
          entry_date: n.entry_date,
          description: n.description,
          posted_number: n.posted_number,
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
  const [deleteStep, setDeleteStep] = useState(1);
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

  // derived running balance (same as CustomerLedger)
  const derivedRows = useMemo(() => {
    // First sort rows by date and id
    const sorted = [...rows].sort((a, b) => {
      const ad = (a.entry_date || "").slice(0, 10);
      const bd = (b.entry_date || "").slice(0, 10);
      if (ad === bd) {
        const ai = a.id ?? Number.MAX_SAFE_INTEGER;
        const bi = b.id ?? Number.MAX_SAFE_INTEGER;
        return ai - bi;
      }
      return ad < bd ? -1 : 1;
    });

    // Calculate running balance
    let runningBalance = 0;
    const withBalance = sorted.map((r, i) => {
      if (r.entry_type === "invoice" || r.entry_type === "manual") {
        // Add the remaining balance (what we owe)
        runningBalance += Number(r.credit_remaining || 0);
      } else if (r.entry_type === "payment") {
        // Subtract the payment amount
        runningBalance -= Number(r.debited_amount || 0);
      }
      return {
        ...r,
        __i: i,
        running_balance: Number(runningBalance.toFixed(2)),
      };
    });

    return withBalance;
  }, [rows]);

  const newCount = rows.filter(r => !r.id).length;
  const updCount = rows.filter(r => r.id && (r.entry_type === "payment" || r.entry_type === "manual" || r.is_manual)).length;

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
  if (!can.view) return <div className="p-6 text-sm text-gray-700">You don't have permission to view supplier ledger.</div>;

  return (
    <div className={`p-2 md:p-3 space-y-3 ${isDark ? "bg-slate-900" : "bg-gray-50"}`} style={{ minHeight: '100vh' }}>
      {/* ===== Controls Compact ===== */}
      <GlassCard className={`relative z-30 p-2 ${isDark ? "bg-slate-800/80 border-slate-700" : ""}`}>
        <GlassSectionHeader
          title={<span className="inline-flex items-center gap-2 text-sm">
            <span className="w-2 h-2 rounded-full bg-blue-600" />
            <span>Supplier Ledger</span>
          </span>}
        />

        {/* All buttons in single row */}
        <div className="flex flex-wrap gap-1 mt-2">
          <div className="flex-1 min-w-[150px]">
            <SupplierSearchInput
              value={supplierId}
              onChange={setSupplierId}
              suppliers={suppliers}
              autoFocus
              menuPortalTarget={typeof document !== "undefined" ? document.body : null}
              menuPosition="fixed"
              styles={{
                menuPortal: base => ({ ...base, zIndex: 9999 }),
              }}
            />
          </div>
          
          <GlassBtn
            onClick={() => handlePrint()}
            disabled={!supplierId}
            className={`h-8 px-2 text-xs ${supplierId ? tintGlass : tintGlass + " opacity-60 cursor-not-allowed"}`}
            title="Print"
          >
            <span className="inline-flex items-center gap-1">
              <PrinterIcon className="w-4 h-4" />
              Print
            </span>
          </GlassBtn>

          <Guard when={can.update}>
            <GlassBtn
              className={`h-8 px-2 text-xs ${supplierId ? tintSlate : tintGlass}`}
              onClick={rebuild}
              disabled={!supplierId}
              title="Refresh from invoices"
            >
              <span className="inline-flex items-center gap-1">
                <ArrowPathIcon className="w-4 h-4" />
                Refresh
              </span>
            </GlassBtn>
          </Guard>

          <Guard when={can.create}>
            <GlassBtn
              className={`h-8 px-2 text-xs ${supplierId ? tintBlue : tintGlass} w-auto`}
              onClick={openAddPayment}
              disabled={!supplierId}
              title="Add payment"
            >
              <span className="inline-flex items-center gap-1">
                <PlusCircleIcon className="w-4 h-4" />
                Make Payment
              </span>
            </GlassBtn>
          </Guard>

          <Guard when={can.create}>
            <GlassBtn
              className={`h-8 px-2 text-xs ${supplierId ? tintAmber : tintGlass}`}
              onClick={openAddManual}
              disabled={!supplierId}
              title="Add manual entry"
            >
              <span className="inline-flex items-center gap-1">
                <WrenchScrewdriverIcon className="w-4 h-4" />
                Manual
              </span>
            </GlassBtn>
          </Guard>

          <Guard when={can.update}>
            <GlassBtn
              className={`h-8 px-2 text-xs ${supplierId ? tintGreen : tintGlass}`}
              onClick={fetchData}
              disabled={!supplierId}
              title="Load data"
            >
              <span className="inline-flex items-center gap-1">
                <ArrowPathIcon className="w-4 h-4" />
                Load
              </span>
            </GlassBtn>
          </Guard>

          <Guard when={can.update}>
            <GlassBtn
              className={`h-8 px-2 text-xs ${supplierId ? tintGlass : tintGlass}`}
              onClick={openSaveModal}
              disabled={!supplierId || (newCount === 0 && updCount === 0)}
              title="Save (Alt+S)"
            >
              <span className="inline-flex items-center gap-1">
                <ArrowDownOnSquareIcon className="w-4 h-4" />
                Save
              </span>
            </GlassBtn>
          </Guard>
        </div>
      </GlassCard>

      {/* ===== Summary Compact ===== */}
      {supplierId && (
        <div className="grid grid-cols-4 gap-2">
          <Stat isDark={isDark} label="Total Bills" value={fmt(summary.total_invoiced)} />
          <Stat isDark={isDark} label="Advance" value={fmt(summary.paid_on_invoice)} />
          <Stat isDark={isDark} label="Payments" value={fmt(summary.payments_debited)} />
          <Stat isDark={isDark} label="Total Due" value={fmt(summary.net_balance)} />
        </div>
      )}

      {/* ===== Table Compact ===== */}
      <GlassCard className={`relative z-10 p-0 overflow-hidden ${isDark ? "bg-slate-800/80 border-slate-700" : ""}`}>
        <div className={`max-h-[calc(100vh-250px)] overflow-auto ${isDark ? "bg-slate-800" : "bg-white"}`}>
          <table className="w-full text-xs">
            <thead className={`sticky top-0 z-10 border-b ${isDark ? "bg-slate-700" : "bg-gray-100"}`}>
              <tr className={`text-left ${isDark ? "text-slate-200" : "text-gray-700"}`}>
                <th className="px-2 py-1.5 font-medium w-24">Date</th>
                <th className="px-2 py-1.5 font-medium w-14">Type</th>
                <th className="px-2 py-1.5 font-medium w-20">Ref</th>
                <th className="px-2 py-1.5 font-medium text-right w-18">Bill</th>
                <th className="px-2 py-1.5 font-medium text-right w-18">Paid Now</th>
                <th className="px-2 py-1.5 font-medium text-right w-16">Total Paid</th>
                <th className="px-2 py-1.5 font-medium text-right w-18">Balance</th>
                <th className="px-2 py-1.5 font-medium text-right w-18">Running</th>
                <th className="px-2 py-1.5 font-medium w-24">Notes</th>
                <th className="px-2 py-1.5 font-medium w-14">Action</th>
              </tr>
            </thead>

            <tbody>
              {!supplierId && (
                <tr>
                  <td colSpan={10} className={`px-2 py-8 text-center ${isDark ? "text-slate-400" : "text-gray-500"}`}>
                    Select a supplier to view ledger
                  </td>
                </tr>
              )}

              {supplierId && derivedRows.map((r) => {
                const isInvoice = r.entry_type === "invoice";
                const isPayment = r.entry_type === "payment";
                return (
                  <tr key={r.id ?? `new-${r.__i}`} className={`border-b ${isDark ? "border-slate-600 hover:bg-slate-700/50" : "border-gray-200 hover:bg-blue-50"}`}>
                    <td className="px-2 py-1">
                      <input
                        type="date"
                        value={(r.entry_date || "").slice(0,10)}
                        onChange={(e) => handleField(r.__i, "entry_date", e.target.value)}
                        className={`w-full text-xs border rounded px-1 py-1 ${isDark ? "border-slate-600 bg-slate-700 text-slate-200" : "border-gray-300 bg-white text-gray-800"}`}
                      />
                    </td>

                    <td className="px-2 py-1">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                        isInvoice ? "bg-blue-100 text-blue-700" :
                        isPayment ? "bg-emerald-100 text-emerald-700" :
                        "bg-gray-100 text-gray-700"
                      }`}>
                        {r.entry_type?.toUpperCase()}
                      </span>
                    </td>

                    <td className="px-2 py-1">
                      <input
                        type="text"
                        value={r.posted_number ?? ""}
                        onChange={(e) => handleField(r.__i, "posted_number", e.target.value)}
                        disabled={isInvoice}
                        placeholder={isInvoice ? "-" : "Ref"}
                        className={`w-full text-xs border rounded px-1 py-1 ${isDark ? "border-slate-600 bg-slate-700 text-slate-200 disabled:bg-slate-800" : "border-gray-300 bg-white text-gray-800 disabled:bg-gray-100"}`}
                      />
                    </td>

                    <td className="px-2 py-1 text-right">
                      {isInvoice || r.entry_type === "manual" ? (
                        <input
                          type="text" inputMode="decimal"
                          value={getInput(r, "invoice_total")}
                          onChange={(e) => setInput(r.__i, "invoice_total", e.target.value)}
                          onBlur={() => commitNumber(r.__i, "invoice_total")}
                          disabled={isInvoice}
                          className={`w-full text-xs text-right border rounded px-1 py-1 ${isDark ? "border-slate-600 bg-slate-700 text-slate-200 disabled:bg-slate-800" : "border-gray-300 bg-white text-gray-800 disabled:bg-gray-100"}`}
                        />
                      ) : (
                        <span className={isDark ? "text-slate-500" : "text-gray-400"}>—</span>
                      )}
                    </td>

                    <td className="px-2 py-1 text-right">
                      {isPayment ? (
                        <input
                          type="text" inputMode="decimal"
                          value={getInput(r, "debited_amount")}
                          onChange={(e) => setInput(r.__i, "debited_amount", e.target.value)}
                          onBlur={() => commitNumber(r.__i, "debited_amount")}
                          placeholder="0.00"
                          className={`w-full text-xs text-right border rounded px-1 py-1 font-medium ${isDark ? "border-slate-600 bg-slate-700 text-emerald-400" : "border-gray-300 bg-white text-emerald-600"}`}
                        />
                      ) : (
                        <span className={isDark ? "text-slate-500" : "text-gray-400"}>—</span>
                      )}
                    </td>

                    <td className="px-2 py-1 text-right">
                      {isInvoice || r.entry_type === "manual" ? (
                        <span className={`font-medium ${isDark ? "text-slate-300" : "text-gray-700"}`}>{fmt(r.total_paid || 0)}</span>
                      ) : (
                        <span className={isDark ? "text-slate-500" : "text-gray-400"}>—</span>
                      )}
                    </td>

                    <td className="px-2 py-1 text-right">
                      <span className={`font-bold ${(r.credit_remaining || 0) > 0 ? 'text-red-500' : 'text-green-500'}`}>
                        {fmt(r.credit_remaining ?? 0)}
                      </span>
                    </td>

                    <td className="px-2 py-1 text-right">
                      <span className={`font-bold ${(r.running_balance || 0) > 0 ? 'text-blue-500' : 'text-green-500'}`}>
                        {fmt(r.running_balance ?? 0)}
                      </span>
                    </td>

                    <td className="px-2 py-1">
                      <input
                        type="text"
                        value={r.description ?? ""}
                        onChange={(e) => handleField(r.__i, "description", e.target.value)}
                        placeholder="..."
                        className={`w-full text-xs border rounded px-1 py-1 ${isDark ? "border-slate-600 bg-slate-700 text-slate-200" : "border-gray-300 bg-white text-gray-800"}`}
                      />
                    </td>

                    <td className="px-2 py-1">
                      <button
                        onClick={() => openDeleteModal(r.__i)}
                        className="px-2 py-0.5 bg-rose-500 text-white rounded text-[10px] hover:bg-rose-600"
                      >
                        X
                      </button>
                    </td>
                  </tr>
                );
              })}

              {supplierId && !rows.length && (
                <tr>
                  <td colSpan={10} className={`px-2 py-8 text-center ${isDark ? "text-slate-400" : "text-gray-500"}`}>
                    No entries. Click <b className={isDark ? "text-slate-300" : "text-gray-700"}>Refresh</b> or add a payment.
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
                <p className={`text-sm ${isDark ? "text-slate-300" : "text-gray-700"}`}>
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
                <p className={`text-sm ${isDark ? "text-slate-300" : "text-gray-700"}`}>
                  You're about to save <b>{newCount}</b> new {newCount === 1 ? "row" : "rows"} and update{" "}
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
                    <p className={`text-sm ${isDark ? "text-slate-300" : "text-gray-700"}`}>
                      Are you sure you want to delete this row? This action cannot be undone.
                    </p>
                    <div className="flex justify-end gap-2">
                      <GlassBtn className={`min-w-[100px] ${tintGlass}`} onClick={closeDeleteModal}>Cancel</GlassBtn>
                      <GlassBtn className={`min-w-[140px] ${tintRed}`} onClick={proceedDeletePassword}>Yes, continue</GlassBtn>
                    </div>
                  </>
                ) : (
                  <>
                    <p className={`text-sm ${isDark ? "text-slate-300" : "text-gray-700"}`}>
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
          input, button, select, [role="button"] { display: none !important; }
          table { font-size: 11px; }
          thead { position: sticky; top: 0; }
        }
      `}</style>
    </div>
  );
}

function Stat({ isDark, label, value }) {
  return (
    <div className={`${isDark ? "bg-slate-800/60 ring-slate-700" : "bg-white/60 ring-gray-200/60"} px-2 py-1.5 rounded shadow-sm`}>
      <div className={`text-[10px] ${isDark ? "text-slate-400" : "text-gray-600"}`}>{label}</div>
      <div className={`text-sm font-semibold ${isDark ? "text-slate-200" : "text-gray-800"}`}>{value}</div>
    </div>
  );
}

