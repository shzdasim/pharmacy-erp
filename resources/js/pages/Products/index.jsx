import React, { useEffect, useMemo, useRef, useState } from "react";
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
} from "@heroicons/react/24/solid";
import Select from "react-select";
import AsyncSelect from "react-select/async";
import ProductImportModal from "../../components/ProductImportModal.jsx";

/** ---- helpers ---- */
const normalizeList = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
};

// small debounce that returns a promise (for AsyncSelect loadOptions)
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
  const [rows, setRows] = useState([]); // current page rows
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

  const navigate = useNavigate();

  // AbortController + debounce for fetches
  const controllerRef = useRef(null);
  const debounceRef = useRef(null);

  // === Alt+N => /products/create ===
  useEffect(() => {
    const onKeyDown = (e) => {
      if (!e.altKey) return;
      const key = (e.key || "").toLowerCase();
      if (key !== "n") return;
      const tag = (e.target?.tagName || "").toLowerCase();
      const isTyping = ["input", "textarea", "select"].includes(tag) || e.target?.isContentEditable;
      if (isTyping) return;
      e.preventDefault();
      navigate("/products/create");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navigate]);

  const handleExport = async () => {
    try {
      setExporting(true);
      const res = await axios.get("/api/products/export", { responseType: "blob" });
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      const filename = `products_${stamp}.csv`;
      const blob = new Blob([res.data], { type: "text/csv;charset=utf-8" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      toast.error("Export failed");
    } finally {
      setExporting(false);
    }
  };

  const fetchProducts = async (signal) => {
    try {
      setLoading(true);
      const { data } = await axios.get("/api/products", {
        params: {
          page,
          per_page: pageSize,
          q_name: qName.trim(),
          q_brand: qBrand.trim(),
          q_supplier: qSupplier.trim(),
        },
        signal,
      });

      // Normalize Laravel paginator or array
      const items = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
      setRows(items);
      setTotal(Number(data?.total ?? items.length ?? 0));
      const lp = Number(data?.last_page ?? 1);
      setLastPage(lp);
      if (page > lp) setPage(lp || 1);
    } catch (err) {
      if (axios.isCancel?.(err)) return;
      console.error("Error fetching products", err);
      toast.error("Failed to load products");
    } finally {
      setLoading(false);
    }
  };

  // Initial + pager change (non-debounced)
  useEffect(() => {
    if (controllerRef.current) controllerRef.current.abort();
    const ctrl = new AbortController();
    controllerRef.current = ctrl;
    fetchProducts(ctrl.signal);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize]);

  // Debounce filter changes (qName/qBrand/qSupplier)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      if (controllerRef.current) controllerRef.current.abort();
      const ctrl = new AbortController();
      controllerRef.current = ctrl;
      fetchProducts(ctrl.signal);
    }, 300);
    return () => clearTimeout(debounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qName, qBrand, qSupplier]);

  const start = rows.length ? (page - 1) * pageSize + 1 : 0;
  const end = rows.length ? start + rows.length - 1 : 0;

  // ===== NEW: secure delete modal state & handlers =====
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteStep, setDeleteStep] = useState(1); // 1 = confirm, 2 = password
  const [deletingProduct, setDeletingProduct] = useState(null); // { id, name }
  const [password, setPassword] = useState("");
  const [deleting, setDeleting] = useState(false);

  const openDeleteModal = (product) => {
    const qty = Number(product.quantity || 0);
    const hasBatches = Number(product.batches_count || 0) > 0;

    if (qty > 0 || hasBatches) {
      toast.error(
        qty > 0
          ? "Cannot delete: product has on-hand quantity."
          : "Cannot delete: product has batch records."
      );
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
    try {
      setDeleting(true);
      // 1) confirm password (Sanctum-protected)
      await axios.post("/api/auth/confirm-password", { password });
      // 2) delete product
      await axios.delete(`/api/products/${deletingProduct.id}`);

      toast.success("Product deleted");

      setSelectedIds((prev) => {
        const copy = new Set(prev);
        copy.delete(deletingProduct.id);
        return copy;
      });

      closeDeleteModal();

      // refresh current page
      if (controllerRef.current) controllerRef.current.abort();
      const ctrl = new AbortController();
      controllerRef.current = ctrl;
      fetchProducts(ctrl.signal);
    } catch (err) {
      const apiMsg =
        err?.response?.data?.message ||
        (err?.response?.status === 422 ? "Incorrect password" : "Delete failed");
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

  const openBulkModal = () => {
    setShowBulkModal(true); // async selects will fetch as user types
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between mb-4">
        <h1 className="text-2xl font-bold">Products</h1>
        <div className="flex gap-2">
          <button
            disabled={selectedIds.size === 0}
            onClick={openBulkModal}
            className={`px-4 py-2 rounded flex items-center gap-2 ${
              selectedIds.size === 0
                ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                : "bg-emerald-600 text-white"
            }`}
            title="Edit selected products (bulk)"
          >
            <PencilSquareIcon className="w-5 h-5" />
            Edit Selected ({selectedIds.size})
          </button>
          <Link
            to="/products/create"
            title="Add Product (Alt+N)"
            aria-keyshortcuts="Alt+N"
            className="bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2"
          >
            <PlusCircleIcon className="w-5 h-5" />
            Add Product
            <span className="ml-2 hidden sm:inline text-xs opacity-80 border rounded px-1 py-0.5">
              Alt+N
            </span>
          </Link>
        </div>
      </div>

      {/* Search toolbar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <TextSearch value={qName} onChange={setQName} placeholder="Search by Product Name…" />
        <TextSearch value={qBrand} onChange={setQBrand} placeholder="Search by Brand…" />
        <TextSearch value={qSupplier} onChange={setQSupplier} placeholder="Search by Supplier…" />
      </div>

      {/* Meta */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
        <div className="text-sm text-gray-600">
          {loading ? (
            <span>Loading…</span>
          ) : (
            <span>
              Showing <strong>{rows.length === 0 ? 0 : start}-{end}</strong> of{" "}
              <strong>{total}</strong>
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Rows per page</label>
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="border rounded px-2 py-1"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="w-full overflow-x-auto rounded border">
        <table className="w-full">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th colSpan={8} className="border p-2">
                <div className="flex items-center justify-start gap-2">
                  <button
                    onClick={() => setImportOpen(true)}
                    className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-3 h-9 rounded text-sm"
                    title="Import Products (CSV)"
                    aria-label="Import products from CSV"
                  >
                    <ArrowUpTrayIcon className="w-5 h-5" />
                    Import CSV
                  </button>
                  <button
                    onClick={handleExport}
                    disabled={exporting}
                    className={`inline-flex items-center gap-2 px-3 h-9 rounded text-sm border ${
                      exporting
                        ? "bg-gray-200 text-gray-600 cursor-not-allowed"
                        : "bg-white hover:bg-gray-50 text-gray-800 border-gray-300"
                    }`}
                    title="Export all products to CSV"
                    aria-label="Export all products to CSV"
                  >
                    <ArrowDownTrayIcon className="w-5 h-5" />
                    {exporting ? "Exporting…" : "Export CSV"}
                  </button>
                </div>
              </th>
            </tr>
            <tr>
              <th className="border px-2 py-2 text-left">
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
              <th className="border px-2 py-2 text-left">Code</th>
              <th className="border px-2 py-2 text-left">Name</th>
              <th className="border px-2 py-2 text-left">Image</th>
              <th className="border px-2 py-2 text-left">Category</th>
              <th className="border px-2 py-2 text-left">Brand</th>
              <th className="border px-2 py-2 text-left">Supplier</th>
              <th className="border px-2 py-2 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !loading && (
              <tr>
                <td className="border px-3 py-6 text-center text-gray-500" colSpan={8}>
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
                  className={`transition-colors ${
                    selectedIds.has(p.id) ? "bg-blue-50" : "odd:bg-white even:bg-gray-50"
                  } hover:bg-blue-100`}
                >
                  <td className="border px-2 py-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(p.id)}
                      onChange={(e) => toggleOne(p.id, e.target.checked)}
                      aria-label={`Select product ${p.name}`}
                    />
                  </td>
                  <td className="border px-2 py-2">{p.product_code}</td>
                  <td className="border px-2 py-2">{p.name}</td>
                  <td className="border px-2 py-2">
                    {p.image ? (
                      <img
                        src={`/storage/${p.image}`}
                        alt={p.name}
                        className="w-12 h-12 object-cover rounded"
                      />
                    ) : (
                      <span className="text-gray-500">No image</span>
                    )}
                  </td>
                  <td className="border px-2 py-2">{p.category?.name}</td>
                  <td className="border px-2 py-2">{p.brand?.name}</td>
                  <td className="border px-2 py-2">{p.supplier?.name}</td>
                  <td className="border px-2 py-2">
                    <div className="flex gap-2 justify-center">
                      <Link
                        to={`/products/${p.id}/edit`}
                        className="bg-yellow-500 text-white px-3 py-1 rounded flex items-center gap-1"
                      >
                        <PencilSquareIcon className="w-5 h-5" />
                        Edit
                      </Link>
                      <button
                        onClick={() => openDeleteModal(p)}
                        disabled={deleteDisabled}
                        title={deleteTitle}
                        className={`px-3 py-1 rounded flex items-center gap-1 ${
                          deleteDisabled
                            ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                            : "bg-red-600 text-white"
                        }`}
                      >
                        <TrashIcon className="w-5 h-5" />
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination (server) */}
      <div className="mt-4 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="text-sm text-gray-600">
          Page {page} of {lastPage}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage(1)}
            disabled={page === 1}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            ⏮ First
          </button>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            ◀ Prev
          </button>
          <button
            onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
            disabled={page === lastPage}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            Next ▶
          </button>
          <button
            onClick={() => setPage(lastPage)}
            disabled={page === lastPage}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            Last ⏭
          </button>
        </div>
      </div>

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
        />
      )}

      {/* Import modal */}
      <ProductImportModal open={importOpen} onClose={() => setImportOpen(false)} onImported={fetchProducts} />

      {/* ===== NEW: Delete confirmation modal ===== */}
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
                <h2 className="text-lg font-semibold mb-2">Delete product?</h2>
                <p className="text-sm text-gray-600">
                  {deletingProduct?.name ? (
                    <>
                      Are you sure you want to delete <strong>{deletingProduct.name}</strong>?{" "}
                    </>
                  ) : (
                    "Are you sure you want to delete this product? "
                  )}
                  This action cannot be undone.
                </p>
                <div className="mt-4 flex justify-end gap-2">
                  <button className="px-3 py-1 rounded border" onClick={closeDeleteModal}>
                    Cancel
                  </button>
                  <button
                    className="px-3 py-1 rounded bg-red-600 text-white hover:bg-red-700"
                    onClick={proceedToPassword}
                  >
                    Yes, continue
                  </button>
                </div>
              </div>
            )}

            {deleteStep === 2 && (
              <div>
                <h2 className="text-lg font-semibold mb-2">Confirm with password</h2>
                <p className="text-sm text-gray-600">
                  For security, please re-enter your password to delete this product.
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
                    onClick={() => setDeleteStep(1)}
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

function TextSearch({ value, onChange, placeholder }) {
  return (
    <div className="relative">
      <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-10 pr-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
}

/** Bulk edit modal with react-select/async (remote search) */
function BulkEditModal({ onClose, selectedCount, selectedIds, onSaved }) {
  const [saving, setSaving] = useState(false);

  // selected values
  const [catOpt, setCatOpt] = useState(null);
  const [brandOpt, setBrandOpt] = useState(null);
  const [suppOpt, setSuppOpt] = useState(null);

  const selectStyles = {
    menuPortal: (base) => ({ ...base, zIndex: 9999 }),
  };

  // remote fetchers
  const fetchOptions = async (endpoint, inputValue) => {
    const { data } = await axios.get(endpoint, {
      params: { q: inputValue || "", limit: 20 },
    });
    const list = normalizeList(data);
    return list.map((i) => ({ value: i.id, label: i.name }));
  };

  const loadCategories = useMemo(
    () => debouncePromise((input) => fetchOptions("/api/categories/search", input), 300),
    []
  );
  const loadBrands = useMemo(
    () => debouncePromise((input) => fetchOptions("/api/brands/search", input), 300),
    []
  );
  const loadSuppliers = useMemo(
    () => debouncePromise((input) => fetchOptions("/api/suppliers/search", input), 300),
    []
  );

  const submit = async () => {
    if (!catOpt && !brandOpt && !suppOpt) {
      toast.error("Choose at least one field to update.");
      return;
    }
    try {
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
      console.error(e);
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
        <div className="bg-white rounded-xl shadow-xl w-full max-w-xl">
          <div className="flex items-center justify-between p-4 border-b">
            <h2 className="text-lg font-semibold">Bulk Edit ({selectedCount} selected)</h2>
            <button className="p-2 rounded hover:bg-gray-100" onClick={onClose} title="Close">
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>

          <div className="p-4 space-y-4">
            <p className="text-sm text-gray-600">
              Leave any field blank to keep current values for that field.
            </p>

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
                  styles={selectStyles}
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
                  styles={selectStyles}
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
                  styles={selectStyles}
                  placeholder="(No change)"
                />
              </div>
            </div>
          </div>

          <div className="p-4 border-t flex items-center justify-end gap-2">
            <button className="px-4 py-2 rounded border" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button
              className={`px-4 py-2 rounded text-white ${
                saving ? "bg-emerald-400" : "bg-emerald-600 hover:bg-emerald-700"
              }`}
              onClick={submit}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
