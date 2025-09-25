import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { useLicense } from "@/context/LicenseContext.jsx";

export default function ActivateLicense() {
  const nav = useNavigate();
  const { refresh } = useLicense();

  const [key, setKey] = useState("");
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);

  const loadStatus = async () => {
    try {
      const { data } = await axios.get("/api/license/status");
      setStatus(data);
    } catch (e) {
      setStatus({ valid: false, reason: "Unable to fetch status" });
    }
  };

  useEffect(() => { loadStatus(); }, []);

  const onActivate = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      const { data } = await axios.post("/api/license/activate", { license_key: key.trim() });
      if (data?.ok) {
        setMsg("License activated successfully.");
        await refresh();                     // ✅ refresh context so guards allow
        nav("/", { replace: true });         // ✅ go home
        setTimeout(() => window.location.assign("/"), 50); // hard fallback
      } else {
        setErr(data?.reason || "Activation failed");
      }
    } catch (error) {
      const reason = error?.response?.data?.reason || error?.message || "Activation failed";
      setErr(reason);
    } finally {
      setBusy(false);
    }
  };

  const copyMachineId = async () => {
    try {
      await navigator.clipboard.writeText(status?.machine_id || "");
      setMsg("Machine ID copied.");
      setTimeout(() => setMsg(null), 1200);
    } catch {
      setErr("Could not copy. Select and copy manually.");
    }
  };

  const expiresText = (() => {
    const ts = status?.expires_at ?? status?.payload?.exp;
    if (!ts) return null;
    const d = new Date(Number(ts) * 1000);
    return isNaN(d) ? null : d.toLocaleString();
  })();

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-2">Activate License</h1>
      <p className="text-sm text-gray-600 mb-6">Paste the license string below.</p>

      <div className="mb-6 border rounded p-4 bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="font-medium">
            Status: {status?.valid ? <span className="text-green-700">Licensed</span> : <span className="text-red-700">Not Licensed</span>}
          </div>
          {!status?.valid && status?.reason && <div className="text-xs text-gray-500">Reason: {status.reason}</div>}
        </div>

        <div className="mt-3 text-sm">
          <div><span className="font-medium">Machine ID:</span> {status?.machine_id || "—"}</div>
          <button type="button" className="mt-2 px-3 py-1 rounded border text-sm" onClick={copyMachineId} disabled={!status?.machine_id}>
            Copy Machine ID
          </button>
          {expiresText && <div className="mt-3"><span className="font-medium">Expires:</span> {expiresText}</div>}
        </div>

        {status?.payload && status?.valid && (
          <details className="mt-3">
            <summary className="cursor-pointer text-sm text-gray-700">Show license payload</summary>
            <pre className="p-3 text-xs bg-white border rounded mt-2 overflow-x-auto">
{JSON.stringify(status.payload, null, 2)}
            </pre>
          </details>
        )}
      </div>

      <form onSubmit={onActivate}>
        <label className="block text-sm font-medium mb-1">License key</label>
        <textarea
          className="w-full border rounded p-3 h-40"
          placeholder="Paste <signature>.<payload> here"
          value={key}
          onChange={(e) => setKey(e.target.value)}
        />
        <div className="mt-3 flex items-center gap-2">
          <button type="submit" className="px-4 py-2 rounded bg-black text-white disabled:opacity-60" disabled={busy || key.trim().length === 0}>
            {busy ? "Activating…" : "Activate"}
          </button>
          <button type="button" className="px-4 py-2 rounded border" onClick={loadStatus} disabled={busy}>
            Refresh Status
          </button>
          <Link to="/" className="ml-auto text-sm underline">Back to Home</Link>
        </div>
      </form>

      {msg && <div className="mt-4 p-2 rounded bg-green-50 text-green-700 text-sm">{msg}</div>}
      {err && <div className="mt-4 p-2 rounded bg-red-50 text-red-700 text-sm">Error: {err}</div>}
    </div>
  );
}
