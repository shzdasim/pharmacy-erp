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
import CategoryImportModal from "../components/CategoryImportModel.jsx";

export default function Categories() {
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({ name: "" });
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [qName, setQName] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [importOpen, setImportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const nameRef = useRef(null);
  const saveBtnRef = useRef(null);

  useEffect(() => {
    document.title = "Categories - Pharmacy ERP";
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const res = await axios.get("/api/categories");
      setCategories(res.data || []);
    } catch (err) {
      console.error("Failed to fetch categories", err);
      toast.error("Failed to load categories");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { nameRef.current?.focus(); }, [editingId]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.altKey && (e.key || "").toLowerCase() === "s") {
        e.preventDefault(); handleSave();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, editingId]);

  const onEnterFocusNext = (e) => {
    if (e.key === "Enter") { e.preventDefault(); saveBtnRef.current?.focus(); }
  };

  const resetForm = () => {
    setForm({ name: "" }); setEditingId(null);
    setTimeout(() => nameRef.current?.focus(), 0);
  };

  const handleSave = async () => {
    if (saving) return;
    const name = (form.name || "").trim();
    if (!name) { toast.error("Name is required"); nameRef.current?.focus(); return; }

    try {
      setSaving(true);
      if (editingId) {
        await axios.put(`/api/categories/${editingId}`, { name });
        toast.success("Category updated");
      } else {
        await axios.post("/api/categories", { name });
        toast.success("Category saved");
      }
      resetForm(); fetchCategories();
    } catch (err) {
      const msg = err?.response?.data?.message || err?.response?.data?.errors?.name?.[0] || "Save failed";
      toast.error(msg);
    } finally { setSaving(false); }
  };

  const handleEdit = (c) => { setForm({ name: c.name || "" }); setEditingId(c.id); };

  const handleDelete = async (c) => {
    try {
      await axios.delete(`/api/categories/${c.id}`);
      setCategories((prev) => prev.filter((x) => x.id !== c.id));
      if (editingId === c.id) resetForm();
      toast.success("Category deleted");
    } catch (err) { toast.error(err?.response?.data?.message || "Could not delete category."); }
  };

  const handleButtonKeyDown = (e, action) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); action(); }
  };

  // Export all categories
  const handleExport = async () => {
    try {
      setExporting(true);
      const res = await axios.get("/api/categories/export", { responseType: "blob" });
      const stamp = new Date().toISOString().slice(0,19).replace(/[:T]/g,"-");
      const filename = `categories_${stamp}.csv`;
      const blob = new Blob([res.data], { type: "text/csv;charset=utf-8" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) { console.error(e); toast.error("Export failed"); }
    finally { setExporting(false); }
  };

  // search + pagination
  const norm = (v) => (v ?? "").toString().toLowerCase().trim();
  const filtered = useMemo(() => {
    const needle = norm(qName);
    if (!needle) return categories;
    return categories.filter((c) => norm(c.name).includes(needle));
  }, [categories, qName]);

  useEffect(() => { setPage(1); }, [qName, pageSize]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);

  const start = (page - 1) * pageSize;
  const paged = filtered.slice(start, start + pageSize);

  return (
    <div className="p-6">
      {/* header + search */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
        <h1 className="text-2xl font-bold">Categories</h1>
        <div className="relative w-full md:w-80">
          <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={qName}
            onChange={(e) => setQName(e.target.value)}
            placeholder="Search category by name…"
            className="w-full pl-10 pr-3 h-9 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* form */}
      <form onSubmit={(e)=>e.preventDefault()} className="mb-4">
        <div className="flex flex-col gap-2">
          <div className="flex flex-col md:flex-row md:items-end md:gap-2">
            <div className="w-full md:w-80">
              <label className="block text-xs text-gray-700 mb-1">Name</label>
              <input
                type="text" placeholder="Category Name"
                className="border rounded px-2 h-9 text-sm w-full"
                value={form.name}
                onChange={(e)=>setForm({ name: e.target.value })}
                onKeyDown={onEnterFocusNext}
                ref={nameRef} required
              />
            </div>
          </div>

          <div className="flex items-center justify-end">
            <button
              type="button" onClick={handleSave} ref={saveBtnRef}
              title="Save (Alt+S)" aria-keyshortcuts="Alt+S"
              className={`inline-flex items-center justify-center gap-2 px-4 h-10 rounded text-white text-sm min-w-[140px] md:w-44 ${
                saving ? "bg-blue-400" : "bg-blue-600 hover:bg-blue-700"
              }`} disabled={saving}
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
            <>Showing <strong>{filtered.length===0?0:start+1}-{Math.min(filtered.length, start+pageSize)}</strong> of <strong>{categories.length}</strong>
              {filtered.length!==categories.length && <> (filtered: <strong>{filtered.length}</strong>)</>}
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Rows per page</label>
          <select value={pageSize} onChange={(e)=>setPageSize(Number(e.target.value))}
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
              <th colSpan={2} className="border p-2">
                <div className="flex items-center justify-start gap-2">
                  <button
                    onClick={() => setImportOpen(true)}
                    onKeyDown={(e)=> (e.key==="Enter"||e.key===" ") && (e.preventDefault(), setImportOpen(true))}
                    className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-3 h-9 rounded text-sm"
                    title="Import Categories (CSV)" aria-label="Import categories from CSV"
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
                    title="Export all categories to CSV" aria-label="Export all categories to CSV"
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
              <th className="border p-2 text-center">Actions</th>
            </tr>
          </thead>

          <tbody>
            {paged.length === 0 && !loading && (
              <tr>
                <td className="border px-3 py-6 text-center text-gray-500" colSpan={2}>No categories found.</td>
              </tr>
            )}
            {paged.map((c) => {
              const used = Number(c.products_count || 0) > 0;
              return (
                <tr key={c.id} className="odd:bg-white even:bg-gray-50 hover:bg-blue-50 transition-colors">
                  <td className="border p-2">{c.name}</td>
                  <td className="border p-2">
                    <div className="flex gap-2 justify-center">
                      <button
                        onClick={() => handleEdit(c)}
                        onKeyDown={(e)=>handleButtonKeyDown(e, ()=>handleEdit(c))}
                        tabIndex={0}
                        className="bg-yellow-500 text-white px-3 h-9 text-sm rounded inline-flex items-center gap-1"
                        aria-label={`Edit category ${c.name}`}
                      >
                        <PencilSquareIcon className="w-5 h-5" />
                        Edit
                      </button>
                      <button
                        onClick={() =>
                          used ? toast.error("Cannot delete: category is used by products.")
                               : handleDelete(c)
                        }
                        onKeyDown={(e)=>handleButtonKeyDown(e, () =>
                          used ? toast.error("Cannot delete: category is used by products.")
                               : handleDelete(c)
                        )}
                        tabIndex={0}
                        disabled={used}
                        title={used ? "Cannot delete: category is used by products." : "Delete"}
                        className={`px-3 h-9 text-sm rounded inline-flex items-center gap-1 ${
                          used ? "bg-gray-300 text-gray-600 cursor-not-allowed" : "bg-red-600 text-white"
                        }`}
                        aria-label={`Delete category ${c.name}`}
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
          <button onClick={() => setPage((p)=>Math.max(1,p-1))} disabled={page===1} className="px-3 py-1 border rounded disabled:opacity-50">◀ Prev</button>
          <button onClick={() => setPage((p)=>Math.min(pageCount,p+1))} disabled={page===pageCount} className="px-3 py-1 border rounded disabled:opacity-50">Next ▶</button>
          <button onClick={() => setPage(pageCount)} disabled={page===pageCount} className="px-3 py-1 border rounded disabled:opacity-50">Last ⏭</button>
        </div>
      </div>

      {/* Import modal */}
      <CategoryImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={fetchCategories}
      />
    </div>
  );
}
