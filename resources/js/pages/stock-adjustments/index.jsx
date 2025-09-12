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
import { usePermissions, Guard } from "@/api/usePermissions.js";

export default function StockAdjustmentsIndex() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // secure delete modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteStep, setDeleteStep] = useState(1); // 1=confirm, 2=password
  const [deletingId, setDeletingId] = useState(null);
  const [password, setPassword] = useState("");
  const [deleting, setDeleting] = useState(false);

  const navigate = useNavigate();

  // 🔒 permissions
  const { loading: permsLoading, canFor } = usePermissions();
  const can = useMemo(
    () =>
      (typeof canFor === "function" ? canFor("stock-adjustment") : {
        view:false, create:false, update:false, delete:false, import:false, export:false
      }),
    [canFor]
  );

  useEffect(() => {
    (async () => {
      if (permsLoading) return;
      if (!can.view) { setRows([]); setLoading(false); return; }
      try {
        setLoading(true);
        const { data } = await axios.get("/api/stock-adjustments", { params: { per_page: 1000 } });
        setRows(Array.isArray(data?.data) ? data.data : data);
      } catch (e) {
        const status = e?.response?.status;
        if (status === 403) toast.error("You don't have permission to view stock adjustments.");
        else toast.error("Failed to fetch stock adjustments");
      } finally {
        setLoading(false);
      }
    })();
  }, [permsLoading, can.view]);

  // Alt+N -> create (respect perms, ignore when typing)
  useEffect(() => {
    const onKeyDown = (e) => {
      if (!e.altKey) return;
      const key = (e.key || "").toLowerCase();
      if (key !== "n") return;
      const tag = (e.target?.tagName || "").toLowerCase();
      const isTyping = ["input","textarea","select"].includes(tag) || e.target?.isContentEditable;
      if (isTyping) return;
      if (!can.create) return;
      e.preventDefault();
      navigate("/stock-adjustments/create");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navigate, can.create]);

  // ===== secure delete handlers =====
  const openDeleteModal = (id) => {
    if (!can.delete) return toast.error("You don't have permission to delete stock adjustments.");
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
    if (!can.delete) return toast.error("You don't have permission to delete stock adjustments.");
    try {
      setDeleting(true);
      // 1) confirm password
      await axios.post("/api/auth/confirm-password", { password });
      // 2) delete
      await axios.delete(`/api/stock-adjustments/${deletingId}`);
      toast.success("Stock adjustment deleted");
      setRows((prev) => prev.filter((r) => r.id !== deletingId));
      closeDeleteModal();
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        (err?.response?.status === 422 ? "Incorrect password" : "Delete failed");
      toast.error(msg);
    } finally {
      setDeleting(false);
    }
  };

  // ===== search + pagination =====
  const filtered = useMemo(() => {
    const n = (v) => (v ?? "").toString().toLowerCase().trim();
    const qn = n(q);
    return (rows || []).filter(r => n(r.posted_number).includes(qn) || n(r.note).includes(qn));
  }, [rows, q]);

  const start = (page - 1) * pageSize;
  const paged = filtered.slice(start, start + pageSize);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));

  if (permsLoading) return <div className="p-6">Loading…</div>;
  if (!can.view) return <div className="p-6 text-sm text-gray-700">You don’t have permission to view stock adjustments.</div>;
  if (loading) return <p className="p-6">Loading…</p>;

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h1 className="text-2xl font-bold">Stock Adjustments</h1>

        <Guard when={can.create}>
          <Link
            to="/stock-adjustments/create"
            className="bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-blue-700"
            title="Add (Alt+N)"
            aria-keyshortcuts="Alt+N"
          >
            <PlusCircleIcon className="w-5 h-5"/> Add Adjustment
            <span className="ml-2 hidden sm:inline text-xs opacity-80 border rounded px-1 py-0.5">Alt+N</span>
          </Link>
        </Guard>
      </div>

      <div className="relative mb-3">
        <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={q}
          onChange={(e)=>{ setQ(e.target.value); setPage(1); }}
          placeholder="Search by Posted No or Note…"
          className="w-full pl-10 pr-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="w-full overflow-x-auto rounded border">
        <table className="w-full">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="p-2 border text-left">#</th>
              <th className="p-2 border text-left">Posted No</th>
              <th className="p-2 border text-left">Date</th>
              <th className="p-2 border text-left">Note</th>
              <th className="p-2 border text-right">Items</th>
              <th className="p-2 border text-right">Total Worth</th>
              <th className="p-2 border text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((r, idx) => (
              <tr key={r.id} className="odd:bg-white even:bg-gray-50 hover:bg-blue-50 transition-colors">
                <td className="p-2 border">{start + idx + 1}</td>
                <td className="p-2 border">{r.posted_number}</td>
                <td className="p-2 border">{r.posted_date}</td>
                <td className="p-2 border">{r.note}</td>
                <td className="p-2 border text-right">{r.items_count ?? r.items?.length ?? 0}</td>
                <td className="p-2 border text-right">{Number(r.total_worth || 0).toLocaleString()}</td>
                <td className="p-2 border">
                  <div className="flex justify-center gap-2">
                    <Guard when={can.update}>
                      <Link
                        to={`/stock-adjustments/${r.id}/edit`}
                        className="bg-green-600 text-white px-3 py-1 rounded inline-flex items-center gap-1 hover:bg-green-700"
                        title="Edit"
                      >
                        <PencilSquareIcon className="w-5 h-5"/> Edit
                      </Link>
                    </Guard>

                    {/* View page is optional; if you have a show page, expose it here: */}
                    <Link
                      to={`/stock-adjustments/${r.id}`}
                      className="bg-blue-600 text-white px-3 py-1 rounded inline-flex items-center gap-1 hover:bg-blue-700"
                      title="View"
                    >
                      <EyeIcon className="w-5 h-5" /> View
                    </Link>

                    <Guard when={can.delete}>
                      <button
                        onClick={() => openDeleteModal(r.id)}
                        className="bg-red-600 text-white px-3 py-1 rounded inline-flex items-center gap-1 hover:bg-red-700"
                        title="Delete"
                      >
                        <TrashIcon className="w-5 h-5"/> Delete
                      </button>
                    </Guard>
                  </div>
                </td>
              </tr>
            ))}
            {paged.length === 0 && (
              <tr>
                <td colSpan={7} className="p-4 text-center text-gray-600">No stock adjustments found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="text-sm text-gray-600">
          Page {page} of {pageCount}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={()=>setPage(1)} disabled={page===1} className="px-3 py-1 border rounded disabled:opacity-50">⏮ First</button>
          <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1} className="px-3 py-1 border rounded disabled:opacity-50">◀ Prev</button>
          <button onClick={()=>setPage(p=>Math.min(pageCount,p+1))} disabled={page===pageCount} className="px-3 py-1 border rounded disabled:opacity-50">Next ▶</button>
          <button onClick={()=>setPage(pageCount)} disabled={page===pageCount} className="px-3 py-1 border rounded disabled:opacity-50">Last ⏭</button>
        </div>
      </div>

      {/* Delete confirmation modal (same UX as Sale Invoices) */}
      {deleteModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={(e) => { if (e.target === e.currentTarget) closeDeleteModal(); }}
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-5">
            {deleteStep === 1 && (
              <div>
                <h2 className="text-lg font-semibold mb-2">Delete stock adjustment?</h2>
                <p className="text-sm text-gray-600">
                  Are you sure you want to delete this stock adjustment? This action cannot be undone.
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
                  For security, please re-enter your password to delete this stock adjustment.
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
