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
import CustomerImportModal from "../components/CustomerImportModal.jsx";

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

  // NEW: import/export state
  const [importOpen, setImportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    document.title = "Customers - Pharmacy ERP";
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const res = await axios.get("/api/customers"); // returns transactions_count
      setCustomers(res.data || []);
    } catch (err) {
      console.error("Failed to fetch customers", err);
      toast.error("Failed to load customers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { nameRef.current?.focus(); }, [editingId]);

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

  const onEnterFocusNext = (e, nextRef) => { if (e.key === "Enter") { e.preventDefault(); nextRef?.current?.focus(); } };

  const resetForm = () => {
    setForm({ name: "", email: "", phone: "", address: "" });
    setEditingId(null);
    setTimeout(() => nameRef.current?.focus(), 0);
  };

  const handleSave = async () => {
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
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.errors?.name?.[0] ||
        err?.response?.data?.errors?.email?.[0] ||
        "Save failed";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (c) => {
    setForm({ name: c.name || "", email: c.email || "", phone: c.phone || "", address: c.address || "" });
    setEditingId(c.id);
  };

  const handleDelete = async (c) => {
    try {
      await axios.delete(`/api/customers/${c.id}`);
      setCustomers((prev) => prev.filter((x) => Number(x.id) !== Number(c.id)));
      if (Number(editingId) === Number(c.id)) resetForm();
      toast.success("Customer deleted");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Delete failed");
    }
  };

  const handleButtonKeyDown = (e, action) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); action(); }
  };

  // NEW: export all
  const handleExport = async () => {
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
      console.error(e);
      toast.error("Export failed");
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

  return (
    <div className="p-6">
      {/* header + search */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
        <h1 className="text-2xl font-bold">Customers</h1>
        <div className="relative w-full md:w-[28rem]">
          <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, email, phone, or address…"
            className="w-full pl-10 pr-3 h-9 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* form */}
      <form onSubmit={(e) => e.preventDefault()} className="mb-4">
        <div className="flex flex-col gap-2">
          <div className="flex flex-col md:flex-row md:items-end md:gap-2">
            <div className="flex-1 min-w-[160px]">
              <label className="block text-xs text-gray-700 mb-1">Name</label>
              <input
                type="text" placeholder="Name (required)"
                className="border rounded px-2 h-9 text-sm w-full"
                value={form.name}
                onChange={(e)=>setForm({ ...form, name: e.target.value })}
                onKeyDown={(e)=>onEnterFocusNext(e, emailRef)}
                ref={nameRef} required
              />
            </div>

            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs text-gray-700 mb-1">Email</label>
              <input
                type="email" placeholder="Email"
                className="border rounded px-2 h-9 text-sm w-full"
                value={form.email || ""}
                onChange={(e)=>setForm({ ...form, email: e.target.value })}
                onKeyDown={(e)=>onEnterFocusNext(e, phoneRef)}
                ref={emailRef}
              />
            </div>

            <div className="w-full md:w-56">
              <label className="block text-xs text-gray-700 mb-1">Phone</label>
              <input
                type="text" placeholder="Phone"
                className="border rounded px-2 h-9 text-sm w-full"
                value={form.phone || ""}
                onChange={(e)=>setForm({ ...form, phone: e.target.value })}
                onKeyDown={(e)=>onEnterFocusNext(e, addressRef)}
                ref={phoneRef}
              />
            </div>

            <div className="w-full md:flex-1 md:min-w-[240px]">
              <label className="block text-xs text-gray-700 mb-1">Address</label>
              <input
                type="text" placeholder="Address"
                className="border rounded px-2 h-9 text-sm w-full"
                value={form.address || ""}
                onChange={(e)=>setForm({ ...form, address: e.target.value })}
                onKeyDown={(e)=>onEnterFocusNext(e, saveBtnRef)}
                ref={addressRef}
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
            <>
              Showing <strong>{filtered.length===0?0:start+1}-{Math.min(filtered.length, start+pageSize)}</strong>{" "}
              of <strong>{customers.length}</strong>{" "}
              {filtered.length!==customers.length && <> (filtered: <strong>{filtered.length}</strong>)</>}
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
              <th colSpan={5} className="border p-2">
                <div className="flex items-center justify-start gap-2">
                  <button
                    onClick={() => setImportOpen(true)}
                    onKeyDown={(e)=> (e.key==="Enter"||e.key===" ") && (e.preventDefault(), setImportOpen(true))}
                    className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-3 h-9 rounded text-sm"
                    title="Import Customers (CSV)" aria-label="Import customers from CSV"
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
                    title="Export all customers to CSV" aria-label="Export all customers to CSV"
                  >
                    <ArrowDownTrayIcon className="w-5 h-5" />
                    {exporting ? "Exporting…" : "Export CSV"}
                  </button>
                </div>
              </th>
            </tr>
            {/* Column labels */}
            <tr>
              <th className="border p-2 text-left">Name</th>
              <th className="border p-2 text-left">Email</th>
              <th className="border p-2 text-left">Phone</th>
              <th className="border p-2 text-left">Address</th>
              <th className="border p-2 text-center">Actions</th>
            </tr>
          </thead>

          <tbody>
            {paged.length === 0 && !loading && (
              <tr>
                <td className="border px-3 py-6 text-center text-gray-500" colSpan={5}>No customers found.</td>
              </tr>
            )}
            {paged.map((c) => {
              const inUse = Number(c.transactions_count || 0) > 0;
              return (
                <tr key={c.id} className="odd:bg-white even:bg-gray-50 hover:bg-blue-50 transition-colors">
                  <td className="border p-2">{c.name}</td>
                  <td className="border p-2 break-all">{c.email}</td>
                  <td className="border p-2">{c.phone}</td>
                  <td className="border p-2">{c.address}</td>
                  <td className="border p-2">
                    <div className="flex gap-2 justify-center">
                      <button
                        onClick={() => handleEdit(c)}
                        onKeyDown={(e)=>handleButtonKeyDown(e, ()=>handleEdit(c))}
                        tabIndex={0}
                        className="bg-yellow-500 text-white px-3 h-9 text-sm rounded inline-flex items-center gap-1"
                        aria-label={`Edit customer ${c.name}`}
                      >
                        <PencilSquareIcon className="w-5 h-5" />
                        Edit
                      </button>
                      <button
                        onClick={() =>
                          inUse ? toast.error("Cannot delete: customer has invoices/returns.")
                                : handleDelete(c)
                        }
                        onKeyDown={(e)=>handleButtonKeyDown(e, () =>
                          inUse ? toast.error("Cannot delete: customer has invoices/returns.")
                                : handleDelete(c)
                        )}
                        tabIndex={0}
                        disabled={inUse}
                        title={inUse ? "Cannot delete: customer has invoices/returns." : "Delete"}
                        className={`px-3 h-9 text-sm rounded inline-flex items-center gap-1 ${
                          inUse ? "bg-gray-300 text-gray-600 cursor-not-allowed" : "bg-red-600 text-white"
                        }`}
                        aria-label={`Delete customer ${c.name}`}
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
      <CustomerImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={fetchCustomers}
      />
    </div>
  );
}
