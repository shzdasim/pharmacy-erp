// src/pages/roles/index.jsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import axios from "axios";
import { listRoles, deleteRole } from "@/api/roles";
import {
  PlusCircleIcon,
  PencilSquareIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  ShieldExclamationIcon,
  UsersIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/solid";

// 🔒 permissions (align with other glass pages)
import { usePermissions, Guard } from "@/api/usePermissions.js";

// 🧊 glass primitives (same as products/users)
import {
  GlassCard,
  GlassSectionHeader,
  GlassToolbar,
  GlassInput,
  GlassBtn,
} from "@/components/glass.jsx";

export default function RolesIndex() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [qSearch, setQSearch] = useState("");

  // pagination (server-side)
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);

  const controllerRef = useRef(null);
  const debounceRef = useRef(null);
  const navigate = useNavigate();

  // 🔒 permissions for 'role'
  const { loading: permsLoading, canFor } = usePermissions();
  const can = useMemo(
    () =>
      (typeof canFor === "function"
        ? canFor("role")
        : { view: false, create: false, update: false, delete: false }),
    [canFor]
  );

  // 🧊 tint palette (identical to products/users)
  const tintBlue   = "bg-blue-500/85 text-white shadow-[0_6px_20px_-6px_rgba(37,99,235,0.45)] ring-1 ring-white/20 hover:bg-blue-500/95";
  const tintSlate  = "bg-slate-900/80 text-white shadow-[0_6px_20px_-6px_rgba(15,23,42,0.45)] ring-1 ring-white/15 hover:bg-slate-900/90";
  const tintAmber  = "bg-amber-500/85 text-white shadow-[0_6px_20px_-6px_rgba(245,158,11,0.45)] ring-1 ring-white/20 hover:bg-amber-500/95";
  const tintRed    = "bg-rose-500/85 text-white shadow-[0_6px_20px_-6px_rgba(244,63,94,0.45)] ring-1 ring-white/20 hover:bg-rose-500/95";
  const tintGlass  = "bg-white/60 text-slate-700 ring-1 ring-white/30 hover:bg-white/75 dark:bg-slate-700/60 dark:text-slate-300 dark:ring-slate-600/50 dark:hover:bg-slate-700/75";

  // === Alt+N => /roles/create (gated by can.create) ===
  useEffect(() => {
    const onKeyDown = (e) => {
      if (!e.altKey) return;
      if ((e.key || "").toLowerCase() !== "n") return;
      const tag = (e.target?.tagName || "").toLowerCase();
      const isTyping = ["input","textarea","select"].includes(tag) || e.target?.isContentEditable;
      if (isTyping) return;
      if (!can.create) return;
      e.preventDefault();
      navigate("/roles/create");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navigate, can.create]);

  const fetchRoles = useCallback(async (signal) => {
    try {
      setLoading(true);
      const { data } = await listRoles({ page, per_page: pageSize, search: qSearch.trim(), signal });
      const items = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
      const meta = data?.meta || data || {};
      setRows(items);
      setTotal(Number(meta?.total ?? items.length ?? 0));
      const lp = Number(meta?.last_page ?? 1);
      setLastPage(lp);
      if (page > lp) setPage(lp || 1);
    } catch (err) {
      if (axios.isCancel?.(err)) return;
      const status = err?.response?.status;
      if (status === 403 || status === 401) {
        toast.error("You don't have permission to view roles.");
        return;
      }
      toast.error("Failed to load roles");
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
    fetchRoles(ctrl.signal);
  }, [permsLoading, can.view, page, pageSize, fetchRoles]);

  // Debounce search
  useEffect(() => {
    if (permsLoading || !can.view) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      if (controllerRef.current) controllerRef.current.abort();
      const ctrl = new AbortController();
      controllerRef.current = ctrl;
      fetchRoles(ctrl.signal);
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [permsLoading, can.view, qSearch, fetchRoles]);

  const start = rows.length ? (page - 1) * pageSize + 1 : 0;
  const end = rows.length ? start + rows.length - 1 : 0;

  // ===== Secure delete (two-step confirm + password) =====
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteStep, setDeleteStep] = useState(1); // 1 = confirm, 2 = password
  const [deletingRole, setDeletingRole] = useState(null); // { id, name }
  const [password, setPassword] = useState("");
  const [deleting, setDeleting] = useState(false);

  const openDeleteModal = (role) => {
    if (!can.delete) return toast.error("You don't have permission to delete roles.");
    setDeletingRole({ id: role.id, name: role.name });
    setPassword("");
    setDeleteStep(1);
    setDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    if (deleting) return;
    setDeleteModalOpen(false);
    setDeleteStep(1);
    setDeletingRole(null);
    setPassword("");
  };

  const proceedToPassword = () => setDeleteStep(2);

  const confirmAndDelete = async () => {
    if (!deletingRole?.id) return;
    if (!can.delete) return toast.error("You don't have permission to delete roles.");
    try {
      setDeleting(true);
      // optional: confirm password via your Sanctum endpoint to match other pages
      await axios.post("/api/auth/confirm-password", { password });
      await deleteRole(deletingRole.id);
      toast.success("Role deleted");
      closeDeleteModal();
      // refresh
      if (controllerRef.current) controllerRef.current.abort();
      const ctrl = new AbortController();
      controllerRef.current = ctrl;
      fetchRoles(ctrl.signal);
    } catch (e) {
      const status = e?.response?.status;
      const apiMsg =
        e?.response?.data?.message ||
        (status === 422 ? "Incorrect password" : status === 403 ? "You don't have permission to manage roles." : "Delete failed");
      toast.error(apiMsg);
    } finally {
      setDeleting(false);
    }
  };

  if (permsLoading) return <div className="p-6 dark:text-gray-400">Loading…</div>;
  if (!can.view) return <div className="p-6 text-sm text-gray-700 dark:text-gray-300">You don't have permission to view roles.</div>;

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* ===== Header ===== */}
      <GlassCard>
        <GlassSectionHeader
          title={
            <span className="inline-flex items-center gap-2">
              <UsersIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <span className="dark:text-gray-100">Roles</span>
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
                  fetchRoles(ctrl.signal);
                }}
                title="Refresh"
                aria-label="Refresh roles"
              >
                <span className="inline-flex items-center gap-2">
                  <ArrowPathIcon className="w-5 h-5" />
                  Refresh
                </span>
              </GlassBtn>

              <Guard when={can.create}>
                <Link
                  to="/roles/create"
                  title="Add Role (Alt+N)"
                  aria-keyshortcuts="Alt+N"
                  className={`h-10 min-w-[150px] inline-flex items-center justify-center gap-2 rounded-xl px-3 ${tintBlue}`}
                >
                  <PlusCircleIcon className="w-5 h-5" />
                  Add Role
                </Link>
              </Guard>
            </div>
          }
        />

        {/* Search + meta */}
        <GlassToolbar className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <TextSearch value={qSearch} onChange={setQSearch} placeholder="Search roles…" />
          <div className="md:col-span-2 flex items-center justify-between gap-3">
            <div className="text-sm text-gray-700 dark:text-gray-300">
              {loading ? "Loading…" : (
                <>Showing <strong>{rows.length === 0 ? 0 : start}-{end}</strong> of <strong>{total}</strong></>
              )}
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-700 dark:text-gray-300">Rows per page</label>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="h-9 px-2 rounded-xl bg-white/70 backdrop-blur-sm border border-gray-200/70 ring-1 ring-transparent focus:ring-blue-400/40 shadow-sm text-sm dark:bg-slate-700/70 dark:border-slate-600/70 dark:text-gray-200 dark:focus:ring-blue-400/60"
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

      {/* ===== Table ===== */}
      <GlassCard>
        <div className="max-h-[70vh] overflow-auto rounded-b-2xl">
          <table className="w-full text-sm text-gray-900 dark:text-gray-100">
            <thead className="sticky top-0 bg-white/90 backdrop-blur-sm z-10 border-b border-gray-200/70 dark:bg-slate-700/90 dark:border-slate-600/70">
              <tr className="text-left">
                <th className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100">ID</th>
                <th className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100">Name</th>
                <th className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100">Permissions</th>
                {(can.update || can.delete) && <th className="px-3 py-2 font-medium text-center text-gray-900 dark:text-gray-100">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && !loading && (
                <tr>
                  <td className="px-3 py-10 text-center text-gray-600 dark:text-gray-400" colSpan={4}>
                    No roles found.
                  </td>
                </tr>
              )}

              {rows.map((r) => (
                <tr
                  key={r.id}
                  className={`transition-colors odd:bg-white/90 even:bg-white/70 dark:odd:bg-slate-700/60 dark:even:bg-slate-800/60 hover:bg-blue-50 dark:hover:bg-slate-600/70`}
                >
                  <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{r.id}</td>
                  <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{r.name}</td>
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-xl text-xs ring-1 ring-gray-200/70 bg-white/70 dark:bg-slate-700/70 dark:ring-slate-600/50">
                      {r.permissions_count ?? 0}
                    </span>
                  </td>
                  {(can.update || can.delete) && (
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2 justify-center">
                        <Guard when={can.update}>
                          <Link
                            to={`/roles/${r.id}/edit`}
                            className={`h-9 min-w-[100px] inline-flex items-center justify-center gap-1 rounded-xl px-3 ${tintAmber}`}
                            title={`Edit ${r.name}`}
                          >
                            <PencilSquareIcon className="w-5 h-5" />
                            Edit
                          </Link>
                        </Guard>

                        <Guard when={can.delete}>
                          <GlassBtn
                            onClick={() => openDeleteModal(r)}
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

      {/* ===== Delete confirmation modal (glassy) ===== */}
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
                  <ShieldExclamationIcon className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                  <span className="dark:text-gray-100">Delete role</span>
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
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      {deletingRole?.name ? (
                        <>Are you sure you want to delete <strong>{deletingRole.name}</strong>? </>
                      ) : "Are you sure you want to delete this role? "}
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
                    <p className="text-sm text-gray-700 dark:text-gray-300">For security, please re-enter your password to delete this role.</p>
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
      <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
      <GlassInput
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-10 w-full"
      />
    </div>
  );
}

