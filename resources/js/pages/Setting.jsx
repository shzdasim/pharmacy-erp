import { useEffect, useRef, useState, useMemo } from "react";
import axios from "axios";
import toast from "react-hot-toast";

// FilePond
import { FilePond, registerPlugin } from "react-filepond";
import FilePondPluginImagePreview from "filepond-plugin-image-preview";
import FilePondPluginFileValidateType from "filepond-plugin-file-validate-type";
import "filepond/dist/filepond.min.css";
import "filepond-plugin-image-preview/dist/filepond-plugin-image-preview.css";

import { usePermissions, Guard } from "@/api/usePermissions.js"; // 🔒

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
    return <div className="p-4"><div className="animate-pulse text-gray-500">Loading…</div></div>;
  }
  if (!can.view) {
    return <div className="p-4 text-sm text-gray-700">You don’t have permission to view settings.</div>;
  }
  if (loading) {
    return <div className="p-4"><div className="animate-pulse text-gray-500">Loading settings…</div></div>;
  }

  const disableInputs = !can.update || saving;

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Application Settings</h1>
        <button
          ref={saveBtnRef}
          onClick={handleSave}
          disabled={!can.update || saving}
          className={`px-4 py-2 rounded-lg text-white ${
            (!can.update || saving) ? "bg-gray-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
          }`}
          title={can.update ? "Alt+S" : "You lack update permission"}
        >
          {saving ? "Saving…" : (can.update ? "Save (Alt+S)" : "Save Disabled")}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white rounded-xl shadow p-4">
        {/* Store Name */}
        <div className="flex flex-col">
          <label className="text-sm text-gray-700">Store Name</label>
          <input
            ref={storeNameRef}
            type="text"
            name="store_name"
            value={form.store_name}
            onChange={handleChange}
            disabled={disableInputs}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); phoneRef.current?.focus(); }
            }}
            className="border rounded-lg px-3 py-2 outline-none focus:ring w-full disabled:bg-gray-100"
            placeholder="e.g., My Pharmacy"
          />
        </div>

        {/* Phone */}
        <div className="flex flex-col">
          <label className="text-sm text-gray-700">Phone Number</label>
          <input
            ref={phoneRef}
            type="text"
            name="phone_number"
            value={form.phone_number}
            onChange={handleChange}
            disabled={disableInputs}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); addressRef.current?.focus(); }
            }}
            className="border rounded-lg px-3 py-2 outline-none focus:ring w-full disabled:bg-gray-100"
            placeholder="+92 xx xxxxxxx"
          />
        </div>

        {/* Address */}
        <div className="flex flex-col md:col-span-2">
          <label className="text-sm text-gray-700">Address</label>
          <input
            ref={addressRef}
            type="text"
            name="address"
            value={form.address}
            onChange={handleChange}
            disabled={disableInputs}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); licenseRef.current?.focus(); }
            }}
            className="border rounded-lg px-3 py-2 outline-none focus:ring w-full disabled:bg-gray-100"
            placeholder="Street, City"
          />
        </div>

        {/* Licence Number */}
        <div className="flex flex-col">
          <label className="text-sm text-gray-700">Licence Number</label>
          <input
            ref={licenseRef}
            type="text"
            name="license_number"
            value={form.license_number}
            onChange={handleChange}
            disabled={disableInputs}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); noteRef.current?.focus(); }
            }}
            className="border rounded-lg px-3 py-2 outline-none focus:ring w-full disabled:bg-gray-100"
            placeholder="e.g., ABC-12345"
          />
        </div>

        {/* Printer Type */}
        <div className="flex flex-col">
          <label className="text-sm text-gray-700">Printer</label>
          <div className="flex gap-4 mt-2">
            <label className="inline-flex items-center gap-2 cursor-pointer">
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
              <span>Thermal</span>
            </label>
            <label className="inline-flex items-center gap-2 cursor-pointer">
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
              <span>A4</span>
            </label>
          </div>
        </div>

        {/* Note */}
        <div className="flex flex-col md:col-span-2">
          <label className="text-sm text-gray-700">Invoice Footer Note</label>
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
            className="border rounded-lg px-3 py-2 outline-none focus:ring w-full disabled:bg-gray-100"
            placeholder="This note will be printed at the bottom of the invoice…"
          />
        </div>

        {/* Logo via FilePond */}
        <div className="md:col-span-2">
          <label className="text-sm text-gray-700">Logo</label>
          <div className="mt-2">
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
          </div>
          <p className="text-xs text-gray-500 mt-1">PNG/JPG/WEBP, up to 2 MB.</p>
        </div>
      </div>

      <div className="flex justify-end mt-4">
        <button
          ref={saveBtnRef}
          onClick={handleSave}
          disabled={!can.update || saving}
          className={`px-4 py-2 rounded-lg text-white ${
            (!can.update || saving) ? "bg-gray-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
          }`}
          title={can.update ? "Alt+S" : "You lack update permission"}
        >
          {saving ? "Saving…" : (can.update ? "Save (Alt+S)" : "Save Disabled")}
        </button>
      </div>
    </div>
  );
}
