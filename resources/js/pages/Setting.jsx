// resources/js/pages/Setting.jsx
import { useEffect, useRef, useState, useMemo } from "react";
import axios from "axios";
import toast from "react-hot-toast";

// FilePond
import { FilePond, registerPlugin } from "react-filepond";
import FilePondPluginImagePreview from "filepond-plugin-image-preview";
import FilePondPluginFileValidateType from "filepond-plugin-file-validate-type";
import "filepond-plugin-file-validate-size";
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
  CloudArrowDownIcon,
  CloudArrowUpIcon,
  TrashIcon,
  ArrowPathIcon,
  ServerIcon,
  FolderIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
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

  // Backup management state
  const [backups, setBackups] = useState([]);
  const [backupStats, setBackupStats] = useState(null);
  const [backupsLoading, setBackupsLoading] = useState(false);
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [selectedBackupType, setSelectedBackupType] = useState("full");
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [backupToRestore, setBackupToRestore] = useState(null);
  const [restorePassword, setRestorePassword] = useState("");
  const [restoring, setRestoring] = useState(false);
  const [deletingBackupId, setDeletingBackupId] = useState(null);

  // Upload backup state
  const [uploadFiles, setUploadFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadedBackup, setUploadedBackup] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadValidationError, setUploadValidationError] = useState(null);

  // Update management state
  const [updateStatus, setUpdateStatus] = useState({
    current_version: null,
    latest_version: null,
    is_new_version: false,
    release_info: null,
    last_checked_at: null,
    repository: {
      owner: 'shzdasim',
      repo: 'pharmacy-erp',
      branch: 'Sale-Invoice',
      url: 'https://github.com/shzdasim/pharmacy-erp',
    },
  });
  const [updateSettings, setUpdateSettings] = useState({
    auto_check_enabled: false,
    require_confirmation: true,
  });
  const [updateLogs, setUpdateLogs] = useState([]);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [installingUpdate, setInstallingUpdate] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Backup types
  const backupTypes = [
    { id: 'full', name: 'Full Backup', description: 'Complete backup including database, settings, and files', icon: ServerIcon },
    { id: 'database', name: 'Database Only', description: 'Database tables and data only', icon: FolderIcon },
    { id: 'settings', name: 'Settings Only', description: 'Application settings and configuration', icon: CogIcon },
  ];

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

  // ========== BACKUP MANAGEMENT FUNCTIONS ==========

  // Fetch backups list
  const fetchBackups = async () => {
    try {
      setBackupsLoading(true);
      const { data } = await axios.get("/api/backups");
      setBackups(data.backups || []);
    } catch (err) {
      if (err.response?.status !== 403) {
        toast.error("Failed to load backups");
      }
    } finally {
      setBackupsLoading(false);
    }
  };

  // Fetch backup statistics
  const fetchBackupStats = async () => {
    try {
      const { data } = await axios.get("/api/backups/stats");
      setBackupStats(data);
    } catch (err) {
      // Silently fail - stats are optional
    }
  };

  // Create new backup
  const handleCreateBackup = async () => {
    if (!canFor?.("backup")?.create) {
      toast.error("You don't have permission to create backups.");
      return;
    }

    try {
      setCreatingBackup(true);
      const { data } = await axios.post("/api/backups", {
        type: selectedBackupType,
      });
      toast.success("Backup created successfully!");
      await fetchBackups();
      await fetchBackupStats();
    } catch (error) {
      const msg = error.response?.data?.message || error.response?.data?.error || "Failed to create backup";
      toast.error(msg);
    } finally {
      setCreatingBackup(false);
    }
  };

  // Download backup
  const handleDownloadBackup = async (backup) => {
    if (!canFor?.("backup")?.view) {
      toast.error("You don't have permission to view backups.");
      return;
    }

    try {
      const response = await axios.get(`/api/backups/${backup.id}/download`, {
        responseType: 'blob',
      });

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const filename = `${backup.filename}.${backup.type === 'full' ? 'zip' : 'sql.gz'}`;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success("Backup download started");
    } catch (error) {
      toast.error("Failed to download backup");
    }
  };

  // Open restore modal
  const openRestoreModal = (backup) => {
    setBackupToRestore(backup);
    setRestorePassword("");
    setShowRestoreModal(true);
  };

  // Close restore modal
  const closeRestoreModal = () => {
    setShowRestoreModal(false);
    setBackupToRestore(null);
    setRestorePassword("");
  };

  // Restore from backup
  const handleRestoreBackup = async (e) => {
    e.preventDefault();

    if (!backupToRestore) return;

    try {
      setRestoring(true);
      await axios.post(`/api/backups/${backupToRestore.id}/restore`, {
        password: restorePassword,
      });
      toast.success("Backup restored successfully! Please refresh the page.");
      closeRestoreModal();
      // Refresh backup list and stats
      await fetchBackups();
      await fetchBackupStats();
    } catch (error) {
      const msg = error.response?.data?.message || error.response?.data?.error || "Restore failed. Check your password.";
      toast.error(msg);
    } finally {
      setRestoring(false);
    }
  };

  // Delete backup
  const handleDeleteBackup = async (backup) => {
    if (!canFor?.("backup")?.delete) {
      toast.error("You don't have permission to delete backups.");
      return;
    }

    if (!confirm(`Are you sure you want to delete "${backup.filename}"? This action cannot be undone.`)) {
      return;
    }

    try {
      setDeletingBackupId(backup.id);
      await axios.delete(`/api/backups/${backup.id}`);
      toast.success("Backup deleted successfully");
      await fetchBackups();
      await fetchBackupStats();
    } catch (error) {
      const msg = error.response?.data?.message || "Failed to delete backup";
      toast.error(msg);
    } finally {
      setDeletingBackupId(null);
    }
  };

  // ========== UPLOAD BACKUP FUNCTIONS ==========

  // Upload backup file
  const handleUploadBackup = async () => {
    if (!canFor?.("backup")?.upload) {
      toast.error("You don't have permission to upload backups.");
      return;
    }

    if (uploadFiles.length === 0 || !uploadFiles[0].file) {
      toast.error("Please select a backup file to upload.");
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', uploadFiles[0].file);

      const { data } = await axios.post('/api/backups/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      toast.success("Backup uploaded successfully!");
      setUploadedBackup(data.backup);
      
      // Refresh backup list
      await fetchBackups();
      await fetchBackupStats();
      
      // Clear upload files but keep the uploaded backup info for restore
      setUploadFiles([]);
      
      // Open the restore modal for the uploaded file
      setShowUploadModal(false);
      openRestoreModal(data.backup);
      
    } catch (error) {
      // Show detailed error message
      const errors = error.response?.data?.errors;
      const msg = error.response?.data?.message || error.response?.data?.error || "Failed to upload backup";
      
      if (errors && Array.isArray(errors) && errors.length > 0) {
        // Show all validation errors
        errors.forEach((err) => toast.error(err));
      } else {
        toast.error(msg);
      }
    } finally {
      setUploading(false);
    }
  };

  // Handle FilePond upload initialization
  const handleUploadInit = () => {
    // Reset state when FilePond is initialized
    setUploadValidationError(null);
  };

  // Clear uploaded backup and reset
  const clearUploadedBackup = () => {
    setUploadedBackup(null);
    setUploadFiles([]);
  };

  // Get status icon for backup
  const getBackupStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircleIcon className="w-5 h-5 text-emerald-500" />;
      case 'failed':
        return <XCircleIcon className="w-5 h-5 text-red-500" />;
      case 'restored':
        return <CheckCircleIcon className="w-5 h-5 text-blue-500" />;
      default:
        return <ArrowPathIcon className="w-5 h-5 text-amber-500 animate-spin" />;
    }
  };

  // ========== UPDATE MANAGEMENT FUNCTIONS ==========

  // Fetch update status
  const fetchUpdateStatus = async () => {
    try {
      const { data } = await axios.get('/api/updates/status');
      if (data.success && data.data) {
        setUpdateStatus(prev => ({
          ...prev,
          current_version: data.data.current_version || prev.current_version,
          latest_version: data.data.latest_check?.latest_version || prev.latest_version,
          is_new_version: data.data.latest_check?.is_new_version || false,
          release_info: data.data.latest_check?.release_info || prev.release_info,
          last_checked_at: data.data.latest_check?.checked_at || prev.last_checked_at,
          repository: data.data.repository || prev.repository,
        }));
        setUpdateSettings(data.data.settings || updateSettings);
      }
    } catch (err) {
      console.error('Failed to fetch update status:', err);
    }
  };

  // Fetch update logs
  const fetchUpdateLogs = async () => {
    try {
      setLoadingLogs(true);
      const { data } = await axios.get('/api/updates/logs', {
        params: { limit: 50 }
      });
      if (data.success && data.data) {
        setUpdateLogs(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch update logs:', err);
    } finally {
      setLoadingLogs(false);
    }
  };

  // Check for updates manually
  const handleCheckUpdate = async () => {
    try {
      setCheckingUpdate(true);
      const { data } = await axios.get('/api/updates/check');
      
      if (data.success) {
        setUpdateStatus(prev => ({
          ...prev,
          current_version: data.current_version || prev.current_version,
          latest_version: data.latest_version || prev.latest_version,
          is_new_version: data.is_new_version || false,
          release_info: data.release_info || prev.release_info,
          last_checked_at: data.checked_at || new Date().toISOString(),
        }));
        
        if (data.is_new_version) {
          toast.success(`New version available: ${data.latest_version}`);
        } else {
          toast.success('You are running the latest version');
        }
        
        // Refresh logs after check
        await fetchUpdateLogs();
      } else {
        toast.error(data.error || 'Failed to check for updates');
      }
    } catch (error) {
      const msg = error.response?.data?.error || 'Failed to check for updates';
      toast.error(msg);
    } finally {
      setCheckingUpdate(false);
    }
  };

  // Install update
  const handleInstallUpdate = async () => {
    // Require confirmation if setting is enabled
    if (updateSettings.require_confirmation) {
      if (!confirm(`Are you sure you want to update from version ${updateStatus.current_version} to ${updateStatus.latest_version}? This will download and apply the latest update from GitHub.`)) {
        return;
      }
    }

    try {
      setInstallingUpdate(true);
      const { data } = await axios.post('/api/updates/install');
      
      if (data.success) {
        toast.success(data.message || 'Update installed successfully!');
        // Refresh status and logs
        await fetchUpdateStatus();
        await fetchUpdateLogs();
        
        // Show reload message
        setTimeout(() => {
          toast.success('Please refresh the page to see the new version.');
        }, 1000);
      } else {
        toast.error(data.error || 'Failed to install update');
      }
    } catch (error) {
      const msg = error.response?.data?.error || 'Failed to install update';
      toast.error(msg);
    } finally {
      setInstallingUpdate(false);
    }
  };

  // Update settings
  const handleUpdateSettingsChange = async (key, value) => {
    try {
      const newSettings = { ...updateSettings, [key]: value };
      setUpdateSettings(newSettings);
      
      await axios.put('/api/updates/settings', newSettings);
      toast.success('Update settings saved');
    } catch (error) {
      toast.error('Failed to save update settings');
      // Revert state on failure
      setUpdateSettings(updateSettings);
    }
  };

  // Load backup data when switching to backup tab
  useEffect(() => {
    if (activeTab === "backup") {
      fetchBackups();
      fetchBackupStats();
    }
  }, [activeTab]);

  // Load update data when switching to update tab
  useEffect(() => {
    if (activeTab === "update") {
      fetchUpdateStatus();
      fetchUpdateLogs();
    }
  }, [activeTab]);

  // Load license status on mount
  useEffect(() => {
    fetchLicenseStatus();
  }, []);

  if (permsLoading) {
    return <div className="p-6"><div className="animate-pulse text-gray-500 dark:text-gray-400">Loading…</div></div>;
  }
  if (!can.view) {
    return <div className="p-6 text-sm text-gray-700 dark:text-gray-300">You don’t have permission to view settings.</div>;
  }
  if (loading) {
    return <div className="p-6"><div className="animate-pulse text-gray-500 dark:text-gray-400">Loading settings…</div></div>;
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
          <div className="text-xs text-gray-600 dark:text-gray-400">
            Configure store identity, default printer, and invoice footer.
          </div>
          <div className="text-[11px] text-gray-500 dark:text-gray-400">
            Changes apply across invoices and print templates.
          </div>
        </GlassToolbar>
      </GlassCard>

      {/* ===== Tab Navigation ===== */}
      <GlassCard className="!py-0 !px-0 overflow-hidden">
        <div className="flex border-b border-gray-200/60 bg-gray-50/50 dark:bg-slate-800/40 dark:border-slate-700/60">
          {/* General Tab */}
          <button
            onClick={() => setActiveTab("general")}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-all duration-200 border-b-2 ${
              activeTab === "general"
                ? "border-blue-600 text-blue-700 bg-white/70 dark:bg-slate-800/70 dark:text-blue-400 dark:border-blue-400"
                : "border-transparent text-gray-600 hover:text-gray-800 hover:bg-white/50 dark:text-gray-300 dark:hover:text-gray-100 dark:hover:bg-slate-700/50"
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
                ? "border-blue-600 text-blue-700 bg-white/70 dark:bg-slate-800/70 dark:text-blue-400 dark:border-blue-400"
                : "border-transparent text-gray-600 hover:text-gray-800 hover:bg-white/50 dark:text-gray-300 dark:hover:text-gray-100 dark:hover:bg-slate-700/50"
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
                ? "border-blue-600 text-blue-700 bg-white/70 dark:bg-slate-800/70 dark:text-blue-400 dark:border-blue-400"
                : "border-transparent text-gray-600 hover:text-gray-800 hover:bg-white/50 dark:text-gray-300 dark:hover:text-gray-100 dark:hover:bg-slate-700/50"
            }`}
          >
            <DocumentTextIcon className="w-5 h-5" />
            <span>License Settings</span>
          </button>

          {/* Backup & Restore Tab */}
          <button
            onClick={() => setActiveTab("backup")}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-all duration-200 border-b-2 ${
              activeTab === "backup"
                ? "border-blue-600 text-blue-700 bg-white/70 dark:bg-slate-800/70 dark:text-blue-400 dark:border-blue-400"
                : "border-transparent text-gray-600 hover:text-gray-800 hover:bg-white/50 dark:text-gray-300 dark:hover:text-gray-100 dark:hover:bg-slate-700/50"
            }`}
          >
            <ServerIcon className="w-5 h-5" />
            <span>Backup & Restore</span>
          </button>

          {/* Updates Tab */}
          <button
            onClick={() => setActiveTab("update")}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-all duration-200 border-b-2 ${
              activeTab === "update"
                ? "border-blue-600 text-blue-700 bg-white/70 dark:bg-slate-800/70 dark:text-blue-400 dark:border-blue-400"
                : "border-transparent text-gray-600 hover:text-gray-800 hover:bg-white/50 dark:text-gray-300 dark:hover:text-gray-100 dark:hover:bg-slate-700/50"
            }`}
          >
            <ArrowPathIcon className="w-5 h-5" />
            <span>Updates</span>
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
            <label className="block text-sm text-gray-700 mb-1 dark:text-gray-300">Store Name</label>
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
            <label className="block text-sm text-gray-700 mb-1 dark:text-gray-300">Phone Number</label>
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
            <label className="block text-sm text-gray-700 mb-1 dark:text-gray-300">Address</label>
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
            <label className="block text-sm text-gray-700 mb-1 dark:text-gray-300">Licence Number</label>
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
            <label className="block text-sm text-gray-700 mb-1 dark:text-gray-300">Invoice Footer Note</label>
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
              className="w-full h-24 rounded-xl bg-white/70 backdrop-blur-sm border border-gray-200/70 ring-1 ring-transparent focus:ring-blue-400/40 shadow-sm focus:outline-none px-3 py-2
                dark:bg-slate-700/70 dark:border-slate-600/70 dark:text-gray-100 dark:placeholder-gray-400 dark:focus:ring-indigo-400/40"
              placeholder="This note will be printed at the bottom of the invoice…"
            />
          </div>
        </GlassToolbar>
      </GlassCard>

      {/* ===== Logo (FilePond) ===== */}
      <GlassCard className="relative z-10">
        <GlassSectionHeader title="Brand Logo" />
        <div className="px-4 pb-4">
          <div className="rounded-2xl bg-white/60 backdrop-blur-sm ring-1 ring-gray-200/60 p-3 shadow-sm dark:bg-slate-700/60 dark:ring-slate-600/60">
            <FilePond
              files={files}
              onupdatefiles={(fl) => {
                if (!can.update) { toast.error("No permission to update settings."); return; }
                setFiles(fl);
              }}
              allowMultiple={false}
              acceptedFileTypes={['application/zip', 'application/x-zip-compressed', 'application/gzip', 'application/x-gzip', 'application/octet-stream']}
              disabled={disableInputs}
              labelIdle='Drag & Drop your logo or <span class="filepond--label-action">Browse</span>'
              credits={false}
            />
            <p className="text-xs text-gray-500 mt-2 dark:text-gray-400">PNG/JPG/WEBP, up to 2 MB.</p>
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
                form.printer_type === "thermal" ? "bg-blue-50 ring-blue-300 dark:bg-blue-900/30 dark:ring-blue-700" : "bg-white/70 hover:bg-white/90 dark:bg-slate-700/60 dark:ring-slate-600/60 dark:hover:bg-slate-600/60"
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
                  <PrinterIcon className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                  <span className="text-sm font-medium dark:text-gray-200">Thermal Printer</span>
                </div>
              </label>
              
              <label className={`inline-flex items-center gap-3 px-4 py-3 rounded-xl ring-1 ring-gray-200/70 cursor-pointer transition-all ${
                form.printer_type === "a4" ? "bg-blue-50 ring-blue-300 dark:bg-blue-900/30 dark:ring-blue-700" : "bg-white/70 hover:bg-white/90 dark:bg-slate-700/60 dark:ring-slate-600/60 dark:hover:bg-slate-600/60"
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
                  <DocumentTextIcon className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                  <span className="text-sm font-medium dark:text-gray-200">A4 Printer</span>
                </div>
              </label>
            </GlassToolbar>
            <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
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
                          ? "border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800"
                          : "border-gray-200 hover:border-gray-300 hover:shadow-md dark:border-slate-600 dark:hover:border-slate-500 dark:bg-slate-800/50"
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
                        className="absolute top-2 left-2 z-10 p-1.5 rounded-lg bg-white/90 hover:bg-white shadow-sm opacity-100 transition-opacity dark:bg-slate-700/90 dark:hover:bg-slate-600"
                        title="Preview template"
                      >
                        <EyeIcon className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                      </button>
                      
                      {/* Template Content */}
                      <div className="p-4">
                        {/* Small Thumbnail Preview */}
                        <div className="mb-3 bg-white rounded-lg border border-gray-200 overflow-hidden dark:bg-slate-800 dark:border-slate-600">
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
                          <div className={`p-2 rounded-lg ${isSelected ? "bg-blue-100 dark:bg-blue-900/50" : "bg-gray-100 dark:bg-slate-700"}`}>
                            <IconComponent className={`w-6 h-6 ${isSelected ? "text-blue-600" : "text-gray-600 dark:text-gray-300"}`} />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-semibold text-gray-800 dark:text-gray-100">{template.name}</h4>
                            <p className="text-xs text-gray-500 mt-1 dark:text-gray-400">{template.description}</p>
                          </div>
                        </div>
                        
                        {/* Preview Info */}
                        <div className="bg-gray-50 rounded-lg p-2 mb-3 dark:bg-slate-700/50">
                          <p className="text-xs text-gray-600 dark:text-gray-300">{template.preview}</p>
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
                              : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-slate-700 dark:text-gray-200 dark:hover:bg-slate-600"
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
                <div className="bg-blue-50 rounded-xl p-4 border border-blue-200 dark:bg-blue-900/30 dark:border-blue-800">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                    <span className="font-medium text-blue-800 dark:text-blue-300">
                      Selected: {thermalTemplates.find(t => t.id === form.thermal_template)?.name} Template
                    </span>
                  </div>
                  <p className="text-sm text-blue-700 dark:text-blue-400">
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
          <div className="flex items-center gap-3 p-4 rounded-xl bg-white/60 dark:bg-slate-700/60">
            {licenseLoading ? (
              <div className="animate-pulse text-gray-400 dark:text-gray-500">Loading license status...</div>
            ) : licenseStatus?.valid ? (
              <>
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
                  <ShieldCheckIcon className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <div className="font-medium text-emerald-700 dark:text-emerald-400">License Active</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {formatExpiryDate(licenseStatus.expires_at) || "No expiration date"}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/50 flex items-center justify-center">
                  <ShieldExclamationIcon className="w-6 h-6 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <div className="font-medium text-red-700 dark:text-red-400">No Active License</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {licenseStatus?.reason || "License not found or expired"}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Machine ID */}
          <div className="p-4 rounded-xl bg-white/60 dark:bg-slate-700/60">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Machine ID</span>
              <button
                onClick={copyMachineId}
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                title="Copy Machine ID"
              >
                <ClipboardDocumentIcon className="w-4 h-4" />
                Copy
              </button>
            </div>
            <div className="text-xs font-mono text-gray-600 bg-gray-50 rounded p-2 break-all dark:bg-slate-800 dark:text-gray-400">
              {licenseStatus?.machine_id || "Unable to load"}
            </div>
          </div>
        </GlassToolbar>
      </GlassCard>
        </>
      )}

      {/* ===== Backup Tab ===== */}
      {activeTab === "backup" && (
        <>
          {/* ===== Backup Statistics ===== */}
          <GlassCard>
            <GlassSectionHeader
              title={<span className="inline-flex items-center gap-2">
                <CloudArrowDownIcon className="w-5 h-5 text-blue-600" />
                <span>Backup & Recovery</span>
              </span>}
              right={
                <GlassBtn
                  onClick={() => { fetchBackups(); fetchBackupStats(); }}
                  className={`h-8 px-3 ${tintGlass}`}
                  title="Refresh backups"
                >
                  <ArrowPathIcon className="w-4 h-4" />
                </GlassBtn>
              }
            />
            <GlassToolbar className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Total Backups */}
              <div className="p-4 rounded-xl bg-white/60 dark:bg-slate-700/60 text-center">
                <div className="text-2xl font-bold text-gray-800 dark:text-gray-100">
                  {backupStats?.total_backups || 0}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Total Backups</div>
              </div>

              {/* Completed */}
              <div className="p-4 rounded-xl bg-white/60 dark:bg-slate-700/60 text-center">
                <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {backupStats?.completed_backups || 0}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Completed</div>
              </div>

              {/* Failed */}
              <div className="p-4 rounded-xl bg-white/60 dark:bg-slate-700/60 text-center">
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {backupStats?.failed_backups || 0}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Failed</div>
              </div>

              {/* Total Size */}
              <div className="p-4 rounded-xl bg-white/60 dark:bg-slate-700/60 text-center">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {backupStats?.formatted_total_size || '0 B'}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Total Size</div>
              </div>
            </GlassToolbar>
          </GlassCard>

          {/* ===== Create Backup ===== */}
          <GlassCard>
            <GlassSectionHeader
              title="Create New Backup"
              subtitle="Choose backup type and create a new backup"
            />
            <GlassToolbar className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {backupTypes.map((type) => {
                const IconComponent = type.icon;
                const isSelected = selectedBackupType === type.id;

                return (
                  <div
                    key={type.id}
                    className={`relative p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      isSelected
                        ? "border-blue-500 bg-blue-50/50 dark:bg-blue-900/20"
                        : "border-gray-200 hover:border-gray-300 dark:border-slate-600 dark:hover:border-slate-500"
                    }`}
                    onClick={() => setSelectedBackupType(type.id)}
                  >
                    {isSelected && (
                      <div className="absolute top-2 right-2">
                        <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      </div>
                    )}

                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${isSelected ? "bg-blue-100 dark:bg-blue-800" : "bg-gray-100 dark:bg-slate-600"}`}>
                        <IconComponent className={`w-6 h-6 ${isSelected ? "text-blue-600" : "text-gray-600 dark:text-gray-300"}`} />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-800 dark:text-gray-100">{type.name}</h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{type.description}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </GlassToolbar>

            <div className="flex justify-end mt-4">
              <GlassBtn
                onClick={handleCreateBackup}
                disabled={creatingBackup || !canFor?.("backup")?.create}
                className={`h-10 px-6 ${!canFor?.("backup")?.create ? tintGlass + " opacity-60 cursor-not-allowed" : tintGreen}`}
              >
                <span className="inline-flex items-center gap-2">
                  {creatingBackup ? (
                    <ArrowPathIcon className="w-5 h-5 animate-spin" />
                  ) : (
                    <CloudArrowUpIcon className="w-5 h-5" />
                  )}
                  {creatingBackup ? "Creating..." : "Create Backup"}
                </span>
              </GlassBtn>
            </div>
          </GlassCard>

          {/* ===== Upload Backup ===== */}
          <GlassCard>
            <GlassSectionHeader
              title="Upload Backup"
              subtitle="Upload a previously downloaded backup file to restore"
            />
            <GlassToolbar className="space-y-4">
              {/* Upload Info */}
              <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-800">
                  <CloudArrowDownIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h4 className="font-medium text-blue-800 dark:text-blue-300">Restore from Backup File</h4>
                  <p className="text-sm text-blue-700 dark:text-blue-400 mt-1">
                    Upload a backup file (.zip, .sql.gz) that was previously downloaded from this system.
                  </p>
                </div>
              </div>

              {/* FilePond Upload Area */}
              <div className="rounded-2xl bg-white/60 backdrop-blur-sm ring-1 ring-gray-200/60 p-4 shadow-sm dark:bg-slate-700/60 dark:ring-slate-600/60">
                <FilePond
                  files={uploadFiles}
                  onupdatefiles={(fl) => {
                    if (!canFor?.("backup")?.upload) { 
                      toast.error("No permission to upload backups."); 
                      setUploadFiles([]);
                      return; 
                    }
                    setUploadFiles(fl);
                    setUploadValidationError(null);
                  }}
                  allowMultiple={false}
                  acceptedFileTypes={['application/zip', 'application/x-zip-compressed', 'application/gzip', 'application/x-gzip', 'application/octet-stream']}
                  allowFileTypeValidation={false}
                  disabled={!canFor?.("backup")?.upload || uploading}
                  labelIdle='Drag & Drop backup file or <span class="filepond--label-action">Browse</span>'
                  labelFileTypeNotAllowed='Only .zip, .sql.gz, .gz files are allowed'
                  credits={false}
                  maxFileSize="500MB"
                  oninit={handleUploadInit}
                />
                {uploadValidationError && (
                  <p className="text-sm text-red-500 mt-2">{uploadValidationError}</p>
                )}
                <p className="text-xs text-gray-500 mt-2 dark:text-gray-400">
                  Supported formats: .zip (full backup), .sql.gz, .gz (database backup). Max size: 500MB
                </p>
              </div>

              {/* Upload Actions */}
              {uploadFiles.length > 0 && uploadFiles[0] && (
                <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-slate-700/50 border border-gray-200 dark:border-slate-600">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                      <DocumentIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate max-w-xs">
                        {uploadFiles[0].file?.name || uploadFiles[0].filename}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {(uploadFiles[0].file?.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setUploadFiles([])}
                      disabled={uploading}
                      className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
                      title="Remove file"
                    >
                      <XCircleIcon className="w-5 h-5 text-gray-500" />
                    </button>
                  </div>
                </div>
              )}

              {/* Upload Button */}
              <div className="flex justify-end">
                <GlassBtn
                  onClick={() => setShowUploadModal(true)}
                  disabled={uploadFiles.length === 0 || uploading || !canFor?.("backup")?.upload}
                  className={`h-10 px-6 ${
                    !canFor?.("backup")?.upload || uploadFiles.length === 0 || uploading
                      ? tintGlass + " opacity-60 cursor-not-allowed"
                      : tintBlue
                  }`}
                >
                  <span className="inline-flex items-center gap-2">
                    {uploading ? (
                      <ArrowPathIcon className="w-5 h-5 animate-spin" />
                    ) : (
                      <CloudArrowUpIcon className="w-5 h-5" />
                    )}
                    {uploading ? "Uploading..." : "Upload & Preview"}
                  </span>
                </GlassBtn>
              </div>
            </GlassToolbar>
          </GlassCard>

          {/* ===== Backup List ===== */}
          <GlassCard>
            <GlassSectionHeader
              title="Backup History"
              subtitle="Download, restore, or delete existing backups"
            />
            {backupsLoading ? (
              <div className="p-8 text-center">
                <ArrowPathIcon className="w-8 h-8 text-gray-400 animate-spin mx-auto" />
                <p className="text-gray-500 mt-2">Loading backups...</p>
              </div>
            ) : backups.length === 0 ? (
              <div className="p-8 text-center">
                <CloudArrowDownIcon className="w-12 h-12 text-gray-300 mx-auto" />
                <p className="text-gray-500 mt-2">No backups found</p>
                <p className="text-xs text-gray-400">Create your first backup above</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-slate-600">
                      <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Type</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Created</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Size</th>
                      <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                    {backups.map((backup) => (
                      <tr key={backup.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/30">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            {getBackupStatusIcon(backup.status)}
                            <span className="text-sm capitalize text-gray-700 dark:text-gray-300">
                              {backup.status}
                            </span>
                          </div>
                          {backup.status === 'failed' && backup.error_message && (
                            <p className="text-xs text-red-500 mt-1 truncate max-w-xs">{backup.error_message}</p>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                            {backup.type_label}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-300">
                          {backup.created_at_formatted}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-300">
                          {backup.formatted_size}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {/* Download */}
                            <button
                              onClick={() => handleDownloadBackup(backup)}
                              disabled={backup.status !== 'completed' || !canFor?.("backup")?.view}
                              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Download backup"
                            >
                              <CloudArrowDownIcon className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                            </button>

                            {/* Restore */}
                            <button
                              onClick={() => openRestoreModal(backup)}
                              disabled={backup.status !== 'completed' || !canFor?.("backup")?.restore}
                              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Restore backup"
                            >
                              <ArrowPathIcon className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                            </button>

                            {/* Delete */}
                            <button
                              onClick={() => handleDeleteBackup(backup)}
                              disabled={deletingBackupId === backup.id || !canFor?.("backup")?.delete}
                              className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Delete backup"
                            >
                              {deletingBackupId === backup.id ? (
                                <ArrowPathIcon className="w-4 h-4 text-red-500 animate-spin" />
                              ) : (
                                <TrashIcon className="w-4 h-4 text-red-500" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </GlassCard>

        {/* ===== Important Notice ===== */}
          <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 border border-amber-200 dark:border-amber-800">
            <div className="flex items-start gap-3">
              <ExclamationTriangleIcon className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-amber-800 dark:text-amber-300">Important: Backup & Recovery</h4>
                <ul className="mt-2 text-sm text-amber-700 dark:text-amber-400 space-y-1">
                  <li>• Restoring a backup will overwrite current data. Create a backup first if needed.</li>
                  <li>• Password confirmation is required for restore operations.</li>
                  <li>• Database backups are compressed with gzip to save space.</li>
                  <li>• Old backups are automatically cleaned up (max 10 backups, 30 days retention).</li>
                </ul>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ===== Update Tab ===== */}
      {activeTab === "update" && (
        <>
          {/* ===== Update Overview ===== */}
          <GlassCard>
            <GlassSectionHeader
              title={<span className="inline-flex items-center gap-2">
                <ArrowPathIcon className="w-5 h-5 text-blue-600" />
                <span>Application Updates</span>
              </span>}
              right={
                <GlassBtn
                  onClick={handleCheckUpdate}
                  disabled={checkingUpdate}
                  className={`h-8 px-3 ${checkingUpdate ? tintGlass + " opacity-60" : tintBlue}`}
                  title="Check for updates"
                >
                  <span className="inline-flex items-center gap-1 text-xs">
                    {checkingUpdate ? (
                      <ArrowPathIcon className="w-4 h-4 animate-spin" />
                    ) : (
                      <ArrowPathIcon className="w-4 h-4" />
                    )}
                    {checkingUpdate ? "Checking..." : "Check Now"}
                  </span>
                </GlassBtn>
              }
            />
            <GlassToolbar className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Current Version */}
              <div className="p-4 rounded-xl bg-white/60 dark:bg-slate-700/60 text-center">
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Current Version</div>
                <div className="text-xl font-bold text-gray-800 dark:text-gray-100">
                  {updateStatus.current_version || 'Unknown'}
                </div>
              </div>

              {/* Latest Version */}
              <div className="p-4 rounded-xl bg-white/60 dark:bg-slate-700/60 text-center">
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Latest Version</div>
                <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                  {updateStatus.latest_version || 'Unknown'}
                </div>
                {updateStatus.is_new_version && (
                  <span className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                    Update Available
                  </span>
                )}
              </div>

              {/* Last Check */}
              <div className="p-4 rounded-xl bg-white/60 dark:bg-slate-700/60 text-center">
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Last Checked</div>
                <div className="text-sm font-medium text-gray-800 dark:text-gray-100">
                  {updateStatus.last_checked_at 
                    ? new Date(updateStatus.last_checked_at).toLocaleString()
                    : 'Never'
                  }
                </div>
              </div>
            </GlassToolbar>
          </GlassCard>

          {/* ===== Update Settings ===== */}
          <GlassCard>
            <GlassSectionHeader
              title="Update Settings"
              subtitle="Configure how updates are handled"
            />
            <GlassToolbar className="space-y-4">
              {/* Auto-check setting */}
              <label className="flex items-center justify-between p-4 rounded-xl bg-white/60 dark:bg-slate-700/60 cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/50">
                    <ArrowPathIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <div className="font-medium text-gray-800 dark:text-gray-100">Check for updates on login</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Automatically check for updates when you access settings
                    </div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={updateSettings.auto_check_enabled}
                  onChange={(e) => handleUpdateSettingsChange('auto_check_enabled', e.target.checked)}
                  className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500"
                />
              </label>

              {/* Require confirmation */}
              <label className="flex items-center justify-between p-4 rounded-xl bg-white/60 dark:bg-slate-700/60 cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/50">
                    <ExclamationTriangleIcon className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <div className="font-medium text-gray-800 dark:text-gray-100">Require confirmation before updating</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Always ask for confirmation before installing updates
                    </div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={updateSettings.require_confirmation}
                  onChange={(e) => handleUpdateSettingsChange('require_confirmation', e.target.checked)}
                  className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500"
                />
              </label>
            </GlassToolbar>
          </GlassCard>

          {/* ===== Update Actions ===== */}
          {updateStatus.is_new_version && (
            <GlassCard>
              <GlassSectionHeader
                title={<span className="inline-flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Update Available</span>
                </span>}
                subtitle={`Version ${updateStatus.latest_version} is ready to install`}
              />
              
              {/* Release Notes */}
              {updateStatus.release_info?.body && (
                <div className="mb-4 p-4 rounded-xl bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800">
                  <h4 className="font-medium text-blue-800 dark:text-blue-300 mb-2">Release Notes</h4>
                  <div className="text-sm text-blue-700 dark:text-blue-400 max-h-48 overflow-y-auto">
                    {updateStatus.release_info.body}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3">
                <GlassBtn
                  onClick={handleInstallUpdate}
                  disabled={installingUpdate}
                  className={`h-10 px-6 ${tintGreen}`}
                >
                  <span className="inline-flex items-center gap-2">
                    {installingUpdate ? (
                      <ArrowPathIcon className="w-5 h-5 animate-spin" />
                    ) : (
                      <ArrowPathIcon className="w-5 h-5" />
                    )}
                    {installingUpdate ? "Installing..." : "Install Update"}
                  </span>
                </GlassBtn>
                
                <a
                  href={updateStatus.release_info?.html_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  View on GitHub
                </a>
              </div>
            </GlassCard>
          )}

          {/* ===== Update Logs ===== */}
          <GlassCard>
            <GlassSectionHeader
              title="Update History"
              subtitle="View past update operations and their status"
            />
            {loadingLogs ? (
              <div className="p-8 text-center">
                <ArrowPathIcon className="w-8 h-8 text-gray-400 animate-spin mx-auto" />
                <p className="text-gray-500 mt-2">Loading update logs...</p>
              </div>
            ) : updateLogs.length === 0 ? (
              <div className="p-8 text-center">
                <ArrowPathIcon className="w-12 h-12 text-gray-300 mx-auto" />
                <p className="text-gray-500 mt-2">No update history yet</p>
                <p className="text-xs text-gray-400">Check for updates to see history</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-slate-600">
                      <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Time</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Type</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Message</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                    {updateLogs.map((log, index) => (
                      <tr key={index} className="hover:bg-gray-50 dark:hover:bg-slate-700/30">
                        <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-300">
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium capitalize bg-gray-100 text-gray-700 dark:bg-slate-600 dark:text-gray-300">
                            {log.type}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-300">
                          {log.message}
                        </td>
                        <td className="py-3 px-4">
                          {log.level === 'success' && (
                            <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                              <CheckCircleIcon className="w-4 h-4" /> Success
                            </span>
                          )}
                          {log.level === 'info' && (
                            <span className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
                              <ArrowPathIcon className="w-4 h-4" /> Info
                            </span>
                          )}
                          {log.level === 'warning' && (
                            <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                              <ExclamationTriangleIcon className="w-4 h-4" /> Warning
                            </span>
                          )}
                          {log.level === 'error' && (
                            <span className="inline-flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
                              <XCircleIcon className="w-4 h-4" /> Error
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </GlassCard>

          {/* ===== Repository Info ===== */}
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <svg className="w-6 h-6 text-gray-600 dark:text-gray-400" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
                <div>
                  <div className="font-medium text-gray-800 dark:text-gray-100">Repository</div>
                  <a 
                    href={updateStatus.repository?.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    {updateStatus.repository?.owner}/{updateStatus.repository?.repo}
                  </a>
                </div>
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Branch: {updateStatus.repository?.branch || 'main'}
              </div>
            </div>
          </div>
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

      {/* ===== Restore Confirmation Modal ===== */}
      {showRestoreModal && backupToRestore && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md mx-4 border border-gray-200 dark:border-slate-600">
            {/* Header */}
            <div className="p-6 border-b border-gray-200 dark:border-slate-600">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
                  <ArrowPathIcon className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800 dark:text-gray-100">Restore Backup</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">This action cannot be undone</p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              <div className="bg-amber-50 dark:bg-amber-900/30 rounded-xl p-4 mb-4 border border-amber-200 dark:border-amber-800">
                <p className="text-sm text-amber-800 dark:text-amber-300">
                  You are about to restore from backup:
                </p>
                <div className="mt-2 space-y-1 text-xs text-amber-700 dark:text-amber-400">
                  <p><strong>File:</strong> {backupToRestore.filename}</p>
                  <p><strong>Type:</strong> {backupToRestore.type_label}</p>
                  <p><strong>Created:</strong> {backupToRestore.created_at_formatted}</p>
                </div>
              </div>

              <form onSubmit={handleRestoreBackup}>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Enter your password to confirm
                </label>
                <input
                  type="password"
                  value={restorePassword}
                  onChange={(e) => setRestorePassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-600 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all dark:bg-slate-700 dark:text-gray-100 dark:placeholder-gray-400"
                  autoFocus
                  required
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  This ensures only authorized users can restore backups.
                </p>

                <div className="flex justify-end gap-2 mt-6">
                  <button
                    type="button"
                    onClick={closeRestoreModal}
                    className="px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors dark:text-gray-300 dark:hover:bg-slate-600"
                    disabled={restoring}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={restoring || !restorePassword}
                    className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {restoring && <ArrowPathIcon className="w-4 h-4 animate-spin" />}
                    {restoring ? "Restoring..." : "Restore Backup"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ===== Upload Confirmation Modal ===== */}
      {showUploadModal && uploadFiles.length > 0 && uploadFiles[0] && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md mx-4 border border-gray-200 dark:border-slate-600">
            {/* Header */}
            <div className="p-6 border-b border-gray-200 dark:border-slate-600">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                  <CloudArrowUpIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800 dark:text-gray-100">Upload Backup</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Review and confirm upload</p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              {/* File Info */}
              <div className="bg-gray-50 dark:bg-slate-700/50 rounded-xl p-4 mb-4 border border-gray-200 dark:border-slate-600">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                    <DocumentIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                      {uploadFiles[0].file?.name || uploadFiles[0].filename}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {(uploadFiles[0].file?.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  <p className="font-medium text-gray-700 dark:text-gray-300 mb-1">File Type:</p>
                  <p className="capitalize">
                    {uploadFiles[0].file?.type?.includes('zip') 
                      ? 'Full Backup (ZIP)' 
                      : uploadFiles[0].file?.name?.endsWith('.sql.gz')
                        ? 'Database Backup (SQL.GZ)'
                        : 'Database Backup (GZ)'}
                  </p>
                </div>
              </div>

              {/* Warning */}
              <div className="bg-amber-50 dark:bg-amber-900/30 rounded-xl p-4 mb-4 border border-amber-200 dark:border-amber-800">
                <div className="flex items-start gap-3">
                  <ExclamationTriangleIcon className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Important</p>
                    <ul className="mt-1 text-xs text-amber-700 dark:text-amber-400 space-y-1">
                      <li>• Uploaded backup will be stored on the server</li>
                      <li>• You can preview before restoring</li>
                      <li>• Password will be required for restore</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <button
                  onClick={() => {
                    setShowUploadModal(false);
                    setUploadFiles([]);
                  }}
                  className="px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors dark:text-gray-300 dark:hover:bg-slate-600"
                  disabled={uploading}
                >
                  Cancel
                </button>
                <button
                  onClick={handleUploadBackup}
                  disabled={uploading}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {uploading && <ArrowPathIcon className="w-4 h-4 animate-spin" />}
                  {uploading ? "Uploading..." : "Upload Backup"}
                </button>
              </div>
            </div>
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
