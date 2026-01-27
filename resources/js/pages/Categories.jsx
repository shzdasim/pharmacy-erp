// src/pages/Categories.jsx
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import {
  MagnifyingGlassIcon,
  CheckCircleIcon,
  PencilSquareIcon,
  TrashIcon,
  ArrowUpTrayIcon,
  ArrowDownTrayIcon,
  XMarkIcon,
  ArrowPathIcon,
  PlusIcon,
  Squares2X2Icon,
} from "@heroicons/react/24/solid";
import CategoryImportModal from "../components/CategoryImportModel.jsx";
import { usePermissions, Guard } from "@/api/usePermissions.js"; // 🔒
import {
  GlassCard,
  GlassSectionHeader,
  GlassToolbar,
  GlassInput,
  GlassBtn,
} from "@/components/glass.jsx"; // ⬅️ as requested

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

  const fetchCategories = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    if (permsLoading || !can.view) return;
    fetchCategories();
  }, [permsLoading, can.view, fetchCategories]);

  useEffect(() => { nameRef.current?.focus(); }, [editingId]);

  // 🔒 Alt+S save
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
    setForm({ name: "" });
    setEditingId(null);
    setTimeout(() => nameRef.current?.focus(), 0);
  };

  const handleSave = async () => {
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
      resetForm();
      fetchCategories();
    } catch (err) {
      const status = err?.response?.status;
      if (status === 403) toast.error("You don't have permission to save categories.");
      else {
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
      const used = Number(c.products_count || 0) > 0;
      if (used) return toast.error("Cannot delete: category is used by products.");
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

  // 🧊 iOS-style “tinted glass” helpers (color + subtle ring + blur already in GlassBtn base)
  const tintBlue   = "bg-blue-500/85 text-white shadow-[0_6px_20px_-6px_rgba(37,99,235,0.45)] ring-1 ring-white/20 hover:bg-blue-500/95";
  const tintIndigo = "bg-indigo-500/85 text-white shadow-[0_6px_20px_-6px_rgba(99,102,241,0.45)] ring-1 ring-white/20 hover:bg-indigo-500/95";
  const tintSlate  = "bg-slate-900/80 text-white shadow-[0_6px_20px_-6px_rgba(15,23,42,0.45)] ring-1 ring-white/15 hover:bg-slate-900/90";
  const tintAmber  = "bg-amber-500/85 text-white shadow-[0_6px_20px_-6px_rgba(245,158,11,0.45)] ring-1 ring-white/20 hover:bg-amber-500/95";
  const tintRed    = "bg-rose-500/85 text-white shadow-[0_6px_20px_-6px_rgba(244,63,94,0.45)] ring-1 ring-white/20 hover:bg-rose-500/95";
  const tintGlass  = "bg-white/60 text-slate-700 ring-1 ring-white/30 hover:bg-white/75"; // neutral glass

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header card */}
      <GlassCard>
        <GlassSectionHeader
          title={
            <span className="inline-flex items-center gap-2">
              <Squares2X2Icon className="w-5 h-5 text-blue-600" />
              <span>Categories</span>
            </span>
          }
          right={
            <div className="flex items-center gap-2">
              <GlassBtn
                className={`h-10 min-w-[128px] ${tintSlate}`}
                onClick={fetchCategories}
                title="Refresh"
                aria-label="Refresh list"
              >
                <span className="inline-flex items-center gap-2">
                  <ArrowPathIcon className="w-5 h-5" />
                  Refresh
                </span>
              </GlassBtn>
            </div>
          }
        />
        <GlassToolbar className="gap-3">
          <div className="relative w-full md:w-96">
            <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <GlassInput
              value={qName}
              onChange={(e) => setQName(e.target.value)}
              placeholder="Search category by name…"
              className="pl-10 w-full"
              aria-label="Search categories"
            />
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Guard when={can.import}>
              <GlassBtn
                className={`h-10 min-w-[150px] ${tintIndigo}`}
                onClick={() => setImportOpen(true)}
                title="Import Categories (CSV)"
                aria-label="Import categories from CSV"
              >
                <span className="inline-flex items-center gap-2">
                  <ArrowUpTrayIcon className="w-5 h-5" />
                  Import CSV
                </span>
              </GlassBtn>
            </Guard>

            <Guard when={can.export}>
              <GlassBtn
                className={`h-10 min-w-[150px] ${tintGlass}`}
                onClick={handleExport}
                disabled={exporting}
                title="Export all categories to CSV"
                aria-label="Export all categories to CSV"
              >
                <span className="inline-flex items-center gap-2">
                  <ArrowDownTrayIcon className="w-5 h-5" />
                  {exporting ? "Exporting…" : "Export CSV"}
                </span>
              </GlassBtn>
            </Guard>
          </div>
        </GlassToolbar>
      </GlassCard>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Form card */}
        <Guard when={can.create || (can.update && (editingId !== null))}>
          <GlassCard className="lg:col-span-1">
            <GlassSectionHeader
              title={
                <span className="inline-flex items-center gap-2">
                  {editingId ? (
                    <>
                      <PencilSquareIcon className="w-5 h-5 text-amber-600" />
                      <span>Edit Category</span>
                    </>
                  ) : (
                    <>
                      <PlusIcon className="w-5 h-5 text-blue-600" />
                      <span>Add Category</span>
                    </>
                  )}
                </span>
              }
              right={
                editingId ? (
                  <GlassBtn
                    className={`h-9 px-3 ${tintGlass}`}
                    onClick={resetForm}
                    title="Cancel editing"
                  >
                    <span className="inline-flex items-center gap-2">
                      <XMarkIcon className="w-5 h-5" />
                      Cancel
                    </span>
                  </GlassBtn>
                ) : null
              }
            />
            <div className="px-4 pb-4 pt-2">
              <form onSubmit={(e) => e.preventDefault()} className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-700 mb-1">Name</label>
                  <GlassInput
                    type="text"
                    placeholder="Category name"
                    className="w-full"
                    value={form.name}
                    onChange={(e) => setForm({ name: e.target.value })}
                    onKeyDown={onEnterFocusNext}
                    ref={nameRef}
                    required
                    disabled={!can.create && !editingId}
                  />
                </div>

                <div className="flex items-center justify-end gap-2">
                  <GlassBtn
                    onClick={handleSave}
                    ref={saveBtnRef}
                    title={(editingId ? "Update" : "Save") + " (Alt+S)"}
                    aria-keyshortcuts="Alt+S"
                    className={`h-10 min-w-[168px] ${editingId ? tintAmber : tintBlue} disabled:opacity-60`}
                    disabled={saving || (!can.create && !can.update)}
                  >
                    <span className="inline-flex items-center gap-2">
                      <CheckCircleIcon className="w-5 h-5" />
                      {editingId ? (saving ? "Updating…" : "Update") : (saving ? "Saving…" : "Save")}
                    </span>
                  </GlassBtn>
                </div>

                <div className="text-[11px] text-gray-500 text-right">Shortcut: Alt+S</div>
              </form>
            </div>
          </GlassCard>
        </Guard>

        {/* Right: List Card */}
        <GlassCard className={`lg:col-span-${(can.create || can.update) ? "2" : "3"}`}>
          <GlassSectionHeader
            title={
              <span className="inline-flex items-center gap-2">
                <Squares2X2Icon className="w-5 h-5 text-blue-600" />
                <span>Category List</span>
              </span>
            }
            right={
              <div className="text-sm text-gray-700">
                {loading ? "Loading…" : (
                  <>
                    Showing <strong>{filtered.length===0?0:start+1}-{Math.min(filtered.length, start+pageSize)}</strong> of <strong>{categories.length}</strong>
                    {filtered.length!==categories.length && <> (filtered: <strong>{filtered.length}</strong>)</>}
                  </>
                )}
              </div>
            }
          />

          <div className="px-3 pb-3">
            <div className="w-full overflow-x-auto rounded-2xl ring-1 ring-gray-200/60 bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm">
              <table className="w-full text-sm text-gray-900 dark:text-gray-100">
                <thead className="bg-white/80 dark:bg-slate-700/80 sticky top-0 z-10">
                  <tr className="border-b border-gray-200/70 dark:border-slate-600/70">
                    <th className="text-left font-medium px-4 py-3 text-gray-900 dark:text-gray-100">Name</th>
                    {hasActions && <th className="text-center font-medium px-4 py-3 text-gray-900 dark:text-gray-100">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {paged.length === 0 && !loading && (
                    <tr>
                      <td className="px-4 py-10 text-center text-gray-500 dark:text-gray-400" colSpan={colSpan}>
                        No categories found.
                      </td>
                    </tr>
                  )}

                  {paged.map((c) => {
                    const used = Number(c.products_count || 0) > 0;
                    return (
                      <tr key={c.id} className="odd:bg-white/60 even:bg-white/40 hover:bg-blue-50/70 dark:odd:bg-slate-700/60 dark:even:bg-slate-800/60 dark:hover:bg-slate-600/70 transition-colors">
                        <td className="px-4 py-3 text-gray-900 dark:text-gray-100">{c.name}</td>
                        {hasActions && (
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-2 justify-center">
                              <Guard when={can.update}>
                                <GlassBtn
                                  className={`h-9 min-w-[128px] ${tintAmber}`}
                                  onClick={() => handleEdit(c)}
                                  title={`Edit ${c.name}`}
                                  aria-label={`Edit category ${c.name}`}
                                >
                                  <span className="inline-flex items-center gap-2">
                                    <PencilSquareIcon className="w-5 h-5" />
                                    Edit
                                  </span>
                                </GlassBtn>
                              </Guard>

                              <Guard when={can.delete}>
                                <GlassBtn
                                  className={`h-9 min-w-[128px] ${used ? "opacity-50 cursor-not-allowed " + tintGlass : tintRed}`}
                                  onClick={() =>
                                    used
                                      ? toast.error("Cannot delete: category is used by products.")
                                      : handleDelete(c)
                                  }
                                  title={used ? "Cannot delete: category is used by products." : `Delete ${c.name}`}
                                  aria-label={`Delete category ${c.name}`}
                                  disabled={used}
                                >
                                  <span className="inline-flex items-center gap-2">
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

            {/* Footer toolbar */}
            <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-700">Page {page} of {pageCount}</span>
                <div className="flex items-center gap-2">
                  <GlassBtn className={`h-9 px-3 ${tintGlass}`} onClick={() => setPage(1)} disabled={page === 1}>⏮ First</GlassBtn>
                  <GlassBtn className={`h-9 px-3 ${tintGlass}`} onClick={() => setPage((p)=>Math.max(1,p-1))} disabled={page===1}>◀ Prev</GlassBtn>
                  <GlassBtn className={`h-9 px-3 ${tintGlass}`} onClick={() => setPage((p)=>Math.min(pageCount,p+1))} disabled={page===pageCount}>Next ▶</GlassBtn>
                  <GlassBtn className={`h-9 px-3 ${tintGlass}`} onClick={() => setPage(pageCount)} disabled={page===pageCount}>Last ⏭</GlassBtn>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">Rows per page</label>
                <select
                  value={pageSize}
                  onChange={(e)=>setPageSize(Number(e.target.value))}
                  className="h-9 px-2 rounded-xl bg-white/70 backdrop-blur-sm border border-gray-200/70 ring-1 ring-transparent focus:ring-blue-400/40 shadow-sm focus:outline-none"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
              </div>
            </div>
          </div>
        </GlassCard>
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
