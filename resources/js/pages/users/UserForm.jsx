import { useEffect, useRef, useState } from "react";

export default function UserForm({ onSubmit, initial, submitting }) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    status: "active",
  });

  const formRef = useRef(null);

  useEffect(() => {
    if (initial) {
      setForm({
        name: initial.name ?? "",
        email: initial.email ?? "",
        password: "",
        status: initial.status ?? "active",
      });
    }
  }, [initial]);

  const set = (k, v) => setForm((s) => ({ ...s, [k]: v }));

  const submit = (e) => {
    e.preventDefault();
    onSubmit(form);
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

  return (
    <div className="p-6">
      {/* Header */}
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

        {/* Status (radio) */}
        <div>
          <span className="block text-sm font-medium mb-1">Status</span>
          <div className="flex items-center gap-6">
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                name="status"
                value="active"
                checked={form.status === "active"}
                onChange={() => set("status", "active")}
                className="h-4 w-4"
              />
              <span>Active</span>
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                name="status"
                value="inactive"
                checked={form.status === "inactive"}
                onChange={() => set("status", "inactive")}
                className="h-4 w-4"
              />
              <span>Inactive</span>
            </label>
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
