// src/pages/roles/RoleForm.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { listAllPermissions } from "@/api/roles";

export default function RoleForm({ onSubmit, initial, submitting }) {
  const [name, setName] = useState("");
  const [allPerms, setAllPerms] = useState([]);          // ["user.view", ...]
  const [selected, setSelected] = useState(new Set());   // Set<string>
  const [filter, setFilter] = useState("");
  const formRef = useRef(null);

  // -- helpers ---------------------------------------------------------------
  const asStringArray = (x) => {
    if (Array.isArray(x)) return x;
    if (x && typeof x === "object") return Object.values(x);
    return [];
  };
  const norm = (s) => (s == null ? "" : String(s)).trim();
  const normalizeList = (xs) =>
    asStringArray(xs)
      .map((v) => (typeof v === "string" ? norm(v) : norm(v?.name)))
      .filter(Boolean);

  // Consistent action ordering
  const ACTION_ORDER = [
    "view",
    "create",
    "update",
    "delete",
    "import",
    "export",
    "generate",
    "sync.permissions",
    "assign.roles",
    "assign.permissions",
    "manage",
  ];

  const titleizeModule = (m) => {
    const map = {
      "sale-invoice": "Sale Invoice",
      "purchase-invoice": "Purchase Invoice",
      "sale-return": "Sale Return",
      "purchase-return": "Purchase Return",
      "stock-adjustment": "Stock Adjustment",
      settings: "Settings",
      category: "Category",
      brand: "Brand",
      supplier: "Supplier",
      product: "Product",
      customer: "Customer",
      user: "Users",
      role: "Roles",
      permission: "Permissions Registry",
      "customer-ledger": "Customer Ledger",
      "supplier-ledger": "Supplier Ledger",
      "purchase-order": "Purchase Order Forecast",
      invoice: "Invoice (Legacy)",
    };
    if (map[m]) return map[m];
    return m
      .split("-")
      .map((x) => x.charAt(0).toUpperCase() + x.slice(1))
      .join(" ");
  };

  // load available permissions (once)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data } = await listAllPermissions();
        if (!alive) return;
        setAllPerms(normalizeList(data));
      } catch (e) {
        console.error(e);
        if (alive) setAllPerms([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // apply initial when editing
  useEffect(() => {
    if (!initial) return;
    setName(norm(initial.name));
    const perms = normalizeList(initial.permissions);
    setSelected(new Set(perms));
  }, [initial]);

  const toggle = (perm, checked) => {
    const p = norm(perm);
    setSelected((prev) => {
      const copy = new Set(prev);
      checked ? copy.add(p) : copy.delete(p);
      return copy;
    });
  };

  const submit = (e) => {
    e.preventDefault();
    onSubmit({
      name: norm(name),
      permissions: Array.from(selected),
    });
  };

  // Alt+S => submit
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.altKey && (e.key || "").toLowerCase() === "s") {
        e.preventDefault();
        formRef.current?.requestSubmit();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // ===== Group permissions by module with ordered actions =====
  const rawGroups = useMemo(() => {
    const groups = {};
    for (const full of allPerms) {
      if (typeof full !== "string" || !full) continue;
      const parts = full.split(".");
      const module = parts.length > 1 ? parts[0] : full;
      const action = parts.length > 1 ? parts.slice(1).join(".") : ""; // for custom singles / manage
      if (!groups[module]) groups[module] = new Map(); // action -> perm
      groups[module].set(action || full, full);
    }
    // Convert to array with display label and ordered actions
    const out = [];
    Object.keys(groups)
      .sort((a, b) => titleizeModule(a).localeCompare(titleizeModule(b)))
      .forEach((module) => {
        const availableActions = Array.from(groups[module].keys());
        const ordered = [
          ...ACTION_ORDER.filter((a) => availableActions.includes(a)),
          ...availableActions.filter((a) => !ACTION_ORDER.includes(a)),
        ];
        out.push({
          module,
          label: titleizeModule(module),
          actions: ordered.map((a) => ({ action: a, perm: groups[module].get(a) })),
        });
      });
    return out;
  }, [allPerms]);

  // Text filter applies to action label or full perm string
  const groupedFiltered = useMemo(() => {
    const f = filter.trim().toLowerCase();
    if (!f) return rawGroups;
    return rawGroups
      .map((g) => {
        const actions = g.actions.filter(({ action, perm }) => {
          const label = (action || perm).toLowerCase().replace(/\./g, " ");
          return (
            label.includes(f) ||
            perm.toLowerCase().includes(f) ||
            g.label.toLowerCase().includes(f)
          );
        });
        return { ...g, actions };
      })
      .filter((g) => g.actions.length > 0);
  }, [rawGroups, filter]);

  // Global select/clear for CURRENT filtered modules/actions
  const allFilteredPerms = useMemo(
    () => groupedFiltered.flatMap((g) => g.actions.map((a) => a.perm)),
    [groupedFiltered]
  );

  const allChecked =
    allFilteredPerms.length > 0 &&
    allFilteredPerms.every((p) => selected.has(p));
  const someChecked =
    allFilteredPerms.some((p) => selected.has(p)) && !allChecked;

  const toggleFiltered = (checked) => {
    setSelected((prev) => {
      const copy = new Set(prev);
      allFilteredPerms.forEach((p) => (checked ? copy.add(p) : copy.delete(p)));
      return copy;
    });
  };

  // Per-module helpers
  const moduleAllSelected = (group) =>
    group.actions.length > 0 &&
    group.actions.every(({ perm }) => selected.has(perm));

  const moduleSomeSelected = (group) =>
    group.actions.some(({ perm }) => selected.has(perm)) &&
    !moduleAllSelected(group);

  const toggleModuleAll = (group, checked) => {
    setSelected((prev) => {
      const copy = new Set(prev);
      group.actions.forEach(({ perm }) =>
        checked ? copy.add(perm) : copy.delete(perm)
      );
      return copy;
    });
  };

  const selectAllPermissions = () =>
    setSelected(new Set(allPerms));
  const clearAllPermissions = () => setSelected(new Set());

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
        <h1 className="text-2xl font-bold dark:text-gray-100">{initial ? "Edit Role" : "Create Role"}</h1>
        <div className="text-sm text-gray-600 dark:text-gray-400">
          <span className="hidden sm:inline">Shortcut:&nbsp;</span>
          <span className="border rounded px-1 py-0.5 text-xs dark:border-gray-600 dark:text-gray-400">Alt+S</span>&nbsp;to Save
        </div>
      </div>

      <form ref={formRef} onSubmit={submit} className="space-y-6">
        {/* Role name */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl">
          <div>
            <label className="block text-sm font-medium mb-1 dark:text-gray-300">Role Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700/70 dark:border-slate-600 dark:text-gray-100 dark:placeholder-gray-400"
              placeholder="e.g. Manager"
            />
          </div>
        </div>

        {/* Permissions */}
        <div className="space-y-3">
          <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
            <label className="block text-sm font-medium dark:text-gray-300">Permissions</label>
            <div className="flex flex-wrap gap-2">
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter permissions…"
                className="w-64 border rounded px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700/70 dark:border-slate-600 dark:text-gray-100 dark:placeholder-gray-400"
              />
              <button
                type="button"
                onClick={selectAllPermissions}
                className="text-xs border rounded px-2 py-1 hover:bg-gray-50 dark:border-slate-600 dark:bg-slate-700/70 dark:hover:bg-slate-600 dark:text-gray-300"
                title="Select all (every permission)"
              >
                Select All (All)
              </button>
              <button
                type="button"
                onClick={clearAllPermissions}
                className="text-xs border rounded px-2 py-1 hover:bg-gray-50 dark:border-slate-600 dark:bg-slate-700/70 dark:hover:bg-slate-600 dark:text-gray-300"
                title="Clear all"
              >
                Clear All
              </button>
            </div>
          </div>

          {/* Global select for filtered list */}
          <div className="mb-2 flex items-center gap-3">
            <label className="inline-flex items-center gap-2 dark:text-gray-300">
              <input
                type="checkbox"
                checked={allChecked}
                ref={(el) => {
                  if (el) el.indeterminate = someChecked;
                }}
                onChange={(e) => toggleFiltered(e.target.checked)}
              />
              <span className="text-sm">Select all (filtered)</span>
            </label>
          </div>

          {/* Grouped modules */}
          <div className="space-y-4 max-h-[32rem] overflow-auto pr-1">
            {groupedFiltered.map((group) => (
              <div key={group.module} className="border rounded dark:border-slate-600">
                <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b dark:bg-slate-700/60 dark:border-slate-600">
                  <div className="font-medium dark:text-gray-200">{group.label} Permissions</div>
                  <label className="text-xs inline-flex items-center gap-2 dark:text-gray-300">
                    <input
                      type="checkbox"
                      checked={moduleAllSelected(group)}
                      ref={(el) => {
                        if (el) el.indeterminate = moduleSomeSelected(group);
                      }}
                      onChange={(e) => toggleModuleAll(group, e.target.checked)}
                    />
                    <span>
                      {moduleAllSelected(group) ? "Clear All" : "Select All"}
                    </span>
                  </label>
                </div>

                <div className="px-3 py-2">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                    {group.actions.map(({ action, perm }) => (
                      <label
                        key={perm}
                        className="inline-flex items-center gap-2 border rounded px-2 py-1 dark:border-slate-600 dark:bg-slate-700/70"
                        title={perm}
                      >
                        <input
                          type="checkbox"
                          checked={selected.has(perm)}
                          onChange={(e) => toggle(perm, e.target.checked)}
                        />
                        <span className="text-sm capitalize dark:text-gray-300">
                          {(action || perm).replace(/\./g, " ")}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            ))}

            {groupedFiltered.length === 0 && (
              <div className="text-sm text-gray-500 dark:text-gray-400">
                No permissions match the filter.
              </div>
            )}
          </div>
        </div>

        <div className="pt-2">
          <button
            type="submit"
            aria-keyshortcuts="Alt+S"
            title="Save (Alt+S)"
            className={`px-4 py-2 rounded text-white ${
              submitting ? "bg-blue-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
            }`}
            disabled={submitting}
          >
            {submitting ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}
