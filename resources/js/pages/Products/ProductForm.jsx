// src/pages/products/ProductForm.jsx
import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import Select from "react-select";
import AsyncSelect from "react-select/async";
import toast from "react-hot-toast";
import { Link, useNavigate } from "react-router-dom";

// Icons (glassy header/buttons)
import {
  PhotoIcon,
  ArrowLeftIcon,
  PlusCircleIcon,
  PencilSquareIcon,
  ClipboardDocumentCheckIcon,
  Squares2X2Icon,
} from "@heroicons/react/24/solid";

// FilePond
import { FilePond, registerPlugin } from "react-filepond";
import FilePondPluginImagePreview from "filepond-plugin-image-preview";
import FilePondPluginFileValidateType from "filepond-plugin-file-validate-type";

// Styles for FilePond
import "filepond/dist/filepond.min.css";
import "filepond-plugin-image-preview/dist/filepond-plugin-image-preview.css";

// 🧊 glass primitives
import { GlassCard, GlassSectionHeader, GlassToolbar, GlassInput, GlassBtn } from "@/components/glass.jsx";
import { useTheme } from "@/context/ThemeContext";

registerPlugin(FilePondPluginImagePreview, FilePondPluginFileValidateType);

// 👉 Normalize Laravel paginate payloads (or plain arrays) to a simple array
const asList = (payload) => (Array.isArray(payload) ? payload : (payload?.data ?? payload?.items ?? []));

export default function ProductForm({ initialData = null, onSubmitSuccess }) {
  const isEdit = !!initialData;
  const navigate = useNavigate();

  const [form, setForm] = useState({
    ...initialData,
    narcotic: initialData?.narcotic || "no",
  });

  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [files, setFiles] = useState([]);
  const [batches, setBatches] = useState([]); // for batch table

  // Keep a local option object for Brand (so AsyncSelect shows the label)
  const [brandOption, setBrandOption] = useState(null);

  // === Refs for focus & navigation ===
  const nameRef = useRef(null);
  const formulationRef = useRef(null);
  const packSizeRef = useRef(null);
  const categorySelectRef = useRef(null);
  const brandSelectRef = useRef(null);
  const supplierSelectRef = useRef(null);
  const saveBtnRef = useRef(null);

  // 🧊 iOS-style tinted glass palette (same as index.jsx)
  const tintBlue   = "bg-blue-500/85 text-white shadow-[0_6px_20px_-6px_rgba(37,99,235,0.45)] ring-1 ring-white/20 hover:bg-blue-500/95";
  const tintIndigo = "bg-indigo-500/85 text-white shadow-[0_6px_20px_-6px_rgba(99,102,241,0.45)] ring-1 ring-white/20 hover:bg-indigo-500/95";
  const tintSlate  = "bg-slate-900/80 text-white shadow-[0_6px_20px_-6px_rgba(15,23,42,0.45)] ring-1 ring-white/15 hover:bg-slate-900/90";
  const tintAmber  = "bg-amber-500/85 text-white shadow-[0_6px_20px_-6px_rgba(245,158,11,0.45)] ring-1 ring-white/20 hover:bg-amber-500/95";
  const tintRed    = "bg-rose-500/85 text-white shadow-[0_6px_20px_-6px_rgba(244,63,94,0.45)] ring-1 ring-white/20 hover:bg-rose-500/95";
  const tintGlass  = "bg-white/60 text-slate-700 ring-1 ring-white/30 hover:bg-white/75 dark:text-gray-100 dark:bg-slate-700/60 dark:ring-slate-600/30 dark:hover:bg-slate-600/75";

  // Get dark mode state
  const { isDark } = useTheme();

  // ---- Load dropdown data (categories + suppliers only; Brand is async search) ----
  const fetchDropdowns = async () => {
    const [catRes, supRes] = await Promise.all([axios.get("/api/categories"), axios.get("/api/suppliers")]);
    setCategories(asList(catRes.data));
    setSuppliers(asList(supRes.data));
  };

  // ---- Preload a new product code (for add mode) ----
  const fetchNewCodes = async () => {
    const res = await axios.get("/api/products/new-code");
    setForm((prev) => ({
      ...prev,
      product_code: res.data.product_code,
      barcode: res.data.barcode,
    }));
  };

  // ---- Load batches on edit ----
  const fetchBatches = async () => {
    if (isEdit && initialData?.id) {
      try {
        const res = await axios.get(`/api/products/${initialData.id}/batches`);
        setBatches(res.data);
      } catch (error) {
        console.error("Failed to fetch batches:", error);
      }
    }
  };

  // ---- Preload selected Brand label on edit (so AsyncSelect shows it) ----
  const preloadBrandOption = async (brandId) => {
    if (!brandId) return;
    try {
      const res = await axios.get(`/api/brands/${brandId}`);
      const b = res.data;
      if (b?.id && b?.name) setBrandOption({ value: b.id, label: b.name });
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchDropdowns();
    if (!isEdit) {
      fetchNewCodes();
    } else {
      if (initialData?.image) {
        const imageUrl = `${window.location.origin}/storage/${initialData.image}`;
        setFiles([{ source: imageUrl, options: { type: "remote" } }]);
      }
      fetchBatches();
      if (initialData?.brand_id) preloadBrandOption(initialData.brand_id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Focus Name on mount (and after re-renders)
  useEffect(() => {
    const t = setTimeout(() => nameRef.current?.focus(), 120);
    return () => clearTimeout(t);
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      Object.keys(form).forEach((key) => {
        if (form[key] !== undefined && form[key] !== null) {
          formData.append(key, form[key]);
        }
      });

      if (files.length > 0 && files[0].file) {
        formData.append("image", files[0].file);
      }

      if (isEdit) {
        await axios.post(`/api/products/${initialData.id}?_method=PUT`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        toast.success("✅ Product updated!");
      } else {
        await axios.post("/api/products", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        toast.success("✅ Product added!");
        // stay on form for adding another → reset relevant fields & refocus Name
        setForm({ narcotic: "no" });
        setFiles([]);
        setBrandOption(null);
        fetchNewCodes();
        setTimeout(() => nameRef.current?.focus(), 50);
      }

      if (onSubmitSuccess) onSubmitSuccess();
    } catch (error) {
      if (error.response?.status === 422) {
        const errors = error.response.data.errors;
        Object.values(errors).forEach((messages) => {
          messages.forEach((msg) => toast.error(msg));
        });
      } else {
        toast.error("❌ Something went wrong. Please try again.");
      }
    }
  };

  // 🔑 Keyboard Shortcuts & enter-flow navigation
  useEffect(() => {
    const handleShortcut = (e) => {
      // Save (Alt+S) and Save (Alt+N)
      if (e.altKey && (e.key.toLowerCase() === "s" || e.key.toLowerCase() === "n")) {
        e.preventDefault();
        saveBtnRef.current?.click();
      }
      // Back to list
      if (e.altKey && e.key.toLowerCase() === "c") {
        e.preventDefault();
        navigate("/products");
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [navigate]);

  // Small react-select styles with dark mode support
  const smallSelectStyles = {
    control: (base) => ({
      ...base,
      minHeight: "36px",
      height: "36px",
      fontSize: "13px",
      borderRadius: 12,
      borderColor: "rgba(229,231,235,0.8)",
      backgroundColor: "rgba(255,255,255,0.7)",
      backdropFilter: "blur(6px)",
      boxShadow: "0 1px 2px rgba(15,23,42,0.06)",
    }),
    controlDark: (base) => ({
      ...base,
      minHeight: "36px",
      height: "36px",
      fontSize: "13px",
      borderRadius: 12,
      borderColor: "rgba(71,85,105,0.8)",
      backgroundColor: "rgba(51,65,85,0.7)",
      backdropFilter: "blur(6px)",
      boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
    }),
    valueContainer: (base) => ({ ...base, height: "36px", padding: "0 10px" }),
    indicatorsContainer: (base) => ({ ...base, height: "36px" }),
    input: (base) => ({ ...base, margin: 0, padding: 0, color: "#111827" }),
    inputDark: (base) => ({ ...base, margin: 0, padding: 0, color: "#f1f5f9" }),
    menuPortal: (base) => ({ ...base, zIndex: 9999 }),
    menu: (base) => ({
      ...base,
      fontSize: "13px",
      borderRadius: 12,
      overflow: "hidden",
      backgroundColor: "rgba(255,255,255,0.95)",
      backdropFilter: "blur(10px)",
      boxShadow: "0 10px 30px -10px rgba(30,64,175,0.18)",
    }),
    menuDark: (base) => ({
      ...base,
      fontSize: "13px",
      borderRadius: 12,
      overflow: "hidden",
      backgroundColor: "rgba(30,41,59,0.95)",
      backdropFilter: "blur(10px)",
      boxShadow: "0 10px 30px -10px rgba(0,0,0,0.4)",
      border: "1px solid rgba(71,85,105,0.5)",
    }),
    option: (base) => ({
      ...base,
      backgroundColor: "rgba(255,255,255,1)",
      color: "#111827",
    }),
    optionDark: (base) => ({
      ...base,
      backgroundColor: "rgba(51,65,85,1)",
      color: "#f1f5f9",
    }),
    singleValue: (base) => ({ ...base, color: "#111827" }),
    singleValueDark: (base) => ({ ...base, color: "#f1f5f9" }),
    placeholder: (base) => ({ ...base, color: "#9ca3af" }),
    placeholderDark: (base) => ({ ...base, color: "#64748b" }),
  };

  // Helper to merge dark mode styles - returns function-based styles for react-select
  const getSmallSelectStyles = (isDarkMode = false) => ({
    control: (base) => ({
      ...base,
      minHeight: "36px",
      height: "36px",
      fontSize: "13px",
      borderRadius: 12,
      borderColor: isDarkMode ? "rgba(71,85,105,0.8)" : "rgba(229,231,235,0.8)",
      backgroundColor: isDarkMode ? "rgba(51,65,85,0.7)" : "rgba(255,255,255,0.7)",
      backdropFilter: "blur(6px)",
      boxShadow: isDarkMode ? "0 1px 2px rgba(0,0,0,0.2)" : "0 1px 2px rgba(15,23,42,0.06)",
    }),
    valueContainer: (base) => ({ ...base, height: "36px", padding: "0 10px" }),
    indicatorsContainer: (base) => ({ ...base, height: "36px" }),
    input: (base) => ({
      ...base,
      margin: 0,
      padding: 0,
      color: isDarkMode ? "#f1f5f9" : "#111827",
    }),
    menuPortal: (base) => ({ ...base, zIndex: 9999 }),
    menu: (base) => ({
      ...base,
      fontSize: "13px",
      borderRadius: 12,
      overflow: "hidden",
      backgroundColor: isDarkMode ? "rgba(30,41,59,0.95)" : "rgba(255,255,255,0.95)",
      backdropFilter: "blur(10px)",
      boxShadow: isDarkMode ? "0 10px 30px -10px rgba(0,0,0,0.4)" : "0 10px 30px -10px rgba(30,64,175,0.18)",
      border: isDarkMode ? "1px solid rgba(71,85,105,0.5)" : "none",
    }),
    option: (base, state) => ({
      ...base,
      backgroundColor: isDarkMode
        ? state.isFocused
          ? "rgba(71,85,105,1)"
          : "rgba(51,65,85,1)"
        : state.isFocused
          ? "rgba(241,245,249,1)"
          : "rgba(255,255,255,1)",
      color: isDarkMode ? "#f1f5f9" : "#111827",
      cursor: "pointer",
    }),
    singleValue: (base) => ({
      ...base,
      color: isDarkMode ? "#f1f5f9" : "#111827",
    }),
    placeholder: (base) => ({
      ...base,
      color: isDarkMode ? "#64748b" : "#9ca3af",
    }),
  });

  // ===== Brand: async server-side search (searches the whole table) =====
  const loadBrandOptions = async (inputValue) => {
    try {
      const res = await axios.get("/api/brands", {
        params: { q_name: inputValue || "", per_page: 25 },
      });
      return asList(res.data).map((b) => ({ value: b.id, label: b.name }));
    } catch {
      return [];
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* ===== Left: Form ===== */}
        <GlassCard className="lg:col-span-2">
          <GlassSectionHeader
            title={
              <span className="inline-flex items-center gap-2">
                <PhotoIcon className="w-5 h-5 text-indigo-600" />
                <span>Product Details</span>
              </span>
            }
            right={
              <span className="hidden md:inline-flex items-center gap-2 text-xs text-gray-600">
                <ClipboardDocumentCheckIcon className="w-4 h-4" /> Fill the required fields and press Save
              </span>
            }
          />

          {/* FORM BODY */}
          <form id="product-form" onSubmit={handleSubmit} className="px-4 pb-4 pt-3 space-y-6">
            {/* Image */}
            <div>
              <label className="block text-sm font-medium mb-1">Image</label>
              <div className="rounded-2xl bg-white/60 backdrop-blur-sm ring-1 ring-gray-200/60 p-2">
                <FilePond
                  files={files}
                  onupdatefiles={setFiles}
                  allowMultiple={false}
                  acceptedFileTypes={["image/*"]}
                  labelIdle='Drag & Drop your image or <span class="filepond--label-action">Browse</span>'
                  credits={false}
                />
              </div>
            </div>

            {/* Code / Barcode / Rack */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Product Code</label>
                <GlassInput type="text" name="product_code" value={form.product_code || ""} disabled className="w-full bg-white/70" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Barcode</label>
                <GlassInput type="text" name="barcode" value={form.barcode || ""} disabled className="w-full bg-white/70" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Product Rack</label>
                <GlassInput type="text" name="rack" value={form.rack || ""} onChange={handleChange} className="w-full" />
              </div>
            </div>

            {/* Name / Formulation / Pack Size */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <GlassInput
                  ref={nameRef}
                  type="text"
                  name="name"
                  value={form.name || ""}
                  onChange={handleChange}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      formulationRef.current?.focus();
                    }
                  }}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Formulation</label>
                <GlassInput
                  ref={formulationRef}
                  type="text"
                  name="formulation"
                  value={form.formulation || ""}
                  onChange={handleChange}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      packSizeRef.current?.focus();
                    }
                  }}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Pack Size</label>
                <GlassInput
                  ref={packSizeRef}
                  type="text"
                  name="pack_size"
                  value={form.pack_size || ""}
                  onChange={handleChange}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      categorySelectRef.current?.focus();
                    }
                  }}
                  className="w-full"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea
                name="description"
                value={form.description || ""}
                onChange={handleChange}
                className="w-full h-28 px-3 py-2 rounded-2xl bg-white/70 backdrop-blur-sm border border-gray-200/70 ring-1 ring-transparent focus:ring-blue-400/40 shadow-sm focus:outline-none"
              />
            </div>

            {/* Category / Brand / Supplier */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Category</label>
                <Select
                  ref={categorySelectRef}
                  options={asList(categories).map((c) => ({ value: c.id, label: c.name }))}
                  value={
                    asList(categories)
                      .map((c) => ({ value: c.id, label: c.name }))
                      .find((opt) => opt.value === Number(form.category_id)) || null
                  }
                  onChange={(opt) => {
                    setForm({ ...form, category_id: opt?.value });
                    setTimeout(() => brandSelectRef.current?.focus(), 0);
                  }}
                  classNamePrefix="rs"
                  isSearchable
                  styles={getSmallSelectStyles(isDark)}
                  menuPortalTarget={typeof document !== "undefined" ? document.body : null}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Brand</label>
                <AsyncSelect
                  ref={brandSelectRef}
                  cacheOptions
                  defaultOptions
                  loadOptions={loadBrandOptions}
                  value={brandOption}
                  onChange={(opt) => {
                    setBrandOption(opt || null);
                    setForm({ ...form, brand_id: opt?.value ?? null });
                    setTimeout(() => supplierSelectRef.current?.focus(), 0);
                  }}
                  classNamePrefix="rs"
                  isSearchable
                  styles={getSmallSelectStyles(isDark)}
                  placeholder="Search brand..."
                  noOptionsMessage={() => "Type to search brands..."}
                  menuPortalTarget={typeof document !== "undefined" ? document.body : null}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Supplier</label>
                <Select
                  ref={supplierSelectRef}
                  options={asList(suppliers).map((s) => ({ value: s.id, label: s.name }))}
                  value={
                    asList(suppliers)
                      .map((s) => ({ value: s.id, label: s.name }))
                      .find((opt) => opt.value === Number(form.supplier_id)) || null
                  }
                  onChange={(opt) => {
                    setForm({ ...form, supplier_id: opt?.value });
                    setTimeout(() => saveBtnRef.current?.focus(), 0);
                  }}
                  classNamePrefix="rs"
                  isSearchable
                  styles={getSmallSelectStyles(isDark)}
                  menuPortalTarget={typeof document !== "undefined" ? document.body : null}
                />
              </div>
            </div>

            {/* Mini meta table */}
            <div>
              <div className="rounded-2xl overflow-hidden ring-1 ring-gray-200/70 bg-white/70 backdrop-blur-sm">
                <table className="w-full text-[12px] text-gray-900">
                  <thead className="bg-white/80 backdrop-blur-sm border-b border-gray-200/70">
                    <tr className="text-left">
                      <th className="px-2 py-2">Total Qty</th>
                      <th className="px-2 py-2">Pack P.Price</th>
                      <th className="px-2 py-2">Pack S.Price</th>
                      <th className="px-2 py-2">Unit P.Price</th>
                      <th className="px-2 py-2">Unit S.Price</th>
                      <th className="px-2 py-2">Avg Price</th>
                      <th className="px-2 py-2">Margin %</th>
                      <th className="px-2 py-2">Max Discount</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="odd:bg-white/90 even:bg-white/70">
                      {[
                        { name: "quantity", disabled: true, value: form.quantity || "" },
                        { name: "pack_purchase_price", disabled: true, value: form.pack_purchase_price || "" },
                        { name: "pack_sale_price", disabled: true, value: form.pack_sale_price || "" },
                        { name: "unit_purchase_price", disabled: true, value: form.unit_purchase_price || "" },
                        { name: "unit_sale_price", disabled: true, value: form.unit_sale_price || "" },
                        { name: "avg_price", disabled: true, value: form.avg_price || "" },
                        { name: "margin", disabled: true, value: form.margin || "" },
                      ].map((cfg) => (
                        <td key={cfg.name} className="px-2 py-2">
                          <GlassInput
                            type="number"
                            name={cfg.name}
                            value={cfg.value}
                            disabled={cfg.disabled}
                            className="h-8 w-full bg-white/70 appearance-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                        </td>
                      ))}
                      <td className="px-2 py-2">
                        <GlassInput
                          type="number"
                          name="max_discount"
                          value={form.max_discount || ""}
                          onChange={handleChange}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              saveBtnRef.current?.focus();
                            }
                          }}
                          className="h-8 w-full appearance-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Narcotic */}
            <div className="flex items-center">
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="narcotic"
                  checked={form.narcotic === "yes"}
                  onChange={(e) => setForm({ ...form, narcotic: e.target.checked ? "yes" : "no" })}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <span>Narcotic</span>
              </label>
            </div>

            {/* Save / Back (duplicate controls at bottom for long forms) */}
            <div className="flex flex-wrap gap-2 pt-2">
              <GlassBtn
                id="save-product-btn-bottom"
                type="submit"
                className={`min-w-[160px] ${tintBlue}`}
                onClick={() => saveBtnRef.current?.focus()}
                title="Save (Alt+S / Alt+N)"
              >
                {isEdit ? (
                  <span className="inline-flex items-center gap-2">
                    <PencilSquareIcon className="w-5 h-5" />
                    Save Changes
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2">
                    <PlusCircleIcon className="w-5 h-5" />
                    Save Product
                  </span>
                )}
              </GlassBtn>

              <Link to="/products" className={`inline-flex items-center gap-2 h-9 px-3 rounded-xl ${tintGlass}`} title="Back to Products (Alt+C)">
                <ArrowLeftIcon className="w-5 h-5" />
                Back to Products
              </Link>
            </div>
          </form>
        </GlassCard>

        {/* ===== Right: Batches (Edit only) ===== */}
        {isEdit && (
          <GlassCard className="lg:col-span-1">
            <GlassSectionHeader
              title={<span className="font-semibold">Batches</span>}
              right={<span className="text-xs text-gray-500">Read-only</span>}
            />
            <div className="px-4 pb-4 pt-3">
              {batches.length > 0 ? (
                <div className="rounded-2xl overflow-hidden ring-1 ring-gray-200/70 bg-white/60">
                  <table className="w-full text-sm">
                    <thead className="bg-white/80 backdrop-blur-sm border-b border-gray-200/70 text-left">
                      <tr>
                        <th className="p-2">Batch #</th>
                        <th className="p-2">Expiry</th>
                        <th className="p-2">Qty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {batches.map((batch, i) => (
                        <tr key={batch.id} className={`text-gray-900 ${i % 2 ? "bg-white/70" : "bg-white/90"}`}>
                          <td className="p-2">{batch.batch_number}</td>
                          <td className="p-2">{batch.expiry_date}</td>
                          <td className="p-2">{batch.quantity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-gray-600 text-sm">No batches available.</p>
              )}
            </div>
          </GlassCard>
        )}
      </div>
    </div>
  );
}
