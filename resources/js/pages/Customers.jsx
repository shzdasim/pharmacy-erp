// src/pages/Customers.jsx
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
  ArrowPathIcon,
  PlusIcon,
  UsersIcon,
  XMarkIcon,
} from "@heroicons/react/24/solid";
import CustomerImportModal from "../components/CustomerImportModal.jsx";
import { usePermissions, Guard } from "@/api/usePermissions.js";

// 🧊 Glass primitives (same path used elsewhere)
import {
  GlassCard,
  GlassSectionHeader,
  GlassToolbar,
  GlassInput,
  GlassBtn,
} from "@/components/glass.jsx";

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState({ name: "", email: "", phone: "", address: "" });
  const [editingId, setEditingId] = useState(null);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  // search + pagination
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // focus refs
  const nameRef = useRef(null);
  const emailRef = useRef(null);
  const phoneRef = useRef(null);
  const addressRef = useRef(null);
  const saveBtnRef = useRef(null);

  // 🔒 permissions (safe fallback like other pages)
  const { loading: permsLoading, canFor } = usePermissions();
  const can = useMemo(
    () =>
      (typeof canFor === "function" ? canFor("customer") : null) ?? {
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
    document.title = "Customers - Pharmacy ERP";
  }, []);

  const fetchCustomers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get("/api/customers"); // expects transactions_count
      setCustomers(res.data || []);
    } catch (err) {
      if (err?.response?.status === 403)
        toast.error("You don't have permission to view customers.");
      else toast.error("Failed to load customers");
    } finally {
      setLoading(false);
    }
  }, []);

  // initial load when perms ready and can view
  useEffect(() => {
    if (!permsLoading && can.view) fetchCustomers();
  }, [permsLoading, can.view, fetchCustomers]);

  useEffect(() => {
    nameRef.current?.focus();
  }, [editingId]);

  // Alt+S -> Save
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
    if (e.key === "Enter") {
      e.preventDefault();
      nextRef?.current?.focus();
    }
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
    if (!name) {
      toast.error("Name is required");
      nameRef.current?.focus();
      return;
    }

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
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (c) => {
    if (!can.update) return toast.error("You don't have permission to edit customers.");
    setForm({
      name: c.name || "",
      email: c.email || "",
      phone: c.phone || "",
      address: c.address || "",
    });
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
      if (err?.response?.status === 403)
        toast.error("You don't have permission to delete customers.");
      else toast.error(err?.response?.data?.message || "Delete failed");
    }
  };

  const handleButtonKeyDown = (e, action) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      action();
    }
  };

  // export all
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
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      if (e?.response?.status === 403)
        toast.error("You don't have permission to export customers.");
      else toast.error("Export failed");
    } finally {
      setExporting(false);
    }
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

  useEffect(() => {
    setPage(1);
  }, [q, pageSize]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const start = (page - 1) * pageSize;
  const paged = filtered.slice(start, start + pageSize);

  // perms loading / no-view states
  if (permsLoading) return <div className="p-6">Loading…</div>;
  if (!can.view)
    return <div className="p-6 text-sm text-gray-700">You don’t have permission to view customers.</div>;

  const hasActions = can.update || can.delete;

  // 🧊 iOS-style tinted glass palette (matches Categories/Suppliers)
  const tintBlue   = "bg-blue-500/85 text-white shadow-[0_6px_20px_-6px_rgba(37,99,235,0.45)] ring-1 ring-white/20 hover:bg-blue-500/95";
  const tintIndigo = "bg-indigo-500/85 text-white shadow-[0_6px_20px_-6px_rgba(99,102,241,0.45)] ring-1 ring-white/20 hover:bg-indigo-500/95";
  const tintSlate  = "bg-slate-900/80 text-white shadow-[0_6px_20px_-6px_rgba(15,23,42,0.45)] ring-1 ring-white/15 hover:bg-slate-900/90";
  const tintAmber  = "bg-amber-500/85 text-white shadow-[0_6px_20px_-6px_rgba(245,158,11,0.45)] ring-1 ring-white/20 hover:bg-amber-500/95";
  const tintRed    = "bg-rose-500/85 text-white shadow-[0_6px_20px_-6px_rgba(244,63,94,0.45)] ring-1 ring-white/20 hover:bg-rose-500/95";
  const tintGlass  = "bg-white/60 text-gray-900 ring-1 ring-white/30 hover:bg-white/75 dark:text-gray-100";

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* ===== Header card (Search + Import/Export + Refresh) — same flow as Categories ===== */}
      <GlassCard>
        <GlassSectionHeader
          title={
            <span className="inline-flex items-center gap-2">
              <UsersIcon className="w-5 h-5 text-blue-600" />
              <span>Customers</span>
            </span>
          }
          right={
            <div className="flex items-center gap-2">
              <GlassBtn
                className={`h-10 min-w-[120px] ${tintSlate}`}
                onClick={fetchCustomers}
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
          <div className="relative w-full md:w-[32rem]">
            <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <GlassInput
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name, email, phone, or address…"
              className="pl-10 w-full"
              aria-label="Search customers"
            />
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Guard when={can.import}>
              <GlassBtn
                className={`h-10 min-w-[150px] ${tintIndigo}`}
                onClick={() => setImportOpen(true)}
                title="Import Customers (CSV)"
                aria-label="Import customers from CSV"
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
                title="Export all customers to CSV"
                aria-label="Export all customers to CSV"
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

      {/* ===== Grid: Left form / Right list — mirrors Categories ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Form card */}
        <Guard when={can.create || (can.update && editingId !== null)}>
          <GlassCard className="lg:col-span-1">
            <GlassSectionHeader
              title={
                <span className="inline-flex items-center gap-2">
                  {editingId ? (
                    <>
                      <PencilSquareIcon className="w-5 h-5 text-amber-600" />
                      <span>Edit Customer</span>
                    </>
                  ) : (
                    <>
                      <PlusIcon className="w-5 h-5 text-blue-600" />
                      <span>Add Customer</span>
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
                  <label className="block text-xs text-gray-700 mb-1">Name</label>
                  <GlassInput
                    type="text"
                    placeholder="Name (required)"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    onKeyDown={(e) => onEnterFocusNext(e, emailRef)}
                    ref={nameRef}
                    required
                    disabled={!can.create && !editingId}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-700 mb-1">Email</label>
                  <GlassInput
                    type="email"
                    placeholder="Email"
                    value={form.email || ""}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    onKeyDown={(e) => onEnterFocusNext(e, phoneRef)}
                    ref={emailRef}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-700 mb-1">Phone</label>
                  <GlassInput
                    type="text"
                    placeholder="Phone"
                    value={form.phone || ""}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    onKeyDown={(e) => onEnterFocusNext(e, addressRef)}
                    ref={phoneRef}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-700 mb-1">Address</label>
                  <GlassInput
                    type="text"
                    placeholder="Address"
                    value={form.address || ""}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    onKeyDown={(e) => onEnterFocusNext(e, saveBtnRef)}
                    ref={addressRef}
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
                      {editingId ? (saving ? "Updating…" : "Update") : saving ? "Saving…" : "Save"}
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
                <UsersIcon className="w-5 h-5 text-blue-600" />
                <span>Customer List</span>
              </span>
            }
            right={
              <div className="text-sm text-gray-700">
                {loading ? (
                  "Loading…"
                ) : (
                  <>
                    Showing{" "}
                    <strong>
                      {filtered.length === 0 ? 0 : start + 1}-{Math.min(filtered.length, start + pageSize)}
                    </strong>{" "}
                    of <strong>{customers.length}</strong>
                    {filtered.length !== customers.length && (
                      <> (filtered: <strong>{filtered.length}</strong>)</>
                    )}
                  </>
                )}
              </div>
            }
          />

          {/* Table */}
          <div className="px-3 pb-3">
            <div className="w-full overflow-x-auto rounded-2xl ring-1 ring-gray-200/60 bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm max-h-[60vh]">
              <table className="w-full text-sm text-gray-900 dark:text-gray-100">
                <thead className="sticky top-0 bg-white/85 dark:bg-slate-700/85 backdrop-blur-sm z-10 border-b border-gray-200/70 dark:border-slate-600/70">
                  <tr className="text-left">
                    <th className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">Name</th>
                    <th className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">Email</th>
                    {hasActions && <th className="px-4 py-3 font-medium text-center text-gray-900 dark:text-gray-100">Actions</th>}
                  </tr>
                </thead>

                <tbody>
                  {paged.length === 0 && !loading && (
                    <tr>
                      <td className="px-4 py-10 text-center text-gray-600 dark:text-gray-400" colSpan={hasActions ? 5 : 4}>
                        No customers found.
                      </td>
                    </tr>
                  )}

                  {paged.map((c) => {
                    const inUse = Number(c.transactions_count || 0) > 0;
                    return (
                      <tr key={c.id} className="odd:bg-white/60 even:bg-white/40 hover:bg-blue-50/70 dark:odd:bg-slate-700/60 dark:even:bg-slate-800/60 dark:hover:bg-slate-600/70 transition-colors">
                        <td className="px-4 py-3 text-gray-900 dark:text-gray-100">{c.name}</td>
                        <td className="px-4 py-3 break-all text-gray-900 dark:text-gray-100">{c.email}</td>

                        {hasActions && (
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-2 justify-center">
                              <Guard when={can.update}>
                                <GlassBtn
                                  onClick={() => handleEdit(c)}
                                  onKeyDown={(e) => handleButtonKeyDown(e, () => handleEdit(c))}
                                  className={`h-9 min-w-[128px] ${tintAmber}`}
                                  title={`Edit ${c.name}`}
                                  aria-label={`Edit customer ${c.name}`}
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
                                    inUse
                                      ? toast.error("Cannot delete: customer has invoices/returns.")
                                      : handleDelete(c)
                                  }
                                  onKeyDown={(e) =>
                                    handleButtonKeyDown(e, () =>
                                      inUse
                                        ? toast.error("Cannot delete: customer has invoices/returns.")
                                        : handleDelete(c)
                                    )
                                  }
                                  className={`h-9 min-w-[128px] ${
                                    inUse ? "opacity-50 cursor-not-allowed " + tintGlass : tintRed
                                  }`}
                                  title={
                                    inUse
                                      ? "Cannot delete: customer has invoices/returns."
                                      : `Delete ${c.name}`
                                  }
                                  aria-label={`Delete customer ${c.name}`}
                                  disabled={inUse}
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
              <div className="text-sm text-gray-700">Page {page} of {pageCount}</div>
              <div className="flex items-center gap-2">
                <GlassBtn className={`h-9 px-3 ${tintGlass}`} onClick={() => setPage(1)} disabled={page === 1}>
                  ⏮ First
                </GlassBtn>
                <GlassBtn className={`h-9 px-3 ${tintGlass}`} onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                  ◀ Prev
                </GlassBtn>
                <GlassBtn className={`h-9 px-3 ${tintGlass}`} onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={page === pageCount}>
                  Next ▶
                </GlassBtn>
                <GlassBtn className={`h-9 px-3 ${tintGlass}`} onClick={() => setPage(pageCount)} disabled={page === pageCount}>
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
                  </select>
                </div>
              </div>
            </div>
          </div>
        </GlassCard>
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
