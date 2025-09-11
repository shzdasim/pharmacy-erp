// src/pages/users/UserForm.jsx
import { useEffect, useRef, useState } from "react";
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

  // load available roles + permissions
  useEffect(() => {
    (async () => {
      const [r, p] = await Promise.all([
        axios.get("/api/roles", { params: { per_page: 1000 } }),
        axios.get("/api/permissions"),
      ]);

      // roles: /api/roles returns {data:[{id,name},...], meta:{...}}
      const roleNames = (Array.isArray(r?.data?.data) ? r.data.data : asArray(r?.data))
        .map((x) => (typeof x === "string" ? x : x?.name))
        .filter(Boolean);

      // permissions: /api/permissions returns ["perm.a","perm.b",...] or [{name:"perm"}]
      const permNames = (Array.isArray(p?.data?.data) ? p.data.data : asArray(p?.data))
        .map((x) => (typeof x === "string" ? x : x?.name))
        .filter(Boolean);

      setRoleOptions([...new Set(roleNames)].sort());
      setPermissionOptions([...new Set(permNames)].sort());
    })();
  }, []);

  // apply initial user when editing
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

  // Alt+S shortcut
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

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between mb-4">
        <h1 className="text-2xl font-bold">{initial ? "Edit User" : "Create User"}</h1>
        <div className="text-sm text-gray-600">
          <span className="hidden sm:inline">Shortcut:&nbsp;</span>
          <span className="border rounded px-1 py-0.5 text-xs">Alt+S</span>&nbsp;to Save
        </div>
      </div>

      <form ref={formRef} onSubmit={submit} className="space-y-4 max-w-2xl">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium mb-1">Name</label>
          <input
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            required
            className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Full name"
          />
        </div>

        {/* Email */}
        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            required
            className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="user@example.com"
          />
        </div>

        {/* Password */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Password{" "}
            {initial ? (
              <span className="text-xs text-gray-500">(leave blank to keep)</span>
            ) : null}
          </label>
          <input
            type="password"
            value={form.password}
            onChange={(e) => set("password", e.target.value)}
            placeholder={initial ? "••••••" : "Set a password"}
            className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Status */}
        <div>
          <span className="block text-sm font-medium mb-1">Status</span>
          <div className="flex items-center gap-6">
            {["active", "inactive"].map((s) => (
              <label key={s} className="inline-flex items-center gap-2">
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
          <label className="block text-sm font-medium mb-1">Roles</label>
          <div className="flex flex-wrap gap-3">
            {roleOptions.map((r) => (
              <label
                key={r}
                className="inline-flex items-center gap-2 border px-2 py-1 rounded"
              >
                <input
                  type="checkbox"
                  checked={form.roles.includes(r)}
                  onChange={() => toggleStrInArray("roles", r)}
                />
                <span>{r}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Direct Permissions */}
        <div>
          <label className="block text-sm font-medium mb-1">Direct Permissions</label>
          <div className="flex flex-wrap gap-3 max-h-64 overflow-auto border rounded p-2">
            {permissionOptions.map((p) => (
              <label key={p} className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.permissions.includes(p)}
                  onChange={() => toggleStrInArray("permissions", p)}
                />
                <span>{p}</span>
              </label>
            ))}
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
