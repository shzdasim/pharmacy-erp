// src/pages/Customers.jsx
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
import {
  ChevronDoubleLeftIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDoubleRightIcon,
} from "@heroicons/react/24/outline";

import CustomerImportModal from "../components/CustomerImportModal.jsx";
import { usePermissions, Guard } from "@/api/usePermissions.js";

// 🧊 Glass primitives (under components)
import {
  GlassCard,
  GlassSectionHeader,
  GlassToolbar,
  GlassInput,
  GlassBtn,
} from "../components/Glass.jsx";

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState({ name: "", email: "", phone: "", address: "" });
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);

  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const nameRef = useRef(null);
  const emailRef = useRef(null);
  const phoneRef = useRef(null);
  const addressRef = useRef(null);
  const saveBtnRef = useRef(null);
  const [saving, setSaving] = useState(false);

  const [importOpen, setImportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  // 🔒 permissions
  const { loading: permsLoading, canFor } = usePermissions();
  const can = canFor("customer");

  useEffect(() => {
    document.title = "Customers - Pharmacy ERP";
  }, []);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const res = await axios.get("/api/customers"); // returns transactions_count
      setCustomers(res.data || []);
    } catch (err) {
      if (err?.response?.status === 403) toast.error("You don't have permission to view customers.");
      else toast.error("Failed to load customers");
    } finally {
      setLoading(false);
    }
  };

  // initial load only when perms are ready and user can view
  useEffect(() => {
    if (permsLoading || !can.view) return;
    fetchCustomers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permsLoading, can.view]);

  useEffect(() => { nameRef.current?.focus(); }, [editingId]);

  // Alt+S -> Save (only if create/update allowed)
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.altKey && (e.key || "").toLowerCase() === "s") {
        if (!can.create && !can.update) return;
        e.preventDefault(); handleSave();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, editingId, can.create, can.update]);

  const onEnterFocusNext = (e, nextRef) => {
    if (e.key === "Enter") { e.preventDefault(); nextRef?.current?.focus(); }
  };

  const resetForm = () => {
    setForm({ name: "", email: "", phone: "", address: "" });
    setEditingId(null);
    setTimeout(() => nameRef.current?.focus(), 0);
  };

  const handleSave = async () => {
    if (editingId ? !can.update : !can.create) {
      toast.error("You don't have permission to save customers.");
      return;
    }
    if (saving) return;

    const name = (form.name || "").trim();
    if (!name) { toast.error("Name is required"); nameRef.current?.focus(); return; }

    try {
      setSaving(true);
      if (editingId) {
        await axios.put(`/api/customers/${editingId}`, form);
        toast.success("Customer updated");
      } else {
        await axios.post("/api/customers", form);
        toast.success("Customer saved");
      }
      resetForm();
      fetchCustomers();
    } catch (err) {
      if (err?.response?.status === 403) {
        toast.error("You don't have permission to save customers.");
      } else {
        const msg =
          err?.response?.data?.message ||
          err?.response?.data?.errors?.name?.[0] ||
          err?.response?.data?.errors?.email?.[0] ||
          "Save failed";
        toast.error(msg);
      }
    } finally { setSaving(false); }
  };

  const handleEdit = (c) => {
    if (!can.update) return toast.error("You don't have permission to edit customers.");
    setForm({ name: c.name || "", email: c.email || "", phone: c.phone || "", address: c.address || "" });
    setEditingId(c.id);
  };

  const handleDelete = async (c) => {
    if (!can.delete) return toast.error("You don't have permission to delete customers.");
    try {
      await axios.delete(`/api/customers/${c.id}`);
      setCustomers((prev) => prev.filter((x) => Number(x.id) !== Number(c.id)));
      if (Number(editingId) === Number(c.id)) resetForm();
      toast.success("Customer deleted");
    } catch (err) {
      if (err?.response?.status === 403) toast.error("You don't have permission to delete customers.");
      else toast.error(err?.response?.data?.message || "Delete failed");
    }
  };

  const handleButtonKeyDown = (e, action) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); action(); }
  };

  // export all (only if can.export)
  const handleExport = async () => {
    if (!can.export) return toast.error("You don't have permission to export customers.");
    try {
      setExporting(true);
      const res = await axios.get("/api/customers/export", { responseType: "blob" });
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      const filename = `customers_${stamp}.csv`;
      const blob = new Blob([res.data], { type: "text/csv;charset=utf-8" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      if (e?.response?.status === 403) toast.error("You don't have permission to export customers.");
      else toast.error("Export failed");
    } finally { setExporting(false); }
  };

  // search + pagination
  const norm = (v) => (v ?? "").toString().toLowerCase().trim();
  const filtered = useMemo(() => {
    const needle = norm(q);
    if (!needle) return customers;
    return customers.filter((c) =>
      [c.name, c.email, c.phone, c.address].some((f) => norm(f).includes(needle))
    );
  }, [customers, q]);

  useEffect(() => { setPage(1); }, [q, pageSize]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);

  const start = (page - 1) * pageSize;
  const paged = filtered.slice(start, start + pageSize);

  // perms loading / no-view states
  if (permsLoading) return <div className="p-6">Loading…</div>;
  if (!can.view) return <div className="p-6 text-sm text-gray-700">You don’t have permission to view customers.</div>;

  const hasActions = can.update || can.delete;

  return (
    <div className="p-4 space-y-4 bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
      {/* Header + search */}
      <GlassCard>
        <GlassSectionHeader
          title="Customers"
          right={
            <div className="relative w-[28rem] max-w-full">
              <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <GlassInput
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by name, email, phone, or address…"
                className="pl-9 w-full"
                aria-label="Search customers"
              />
            </div>
          }
        />
      </GlassCard>

      {/* Form (create/update) */}
      <Guard when={can.create || can.update}>
        <GlassCard>
          <GlassSectionHeader title={editingId ? "Edit Customer" : "Add Customer"} />
          <GlassToolbar className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="flex-1 min-w-[160px]">
              <label className="block text-xs text-gray-700 mb-1">Name</label>
              <GlassInput
                type="text"
                placeholder="Name (required)"
                value={form.name}
                onChange={(e)=>setForm({ ...form, name: e.target.value })}
                onKeyDown={(e)=>onEnterFocusNext(e, emailRef)}
                ref={nameRef}
                required
              />
            </div>

            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs text-gray-700 mb-1">Email</label>
              <GlassInput
                type="email"
                placeholder="Email"
                value={form.email || ""}
                onChange={(e)=>setForm({ ...form, email: e.target.value })}
                onKeyDown={(e)=>onEnterFocusNext(e, phoneRef)}
                ref={emailRef}
              />
            </div>

            <div className="w-full md:w-56">
              <label className="block text-xs text-gray-700 mb-1">Phone</label>
              <GlassInput
                type="text"
                placeholder="Phone"
                value={form.phone || ""}
                onChange={(e)=>setForm({ ...form, phone: e.target.value })}
                onKeyDown={(e)=>onEnterFocusNext(e, addressRef)}
                ref={phoneRef}
              />
            </div>

            <div className="w-full md:flex-1 md:min-w-[240px]">
              <label className="block text-xs text-gray-700 mb-1">Address</label>
              <GlassInput
                type="text"
                placeholder="Address"
                value={form.address || ""}
                onChange={(e)=>setForm({ ...form, address: e.target.value })}
                onKeyDown={(e)=>onEnterFocusNext(e, saveBtnRef)}
                ref={addressRef}
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
                Showing <strong>{filtered.length===0?0:start+1}-{Math.min(filtered.length, start+pageSize)}</strong>{" "}
                of <strong>{customers.length}</strong>{" "}
                {filtered.length!==customers.length && <> (filtered: <strong>{filtered.length}</strong>)</>}
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
          title="All Customers"
          right={
            <div className="flex items-center gap-2">
              <Guard when={can.import}>
                <GlassBtn
                  onClick={() => setImportOpen(true)}
                  variant="primary"
                  title="Import Customers (CSV)"
                  aria-label="Import customers from CSV"
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
                  title="Export all customers to CSV"
                  aria-label="Export all customers to CSV"
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
                <th className="px-3 py-2 font-medium">Email</th>
                <th className="px-3 py-2 font-medium">Phone</th>
                <th className="px-3 py-2 font-medium">Address</th>
                {hasActions && <th className="px-3 py-2 font-medium text-center">Actions</th>}
              </tr>
            </thead>

            <tbody>
              {paged.length === 0 && !loading && (
                <tr>
                  <td className="px-3 py-6 text-center text-gray-600" colSpan={hasActions ? 5 : 4}>
                    No customers found.
                  </td>
                </tr>
              )}

              {paged.map((c, idx) => {
                const inUse = Number(c.transactions_count || 0) > 0;
                return (
                  <tr
                    key={c.id ?? idx}
                    className="odd:bg-white/90 even:bg-white/70 hover:bg-blue-50 transition-colors"
                  >
                    <td className="px-3 py-2">{c.name}</td>
                    <td className="px-3 py-2 break-all">{c.email}</td>
                    <td className="px-3 py-2">{c.phone}</td>
                    <td className="px-3 py-2">{c.address}</td>

                    {hasActions && (
                      <td className="px-3 py-2">
                        <div className="flex gap-2 justify-center">
                          <Guard when={can.update}>
                            <GlassBtn
                              onClick={() => handleEdit(c)}
                              onKeyDown={(e)=>handleButtonKeyDown(e, ()=>handleEdit(c))}
                              className="inline-flex items-center gap-1"
                            >
                              <PencilSquareIcon className="w-5 h-5" />
                              Edit
                            </GlassBtn>
                          </Guard>

                          <Guard when={can.delete}>
                            <GlassBtn
                              onClick={() =>
                                inUse ? toast.error("Cannot delete: customer has invoices/returns.")
                                     : handleDelete(c)
                              }
                              onKeyDown={(e)=>handleButtonKeyDown(e, () =>
                                inUse ? toast.error("Cannot delete: customer has invoices/returns.")
                                     : handleDelete(c)
                              )}
                              title={inUse ? "Cannot delete: customer has invoices/returns." : "Delete"}
                              className={`inline-flex items-center gap-1 ${inUse ? "opacity-60 cursor-not-allowed" : ""}`}
                              disabled={inUse}
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
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            title="Previous"
            className="inline-flex items-center gap-1 disabled:opacity-50"
          >
            <ChevronLeftIcon className="w-4 h-4" />
            Prev
          </GlassBtn>
          <GlassBtn
            onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
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
      <CustomerImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={fetchCustomers}
      />
    </div>
  );
}
