// src/pages/sale-invoices/index.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import {
  MagnifyingGlassIcon,
  PlusCircleIcon,
  PencilSquareIcon,
  EyeIcon,
  PrinterIcon,
  TrashIcon,
  ArrowPathIcon,
  ShieldExclamationIcon,
  XMarkIcon,
} from "@heroicons/react/24/solid";
// 🔒 permissions
import { usePermissions, Guard } from "@/api/usePermissions.js";

// 🧊 glass primitives (same as Products page)
import {
  GlassCard,
  GlassSectionHeader,
  GlassToolbar,
  GlassInput,
  GlassBtn,
} from "@/components/glass.jsx";

export default function SaleInvoicesIndex() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  // search + pagination (client-side, same behavior)
  const [qPosted, setQPosted] = useState("");
  const [qCustomer, setQCustomer] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const navigate = useNavigate();

  // 🔒 permissions
  const { loading: permsLoading, canFor } = usePermissions();
  const can = useMemo(
    () =>
      (typeof canFor === "function" ? canFor("sale-invoice") : {
        view:false, create:false, update:false, delete:false, import:false, export:false
      }),
    [canFor]
  );

// 🧊 iOS-style tinted glass palette (same tokens as Products)
  const tintBlue   = "bg-blue-500/85 text-white shadow-[0_6px_20px_-6px_rgba(37,99,235,0.45)] ring-1 ring-white/20 hover:bg-blue-500/95";
  const tintIndigo = "bg-indigo-500/85 text-white shadow-[0_6px_20px_-6px_rgba(99,102,241,0.45)] ring-1 ring-white/20 hover:bg-indigo-500/95";
  const tintSlate  = "bg-slate-900/80 text-white shadow-[0_6px_20px_-6px_rgba(15,23,42,0.45)] ring-1 ring-white/15 hover:bg-slate-900/90";
  const tintAmber  = "bg-amber-500/85 text-white shadow-[0_6px_20px_-6px_rgba(245,158,11,0.45)] ring-1 ring-white/20 hover:bg-amber-500/95";
  const tintRed    = "bg-rose-500/85 text-white shadow-[0_6px_20px_-6px_rgba(244,63,94,0.45)] ring-1 ring-white/20 hover:bg-rose-500/95";
  const tintGreenGlass  = "bg-green-600/85 text-white shadow-[0_6px_20px_-6px_rgba(22,163,74,0.45)] ring-1 ring-white/20 hover:bg-green-600/95";
  const tintGlass  = "bg-white/60 text-slate-700 ring-1 ring-white/30 hover:bg-white/75";

  // Fetch (kept same endpoint/shape)
  const fetchInvoices = async () => {
    if (permsLoading || !can.view) { setInvoices([]); setLoading(false); return; }
    try {
      setLoading(true);
      const res = await axios.get("/api/sale-invoices"); // returns customer relation + totals
      setInvoices(res.data || []);
    } catch (e) {
      const status = e?.response?.status;
      if (status === 403) toast.error("You don't have permission to view sale invoices.");
      else toast.error("Failed to fetch sale invoices");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchInvoices(); }, [permsLoading, can.view]);

  // Alt+N -> create (same UX as Products)
  useEffect(() => {
    const onKeyDown = (e) => {
      if (!e.altKey) return;
      if ((e.key || "").toLowerCase() !== "n") return;
      const tag = (e.target?.tagName || "").toLowerCase();
      const typing = ["input", "textarea", "select"].includes(tag) || e.target?.isContentEditable;
      if (typing) return;
      if (!can.create) return;
      e.preventDefault();
      navigate("/sale-invoices/create");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navigate, can.create]);

  // ===== secure delete modal state & handlers (logic unchanged) =====
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteStep, setDeleteStep] = useState(1); // 1 confirm -> 2 choose action (if needed) -> 3 password
  const [deletingId, setDeletingId] = useState(null);
  const [password, setPassword] = useState("");
  const [deleting, setDeleting] = useState(false);

  const selectedInvoice = useMemo(
    () => invoices.find((i) => i.id === deletingId) || null,
    [invoices, deletingId]
  );
  const invTotal = Number(selectedInvoice?.total ?? 0);
  const invReceived = Number(
    selectedInvoice?.total_receive ??
      selectedInvoice?.total_recieve ?? 0
  );
  const invRemaining = Math.max(invTotal - invReceived, 0);

  const [deleteMode, setDeleteMode] = useState("none"); // 'credit' | 'refund' | 'none'
  // Only show Credit/Refund dialog for credit invoices with received amount > 0
  // Debit invoices skip this step and go directly to password confirmation
  const needsChoice = !!selectedInvoice && selectedInvoice.invoice_type === 'credit' && invReceived > 0;

  const openDeleteModal = (id) => {
    if (!can.delete) return toast.error("You don't have permission to delete sale invoices.");
    setDeletingId(id);
    setPassword("");
    setDeleteMode("none");
    setDeleteStep(1);
    setDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    if (deleting) return;
    setDeleteModalOpen(false);
    setDeleteStep(1);
    setDeletingId(null);
    setPassword("");
    setDeleteMode("none");
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
    if (!deletingId) return;
    if (!can.delete) return toast.error("You don't have permission to delete sale invoices.");
    try {
      setDeleting(true);
      await axios.post("/api/auth/confirm-password", { password });
      await axios.delete(`/api/sale-invoices/${deletingId}`, {
        params: { mode: deleteMode }, // 'credit' | 'refund' | 'none'
      });
      toast.success("Sale invoice deleted");
      setInvoices((prev) => prev.filter((i) => i.id !== deletingId));
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

  // Print popup logic (same as Show page)
  const handlePrint = (id) => {
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

    const w = window.open(url, "salePrintWin", features);
    if (!w) {
      toast.error("Popup blocked. Please allow popups to print.");
      return;
    }

    try { w.opener = null; } catch {}

    w.onload = () => {
      try { w.focus(); w.print(); } catch {}
    };

    const timer = setInterval(() => {
      try {
        if (w.document?.readyState === "complete") {
          w.focus(); w.print(); clearInterval(timer);
        }
      } catch {}
      if (w.closed) clearInterval(timer);
    }, 400);
  };

  // ===== search + pagination (client-side; behavior unchanged) =====
  const norm = (v) => (v ?? "").toString().toLowerCase().trim();
  const filtered = useMemo(() => {
    const nPosted = norm(qPosted);
    const nCust = norm(qCustomer);
    return invoices.filter((inv) => {
      const posted = norm(inv.posted_number);
      const customer = norm(inv.customer?.name);
      return posted.includes(nPosted) && customer.includes(nCust);
    });
  }, [invoices, qPosted, qCustomer]);

  useEffect(() => { setPage(1); }, [qPosted, qCustomer, pageSize]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);

  const start = (page - 1) * pageSize;
  const paged = filtered.slice(start, start + pageSize);

  // 🔒 perms gates identical to Products page flow
  if (permsLoading) return <div className="p-6">Loading…</div>;
  if (!can.view) return <div className="p-6 text-sm text-gray-700">You don’t have permission to view sale invoices.</div>;

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* ===== Header (glassy, single-column layout) ===== */}
      <GlassCard>
        <GlassSectionHeader
          title={<span className="inline-flex items-center gap-2">
            {/* Using ArrowPath as a small brand accent same as products page */}
            <span className="inline-flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-600" />
              <span>Sale Invoices</span>
            </span>
          </span>}
          right={
            <div className="flex items-center gap-2">
              <GlassBtn
                className={`h-10 min-w-[120px] ${tintSlate}`}
                onClick={fetchInvoices}
                title="Refresh"
                aria-label="Refresh sale invoices"
              >
                <span className="inline-flex items-center gap-2">
                  <ArrowPathIcon className="w-5 h-5" />
                  Refresh
                </span>
              </GlassBtn>

              <Guard when={can.create}>
                <Link
                  to="/sale-invoices/create"
                  title="Add Sale Invoice (Alt+N)"
                  aria-keyshortcuts="Alt+N"
                  className={`h-10 min-w-[170px] inline-flex items-center justify-center gap-2 rounded-xl px-3 ${tintBlue}`}
                >
                  <PlusCircleIcon className="w-5 h-5" />
                  Add Sale Invoice
                </Link>
              </Guard>
            </div>
          }
        />

        {/* Search toolbar (glassy inputs) */}
        <GlassToolbar className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <TextSearch value={qPosted} onChange={setQPosted} placeholder="Search by Posted No (e.g., SI-000001)…" />
          <TextSearch value={qCustomer} onChange={setQCustomer} placeholder="Search by Customer…" />

          <div className="md:col-span-2 flex items-center justify-between gap-3">
            <div className="text-sm text-gray-700">
              {loading ? "Loading…" : (
                <>Showing <strong>{filtered.length === 0 ? 0 : start + 1}-{Math.min(filtered.length, start + pageSize)}</strong> of <strong>{invoices.length}</strong>{filtered.length !== invoices.length && <> (filtered: <strong>{filtered.length}</strong>)</>}</>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div className="ml-2 flex items-center gap-2">
                <label className="text-sm text-gray-700">Rows per page</label>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="h-9 px-2 rounded-xl bg-white/70 backdrop-blur-sm border border-gray-200/70 ring-1 ring-transparent focus:ring-blue-400/40 shadow-sm text-sm"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>
          </div>
        </GlassToolbar>
      </GlassCard>

      {/* ===== Table card (glassy, sticky header) ===== */}
      <GlassCard>
        <div className="max-h-[70vh] overflow-auto rounded-b-2xl">
          <table className="w-full text-sm text-gray-900 dark:text-gray-100">
            <thead className="sticky top-0 bg-white/90 dark:bg-slate-700/90 backdrop-blur-sm z-10 border-b border-gray-200/70 dark:border-slate-600/70">
              <tr className="text-left">
                <th className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100">#</th>
                <th className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100">Posted No</th>
                <th className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100">Customer</th>
                <th className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100">Date</th>
                <th className="px-3 py-2 font-medium text-right text-gray-900 dark:text-gray-100">Total</th>
                <th className="px-3 py-2 font-medium text-center text-gray-900 dark:text-gray-100">Actions</th>
              </tr>
            </thead>

            <tbody>
              {(!loading && filtered.length === 0) && (
                <tr>
                  <td className="px-3 py-10 text-center text-gray-600 dark:text-gray-400" colSpan={6}>
                    No sale invoices found.
                  </td>
                </tr>
              )}

              {paged.map((invoice, idx) => (
                <tr
                  key={invoice.id}
                  className={`transition-colors odd:bg-white/90 even:bg-white/70 hover:bg-blue-50 dark:odd:bg-slate-700/60 dark:even:bg-slate-800/60 dark:hover:bg-slate-600/70`}
                >
                  <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{start + idx + 1}</td>
                  <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{invoice.posted_number || "-"}</td>
                  <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{invoice.customer?.name ?? "N/A"}</td>
                  <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{invoice.date}</td>
                  <td className="px-3 py-2 text-right text-gray-900 dark:text-gray-100">{Number(invoice.total ?? 0).toLocaleString()}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-2 justify-center">
                      <Guard when={can.update}>
                        <Link
                          to={`/sale-invoices/${invoice.id}/edit`}
                          className={`h-9 min-w-[100px] inline-flex items-center justify-center gap-1 rounded-xl px-3 ${tintAmber}`}
                          title="Edit"
                        >
                          <PencilSquareIcon className="w-5 h-5" />
                          Edit
                        </Link>
                      </Guard>

<Link
                        to={`/sale-invoices/${invoice.id}`}
                        className={`h-9 min-w-[100px] inline-flex items-center justify-center gap-1 rounded-xl px-3 ${tintIndigo}`}
                        title="View"
                      >
                        <EyeIcon className="w-5 h-5" />
                        View
                      </Link>

                      <button
                        onClick={() => handlePrint(invoice.id)}
                        className={`h-9 min-w-[100px] inline-flex items-center justify-center gap-1 rounded-xl px-3 ${tintGreenGlass}`}
                        title="Print"
                      >
                        <PrinterIcon className="w-5 h-5" />
                        Print
                      </button>

                      <Guard when={can.delete}>
                        <GlassBtn
                          onClick={() => openDeleteModal(invoice.id)}
                          title="Delete"
                          className={`h-9 min-w-[100px] ${tintRed}`}
                        >
                          <span className="inline-flex items-center gap-1">
                            <TrashIcon className="w-5 h-5" />
                            Delete
                          </span>
                        </GlassBtn>
                      </Guard>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination (glassy buttons) */}
        <div className="px-3 py-3 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="text-sm text-gray-700">Page {page} of {pageCount}</div>
          <div className="flex items-center gap-2">
            <GlassBtn onClick={() => setPage(1)} disabled={page === 1} className={`h-9 px-3 ${tintGlass}`}>
              ⏮ First
            </GlassBtn>
            <GlassBtn onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className={`h-9 px-3 ${tintGlass}`}>
              ◀ Prev
            </GlassBtn>
            <GlassBtn onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={page === pageCount} className={`h-9 px-3 ${tintGlass}`}>
              Next ▶
            </GlassBtn>
            <GlassBtn onClick={() => setPage(pageCount)} disabled={page === pageCount} className={`h-9 px-3 ${tintGlass}`}>
              Last ⏭
            </GlassBtn>
          </div>
        </div>
      </GlassCard>

      {/* ===== Delete confirmation / choice / password modal (glassy) ===== */}
      {deleteModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeDeleteModal();
          }}
        >
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative w-full max-w-md">
            <GlassCard>
              <GlassSectionHeader
                title={<span className="inline-flex items-center gap-2">
                  <ShieldExclamationIcon className="w-5 h-5 text-rose-600" />
                  <span>Delete sale invoice</span>
                </span>}
                right={
                  <GlassBtn className={`h-8 px-3 ${tintGlass}`} onClick={closeDeleteModal} title="Close">
                    <XMarkIcon className="w-5 h-5" />
                  </GlassBtn>
                }
              />

              <div className="px-4 py-4 space-y-4">
                {/* Step 1: Confirm delete */}
                {deleteStep === 1 && (
                  <>
                    <div className="text-xs text-gray-600 mb-1">
                      {selectedInvoice && (
                        <div className="space-y-0.5">
                          <div><b>Posted #:</b> {selectedInvoice.posted_number}</div>
                          <div><b>Total:</b> {invTotal.toLocaleString()}</div>
                          <div><b>Received:</b> {invReceived.toLocaleString()}</div>
                          <div><b>Remaining:</b> {invRemaining.toLocaleString()}</div>
                        </div>
                      )}
                    </div>
                    <p className="text-sm text-gray-700">
                      This action cannot be undone.
                    </p>
                    <div className="flex justify-end gap-2 pt-2">
                      <GlassBtn className={`min-w-[100px] ${tintGlass}`} onClick={closeDeleteModal}>
                        Cancel
                      </GlassBtn>
                      <GlassBtn className={`min-w-[140px] ${tintRed}`} onClick={proceedAfterConfirm}>
                        Yes, continue
                      </GlassBtn>
                    </div>
                  </>
                )}

                {/* Step 2: Choose Credit or Refund (only when needed) */}
                {deleteStep === 2 && (
                  <>
                    <h3 className="font-medium text-sm">Credit or Refund?</h3>
                    <p className="text-sm text-gray-600">
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

                    <div className="flex justify-between pt-2">
                      <GlassBtn className={`min-w-[90px] ${tintGlass}`} onClick={() => setDeleteStep(1)}>
                        ← Back
                      </GlassBtn>
                      <GlassBtn className={`min-w-[120px] ${tintBlue}`} onClick={proceedToPassword}>
                        Continue
                      </GlassBtn>
                    </div>
                  </>
                )}

                {/* Step 3: Password confirm */}
                {deleteStep === 3 && (
                  <>
                    <p className="text-sm text-gray-700">
                      For security, please re-enter your password to delete this sale invoice.
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
                    <div className="flex justify-between pt-2">
                      <GlassBtn
                        className={`min-w-[90px] ${tintGlass}`}
                        onClick={() => setDeleteStep(needsChoice ? 2 : 1)}
                        disabled={deleting}
                      >
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
    </div>
  );
}

function TextSearch({ value, onChange, placeholder }) {
  return (
    <div className="relative">
      <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
      <GlassInput
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-10 w-full"
      />
    </div>
  );
}
