import { useEffect, useMemo, useState } from "react";
import axios from "axios";

export function usePermissions() {
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState(new Set());
  const [perms, setPerms] = useState(new Set());

  useEffect(() => {
    (async () => {
      try {
        const { data } = await axios.get("/api/me");
        setRoles(new Set((data?.roles || []).filter(Boolean)));
        setPerms(new Set((data?.permissions || []).filter(Boolean)));
      } catch {
        setRoles(new Set());
        setPerms(new Set());
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const has = (p) => roles.has("Admin") || perms.has(p);

  const can = useMemo(() => ({
    // Category module abilities
    view:   has("category.view"),
    create: has("category.create"),
    update: has("category.update"),
    delete: has("category.delete"),
    export: has("category.export"),
    import: has("category.import"),
  }), [roles, perms]);

  return { loading, roles, perms, has, can };
}

export function Guard({ when, fallback = null, children }) {
  return when ? children : fallback;
}
