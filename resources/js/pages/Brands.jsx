// src/pages/Brands.jsx
import { useEffect, useRef, useState, useCallback } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import {
  MagnifyingGlassIcon,
  CheckCircleIcon,
  PencilSquareIcon,
  TrashIcon,
  ArrowUpTrayIcon,
  ArrowDownTrayIcon,
  ArrowPathIcon,
  PlusIcon,
  TagIcon,
  XMarkIcon,
} from "@heroicons/react/24/solid";
import BrandImportModal from "../components/BrandImportModal.jsx";
import { usePermissions, Guard } from "@/api/usePermissions.js";

// 🧊 Glass primitives
import {
  GlassCard,
  GlassSectionHeader,
  GlassToolbar,
  GlassInput,
  GlassBtn,
} from "@/components/glass.jsx";

export default function Brands() {
  // rows = current page rows (server-side)
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  // form/edit
  const [form, setForm] = useState({ name: "", image: null });
  const [editingId, setEditingId] = useState(null);
  const [preview, setPreview] = useState(null);
  const [saving, setSaving] = useState(false);

  // import modal
  const [importOpen, setImportOpen] = useState(false);

  // search + server pagination
  const [qName, setQName] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);

  // focus + save
  const nameRef = useRef(null);
  const saveBtnRef = useRef(null);

  // fetch control
  const controllerRef = useRef(null);
  const debounceRef = useRef(null);

  // 🔒 permissions
  const { loading: permsLoading, canFor } = usePermissions();
  const can =
    (typeof canFor === "function" ? canFor("brand") : null) ?? {
      view: false,
      create: false,
      update: false,
      delete: false,
      import: false,
      export: false,
    };

  useEffect(() => {
    document.title = "Brands - Pharmacy ERP";
  }, []);

  useEffect(() => {
    nameRef.current?.focus();
  }, [editingId]);

  // Alt+S -> save
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.altKey && (e.key || "").toLowerCase() === "s") {
        if (!can.create && !can.update) return;
        e.preventDefault();
        handleSubmit();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [form, editingId, can.create, can.update]);

  const onEnterFocusSave = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      saveBtnRef.current?.focus();
    }
  };

  // ===== Server fetch =====
  const fetchBrands = useCallback(
    async (signal) => {
      try {
        setLoading(true);
        const { data } = await axios.get("/api/brands", {
          params: { page, per_page: pageSize, q_name: qName.trim() },
          signal,
        });

        const items = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
        setRows(items);
        setTotal(Number(data?.total ?? items.length ?? 0));
        const lp = Number(data?.last_page ?? 1);
        setLastPage(lp);
        if (page > lp) setPage(lp || 1);
      } catch (err) {
        if (axios.isCancel?.(err)) return;
        if (err?.response?.status === 403) toast.error("You don't have permission to view brands.");
        else toast.error("Failed to load brands");
      } finally {
        setLoading(false);
      }
    },
    [page, pageSize, qName]
  );

  // non-debounced: page/pageSize
  useEffect(() => {
    if (permsLoading || !can.view) return;
    if (controllerRef.current) controllerRef.current.abort();
    const ctrl = new AbortController();
    controllerRef.current = ctrl;
    fetchBrands(ctrl.signal);
  }, [page, pageSize, permsLoading, can.view, fetchBrands]);

  // debounced: qName
  useEffect(() => {
    if (permsLoading || !can.view) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      if (controllerRef.current) controllerRef.current.abort();
      const ctrl = new AbortController();
      controllerRef.current = ctrl;
      fetchBrands(ctrl.signal);
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [qName, permsLoading, can.view, fetchBrands]);

  const start = rows.length ? (page - 1) * pageSize + 1 : 0;
  const end = rows.length ? start + rows.length - 1 : 0;

  // ===== Preview helpers (revoke blob URLs to prevent leaks & stale previews) =====
  const revokeIfBlob = (url) => {
    if (url && typeof url === "string" && url.startsWith("blob:")) {
      try {
        URL.revokeObjectURL(url);
      } catch {}
    }
  };

  useEffect(() => {
    return () => revokeIfBlob(preview); // cleanup on unmount
  }, [preview]);

  // ===== Form handlers =====
  const handleInputChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleFileChange = (e) => {
    const file = e.target.files?.[0] ?? null;
    // if we had a previous blob preview, revoke it before replacing
    if (preview) revokeIfBlob(preview);
    setForm((prev) => ({ ...prev, image: file }));
    setPreview(file ? URL.createObjectURL(file) : (editingId ? null : null));
  };

  const resetForm = () => {
    // cleanup old blob url if any
    revokeIfBlob(preview);
    setForm({ name: "", image: null });
    setPreview(null); // ✅ ensure preview clears
    setEditingId(null);
    setTimeout(() => nameRef.current?.focus(), 0);
  };

  const handleSubmit = async () => {
    if (editingId ? !can.update : !can.create) {
      toast.error("You don't have permission to save brands.");
      return;
    }
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
        await axios.post(`/api/brands/${editingId}`, data, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        toast.success("Brand updated");
      } else {
        await axios.post("/api/brands", data, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        toast.success("Brand saved");
      }

      // ✅ this clears the file + preview after create/update
      resetForm();

      // refetch current page
      if (controllerRef.current) controllerRef.current.abort();
      const ctrl = new AbortController();
      controllerRef.current = ctrl;
      await fetchBrands(ctrl.signal);
    } catch (err) {
      if (err?.response?.status === 403) {
        toast.error("You don't have permission to save brands.");
      } else {
        const msg =
          err?.response?.data?.message ||
          err?.response?.data?.errors?.name?.[0] ||
          err?.response?.data?.errors?.image?.[0] ||
          "Save failed";
        toast.error(msg);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (b) => {
    if (!can.update) return toast.error("You don't have permission to edit brands.");

    setForm({ name: b.name || "", image: null });

    // ✅ when switching to Edit, clear any blob preview first
    if (preview) revokeIfBlob(preview);
    const nextPreview = b.image ? `/storage/${b.image}` : null;
    setPreview(nextPreview);

    setEditingId(b.id);
  };

  const handleDelete = async (b) => {
    if (!can.delete) return toast.error("You don't have permission to delete brands.");
    const used = Number(b.products_count || 0) > 0;
    if (used) return toast.error("Cannot delete: brand is used by products.");

    try {
      await axios.delete(`/api/brands/${b.id}`);
      toast.success("Brand deleted");

      if (controllerRef.current) controllerRef.current.abort();
      const ctrl = new AbortController();
      controllerRef.current = ctrl;
      await fetchBrands(ctrl.signal);

      if (editingId === b.id) resetForm();
    } catch (err) {
      if (err?.response?.status === 403)
        toast.error("You don't have permission to delete brands.");
      else toast.error(err?.response?.data?.message || "Could not delete brand.");
    }
  };

  const handleButtonKeyDown = (e, action) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      action();
    }
  };

  // export all brands
  const handleExport = async () => {
    if (!can.export) return toast.error("You don't have permission to export brands.");
    try {
      setExporting(true);
      const res = await axios.get("/api/brands/export", { responseType: "blob" });
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      const filename = `brands_${stamp}.csv`;
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
      if (e?.response?.status === 403)
        toast.error("You don't have permission to export brands.");
      else toast.error("Export failed");
    } finally {
      setExporting(false);
    }
  };

  // perms loading / no-view states
  if (permsLoading) return <div className="p-6">Loading…</div>;
  if (!can.view)
    return <div className="p-6 text-sm text-gray-700">You don’t have permission to view brands.</div>;

  const hasActions = can.update || can.delete;

  // 🧊 iOS-style tinted glass palette — shared
  const tintBlue   = "bg-blue-500/85 text-white shadow-[0_6px_20px_-6px_rgba(37,99,235,0.45)] ring-1 ring-white/20 hover:bg-blue-500/95";
  const tintIndigo = "bg-indigo-500/85 text-white shadow-[0_6px_20px_-6px_rgba(99,102,241,0.45)] ring-1 ring-white/20 hover:bg-indigo-500/95";
  const tintSlate  = "bg-slate-900/80 text-white shadow-[0_6px_20px_-6px_rgba(15,23,42,0.45)] ring-1 ring-white/15 hover:bg-slate-900/90";
  const tintAmber  = "bg-amber-500/85 text-white shadow-[0_6px_20px_-6px_rgba(245,158,11,0.45)] ring-1 ring-white/20 hover:bg-amber-500/95";
  const tintRed    = "bg-rose-500/85 text-white shadow-[0_6px_20px_-6px_rgba(244,63,94,0.45)] ring-1 ring-white/20 hover:bg-rose-500/95";
  const tintGlass  = "bg-white/60 text-gray-900 ring-1 ring-white/30 hover:bg-white/75 dark:text-gray-100";

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header card */}
      <GlassCard>
        <GlassSectionHeader
          title={
            <span className="inline-flex items-center gap-2">
              <TagIcon className="w-5 h-5 text-blue-600" />
              <span>Brands</span>
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
                  fetchBrands(ctrl.signal);
                }}
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
              placeholder="Search brand by name…"
              className="pl-10 w-full"
              aria-label="Search brands"
            />
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Guard when={can.import}>
              <GlassBtn
                className={`h-10 min-w-[150px] ${tintIndigo}`}
                onClick={() => setImportOpen(true)}
                title="Import Brands (CSV)"
                aria-label="Import brands from CSV"
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
                title="Export all brands to CSV"
                aria-label="Export all brands to CSV"
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

      {/* Grid: Left form / Right list */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Form */}
        <Guard when={can.create || (can.update && editingId !== null)}>
          <GlassCard className="lg:col-span-1">
            <GlassSectionHeader
              title={
                <span className="inline-flex items-center gap-2">
                  {editingId ? (
                    <>
                      <PencilSquareIcon className="w-5 h-5 text-amber-600" />
                      <span>Edit Brand</span>
                    </>
                  ) : (
                    <>
                      <PlusIcon className="w-5 h-5 text-blue-600" />
                      <span>Add Brand</span>
                    </>
                  )}
                </span>
              }
              right={
                editingId ? (
                  <GlassBtn className={`h-9 px-3 ${tintGlass}`} onClick={resetForm} title="Cancel editing">
                    <span className="inline-flex items-center gap-2">
                      <XMarkIcon className="w-5 h-5" />
                      Cancel
                    </span>
                  </GlassBtn>
                ) : null
              }
            />

            <div className="px-4 pb-4 pt-2">
              <form onSubmit={(e) => e.preventDefault()} className="space-y-3" encType="multipart/form-data">
                <div>
                  <label className="block text-xs text-gray-700 mb-1">Name</label>
                  <GlassInput
                    type="text"
                    name="name"
                    placeholder="Brand name"
                    value={form.name}
                    onChange={handleInputChange}
                    onKeyDown={onEnterFocusSave}
                    ref={nameRef}
                    required
                    disabled={!can.create && !editingId}
                    className="w-full"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                  <div className="sm:col-span-2">
                    <label className="block text-xs text-gray-700 mb-1">Image (optional)</label>
                    <input
                      key={editingId || "new"}
                      type="file"
                      name="image"
                      accept="image/*"
                      onChange={handleFileChange}
                      disabled={!can.create && !editingId}
                      className="h-10 w-full rounded-xl bg-white/70 backdrop-blur-sm border border-gray-200/70 ring-1 ring-transparent focus:ring-blue-400/40 shadow-sm file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border-0 file:bg-white/70 file:text-slate-700"
                    />
                  </div>

                  <div className="sm:col-span-1">
                    {preview ? (
                      <div className="flex items-center gap-3">
                        <img
                          src={preview}
                          alt="Preview"
                          className="w-16 h-16 rounded-2xl object-contain ring-1 ring-gray-200/70 bg-white/70"
                        />
                        <span className="text-xs text-gray-500">Preview</span>
                      </div>
                    ) : (
                      <div className="text-xs text-gray-400">No preview</div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2">
                  <GlassBtn
                    type="button"
                    onClick={resetForm}
                    className={`min-w-[110px] ${tintGlass}`}
                    disabled={saving}
                  >
                    Clear
                  </GlassBtn>
                  <GlassBtn
                    type="button"
                    onClick={handleSubmit}
                    ref={saveBtnRef}
                    title={(editingId ? "Update" : "Save") + " (Alt+S)"}
                    aria-keyshortcuts="Alt+S"
                    className={`h-10 min-w-[168px] ${editingId ? tintAmber : tintBlue} disabled:opacity-60`}
                    disabled={saving || (!can.create && !can.update)}
                  >
                    <span className="inline-flex items-center gap-2">
                      <CheckCircleIcon className="w-5 h-5" />
                      {editingId ? (saving ? "Updating…" : "Update") : saving ? "Saving…" : "Save"}
                    </span>
                  </GlassBtn>
                </div>

                <div className="text-[11px] text-gray-500 text-right">Shortcut: Alt+S</div>
              </form>
            </div>
          </GlassCard>
        </Guard>

        {/* Right: List */}
        <GlassCard className={`lg:col-span-${(can.create || can.update) ? "2" : "3"}`}>
          <GlassSectionHeader
            title={
              <span className="inline-flex items-center gap-2">
                <TagIcon className="w-5 h-5 text-blue-600" />
                <span>Brand List</span>
              </span>
            }
            right={
              <div className="text-sm text-gray-700">
                {loading ? (
                  "Loading…"
                ) : (
                  <>
                    Showing <strong>{rows.length === 0 ? 0 : start}-{end}</strong> of{" "}
                    <strong>{total}</strong>
                  </>
                )}
              </div>
            }
          />

          <div className="px-3 pb-3">
            <div className="w-full overflow-x-auto rounded-2xl ring-1 ring-gray-200/60 bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm">
              <table className="w-full text-sm text-gray-900 dark:text-gray-100">
                <thead className="sticky top-0 bg-white/85 dark:bg-slate-700/85 backdrop-blur-sm z-10 border-b border-gray-200/70 dark:border-slate-600/70">
                  <tr className="text-left">
                    <th className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">Name</th>
                    <th className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">Image</th>
                    {hasActions && <th className="px-4 py-3 font-medium text-center text-gray-900 dark:text-gray-100">Actions</th>}
                  </tr>
                </thead>

                <tbody>
                  {rows.length === 0 && !loading && (
                    <tr>
                      <td className="px-4 py-10 text-center text-gray-600 dark:text-gray-400" colSpan={hasActions ? 3 : 2}>
                        No brands found.
                      </td>
                    </tr>
                  )}

                  {rows.map((b) => {
                    const used = Number(b.products_count || 0) > 0;
                    return (
                      <tr key={b.id} className="odd:bg-white/60 even:bg-white/40 hover:bg-blue-50/70 dark:odd:bg-slate-700/60 dark:even:bg-slate-800/60 dark:hover:bg-slate-600/70 transition-colors">
                        <td className="px-4 py-3 text-gray-900 dark:text-gray-100">{b.name}</td>
                        <td className="px-4 py-3">
                          {b.image ? (
                            <img
                              src={`/storage/${b.image}`}
                              alt={b.name}
                              className="w-16 h-16 rounded-2xl object-contain ring-1 ring-gray-200/70 bg-white/70 dark:bg-slate-700/70"
                            />
                          ) : (
                            <span className="text-gray-500 dark:text-gray-400 text-sm">No image</span>
                          )}
                        </td>

                        {hasActions && (
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-2 justify-center">
                              <Guard when={can.update}>
                                <GlassBtn
                                  onClick={() => handleEdit(b)}
                                  onKeyDown={(e) => handleButtonKeyDown(e, () => handleEdit(b))}
                                  className={`h-9 min-w-[128px] ${tintAmber}`}
                                  title={`Edit ${b.name}`}
                                  aria-label={`Edit brand ${b.name}`}
                                >
                                  <span className="inline-flex items-center gap-2">
                                    <PencilSquareIcon className="w-5 h-5" />
                                    Edit
                                  </span>
                                </GlassBtn>
                              </Guard>

                              <Guard when={can.delete}>
                                <GlassBtn
                                  onClick={() =>
                                    used
                                      ? toast.error("Cannot delete: brand is used by products.")
                                      : handleDelete(b)
                                  }
                                  onKeyDown={(e) =>
                                    handleButtonKeyDown(e, () =>
                                      used
                                        ? toast.error("Cannot delete: brand is used by products.")
                                        : handleDelete(b)
                                    )
                                  }
                                  className={`h-9 min-w-[128px] ${
                                    used ? "opacity-50 cursor-not-allowed " + tintGlass : tintRed
                                  }`}
                                  title={
                                    used
                                      ? "Cannot delete: brand is used by products."
                                      : `Delete ${b.name}`
                                  }
                                  aria-label={`Delete brand ${b.name}`}
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
              <div className="text-sm text-gray-700">Page {page} of {lastPage}</div>
              <div className="flex items-center gap-2">
                <GlassBtn className={`h-9 px-3 ${tintGlass}`} onClick={() => setPage(1)} disabled={page === 1}>
                  ⏮ First
                </GlassBtn>
                <GlassBtn className={`h-9 px-3 ${tintGlass}`} onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                  ◀ Prev
                </GlassBtn>
                <GlassBtn className={`h-9 px-3 ${tintGlass}`} onClick={() => setPage((p) => Math.min(lastPage, p + 1))} disabled={page === lastPage}>
                  Next ▶
                </GlassBtn>
                <GlassBtn className={`h-9 px-3 ${tintGlass}`} onClick={() => setPage(lastPage)} disabled={page === lastPage}>
                  Last ⏭
                </GlassBtn>

                <div className="ml-2 flex items-center gap-2">
                  <label className="text-sm text-gray-600">Rows per page</label>
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="h-9 px-2 rounded-xl bg-white/70 backdrop-blur-sm border border-gray-200/70 ring-1 ring-transparent focus:ring-blue-400/40 shadow-sm focus:outline-none text-sm"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Import modal */}
      <BrandImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => {
          if (controllerRef.current) controllerRef.current.abort();
          const ctrl = new AbortController();
          controllerRef.current = ctrl;
          fetchBrands(ctrl.signal);
        }}
      />
    </div>
  );
}
