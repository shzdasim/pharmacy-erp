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
import { usePermissions, Guard } from "@/api/usePermissions.js"; // 🔒

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

  // 🔒 permissions
  const { loading: permsLoading, canFor } = usePermissions();
  const can = useMemo(
    () =>
      (typeof canFor === "function" ? canFor("category") : null) ?? {
        view: false,
        create: false,
        update: false,
        delete: false,
        import: false,
        export: false,
      },
    [canFor]
  );

  useEffect(() => {
    document.title = "Categories - Pharmacy ERP";
  }, []);

  // Fetch only when user can view
  useEffect(() => {
    if (permsLoading || !can.view) return;
    fetchCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permsLoading, can.view]);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const res = await axios.get("/api/categories");
      setCategories(res.data || []);
    } catch (err) {
      const status = err?.response?.status;
      if (status === 403) toast.error("You don't have permission to view categories.");
      else toast.error("Failed to load categories");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { nameRef.current?.focus(); }, [editingId]);

  // 🔒 disable Alt+S if cannot create/update
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.altKey && (e.key || "").toLowerCase() === "s") {
        if (!can.create && !can.update) return;
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [form, editingId, can.create, can.update]);

  const onEnterFocusNext = (e) => {
    if (e.key === "Enter") { e.preventDefault(); saveBtnRef.current?.focus(); }
  };

  const resetForm = () => {
    setForm({ name: "" }); setEditingId(null);
    setTimeout(() => nameRef.current?.focus(), 0);
  };

  const handleSave = async () => {
    // 🔒 guard
    if (editingId ? !can.update : !can.create) {
      toast.error("You don't have permission to save categories.");
      return;
    }
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
      const status = err?.response?.status;
      if (status === 403) {
        toast.error("You don't have permission to save categories.");
      } else {
        const msg = err?.response?.data?.message || err?.response?.data?.errors?.name?.[0] || "Save failed";
        toast.error(msg);
      }
    } finally { setSaving(false); }
  };

  const handleEdit = (c) => {
    if (!can.update) return toast.error("You don't have permission to edit categories.");
    setForm({ name: c.name || "" });
    setEditingId(c.id);
  };

  const handleDelete = async (c) => {
    if (!can.delete) return toast.error("You don't have permission to delete categories.");
    try {
      await axios.delete(`/api/categories/${c.id}`);
      setCategories((prev) => prev.filter((x) => x.id !== c.id));
      if (editingId === c.id) resetForm();
      toast.success("Category deleted");
    } catch (err) {
      const status = err?.response?.status;
      if (status === 403) toast.error("You don't have permission to delete categories.");
      else toast.error(err?.response?.data?.message || "Could not delete category.");
    }
  };

  const handleButtonKeyDown = (e, action) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); action(); }
  };

  // 🔒 Export
  const handleExport = async () => {
    if (!can.export) return toast.error("You don't have permission to export categories.");
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
    } catch (e) {
      const status = e?.response?.status;
      if (status === 403) toast.error("You don't have permission to export categories.");
      else toast.error("Export failed");
    } finally { setExporting(false); }
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

  if (permsLoading) return <div className="p-6">Loading…</div>;
  if (!can.view) return <div className="p-6 text-sm text-gray-700">You don’t have permission to view categories.</div>;

  const hasActions = can.update || can.delete;
  const colSpan = 1 + (hasActions ? 1 : 0);

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

      {/* 🔒 show form only if can create/update */}
      <Guard when={can.create || can.update}>
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
                  disabled={!can.create && !editingId}
                />
              </div>
            </div>

            <div className="flex items-center justify-end">
              <button
                type="button" onClick={handleSave} ref={saveBtnRef}
                title={(editingId ? "Update" : "Save") + " (Alt+S)"} aria-keyshortcuts="Alt+S"
                className={`inline-flex items-center justify-center gap-2 px-4 h-10 rounded text-white text-sm min-w-[140px] md:w-44 ${
                  saving ? "bg-blue-400" : "bg-blue-600 hover:bg-blue-700"
                }`}
                disabled={saving || (!can.create && !can.update)}
              >
                <CheckCircleIcon className="w-5 h-5" />
                {editingId ? (saving ? "Updating…" : "Update") : (saving ? "Saving…" : "Save")}
              </button>
            </div>
            <div className="text-[11px] text-gray-500 md:text-right">Shortcut: Alt+S</div>
          </div>
        </form>
      </Guard>

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

      {/* table + toolbar */}
      <div className="w-full overflow-x-auto rounded border">
        <table className="w-full">
          <thead className="bg-gray-50 sticky top-0 z-10">
            {/* Toolbar row (colSpan matches visible columns) */}
            {(can.import || can.export) && (
              <tr>
                <th colSpan={colSpan} className="border p-2">
                  <div className="flex items-center justify-start gap-2">
                    <Guard when={can.import}>
                      <button
                        onClick={() => setImportOpen(true)}
                        onKeyDown={(e)=> (e.key==="Enter"||e.key===" ") && (e.preventDefault(), setImportOpen(true))}
                        className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-3 h-9 rounded text-sm"
                        title="Import Categories (CSV)" aria-label="Import categories from CSV"
                      >
                        <ArrowUpTrayIcon className="w-5 h-5" />
                        Import CSV
                      </button>
                    </Guard>
                    <Guard when={can.export}>
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
                    </Guard>
                  </div>
                </th>
              </tr>
            )}

            {/* column labels */}
            <tr>
              <th className="border p-2 text-left">Name</th>
              {hasActions && <th className="border p-2 text-center">Actions</th>}
            </tr>
          </thead>

          <tbody>
            {paged.length === 0 && !loading && (
              <tr>
                <td className="border px-3 py-6 text-center text-gray-500" colSpan={colSpan}>No categories found.</td>
              </tr>
            )}
            {paged.map((c) => {
              const used = Number(c.products_count || 0) > 0;
              return (
                <tr key={c.id} className="odd:bg-white even:bg-gray-50 hover:bg-blue-50 transition-colors">
                  <td className="border p-2">{c.name}</td>
                  {hasActions && (
                    <td className="border p-2">
                      <div className="flex gap-2 justify-center">
                        {/* 🔒 Edit */}
                        <Guard when={can.update}>
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
                        </Guard>

                        {/* 🔒 Delete */}
                        <Guard when={can.delete}>
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
