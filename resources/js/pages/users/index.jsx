import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  TrashIcon,
  PencilSquareIcon,
  PlusCircleIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/solid";

export default function UsersIndex() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  // filters
  const [qSearch, setQSearch] = useState("");

  // pagination (server-side)
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);

  // selection
  const [selectedIds, setSelectedIds] = useState(new Set());

  const navigate = useNavigate();

  // AbortController + debounce for fetches
  const controllerRef = useRef(null);
  const debounceRef = useRef(null);

  // === Alt+N => /users/create (matches Products) ===
  useEffect(() => {
    const onKeyDown = (e) => {
      if (!e.altKey) return;
      const key = (e.key || "").toLowerCase();
      if (key !== "n") return;
      const tag = (e.target?.tagName || "").toLowerCase();
      const isTyping = ["input", "textarea", "select"].includes(tag) || e.target?.isContentEditable;
      if (isTyping) return;
      e.preventDefault();
      navigate("/users/create");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navigate]);

  const fetchUsers = async (signal) => {
    try {
      setLoading(true);
      const { data } = await axios.get("/api/users", {
        params: {
          page,
          per_page: pageSize,
          search: qSearch.trim(),
        },
        signal,
      });

      // Expecting your controller shape: { data: [...], meta: {...} }
      const items = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
      const meta = data?.meta || {};

      setRows(items);
      setTotal(Number(meta?.total ?? items.length ?? 0));
      const lp = Number(meta?.last_page ?? 1);
      setLastPage(lp);
      if (page > lp) setPage(lp || 1);
    } catch (err) {
      if (axios.isCancel?.(err)) return;
      console.error("Error fetching users", err);
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  // Initial + pager change (non-debounced)
  useEffect(() => {
    if (controllerRef.current) controllerRef.current.abort();
    const ctrl = new AbortController();
    controllerRef.current = ctrl;
    fetchUsers(ctrl.signal);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize]);

  // Debounce filter changes (qSearch)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      if (controllerRef.current) controllerRef.current.abort();
      const ctrl = new AbortController();
      controllerRef.current = ctrl;
      fetchUsers(ctrl.signal);
    }, 300);
    return () => clearTimeout(debounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qSearch]);

  const start = rows.length ? (page - 1) * pageSize + 1 : 0;
  const end = rows.length ? start + rows.length - 1 : 0;

  // ===== Delete (secure confirm) =====
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteStep, setDeleteStep] = useState(1); // 1 = confirm, 2 = password
  const [deletingUser, setDeletingUser] = useState(null); // { id, name, email }
  const [password, setPassword] = useState("");
  const [deleting, setDeleting] = useState(false);

  const openDeleteModal = (u) => {
    setDeletingUser({ id: u.id, name: u.name, email: u.email });
    setPassword("");
    setDeleteStep(1);
    setDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    if (deleting) return;
    setDeleteModalOpen(false);
    setDeleteStep(1);
    setDeletingUser(null);
    setPassword("");
  };

  const proceedToPassword = () => setDeleteStep(2);

  const confirmAndDelete = async () => {
    if (!deletingUser?.id) return;
    try {
      setDeleting(true);
      // 1) confirm password (Sanctum-protected endpoint)
      await axios.post("/api/auth/confirm-password", { password });
      // 2) delete
      await axios.delete(`/api/users/${deletingUser.id}`);

      toast.success("User deleted");

      setSelectedIds((prev) => {
        const copy = new Set(prev);
        copy.delete(deletingUser.id);
        return copy;
      });

      closeDeleteModal();

      // refresh current page
      if (controllerRef.current) controllerRef.current.abort();
      const ctrl = new AbortController();
      controllerRef.current = ctrl;
      fetchUsers(ctrl.signal);
    } catch (err) {
      const apiMsg =
        err?.response?.data?.message ||
        (err?.response?.status === 422 ? "Incorrect password" : "Delete failed");
      toast.error(apiMsg);
    } finally {
      setDeleting(false);
    }
  };

  // selection helpers (operate on current page rows)
  const pageAllChecked = rows.length > 0 && rows.every((u) => selectedIds.has(u.id));
  const pageIndeterminate = rows.some((u) => selectedIds.has(u.id)) && !pageAllChecked;

  const togglePageAll = (checked) => {
    setSelectedIds((prev) => {
      const copy = new Set(prev);
      if (checked) rows.forEach((u) => copy.add(u.id));
      else rows.forEach((u) => copy.delete(u.id));
      return copy;
    });
  };

  const toggleOne = (id, checked) => {
    setSelectedIds((prev) => {
      const copy = new Set(prev);
      if (checked) copy.add(id);
      else copy.delete(id);
      return copy;
    });
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between mb-4">
        <h1 className="text-2xl font-bold">Users</h1>
        <div className="flex gap-2">
          <Link
            to="/users/create"
            title="Add User (Alt+N)"
            aria-keyshortcuts="Alt+N"
            className="bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2"
          >
            <PlusCircleIcon className="w-5 h-5" />
            Add User
            <span className="ml-2 hidden sm:inline text-xs opacity-80 border rounded px-1 py-0.5">
              Alt+N
            </span>
          </Link>
        </div>
      </div>

      {/* Search toolbar (single box for name/email like controller 'search') */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <TextSearch
          value={qSearch}
          onChange={setQSearch}
          placeholder="Search by Name or Email…"
        />
        <div className="hidden md:block" />
        <div className="hidden md:block" />
      </div>

      {/* Meta */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
        <div className="text-sm text-gray-600">
          {loading ? (
            <span>Loading…</span>
          ) : (
            <span>
              Showing <strong>{rows.length === 0 ? 0 : start}-{end}</strong> of{" "}
              <strong>{total}</strong>
            </span>
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
            <option value={100}>100</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="w-full overflow-x-auto rounded border">
        <table className="w-full">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="border px-2 py-2 text-left">
                <input
                  type="checkbox"
                  aria-label="Select all on this page"
                  checked={pageAllChecked}
                  ref={(el) => {
                    if (el) el.indeterminate = pageIndeterminate;
                  }}
                  onChange={(e) => togglePageAll(e.target.checked)}
                />
              </th>
              <th className="border px-2 py-2 text-left">ID</th>
              <th className="border px-2 py-2 text-left">Name</th>
              <th className="border px-2 py-2 text-left">Email</th>
              <th className="border px-2 py-2 text-left">Status</th>
              <th className="border px-2 py-2 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !loading && (
              <tr>
                <td className="border px-3 py-6 text-center text-gray-500" colSpan={6}>
                  No users found.
                </td>
              </tr>
            )}
            {rows.map((u) => (
              <tr
                key={u.id}
                className={`transition-colors ${
                  selectedIds.has(u.id) ? "bg-blue-50" : "odd:bg-white even:bg-gray-50"
                } hover:bg-blue-100`}
              >
                <td className="border px-2 py-2">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(u.id)}
                    onChange={(e) => toggleOne(u.id, e.target.checked)}
                    aria-label={`Select user ${u.name}`}
                  />
                </td>
                <td className="border px-2 py-2">{u.id}</td>
                <td className="border px-2 py-2">{u.name}</td>
                <td className="border px-2 py-2">{u.email}</td>
                <td className="border px-2 py-2">{u.status ?? "active"}</td>
                <td className="border px-2 py-2">
                  <div className="flex gap-2 justify-center">
                    <Link
                      to={`/users/${u.id}/edit`}
                      className="bg-yellow-500 text-white px-3 py-1 rounded flex items-center gap-1"
                    >
                      <PencilSquareIcon className="w-5 h-5" />
                      Edit
                    </Link>
                    <button
                      onClick={() => openDeleteModal(u)}
                      className="px-3 py-1 rounded flex items-center gap-1 bg-red-600 text-white"
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

      {/* Pagination (server) */}
      <div className="mt-4 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="text-sm text-gray-600">
          Page {page} of {lastPage}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage(1)}
            disabled={page === 1}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            ⏮ First
          </button>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            ◀ Prev
          </button>
          <button
            onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
            disabled={page === lastPage}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            Next ▶
          </button>
          <button
            onClick={() => setPage(lastPage)}
            disabled={page === lastPage}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            Last ⏭
          </button>
        </div>
      </div>

      {/* Delete confirmation modal */}
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
                <h2 className="text-lg font-semibold mb-2">Delete user?</h2>
                <p className="text-sm text-gray-600">
                  {deletingUser?.name ? (
                    <>
                      Are you sure you want to delete <strong>{deletingUser.name}</strong>{" "}
                      ({deletingUser.email})?
                    </>
                  ) : (
                    "Are you sure you want to delete this user?"
                  )}{" "}
                  This action cannot be undone.
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
                  For security, please re-enter your password to delete this user.
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

function TextSearch({ value, onChange, placeholder }) {
  return (
    <div className="relative">
      <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-10 pr-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
}
