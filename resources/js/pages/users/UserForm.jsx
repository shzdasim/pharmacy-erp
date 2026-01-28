// src/pages/users/UserForm.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";

export default function UserForm({ onSubmit, initial, submitting }) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    status: "active",
    roles: [],
    permissions: [],
  });

  const [roleOptions, setRoleOptions] = useState([]);
  const [permissionOptions, setPermissionOptions] = useState([]);
  const formRef = useRef(null);

  // helpers
  const norm = (s) => (s == null ? "" : String(s).trim());
  const asArray = (x) =>
    Array.isArray(x) ? x : x && typeof x === "object" ? Object.values(x) : [];

  // ---- Load roles + permissions
  useEffect(() => {
    (async () => {
      const [r, p] = await Promise.all([
        axios.get("/api/roles", { params: { per_page: 1000 } }),
        axios.get("/api/permissions"),
      ]);

      const roleNames = (Array.isArray(r?.data?.data) ? r.data.data : asArray(r?.data))
        .map((x) => (typeof x === "string" ? x : x?.name))
        .filter(Boolean);

      const permNames = (Array.isArray(p?.data?.data) ? p.data.data : asArray(p?.data))
        .map((x) => (typeof x === "string" ? x : x?.name))
        .filter(Boolean);

      setRoleOptions([...new Set(roleNames)].sort());
      setPermissionOptions([...new Set(permNames)]);
    })();
  }, []);

  // ---- Apply initial (edit mode)
  useEffect(() => {
    if (initial) {
      setForm({
        name: norm(initial.name),
        email: norm(initial.email),
        password: "",
        status: norm(initial.status || "active"),
        roles: asArray(initial.roles)
          .map((r) => (typeof r === "string" ? r : r?.name))
          .filter(Boolean),
        permissions: asArray(initial.permissions)
          .map((p) => (typeof p === "string" ? p : p?.name))
          .filter(Boolean),
      });
    }
  }, [initial]);

  const set = (k, v) => setForm((s) => ({ ...s, [k]: v }));

  const submit = (e) => {
    e.preventDefault();
    onSubmit({
      ...form,
      name: norm(form.name),
      email: norm(form.email),
      status: norm(form.status || "active"),
      roles: Array.from(new Set(form.roles)),
      permissions: Array.from(new Set(form.permissions)),
    });
  };

  // Alt+S
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

  const toggleStrInArray = (key, value) => {
    setForm((s) => {
      const setVals = new Set(s[key]);
      setVals.has(value) ? setVals.delete(value) : setVals.add(value);
      return { ...s, [key]: Array.from(setVals) };
    });
  };

  // ===== Permission grouping & ordering =====
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
    // friendly headings
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
    // Fallback: Title Case + hyphen to space
    return m
      .split("-")
      .map((x) => x.charAt(0).toUpperCase() + x.slice(1))
      .join(" ");
  };

  // Build: { moduleKey: { label, actions: [{action, perm}] } }
  const groupedPerms = useMemo(() => {
    const groups = {};
    for (const full of permissionOptions) {
      // expected "module.action" format, but keep custom singles too
      if (typeof full !== "string" || !full) continue;
      const parts = full.split(".");
      const module = parts.length > 1 ? parts[0] : full; // "user.manage" => module "user"
      const action = parts.length > 1 ? parts.slice(1).join(".") : ""; // manage / assign.roles etc.

      const key = module;
      if (!groups[key]) {
        groups[key] = { label: titleizeModule(key), map: new Map() };
      }
      groups[key].map.set(action || full, full); // action->perm
    }

    // Convert map to ordered arrays
    const out = [];
    Object.keys(groups)
      .sort((a, b) => groups[a].label.localeCompare(groups[b].label))
      .forEach((k) => {
        const availableActions = Array.from(groups[k].map.keys());
        const ordered = [
          // first those in ACTION_ORDER
          ...ACTION_ORDER.filter((a) => availableActions.includes(a)),
          // then any extra/custom actions
          ...availableActions.filter((a) => !ACTION_ORDER.includes(a)),
        ];
        out.push({
          module: k,
          label: groups[k].label,
          actions: ordered.map((a) => ({ action: a, perm: groups[k].map.get(a) })),
        });
      });
    return out;
  }, [permissionOptions]);

  const moduleAllSelected = (moduleKey) => {
    const gp = groupedPerms.find((g) => g.module === moduleKey);
    if (!gp) return false;
    return gp.actions.every((a) => form.permissions.includes(a.perm));
  };

  const toggleModuleAll = (moduleKey, checked) => {
    setForm((s) => {
      const gp = groupedPerms.find((g) => g.module === moduleKey);
      if (!gp) return s;
      const current = new Set(s.permissions);
      if (checked) {
        gp.actions.forEach((a) => current.add(a.perm));
      } else {
        gp.actions.forEach((a) => current.delete(a.perm));
      }
      return { ...s, permissions: Array.from(current) };
    });
  };

  const selectAllPermissions = () =>
    setForm((s) => ({ ...s, permissions: Array.from(new Set(permissionOptions)) }));
  const clearAllPermissions = () => setForm((s) => ({ ...s, permissions: [] }));

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between mb-4">
        <h1 className="text-2xl font-bold dark:text-gray-100">{initial ? "Edit User" : "Create User"}</h1>
        <div className="text-sm text-gray-600 dark:text-gray-400">
          <span className="hidden sm:inline">Shortcut:&nbsp;</span>
          <span className="border rounded px-1 py-0.5 text-xs dark:border-gray-600 dark:text-gray-400">Alt+S</span>&nbsp;to Save
        </div>
      </div>

      <form ref={formRef} onSubmit={submit} className="space-y-6">
        {/* Top row: Name, Email, Password */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium mb-1 dark:text-gray-300">Name</label>
            <input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              required
              className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700/70 dark:border-slate-600 dark:text-gray-100 dark:placeholder-gray-400"
              placeholder="Full name"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium mb-1 dark:text-gray-300">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              required
              className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700/70 dark:border-slate-600 dark:text-gray-100 dark:placeholder-gray-400"
              placeholder="user@example.com"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium mb-1 dark:text-gray-300">
              Password{" "}
              {initial ? (
                <span className="text-xs text-gray-500 dark:text-gray-400">(leave blank to keep)</span>
              ) : null}
            </label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
              placeholder={initial ? "••••••" : "Set a password"}
              className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700/70 dark:border-slate-600 dark:text-gray-100 dark:placeholder-gray-400"
            />
          </div>
        </div>

        {/* Status */}
        <div>
          <span className="block text-sm font-medium mb-1 dark:text-gray-300">Status</span>
          <div className="flex items-center gap-6">
            {["active", "inactive"].map((s) => (
              <label key={s} className="inline-flex items-center gap-2 dark:text-gray-300">
                <input
                  type="radio"
                  name="status"
                  value={s}
                  checked={form.status === s}
                  onChange={() => set("status", s)}
                  className="h-4 w-4"
                />
                <span className="capitalize">{s}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Roles */}
        <div>
          <label className="block text-sm font-medium mb-1 dark:text-gray-300">Roles</label>
          <div className="flex flex-wrap gap-3">
            {roleOptions.map((r) => (
              <label
                key={r}
                className="inline-flex items-center gap-2 border px-2 py-1 rounded dark:border-slate-600 dark:bg-slate-700/70"
              >
                <input
                  type="checkbox"
                  checked={form.roles.includes(r)}
                  onChange={() => toggleStrInArray("roles", r)}
                />
                <span className="dark:text-gray-300">{r}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Direct Permissions (Grouped) */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium dark:text-gray-300">Direct Permissions</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={selectAllPermissions}
                className="text-xs border rounded px-2 py-1 hover:bg-gray-50 dark:border-slate-600 dark:bg-slate-700/70 dark:hover:bg-slate-600 dark:text-gray-300"
                title="Select all permissions"
              >
                Select All
              </button>
              <button
                type="button"
                onClick={clearAllPermissions}
                className="text-xs border rounded px-2 py-1 hover:bg-gray-50 dark:border-slate-600 dark:bg-slate-700/70 dark:hover:bg-slate-600 dark:text-gray-300"
                title="Clear all permissions"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="space-y-4 max-h-[32rem] overflow-auto pr-1">
            {groupedPerms.map((group) => (
              <div key={group.module} className="border rounded dark:border-slate-600">
                <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b dark:bg-slate-700/60 dark:border-slate-600">
                  <div className="font-medium dark:text-gray-200">{group.label} Permissions</div>
                  <label className="text-xs inline-flex items-center gap-2 dark:text-gray-300">
                    <input
                      type="checkbox"
                      checked={moduleAllSelected(group.module)}
                      onChange={(e) => toggleModuleAll(group.module, e.target.checked)}
                    />
                    <span>{moduleAllSelected(group.module) ? "Clear All" : "Select All"}</span>
                  </label>
                </div>

                {/* Actions row, consistently ordered */}
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
                          checked={form.permissions.includes(perm)}
                          onChange={() => toggleStrInArray("permissions", perm)}
                        />
                        <span className="capitalize dark:text-gray-300">
                          {action
                            ? action.replace(/\./g, " ") // e.g., sync.permissions
                            : perm}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            ))}

            {/* Fallback when there are no permissions (still loading or empty) */}
            {groupedPerms.length === 0 && (
              <div className="text-sm text-gray-500 dark:text-gray-400">No permissions found.</div>
            )}
          </div>
        </div>

        {/* Actions */}
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
