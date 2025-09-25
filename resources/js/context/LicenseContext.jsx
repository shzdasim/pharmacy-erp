import { createContext, useContext, useEffect, useMemo, useState } from "react";
import axios from "axios";

const LicenseCtx = createContext(null);

export function LicenseProvider({ children }) {
  const [status, setStatus] = useState({
    loading: true,
    valid: false,
    expiresAt: null,      // ms epoch
    payload: null,
    machineId: null,
    reason: null,
  });

  const refresh = async () => {
    try {
      const { data } = await axios.get("/api/license/status");
      // server returns expires_at as seconds (from payload['exp'])
      const expSec = data?.expires_at ?? data?.payload?.exp ?? null;
      const expMs =
        typeof expSec === "number" ? expSec * 1000 :
        typeof expSec === "string" ? Date.parse(expSec) : null;

      setStatus({
        loading: false,
        valid: !!data?.valid,
        expiresAt: expMs,
        payload: data?.payload ?? null,
        machineId: data?.machine_id ?? null,
        reason: data?.reason ?? null,
      });
    } catch {
      setStatus((s) => ({ ...s, loading: false, valid: false }));
    }
  };

  useEffect(() => { refresh(); }, []);

  // tick once per second to update remaining time
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remainingMs = useMemo(() => {
    if (!status.expiresAt) return null;
    return Math.max(0, status.expiresAt - now);
  }, [status.expiresAt, now]);

  // When it hits zero, soft-redirect to /activate (server will also 402)
  useEffect(() => {
    if (status.valid && status.expiresAt && remainingMs === 0) {
      window.location.assign("/activate");
    }
  }, [status.valid, status.expiresAt, remainingMs]);

  return (
    <LicenseCtx.Provider value={{ ...status, remainingMs, refresh }}>
      {children}
    </LicenseCtx.Provider>
  );
}

export function useLicense() {
  return useContext(LicenseCtx) ?? { loading: true, valid: false };
}
