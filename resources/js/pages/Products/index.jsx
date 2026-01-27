// src/pages/products/index.jsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  TrashIcon,
  PencilSquareIcon,
  PlusCircleIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  ArrowUpTrayIcon,
  ArrowDownTrayIcon,
  ShieldExclamationIcon,
  TagIcon,
  BuildingStorefrontIcon,
  Squares2X2Icon,
  ArrowPathIcon,
} from "@heroicons/react/24/solid";
import AsyncSelect from "react-select/async";
import ProductImportModal from "../../components/ProductImportModal.jsx";
import { usePermissions, Guard } from "@/api/usePermissions.js";

// 🧊 glass primitives
import {
  GlassCard,
  GlassSectionHeader,
  GlassToolbar,
  GlassInput,
  GlassBtn,
} from "@/components/glass.jsx";
import { useTheme } from "@/context/ThemeContext";

/** ---- helpers ---- */
const normalizeList = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
};

const debouncePromise = (fn, wait = 300) => {
  let timeout;
  let pendingReject;
  return (...args) =>
    new Promise((resolve, reject) => {
      if (timeout) clearTimeout(timeout);
      if (pendingReject) pendingReject("debounced");
      pendingReject = reject;
      timeout = setTimeout(async () => {
        try {
          const res = await fn(...args);
          resolve(res);
        } catch (e) {
          reject(e);
        } finally {
          pendingReject = null;
        }
      }, wait);
    });
};

export default function ProductsIndex() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  // Import / Export
  const [importOpen, setImportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  // search filters
  const [qName, setQName] = useState("");
  const [qBrand, setQBrand] = useState("");
  const [qSupplier, setQSupplier] = useState("");

  // pagination (server-side)
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);

  // selection
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showBulkDelete, setShowBulkDelete] = useState(false);

  const navigate = useNavigate();

  // AbortController + debounce for fetches
  const controllerRef = useRef(null);
  const debounceRef = useRef(null);

  // 🔒 permissions
  const { loading: permsLoading, canFor } = usePermissions();
  const can = useMemo(
    () =>
      (typeof canFor === "function"
        ? canFor("product")
        : { view: false, create: false, update: false, delete: false, import: false, export: false }),
    [canFor]
  );

  // 🧊 iOS-style tinted glass palette (consistent across pages)
  const tintBlue   = "bg-blue-500/85 text-white shadow-[0_6px_20px_-6px_rgba(37,99,235,0.45)] ring-1 ring-white/20 hover:bg-blue-500/95";
  const tintIndigo = "bg-indigo-500/85 text-white shadow-[0_6px_20px_-6px_rgba(99,102,241,0.45)] ring-1 ring-white/20 hover:bg-indigo-500/95";
  const tintSlate  = "bg-slate-900/80 text-white shadow-[0_6px_20px_-6px_rgba(15,23,42,0.45)] ring-1 ring-white/15 hover:bg-slate-900/90";
  const tintAmber  = "bg-amber-500/85 text-white shadow-[0_6px_20px_-6px_rgba(245,158,11,0.45)] ring-1 ring-white/20 hover:bg-amber-500/95";
  const tintRed    = "bg-rose-500/85 text-white shadow-[0_6px_20px_-6px_rgba(244,63,94,0.45)] ring-1 ring-white/20 hover:bg-rose-500/95";
  const tintGlass  = "bg-white/60 text-slate-700 ring-1 ring-white/30 hover:bg-white/75 dark:text-gray-100 dark:bg-slate-700/60 dark:ring-slate-600/30 dark:hover:bg-slate-600/75";

  // Get dark mode state
  const { isDark } = useTheme();

  // === Alt+N => /products/create (only when can.create) ===
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
      navigate("/products/create");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navigate, can.create]);

  const handleExport = async () => {
    if (!can.export) return toast.error("You don't have permission to export products.");
    try {
      setExporting(true);
      const res = await axios.get("/api/products/export", { responseType: "blob" });
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      const filename = `products_${stamp}.csv`;
      const blob = new Blob([res.data], { type: "text/csv;charset=utf-8" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      const status = e?.response?.status;
      if (status === 403) toast.error("You don't have permission to export products.");
      else toast.error("Export failed");
    } finally {
      setExporting(false);
    }
  };

// keep fetchProducts but pass filters as args
const fetchProducts = useCallback(async (signal, opts = {}) => {
  const { pageArg = page, pageSizeArg = pageSize, qNameArg = qName, qBrandArg = qBrand, qSupplierArg = qSupplier } = opts;
  try {
    setLoading(true);
    const { data } = await axios.get("/api/products", {
      params: {
        page: pageArg,
        per_page: pageSizeArg,
        q_name: qNameArg.trim(),
        q_brand: qBrandArg.trim(),
        q_supplier: qSupplierArg.trim(),
      },
      signal,
    });

    const items = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
    setRows(items);
    setTotal(Number(data?.total ?? items.length ?? 0));
    const lp = Number(data?.last_page ?? 1);
    setLastPage(lp);
    if (pageArg > lp) setPage(lp || 1);
  } catch (err) {
    if (axios.isCancel?.(err)) return;
    const status = err?.response?.status;
    if (status === 403) toast.error("You don't have permission to view products.");
    else toast.error("Failed to load products");
  } finally {
    setLoading(false);
  }
}, [page, pageSize, qName, qBrand, qSupplier]);


// Fetch when page or pageSize changes
useEffect(() => {
  if (permsLoading || !can.view) return;
  const ctrl = new AbortController();
  controllerRef.current = ctrl;
  fetchProducts(ctrl.signal);
  return () => ctrl.abort();
}, [page, pageSize, permsLoading, can.view]);

// Debounce only when filters change (reset to page 1)
useEffect(() => {
  if (permsLoading || !can.view) return;
  const ctrl = new AbortController();
  if (debounceRef.current) clearTimeout(debounceRef.current);
  debounceRef.current = setTimeout(() => {
    setPage(1);
    controllerRef.current = ctrl;
    fetchProducts(ctrl.signal, { pageArg: 1 });
  }, 300);
  return () => {
    clearTimeout(debounceRef.current);
    ctrl.abort();
  };
}, [qName, qBrand, qSupplier, permsLoading, can.view]);


  const start = rows.length ? (page - 1) * pageSize + 1 : 0;
  const end = rows.length ? start + rows.length - 1 : 0;

  // ===== secure delete modal state & handlers =====
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteStep, setDeleteStep] = useState(1); // 1 = confirm, 2 = password
  const [deletingProduct, setDeletingProduct] = useState(null); // { id, name }
  const [password, setPassword] = useState("");
  const [deleting, setDeleting] = useState(false);

  const openDeleteModal = (product) => {
    if (!can.delete) return toast.error("You don't have permission to delete products.");
    const qty = Number(product.quantity || 0);
    const hasBatches = Number(product.batches_count || 0) > 0;

    if (qty > 0 || hasBatches) {
      toast.error(qty > 0 ? "Cannot delete: product has on-hand quantity." : "Cannot delete: product has batch records.");
      return;
    }

    setDeletingProduct({ id: product.id, name: product.name });
    setPassword("");
    setDeleteStep(1);
    setDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    if (deleting) return;
    setDeleteModalOpen(false);
    setDeleteStep(1);
    setDeletingProduct(null);
    setPassword("");
  };

  const proceedToPassword = () => setDeleteStep(2);

  const confirmAndDelete = async () => {
    if (!deletingProduct?.id) return;
    if (!can.delete) return toast.error("You don't have permission to delete products.");
    try {
      setDeleting(true);
      await axios.post("/api/auth/confirm-password", { password });
      await axios.delete(`/api/products/${deletingProduct.id}`);
      toast.success("Product deleted");

      setSelectedIds((prev) => {
        const copy = new Set(prev);
        copy.delete(deletingProduct.id);
        return copy;
      });

      closeDeleteModal();

      if (controllerRef.current) controllerRef.current.abort();
      const ctrl = new AbortController();
      controllerRef.current = ctrl;
      fetchProducts(ctrl.signal);
    } catch (err) {
      const status = err?.response?.status;
      const apiMsg =
        err?.response?.data?.message ||
        (status === 422 ? "Incorrect password" : status === 403 ? "You don't have permission to delete products." : "Delete failed");
      toast.error(apiMsg);
    } finally {
      setDeleting(false);
    }
  };

  // selection helpers (operate on current page rows)
  const pageAllChecked = rows.length > 0 && rows.every((p) => selectedIds.has(p.id));
  const pageIndeterminate = rows.some((p) => selectedIds.has(p.id)) && !pageAllChecked;

  const togglePageAll = (checked) => {
    setSelectedIds((prev) => {
      const copy = new Set(prev);
      if (checked) rows.forEach((p) => copy.add(p.id));
      else rows.forEach((p) => copy.delete(p.id));
      return copy;
    });
  };

  const toggleOne = (id, checked) => {
    setSelectedIds((prev) => {
      const copy = new Set(prev);
      if (checked) copy.add(id);
      else copy.delete(id);
      return copy;
    });
  };

  // helper to toggle by clicking product name
  const toggleById = (id) =>
    setSelectedIds((prev) => {
      const copy = new Set(prev);
      copy.has(id) ? copy.delete(id) : copy.add(id);
      return copy;
    });

  const openBulkModal = () => {
    if (!can.update) return toast.error("You don't have permission to update products.");
    setShowBulkModal(true);
  };

  // permissions-driven table layout
  const hasActions = can.update || can.delete;
  const visibleColumns = 1 /*select*/ + 6 /*code,name,image,category,brand,supplier*/ + (hasActions ? 1 : 0);

  if (permsLoading) return <div className="p-6">Loading…</div>;
  if (!can.view) return <div className="p-6 text-sm text-gray-700">You don’t have permission to view products.</div>;

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* ===== Header (single-column page layout) ===== */}
      <GlassCard>
        <GlassSectionHeader
          title={<span className="inline-flex items-center gap-2">
            <Squares2X2Icon className="w-5 h-5 text-blue-600" />
            <span>Products</span>
          </span>}
          right={
            <div className="flex items-center gap-2">
              <GlassBtn
                className={`h-10 min-w-[120px] ${tintSlate}`}
                onClick={() => {
                  if (controllerRef.current) controllerRef.current.abort();
                  const ctrl = new AbortController();
                  controllerRef.current = ctrl;
                  fetchProducts(ctrl.signal);
                }}
                title="Refresh"
                aria-label="Refresh products"
              >
                <span className="inline-flex items-center gap-2">
                  <ArrowPathIcon className="w-5 h-5" />
                  Refresh
                </span>
              </GlassBtn>

              <Guard when={can.update}>
                <GlassBtn
                  className={`h-10 min-w-[170px] ${selectedIds.size ? tintAmber : tintGlass} ${selectedIds.size ? "" : "opacity-60 cursor-not-allowed"}`}
                  disabled={selectedIds.size === 0}
                  onClick={openBulkModal}
                  title="Edit selected products (bulk)"
                >
                  <span className="inline-flex items-center gap-2">
                    <PencilSquareIcon className="w-5 h-5" />
                    Edit Selected ({selectedIds.size})
                  </span>
                </GlassBtn>
              </Guard>

              <Guard when={can.delete}>
                <GlassBtn
                  className={`h-10 min-w-[170px] ${selectedIds.size ? tintRed : tintGlass} ${selectedIds.size ? "" : "opacity-60 cursor-not-allowed"}`}
                  disabled={selectedIds.size === 0}
                  onClick={() => setShowBulkDelete(true)}
                  title="Delete selected products (bulk)"
                >
                  <span className="inline-flex items-center gap-2">
                    <TrashIcon className="w-5 h-5" />
                    Delete Selected ({selectedIds.size})
                  </span>
                </GlassBtn>
              </Guard>

              <Guard when={can.create}>
                <Link
                  to="/products/create"
                  title="Add Product (Alt+N)"
                  aria-keyshortcuts="Alt+N"
                  className={`h-10 min-w-[150px] inline-flex items-center justify-center gap-2 rounded-xl px-3 ${tintBlue}`}
                >
                  <PlusCircleIcon className="w-5 h-5" />
                  Add Product
                </Link>
              </Guard>
            </div>
          }
        />

        {/* Search toolbar */}
        <GlassToolbar className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <TextSearch value={qName} onChange={setQName} placeholder="Search by Product Name…" />
          <TextSearch value={qBrand} onChange={setQBrand} placeholder="Search by Brand…" icon={<TagIcon className="w-5 h-5 text-gray-400" />} />
          <TextSearch value={qSupplier} onChange={setQSupplier} placeholder="Search by Supplier…" icon={<BuildingStorefrontIcon className="w-5 h-5 text-gray-400" />} />

          <div className="md:col-span-3 flex items-center justify-between gap-3">
            <div className="text-sm text-gray-700">
              {loading ? "Loading…" : (
                <>Showing <strong>{rows.length === 0 ? 0 : start}-{end}</strong> of <strong>{total}</strong></>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Guard when={can.import}>
                <GlassBtn
                  className={`h-9 min-w-[140px] ${tintIndigo}`}
                  onClick={() => setImportOpen(true)}
                  title="Import Products (CSV)"
                  aria-label="Import products from CSV"
                >
                  <span className="inline-flex items-center gap-2">
                    <ArrowUpTrayIcon className="w-5 h-5" />
                    Import CSV
                  </span>
                </GlassBtn>
              </Guard>

              <Guard when={can.export}>
                <GlassBtn
                  className={`h-9 min-w-[140px] ${tintGlass}`}
                  onClick={handleExport}
                  disabled={exporting}
                  title="Export all products to CSV"
                  aria-label="Export all products to CSV"
                >
                  <span className="inline-flex items-center gap-2">
                    <ArrowDownTrayIcon className="w-5 h-5" />
                    {exporting ? "Exporting…" : "Export CSV"}
                  </span>
                </GlassBtn>
              </Guard>

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

      {/* ===== Table card (single column layout) ===== */}
      <GlassCard>
        <div className="max-h-[70vh] overflow-auto rounded-b-2xl">
          <table className="w-full text-sm text-gray-900 dark:text-gray-100">
            <thead className="sticky top-0 bg-white/90 dark:bg-slate-700/90 backdrop-blur-sm z-10 border-b border-gray-200/70 dark:border-slate-600/70">
              {(can.import || can.export) && (
                <tr>
                  <th colSpan={visibleColumns} className="px-3 py-2">
                    {/* (We already show Import/Export above; keeping header minimal for stickiness) */}
                  </th>
                </tr>
              )}
              <tr className="text-left">
                <th className="px-3 py-2 text-gray-900 dark:text-gray-100">
                  <input
                    type="checkbox"
                    aria-label="Select all on this page"
                    checked={pageAllChecked}
                    ref={(el) => {
                      if (el) el.indeterminate = pageIndeterminate;
                    }}
                    onChange={(e) => togglePageAll(e.target.checked)}
                  />
                </th>
                <th className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100">Code</th>
                <th className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100">Name</th>
                <th className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100">Image</th>
                <th className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100">Category</th>
                <th className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100">Brand</th>
                <th className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100">Supplier</th>
                {hasActions && <th className="px-3 py-2 font-medium text-center text-gray-900 dark:text-gray-100">Actions</th>}
              </tr>
            </thead>

            <tbody>
              {rows.length === 0 && !loading && (
                <tr>
                  <td className="px-3 py-10 text-center text-gray-600 dark:text-gray-400" colSpan={visibleColumns}>
                    No products found.
                  </td>
                </tr>
              )}

              {rows.map((p) => {
                const qty = Number(p.quantity || 0);
                const hasBatches = Number(p.batches_count || 0) > 0;
                const deleteDisabled = qty > 0 || hasBatches;
                const deleteTitle = deleteDisabled
                  ? qty > 0
                    ? "Cannot delete: product has on-hand quantity."
                    : "Cannot delete: product has batch records."
                  : "Delete";
                return (
                  <tr
                    key={p.id}
                    className={`transition-colors ${selectedIds.has(p.id) ? "bg-blue-50 dark:bg-slate-600/50" : "odd:bg-white/90 even:bg-white/70 dark:odd:bg-slate-700/60 dark:even:bg-slate-800/60"} hover:bg-blue-50 dark:hover:bg-slate-600/70`}
                  >
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(p.id)}
                        onChange={(e) => toggleOne(p.id, e.target.checked)}
                        aria-label={`Select product ${p.name}`}
                      />
                    </td>
                    <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{p.product_code}</td>

                    {/* Name cell clickable for selection */}
                    <td
                      className="px-3 py-2 cursor-pointer select-none text-gray-900 dark:text-gray-100"
                      role="button"
                      tabIndex={0}
                      title="Click to select"
                      onClick={() => toggleById(p.id)}
                      onKeyDown={(e) => {
                        if (e.key === " " || e.key === "Enter") {
                          e.preventDefault();
                          toggleById(p.id);
                        }
                      }}
                    >
                      {p.name}
                    </td>

                    <td className="px-3 py-2">
                      {p.image ? (
                        <img
                          src={`/storage/${p.image}`}
                          alt={p.name}
                          className="w-12 h-12 object-cover rounded-xl ring-1 ring-gray-200/60 bg-white/70 dark:bg-slate-700/70"
                        />
                      ) : (
                        <span className="text-gray-500 dark:text-gray-400">No image</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{p.category?.name}</td>
                    <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{p.brand?.name}</td>
                    <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{p.supplier?.name}</td>

                    {hasActions && (
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-2 justify-center">
                          <Guard when={can.update}>
                            <Link
                              to={`/products/${p.id}/edit`}
                              className={`h-9 min-w-[100px] inline-flex items-center justify-center gap-1 rounded-xl px-3 ${tintAmber}`}
                              title={`Edit ${p.name}`}
                            >
                              <PencilSquareIcon className="w-5 h-5" />
                              Edit
                            </Link>
                          </Guard>

                          <Guard when={can.delete}>
                            <GlassBtn
                              onClick={() => openDeleteModal(p)}
                              disabled={deleteDisabled}
                              title={deleteTitle}
                              className={`h-9 min-w-[100px] ${deleteDisabled ? tintGlass + " opacity-60 cursor-not-allowed" : tintRed}`}
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
                );
              })}
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

      {/* Bulk Edit Modal */}
      {showBulkModal && (
        <BulkEditModal
          onClose={() => setShowBulkModal(false)}
          selectedCount={selectedIds.size}
          selectedIds={[...selectedIds]}
          onSaved={async () => {
            if (controllerRef.current) controllerRef.current.abort();
            const ctrl = new AbortController();
            controllerRef.current = ctrl;
            await fetchProducts(ctrl.signal);
            setShowBulkModal(false);
            setSelectedIds(new Set());
          }}
          tintBlue={tintBlue}
          tintGlass={tintGlass}
        />
      )}

      {/* Import modal */}
      <ProductImportModal open={importOpen} onClose={() => setImportOpen(false)} onImported={fetchProducts} />

      {/* Single Delete confirmation modal (glassy) */}
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
                  <span>Delete product</span>
                </span>}
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
                      {deletingProduct?.name ? (
                        <>Are you sure you want to delete <strong>{deletingProduct.name}</strong>? </>
                      ) : "Are you sure you want to delete this product? "}
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
                    <p className="text-sm text-gray-700">For security, please re-enter your password to delete this product.</p>
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

      {/* Bulk Delete Modal */}
      {showBulkDelete && (
        <BulkDeleteModal
          onClose={() => setShowBulkDelete(false)}
          selectedIds={[...selectedIds]}
          onDone={async (result) => {
            if (result?.deleted) toast.success(`Deleted ${result.deleted} product(s).`);
            if (result?.failed?.length) {
              const firstFew = result.failed.slice(0, 3).map(f => `${f.name ?? `#${f.id}`}: ${f.reason}`);
              toast.error(
                `Couldn't delete ${result.failed.length} item(s).\n` + firstFew.join("\n")
              );
            }
            if (controllerRef.current) controllerRef.current.abort();
            const ctrl = new AbortController();
            controllerRef.current = ctrl;
            await fetchProducts(ctrl.signal);
            setSelectedIds(new Set());
            setShowBulkDelete(false);
          }}
          tintGlass={tintGlass}
          tintRed={tintRed}
        />
      )}
    </div>
  );
}

function TextSearch({ value, onChange, placeholder, icon }) {
  return (
    <div className="relative">
      {icon ? (
        <span className="absolute left-3 top-1/2 -translate-y-1/2">{icon}</span>
      ) : (
        <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
      )}
      <GlassInput
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-10 w-full"
      />
    </div>
  );
}

/** Bulk edit modal */
function BulkEditModal({ onClose, selectedCount, selectedIds, onSaved, tintBlue, tintGlass }) {
  const [saving, setSaving] = useState(false);
  const { isDark } = useTheme();

  const [catOpt, setCatOpt] = useState(null);
  const [brandOpt, setBrandOpt] = useState(null);
  const [suppOpt, setSuppOpt] = useState(null);

  // Helper to merge dark mode styles - returns function-based styles for react-select
  const getSelectStyles = (isDarkMode = false) => ({
    control: (base) => ({
      ...base,
      minHeight: 36,
      height: 36,
      borderColor: isDarkMode ? "rgba(71,85,105,0.8)" : "rgba(229,231,235,0.8)",
      backgroundColor: isDarkMode ? "rgba(51,65,85,0.7)" : "rgba(255,255,255,0.7)",
      backdropFilter: "blur(6px)",
      boxShadow: isDarkMode ? "0 1px 2px rgba(0,0,0,0.2)" : "0 1px 2px rgba(15,23,42,0.06)",
      borderRadius: 12,
    }),
    valueContainer: (base) => ({ ...base, height: 36, padding: "0 10px" }),
    indicatorsContainer: (base) => ({ ...base, height: 36 }),
    input: (base) => ({
      ...base,
      margin: 0,
      padding: 0,
      color: isDarkMode ? "#f1f5f9" : "#111827",
    }),
    menuPortal: (base) => ({ ...base, zIndex: 9999 }),
    menu: (base) => ({
      ...base,
      borderRadius: 12,
      overflow: "hidden",
      backgroundColor: isDarkMode ? "rgba(30,41,59,0.95)" : "rgba(255,255,255,0.95)",
      backdropFilter: "blur(10px)",
      boxShadow: isDarkMode ? "0 10px 30px -10px rgba(0,0,0,0.4)" : "0 10px 30px -10px rgba(30,64,175,0.18)",
      border: isDarkMode ? "1px solid rgba(71,85,105,0.5)" : "none",
    }),
    option: (base, state) => ({
      ...base,
      backgroundColor: isDarkMode
        ? state.isFocused
          ? "rgba(71,85,105,1)"
          : "rgba(51,65,85,1)"
        : state.isFocused
          ? "rgba(241,245,249,1)"
          : "rgba(255,255,255,1)",
      color: isDarkMode ? "#f1f5f9" : "#111827",
      cursor: "pointer",
    }),
    singleValue: (base) => ({
      ...base,
      color: isDarkMode ? "#f1f5f9" : "#111827",
    }),
    placeholder: (base) => ({
      ...base,
      color: isDarkMode ? "#64748b" : "#9ca3af",
    }),
  });

  const fetchOptions = async (endpoint, inputValue) => {
    const { data } = await axios.get(endpoint, { params: { q: inputValue || "", limit: 20 } });
    const list = normalizeList(data);
    return list.map((i) => ({ value: i.id, label: i.name }));
  };

  const loadCategories = React.useMemo(
    () => debouncePromise((input) => fetchOptions("/api/categories/search", input), 300),
    []
  );
  const loadBrands = React.useMemo(
    () => debouncePromise((input) => fetchOptions("/api/brands/search", input), 300),
    []
  );
  const loadSuppliers = React.useMemo(
    () => debouncePromise((input) => fetchOptions("/api/suppliers/search", input), 300),
    []
  );

  const submit = async () => {
    try {
      if (!catOpt && !brandOpt && !suppOpt) return toast.error("Choose at least one field to update.");
      setSaving(true);
      await axios.patch("/api/products/bulk-update-meta", {
        product_ids: selectedIds,
        category_id: catOpt?.value ?? null,
        brand_id: brandOpt?.value ?? null,
        supplier_id: suppOpt?.value ?? null,
      });
      toast.success("Products updated successfully");
      await onSaved();
    } catch (e) {
      const apiMsg = e?.response?.data?.message || "Bulk update failed";
      toast.error(apiMsg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-xl">
          <GlassCard>
            <GlassSectionHeader
              title={<span className="font-semibold">Bulk Edit ({selectedCount} selected)</span>}
              right={
                <GlassBtn className={`h-8 px-3 ${tintGlass}`} onClick={onClose} title="Close">
                  <XMarkIcon className="w-5 h-5" />
                </GlassBtn>
              }
            />
            <div className="px-4 pt-3 pb-4 space-y-4">
              <p className="text-sm text-gray-600">Leave any field blank to keep current values for that field.</p>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Category</label>
                  <AsyncSelect
                    classNamePrefix="rs"
                    cacheOptions
                    defaultOptions
                    loadOptions={loadCategories}
                    isSearchable
                    isClearable
                    value={catOpt}
                    onChange={setCatOpt}
                    menuPortalTarget={typeof document !== "undefined" ? document.body : null}
                    styles={getSelectStyles(isDark)}
                    placeholder="(No change)"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Brand</label>
                  <AsyncSelect
                    classNamePrefix="rs"
                    cacheOptions
                    defaultOptions
                    loadOptions={loadBrands}
                    isSearchable
                    isClearable
                    value={brandOpt}
                    onChange={setBrandOpt}
                    menuPortalTarget={typeof document !== "undefined" ? document.body : null}
                    styles={getSelectStyles(isDark)}
                    placeholder="(No change)"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Supplier</label>
                  <AsyncSelect
                    classNamePrefix="rs"
                    cacheOptions
                    defaultOptions
                    loadOptions={loadSuppliers}
                    isSearchable
                    isClearable
                    value={suppOpt}
                    onChange={setSuppOpt}
                    menuPortalTarget={typeof document !== "undefined" ? document.body : null}
                    styles={getSelectStyles(isDark)}
                    placeholder="(No change)"
                  />
                </div>
              </div>
            </div>

            <div className="px-4 pb-4 flex items-center justify-end gap-2">
              <GlassBtn className={`min-w-[110px] ${tintGlass}`} onClick={onClose} disabled={saving}>
                Cancel
              </GlassBtn>
              <GlassBtn className={`min-w-[150px] ${tintBlue}`} onClick={submit} disabled={saving}>
                {saving ? "Saving…" : "Save Changes"}
              </GlassBtn>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}

/** Bulk delete modal */
function BulkDeleteModal({ onClose, selectedIds, onDone, tintGlass, tintRed }) {
  const [password, setPassword] = useState("");
  const [working, setWorking] = useState(false);

  const submit = async () => {
    try {
      setWorking(true);
      await axios.post("/api/auth/confirm-password", { password });
      const { data } = await axios.post("/api/products/bulk-destroy", {
        product_ids: selectedIds,
      });
      await onDone?.(data);
    } catch (e) {
      const msg = e?.response?.data?.message || "Bulk delete failed";
      toast.error(msg);
    } finally {
      setWorking(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative w-full max-w-md">
        <GlassCard>
          <GlassSectionHeader
            title={<span className="inline-flex items-center gap-2">
              <ShieldExclamationIcon className="w-5 h-5 text-rose-600" />
              <span>Delete selected products</span>
            </span>}
            right={
              <GlassBtn className={`h-8 px-3 ${tintGlass}`} onClick={onClose} title="Close">
                <XMarkIcon className="w-5 h-5" />
              </GlassBtn>
            }
          />
          <div className="px-4 py-4 space-y-4">
            <p className="text-sm text-gray-700">
              You are about to permanently delete <strong>{selectedIds.length}</strong> product(s). This action cannot be undone.
            </p>

            <div className="space-y-2">
              <label className="block text-sm font-medium">Confirm your password</label>
              <GlassInput
                type="password"
                value={password}
                autoFocus
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your password"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && password.trim()) submit();
                  if (e.key === "Escape") onClose();
                }}
              />
            </div>

            <div className="flex justify-end gap-2">
              <GlassBtn className={`min-w-[110px] ${tintGlass}`} onClick={onClose} disabled={working}>
                Cancel
              </GlassBtn>
              <GlassBtn
                className={`min-w-[160px] ${tintRed}`}
                onClick={submit}
                disabled={working || password.trim() === ""}
              >
                {working ? "Deleting…" : "Confirm & Delete"}
              </GlassBtn>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
