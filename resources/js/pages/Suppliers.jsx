import { useState, useEffect, useMemo, useRef } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import {
  MagnifyingGlassIcon,
  CheckCircleIcon,
  PencilSquareIcon,
  TrashIcon,
} from "@heroicons/react/24/solid";
import SupplierImportModal from "../components/SupplierImportModal.jsx"; // adjust path if needed
export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [form, setForm] = useState({ name: "", address: "", phone: "" });
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  // Search + pagination
  const [qName, setQName] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Refs for focus control
  const nameRef = useRef(null);
  const addressRef = useRef(null);
  const phoneRef = useRef(null);
  const saveBtnRef = useRef(null);

  const [saving, setSaving] = useState(false);

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      // Expecting products_count in payload to guard deletes
      const res = await axios.get("/api/suppliers");
      setSuppliers(res.data || []);
    } catch (err) {
      console.error("Failed to fetch suppliers", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  // Focus name on mount and when switching edit/add mode
  useEffect(() => {
    nameRef.current?.focus();
  }, [editingId]);

  // Alt+S -> Save
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.altKey && (e.key || "").toLowerCase() === "s") {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, editingId]);

  // Prevent Enter submit; move to next field instead
  const onEnterFocusNext = (e, nextRef) => {
    if (e.key === "Enter") {
      e.preventDefault();
      nextRef?.current?.focus();
    }
  };

  const resetForm = () => {
    setForm({ name: "", address: "", phone: "" });
    setEditingId(null);
    setTimeout(() => nameRef.current?.focus(), 0);
  };

  const handleSave = async () => {
    if (saving) return;
    if (!form.name.trim()) {
      toast.error("Name is required");
      nameRef.current?.focus();
      return;
    }
    try {
      setSaving(true);
      if (editingId) {
        await axios.put(`/api/suppliers/${editingId}`, form);
        toast.success("Supplier updated");
      } else {
        await axios.post("/api/suppliers", form);
        toast.success("Supplier saved");
      }
      resetForm();
      fetchSuppliers();
    } catch (err) {
      console.error("Failed to save supplier", err);
      toast.error("Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (supplier) => {
    setForm({
      name: supplier.name || "",
      address: supplier.address || "",
      phone: supplier.phone || "",
    });
    setEditingId(supplier.id);
  };

  const handleDelete = async (s) => {
    try {
      await axios.delete(`/api/suppliers/${s.id}`);
      setSuppliers((prev) => prev.filter((x) => Number(x.id) !== Number(s.id)));
      if (Number(editingId) === Number(s.id)) resetForm();
      toast.success("Supplier deleted");
    } catch (err) {
      const msg = err?.response?.data?.message || "Delete failed";
      toast.error(msg);
    }
  };

  const handleButtonKeyDown = (e, action) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      action();
    }
  };

  // ===== Search + pagination (client-side) =====
  const norm = (v) => (v ?? "").toString().toLowerCase().trim();
  const filtered = useMemo(() => {
    const needle = norm(qName);
    if (!needle) return suppliers;
    return suppliers.filter((s) => norm(s.name).includes(needle));
  }, [suppliers, qName]);

  useEffect(() => {
    setPage(1);
  }, [qName, pageSize]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const start = (page - 1) * pageSize;
  const paged = filtered.slice(start, start + pageSize);

  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
        <h1 className="text-2xl font-bold">Suppliers</h1>

        {/* Search by name */}
        <div className="relative w-full md:w-80">
          <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={qName}
            onChange={(e) => setQName(e.target.value)}
            placeholder="Search supplier by name…"
            className="w-full pl-10 pr-3 h-9 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Compact inline form: inputs on one row; button on NEW row with icon */}
      <form onSubmit={(e) => e.preventDefault()} className="mb-4">
        <div className="flex flex-col gap-2">
          {/* Inputs row */}
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:gap-2">
            <div className="flex-1 min-w-[180px]">
              <label className="block text-xs text-gray-700 mb-1">Name</label>
              <input
                type="text"
                placeholder="Name"
                className="border rounded px-2 h-9 text-sm w-full"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                onKeyDown={(e) => onEnterFocusNext(e, addressRef)}
                ref={nameRef}
                required
              />
            </div>

            <div className="flex-1 min-w-[220px]">
              <label className="block text-xs text-gray-700 mb-1">Address</label>
              <input
                type="text"
                placeholder="Address"
                className="border rounded px-2 h-9 text-sm w-full"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                onKeyDown={(e) => onEnterFocusNext(e, phoneRef)}
                ref={addressRef}
              />
            </div>

            <div className="w-full md:w-56">
              <label className="block text-xs text-gray-700 mb-1">Phone</label>
              <input
                type="text"
                placeholder="Phone"
                className="border rounded px-2 h-9 text-sm w-full"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                onKeyDown={(e) => onEnterFocusNext(e, saveBtnRef)}
                ref={phoneRef}
              />
            </div>
          </div>

          {/* Button row */}
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={handleSave}
              ref={saveBtnRef}
              title="Save (Alt+S)"
              aria-keyshortcuts="Alt+S"
              className={`inline-flex items-center justify-center gap-2 px-4 h-10 rounded text-white text-sm min-w-[140px] md:w-44 ${
                saving ? "bg-blue-400" : "bg-blue-600 hover:bg-blue-700"
              }`}
              disabled={saving}
            >
              <CheckCircleIcon className="w-5 h-5" />
              {editingId ? (saving ? "Updating…" : "Update") : (saving ? "Saving…" : "Save")}
            </button>
          </div>
          <div className="text-[11px] text-gray-500 md:text-right">Shortcut: Alt+S</div>
        </div>
      </form>

      {/* Meta */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-2">
        <div className="text-sm text-gray-600">
          {loading ? (
            "Loading…"
          ) : (
            <>
              Showing{" "}
              <strong>
                {filtered.length === 0 ? 0 : start + 1}-{Math.min(filtered.length, start + pageSize)}
              </strong>{" "}
              of <strong>{suppliers.length}</strong>{" "}
              {filtered.length !== suppliers.length && <> (filtered: <strong>{filtered.length}</strong>)</>}
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Rows per page</label>
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="border rounded px-2 h-9 text-sm"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>
        </div>
      </div>
      {/* Header row with Import button */}
  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
    <h1 className="text-2xl font-bold">Suppliers</h1>

    <div className="flex items-center gap-2">
      {/* Import button */}
      <button
        onClick={() => setImportOpen(true)}
        className="bg-indigo-600 hover:bg-indigo-700 text-white h-9 px-4 rounded text-sm"
      >
        Import CSV
      </button>

      {/* existing Search by name */}
      <div className="relative w-full md:w-80">
        {/* ... your existing search input ... */}
      </div>
    </div>
  </div>

  {/* At end of component JSX */}
  <SupplierImportModal
    open={importOpen}
    onClose={() => setImportOpen(false)}
    onImported={fetchSuppliers}
  />
      {/* Table */}
      <div className="w-full overflow-x-auto rounded border">
        <table className="w-full">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="border p-2 text-left">Name</th>
              <th className="border p-2 text-left">Address</th>
              <th className="border p-2 text-left">Phone</th>
              <th className="border p-2 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 && !loading && (
              <tr>
                <td className="border px-3 py-6 text-center text-gray-500" colSpan={4}>
                  No suppliers found.
                </td>
              </tr>
            )}
            {paged.map((s) => {
              const used = Number(s.products_count || 0) > 0;
              return (
                <tr key={s.id} className="odd:bg-white even:bg-gray-50 hover:bg-blue-50 transition-colors">
                  <td className="border p-2">{s.name}</td>
                  <td className="border p-2">{s.address}</td>
                  <td className="border p-2">{s.phone}</td>
                  <td className="border p-2">
                    <div className="flex gap-2 justify-center">
                      <button
                        onClick={() => handleEdit(s)}
                        onKeyDown={(e) => handleButtonKeyDown(e, () => handleEdit(s))}
                        tabIndex={0}
                        className="bg-yellow-500 text-white px-3 h-9 text-sm rounded inline-flex items-center gap-1"
                        aria-label={`Edit supplier ${s.name}`}
                      >
                        <PencilSquareIcon className="w-5 h-5" />
                        Edit
                      </button>
                      <button
                        onClick={() =>
                          used
                            ? toast.error("Cannot delete: supplier is used by products.")
                            : handleDelete(s)
                        }
                        onKeyDown={(e) =>
                          handleButtonKeyDown(e, () =>
                            used
                              ? toast.error("Cannot delete: supplier is used by products.")
                              : handleDelete(s)
                          )
                        }
                        tabIndex={0}
                        disabled={used}
                        title={used ? "Cannot delete: supplier is used by products." : "Delete"}
                        className={`px-3 h-9 text-sm rounded inline-flex items-center gap-1 ${
                          used ? "bg-gray-300 text-gray-600 cursor-not-allowed" : "bg-red-600 text-white"
                        }`}
                        aria-label={`Delete supplier ${s.name}`}
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
    </div>
  );
}
