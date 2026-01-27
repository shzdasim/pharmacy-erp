// src/pages/Suppliers.jsx
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
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
  BuildingStorefrontIcon,
  XMarkIcon,
} from "@heroicons/react/24/solid";
import SupplierImportModal from "../components/SupplierImportModal.jsx";
import { usePermissions, Guard } from "@/api/usePermissions.js";

// 🧊 glass primitives (same import path as Categories)
import {
  GlassCard,
  GlassSectionHeader,
  GlassToolbar,
  GlassInput,
  GlassBtn,
} from "@/components/glass.jsx";

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [form, setForm] = useState({ name: "", address: "", phone: "" });
  const [editingId, setEditingId] = useState(null);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  // search + pagination
  const [qName, setQName] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // focus refs
  const nameRef = useRef(null);
  const addressRef = useRef(null);
  const phoneRef = useRef(null);
  const saveBtnRef = useRef(null);

  // 🔒 permissions (same safe fallback shape as Categories)
  const { loading: permsLoading, canFor } = usePermissions();
  const can = useMemo(
    () =>
      (typeof canFor === "function" ? canFor("supplier") : null) ?? {
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
    document.title = "Suppliers - Pharmacy ERP";
  }, []);

  const fetchSuppliers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get("/api/suppliers");
      setSuppliers(res.data || []);
    } catch (err) {
      const status = err?.response?.status;
      if (status === 403) toast.error("You don't have permission to view suppliers.");
      else toast.error("Failed to fetch suppliers");
    } finally {
      setLoading(false);
    }
  }, []);

  // Only fetch after perms loaded AND user can view
  useEffect(() => {
    if (!permsLoading && can.view) fetchSuppliers();
  }, [permsLoading, can.view, fetchSuppliers]);

  // focus name on edit/add
  useEffect(() => { nameRef.current?.focus(); }, [editingId]);

  // Alt+S -> Save (only if allowed)
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

  const onEnterFocusNext = (e, nextRef) => {
    if (e.key === "Enter") { e.preventDefault(); nextRef?.current?.focus(); }
  };

  const resetForm = () => {
    setForm({ name: "", address: "", phone: "" });
    setEditingId(null);
    setTimeout(() => nameRef.current?.focus(), 0);
  };

  const handleSave = async () => {
    if (editingId ? !can.update : !can.create) {
      toast.error("You don't have permission to save suppliers.");
      return;
    }
    if (saving) return;
    if (!(form.name || "").trim()) {
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
      const status = err?.response?.status;
      if (status === 403) toast.error("You don't have permission to save suppliers.");
      else toast.error(err?.response?.data?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (s) => {
    if (!can.update) return toast.error("You don't have permission to edit suppliers.");
    setForm({ name: s.name || "", address: s.address || "", phone: s.phone || "" });
    setEditingId(s.id);
  };

  const handleDelete = async (s) => {
    if (!can.delete) return toast.error("You don't have permission to delete suppliers.");
    try {
      await axios.delete(`/api/suppliers/${s.id}`);
      setSuppliers((prev) => prev.filter((x) => Number(x.id) !== Number(s.id)));
      if (Number(editingId) === Number(s.id)) resetForm();
      toast.success("Supplier deleted");
    } catch (err) {
      const status = err?.response?.status;
      if (status === 403) toast.error("You don't have permission to delete suppliers.");
      else toast.error(err?.response?.data?.message || "Delete failed");
    }
  };

  // export
  const handleExport = async () => {
    if (!can.export) return toast.error("You don't have permission to export suppliers.");
    try {
      setExporting(true);
      const res = await axios.get("/api/suppliers/export", { responseType: "blob" });
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      const filename = `suppliers_${stamp}.csv`;
      const blob = new Blob([res.data], { type: "text/csv;charset=utf-8" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      const status = e?.response?.status;
      if (status === 403) toast.error("You don't have permission to export suppliers.");
      else toast.error("Export failed");
    } finally {
      setExporting(false);
    }
  };

  // client-side search + pagination
  const norm = (v) => (v ?? "").toString().toLowerCase().trim();
  const filtered = useMemo(() => {
    const needle = norm(qName);
    if (!needle) return suppliers;
    return suppliers.filter((s) => norm(s.name).includes(needle));
  }, [suppliers, qName]);

  useEffect(() => { setPage(1); }, [qName, pageSize]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);

  const start = (page - 1) * pageSize;
  const paged = filtered.slice(start, start + pageSize);

  // While perms load
  if (permsLoading) return <div className="p-6">Loading…</div>;
  // No view permission → hide everything
  if (!can.view) return <div className="p-6 text-sm text-gray-700 dark:text-gray-300">You don't have permission to view suppliers.</div>;

  // 🧊 iOS-tinted glass (same palette used in Categories) - with dark mode support
  const tintBlue   = "bg-blue-500/85 text-white shadow-[0_6px_20px_-6px_rgba(37,99,235,0.45)] ring-1 ring-white/20 hover:bg-blue-500/95";
  const tintIndigo = "bg-indigo-500/85 text-white shadow-[0_6px_20px_-6px_rgba(99,102,241,0.45)] ring-1 ring-white/20 hover:bg-indigo-500/95";
  const tintSlate  = "bg-slate-900/80 text-white shadow-[0_6px_20px_-6px_rgba(15,23,42,0.45)] ring-1 ring-white/15 hover:bg-slate-900/90";
  const tintAmber  = "bg-amber-500/85 text-white shadow-[0_6px_20px_-6px_rgba(245,158,11,0.45)] ring-1 ring-white/20 hover:bg-amber-500/95";
  const tintRed    = "bg-rose-500/85 text-white shadow-[0_6px_20px_-6px_rgba(244,63,94,0.45)] ring-1 ring-white/20 hover:bg-rose-500/95";
  const tintGlass  = "bg-white/60 text-slate-700 dark:text-slate-200 ring-1 ring-white/30 hover:bg-white/75 dark:hover:bg-slate-700/60";

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* ===== Header card (Search + Import/Export + Refresh) — mirrors Categories ===== */}
      <GlassCard>
        <GlassSectionHeader
          title={
            <span className="inline-flex items-center gap-2">
              <BuildingStorefrontIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <span className="text-slate-800 dark:text-slate-100">Suppliers</span>
            </span>
          }
          right={
            <div className="flex items-center gap-2">
              <GlassBtn
                className={`h-10 min-w-[120px] ${tintSlate}`}
                onClick={fetchSuppliers}
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
              placeholder="Search supplier by name…"
              className="pl-10 w-full"
              aria-label="Search suppliers"
            />
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Guard when={can.import}>
              <GlassBtn
                className={`h-10 min-w-[150px] ${tintIndigo}`}
                onClick={() => setImportOpen(true)}
                title="Import Suppliers (CSV)"
                aria-label="Import suppliers from CSV"
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
                title="Export all suppliers to CSV"
                aria-label="Export all suppliers to CSV"
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

      {/* ===== Grid: Left form / Right list — same flow as Categories ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Form card */}
        <Guard when={can.create || (can.update && editingId !== null)}>
          <GlassCard className="lg:col-span-1">
            <GlassSectionHeader
              title={
                <span className="inline-flex items-center gap-2">
                  {editingId ? (
                    <>
                      <PencilSquareIcon className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                      <span className="text-slate-800 dark:text-slate-100">Edit Supplier</span>
                    </>
                  ) : (
                    <>
                      <PlusIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      <span className="text-slate-800 dark:text-slate-100">Add Supplier</span>
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
              <form onSubmit={(e) => e.preventDefault()} className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-700 dark:text-gray-300 mb-1">Name</label>
                  <GlassInput
                    type="text"
                    placeholder="Name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    onKeyDown={(e) => onEnterFocusNext(e, addressRef)}
                    ref={nameRef}
                    required
                    disabled={!can.create && !editingId}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-700 dark:text-gray-300 mb-1">Address</label>
                  <GlassInput
                    type="text"
                    placeholder="Address"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    onKeyDown={(e) => onEnterFocusNext(e, phoneRef)}
                    ref={addressRef}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-700 dark:text-gray-300 mb-1">Phone</label>
                  <GlassInput
                    type="text"
                    placeholder="Phone"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    onKeyDown={(e) => onEnterFocusNext(e, saveBtnRef)}
                    ref={phoneRef}
                    className="w-full"
                  />
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
                    onClick={handleSave}
                    ref={saveBtnRef}
                    title={(editingId ? "Update" : "Save") + " (Alt+S)"}
                    aria-keyshortcuts="Alt+S"
                    className={`h-10 min-w-[168px] ${
                      editingId ? tintAmber : tintBlue
                    } disabled:opacity-60`}
                    disabled={saving || (!can.create && !can.update)}
                  >
                    <span className="inline-flex items-center gap-2">
                      <CheckCircleIcon className="w-5 h-5" />
                      {editingId ? (saving ? "Updating…" : "Update") : (saving ? "Saving…" : "Save")}
                    </span>
                  </GlassBtn>
                </div>

                <div className="text-[11px] text-gray-500 dark:text-gray-400 text-right">Shortcut: Alt+S</div>
              </form>
            </div>
          </GlassCard>
        </Guard>

        {/* Right: List Card */}
        <GlassCard className={`lg:col-span-${(can.create || can.update) ? "2" : "3"}`}>
          <GlassSectionHeader
            title={
              <span className="inline-flex items-center gap-2">
                <BuildingStorefrontIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <span className="text-slate-800 dark:text-slate-100">Supplier List</span>
              </span>
            }
            right={
              <div className="text-sm text-gray-700 dark:text-gray-300">
                {loading ? (
                  "Loading…"
                ) : (
                  <>
                    Showing{" "}
                    <strong>
                      {filtered.length === 0 ? 0 : start + 1}-{Math.min(filtered.length, start + pageSize)}
                    </strong>{" "}
                    of <strong>{suppliers.length}</strong>
                    {filtered.length !== suppliers.length && (
                      <> (filtered: <strong>{filtered.length}</strong>)</>
                    )}
                  </>
                )}
              </div>
            }
          />

          {/* Table */}
          <div className="px-3 pb-3">
            <div className="w-full overflow-x-auto rounded-2xl ring-1 ring-gray-200/60 bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm">
              <table className="w-full text-sm text-gray-900 dark:text-gray-100">
                <thead className="sticky top-0 bg-white/85 dark:bg-slate-700/85 backdrop-blur-sm z-10 border-b border-gray-200/70 dark:border-white/10">
                  <tr className="text-left">
                    <th className="px-4 py-3 font-medium text-slate-700 dark:text-slate-200">Name</th>
                    <th className="px-4 py-3 font-medium text-slate-700 dark:text-slate-200">Address</th>
                    <th className="px-4 py-3 font-medium text-slate-700 dark:text-slate-200">Phone</th>
                    {(can.update || can.delete) && (
                      <th className="px-4 py-3 font-medium text-center text-slate-700 dark:text-slate-200">Actions</th>
                    )}
                  </tr>
                </thead>

                <tbody>
                  {paged.length === 0 && !loading && (
                    <tr>
                      <td className="px-4 py-10 text-center text-gray-600 dark:text-gray-400" colSpan={(can.update || can.delete) ? 4 : 3}>
                        No suppliers found.
                      </td>
                    </tr>
                  )}

                  {paged.map((s) => {
                    const used = Number(s.products_count || 0) > 0;
                    return (
                      <tr key={s.id} className="odd:bg-white/60 even:bg-white/40 dark:odd:bg-slate-700/40 dark:even:bg-slate-700/20 hover:bg-blue-50/70 dark:hover:bg-blue-900/30 transition-colors">
                        <td className="px-4 py-3 text-slate-800 dark:text-slate-200">{s.name}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{s.address}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{s.phone}</td>

                        {(can.update || can.delete) && (
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-2 justify-center">
                              <Guard when={can.update}>
                                <GlassBtn
                                  onClick={() => handleEdit(s)}
                                  className={`h-9 min-w-[128px] ${tintAmber}`}
                                  title={`Edit ${s.name}`}
                                  aria-label={`Edit supplier ${s.name}`}
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
                                      ? toast.error("Cannot delete: supplier is used by products.")
                                      : handleDelete(s)
                                  }
                                  className={`h-9 min-w-[128px] ${
                                    used ? "opacity-50 cursor-not-allowed " + tintGlass : tintRed
                                  }`}
                                  title={
                                    used
                                      ? "Cannot delete: supplier is used by products."
                                      : `Delete ${s.name}`
                                  }
                                  aria-label={`Delete supplier ${s.name}`}
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

            {/* ===== Footer toolbar (pagination + page size) — mirrors Categories ===== */}
            <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="text-sm text-gray-700 dark:text-gray-300">Page {page} of {pageCount}</div>
              <div className="flex items-center gap-2">
                <GlassBtn
                  className={`h-9 px-3 ${tintGlass}`}
                  onClick={() => setPage(1)}
                  disabled={page === 1}
                >
                  ⏮ First
                </GlassBtn>
                <GlassBtn
                  className={`h-9 px-3 ${tintGlass}`}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  ◀ Prev
                </GlassBtn>
                <GlassBtn
                  className={`h-9 px-3 ${tintGlass}`}
                  onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                  disabled={page === pageCount}
                >
                  Next ▶
                </GlassBtn>
                <GlassBtn
                  className={`h-9 px-3 ${tintGlass}`}
                  onClick={() => setPage(pageCount)}
                  disabled={page === pageCount}
                >
                  Last ⏭
                </GlassBtn>

                <div className="ml-2 flex items-center gap-2">
                  <label className="text-sm text-gray-600 dark:text-gray-400">Rows per page</label>
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="h-9 px-2 rounded-xl bg-white/70 dark:bg-slate-700/70 backdrop-blur-sm border border-gray-200/70 dark:border-slate-600/70 ring-1 ring-transparent focus:ring-blue-400/40 shadow-sm focus:outline-none text-sm text-gray-900 dark:text-gray-100"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Import modal */}
      <SupplierImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={fetchSuppliers}
      />
    </div>
  );
}


