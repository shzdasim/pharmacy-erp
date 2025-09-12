// resources/js/pages/CustomerLedgerPage.jsx
import React, { useEffect, useMemo, useState, useRef } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { usePermissions, Guard } from "@/api/usePermissions.js";

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
        <input
          ref={inputRef}
          className="border rounded px-2 py-1 text-xs w-full"
          placeholder="Search customer by name/phone/email…"
          value={term}
          onFocus={onFocus}
          onChange={(e) => onType(e.target.value)}
        />
        {value ? (
          <button type="button" className="border rounded px-2 py-1 text-xs" onClick={clear}>
            Clear
          </button>
        ) : (
          <button
            type="button"
            className="border rounded px-2 py-1 text-xs"
            onClick={() => (open ? setOpen(false) : onFocus())}
          >
            {open ? "Close" : "Search"}
          </button>
        )}
      </div>

      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white border rounded shadow max-h-80 overflow-auto">
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
              <button
                type="button"
                className="w-full border rounded px-3 py-1 text-xs hover:bg-gray-50"
                onClick={() => fetchPage(page + 1, term.trim())}
                disabled={loading}
              >
                {loading ? "Loading..." : "Load more"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* =========================
   Customer Ledger Page (permission-aware)
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

  // hotkeys (guarded)
  useEffect(() => {
    const onKey = (e) => {
      if (e.altKey && (e.key || "").toLowerCase() === "s") {
        e.preventDefault();
        if (!can.create && !can.update) return;
        openSaveModal();
      }
      if (e.altKey && (e.key || "").toLowerCase() === "p") {
        e.preventDefault();
        if (!can.view) return;
        handlePrint();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rows, customerId, from, to, can.create, can.update, can.view]);

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
  const getInput = (row, field) => {
    if (row[`${field}_input`] !== undefined) return row[`${field}_input`];
    const v = row[field];
    if (v === undefined || v === null) return "";
    return String(v);
  };
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
      const parsed =
        raw === undefined || String(raw).trim() === ""
          ? 0
          : parseFloat(String(raw).replace(/,/g, ""));
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
      if (
        ["invoice", "manual"].includes(r.entry_type) &&
        (field === "invoice_total" || field === "total_received")
      ) {
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

    if (news.length && !can.create) {
      return toast.error("You don't have permission to create ledger rows.");
    }
    if (updates.length && !can.update) {
      return toast.error("You don't have permission to update ledger rows.");
    }

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

  // ---------- sort rows for display ----------
  const sortedRows = useMemo(() => {
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
    return indexed.map(({ r, i }) => ({ ...r, __i: i }));
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
  if (permsLoading) return <div className="p-3 text-sm">Loading…</div>;
  if (!can.view) return <div className="p-3 text-sm text-gray-700">You don’t have permission to view customer ledger.</div>;

  return (
    <div className="p-3 space-y-2 text-xs">
      <h2 className="text-base font-semibold">Customer Ledger</h2>

      <div className="flex gap-2 items-end flex-wrap">
        <div className="flex flex-col min-w-[240px]">
          <label className="text-[11px] text-gray-600">Customer *</label>
          <CustomerSearchInput value={customerId} onChange={(id) => setCustomerId(id)} autoFocus />
        </div>
        <div className="flex flex-col">
          <label className="text-[11px] text-gray-600">From</label>
          <input
            type="date"
            className="border rounded px-2 py-1 text-xs"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div className="flex flex-col">
          <label className="text-[11px] text-gray-600">To</label>
          <input
            type="date"
            className="border rounded px-2 py-1 text-xs"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
        <button
          className="bg-blue-600 text-white rounded px-3 py-1 text-xs"
          onClick={fetchData}
          disabled={!customerId}
        >
          Load
        </button>

        <div className="flex-1" />

        <Guard when={can.create}>
          <button className="border rounded px-2 py-1 text-xs" onClick={openAddPayment} disabled={!customerId}>
            + Payment
          </button>
          <button className="border rounded px-2 py-1 text-xs" onClick={openAddManual} disabled={!customerId}>
            + Manual
          </button>
        </Guard>
        <Guard when={can.update}>
          <button className="border rounded px-2 py-1 text-xs" onClick={rebuild} disabled={!customerId}>
            Rebuild
          </button>
          <button
            className="bg-green-600 text-white rounded px-3 py-1 text-xs"
            onClick={openSaveModal}
            title="Alt+S"
            disabled={!customerId}
          >
            Save (Alt+S)
          </button>
        </Guard>
        <button
          className="border bg-orange-400 text-white rounded px-2 py-1 text-xs"
          onClick={() => handlePrint()}
          disabled={!customerId}
          title="Print (Alt+P)"
        >
          Print <span className="ml-1 text-[10px] opacity-70">(Alt+P)</span>
        </button>
      </div>

      {customerId && (
        <div className="border rounded p-2 bg-gray-50 flex gap-5">
          <div>
            <span className="text-gray-600">Total Invoiced:</span>{" "}
            <b>{fmt(summary.total_invoiced)}</b>
          </div>
          <div>
            <span className="text-gray-600">Received on Invoice:</span>{" "}
            <b>{fmt(summary.received_on_invoice)}</b>
          </div>
          <div>
            <span className="text-gray-600">Received Payments:</span>{" "}
            <b>{fmt(summary.payments_credited)}</b>
          </div>
          <div>
            <span className="text-gray-600">Net Balance:</span>{" "}
            <b>{fmt(summary.net_balance)}</b>
          </div>
        </div>
      )}

      <div className="overflow-auto">
        <table className="min-w-[1000px] w-full border border-gray-200 text-xs">
          <thead className="bg-gray-100">
            <tr>
              <th className="border px-1 py-1 text-left">Date</th>
              <th className="border px-1 py-1 text-left">Type</th>
              <th className="border px-1 py-1 text-left">Posted #</th>
              <th className="border px-1 py-1 text-right">Invoice Total</th>
              <th className="border px-1 py-1 text-right">Received on Invoice</th>
              <th className="border px-1 py-1 text-right">Received Payment</th>
              <th className="border px-1 py-1 text-left">Payment Ref</th>
              <th className="border px-1 py-1 text-right">Balance Remaining</th>
              <th className="border px-1 py-1 text-left">Description</th>
              <th className="border px-1 py-1 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {!customerId && (
              <tr>
                <td colSpan={10} className="text-center text-gray-500 py-4">
                  Select a customer to view ledger.
                </td>
              </tr>
            )}

            {customerId &&
              sortedRows.map((r) => {
                const isInvoice = r.entry_type === "invoice";
                const isPayment = r.entry_type === "payment";
                return (
                  <tr key={r.id ?? `new-${r.__i}`} className="align-top">
                    <td className="border px-1 py-1">
                      <input
                        type="date"
                        className="w-full outline-none px-1 py-0.5 text-xs"
                        value={(r.entry_date || "").slice(0, 10)}
                        onChange={(e) => handleField(r.__i, "entry_date", e.target.value)}
                      />
                    </td>

                    <td className="border px-1 py-1">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] ${
                          isInvoice
                            ? "bg-blue-100 text-blue-700"
                            : isPayment
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {r.entry_type?.toUpperCase()}
                      </span>
                    </td>

                    <td className="border px-1 py-1">
                      <input
                        type="text"
                        className="w-full px-1 py-0.5"
                        value={r.posted_number ?? ""}
                        onChange={(e) => handleField(r.__i, "posted_number", e.target.value)}
                        disabled={isInvoice}
                        title={isInvoice ? "Synced from invoice" : "Editable"}
                      />
                    </td>

                    <td className="border px-1 py-1 text-right">
                      <input
                        type="text"
                        inputMode="decimal"
                        className="w-full text-right px-1 py-0.5"
                        value={getInput(r, "invoice_total")}
                        onChange={(e) => setInput(r.__i, "invoice_total", e.target.value)}
                        onBlur={() => commitNumber(r.__i, "invoice_total")}
                        disabled={isInvoice}
                        title={isInvoice ? "Synced from invoice" : "Editable"}
                      />
                    </td>

                    <td className="border px-1 py-1 text-right">
                      <input
                        type="text"
                        inputMode="decimal"
                        className="w-full text-right px-1 py-0.5"
                        value={getInput(r, "total_received")}
                        onChange={(e) => setInput(r.__i, "total_received", e.target.value)}
                        onBlur={() => commitNumber(r.__i, "total_received")}
                        disabled={isInvoice}
                        title={isInvoice ? "Synced from invoice" : "Editable"}
                      />
                    </td>

                    <td className="border px-1 py-1 text-right">
                      <input
                        type="text"
                        inputMode="decimal"
                        className="w-full text-right px-1 py-0.5"
                        value={getInput(r, "credited_amount")}
                        onChange={(e) => setInput(r.__i, "credited_amount", e.target.value)}
                        onBlur={() => commitNumber(r.__i, "credited_amount")}
                        disabled={!isPayment && !r.is_manual}
                        title={isPayment ? "Payment amount" : r.is_manual ? "Editable" : "Not a payment row"}
                      />
                    </td>

                    <td className="border px-1 py-1">
                      {isPayment || r.is_manual ? (
                        <input
                          type="text"
                          className="w-full px-1 py-0.5"
                          value={r.payment_ref ?? ""}
                          onChange={(e) => handleField(r.__i, "payment_ref", e.target.value)}
                        />
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>

                    <td className="border px-1 py-1 text-right">
                      {fmt(
                        ["invoice", "manual"].includes(r.entry_type)
                          ? Number(((r.invoice_total || 0) - (r.total_received || 0)).toFixed(2))
                          : 0
                      )}
                    </td>

                    <td className="border px-1 py-1">
                      <input
                        type="text"
                        className="w-full px-1 py-0.5"
                        value={r.description ?? ""}
                        onChange={(e) => handleField(r.__i, "description", e.target.value)}
                      />
                    </td>

                    <td className="border px-1 py-1">
                      <Guard when={can.delete}>
                        <button className="text-red-600 hover:underline" onClick={() => openDeleteModal(r.__i)}>
                          Delete
                        </button>
                      </Guard>
                    </td>
                  </tr>
                );
              })}

            {customerId && !rows.length && (
              <tr>
                <td colSpan={10} className="text-center text-gray-500 py-4">
                  No entries. Click “Rebuild” or add a payment.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ========== MODALS (unchanged structure, guarded by can.* where invoked) ========== */}

      {addModal.open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeAddModal();
          }}
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5">
            <h2 className="text-lg font-semibold mb-2">
              {addModal.type === "payment" ? "Add Payment row?" : "Add Manual row?"}
            </h2>
            <p className="text-sm text-gray-600">
              A new {addModal.type} row will be appended for the selected customer.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button className="px-3 py-1 rounded border" onClick={closeAddModal}>
                Cancel
              </button>
              <button className="px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700" onClick={confirmAdd}>
                Add row
              </button>
            </div>
          </div>
        </div>
      )}

      {saveModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeSaveModal();
          }}
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-5">
            <h2 className="text-lg font-semibold mb-2">Save changes?</h2>
            <p className="text-sm text-gray-600">
              You’re about to save <b>{newCount}</b> new {newCount === 1 ? "row" : "rows"} and update{" "}
              <b>{updCount}</b> existing {updCount === 1 ? "row" : "rows"} for this customer.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button className="px-3 py-1 rounded border" onClick={closeSaveModal}>
                Cancel
              </button>
              <button className="px-3 py-1 rounded bg-green-600 text-white hover:bg-green-700" onClick={confirmSave}>
                Yes, Save
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeDeleteModal();
          }}
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-5">
            {deleteStep === 1 && (
              <div>
                <h2 className="text-lg font-semibold mb-2">Delete ledger row?</h2>
                <p className="text-sm text-gray-600">
                  Are you sure you want to delete this row? This action cannot be undone.
                </p>
                <div className="mt-4 flex justify-end gap-2">
                  <button className="px-3 py-1 rounded border" onClick={closeDeleteModal}>
                    Cancel
                  </button>
                  <button
                    className="px-3 py-1 rounded bg-red-600 text-white hover:bg-red-700"
                    onClick={proceedDeletePassword}
                  >
                    Yes, continue
                  </button>
                </div>
              </div>
            )}

            {deleteStep === 2 && (
              <div>
                <h2 className="text-lg font-semibold mb-2">Confirm with password</h2>
                <p className="text-sm text-gray-600">For security, please re-enter your password to delete this row.</p>
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
    </div>
  );
}
