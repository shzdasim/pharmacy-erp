// resources/js/pages/Setting.jsx
import { useEffect, useRef, useState, useMemo } from "react";
import axios from "axios";
import toast from "react-hot-toast";

// FilePond
import { FilePond, registerPlugin } from "react-filepond";
import FilePondPluginImagePreview from "filepond-plugin-image-preview";
import FilePondPluginFileValidateType from "filepond-plugin-file-validate-type";
import "filepond/dist/filepond.min.css";
import "filepond-plugin-image-preview/dist/filepond-plugin-image-preview.css";

import { usePermissions } from "@/api/usePermissions.js"; // 🔒

// 🧊 glass primitives
import {
  GlassCard,
  GlassSectionHeader,
  GlassToolbar,
  GlassInput,
  GlassBtn,
} from "@/components/glass.jsx";

import {
  ArrowDownOnSquareIcon,
} from "@heroicons/react/24/solid";

registerPlugin(FilePondPluginImagePreview, FilePondPluginFileValidateType);

export default function Setting() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    store_name: "",
    phone_number: "",
    address: "",
    license_number: "",
    note: "",
    printer_type: "thermal",
  });

  // FilePond files (supports remote preload)
  const [files, setFiles] = useState([]);

  // Refs for focus & enter navigation
  const storeNameRef = useRef(null);
  const phoneRef = useRef(null);
  const addressRef = useRef(null);
  const licenseRef = useRef(null);
  const noteRef = useRef(null);
  const thermalRef = useRef(null);
  const saveBtnRef = useRef(null);

  // 🔒 permissions
  const { loading: permsLoading, canFor } = usePermissions();
  const can = useMemo(
    () =>
      (typeof canFor === "function" ? canFor("settings") : {
        view:false, create:false, update:false, delete:false, import:false, export:false
      }),
    [canFor]
  );

  // tints (same palette as ledgers)
  const tintBlue   = "bg-blue-500/85 text-white ring-1 ring-white/20 shadow-[0_6px_20px_-6px_rgba(37,99,235,0.45)] hover:bg-blue-500/95";
  const tintGreen  = "bg-emerald-500/85 text-white ring-1 ring-white/20 shadow-[0_6px_20px_-6px_rgba(16,185,129,0.45)] hover:bg-emerald-500/95";
  const tintSlate  = "bg-slate-900/80 text-white ring-1 ring-white/15 shadow-[0_6px_20px_-6px_rgba(15,23,42,0.45)] hover:bg-slate-900/90";
  const tintGlass  = "bg-white/60 text-slate-700 ring-1 ring-white/30 hover:bg-white/75";

  useEffect(() => {
    if (permsLoading) return;
    if (!can.view) { setLoading(false); return; }
    fetchSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permsLoading, can.view]);

  useEffect(() => {
    if (!loading && can.view) {
      const t = setTimeout(() => storeNameRef.current?.focus(), 120);
      return () => clearTimeout(t);
    }
  }, [loading, can.view]);

  // Alt+S to save (only if can.update)
  useEffect(() => {
    const handleShortcut = (e) => {
      if (e.altKey && (e.key || "").toLowerCase() === "s") {
        e.preventDefault();
        if (can.update) handleSave();
        else toast.error("You don’t have permission to update settings.");
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [form, files, can.update]);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const { data } = await axios.get("/api/settings");
      setForm({
        store_name: data.store_name || "",
        phone_number: data.phone_number || "",
        address: data.address || "",
        license_number: data.license_number || "",
        note: data.note || "",
        printer_type: data.printer_type || "thermal",
      });

      // Preload existing logo into FilePond as remote file
      if (data.logo_url) {
        setFiles([{ source: data.logo_url, options: { type: "remote" } }]);
      } else {
        setFiles([]);
      }
    } catch (err) {
      const status = err?.response?.status;
      if (status === 403) toast.error("You don't have permission to view settings.");
      else toast.error("Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((s) => ({ ...s, [name]: value }));
  };

  const handleSave = async () => {
    if (!can.update) {
      toast.error("You don’t have permission to update settings.");
      return;
    }
    try {
      setSaving(true);
      const fd = new FormData();
      fd.append("store_name", form.store_name || "");
      fd.append("phone_number", form.phone_number || "");
      fd.append("address", form.address || "");
      fd.append("license_number", form.license_number || "");
      fd.append("note", form.note || "");
      fd.append("printer_type", form.printer_type || "a4");

      // If user selected a new file (files[0].file will exist)
      if (files.length > 0 && files[0].file) {
        fd.append("logo", files[0].file);
      }

      const { data } = await axios.post("/api/settings", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      toast.success("✅ Settings saved!");
      // Refresh FilePond with the latest stored logo
      if (data.logo_url) {
        setFiles([{ source: data.logo_url, options: { type: "remote" } }]);
      } else {
        setFiles([]);
      }
    } catch (error) {
      if (error.response?.status === 422) {
        const errors = error.response.data.errors;
        Object.values(errors).forEach((messages) =>
          messages.forEach((msg) => toast.error(msg))
        );
      } else {
        const msg =
          error?.response?.data?.message ||
          error?.response?.data?.error ||
          "❌ Failed to save settings";
        toast.error(msg);
      }
    } finally {
      setSaving(false);
    }
  };

  if (permsLoading) {
    return <div className="p-6"><div className="animate-pulse text-gray-500">Loading…</div></div>;
  }
  if (!can.view) {
    return <div className="p-6 text-sm text-gray-700">You don’t have permission to view settings.</div>;
  }
  if (loading) {
    return <div className="p-6"><div className="animate-pulse text-gray-500">Loading settings…</div></div>;
  }

  const disableInputs = !can.update || saving;

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-5xl mx-auto">
      {/* ===== Header / Save ===== */}
      <GlassCard className="relative z-30">
        <GlassSectionHeader
          title={<span className="inline-flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-600" />
            <span>Application Settings</span>
          </span>}
          right={
            <GlassBtn
              ref={saveBtnRef}
              onClick={handleSave}
              disabled={!can.update || saving}
              className={`h-9 px-4 ${(!can.update || saving) ? tintGlass + " opacity-60 cursor-not-allowed" : tintGreen}`}
              title={can.update ? "Alt+S" : "You lack update permission"}
            >
              <span className="inline-flex items-center gap-2">
                <ArrowDownOnSquareIcon className="w-5 h-5" />
                {saving ? "Saving…" : (can.update ? "Save (Alt+S)" : "Save Disabled")}
              </span>
            </GlassBtn>
          }
        />

        {/* Top toolbar — optional quick info */}
        <GlassToolbar className="justify-between pt-1">
          <div className="text-xs text-gray-600">
            Configure store identity, default printer, and invoice footer.
          </div>
          <div className="text-[11px] text-gray-500">
            Changes apply across invoices and print templates.
          </div>
        </GlassToolbar>
      </GlassCard>

      {/* ===== Identity + Contact ===== */}
      <GlassCard>
        <GlassSectionHeader title="Store Identity & Contact" />
        <GlassToolbar className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Store Name */}
          <div className="w-full">
            <label className="block text-sm text-gray-700 mb-1">Store Name</label>
            <GlassInput
              ref={storeNameRef}
              type="text"
              name="store_name"
              value={form.store_name}
              onChange={handleChange}
              disabled={disableInputs}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); phoneRef.current?.focus(); }
              }}
              placeholder="e.g., My Pharmacy"
              className="w-full"
            />
          </div>

          {/* Phone */}
          <div className="w-full">
            <label className="block text-sm text-gray-700 mb-1">Phone Number</label>
            <GlassInput
              ref={phoneRef}
              type="text"
              name="phone_number"
              value={form.phone_number}
              onChange={handleChange}
              disabled={disableInputs}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); addressRef.current?.focus(); }
              }}
              placeholder="+92 xx xxxxxxx"
              className="w-full"
            />
          </div>

          {/* Address */}
          <div className="md:col-span-2">
            <label className="block text-sm text-gray-700 mb-1">Address</label>
            <GlassInput
              ref={addressRef}
              type="text"
              name="address"
              value={form.address}
              onChange={handleChange}
              disabled={disableInputs}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); licenseRef.current?.focus(); }
              }}
              placeholder="Street, City"
              className="w-full"
            />
          </div>

          {/* Licence Number */}
          <div className="w-full">
            <label className="block text-sm text-gray-700 mb-1">Licence Number</label>
            <GlassInput
              ref={licenseRef}
              type="text"
              name="license_number"
              value={form.license_number}
              onChange={handleChange}
              disabled={disableInputs}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); noteRef.current?.focus(); }
              }}
              placeholder="e.g., ABC-12345"
              className="w-full"
            />
          </div>

          {/* Note */}
          <div className="md:col-span-2">
            <label className="block text-sm text-gray-700 mb-1">Invoice Footer Note</label>
            <textarea
              ref={noteRef}
              name="note"
              value={form.note}
              onChange={handleChange}
              disabled={disableInputs}
              rows={3}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  if (can.update) handleSave();
                }
              }}
              className="w-full h-24 rounded-xl bg-white/70 backdrop-blur-sm border border-gray-200/70 ring-1 ring-transparent focus:ring-blue-400/40 shadow-sm focus:outline-none px-3 py-2"
              placeholder="This note will be printed at the bottom of the invoice…"
            />
          </div>
        </GlassToolbar>
      </GlassCard>

      {/* ===== Printer ===== */}
      <GlassCard>
        <GlassSectionHeader title="Printing Preference" />
        <GlassToolbar className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="col-span-2">
            <div className="text-sm text-gray-700 mb-2">Default Printer</div>
            <div className="flex flex-wrap gap-3">
              <label className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl ring-1 ring-gray-200/70 ${form.printer_type === "thermal" ? "bg-blue-50" : "bg-white/70"}`}>
                <input
                  ref={thermalRef}
                  type="radio"
                  name="printer_type"
                  value="thermal"
                  checked={form.printer_type === "thermal"}
                  onChange={handleChange}
                  disabled={disableInputs}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); saveBtnRef.current?.focus(); }
                  }}
                />
                <span className="text-sm">Thermal</span>
              </label>
              <label className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl ring-1 ring-gray-200/70 ${form.printer_type === "a4" ? "bg-blue-50" : "bg-white/70"}`}>
                <input
                  type="radio"
                  name="printer_type"
                  value="a4"
                  checked={form.printer_type === "a4"}
                  onChange={handleChange}
                  disabled={disableInputs}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); saveBtnRef.current?.focus(); }
                  }}
                />
                <span className="text-sm">A4</span>
              </label>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              This controls the default template used by invoice printing (Alt+P).
            </p>
          </div>
          <div className="flex md:justify-end items-center">
            <GlassBtn
              onClick={handleSave}
              disabled={!can.update || saving}
              className={`h-9 min-w-[140px] ${(!can.update || saving) ? tintGlass + " opacity-60 cursor-not-allowed" : tintSlate}`}
              title={can.update ? "Alt+S" : "You lack update permission"}
            >
              {saving ? "Saving…" : "Save"}
            </GlassBtn>
          </div>
        </GlassToolbar>
      </GlassCard>

      {/* ===== Logo (FilePond) ===== */}
      <GlassCard className="relative z-10">
        <GlassSectionHeader title="Brand Logo" />
        <div className="px-4 pb-4">
          <div className="rounded-2xl bg-white/60 backdrop-blur-sm ring-1 ring-gray-200/60 p-3 shadow-sm">
            <FilePond
              files={files}
              onupdatefiles={(fl) => {
                if (!can.update) { toast.error("No permission to update settings."); return; }
                setFiles(fl);
              }}
              allowMultiple={false}
              acceptedFileTypes={["image/*"]}
              disabled={disableInputs}
              labelIdle='Drag & Drop your logo or <span class="filepond--label-action">Browse</span>'
              credits={false}
            />
            <p className="text-xs text-gray-500 mt-2">PNG/JPG/WEBP, up to 2 MB.</p>
          </div>
        </div>
      </GlassCard>

      {/* ===== Bottom Save ===== */}
      <div className="flex justify-end">
        <GlassBtn
          ref={saveBtnRef}
          onClick={handleSave}
          disabled={!can.update || saving}
          className={`h-10 px-5 ${(!can.update || saving) ? tintGlass + " opacity-60 cursor-not-allowed" : tintGreen}`}
          title={can.update ? "Alt+S" : "You lack update permission"}
        >
          {saving ? "Saving…" : "Save (Alt+S)"}
        </GlassBtn>
      </div>

      {/* subtle helper styles (optional) */}
      <style>{`
        .filepond--panel-root { background: rgba(255,255,255,0.7); backdrop-filter: blur(6px); border: 1px solid rgba(226,232,240,0.7); }
        .filepond--drop-label { color: #334155; }
      `}</style>
    </div>
  );
}
