// src/pages/users/index.jsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  TrashIcon,
  PencilSquareIcon,
  PlusCircleIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  ShieldExclamationIcon,
  UsersIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/solid";

// 🔒 permissions (matching ProductsIndex pattern)
import { usePermissions, Guard } from "@/api/usePermissions.js";

// 🧊 glass primitives (same as products)
import {
  GlassCard,
  GlassSectionHeader,
  GlassToolbar,
  GlassInput,
  GlassBtn,
} from "@/components/glass.jsx";

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

  // 🔒 permissions (entity: 'user' to mirror 'product')
  const { loading: permsLoading, canFor } = usePermissions();
  const can = useMemo(
    () =>
      (typeof canFor === "function"
        ? canFor("user")
        : { view: false, create: false, update: false, delete: false }),
    [canFor]
  );

  // 🧊 iOS-style tinted glass palette (identical to products/index.jsx)
  const tintBlue   = "bg-blue-500/85 text-white shadow-[0_6px_20px_-6px_rgba(37,99,235,0.45)] ring-1 ring-white/20 hover:bg-blue-500/95";
  const tintIndigo = "bg-indigo-500/85 text-white shadow-[0_6px_20px_-6px_rgba(99,102,241,0.45)] ring-1 ring-white/20 hover:bg-indigo-500/95";
  const tintSlate  = "bg-slate-900/80 text-white shadow-[0_6px_20px_-6px_rgba(15,23,42,0.45)] ring-1 ring-white/15 hover:bg-slate-900/90";
  const tintAmber  = "bg-amber-500/85 text-white shadow-[0_6px_20px_-6px_rgba(245,158,11,0.45)] ring-1 ring-white/20 hover:bg-amber-500/95";
  const tintRed    = "bg-rose-500/85 text-white shadow-[0_6px_20px_-6px_rgba(244,63,94,0.45)] ring-1 ring-white/20 hover:bg-rose-500/95";
  const tintGlass  = "bg-white/60 text-slate-700 ring-1 ring-white/30 hover:bg-white/75";

  // === Alt+N => /users/create (only when can.create) ===
  useEffect(() => {
    const onKeyDown = (e) => {
      if (!e.altKey) return;
      const key = (e.key || "").toLowerCase();
      if (key !== "n") return;
      const tag = (e.target?.tagName || "").toLowerCase();
      const isTyping = ["input", "textarea", "select"].includes(tag) || e.target?.isContentEditable;
      if (isTyping) return;
      if (!can.create) return;
      e.preventDefault();
      navigate("/users/create");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navigate, can.create]);

  const fetchUsers = useCallback(async (signal) => {
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

      // Expecting { data: [...], meta: {...} } or a raw array fallback
      const items = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
      const meta = data?.meta || data; // tolerate either
      setRows(items);
      setTotal(Number(meta?.total ?? items.length ?? 0));
      const lp = Number(meta?.last_page ?? 1);
      setLastPage(lp);
      if (page > lp) setPage(lp || 1);
    } catch (err) {
      if (axios.isCancel?.(err)) return;
      const status = err?.response?.status;
      if (status === 403 || status === 401) {
        toast.error("You don’t have permission to view users.");
        return;
      }
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, qSearch]);

  // Initial + pager change (non-debounced)
  useEffect(() => {
    if (permsLoading || !can.view) return;
    if (controllerRef.current) controllerRef.current.abort();
    const ctrl = new AbortController();
    controllerRef.current = ctrl;
    fetchUsers(ctrl.signal);
  }, [permsLoading, can.view, page, pageSize, fetchUsers]);

  // Debounce filter changes (qSearch)
  useEffect(() => {
    if (permsLoading || !can.view) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      if (controllerRef.current) controllerRef.current.abort();
      const ctrl = new AbortController();
      controllerRef.current = ctrl;
      fetchUsers(ctrl.signal);
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [permsLoading, can.view, qSearch, fetchUsers]);

  const start = rows.length ? (page - 1) * pageSize + 1 : 0;
  const end = rows.length ? start + rows.length - 1 : 0;

  // ===== Delete (secure confirm) =====
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteStep, setDeleteStep] = useState(1); // 1 = confirm, 2 = password
  const [deletingUser, setDeletingUser] = useState(null); // { id, name, email }
  const [password, setPassword] = useState("");
  const [deleting, setDeleting] = useState(false);

  const openDeleteModal = (u) => {
    if (!can.delete) return toast.error("You don't have permission to delete users.");
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
    if (!can.delete) return toast.error("You don't have permission to delete users.");
    try {
      setDeleting(true);
      await axios.post("/api/auth/confirm-password", { password });
      await axios.delete(`/api/users/${deletingUser.id}`);
      toast.success("User deleted");

      setSelectedIds((prev) => {
        const copy = new Set(prev);
        copy.delete(deletingUser.id);
        return copy;
      });

      closeDeleteModal();

      if (controllerRef.current) controllerRef.current.abort();
      const ctrl = new AbortController();
      controllerRef.current = ctrl;
      fetchUsers(ctrl.signal);
    } catch (err) {
      const status = err?.response?.status;
      const apiMsg =
        err?.response?.data?.message ||
        (status === 422 ? "Incorrect password" : status === 403 ? "You don't have permission to manage users." : "Delete failed");
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

  if (permsLoading) return <div className="p-6 dark:text-gray-400">Loading…</div>;
  if (!can.view) return <div className="p-6 text-sm text-gray-700">You don’t have permission to view users.</div>;

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* ===== Header ===== */}
      <GlassCard>
        <GlassSectionHeader
          title={
            <span className="inline-flex items-center gap-2">
              <UsersIcon className="w-5 h-5 text-blue-600" />
              <span>Users</span>
            </span>
          }
          right={
            <div className="flex items-center gap-2">
              <GlassBtn
                className={`h-10 min-w-[120px] ${tintSlate}`}
                onClick={() => {
                  if (controllerRef.current) controllerRef.current.abort();
                  const ctrl = new AbortController();
                  controllerRef.current = ctrl;
                  fetchUsers(ctrl.signal);
                }}
                title="Refresh"
                aria-label="Refresh users"
              >
                <span className="inline-flex items-center gap-2">
                  <ArrowPathIcon className="w-5 h-5" />
                  Refresh
                </span>
              </GlassBtn>

              <Guard when={can.create}>
                <Link
                  to="/users/create"
                  title="Add User (Alt+N)"
                  aria-keyshortcuts="Alt+N"
                  className={`h-10 min-w-[150px] inline-flex items-center justify-center gap-2 rounded-xl px-3 ${tintBlue}`}
                >
                  <PlusCircleIcon className="w-5 h-5" />
                  Add User
                </Link>
              </Guard>
            </div>
          }
        />

        {/* Search toolbar */}
        <GlassToolbar className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <TextSearch value={qSearch} onChange={setQSearch} placeholder="Search by Name or Email…" />

          {/* Meta + page size (aligned like products) */}
          <div className="md:col-span-2 flex items-center justify-between gap-3">
            <div className="text-sm text-gray-700 dark:text-gray-300">
              {loading ? "Loading…" : (
                <>Showing <strong>{rows.length === 0 ? 0 : start}-{end}</strong> of <strong>{total}</strong></>
              )}
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-700">Rows per page</label>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="h-9 px-2 rounded-xl bg-white/70 backdrop-blur-sm border border-gray-200/70 ring-1 ring-transparent focus:ring-blue-400/40 shadow-sm text-sm"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>
        </GlassToolbar>
      </GlassCard>

      {/* ===== Table card ===== */}
      <GlassCard>
        <div className="max-h-[70vh] overflow-auto rounded-b-2xl">
          <table className="w-full text-sm text-gray-900 dark:text-gray-100">
            <thead className="sticky top-0 bg-white/90 dark:bg-slate-700/90 backdrop-blur-sm z-10 border-b border-gray-200/70 dark:border-slate-600/70">
              <tr className="text-left">
                <th className="px-3 py-2 text-gray-900 dark:text-gray-100">
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
                <th className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100">ID</th>
                <th className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100">Name</th>
                <th className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100">Email</th>
                <th className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100">Status</th>
                {(can.update || can.delete) && <th className="px-3 py-2 font-medium text-center text-gray-900 dark:text-gray-100">Actions</th>}
              </tr>
            </thead>

            <tbody>
              {rows.length === 0 && !loading && (
                <tr>
                  <td className="px-3 py-10 text-center text-gray-600 dark:text-gray-400" colSpan={6}>
                    No users found.
                  </td>
                </tr>
              )}

              {rows.map((u) => (
                <tr
                  key={u.id}
                  className={`transition-colors ${
                    selectedIds.has(u.id) ? "bg-blue-50 dark:bg-slate-600/50" : "odd:bg-white/90 even:bg-white/70 dark:odd:bg-slate-700/60 dark:even:bg-slate-800/60"
                  } hover:bg-blue-50 dark:hover:bg-slate-600/70`}
                >
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(u.id)}
                      onChange={(e) => toggleOne(u.id, e.target.checked)}
                      aria-label={`Select user ${u.name}`}
                    />
                  </td>
                  <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{u.id}</td>
                  <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{u.name}</td>
                  <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{u.email}</td>
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-xl text-xs ring-1 ring-gray-200/70 bg-white/70 dark:bg-slate-700/70">
                      {u.status ?? "active"}
                    </span>
                  </td>

                  {(can.update || can.delete) && (
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2 justify-center">
                        <Guard when={can.update}>
                          <Link
                            to={`/users/${u.id}/edit`}
                            className={`h-9 min-w-[100px] inline-flex items-center justify-center gap-1 rounded-xl px-3 ${tintAmber}`}
                            title={`Edit ${u.name}`}
                          >
                            <PencilSquareIcon className="w-5 h-5" />
                            Edit
                          </Link>
                        </Guard>

                        <Guard when={can.delete}>
                          <GlassBtn
                            onClick={() => openDeleteModal(u)}
                            title="Delete"
                            className={`h-9 min-w-[100px] ${tintRed}`}
                          >
                            <span className="inline-flex items-center gap-1">
                              <TrashIcon className="w-5 h-5" />
                              Delete
                            </span>
                          </GlassBtn>
                        </Guard>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-3 py-3 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="text-sm text-gray-700 dark:text-gray-300">Page {page} of {lastPage}</div>
          <div className="flex items-center gap-2">
            <GlassBtn onClick={() => setPage(1)} disabled={page === 1} className={`h-9 px-3 ${tintGlass}`}>
              ⏮ First
            </GlassBtn>
            <GlassBtn onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className={`h-9 px-3 ${tintGlass}`}>
              ◀ Prev
            </GlassBtn>
            <GlassBtn onClick={() => setPage((p) => Math.min(lastPage, p + 1))} disabled={page === lastPage} className={`h-9 px-3 ${tintGlass}`}>
              Next ▶
            </GlassBtn>
            <GlassBtn onClick={() => setPage(lastPage)} disabled={page === lastPage} className={`h-9 px-3 ${tintGlass}`}>
              Last ⏭
            </GlassBtn>
          </div>
        </div>
      </GlassCard>

      {/* Delete confirmation modal (glassy) */}
      {deleteModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeDeleteModal();
          }}
        >
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative w-full max-w-md">
            <GlassCard>
              <GlassSectionHeader
                title={<span className="inline-flex items-center gap-2">
                  <ShieldExclamationIcon className="w-5 h-5 text-rose-600" />
                  <span>Delete user</span>
                </span>}
                right={
                  <GlassBtn className={`h-8 px-3 ${tintGlass}`} onClick={closeDeleteModal} title="Close">
                    <XMarkIcon className="w-5 h-5" />
                  </GlassBtn>
                }
              />
              <div className="px-4 py-4 space-y-4">
                {deleteStep === 1 && (
                  <>
                    <p className="text-sm text-gray-700">
                      {deletingUser?.name ? (
                        <>Are you sure you want to delete <strong>{deletingUser.name}</strong> ({deletingUser.email})? </>
                      ) : "Are you sure you want to delete this user? "}
                      This action cannot be undone.
                    </p>
                    <div className="flex justify-end gap-2">
                      <GlassBtn className={`min-w-[100px] ${tintGlass}`} onClick={closeDeleteModal}>
                        Cancel
                      </GlassBtn>
                      <GlassBtn className={`min-w-[140px] ${tintRed}`} onClick={proceedToPassword}>
                        Yes, continue
                      </GlassBtn>
                    </div>
                  </>
                )}

                {deleteStep === 2 && (
                  <>
                    <p className="text-sm text-gray-700">For security, please re-enter your password to delete this user.</p>
                    <GlassInput
                      type="password"
                      autoFocus
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Your password"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") confirmAndDelete();
                        if (e.key === "Escape") closeDeleteModal();
                      }}
                      className="w-full"
                    />
                    <div className="flex justify-between">
                      <GlassBtn className={`min-w-[90px] ${tintGlass}`} onClick={() => setDeleteStep(1)} disabled={deleting}>
                        ← Back
                      </GlassBtn>
                      <div className="flex gap-2">
                        <GlassBtn className={`min-w-[100px] ${tintGlass}`} onClick={closeDeleteModal} disabled={deleting}>
                          Cancel
                        </GlassBtn>
                        <GlassBtn
                          className={`min-w-[170px] ${tintRed} disabled:opacity-60`}
                          onClick={confirmAndDelete}
                          disabled={deleting || password.trim() === ""}
                        >
                          {deleting ? "Deleting…" : "Confirm & Delete"}
                        </GlassBtn>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </GlassCard>
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
      <GlassInput
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-10 w-full"
      />
    </div>
  );
}
