// src/pages/roles/RoleForm.jsx
import { useEffect, useRef, useState } from "react";
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

  const filteredList = (filter || "").trim()
    ? allPerms.filter((p) => p.toLowerCase().includes(filter.toLowerCase()))
    : allPerms;

  const allChecked =
    filteredList.length > 0 && filteredList.every((p) => selected.has(p));
  const someChecked =
    filteredList.some((p) => selected.has(p)) && !allChecked;

  const toggleFiltered = (checked) => {
    setSelected((prev) => {
      const copy = new Set(prev);
      filteredList.forEach((p) => (checked ? copy.add(p) : copy.delete(p)));
      return copy;
    });
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">{initial ? "Edit Role" : "Create Role"}</h1>
        <div className="text-sm text-gray-600">
          <span className="hidden sm:inline">Shortcut:&nbsp;</span>
          <span className="border rounded px-1 py-0.5 text-xs">Alt+S</span>&nbsp;to Save
        </div>
      </div>

      <form ref={formRef} onSubmit={submit} className="space-y-5 max-w-4xl">
        <div>
          <label className="block text-sm font-medium mb-1">Role Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g. Manager"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium">Permissions</label>
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter permissions…"
              className="w-64 border rounded px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="mb-2 flex items-center gap-3">
            <label className="inline-flex items-center gap-2">
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

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2 max-h-[420px] overflow-auto border rounded p-3">
            {filteredList.map((p) => (
              <label key={p} className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selected.has(p)}
                  onChange={(e) => toggle(p, e.target.checked)}
                />
                <span className="text-sm">{p}</span>
              </label>
            ))}
            {filteredList.length === 0 && (
              <div className="text-sm text-gray-500">No permissions match the filter.</div>
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
