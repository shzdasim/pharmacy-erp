import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import {
  MagnifyingGlassIcon,
  PlusCircleIcon,
  PencilSquareIcon,
  TrashIcon,
} from "@heroicons/react/24/solid";

export default function PurchaseReturnsIndex() {
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);

  // search + pagination
  const [qPosted, setQPosted] = useState("");
  const [qSupplier, setQSupplier] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const navigate = useNavigate();

  useEffect(() => {
    fetchReturns();
  }, []);

  // Alt+N -> create return (ignore when typing in inputs)
  useEffect(() => {
    const onKeyDown = (e) => {
      if (!e.altKey) return;
      const key = (e.key || "").toLowerCase();
      if (key !== "n") return;
      const tag = (e.target?.tagName || "").toLowerCase();
      const isTyping =
        ["input", "textarea", "select"].includes(tag) || e.target?.isContentEditable;
      if (isTyping) return;
      e.preventDefault();
      navigate("/purchase-returns/create");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navigate]);

  const fetchReturns = async () => {
    try {
      setLoading(true);
      const res = await axios.get("/api/purchase-returns"); // expects supplier relation
      setReturns(Array.isArray(res.data) ? res.data : []);
    } catch {
      toast.error("Failed to fetch purchase returns");
      setReturns([]);
    } finally {
      setLoading(false);
    }
  };

  // ===== NEW: secure delete modal state & handlers =====
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteStep, setDeleteStep] = useState(1); // 1 = confirm, 2 = password
  const [deletingId, setDeletingId] = useState(null);
  const [password, setPassword] = useState("");
  const [deleting, setDeleting] = useState(false);

  const openDeleteModal = (id) => {
    setDeletingId(id);
    setPassword("");
    setDeleteStep(1);
    setDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    if (deleting) return;
    setDeleteModalOpen(false);
    setDeleteStep(1);
    setDeletingId(null);
    setPassword("");
  };

  const proceedToPassword = () => setDeleteStep(2);

  const confirmAndDelete = async () => {
    if (!deletingId) return;
    try {
      setDeleting(true);
      // 1) verify password (Sanctum-protected)
      await axios.post("/api/auth/confirm-password", { password });
      // 2) delete return
      await axios.delete(`/api/purchase-returns/${deletingId}`);
      toast.success("Return deleted successfully");
      closeDeleteModal();
      fetchReturns();
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        (err?.response?.status === 422 ? "Incorrect password" : "Failed to delete return");
      toast.error(msg);
    } finally {
      setDeleting(false);
    }
  };

  // ===== search + pagination (client-side) =====
  const norm = (v) => (v ?? "").toString().toLowerCase().trim();
  const filtered = useMemo(() => {
    const nPosted = norm(qPosted);
    const nSupp = norm(qSupplier);
    return returns.filter((r) => {
      const posted = norm(r.posted_number);
      const supplier = norm(r.supplier?.name);
      return posted.includes(nPosted) && supplier.includes(nSupp);
    });
  }, [returns, qPosted, qSupplier]);

  useEffect(() => {
    setPage(1);
  }, [qPosted, qSupplier, pageSize]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const start = (page - 1) * pageSize;
  const paged = filtered.slice(start, start + pageSize);

  if (loading) return <p className="p-6">Loading...</p>;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h1 className="text-2xl font-bold">Purchase Returns</h1>
        <Link
          to="/purchase-returns/create"
          title="Add Return (Alt+N)"
          aria-keyshortcuts="Alt+N"
          className="bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-blue-700"
        >
          <PlusCircleIcon className="w-5 h-5" />
          Add Return
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
            placeholder="Search by Posted No (e.g., PRRET-0001)…"
            className="w-full pl-10 pr-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="relative">
          <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={qSupplier}
            onChange={(e) => setQSupplier(e.target.value)}
            placeholder="Search by Supplier…"
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
          of <strong>{returns.length}</strong>{" "}
          {filtered.length !== returns.length && (
            <> (filtered: <strong>{filtered.length}</strong>)</>
          )}
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
        <p>No returns found.</p>
      ) : (
        <div className="w-full overflow-x-auto rounded border">
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="p-2 border text-left">#</th>
                <th className="p-2 border text-left">Posted No</th>
                <th className="p-2 border text-left">Supplier</th>
                <th className="p-2 border text-left">Date</th>
                <th className="p-2 border text-right">Amount</th>
                <th className="p-2 border text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((ret, idx) => (
                <tr
                  key={ret.id}
                  className="odd:bg-white even:bg-gray-50 hover:bg-blue-50 transition-colors"
                >
                  <td className="p-2 border">{start + idx + 1}</td>
                  <td className="p-2 border">{ret.posted_number || "-"}</td>
                  <td className="p-2 border">{ret.supplier?.name ?? "N/A"}</td>
                  <td className="p-2 border">{ret.date}</td>
                  <td className="p-2 border text-right">
                    {Number(ret.total ?? 0).toLocaleString()}
                  </td>
                  <td className="p-2 border">
                    <div className="flex justify-center gap-2">
                      <Link
                        to={`/purchase-returns/${ret.id}/edit`}
                        className="bg-green-600 text-white px-3 py-1 rounded inline-flex items-center gap-1 hover:bg-green-700"
                        title="Edit"
                      >
                        <PencilSquareIcon className="w-5 h-5" />
                        Edit
                      </Link>
                      <button
                        onClick={() => openDeleteModal(ret.id)}
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

      {/* ===== NEW: Delete confirmation modal ===== */}
      {deleteModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeDeleteModal();
          }}
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-5">
            {deleteStep === 1 && (
              <div>
                <h2 className="text-lg font-semibold mb-2">Delete return?</h2>
                <p className="text-sm text-gray-600">
                  Are you sure you want to delete this return? This action cannot be undone.
                </p>
                <div className="mt-4 flex justify-end gap-2">
                  <button className="px-3 py-1 rounded border" onClick={closeDeleteModal}>
                    Cancel
                  </button>
                  <button
                    className="px-3 py-1 rounded bg-red-600 text-white hover:bg-red-700"
                    onClick={proceedToPassword}
                  >
                    Yes, continue
                  </button>
                </div>
              </div>
            )}

            {deleteStep === 2 && (
              <div>
                <h2 className="text-lg font-semibold mb-2">Confirm with password</h2>
                <p className="text-sm text-gray-600">
                  For security, please re-enter your password to delete this return.
                </p>
                <input
                  type="password"
                  autoFocus
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your password"
                  className="mt-3 w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") confirmAndDelete();
                    if (e.key === "Escape") closeDeleteModal();
                  }}
                />
                <div className="mt-4 flex justify-between">
                  <button
                    className="px-3 py-1 rounded border"
                    onClick={() => setDeleteStep(1)}
                    disabled={deleting}
                  >
                    ← Back
                  </button>
                  <div className="flex gap-2">
                    <button className="px-3 py-1 rounded border" onClick={closeDeleteModal} disabled={deleting}>
                      Cancel
                    </button>
                    <button
                      className="px-3 py-1 rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
                      onClick={confirmAndDelete}
                      disabled={deleting || password.trim() === ""}
                    >
                      {deleting ? "Deleting…" : "Confirm & Delete"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
