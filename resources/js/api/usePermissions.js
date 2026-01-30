import { useCallback, useEffect, useMemo, useState } from "react";
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

  const has = useCallback(
    (ability) => roles.has("Admin") || perms.has(ability),
    [roles, perms]
  );

  const canFor = useCallback(
    (mod) => ({
      view:   has(`${mod}.view`),
      create: has(`${mod}.create`),
      update: has(`${mod}.update`),
      delete: has(`${mod}.delete`),
      export: has(`${mod}.export`),
      import: has(`${mod}.import`),
      restore: has(`${mod}.restore`),
      upload: has(`${mod}.upload`),
    }),
    [has]
  );

  return { loading, roles, perms, has, canFor };
}

export function Guard({ when, children, fallback = null }) {
  return when ? children : fallback;
}
