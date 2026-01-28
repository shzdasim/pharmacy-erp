// Minimal, reusable glass UI primitives for consistency
export function GlassCard({ className = "", children }) {
  return (
    <div className={["g-card", className].join(" ")}>
      {children}
    </div>
  );
}

export function GlassSectionHeader({ title, right = null, className = "" }) {
  return (
    <div className={["g-section-header", className].join(" ")}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold">{title}</h2>
        {right}
      </div>
    </div>
  );
}

export function GlassToolbar({ children, className = "" }) {
  return <div className={["g-toolbar", className].join(" ")}>{children}</div>;
}

export function GlassInput({ className = "", ...props }) {
  return <input {...props} className={["g-input", className].join(" ")} />;
}

export function GlassBtn({ className = "", variant = "ghost", ...props }) {
  const byVariant = {
    primary: "g-btn-primary",
    ghost: "g-btn-ghost",
    chip: "g-btn-chip",
  }[variant] || "g-btn-ghost";

  return <button {...props} className={[byVariant, className].join(" ")} />;
}
