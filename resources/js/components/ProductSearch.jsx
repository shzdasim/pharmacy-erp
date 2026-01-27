// src/components/ProductSearch.jsx
import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import {
  MagnifyingGlassIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  ArrowTopRightOnSquareIcon,
  PhotoIcon,
} from "@heroicons/react/24/solid";
import { GlassCard, GlassInput, GlassToolbar, GlassBtn } from "@/components/glass";

/* ─────────────── Helpers ─────────────── */
function fmtMoney(v) {
  if (v == null || v === "") return "—";
  const n = Number(v);
  return Number.isNaN(n)
    ? String(v)
    : n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* ─────────────── List Row ─────────────── */
function ResultRow({ p, active, onHover, onOpen }) {
  return (
    <li
      onMouseEnter={onHover}
      className={[
        "px-4 py-3 transition select-none cursor-pointer",
        active ? "bg-slate-100 dark:bg-slate-700" : "hover:bg-slate-50 dark:hover:bg-slate-700/50",
      ].join(" ")}
      onClick={onOpen}
      title="Open product"
      aria-label="Open product"
    >
      <div className="flex items-start justify-between gap-3 bg-white dark:bg-slate-800">
        <div className="min-w-0">
          <div className="font-medium text-slate-800 dark:text-slate-100 truncate">{p.name || "—"}</div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-0.5 text-xs text-slate-600 dark:text-slate-400">
            {p.brand?.name && (
              <span>
                Brand: <b>{p.brand.name}</b>
              </span>
            )}
            {p.supplier?.name && (
              <span>
                Supplier: <b>{p.supplier.name}</b>
              </span>
            )}
            {p.pack_size != null && (
              <span>
                Pack: <b>{p.pack_size}</b>
              </span>
            )}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[11px] text-slate-500 dark:text-slate-400">Pack Prices</div>
          <div className="text-sm">
            <span className="text-slate-700 dark:text-slate-200">{fmtMoney(p.pack_sale_price)}</span>
            <span className="text-slate-400"> / </span>
            <span className="text-slate-500 dark:text-slate-400">{fmtMoney(p.pack_purchase_price)}</span>
          </div>
        </div>
      </div>
    </li>
  );
}

/* ─────────────── Detail Pane ─────────────── */
function DetailPane({ detail, loading, error, onOpen }) {
  return (
    <div className="hidden md:block border-l border-slate-200 dark:border-white/10 min-h-[280px] bg-white dark:bg-slate-800">
      {loading && <div className="p-6 text-sm text-slate-500 dark:text-slate-400">Loading details…</div>}
      {!loading && error && <div className="p-6 text-sm text-rose-600 dark:text-rose-400">{error}</div>}
      {!loading && !detail && !error && (
        <div className="p-6 text-sm text-slate-500 dark:text-slate-400">
          Hover or select a product to preview details.
        </div>
      )}
      {!loading && detail && (
        <div className="p-4">
          <div className="flex items-start gap-4">
            <div className="w-24 h-24 rounded-xl overflow-hidden bg-white dark:bg-slate-700 ring-1 ring-slate-200 dark:ring-white/10">
              {detail.image ? (
                <img
                  src={
                    detail.image.startsWith("http")
                      ? detail.image
                      : `/storage/${detail.image}`
                  }
                  alt={detail.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full grid place-items-center text-slate-400">
                  <PhotoIcon className="w-7 h-7" />
                </div>
              )}
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-slate-800 dark:text-slate-100">{detail.name}</div>
              <div className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
                {detail.formulation || "—"}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                <div>
                  <span className="text-slate-500 dark:text-slate-400">Category:</span>{" "}
                  <b className="text-slate-700 dark:text-slate-200">{detail.category?.name || "—"}</b>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400">Brand:</span>{" "}
                  <b className="text-slate-700 dark:text-slate-200">{detail.brand?.name || "—"}</b>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400">Supplier:</span>{" "}
                  <b className="text-slate-700 dark:text-slate-200">{detail.supplier?.name || "—"}</b>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400">Pack Size:</span>{" "}
                  <b className="text-slate-700 dark:text-slate-200">{detail.pack_size ?? "—"}</b>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400">Pack Purchase:</span>{" "}
                  <b className="text-slate-700 dark:text-slate-200">{fmtMoney(detail.pack_purchase_price)}</b>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400">Pack Sale:</span>{" "}
                  <b className="text-slate-700 dark:text-slate-200">{fmtMoney(detail.pack_sale_price)}</b>
                </div>
              </div>
            </div>
          </div>

          {/* Glassy button from your primitives */}
          <div className="mt-4">
            <GlassBtn
              variant="ghost"
              title="Open product"
              aria-label="Open product"
              onClick={onOpen}
              className="inline-flex items-center gap-2"
            >
              <ArrowTopRightOnSquareIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <span className="text-slate-800 dark:text-slate-100">Open Product</span>
            </GlassBtn>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────── Main ─────────────── */
export default function ProductSearch() {
  const [q, setQ] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);

  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [activeIdx, setActiveIdx] = useState(-1);

  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  const inputRef = useRef(null);
  const boxRef = useRef(null);
  const abortRef = useRef(null);
  const debounceRef = useRef(null);

  // Focus shortcut: Alt+/
  useEffect(() => {
    const onKey = (e) => {
      if (e.altKey && (e.key === "/" || e.code === "Slash")) {
        e.preventDefault();
        inputRef.current?.focus();
        setPanelOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Close on outside / Esc
  useEffect(() => {
    const onDoc = (e) => {
      if (!panelOpen) return;
      if (boxRef.current && !boxRef.current.contains(e.target)) setPanelOpen(false);
    };
    const onEsc = (e) => e.key === "Escape" && setPanelOpen(false);
    window.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onEsc);
    return () => {
      window.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onEsc);
    };
  }, [panelOpen]);

  // Debounced search
  useEffect(() => {
    if (!panelOpen) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      if (abortRef.current) abortRef.current.abort();
      abortRef.current = new AbortController();
      const signal = abortRef.current.signal;

      const term = q.trim();
      if (!term) {
        setResults([]);
        setActiveIdx(-1);
        setDetail(null);
        return;
      }

      setLoading(true);
      try {
        const res = await axios.get("/api/products/search", {
          params: { q: term, limit: 30 },
          signal,
        });
        const arr = Array.isArray(res.data) ? res.data : [];
        setResults(arr);
        setActiveIdx(arr.length ? 0 : -1);
      } catch (err) {
        if (!axios.isCancel(err)) console.error(err);
      } finally {
        setLoading(false);
      }
    }, 220);

    return () => clearTimeout(debounceRef.current);
  }, [q, panelOpen]);

  // Fetch detail for active item
  useEffect(() => {
    const active = results[activeIdx];
    if (!panelOpen || !active) {
      setDetail(null);
      setDetailError("");
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    setDetailError("");
    axios
      .get(`/api/products/${active.id}`)
      .then((r) => !cancelled && setDetail(r.data))
      .catch((e) => {
        if (!cancelled) {
          console.error(e);
          setDetail(null);
          setDetailError("Unable to load product detail.");
        }
      })
      .finally(() => !cancelled && setDetailLoading(false));
    return () => {
      cancelled = true;
    };
  }, [activeIdx, results, panelOpen]);

  const onOpen = (id) =>
    window.open(`/products/${id}/edit`, "_blank", "noopener,noreferrer");

  const onKeyDown = (e) => {
    if (!panelOpen) return;
    if (["ArrowDown", "ArrowUp", "Enter", "Escape", "Tab"].includes(e.key))
      e.preventDefault();
    if (e.key === "ArrowDown")
      setActiveIdx((i) => Math.min((results.length || 1) - 1, i + 1));
    else if (e.key === "ArrowUp") setActiveIdx((i) => Math.max(0, i - 1));
    else if (e.key === "Enter") results[activeIdx] && onOpen(results[activeIdx].id);
    else if (e.key === "Escape") setPanelOpen(false);
  };

  return (
    <div className="relative z-40 w-full max-w-md bg-white dark:bg-slate-800" ref={boxRef}>
      {/* Search bar (glassy input) */}
      <div
        className={[
          "flex items-center gap-2 rounded-2xl px-3 h-10",
          "bg-white dark:bg-slate-700 ring-1 ring-slate-200 dark:ring-slate-600 shadow-sm",
          "transition-all hover:-translate-y-[1px] hover:shadow-md",
        ].join(" ")}
      >
        <MagnifyingGlassIcon className="w-5 h-5 text-slate-500" />
        <GlassInput
          ref={inputRef}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            if (!panelOpen) setPanelOpen(true);
          }}
          onFocus={() => setPanelOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search products… (Alt+/)"
          className="w-full bg-white dark:bg-slate-700 border-0 ring-0 focus:ring-0 focus:border-0 placeholder:text-slate-400 dark:placeholder:text-slate-500 text-slate-900 dark:text-slate-100"
          title="Search products (Alt+/)"
          aria-label="Search products"
        />
        {loading ? (
          <ArrowPathIcon
            className="w-4 h-4 animate-spin text-slate-500"
            title="Loading"
            aria-label="Loading"
          />
        ) : q ? (
          <GlassBtn
            variant="chip"
            title="Clear search"
            aria-label="Clear search"
            onClick={() => {
              setQ("");
              setResults([]);
              setActiveIdx(-1);
              setDetail(null);
            }}
          >
            Clear
          </GlassBtn>
        ) : (
          <kbd className="text-[11px] border border-slate-300 dark:border-slate-600 rounded px-1 py-0.5 bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-400">
            Alt+/
          </kbd>
        )}
      </div>

      {/* Results panel (solid card for readability; still using GlassCard infra) */}
      {panelOpen && (
        <GlassCard className="absolute left-0 mt-2 overflow-hidden bg-white dark:bg-slate-800 w-[900px] max-w-[calc(100vw-2rem)]">
          <GlassToolbar className="items-center justify-between pb-2 pt-2 bg-white dark:bg-slate-800">
            <div className="text-sm text-slate-600 dark:text-slate-300">
              {q ? (
                <>
                  Showing results for <span className="font-medium">"{q}"</span>
                </>
              ) : (
                <>Type to search products…</>
              )}
            </div>
            <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
              <span>
                <kbd className="border px-1 rounded">↑</kbd>/
                <kbd className="border px-1 rounded">↓</kbd> navigate
              </span>
              <span>
                <kbd className="border px-1 rounded">Enter</kbd> open
              </span>
              <span>
                <kbd className="border px-1 rounded">Esc</kbd> close
              </span>
            </div>
          </GlassToolbar>

          <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] border-t border-gray-200/60 dark:border-white/10 bg-white dark:bg-slate-800">
            {/* Left list */}
            <div className="max-h-[56vh] overflow-auto bg-white dark:bg-slate-800">
              {!loading && q && results.length === 0 && (
                <div className="px-4 py-6 text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2 bg-white dark:bg-slate-800">
                  <ExclamationTriangleIcon className="w-4 h-4" />
                  No products found.
                </div>
              )}
              <ul role="list" className="divide-y divide-slate-200 dark:divide-white/10 bg-white dark:bg-slate-800">
                {results.map((p, idx) => (
                  <ResultRow
                    key={p.id}
                    p={p}
                    active={idx === activeIdx}
                    onHover={() => setActiveIdx(idx)}
                    onOpen={() => onOpen(p.id)}
                  />
                ))}
              </ul>
            </div>

            {/* Right detail */}
            <DetailPane
              detail={detail}
              loading={detailLoading}
              error={detailError}
              onOpen={() => detail && onOpen(detail.id)}
            />
          </div>
        </GlassCard>
      )}
    </div>
  );
}

