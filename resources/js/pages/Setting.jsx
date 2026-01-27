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
import { useLicense } from "@/context/LicenseContext.jsx"; // 🔒 license context

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
  ShieldCheckIcon,
  ShieldExclamationIcon,
  ClipboardDocumentIcon,
  KeyIcon,
  LockClosedIcon,
  CogIcon,
  PrinterIcon,
  DocumentTextIcon,
  DocumentIcon,
  ClipboardDocumentListIcon,
  ScaleIcon,
  BoltIcon,
  QrCodeIcon,
  EyeIcon,
} from "@heroicons/react/24/solid";

registerPlugin(FilePondPluginImagePreview, FilePondPluginFileValidateType);

export default function Setting() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const license = useLicense();

  const [form, setForm] = useState({
    store_name: "",
    phone_number: "",
    address: "",
    license_number: "",
    note: "",
    printer_type: "thermal",
    thermal_template: "standard",
  });

  // FilePond files (supports remote preload)
  const [files, setFiles] = useState([]);
  
  // Tab state
  const [activeTab, setActiveTab] = useState("general");
  
  // Thermal template selection
  const [selectedThermalTemplate, setSelectedThermalTemplate] = useState("standard");
  
  // Preview modal state
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewingTemplate, setPreviewingTemplate] = useState(null);

  // Thermal templates data
  const thermalTemplates = [
    { 
      id: 'standard', 
      name: 'Standard', 
      description: 'Classic layout with logo support',
      icon: 'DocumentTextIcon',
      preview: 'Standard thermal layout with store branding'
    },
    { 
      id: 'minimal', 
      name: 'Minimal', 
      description: 'No logo, basic info only',
      icon: 'DocumentIcon',
      preview: 'Compact receipt without logo'
    },
    { 
      id: 'detailed', 
      name: 'Detailed', 
      description: 'Extended customer & payment info',
      icon: 'ClipboardDocumentListIcon',
      preview: 'Complete with customer balance details'
    },
    { 
      id: 'compact', 
      name: 'Compact', 
      description: 'Small fonts, more items per page',
      icon: 'ScaleIcon',
      preview: 'Maximum items on single receipt'
    },
    { 
      id: 'bold', 
      name: 'Bold', 
      description: 'Large fonts, high emphasis',
      icon: 'BoltIcon',
      preview: 'Large fonts with black/white contrast'
    },
    { 
      id: 'barcode', 
      name: 'Barcode', 
      description: 'With product barcodes & QR code',
      icon: 'QrCodeIcon',
      preview: 'Includes barcodes and verification QR'
    },
  ];

  // License management state
  const [licenseStatus, setLicenseStatus] = useState(null);
  const [licenseLoading, setLicenseLoading] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordAction, setPasswordAction] = useState(null); // 'deactivate' or 'view-details'
  const [password, setPassword] = useState("");
  const [verifying, setVerifying] = useState(false);

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
        thermal_template: data.thermal_template || "standard",
      });

      // Set selected thermal template
      if (data.thermal_template) {
        setSelectedThermalTemplate(data.thermal_template);
      }

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
      fd.append("thermal_template", form.thermal_template || "standard");

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

  // License management functions
  const fetchLicenseStatus = async () => {
    try {
      setLicenseLoading(true);
      const { data } = await axios.get("/api/license/status");
      setLicenseStatus(data);
    } catch (err) {
      toast.error("Failed to load license status");
      setLicenseStatus({ valid: false, reason: "Unable to fetch status" });
    } finally {
      setLicenseLoading(false);
    }
  };

  const copyMachineId = async () => {
    try {
      await navigator.clipboard.writeText(licenseStatus?.machine_id || "");
      toast.success("Machine ID copied to clipboard");
    } catch {
      toast.error("Could not copy. Please copy manually.");
    }
  };

  const openPasswordModal = (action) => {
    setPasswordAction(action);
    setPassword("");
    setShowPasswordModal(true);
  };

  const closePasswordModal = () => {
    setShowPasswordModal(false);
    setPasswordAction(null);
    setPassword("");
  };

  const handlePasswordVerify = async (e) => {
    e.preventDefault();
    setVerifying(true);
    try {
      const { data } = await axios.post("/api/verify-password", { password });
      if (data.ok) {
        closePasswordModal();
        if (passwordAction === "deactivate") {
          await deactivateLicense();
        } else if (passwordAction === "view-details") {
          await fetchLicenseStatus();
          toast.success("License details loaded");
        }
      } else {
        toast.error("Invalid password");
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Verification failed");
    } finally {
      setVerifying(false);
    }
  };

  const deactivateLicense = async () => {
    try {
      setLicenseLoading(true);
      await axios.post("/api/license/deactivate");
      toast.success("License deactivated successfully");
      await fetchLicenseStatus();
      license.refresh?.();
    } catch (error) {
      toast.error(error.response?.data?.reason || "Failed to deactivate license");
    } finally {
      setLicenseLoading(false);
    }
  };

  const formatExpiryDate = (expSec) => {
    if (!expSec) return null;
    const d = new Date(Number(expSec) * 1000);
    return isNaN(d) ? null : d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Load license status on mount
  useEffect(() => {
    fetchLicenseStatus();
  }, []);

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

      {/* ===== Tab Navigation ===== */}
      <GlassCard className="!py-0 !px-0 overflow-hidden">
        <div className="flex border-b border-gray-200/60 bg-gray-50/50">
          {/* General Tab */}
          <button
            onClick={() => setActiveTab("general")}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-all duration-200 border-b-2 ${
              activeTab === "general"
                ? "border-blue-600 text-blue-700 bg-white/70"
                : "border-transparent text-gray-600 hover:text-gray-800 hover:bg-white/50"
            }`}
          >
            <CogIcon className="w-5 h-5" />
            <span>General</span>
          </button>
          
          {/* Printer Settings Tab */}
          <button
            onClick={() => setActiveTab("printer")}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-all duration-200 border-b-2 ${
              activeTab === "printer"
                ? "border-blue-600 text-blue-700 bg-white/70"
                : "border-transparent text-gray-600 hover:text-gray-800 hover:bg-white/50"
            }`}
          >
            <PrinterIcon className="w-5 h-5" />
            <span>Printer Settings</span>
          </button>
          
          {/* License Settings Tab */}
          <button
            onClick={() => setActiveTab("license")}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-all duration-200 border-b-2 ${
              activeTab === "license"
                ? "border-blue-600 text-blue-700 bg-white/70"
                : "border-transparent text-gray-600 hover:text-gray-800 hover:bg-white/50"
            }`}
          >
            <DocumentTextIcon className="w-5 h-5" />
            <span>License Settings</span>
          </button>
        </div>
      </GlassCard>

      {/* ===== Tab Content ===== */}
      {activeTab === "general" && (
        <>
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
        </>
      )}

      {/* ===== Printer Settings Tab ===== */}
      {activeTab === "printer" && (
        <>
          {/* ===== Printer Type Selection ===== */}
          <GlassCard>
            <GlassSectionHeader title="Printer Type" />
            <GlassToolbar className="flex flex-wrap gap-4">
              <label className={`inline-flex items-center gap-3 px-4 py-3 rounded-xl ring-1 ring-gray-200/70 cursor-pointer transition-all ${
                form.printer_type === "thermal" ? "bg-blue-50 ring-blue-300" : "bg-white/70 hover:bg-white/90"
              }`}>
                <input
                  type="radio"
                  name="printer_type"
                  value="thermal"
                  checked={form.printer_type === "thermal"}
                  onChange={handleChange}
                  disabled={disableInputs}
                  className="w-4 h-4 text-blue-600"
                />
                <div className="flex items-center gap-2">
                  <PrinterIcon className="w-5 h-5 text-gray-600" />
                  <span className="text-sm font-medium">Thermal Printer</span>
                </div>
              </label>
              
              <label className={`inline-flex items-center gap-3 px-4 py-3 rounded-xl ring-1 ring-gray-200/70 cursor-pointer transition-all ${
                form.printer_type === "a4" ? "bg-blue-50 ring-blue-300" : "bg-white/70 hover:bg-white/90"
              }`}>
                <input
                  type="radio"
                  name="printer_type"
                  value="a4"
                  checked={form.printer_type === "a4"}
                  onChange={handleChange}
                  disabled={disableInputs}
                  className="w-4 h-4 text-blue-600"
                />
                <div className="flex items-center gap-2">
                  <DocumentTextIcon className="w-5 h-5 text-gray-600" />
                  <span className="text-sm font-medium">A4 Printer</span>
                </div>
              </label>
            </GlassToolbar>
            <p className="mt-3 text-xs text-gray-500">
              {form.printer_type === "thermal" 
                ? "Select a thermal receipt template below. Thermal printers use 58mm-80mm width paper."
                : "A4 printer settings will be available in a future update."}
            </p>
          </GlassCard>

          {/* ===== Thermal Template Selection ===== */}
          {form.printer_type === "thermal" && (
            <GlassCard>
              <GlassSectionHeader 
                title="Thermal Receipt Template"
                subtitle="Choose how your receipts will look when printed on thermal printers"
              />
              
              {/* Template Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
                {thermalTemplates.map((template) => {
                  const IconComponent = {
                    DocumentTextIcon,
                    DocumentIcon,
                    ClipboardDocumentListIcon,
                    ScaleIcon,
                    BoltIcon,
                    QrCodeIcon,
                  }[template.icon] || DocumentTextIcon;
                  
                  const isSelected = form.thermal_template === template.id;
                  
                  return (
                    <div
                      key={template.id}
                      className={`relative rounded-xl border-2 transition-all cursor-pointer overflow-hidden group ${
                        isSelected 
                          ? "border-blue-500 ring-2 ring-blue-200" 
                          : "border-gray-200 hover:border-gray-300 hover:shadow-md"
                      }`}
                      onClick={() => {
                        if (can.update) {
                          setForm(s => ({ ...s, thermal_template: template.id }));
                          setSelectedThermalTemplate(template.id);
                        }
                      }}
                    >
                      {/* Selection Indicator */}
                      {isSelected && (
                        <div className="absolute top-2 right-2 z-10">
                          <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        </div>
                      )}
                      
                      {/* Preview Button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewingTemplate(template);
                          setShowPreviewModal(true);
                        }}
                        className="absolute top-2 left-2 z-10 p-1.5 rounded-lg bg-white/90 hover:bg-white shadow-sm opacity-100 transition-opacity"
                        title="Preview template"
                      >
                        <EyeIcon className="w-4 h-4 text-gray-600" />
                      </button>
                      
                      {/* Template Content */}
                      <div className="p-4">
                        {/* Small Thumbnail Preview */}
                        <div className="mb-3 bg-white rounded-lg border border-gray-200 overflow-hidden">
                          <iframe
                            src={`/print/thermal-preview/${template.id}`}
                            className="w-full h-24 border-0"
                            style={{ 
                              transform: 'scale(0.5)',
                              transformOrigin: 'top left',
                              width: '200%',
                              height: '200%'
                            }}
                            title={`${template.name} Thumbnail`}
                          />
                        </div>
                        
                        {/* Icon and Name */}
                        <div className="flex items-start gap-3 mb-3">
                          <div className={`p-2 rounded-lg ${isSelected ? "bg-blue-100" : "bg-gray-100"}`}>
                            <IconComponent className={`w-6 h-6 ${isSelected ? "text-blue-600" : "text-gray-600"}`} />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-semibold text-gray-800">{template.name}</h4>
                            <p className="text-xs text-gray-500 mt-1">{template.description}</p>
                          </div>
                        </div>
                        
                        {/* Preview Info */}
                        <div className="bg-gray-50 rounded-lg p-2 mb-3">
                          <p className="text-xs text-gray-600">{template.preview}</p>
                        </div>
                        
                        {/* Select Button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (can.update) {
                              setForm(s => ({ ...s, thermal_template: template.id }));
                              setSelectedThermalTemplate(template.id);
                            } else {
                              toast.error("You don't have permission to update settings.");
                            }
                          }}
                          disabled={!can.update}
                          className={`w-full py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                            isSelected
                              ? "bg-blue-500 text-white"
                              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                          } ${!can.update && !isSelected ? "opacity-50 cursor-not-allowed" : ""}`}
                        >
                          {isSelected ? "Selected" : "Select Template"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {/* Selected Template Info */}
              <div className="px-4 pb-4">
                <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                    <span className="font-medium text-blue-800">
                      Selected: {thermalTemplates.find(t => t.id === form.thermal_template)?.name} Template
                    </span>
                  </div>
                  <p className="text-sm text-blue-700">
                    This template will be used for all thermal printer sales invoices.
                  </p>
                </div>
              </div>
            </GlassCard>
          )}

          {/* ===== Save Button for Printer Settings ===== */}
          <div className="flex justify-end">
            <GlassBtn
              onClick={handleSave}
              disabled={!can.update || saving}
              className={`h-10 px-6 ${(!can.update || saving) ? tintGlass + " opacity-60 cursor-not-allowed" : tintGreen}`}
              title={can.update ? "Alt+S" : "You lack update permission"}
            >
              {saving ? "Saving…" : "Save Settings"}
            </GlassBtn>
          </div>
        </>
      )}

      {/* ===== License Settings Tab ===== */}
      {activeTab === "license" && (
        <>
      {/* ===== License Management ===== */}
      <GlassCard>
        <GlassSectionHeader
          title={<span className="inline-flex items-center gap-2">
            <KeyIcon className="w-5 h-5 text-amber-600" />
            <span>License Management</span>
          </span>}
          right={
            <div className="flex items-center gap-2">
              <GlassBtn
                onClick={() => openPasswordModal("view-details")}
                className={`h-8 px-3 ${tintBlue}`}
                title="View full license details"
              >
                <span className="inline-flex items-center gap-1 text-xs">
                  <ShieldCheckIcon className="w-4 h-4" />
                  View Details
                </span>
              </GlassBtn>
              {/* Deactivate button removed */}
            </div>
          }
        />
        <GlassToolbar className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* License Status */}
          <div className="flex items-center gap-3 p-4 rounded-xl bg-white/60">
            {licenseLoading ? (
              <div className="animate-pulse text-gray-400">Loading license status...</div>
            ) : licenseStatus?.valid ? (
              <>
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                  <ShieldCheckIcon className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <div className="font-medium text-emerald-700">License Active</div>
                  <div className="text-sm text-gray-600">
                    {formatExpiryDate(licenseStatus.expires_at) || "No expiration date"}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                  <ShieldExclamationIcon className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <div className="font-medium text-red-700">No Active License</div>
                  <div className="text-sm text-gray-600">
                    {licenseStatus?.reason || "License not found or expired"}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Machine ID */}
          <div className="p-4 rounded-xl bg-white/60">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Machine ID</span>
              <button
                onClick={copyMachineId}
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                title="Copy Machine ID"
              >
                <ClipboardDocumentIcon className="w-4 h-4" />
                Copy
              </button>
            </div>
            <div className="text-xs font-mono text-gray-600 bg-gray-50 rounded p-2 break-all">
              {licenseStatus?.machine_id || "Unable to load"}
            </div>
          </div>
        </GlassToolbar>
      </GlassCard>
        </>
      )}

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

      {/* ===== Template Preview Modal ===== */}
      {showPreviewModal && previewingTemplate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100">
                  <EyeIcon className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800">{previewingTemplate.name} Template Preview</h3>
                  <p className="text-sm text-gray-500">{previewingTemplate.description}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowPreviewModal(false);
                  setPreviewingTemplate(null);
                }}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Preview Content - Actual Template Preview */}
            <div className="flex-1 overflow-auto bg-gray-100 p-4">
              <div className="bg-white rounded-lg shadow-lg mx-auto" style={{ 
                maxWidth: previewingTemplate.id === 'minimal' || previewingTemplate.id === 'compact' ? '300px' : '400px',
                minHeight: '400px'
              }}>
                <iframe
                  src={`/print/thermal-preview/${previewingTemplate.id}`}
                  className="w-full h-full border-0"
                  style={{ 
                    minHeight: '400px',
                    width: previewingTemplate.id === 'minimal' || previewingTemplate.id === 'compact' ? '280px' : '380px'
                  }}
                  title={`${previewingTemplate.name} Template Preview`}
                />
              </div>
              
              {/* Template Features */}
              <div className="mt-4 bg-white rounded-lg p-4 mx-auto" style={{ maxWidth: '400px' }}>
                <h4 className="font-medium text-gray-800 mb-3">Template Features</h4>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                    {previewingTemplate.preview}
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                    Optimized for thermal printer width (58mm-80mm)
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                    Print-ready format with proper page sizing
                  </li>
                </ul>
              </div>
            </div>
            
            {/* Footer */}
            <div className="flex justify-between items-center p-4 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => {
                  setShowPreviewModal(false);
                  setPreviewingTemplate(null);
                }}
                className="px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-200 transition-colors"
              >
                Close
              </button>
              <div className="flex gap-2">
                <a
                  href={`/print/thermal-preview/${previewingTemplate.id}`}
                  target="_blank"
                  className="px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-200 transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Open in New Tab
                </a>
                <GlassBtn
                  onClick={() => {
                    if (can.update) {
                      setForm(s => ({ ...s, thermal_template: previewingTemplate.id }));
                      setSelectedThermalTemplate(previewingTemplate.id);
                      setShowPreviewModal(false);
                      setPreviewingTemplate(null);
                      toast.success(`Selected ${previewingTemplate.name} template`);
                    } else {
                      toast.error("You don't have permission to update settings.");
                    }
                  }}
                  disabled={!can.update}
                  className={`h-9 px-4 ${tintBlue}`}
                >
                  {form.thermal_template === previewingTemplate.id 
                    ? "Already Selected" 
                    : `Select ${previewingTemplate.name}`
                  }
                </GlassBtn>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== Password Verification Modal ===== */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                <LockClosedIcon className="w-5 h-5 text-slate-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-800">
                  {passwordAction === "deactivate" ? "Deactivate License" : "View License Details"}
                </h3>
                <p className="text-sm text-gray-500">Enter your password to continue</p>
              </div>
            </div>
            <form onSubmit={handlePasswordVerify}>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                autoFocus
              />
              <div className="flex justify-end gap-2 mt-4">
                <button
                  type="button"
                  onClick={closePasswordModal}
                  className="px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
                  disabled={verifying}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={verifying || !password}
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {verifying ? "Verifying..." : "Verify"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* subtle helper styles (optional) */}
      <style>{`
        .filepond--panel-root { background: rgba(255,255,255,0.7); backdrop-filter: blur(6px); border: 1px solid rgba(226,232,240,0.7); }
        .filepond--drop-label { color: #334155; }
      `}</style>
    </div>
  );
}
