// src/pages/Suppliers.jsx
import { useState, useEffect, useMemo, useRef } from "react";
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
import {
  ChevronDoubleLeftIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDoubleRightIcon,
} from "@heroicons/react/24/outline";

import SupplierImportModal from "../components/SupplierImportModal.jsx";
import { usePermissions, Guard } from "@/api/usePermissions.js";

// 🧊 glass primitives (note: components, not ui)
import {
  GlassCard,
  GlassSectionHeader,
  GlassToolbar,
  GlassInput,
  GlassBtn,
} from "../components/Glass.jsx";

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [form, setForm] = useState({ name: "", address: "", phone: "" });
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [saving, setSaving] = useState(false);

  // search + pagination
  const [qName, setQName] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // focus refs
  const nameRef = useRef(null);
  const addressRef = useRef(null);
  const phoneRef = useRef(null);
  const saveBtnRef = useRef(null);

  // 🔒 permissions
  const { loading: permsLoading, canFor } = usePermissions();
  const can = canFor("supplier");

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      const res = await axios.get("/api/suppliers");
      setSuppliers(res.data || []);
    } catch (err) {
      if (err?.response?.status === 403) {
        toast.error("You don't have permission to view suppliers.");
      } else {
        toast.error("Failed to fetch suppliers");
      }
    } finally {
      setLoading(false);
    }
  };

  // Only fetch after perms loaded AND user can view
  useEffect(() => {
    if (!permsLoading && can.view) fetchSuppliers();
  }, [permsLoading, can.view]);

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
      if (err?.response?.status === 403) toast.error("You don't have permission to save suppliers.");
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
      setSuppliers(prev => prev.filter(x => Number(x.id) !== Number(s.id)));
      if (Number(editingId) === Number(s.id)) resetForm();
      toast.success("Supplier deleted");
    } catch (err) {
      if (err?.response?.status === 403) toast.error("You don't have permission to delete suppliers.");
      else toast.error(err?.response?.data?.message || "Delete failed");
    }
  };

  const handleButtonKeyDown = (e, action) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); action(); }
  };

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
      if (e?.response?.status === 403) toast.error("You don't have permission to export suppliers.");
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
  if (!can.view) {
    return (
      <div className="p-6 text-sm text-gray-700">
        You don’t have permission to view suppliers.
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
      {/* Header + Search */}
      <GlassCard>
        <GlassSectionHeader
          title="Suppliers"
          right={
            <div className="relative w-72">
              <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <GlassInput
                value={qName}
                onChange={(e) => setQName(e.target.value)}
                placeholder="Search supplier by name…"
                className="pl-9 w-full"
                aria-label="Search suppliers"
              />
            </div>
          }
        />
      </GlassCard>

      {/* Form (create/update) */}
      <Guard when={can.create || can.update}>
        <GlassCard>
          <GlassSectionHeader title={editingId ? "Edit Supplier" : "Add Supplier"} />
          <GlassToolbar className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="flex-1 min-w-[180px]">
              <label className="block text-xs text-gray-700 mb-1">Name</label>
              <GlassInput
                type="text"
                placeholder="Name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                onKeyDown={(e) => onEnterFocusNext(e, addressRef)}
                ref={nameRef}
                required
                disabled={!can.create && !editingId}
              />
            </div>

            <div className="flex-1 min-w-[220px]">
              <label className="block text-xs text-gray-700 mb-1">Address</label>
              <GlassInput
                type="text"
                placeholder="Address"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                onKeyDown={(e) => onEnterFocusNext(e, phoneRef)}
                ref={addressRef}
              />
            </div>

            <div className="w-full md:w-56">
              <label className="block text-xs text-gray-700 mb-1">Phone</label>
              <GlassInput
                type="text"
                placeholder="Phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                onKeyDown={(e) => onEnterFocusNext(e, saveBtnRef)}
                ref={phoneRef}
              />
            </div>
          </GlassToolbar>

          <div className="px-4 pb-4 flex items-center justify-end gap-2">
            <GlassBtn
              type="button"
              onClick={resetForm}
              variant="ghost"
              className="min-w-[110px]"
              disabled={saving}
            >
              Clear
            </GlassBtn>
            <GlassBtn
              type="button"
              onClick={handleSave}
              ref={saveBtnRef}
              title="Save (Alt+S)"
              aria-keyshortcuts="Alt+S"
              variant="primary"
              className="min-w-[140px] inline-flex items-center justify-center gap-2"
              disabled={saving || (!can.create && !can.update)}
            >
              <CheckCircleIcon className="w-5 h-5" />
              {editingId ? (saving ? "Updating…" : "Update") : (saving ? "Saving…" : "Save")}
            </GlassBtn>
          </div>
          <div className="text-[11px] text-gray-500 px-4 pb-4 md:text-right">Shortcut: Alt+S</div>
        </GlassCard>
      </Guard>

      {/* Meta + page size */}
      <GlassCard>
        <div className="px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="text-sm text-gray-700">
            {loading ? "Loading…" : (
              <>
                Showing <strong>{filtered.length===0?0:start+1}-{Math.min(filtered.length, start+pageSize)}</strong> of <strong>{suppliers.length}</strong>
                {filtered.length!==suppliers.length && <> (filtered: <strong>{filtered.length}</strong>)</>}
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-700">Rows per page</label>
            <select
              value={pageSize}
              onChange={(e)=>setPageSize(Number(e.target.value))}
              className="h-9 px-2 rounded-xl bg-white/70 backdrop-blur-sm border border-gray-200/70 text-sm"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>
      </GlassCard>

      {/* Table + toolbar */}
      <GlassCard>
        <GlassSectionHeader
          title="All Suppliers"
          right={
            <div className="flex items-center gap-2">
              <Guard when={can.import}>
                <GlassBtn
                  onClick={() => setImportOpen(true)}
                  variant="primary"
                  title="Import Suppliers (CSV)"
                  aria-label="Import suppliers from CSV"
                  className="inline-flex items-center gap-2"
                >
                  <ArrowUpTrayIcon className="w-5 h-5" />
                  Import CSV
                </GlassBtn>
              </Guard>
              <Guard when={can.export}>
                <GlassBtn
                  onClick={handleExport}
                  disabled={exporting}
                  variant="ghost"
                  className="inline-flex items-center gap-2"
                  title="Export all suppliers to CSV"
                  aria-label="Export all suppliers to CSV"
                >
                  <ArrowDownTrayIcon className="w-5 h-5" />
                  {exporting ? "Exporting…" : "Export CSV"}
                </GlassBtn>
              </Guard>
            </div>
          }
        />

        {/* Scroll region so sticky header behaves; ensure contrast */}
        <div className="max-h-[60vh] overflow-auto">
          <table className="w-full text-sm text-gray-900">
            <thead className="sticky top-0 bg-white/90 backdrop-blur-sm z-10 border-b border-gray-200/70">
              <tr className="text-left">
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Address</th>
                <th className="px-3 py-2 font-medium">Phone</th>
                {(can.update || can.delete) && (
                  <th className="px-3 py-2 font-medium text-center">Actions</th>
                )}
              </tr>
            </thead>

            <tbody>
              {paged.length === 0 && !loading && (
                <tr>
                  <td
                    className="px-3 py-6 text-center text-gray-600"
                    colSpan={(can.update || can.delete) ? 4 : 3}
                  >
                    No suppliers found.
                  </td>
                </tr>
              )}

              {paged.map((s, idx) => {
                const used = Number(s.products_count || 0) > 0;
                return (
                  <tr
                    key={s.id ?? idx}
                    className="odd:bg-white/90 even:bg-white/70 hover:bg-blue-50 transition-colors"
                  >
                    <td className="px-3 py-2">{s.name}</td>
                    <td className="px-3 py-2">{s.address}</td>
                    <td className="px-3 py-2">{s.phone}</td>

                    {(can.update || can.delete) && (
                      <td className="px-3 py-2">
                        <div className="flex gap-2 justify-center">
                          <Guard when={can.update}>
                            <GlassBtn
                              onClick={() => handleEdit(s)}
                              onKeyDown={(e) => handleButtonKeyDown(e, () => handleEdit(s))}
                              className="inline-flex items-center gap-1"
                            >
                              <PencilSquareIcon className="w-5 h-5" />
                              Edit
                            </GlassBtn>
                          </Guard>

                          <Guard when={can.delete}>
                            <GlassBtn
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
                              title={used ? "Cannot delete: supplier is used by products." : "Delete"}
                              className={`inline-flex items-center gap-1 ${used ? "opacity-60 cursor-not-allowed" : ""}`}
                              disabled={used}
                            >
                              <TrashIcon className="w-5 h-5" />
                              Delete
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
      </GlassCard>

      {/* Pagination */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="text-sm text-gray-700 px-1">Page {page} of {pageCount}</div>
        <div className="flex items-center gap-2">
          <GlassBtn
            onClick={() => setPage(1)}
            disabled={page === 1}
            title="First"
            className="inline-flex items-center gap-1 disabled:opacity-50"
          >
            <ChevronDoubleLeftIcon className="w-4 h-4" />
            First
          </GlassBtn>
          <GlassBtn
            onClick={() => setPage((p)=>Math.max(1,p-1))}
            disabled={page === 1}
            title="Previous"
            className="inline-flex items-center gap-1 disabled:opacity-50"
          >
            <ChevronLeftIcon className="w-4 h-4" />
            Prev
          </GlassBtn>
          <GlassBtn
            onClick={() => setPage((p)=>Math.min(pageCount,p+1))}
            disabled={page === pageCount}
            title="Next"
            className="inline-flex items-center gap-1 disabled:opacity-50"
          >
            Next
            <ChevronRightIcon className="w-4 h-4" />
          </GlassBtn>
          <GlassBtn
            onClick={() => setPage(pageCount)}
            disabled={page === pageCount}
            title="Last"
            className="inline-flex items-center gap-1 disabled:opacity-50"
          >
            Last
            <ChevronDoubleRightIcon className="w-4 h-4" />
          </GlassBtn>
        </div>
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
