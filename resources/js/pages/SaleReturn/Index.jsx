// src/pages/sale-returns/index.jsx
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import {
  MagnifyingGlassIcon,
  PlusCircleIcon,
  PencilSquareIcon,
  TrashIcon,
  ArrowPathIcon,
  ShieldExclamationIcon,
  XMarkIcon,
} from "@heroicons/react/24/solid";
import { usePermissions, Guard } from "@/api/usePermissions.js"; // 🔒

// 🧊 glass primitives (shared)
import {
  GlassCard,
  GlassSectionHeader,
  GlassToolbar,
  GlassInput,
  GlassBtn,
} from "@/components/glass.jsx";

export default function SaleReturnsIndex() {
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);

  // search + pagination (client-side)
  const [qPosted, setQPosted] = useState("");
  const [qCustomer, setQCustomer] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const navigate = useNavigate();

  // 🔒 permissions
  const { loading: permsLoading, canFor } = usePermissions();
  const can = useMemo(
    () =>
      (typeof canFor === "function" ? canFor("sale-return") : {
        view:false, create:false, update:false, delete:false, import:false, export:false
      }),
    [canFor]
  );

  // 🧊 tint palette (consistent)
  const tintBlue   = "bg-blue-500/85 text-white shadow-[0_6px_20px_-6px_rgba(37,99,235,0.45)] ring-1 ring-white/20 hover:bg-blue-500/95";
  const tintIndigo = "bg-indigo-500/85 text-white shadow-[0_6px_20px_-6px_rgba(99,102,241,0.45)] ring-1 ring-white/20 hover:bg-indigo-500/95";
  const tintSlate  = "bg-slate-900/80 text-white shadow-[0_6px_20px_-6px_rgba(15,23,42,0.45)] ring-1 ring-white/15 hover:bg-slate-900/90";
  const tintAmber  = "bg-amber-500/85 text-white shadow-[0_6px_20px_-6px_rgba(245,158,11,0.45)] ring-1 ring-white/20 hover:bg-amber-500/95";
  const tintRed    = "bg-rose-500/85 text-white shadow-[0_6px_20px_-6px_rgba(244,63,94,0.45)] ring-1 ring-white/20 hover:bg-rose-500/95";
  const tintGlass  = "bg-white/60 text-slate-700 ring-1 ring-white/30 hover:bg-white/75";

  useEffect(() => {
    if (permsLoading) return;
    if (!can.view) { setReturns([]); setLoading(false); return; }
    fetchReturns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permsLoading, can.view]);

  // Alt+N -> create (ignore when typing)
  useEffect(() => {
    const onKeyDown = (e) => {
      if (!e.altKey) return;
      if ((e.key || "").toLowerCase() !== "n") return;
      const tag = (e.target?.tagName || "").toLowerCase();
      const typing = ["input", "textarea", "select"].includes(tag) || e.target?.isContentEditable;
      if (typing) return;
      if (!can.create) return;
      e.preventDefault();
      navigate("/sale-returns/create");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navigate, can.create]);

  const fetchReturns = async () => {
    try {
      setLoading(true);
      const res = await axios.get("/api/sale-returns"); // expects customer relation
      setReturns(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      const status = err?.response?.status;
      if (status === 403) toast.error("You don't have permission to view sale returns.");
      else toast.error("Failed to fetch sale returns");
      setReturns([]);
    } finally {
      setLoading(false);
    }
  };

  // ===== secure delete modal (glassy) =====
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteStep, setDeleteStep] = useState(1); // 1 = confirm, 2 = password
  const [deletingId, setDeletingId] = useState(null);
  const [password, setPassword] = useState("");
  const [deleting, setDeleting] = useState(false);

  const openDeleteModal = (id) => {
    if (!can.delete) return toast.error("You don't have permission to delete sale returns.");
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
    if (!can.delete) return toast.error("You don't have permission to delete sale returns.");
    try {
      setDeleting(true);
      await axios.post("/api/auth/confirm-password", { password });
      await axios.delete(`/api/sale-returns/${deletingId}`);
      toast.success("Sale return deleted");
      closeDeleteModal();
      fetchReturns();
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        (err?.response?.status === 422 ? "Incorrect password" : "Failed to delete sale return");
      toast.error(msg);
    } finally {
      setDeleting(false);
    }
  };

  // ===== search + pagination (client-side) =====
  const norm = (v) => (v ?? "").toString().toLowerCase().trim();
  const filtered = useMemo(() => {
    const nPosted = norm(qPosted);
    const nCust = norm(qCustomer);
    return returns.filter((r) => {
      const posted = norm(r.posted_number);
      const customer = norm(r.customer?.name);
      return posted.includes(nPosted) && customer.includes(nCust);
    });
  }, [returns, qPosted, qCustomer]);

  useEffect(() => { setPage(1); }, [qPosted, qCustomer, pageSize]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);

  const start = (page - 1) * pageSize;
  const paged = filtered.slice(start, start + pageSize);

  if (permsLoading) return <div className="p-6">Loading…</div>;
  if (!can.view) return <div className="p-6 text-sm text-gray-700">You don’t have permission to view sale returns.</div>;

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* ===== Header ===== */}
      <GlassCard>
        <GlassSectionHeader
          title={
            <span className="inline-flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rose-600" />
              <span>Sale Returns</span>
            </span>
          }
          right={
            <div className="flex items-center gap-2">
              <GlassBtn
                className={`h-10 min-w-[120px] ${tintSlate}`}
                onClick={fetchReturns}
                title="Refresh"
                aria-label="Refresh sale returns"
              >
                <span className="inline-flex items-center gap-2">
                  <ArrowPathIcon className="w-5 h-5" />
                  Refresh
                </span>
              </GlassBtn>

              <Guard when={can.create}>
                <Link
                  to="/sale-returns/create"
                  title="Add Sale Return (Alt+N)"
                  aria-keyshortcuts="Alt+N"
                  className={`h-10 min-w-[170px] inline-flex items-center justify-center gap-2 rounded-xl px-3 ${tintBlue}`}
                >
                  <PlusCircleIcon className="w-5 h-5" />
                  Add Sale Return
                </Link>
              </Guard>
            </div>
          }
        />

        {/* Search toolbar */}
        <GlassToolbar className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <TextSearch
            value={qPosted}
            onChange={setQPosted}
            placeholder="Search by Posted No (e.g., SR-000001 or SRRET-0001)…"
          />
          <TextSearch
            value={qCustomer}
            onChange={setQCustomer}
            placeholder="Search by Customer…"
          />

          <div className="md:col-span-2 flex items-center justify-between gap-3">
            <div className="text-sm text-gray-700">
              {loading ? "Loading…" : (
                <>Showing <strong>{filtered.length === 0 ? 0 : start + 1}-{Math.min(filtered.length, start + pageSize)}</strong> of <strong>{returns.length}</strong>{filtered.length !== returns.length && <> (filtered: <strong>{filtered.length}</strong>)</>}</>
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
          <table className="w-full text-sm text-gray-900">
            <thead className="sticky top-0 bg-white/90 backdrop-blur-sm z-10 border-b border-gray-200/70">
              <tr className="text-left">
                <th className="px-3 py-2 font-medium">#</th>
                <th className="px-3 py-2 font-medium">Posted No</th>
                <th className="px-3 py-2 font-medium">Customer</th>
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium text-right">Amount</th>
                <th className="px-3 py-2 font-medium text-center">Actions</th>
              </tr>
            </thead>

            <tbody>
              {(!loading && filtered.length === 0) && (
                <tr>
                  <td className="px-3 py-10 text-center text-gray-600" colSpan={6}>
                    No sale returns found.
                  </td>
                </tr>
              )}

              {paged.map((ret, idx) => (
                <tr
                  key={ret.id}
                  className="transition-colors odd:bg-white/90 even:bg-white/70 hover:bg-blue-50"
                >
                  <td className="px-3 py-2">{start + idx + 1}</td>
                  <td className="px-3 py-2">{ret.posted_number || "-"}</td>
                  <td className="px-3 py-2">{ret.customer?.name ?? "N/A"}</td>
                  <td className="px-3 py-2">{ret.date}</td>
                  <td className="px-3 py-2 text-right">
                    {Number(ret.total ?? 0).toLocaleString()}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-2 justify-center">
                      <Guard when={can.update}>
                        <Link
                          to={`/sale-returns/${ret.id}/edit`}
                          className={`h-9 min-w：[100px] inline-flex items-center justify-center gap-1 rounded-xl px-3 ${tintAmber}`}
                          title="Edit"
                        >
                          <PencilSquareIcon className="w-5 h-5" />
                          Edit
                        </Link>
                      </Guard>

                      <Guard when={can.delete}>
                        <GlassBtn
                          onClick={() => openDeleteModal(ret.id)}
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination (glassy controls) */}
        <div className="px-3 py-3 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="text-sm text-gray-700">Page {page} of {pageCount}</div>
          <div className="flex items-center gap-2">
            <GlassBtn onClick={() => setPage(1)} disabled={page === 1} className={`h-9 px-3 ${tintGlass}`}>
              ⏮ First
            </GlassBtn>
            <GlassBtn onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className={`h-9 px-3 ${tintGlass}`}>
              ◀ Prev
            </GlassBtn>
            <GlassBtn onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={page === pageCount} className={`h-9 px-3 ${tintGlass}`}>
              Next ▶
            </GlassBtn>
            <GlassBtn onClick={() => setPage(pageCount)} disabled={page === pageCount} className={`h-9 px-3 ${tintGlass}`}>
              Last ⏭
            </GlassBtn>
          </div>
        </div>
      </GlassCard>

      {/* ===== Delete confirmation modal (glassy) ===== */}
      {deleteModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          onClick={(e) => { if (e.target === e.currentTarget) closeDeleteModal(); }}
        >
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative w-full max-w-md">
            <GlassCard>
              <GlassSectionHeader
                title={<span className="inline-flex items-center gap-2">
                  <ShieldExclamationIcon className="w-5 h-5 text-rose-600" />
                  <span>Delete sale return</span>
                </span>}
                right={
                  <GlassBtn className={`h-8 px-3 ${tintGlass}`} onClick={closeDeleteModal} title="Close">
                    <XMarkIcon className="w-5 h-5" />
                  </GlassBtn>
                }
              />
              <div className="px-4 py-4 space-y-4">
                {deleteStep === 1 ? (
                  <>
                    <p className="text-sm text-gray-700">
                      Are you sure you want to delete this sale return? This action cannot be undone.
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
                ) : (
                  <>
                    <p className="text-sm text-gray-700">
                      For security, please re-enter your password to delete this sale return.
                    </p>
                    <GlassInput
                      type="password"
                      autoFocus
                      value={password}
                      onChange={(e)=>setPassword(e.target.value)}
                      placeholder="Your password"
                      onKeyDown={(e)=>{ if(e.key==="Enter") confirmAndDelete(); if(e.key==="Escape") closeDeleteModal(); }}
                      className="w-full"
                    />
                    <div className="flex justify-between">
                      <GlassBtn className={`min-w-[90px] ${tintGlass}`} onClick={()=>setDeleteStep(1)} disabled={deleting}>
                        ← Back
                      </GlassBtn>
                      <div className="flex gap-2">
                        <GlassBtn className={`min-w-[100px] ${tintGlass}`} onClick={closeDeleteModal} disabled={deleting}>
                          Cancel
                        </GlassBtn>
                        <GlassBtn
                          className={`min-w-[170px] ${tintRed} disabled:opacity-60`}
                          onClick={confirmAndDelete}
                          disabled={deleting || password.trim()===""}
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
