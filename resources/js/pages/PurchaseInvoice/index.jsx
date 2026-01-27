// src/pages/purchase-invoices/index.jsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  PlusCircleIcon,
  PencilSquareIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  ArrowPathIcon,
  ShieldExclamationIcon,
  ClipboardDocumentListIcon,
} from "@heroicons/react/24/solid";
import { usePermissions, Guard } from "@/api/usePermissions.js";

// 🧊 glass primitives (same as Products)
import {
  GlassCard,
  GlassSectionHeader,
  GlassToolbar,
  GlassInput,
  GlassBtn,
} from "@/components/glass.jsx";

export default function PurchaseInvoicesIndex() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  // search filters
  const [qPosted, setQPosted] = useState("");
  const [qSupplier, setQSupplier] = useState("");

  // pagination (server-side)
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);

  const navigate = useNavigate();

  // AbortController for fetches
  const controllerRef = useRef(null);
  const debounceRef = useRef(null);

  // 🔒 permissions
  const { loading: permsLoading, canFor } = usePermissions();
  const can = useMemo(
    () =>
      (typeof canFor === "function"
        ? canFor("purchase-invoice")
        : { view: false, create: false, update: false, delete: false, import: false, export: false }),
    [canFor]
  );

  // 🧊 tints (kept identical to Products for consistency)
  const tintBlue   = "bg-blue-500/85 text-white shadow-[0_6px_20px_-6px_rgba(37,99,235,0.45)] ring-1 ring-white/20 hover:bg-blue-500/95";
  const tintIndigo = "bg-indigo-500/85 text-white shadow-[0_6px_20px_-6px_rgba(99,102,241,0.45)] ring-1 ring-white/20 hover:bg-indigo-500/95";
  const tintSlate  = "bg-slate-900/80 text-white shadow-[0_6px_20px_-6px_rgba(15,23,42,0.45)] ring-1 ring-white/15 hover:bg-slate-900/90";
  const tintAmber  = "bg-amber-500/85 text-white shadow-[0_6px_20px_-6px_rgba(245,158,11,0.45)] ring-1 ring-white/20 hover:bg-amber-500/95";
  const tintRed    = "bg-rose-500/85 text-white shadow-[0_6px_20px_-6px_rgba(244,63,94,0.45)] ring-1 ring-white/20 hover:bg-rose-500/95";
  const tintGlass  = "bg-white/60 text-slate-700 ring-1 ring-white/30 hover:bg-white/75";

  useEffect(() => {
    document.title = "Purchase Invoices - Pharmacy ERP";
  }, []);

  // Alt+N => /purchase-invoices/create (only when can.create)
  useEffect(() => {
    const onKeyDown = (e) => {
      if (!e.altKey) return;
      const key = (e.key || "").toLowerCase();
      if (key !== "n") return;
      const tag = (e.target?.tagName || "").toLowerCase();
      const isTyping = ["input", "textarea", "select"].includes(tag) || e.target?.isContentEditable;
      if (isTyping) return;
      if (!can.create) return;
      e.preventDefault();
      navigate("/purchase-invoices/create");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navigate, can.create]);

// stable fetcher — does not directly depend on qPosted/qSupplier
const fetchInvoices = useCallback(async (signal, options = {}) => {
  const {
    pageArg = page,
    pageSizeArg = pageSize,
    qPostedArg = qPosted,
    qSupplierArg = qSupplier,
  } = options;

  try {
    setLoading(true);
    const { data } = await axios.get("/api/purchase-invoices", {
      params: {
        page: pageArg,
        per_page: pageSizeArg,
        posted: qPostedArg.trim(),
        supplier: qSupplierArg.trim(),
      },
      signal,
    });

    const items = Array.isArray(data?.data)
      ? data.data
      : Array.isArray(data)
      ? data
      : [];
    setRows(items);
    setTotal(Number(data?.total ?? items.length ?? 0));
    const lp = Number(data?.last_page ?? 1);
    setLastPage(lp);
    if (pageArg > lp) setPage(lp || 1);
  } catch (err) {
    if (axios.isCancel?.(err)) return;
    const status = err?.response?.status;
    if (status === 403)
      toast.error("You don't have permission to view purchase invoices.");
    else toast.error("Failed to load purchase invoices");
  } finally {
    setLoading(false);
  }
}, [page, pageSize, qPosted, qSupplier]);


// Fetch on page or pageSize change
useEffect(() => {
  if (permsLoading || !can.view) return;
  const ctrl = new AbortController();
  controllerRef.current = ctrl;
  fetchInvoices(ctrl.signal);
  return () => ctrl.abort();
}, [page, pageSize, permsLoading, can.view]);

// Debounce on filter change only
useEffect(() => {
  if (permsLoading || !can.view) return;
  if (debounceRef.current) clearTimeout(debounceRef.current);
  const ctrl = new AbortController();
  debounceRef.current = setTimeout(() => {
    setPage(1);
    controllerRef.current = ctrl;
    fetchInvoices(ctrl.signal, {
      pageArg: 1,
      qPostedArg: qPosted,
      qSupplierArg: qSupplier,
    });
  }, 300);
  return () => {
    clearTimeout(debounceRef.current);
    ctrl.abort();
  };
}, [qPosted, qSupplier, permsLoading, can.view]);


  const start = rows.length ? (page - 1) * pageSize + 1 : 0;
  const end   = rows.length ? start + rows.length - 1 : 0;

  // ===== secure delete modal state & handlers =====
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteStep, setDeleteStep] = useState(1); // 1 = confirm, 2 = password
  const [deletingInvoice, setDeletingInvoice] = useState(null); // { id, posted_number }
  const [password, setPassword] = useState("");
  const [deleting, setDeleting] = useState(false);

  const openDeleteModal = (inv) => {
    if (!can.delete) return toast.error("You don't have permission to delete invoices.");
    // (Optional rule) prevent delete if already posted/settled; uncomment if your API enforces:
    // if (inv.status === "posted" || inv.settled) return toast.error("Cannot delete a posted/settled invoice.");
    setDeletingInvoice({ id: inv.id, posted_number: inv.posted_number });
    setPassword("");
    setDeleteStep(1);
    setDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    if (deleting) return;
    setDeleteModalOpen(false);
    setDeleteStep(1);
    setDeletingInvoice(null);
    setPassword("");
  };

  const proceedToPassword = () => setDeleteStep(2);

  const confirmAndDelete = async () => {
    if (!deletingInvoice?.id) return;
    if (!can.delete) return toast.error("You don't have permission to delete invoices.");
    try {
      setDeleting(true);
      await axios.post("/api/auth/confirm-password", { password });
      await axios.delete(`/api/purchase-invoices/${deletingInvoice.id}`);
      toast.success("Invoice deleted");
      closeDeleteModal();

      if (controllerRef.current) controllerRef.current.abort();
      const ctrl = new AbortController();
      controllerRef.current = ctrl;
      fetchInvoices(ctrl.signal);
    } catch (err) {
      const status = err?.response?.status;
      const apiMsg =
        err?.response?.data?.message ||
        (status === 422 ? "Incorrect password" : status === 403 ? "You don't have permission to delete invoices." : "Delete failed");
      toast.error(apiMsg);
    } finally {
      setDeleting(false);
    }
  };

  if (permsLoading) return <div className="p-6">Loading…</div>;
  if (!can.view) return <div className="p-6 text-sm text-gray-700">You don’t have permission to view purchase invoices.</div>;

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* ===== Header ===== */}
      <GlassCard>
        <GlassSectionHeader
          title={
            <span className="inline-flex items-center gap-2">
              <ClipboardDocumentListIcon className="w-5 h-5 text-blue-600" />
              <span>Purchase Invoices</span>
            </span>
          }
          right={
            <div className="flex items-center gap-2">
              <GlassBtn
                className={`h-10 min-w-[120px] ${tintSlate}`}
                onClick={() => {
                  if (controllerRef.current) controllerRef.current.abort();
                  const ctrl = new AbortController();
                  controllerRef.current = ctrl;
                  fetchInvoices(ctrl.signal);
                }}
                title="Refresh"
                aria-label="Refresh invoices"
              >
                <span className="inline-flex items-center gap-2">
                  <ArrowPathIcon className="w-5 h-5" />
                  Refresh
                </span>
              </GlassBtn>

              <Guard when={can.create}>
                <Link
                  to="/purchase-invoices/create"
                  title="Add Invoice (Alt+N)"
                  aria-keyshortcuts="Alt+N"
                  className={`h-10 min-w-[150px] inline-flex items-center justify-center gap-2 rounded-xl px-3 ${tintBlue}`}
                >
                  <PlusCircleIcon className="w-5 h-5" />
                  Add Invoice
                </Link>
              </Guard>
            </div>
          }
        />

        {/* ===== Search toolbar ===== */}
        <GlassToolbar className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <TextSearch
            value={qPosted}
            onChange={setQPosted}
            placeholder="Search by Posted No (e.g., PRINV-0001)…"
          />
          <TextSearch
            value={qSupplier}
            onChange={setQSupplier}
            placeholder="Search by Supplier…"
          />

          <div className="md:col-span-2 flex items-center justify-between gap-3">
            <div className="text-sm text-gray-700">
              {loading ? "Loading…" : (
                <>Showing <strong>{rows.length === 0 ? 0 : start}-{end}</strong> of <strong>{total}</strong></>
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

      {/* ===== Table card ===== */}
      <GlassCard>
        <div className="max-h-[70vh] overflow-auto rounded-b-2xl">
          <table className="w-full text-sm text-gray-900 dark:text-gray-100">
            <thead className="sticky top-0 bg-white/90 dark:bg-slate-700/90 backdrop-blur-sm z-10 border-b border-gray-200/70 dark:border-slate-600/70">
              <tr className="text-left">
                <th className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100">#</th>
                <th className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100">Posted No</th>
                <th className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100">Invoice No</th>
                <th className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100">Supplier</th>
                <th className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100">Date</th>
                <th className="px-3 py-2 font-medium text-right text-gray-900 dark:text-gray-100">Amount</th>
                {(can.update || can.delete) && (
                  <th className="px-3 py-2 font-medium text-center text-gray-900 dark:text-gray-100">Actions</th>
                )}
              </tr>
            </thead>

            <tbody>
              {rows.length === 0 && !loading && (
                <tr>
                  <td className="px-3 py-10 text-center text-gray-600 dark:text-gray-400" colSpan={7}>
                    No invoices found.
                  </td>
                </tr>
              )}

              {rows.map((inv, idx) => (
                <tr
                  key={inv.id}
                  className={`transition-colors odd:bg-white/90 even:bg-white/70 hover:bg-blue-50 dark:odd:bg-slate-700/60 dark:even:bg-slate-800/60 dark:hover:bg-slate-600/70`}
                >
                  <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{(page - 1) * pageSize + idx + 1}</td>
                  <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{inv.posted_number || "-"}</td>
                  <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{inv.invoice_number}</td>
                  <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{inv.supplier?.name ?? "N/A"}</td>
                  <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{inv.posted_date}</td>
                  <td className="px-3 py-2 text-right text-gray-900 dark:text-gray-100">
                    {Number(inv.total_amount ?? 0).toLocaleString()}
                  </td>

                  {(can.update || can.delete) && (
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2 justify-center">
                        <Guard when={can.update}>
                          <Link
                            to={`/purchase-invoices/${inv.id}/edit`}
                            className={`h-9 min-w-[100px] inline-flex items-center justify-center gap-1 rounded-xl px-3 ${tintAmber}`}
                            title={`Edit ${inv.posted_number || inv.invoice_number}`}
                          >
                            <PencilSquareIcon className="w-5 h-5" />
                            Edit
                          </Link>
                        </Guard>

                        <Guard when={can.delete}>
                          <GlassBtn
                            onClick={() => openDeleteModal(inv)}
                            className={`h-9 min-w-[100px] ${tintRed}`}
                            title="Delete invoice"
                          >
                            <span className="inline-flex items-center gap-1">
                              <TrashIcon className="w-5 h-5" />
                              Delete
                            </span>
                          </GlassBtn>
                        </Guard>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-3 py-3 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="text-sm text-gray-700">Page {page} of {lastPage}</div>
          <div className="flex items-center gap-2">
            <GlassBtn onClick={() => setPage(1)} disabled={page === 1} className={`h-9 px-3 ${tintGlass}`}>
              ⏮ First
            </GlassBtn>
            <GlassBtn onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className={`h-9 px-3 ${tintGlass}`}>
              ◀ Prev
            </GlassBtn>
            <GlassBtn onClick={() => setPage((p) => Math.min(lastPage, p + 1))} disabled={page === lastPage} className={`h-9 px-3 ${tintGlass}`}>
              Next ▶
            </GlassBtn>
            <GlassBtn onClick={() => setPage(lastPage)} disabled={page === lastPage} className={`h-9 px-3 ${tintGlass}`}>
              Last ⏭
            </GlassBtn>
          </div>
        </div>
      </GlassCard>

      {/* Delete confirmation modal (glassy) */}
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
                title={
                  <span className="inline-flex items-center gap-2">
                    <ShieldExclamationIcon className="w-5 h-5 text-rose-600" />
                    <span>Delete invoice</span>
                  </span>
                }
                right={
                  <GlassBtn className={`h-8 px-3 ${tintGlass}`} onClick={closeDeleteModal} title="Close">
                    <XMarkIcon className="w-5 h-5" />
                  </GlassBtn>
                }
              />
              <div className="px-4 py-4 space-y-4">
                {deleteStep === 1 && (
                  <>
                    <p className="text-sm text-gray-700">
                      {deletingInvoice?.posted_number ? (
                        <>Are you sure you want to delete invoice <strong>{deletingInvoice.posted_number}</strong>? </>
                      ) : "Are you sure you want to delete this invoice? "}
                      This action cannot be undone.
                    </p>
                    <div className="flex justify-end gap-2">
                      <GlassBtn className={`min-w-[100px] ${tintGlass}`} onClick={closeDeleteModal}>
                        Cancel
                      </GlassBtn>
                      <GlassBtn className={`min-w-[140px] ${tintRed}`} onClick={proceedToPassword}>
                        Yes, continue
                      </GlassBtn>
                    </div>
                  </>
                )}

                {deleteStep === 2 && (
                  <>
                    <p className="text-sm text-gray-700">
                      For security, please re-enter your password to delete this invoice.
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
