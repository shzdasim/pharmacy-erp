import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import {
  MagnifyingGlassIcon,
  PlusCircleIcon,
  PencilSquareIcon,
  EyeIcon,
  TrashIcon,
} from "@heroicons/react/24/solid";

export default function SaleInvoicesIndex() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  // search + pagination
  const [qPosted, setQPosted] = useState("");
  const [qCustomer, setQCustomer] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        const res = await axios.get("/api/sale-invoices"); // returns customer relation
        setInvoices(res.data || []);
      } catch {
        toast.error("Failed to fetch sale invoices");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Alt+N -> create (ignore when typing in inputs)
  useEffect(() => {
    const onKeyDown = (e) => {
      if (!e.altKey) return;
      if ((e.key || "").toLowerCase() !== "n") return;
      const tag = (e.target?.tagName || "").toLowerCase();
      const typing = ["input", "textarea", "select"].includes(tag) || e.target?.isContentEditable;
      if (typing) return;
      e.preventDefault();
      navigate("/sale-invoices/create");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navigate]);

  const handleDelete = async (id) => {
    const confirmed = await new Promise((resolve) => {
      toast((t) => (
        <div className="flex flex-col">
          <p>Delete this sale invoice?</p>
          <div className="flex justify-end gap-2 mt-2">
            <button
              className="bg-gray-300 px-3 py-1 rounded"
              onClick={() => { toast.dismiss(t.id); resolve(false); }}
            >
              Cancel
            </button>
            <button
              className="bg-red-600 text-white px-3 py-1 rounded"
              onClick={() => { toast.dismiss(t.id); resolve(true); }}
            >
              Delete
            </button>
          </div>
        </div>
      ));
    });
    if (!confirmed) return;

    try {
      await axios.delete(`/api/sale-invoices/${id}`);
      toast.success("Sale invoice deleted");
      setInvoices((prev) => prev.filter((i) => i.id !== id));
    } catch {
      toast.error("Delete failed");
    }
  };

  // ===== search + pagination (client-side) =====
  const norm = (v) => (v ?? "").toString().toLowerCase().trim();

  const filtered = useMemo(() => {
    const nPosted = norm(qPosted);
    const nCust = norm(qCustomer);
    return invoices.filter((inv) => {
      const posted = norm(inv.posted_number);
      const customer = norm(inv.customer?.name);
      return posted.includes(nPosted) && customer.includes(nCust);
    });
  }, [invoices, qPosted, qCustomer]);

  useEffect(() => { setPage(1); }, [qPosted, qCustomer, pageSize]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);

  const start = (page - 1) * pageSize;
  const paged = filtered.slice(start, start + pageSize);

  if (loading) return <p className="p-6">Loading...</p>;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h1 className="text-2xl font-bold">Sale Invoices</h1>
        <Link
          to="/sale-invoices/create"
          title="Add Sale Invoice (Alt+N)"
          aria-keyshortcuts="Alt+N"
          className="bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-blue-700"
        >
          <PlusCircleIcon className="w-5 h-5" />
          Add Sale Invoice
          <span className="ml-2 hidden sm:inline text-xs opacity-80 border rounded px-1 py-0.5">
            Alt+N
          </span>
        </Link>
      </div>

      {/* Search toolbar */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        <div className="relative">
          <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={qPosted}
            onChange={(e) => setQPosted(e.target.value)}
            placeholder="Search by Posted No (e.g., SI-000001)…"
            className="w-full pl-10 pr-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="relative">
          <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={qCustomer}
            onChange={(e) => setQCustomer(e.target.value)}
            placeholder="Search by Customer…"
            className="w-full pl-10 pr-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Meta */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-2">
        <div className="text-sm text-gray-600">
          Showing{" "}
          <strong>
            {filtered.length === 0 ? 0 : start + 1}-{Math.min(filtered.length, start + pageSize)}
          </strong>{" "}
          of <strong>{invoices.length}</strong>{" "}
          {filtered.length !== invoices.length && <> (filtered: <strong>{filtered.length}</strong>)</>}
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Rows per page</label>
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="border rounded px-2 py-1"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <p>No sale invoices found.</p>
      ) : (
        <div className="w-full overflow-x-auto rounded border">
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="p-2 border text-left">#</th>
                <th className="p-2 border text-left">Posted No</th>
                <th className="p-2 border text-left">Customer</th>
                <th className="p-2 border text-left">Date</th>
                <th className="p-2 border text-right">Total</th>
                <th className="p-2 border text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((invoice, idx) => (
                <tr key={invoice.id} className="odd:bg-white even:bg-gray-50 hover:bg-blue-50 transition-colors">
                  <td className="p-2 border">{start + idx + 1}</td>
                  <td className="p-2 border">{invoice.posted_number || "-"}</td>
                  <td className="p-2 border">{invoice.customer?.name ?? "N/A"}</td>
                  <td className="p-2 border">{invoice.date}</td>
                  <td className="p-2 border text-right">{Number(invoice.total ?? 0).toLocaleString()}</td>
                  <td className="p-2 border">
                    <div className="flex justify-center gap-2">
                      <Link
                        to={`/sale-invoices/${invoice.id}/edit`}
                        className="bg-green-600 text-white px-3 py-1 rounded inline-flex items-center gap-1 hover:bg-green-700"
                        title="Edit"
                      >
                        <PencilSquareIcon className="w-5 h-5" />
                        Edit
                      </Link>
                      <Link
                        to={`/sale-invoices/${invoice.id}`}
                        className="bg-blue-600 text-white px-3 py-1 rounded inline-flex items-center gap-1 hover:bg-blue-700"
                        title="View"
                      >
                        <EyeIcon className="w-5 h-5" />
                        View
                      </Link>
                      <button
                        onClick={() => handleDelete(invoice.id)}
                        className="bg-red-600 text-white px-3 py-1 rounded inline-flex items-center gap-1 hover:bg-red-700"
                        title="Delete"
                      >
                        <TrashIcon className="w-5 h-5" />
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      <div className="mt-4 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="text-sm text-gray-600">Page {page} of {pageCount}</div>
        <div className="flex items-center gap-2">
          <button onClick={() => setPage(1)} disabled={page === 1} className="px-3 py-1 border rounded disabled:opacity-50">⏮ First</button>
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 border rounded disabled:opacity-50">◀ Prev</button>
          <button onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={page === pageCount} className="px-3 py-1 border rounded disabled:opacity-50">Next ▶</button>
          <button onClick={() => setPage(pageCount)} disabled={page === pageCount} className="px-3 py-1 border rounded disabled:opacity-50">Last ⏭</button>
        </div>
      </div>
    </div>
  );
}
