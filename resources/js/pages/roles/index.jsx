import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import axios from "axios";
import { listRoles, deleteRole } from "@/api/roles";
import { PlusCircleIcon, PencilSquareIcon, TrashIcon, MagnifyingGlassIcon } from "@heroicons/react/24/solid";

export default function RolesIndex() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [qSearch, setQSearch] = useState("");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);

  const controllerRef = useRef(null);
  const debounceRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const onKeyDown = (e) => {
      if (!e.altKey) return;
      if ((e.key || "").toLowerCase() !== "n") return;
      const tag = (e.target?.tagName || "").toLowerCase();
      const isTyping = ["input","textarea","select"].includes(tag) || e.target?.isContentEditable;
      if (isTyping) return;
      e.preventDefault();
      navigate("/roles/create");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navigate]);

  const fetchRoles = async (signal) => {
    try {
      setLoading(true);
      const { data } = await listRoles({ page, per_page: pageSize, search: qSearch.trim(), signal });
      const items = Array.isArray(data?.data) ? data.data : [];
      const meta = data?.meta || {};
      setRows(items);
      setTotal(Number(meta?.total ?? items.length ?? 0));
      const lp = Number(meta?.last_page ?? 1);
      setLastPage(lp);
      if (page > lp) setPage(lp || 1);
    } catch (err) {
      if (axios.isCancel?.(err)) return;

      const status = err?.response?.status;
      if (status === 403 || status === 401) {
        toast.error("You don’t have permission to view roles. Redirecting…");
        navigate("/dashboard");
        return;
      }

      console.error(err);
      toast.error("Failed to load roles");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (controllerRef.current) controllerRef.current.abort();
    const ctrl = new AbortController();
    controllerRef.current = ctrl;
    fetchRoles(ctrl.signal);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      if (controllerRef.current) controllerRef.current.abort();
      const ctrl = new AbortController();
      controllerRef.current = ctrl;
      fetchRoles(ctrl.signal);
    }, 300);
    return () => clearTimeout(debounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qSearch]);

  const start = rows.length ? (page - 1) * pageSize + 1 : 0;
  const end = rows.length ? start + rows.length - 1 : 0;

  const onDelete = async (id, name) => {
    if (!window.confirm(`Delete role "${name}"?`)) return;
    try {
      await deleteRole(id);
      toast.success("Role deleted");
      const ctrl = new AbortController();
      controllerRef.current = ctrl;
      fetchRoles(ctrl.signal);
    } catch (e) {
      const status = e?.response?.status;
      if (status === 403 || status === 401) {
        toast.error("You don’t have permission to manage roles. Redirecting…");
        navigate("/dashboard");
        return;
      }
      const msg = e?.response?.data?.message || "Delete failed";
      toast.error(msg);
    }
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between mb-4">
        <h1 className="text-2xl font-bold">Roles</h1>
        <div className="flex gap-2">
          <Link
            to="/roles/create"
            title="Add Role (Alt+N)"
            aria-keyshortcuts="Alt+N"
            className="bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2"
          >
            <PlusCircleIcon className="w-5 h-5" />
            Add Role
            <span className="ml-2 hidden sm:inline text-xs opacity-80 border rounded px-1 py-0.5">Alt+N</span>
          </Link>
        </div>
      </div>

      {/* Search */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <div className="relative">
          <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={qSearch}
            onChange={(e) => setQSearch(e.target.value)}
            placeholder="Search roles…"
            className="w-full pl-10 pr-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Meta */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
        <div className="text-sm text-gray-600">
          {loading ? "Loading…" : <>Showing <strong>{rows.length === 0 ? 0 : start}-{end}</strong> of <strong>{total}</strong></>}
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Rows per page</label>
          <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} className="border rounded px-2 py-1">
            <option value={10}>10</option><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="w-full overflow-x-auto rounded border">
        <table className="w-full">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="border px-2 py-2 text-left">ID</th>
              <th className="border px-2 py-2 text-left">Name</th>
              <th className="border px-2 py-2 text-left">Permissions</th>
              <th className="border px-2 py-2 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !loading && (
              <tr>
                <td className="border px-3 py-6 text-center text-gray-500" colSpan={4}>No roles found.</td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="odd:bg-white even:bg-gray-50 hover:bg-blue-50">
                <td className="border px-2 py-2">{r.id}</td>
                <td className="border px-2 py-2">{r.name}</td>
                <td className="border px-2 py-2">{r.permissions_count ?? 0}</td>
                <td className="border px-2 py-2">
                  <div className="flex gap-2 justify-center">
                    <Link to={`/roles/${r.id}/edit`} className="bg-yellow-500 text-white px-3 py-1 rounded flex items-center gap-1">
                      <PencilSquareIcon className="w-5 h-5" /> Edit
                    </Link>
                    <button onClick={() => onDelete(r.id, r.name)} className="px-3 py-1 rounded bg-red-600 text-white flex items-center gap-1">
                      <TrashIcon className="w-5 h-5" /> Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pager */}
      <div className="mt-4 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="text-sm text-gray-600">Page {page} of {lastPage}</div>
        <div className="flex items-center gap-2">
          <button onClick={() => setPage(1)} disabled={page===1} className="px-3 py-1 border rounded disabled:opacity-50">⏮ First</button>
          <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page===1} className="px-3 py-1 border rounded disabled:opacity-50">◀ Prev</button>
          <button onClick={() => setPage(p => Math.min(lastPage, p+1))} disabled={page===lastPage} className="px-3 py-1 border rounded disabled:opacity-50">Next ▶</button>
          <button onClick={() => setPage(lastPage)} disabled={page===lastPage} className="px-3 py-1 border rounded disabled:opacity-50">Last ⏭</button>
        </div>
      </div>
    </div>
  );
}
