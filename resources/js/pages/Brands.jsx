import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import {
  MagnifyingGlassIcon,
  CheckCircleIcon,
  PencilSquareIcon,
  TrashIcon,
  ArrowUpTrayIcon,
  ArrowDownTrayIcon,
} from "@heroicons/react/24/solid";
import BrandImportModal from "../components/BrandImportModal.jsx";

export default function Brands() {
  const [brands, setBrands] = useState([]);
  const [form, setForm] = useState({ name: "", image: null });
  const [editingId, setEditingId] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [saving, setSaving] = useState(false);

  // search + pagination
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // focus + save
  const nameRef = useRef(null);
  const saveBtnRef = useRef(null);

  useEffect(() => {
    document.title = "Brands - Pharmacy ERP";
    fetchBrands();
  }, []);

  const fetchBrands = async () => {
    try {
      setLoading(true);
      const res = await axios.get("/api/brands");
      setBrands(res.data || []);
    } catch (err) {
      console.error("Failed to fetch brands", err);
      toast.error("Failed to load brands");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { nameRef.current?.focus(); }, [editingId]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.altKey && (e.key || "").toLowerCase() === "s") {
        e.preventDefault();
        handleSubmit();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, editingId]);

  const onEnterFocusSave = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      saveBtnRef.current?.focus();
    }
  };

  const handleInputChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleFileChange = (e) => {
    const file = e.target.files?.[0] ?? null;
    setForm((prev) => ({ ...prev, image: file }));
    if (file) setPreview(URL.createObjectURL(file));
    else setPreview(editingId ? (preview || null) : null);
  };

  const resetForm = () => {
    setForm({ name: "", image: null });
    setPreview(null);
    setEditingId(null);
    setTimeout(() => nameRef.current?.focus(), 0);
  };

  const handleSubmit = async () => {
    if (saving) return;
    const name = (form.name || "").trim();
    if (!name) {
      toast.error("Name is required");
      nameRef.current?.focus();
      return;
    }
    try {
      setSaving(true);
      const data = new FormData();
      data.append("name", name);
      if (form.image) data.append("image", form.image);

      if (editingId) {
        data.append("_method", "PUT");
        await axios.post(`/api/brands/${editingId}`, data, { headers: { "Content-Type": "multipart/form-data" } });
        toast.success("Brand updated");
      } else {
        await axios.post("/api/brands", data, { headers: { "Content-Type": "multipart/form-data" } });
        toast.success("Brand saved");
      }

      resetForm();
      fetchBrands();
    } catch (err) {
      const msg = err?.response?.data?.message
        || err?.response?.data?.errors?.name?.[0]
        || err?.response?.data?.errors?.image?.[0]
        || "Save failed";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (b) => {
    setForm({ name: b.name, image: null });
    setEditingId(b.id);
    setPreview(b.image ? `/storage/${b.image}` : null);
  };

  const handleDelete = async (b) => {
    const used = Number(b.products_count || 0) > 0;
    if (used) return toast.error("Cannot delete: brand is used by products.");
    try {
      await axios.delete(`/api/brands/${b.id}`);
      setBrands((prev) => prev.filter((x) => x.id !== b.id));
      if (editingId === b.id) resetForm();
      toast.success("Brand deleted");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Could not delete brand.");
    }
  };

  const handleButtonKeyDown = (e, action) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault(); action();
    }
  };

  // export all brands
  const handleExport = async () => {
    try {
      setExporting(true);
      const res = await axios.get("/api/brands/export", { responseType: "blob" });
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      const filename = `brands_${stamp}.csv`;
      const blob = new Blob([res.data], { type: "text/csv;charset=utf-8" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      toast.error("Export failed");
    } finally {
      setExporting(false);
    }
  };

  // search + pagination
  const norm = (v) => (v ?? "").toString().toLowerCase().trim();
  const filtered = useMemo(() => {
    const needle = norm(q);
    if (!needle) return brands;
    return brands.filter((b) => norm(b.name).includes(needle));
  }, [brands, q]);

  useEffect(() => { setPage(1); }, [q, pageSize]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);

  const start = (page - 1) * pageSize;
  const paged = filtered.slice(start, start + pageSize);

  return (
    <div className="p-6">
      {/* header + search */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
        <h1 className="text-2xl font-bold">Brands</h1>
        <div className="relative w-full md:w-80">
          <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search brand by name…"
            className="w-full pl-10 pr-3 h-9 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* form */}
      <form onSubmit={(e) => e.preventDefault()} className="mb-4" encType="multipart/form-data">
        <div className="flex flex-col gap-2">
          <div className="flex flex-col md:flex-row md:items-end md:gap-2">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs text-gray-700 mb-1">Name</label>
              <input
                type="text" name="name" placeholder="Brand Name"
                className="border rounded px-2 h-9 text-sm w-full"
                value={form.name} onChange={handleInputChange}
                onKeyDown={onEnterFocusSave} ref={nameRef} required
              />
            </div>
            <div className="w-full md:w-[24rem]">
              <label className="block text-xs text-gray-700 mb-1">Image (optional)</label>
              <input
                key={editingId || "new"} type="file" name="image" accept="image/*"
                onChange={handleFileChange}
                className="border rounded h-9 text-sm w-full file:mr-3 file:px-3 file:py-1 file:text-sm file:rounded file:border-0 file:bg-gray-100"
              />
            </div>
            {preview && (
              <div className="w-full md:w-28">
                <label className="block text-xs text-gray-700 mb-1">Preview</label>
                <img src={preview} alt="Preview" className="w-24 h-24 object-contain border rounded bg-white" />
              </div>
            )}
          </div>

          <div className="flex items-center justify-end">
            <button
              type="button" onClick={handleSubmit} ref={saveBtnRef}
              title="Save (Alt+S)" aria-keyshortcuts="Alt+S"
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

      {/* meta */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-2">
        <div className="text-sm text-gray-600">
          {loading ? "Loading…" : (
            <>
              Showing <strong>{filtered.length === 0 ? 0 : start + 1}-{Math.min(filtered.length, start + pageSize)}</strong>
              {" "}of <strong>{brands.length}</strong>
              {filtered.length !== brands.length && <> (filtered: <strong>{filtered.length}</strong>)</>}
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Rows per page</label>
          <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}
                  className="border rounded px-2 h-9 text-sm">
            <option value={10}>10</option><option value={25}>25</option><option value={50}>50</option>
          </select>
        </div>
      </div>

      {/* table with toolbar in header */}
      <div className="w-full overflow-x-auto rounded border">
        <table className="w-full">
          <thead className="bg-gray-50 sticky top-0 z-10">
            {/* Toolbar row */}
            <tr>
              <th colSpan={3} className="border p-2">
                <div className="flex items-center justify-start gap-2">
                  <button
                    onClick={() => setImportOpen(true)}
                    onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setImportOpen(true))}
                    className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-3 h-9 rounded text-sm"
                    title="Import Brands (CSV)" aria-label="Import brands from CSV"
                  >
                    <ArrowUpTrayIcon className="w-5 h-5" />
                    Import CSV
                  </button>
                  <button
                    onClick={handleExport} disabled={exporting}
                    onKeyDown={(e)=> (e.key==="Enter"||e.key===" ") && (e.preventDefault(), handleExport())}
                    className={`inline-flex items-center gap-2 px-3 h-9 rounded text-sm border ${
                      exporting ? "bg-gray-200 text-gray-600 cursor-not-allowed"
                                : "bg-white hover:bg-gray-50 text-gray-800 border-gray-300"
                    }`}
                    title="Export all brands to CSV" aria-label="Export all brands to CSV"
                  >
                    <ArrowDownTrayIcon className="w-5 h-5" />
                    {exporting ? "Exporting…" : "Export CSV"}
                  </button>
                </div>
              </th>
            </tr>
            {/* column labels */}
            <tr>
              <th className="border p-2 text-left">Name</th>
              <th className="border p-2 text-left">Image</th>
              <th className="border p-2 text-center">Actions</th>
            </tr>
          </thead>

          <tbody>
            {paged.length === 0 && !loading && (
              <tr>
                <td className="border px-3 py-6 text-center text-gray-500" colSpan={3}>No brands found.</td>
              </tr>
            )}
            {paged.map((b) => {
              const used = Number(b.products_count || 0) > 0;
              return (
                <tr key={b.id} className="odd:bg-white even:bg-gray-50 hover:bg-blue-50 transition-colors">
                  <td className="border p-2">{b.name}</td>
                  <td className="border p-2">
                    {b.image ? (
                      <img src={`/storage/${b.image}`} alt={b.name} className="w-16 h-16 object-contain border rounded bg-white" />
                    ) : <span className="text-gray-500 text-sm">No image</span>}
                  </td>
                  <td className="border p-2">
                    <div className="flex gap-2 justify-center">
                      <button
                        onClick={() => handleEdit(b)}
                        onKeyDown={(e) => handleButtonKeyDown(e, () => handleEdit(b))}
                        tabIndex={0}
                        className="bg-yellow-500 text-white px-3 h-9 text-sm rounded inline-flex items-center gap-1"
                        aria-label={`Edit brand ${b.name}`}
                      >
                        <PencilSquareIcon className="w-5 h-5" />
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(b)}
                        onKeyDown={(e) => handleButtonKeyDown(e, () => handleDelete(b))}
                        tabIndex={0}
                        disabled={used}
                        title={used ? "Cannot delete: brand is used by products." : "Delete"}
                        className={`px-3 h-9 text-sm rounded inline-flex items-center gap-1 ${
                          used ? "bg-gray-300 text-gray-600 cursor-not-allowed" : "bg-red-600 text-white"
                        }`}
                        aria-label={`Delete brand ${b.name}`}
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

      {/* pagination */}
      <div className="mt-4 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="text-sm text-gray-600">Page {page} of {pageCount}</div>
        <div className="flex items-center gap-2">
          <button onClick={() => setPage(1)} disabled={page === 1} className="px-3 py-1 border rounded disabled:opacity-50">⏮ First</button>
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 border rounded disabled:opacity-50">◀ Prev</button>
          <button onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={page === pageCount} className="px-3 py-1 border rounded disabled:opacity-50">Next ▶</button>
          <button onClick={() => setPage(pageCount)} disabled={page === pageCount} className="px-3 py-1 border rounded disabled:opacity-50">Last ⏭</button>
        </div>
      </div>

      {/* Import modal */}
      <BrandImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={fetchBrands}
      />
    </div>
  );
}
