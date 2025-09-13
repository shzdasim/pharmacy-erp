// resources/js/pages/CustomerLedgerPage.jsx
import React, { useEffect, useMemo, useState, useRef } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { usePermissions, Guard } from "@/api/usePermissions.js";

// 🧊 glass primitives
import {
  GlassCard,
  GlassSectionHeader,
  GlassToolbar,
  GlassInput,
  GlassBtn,
} from "@/components/glass.jsx";

import {
  ArrowPathIcon,
  PrinterIcon,
  PlusCircleIcon,
  WrenchScrewdriverIcon,
  ArrowDownOnSquareIcon,
  ShieldExclamationIcon,
  XMarkIcon,
} from "@heroicons/react/24/solid";

/* =========================
   Async Customer Search (tablet-friendly)
   ========================= */
function CustomerSearchInput({ value, onChange, autoFocus }) {
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]); // [{id,name,phone,email}]
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef(null);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    const onDoc = (e) => {
      if (!boxRef.current) return;
      if (!boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    if (autoFocus) setTimeout(() => inputRef.current?.focus(), 50);
  }, [autoFocus]);

  const fetchPage = async (p = 1, q = "") => {
    setLoading(true);
    try {
      const params = { q, page: p, limit: 20 };
      let res;
      try {
        res = await axios.get("/api/customers/search", { params });
      } catch {
        res = await axios.get("/api/customers", { params });
      }
      const data = Array.isArray(res.data?.data) ? res.data.data : [];
      const next = res.data?.next_page ?? null;
      const normalized = data.map((c) => ({
        id: c.id ?? c.value,
        name: c.name ?? c.label,
        phone: c.phone ?? c.mobile ?? "",
        email: c.email ?? "",
      }));
      setItems(p === 1 ? normalized : (prev) => [...prev, ...normalized]);
      setHasMore(Boolean(next));
      setPage(p);
    } catch {
      toast.error("Failed to load customers");
    } finally {
      setLoading(false);
    }
  };

  const onFocus = () => {
    setOpen(true);
    if (items.length === 0) fetchPage(1, "");
  };

  const onType = (val) => {
    setTerm(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchPage(1, val.trim());
    }, 250);
  };

  const pick = (c) => {
    onChange?.(c?.id || "");
    setTerm(c?.name || "");
    setOpen(false);
  };

  const clear = () => {
    onChange?.("");
    setTerm("");
    setItems([]);
    setHasMore(false);
    setPage(1);
  };

  return (
    <div className="relative" ref={boxRef}>
      <div className="flex gap-2">
        <GlassInput
          ref={inputRef}
          placeholder="Search customer by name/phone/email…"
          value={term}
          onFocus={onFocus}
          onChange={(e) => onType(e.target.value)}
          className="w-full"
        />
        {value ? (
          <GlassBtn type="button" onClick={clear} className="h-9">
            Clear
          </GlassBtn>
        ) : (
          <GlassBtn
            type="button"
            onClick={() => (open ? setOpen(false) : onFocus())}
            className="h-9"
          >
            {open ? "Close" : "Search"}
          </GlassBtn>
        )}
      </div>

      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white/90 backdrop-blur-sm border rounded-xl shadow-xl max-h-80 overflow-auto ring-1 ring-gray-200/60">
          {loading && items.length === 0 && (
            <div className="px-3 py-2 text-gray-600 text-xs">Loading…</div>
          )}
          {!loading && items.length === 0 && (
            <div className="px-3 py-2 text-gray-600 text-xs">No customers found</div>
          )}
          {items.map((it) => (
            <button
              key={it.id}
              type="button"
              onClick={() => pick(it)}
              className="w-full text-left px-3 py-2 hover:bg-gray-50"
            >
              <div className="font-medium text-xs">{it.name}</div>
              <div className="text-[11px] text-gray-600">{it.phone || it.email || "-"}</div>
            </button>
          ))}
          {hasMore && (
            <div className="p-2">
              <GlassBtn
                type="button"
                className="w-full"
                onClick={() => fetchPage(page + 1, term.trim())}
                disabled={loading}
              >
                {loading ? "Loading..." : "Load more"}
              </GlassBtn>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* =========================
   Customer Ledger Page (glassy parity with Supplier Ledger)
   ========================= */
export default function CustomerLedgerPage() {
  const [customerId, setCustomerId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({
    total_invoiced: 0,
    received_on_invoice: 0,
    payments_credited: 0,
    net_balance: 0,
  });

  // 🔒 permissions
  const { loading: permsLoading, canFor } = usePermissions();
  const can = useMemo(
    () =>
      (typeof canFor === "function" ? canFor("customer-ledger") : {
        view:false, create:false, update:false, delete:false
      }),
    [canFor]
  );

  // tints (same palette as Supplier Ledger)
  const tintBlue   = "bg-blue-500/85 text-white ring-1 ring-white/20 shadow-[0_6px_20px_-6px_rgba(37,99,235,0.45)] hover:bg-blue-500/95";
  const tintGreen  = "bg-emerald-500/85 text-white ring-1 ring-white/20 shadow-[0_6px_20px_-6px_rgba(16,185,129,0.45)] hover:bg-emerald-500/95";
  const tintSlate  = "bg-slate-900/80 text-white ring-1 ring-white/15 shadow-[0_6px_20px_-6px_rgba(15,23,42,0.45)] hover:bg-slate-900/90";
  const tintAmber  = "bg-amber-500/85 text-white ring-1 ring-white/20 shadow-[0_6px_20px_-6px_rgba(245,158,11,0.45)] hover:bg-amber-500/95";
  const tintRed    = "bg-rose-500/85 text-white ring-1 ring-white/20 shadow-[0_6px_20px_-6px_rgba(244,63,94,0.45)] hover:bg-rose-500/95";
  const tintGlass  = "bg-white/60 text-slate-700 ring-1 ring-white/30 hover:bg-white/75";

  // ---------- utils ----------
  const fmt = (v) => {
    if (v === null || v === undefined || v === "") return "0";
    const n = Number(v);
    if (!Number.isFinite(n)) return "0";
    return new Intl.NumberFormat(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n);
  };

  // hotkeys (guarded)
  useEffect(() => {
    const onKey = (e) => {
      const k = (e.key || "").toLowerCase();
      if (e.altKey && k === "s") {
        e.preventDefault();
        if (!can.create && !can.update) return;
        openSaveModal();
      }
      if (e.altKey && k === "p") {
        e.preventDefault();
        if (!can.view) return;
        handlePrint();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [can.create, can.update, can.view]);

  const fetchData = async () => {
    if (!can.view) return toast.error("You don't have permission to view customer ledger.");
    if (!customerId) return toast.error("Select a customer first");
    try {
      const { data } = await axios.get("/api/customer-ledger", {
        params: { customer_id: customerId, from, to },
      });
      const clean = (data.data || []).map((r) => {
        const c = { ...r };
        Object.keys(c).forEach((k) => k.endsWith("_input") && delete c[k]);
        return c;
      });
      setRows(clean);
      setSummary(
        data.summary || {
          total_invoiced: 0,
          received_on_invoice: 0,
          payments_credited: 0,
          net_balance: 0,
        }
      );
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to load ledger");
    }
  };

  const rebuild = async () => {
    if (!can.update) return toast.error("You don't have permission to rebuild.");
    if (!customerId) return toast.error("Select a customer first");
    try {
      await axios.post("/api/customer-ledger/rebuild", { customer_id: customerId });
      toast.success("Rebuilt from sale invoices");
      await fetchData();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Rebuild failed");
    }
  };

  // ---------- number editing helpers ----------
  const getInput = (row, field) => (row[`${field}_input`] !== undefined ? row[`${field}_input`] : (row[field] ?? "") + "");
  const setInput = (idx, field, raw) => {
    setRows((prev) => {
      const next = [...prev];
      const r = { ...next[idx] };
      r[`${field}_input`] = raw;
      next[idx] = r;
      return next;
    });
  };
  const commitNumber = (idx, field) => {
    setRows((prev) => {
      const next = [...prev];
      const r = { ...next[idx] };
      const raw = r[`${field}_input`];
      const parsed = raw === undefined || String(raw).trim() === "" ? 0 : parseFloat(String(raw).replace(/,/g, ""));
      r[field] = Number.isFinite(parsed) ? Number(parsed) : 0;
      delete r[`${field}_input`];

      if (["invoice", "manual"].includes(r.entry_type)) {
        const bal = Number(((r.invoice_total || 0) - (r.total_received || 0)).toFixed(2));
        r.balance_remaining = bal < 0 ? 0 : bal;
      }
      next[idx] = r;
      return next;
    });
  };
  const handleField = (idx, field, value) => {
    setRows((prev) => {
      const next = [...prev];
      const r = { ...next[idx], [field]: value };
      if (["invoice", "manual"].includes(r.entry_type) && (field === "invoice_total" || field === "total_received")) {
        const bal = Number(((r.invoice_total || 0) - (r.total_received || 0)).toFixed(2));
        r.balance_remaining = bal < 0 ? 0 : bal;
      }
      next[idx] = r;
      return next;
    });
  };

  // ---------- add row ----------
  const addPaymentNow = () => {
    if (!can.create) return toast.error("You don't have permission to add payments.");
    if (!customerId) return toast.error("Select a customer first");
    const today = new Date().toISOString().slice(0, 10);
    setRows((prev) => [
      ...prev,
      {
        id: undefined,
        customer_id: customerId,
        entry_type: "payment",
        entry_date: today,
        credited_amount: 0,
        payment_ref: "",
        description: "Payment received",
        invoice_total: 0,
        total_received: 0,
        balance_remaining: 0,
        is_manual: true,
      },
    ]);
  };
  const addManualNow = () => {
    if (!can.create) return toast.error("You don't have permission to add manual rows.");
    if (!customerId) return toast.error("Select a customer first");
    const today = new Date().toISOString().slice(0, 10);
    setRows((prev) => [
      ...prev,
      {
        id: undefined,
        customer_id: customerId,
        entry_type: "manual",
        entry_date: today,
        posted_number: "",
        invoice_total: 0,
        total_received: 0,
        balance_remaining: 0,
        credited_amount: 0,
        payment_ref: "",
        description: "",
        is_manual: true,
      },
    ]);
  };

  // ---------- bulk save ----------
  const doBulkSave = async () => {
    const news = rows.filter((r) => !r.id);
    const updates = rows.filter(
      (r) => r.id && (r.entry_type === "payment" || r.entry_type === "manual" || r.is_manual)
    );
    if (news.length && !can.create) return toast.error("You don't have permission to create ledger rows.");
    if (updates.length && !can.update) return toast.error("You don't have permission to update ledger rows.");

    try {
      for (const n of news) {
        const payload = {
          customer_id: customerId,
          entry_type: n.entry_type,
          is_manual: !!n.is_manual,
          entry_date: n.entry_date,
          description: n.description,
          posted_number: n.posted_number,
          invoice_total: n.invoice_total || 0,
          total_received: n.total_received || 0,
          credited_amount: n.credited_amount || 0,
          payment_ref: n.payment_ref,
          sale_invoice_id: n.sale_invoice_id || null,
        };
        await axios.post("/api/customer-ledger", payload);
      }
      if (updates.length) {
        await axios.put("/api/customer-ledger/bulk", {
          rows: updates.map((u) => ({
            id: u.id,
            entry_date: u.entry_date,
            description: u.description,
            posted_number: u.posted_number,
            invoice_total: u.invoice_total || 0,
            total_received: u.total_received || 0,
            credited_amount: u.credited_amount || 0,
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

  // ---------- delete (secure) ----------
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
        await axios.delete(`/api/customer-ledger/${r.id}`);
        toast.success("Row deleted");
        await fetchData();
      } else {
        setRows((prev) => prev.filter((_, i) => i !== deletingIdx));
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

  // ---------- derived running balance (parity with Supplier Ledger) ----------
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
      const invInc = (Number(r.invoice_total || 0) - Number(r.total_received || 0)); // customer owes
      const payDec = Number(r.credited_amount || 0); // customer paid
      if (isInvoiceLike) balance += invInc;
      if (isPayment) balance -= payDec;
      return { ...r, running_balance: Number(balance.toFixed(2)), __i: i };
    });
  }, [rows]);

  const newCount = rows.filter((r) => !r.id).length;
  const updCount = rows.filter(
    (r) => r.id && (r.entry_type === "payment" || r.entry_type === "manual" || r.is_manual)
  ).length;

  const handlePrint = (type /* 'a4'|'thermal' optional */) => {
    if (!can.view) return toast.error("You don't have permission to print.");
    if (!customerId) return toast.error("Select a customer first");
    const qs = new URLSearchParams();
    qs.set("customer_id", customerId);
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);
    if (type) qs.set("type", type);
    window.open(`/customer-ledger/print?${qs.toString()}`, "_blank", "noopener");
  };

  // ---------- UI ----------
  if (permsLoading) return <div className="p-6">Loading…</div>;
  if (!can.view) return <div className="p-6 text-sm text-gray-700">You don’t have permission to view customer ledger.</div>;

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* ===== Controls (stacked) ===== */}
      <GlassCard className="relative z-30">
        <GlassSectionHeader
          title={<span className="inline-flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-600" />
            <span>Customer Ledger</span>
          </span>}
        />

        {/* Row 1: Customer + Date + Load/Print */}
        <GlassToolbar className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-5">
            <label className="block text-sm text-gray-700 mb-1">Customer *</label>
            <CustomerSearchInput value={customerId} onChange={setCustomerId} autoFocus />
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
              className={`h-10 min-w-[120px] ${customerId ? tintSlate : tintGlass}`}
              onClick={fetchData}
              disabled={!customerId}
              title="Load / Refresh"
            >
              <span className="inline-flex items-center gap-2">
                <ArrowPathIcon className="w-5 h-5" />
                Load
              </span>
            </GlassBtn>

            <GlassBtn
              onClick={() => handlePrint()}
              disabled={!customerId}
              className={`h-10 min-w-[110px] ${customerId ? tintGlass : tintGlass + " opacity-60 cursor-not-allowed"}`}
              title="Print (Alt+P)"
            >
              <span className="inline-flex items-center gap-2">
                <PrinterIcon className="w-5 h-5" />
                Print
              </span>
            </GlassBtn>
          </div>
        </GlassToolbar>

        {/* Row 2: Actions */}
        <GlassToolbar className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-0">
          <Guard when={can.create}>
            <GlassBtn className={`h-10 ${customerId ? tintBlue : tintGlass} w-full`} onClick={openAddPayment} disabled={!customerId} title="+ Payment row">
              <span className="inline-flex items-center justify-center gap-2">
                <PlusCircleIcon className="w-5 h-5" />
                Payment
              </span>
            </GlassBtn>
          </Guard>

          <Guard when={can.create}>
            <GlassBtn className={`h-10 ${customerId ? tintAmber : tintGlass} w-full`} onClick={openAddManual} disabled={!customerId} title="+ Manual row">
              <span className="inline-flex items-center justify-center gap-2">
                <WrenchScrewdriverIcon className="w-5 h-5" />
                Manual
              </span>
            </GlassBtn>
          </Guard>

          <Guard when={can.update}>
            <GlassBtn className={`h-10 ${customerId ? tintSlate : tintGlass} w-full`} onClick={rebuild} disabled={!customerId} title="Rebuild from invoices">
              <span className="inline-flex items-center justify-center gap-2">
                <ArrowPathIcon className="w-5 h-5" />
                Rebuild
              </span>
            </GlassBtn>
          </Guard>

          <Guard when={can.update}>
            <GlassBtn className={`h-10 ${customerId ? tintGreen : tintGlass} w-full`} onClick={openSaveModal} disabled={!customerId} title="Save (Alt+S)">
              <span className="inline-flex items-center justify-center gap-2">
                <ArrowDownOnSquareIcon className="w-5 h-5" />
                Save (Alt+S)
              </span>
            </GlassBtn>
          </Guard>
        </GlassToolbar>
      </GlassCard>

      {/* ===== Summary ===== */}
      {customerId && (
        <GlassCard>
          <div className="px-4 py-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <Stat label="Total Invoiced" value={fmt(summary.total_invoiced)} />
            <Stat label="Received on Invoice" value={fmt(summary.received_on_invoice)} />
            <Stat label="Payments (Credited)" value={fmt(summary.payments_credited)} />
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
                <th className="px-3 py-2 font-medium text-right">Invoice Total</th>
                <th className="px-3 py-2 font-medium text-right">Received on Invoice</th>
                <th className="px-3 py-2 font-medium text-right">Payment (Credit)</th>
                <th className="px-3 py-2 font-medium">Payment Ref</th>
                <th className="px-3 py-2 font-medium text-right">Balance Remaining</th>
                <th className="px-3 py-2 font-medium text-right">Running Balance</th>
                <th className="px-3 py-2 font-medium">Description</th>
                <th className="px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>

            <tbody>
              {!customerId && (
                <tr>
                  <td colSpan={11} className="px-3 py-10 text-center text-gray-600">
                    Select a customer to view ledger.
                  </td>
                </tr>
              )}

              {customerId && derivedRows.map((r) => {
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
                        value={getInput(r, "total_received")}
                        onChange={(e) => setInput(r.__i, "total_received", e.target.value)}
                        onBlur={() => commitNumber(r.__i, "total_received")}
                        disabled={isInvoice}
                        title={isInvoice ? "Synced from invoice" : "Editable"}
                        className="w-full text-right"
                      />
                    </td>

                    <td className="px-3 py-2 text-right">
                      <GlassInput
                        type="text" inputMode="decimal"
                        value={getInput(r, "credited_amount")}
                        onChange={(e) => setInput(r.__i, "credited_amount", e.target.value)}
                        onBlur={() => commitNumber(r.__i, "credited_amount")}
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

                    <td className="px-3 py-2 text-right">
                      {fmt(["invoice", "manual"].includes(r.entry_type)
                        ? Number(((r.invoice_total || 0) - (r.total_received || 0)).toFixed(2))
                        : 0)}
                    </td>

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

              {customerId && !rows.length && (
                <tr>
                  <td colSpan={11} className="px-3 py-10 text-center text-gray-600">
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
                  A new <b>{addModal.type}</b> row will be appended for the selected customer.
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
                  <b>{updCount}</b> existing {updCount === 1 ? "row" : "rows"} for this customer.
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
          input, button, select, [role="button"] { display: none !important; }
          table { font-size: 11px; }
          thead { position: sticky; top: 0; }
        }
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
