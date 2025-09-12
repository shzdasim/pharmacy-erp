// Minimal, reusable glass UI primitives for consistency
export function GlassCard({ className = "", children }) {
  return (
    <div
      className={[
        "rounded-2xl bg-white/60 backdrop-blur-sm ring-1 ring-gray-200/60 shadow-xl",
        "transition-colors",
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}

export function GlassSectionHeader({ title, right = null, className = "" }) {
  return (
    <div
      className={[
        "sticky top-0 z-10 px-4 py-3",
        "bg-white/70 backdrop-blur-sm border-b border-gray-200/60",
        "rounded-t-2xl",
        className,
      ].join(" ")}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold">{title}</h2>
        {right}
      </div>
    </div>
  );
}

export function GlassToolbar({ children, className = "" }) {
  return (
    <div
      className={[
        "flex flex-wrap items-end gap-2",
        "px-4 pb-3 pt-2",
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}

export function GlassInput({ className = "", ...props }) {
  return (
    <input
      {...props}
      className={[
        "h-9 px-3 rounded-xl",
        "bg-white/70 backdrop-blur-sm",
        "border border-gray-200/70 ring-1 ring-transparent focus:ring-blue-400/40",
        "shadow-sm focus:outline-none",
        className,
      ].join(" ")}
    />
  );
}

export function GlassBtn({ className = "", variant = "ghost", ...props }) {
  const base =
    "h-9 px-3 rounded-xl text-sm font-medium transition focus:outline-none " +
    "ring-1 ring-transparent focus:ring-blue-400/40";
  const styles = {
    primary:
      "bg-blue-600 text-white hover:bg-blue-700 shadow",
    ghost:
      "bg-white/70 backdrop-blur-sm border border-gray-200/70 hover:bg-white shadow-sm",
    chip:
      "px-2 bg-white/70 backdrop-blur-sm border border-gray-200/70 hover:bg-white shadow-sm",
  };
  return <button {...props} className={[base, styles[variant], className].join(" ")} />;
}
