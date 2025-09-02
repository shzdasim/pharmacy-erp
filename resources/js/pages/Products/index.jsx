import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  TrashIcon,
  PencilSquareIcon,
  PlusCircleIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
} from "@heroicons/react/24/solid";
import Select from "react-select";

export default function ProductsIndex() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);

  // search filters
  const [qName, setQName] = useState("");
  const [qBrand, setQBrand] = useState("");
  const [qSupplier, setQSupplier] = useState("");

  // pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // selection
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showBulkModal, setShowBulkModal] = useState(false);

  // lookups for modal
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [suppliers, setSuppliers] = useState([]);

  const navigate = useNavigate();

  // === Keyboard shortcut: Alt+N => navigate to /products/create ===
  useEffect(() => {
    const onKeyDown = (e) => {
      if (!e.altKey) return;
      const key = (e.key || "").toLowerCase();
      if (key !== "n") return;
      const tag = (e.target?.tagName || "").toLowerCase();
      const isTyping =
        ["input", "textarea", "select"].includes(tag) || e.target?.isContentEditable;
      if (isTyping) return;
      e.preventDefault();
      navigate("/products/create");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navigate]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const res = await axios.get("/api/products"); // now returns batches_count
      setProducts(res.data || []);
    } catch (err) {
      console.error("Error fetching products", err);
      toast.error("Failed to load products");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const norm = (v) => (v ?? "").toString().toLowerCase().trim();

  const filtered = useMemo(() => {
    const nName = norm(qName);
    const nBrand = norm(qBrand);
    const nSupp = norm(qSupplier);
    return products.filter((p) => {
      const name = norm(p.name);
      const brand = norm(p.brand?.name);
      const supp = norm(p.supplier?.name);
      return name.includes(nName) && brand.includes(nBrand) && supp.includes(nSupp);
    });
  }, [products, qName, qBrand, qSupplier]);

  // reset to first page when filters/pageSize change
  useEffect(() => {
    setPage(1);
  }, [qName, qBrand, qSupplier, pageSize]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const start = (page - 1) * pageSize;
  const paged = filtered.slice(start, start + pageSize);

  const handleDelete = async (product) => {
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

    toast(
      (t) => (
        <span>
          Are you sure you want to delete this product?
          <div className="mt-2 flex gap-2">
            <button
              className="bg-red-600 text-white px-3 py-1 rounded"
              onClick={async () => {
                toast.dismiss(t.id);
                try {
                  await axios.delete(`/api/products/${product.id}`);
                  toast.success("Product deleted");
                  // also unselect if it was selected
                  setSelectedIds((prev) => {
                    const copy = new Set(prev);
                    copy.delete(product.id);
                    return copy;
                  });
                  fetchProducts();
                } catch (err) {
                  const apiMsg =
                    err?.response?.data?.message ||
                    "Delete failed";
                  toast.error(apiMsg);
                }
              }}
            >
              Yes
            </button>
            <button
              className="bg-gray-300 px-3 py-1 rounded"
              onClick={() => toast.dismiss(t.id)}
            >
              No
            </button>
          </div>
        </span>
      ),
      { duration: 5000 }
    );
  };

  // selection helpers
  const toggleOne = (id, checked) => {
    setSelectedIds((prev) => {
      const copy = new Set(prev);
      if (checked) copy.add(id);
      else copy.delete(id);
      return copy;
    });
  };

  const pageAllChecked = paged.length > 0 && paged.every((p) => selectedIds.has(p.id));
  const pageIndeterminate = paged.some((p) => selectedIds.has(p.id)) && !pageAllChecked;

  const togglePageAll = (checked) => {
    setSelectedIds((prev) => {
      const copy = new Set(prev);
      if (checked) {
        paged.forEach((p) => copy.add(p.id));
      } else {
        paged.forEach((p) => copy.delete(p.id));
      }
      return copy;
    });
  };

  // bulk modal open: fetch lookups on first open
  const openBulkModal = async () => {
    try {
      setShowBulkModal(true);
      const reqs = [];
      if (categories.length === 0) reqs.push(axios.get("/api/categories"));
      if (brands.length === 0) reqs.push(axios.get("/api/brands"));
      if (suppliers.length === 0) reqs.push(axios.get("/api/suppliers"));
      const res = await Promise.all(reqs);
      let ci = 0;
      if (categories.length === 0) setCategories(res[ci++].data || []);
      if (brands.length === 0) setBrands(res[ci++].data || []);
      if (suppliers.length === 0) setSuppliers(res[ci++]?.data || []);
    } catch (e) {
      console.warn("Lookup endpoints missing; modal still opens.", e);
    }
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
        <div className="relative">
          <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={qName}
            onChange={(e) => setQName(e.target.value)}
            placeholder="Search by Product Name…"
            className="w-full pl-10 pr-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="relative">
          <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={qBrand}
            onChange={(e) => setQBrand(e.target.value)}
            placeholder="Search by Brand…"
            className="w-full pl-10 pr-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="relative">
          <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={qSupplier}
            onChange={(e) => setQSupplier(e.target.value)}
            placeholder="Search by Supplier…"
            className="w-full pl-10 pr-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Meta */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
        <div className="text-sm text-gray-600">
          {loading ? (
            <span>Loading…</span>
          ) : (
            <span>
              Showing{" "}
              <strong>
                {filtered.length === 0 ? 0 : start + 1}-{Math.min(filtered.length, start + pageSize)}
              </strong>{" "}
              of <strong>{products.length}</strong>{" "}
              {filtered.length !== products.length && (
                <> (filtered: <strong>{filtered.length}</strong>)</>
              )}
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
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="w-full overflow-x-auto rounded border">
        <table className="w-full">
          <thead className="bg-gray-50 sticky top-0">
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
            {paged.length === 0 && !loading && (
              <tr>
                <td className="border px-3 py-6 text-center text-gray-500" colSpan={8}>
                  No products found.
                </td>
              </tr>
            )}
            {paged.map((p) => {
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
                        onClick={() => handleDelete(p)}
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

      {/* Pagination */}
      <div className="mt-4 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="text-sm text-gray-600">Page {page} of {pageCount}</div>
        <div className="flex items-center gap-2">
          <button onClick={() => setPage(1)} disabled={page === 1} className="px-3 py-1 border rounded disabled:opacity-50">⏮ First</button>
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 border rounded disabled:opacity-50">◀ Prev</button>
          <button onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={page === pageCount} className="px-3 py-1 border rounded disabled:opacity-50">Next ▶</button>
          <button onClick={() => setPage(pageCount)} disabled={page === pageCount} className="px-3 py-1 border rounded disabled:opacity-50">Last ⏭</button>
        </div>
      </div>

      {/* Bulk Edit Modal */}
      {showBulkModal && (
        <BulkEditModal
          onClose={() => setShowBulkModal(false)}
          selectedCount={selectedIds.size}
          selectedIds={[...selectedIds]}
          categories={categories}
          brands={brands}
          suppliers={suppliers}
          onSaved={async () => {
            await fetchProducts();
            setShowBulkModal(false);
            setSelectedIds(new Set());
          }}
        />
      )}
    </div>
  );
}

/** Bulk edit modal with react-select (searchable) */
function BulkEditModal({ onClose, selectedCount, selectedIds, categories, brands, suppliers, onSaved }) {
  const [saving, setSaving] = useState(false);

  // react-select controlled values (single select)
  const [catOpt, setCatOpt] = useState(null);
  const [brandOpt, setBrandOpt] = useState(null);
  const [suppOpt, setSuppOpt] = useState(null);

  const catOptions = (categories || []).map((c) => ({ value: c.id, label: c.name }));
  const brandOptions = (brands || []).map((b) => ({ value: b.id, label: b.name }));
  const suppOptions = (suppliers || []).map((s) => ({ value: s.id, label: s.name }));

  const selectStyles = {
    menuPortal: (base) => ({ ...base, zIndex: 9999 }),
  };

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
                <Select
                  classNamePrefix="rs"
                  isSearchable
                  isClearable
                  options={catOptions}
                  value={catOpt}
                  onChange={setCatOpt}
                  menuPortalTarget={document.body}
                  styles={selectStyles}
                  placeholder="(No change)"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Brand</label>
                <Select
                  classNamePrefix="rs"
                  isSearchable
                  isClearable
                  options={brandOptions}
                  value={brandOpt}
                  onChange={setBrandOpt}
                  menuPortalTarget={document.body}
                  styles={selectStyles}
                  placeholder="(No change)"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Supplier</label>
                <Select
                  classNamePrefix="rs"
                  isSearchable
                  isClearable
                  options={suppOptions}
                  value={suppOpt}
                  onChange={setSuppOpt}
                  menuPortalTarget={document.body}
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
              className={`px-4 py-2 rounded text-white ${saving ? "bg-emerald-400" : "bg-emerald-600 hover:bg-emerald-700"}`}
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
