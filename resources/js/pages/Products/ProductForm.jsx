import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import Select from "react-select";
import AsyncSelect from "react-select/async";
import toast from "react-hot-toast";
import { Link, useNavigate } from "react-router-dom";
// FilePond imports
import { FilePond, registerPlugin } from "react-filepond";
import FilePondPluginImagePreview from "filepond-plugin-image-preview";
import FilePondPluginFileValidateType from "filepond-plugin-file-validate-type";

// Import styles
import "filepond/dist/filepond.min.css";
import "filepond-plugin-image-preview/dist/filepond-plugin-image-preview.css";

registerPlugin(FilePondPluginImagePreview, FilePondPluginFileValidateType);

// 👉 Normalize Laravel paginate payloads (or plain arrays) to a simple array
const asList = (payload) =>
  Array.isArray(payload) ? payload : (payload?.data ?? payload?.items ?? []);

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

  // ---- Load dropdown data (categories + suppliers only; Brand is async search) ----
  const fetchDropdowns = async () => {
    const [catRes, supRes] = await Promise.all([
      axios.get("/api/categories"),
      axios.get("/api/suppliers"),
    ]);
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
        setFiles([
          {
            source: imageUrl,
            options: {
              type: "remote",
            },
          },
        ]);
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
        await axios.post(
          `/api/products/${initialData.id}?_method=PUT`,
          formData,
          {
            headers: { "Content-Type": "multipart/form-data" },
          }
        );
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

  // Small react-select styles
  const smallSelectStyles = {
    control: (base) => ({
      ...base,
      minHeight: "28px",
      height: "28px",
      fontSize: "12px",
    }),
    valueContainer: (base) => ({
      ...base,
      height: "28px",
      padding: "0 6px",
    }),
    indicatorsContainer: (base) => ({
      ...base,
      height: "28px",
    }),
    input: (base) => ({
      ...base,
      margin: 0,
      padding: 0,
    }),
    menu: (base) => ({ ...base, fontSize: "12px" }),
  };

  // ===== Brand: async server-side search (searches the whole table) =====
  const loadBrandOptions = async (inputValue) => {
    try {
      const res = await axios.get("/api/brands", {
        params: {
          q_name: inputValue || "",
          per_page: 25, // tune page size if you like
        },
      });
      return asList(res.data).map((b) => ({ value: b.id, label: b.name }));
    } catch {
      return [];
    }
  };

  return (
    <div className="grid grid-cols-3 gap-6">
      {/* LEFT SIDE: FORM */}
      <form onSubmit={handleSubmit} className="space-y-6 col-span-2">
        {/* Row 1: Image */}
        <div className="grid grid-cols-1">
          <div>
            <label className="block font-medium">Image</label>
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

        {/* Row 2: Product Code, Barcode, Rack */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block font-medium">Product Code</label>
            <input
              type="text"
              name="product_code"
              value={form.product_code || ""}
              disabled
              className="border w-full px-2 py-1 rounded bg-gray-100"
            />
          </div>
          <div>
            <label className="block font-medium">Barcode</label>
            <input
              type="text"
              name="barcode"
              value={form.barcode || ""}
              disabled
              className="border w-full px-2 py-1 rounded bg-gray-100"
            />
          </div>
          <div>
            <label className="block font-medium">Product Rack</label>
            <input
              type="text"
              name="rack"
              value={form.rack || ""}
              onChange={handleChange}
              className="border w-full px-2 py-1 rounded"
            />
          </div>
        </div>

        {/* Row 3: Name, Formulation, Pack Size */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block font-medium">Name</label>
            <input
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
              className="border w-full px-2 py-1 rounded"
            />
          </div>
          <div>
            <label className="block font-medium">Formulation</label>
            <input
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
              className="border w-full px-2 py-1 rounded"
            />
          </div>
          <div>
            <label className="block font-medium">Pack Size</label>
            <input
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
              className="border w-full px-2 py-1 rounded"
            />
          </div>
        </div>

        {/* Row 4: Description */}
        <div>
          <label className="block font-medium">Description</label>
          <textarea
            name="description"
            value={form.description || ""}
            onChange={handleChange}
            className="border w-full px-2 py-1 rounded"
          ></textarea>
        </div>

        {/* Row 5: Category, Brand (Async), Supplier */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block font-medium">Category</label>
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
                // after keyboard Enter or mouse select → go to Brand
                setTimeout(() => brandSelectRef.current?.focus(), 0);
              }}
              classNamePrefix="rs"
              isSearchable
              styles={smallSelectStyles}
            />
          </div>

          <div>
            <label className="block font-medium">Brand</label>
            <AsyncSelect
              ref={brandSelectRef}
              cacheOptions
              defaultOptions // will call loadBrandOptions('') on open
              loadOptions={loadBrandOptions}
              value={brandOption}
              onChange={(opt) => {
                setBrandOption(opt || null);
                setForm({ ...form, brand_id: opt?.value ?? null });
                // after selection → go to Supplier
                setTimeout(() => supplierSelectRef.current?.focus(), 0);
              }}
              classNamePrefix="rs"
              isSearchable
              styles={smallSelectStyles}
              placeholder="Search brand..."
              noOptionsMessage={() => "Type to search brands..."}
            />
          </div>

          <div>
            <label className="block font-medium">Supplier</label>
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
                // after selection → jump to Save button
                setTimeout(() => saveBtnRef.current?.focus(), 0);
              }}
              classNamePrefix="rs"
              isSearchable
              styles={smallSelectStyles}
            />
          </div>
        </div>

        {/* Row 6: Mini table (very small fields, no number arrows) */}
        <div>
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-1 text-left">Total Qty</th>
                <th className="border p-1 text-left">Pack P.Price</th>
                <th className="border p-1 text-left">Pack S.Price</th>
                <th className="border p-1 text-left">Unit P.Price</th>
                <th className="border p-1 text-left">Unit S.Price</th>
                <th className="border p-1 text-left">Avg Price</th>
                <th className="border p-1 text-left">Margin %</th>
                <th className="border p-1 text-left">Max Discount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border p-1">
                  <input
                    type="number"
                    name="quantity"
                    disabled
                    value={form.quantity || ""}
                    className="border w-full h-6 px-1 rounded bg-gray-100 appearance-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </td>
                <td className="border p-1">
                  <input
                    type="number"
                    name="pack_purchase_price"
                    disabled
                    value={form.pack_purchase_price || ""}
                    className="border w-full h-6 px-1 rounded bg-gray-100 appearance-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </td>
                <td className="border p-1">
                  <input
                    type="number"
                    name="pack_sale_price"
                    disabled
                    value={form.pack_sale_price || ""}
                    className="border w-full h-6 px-1 rounded bg-gray-100 appearance-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </td>
                <td className="border p-1">
                  <input
                    type="number"
                    name="unit_purchase_price"
                    disabled
                    value={form.unit_purchase_price || ""}
                    className="border w-full h-6 px-1 rounded bg-gray-100 appearance-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </td>
                <td className="border p-1">
                  <input
                    type="number"
                    name="unit_sale_price"
                    disabled
                    value={form.unit_sale_price || ""}
                    className="border w-full h-6 px-1 rounded bg-gray-100 appearance-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </td>
                <td className="border p-1">
                  <input
                    type="number"
                    name="avg_price"
                    disabled
                    value={form.avg_price || ""}
                    className="border w-full h-6 px-1 rounded bg-gray-100 appearance-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </td>
                <td className="border p-1">
                  <input
                    type="number"
                    name="margin"
                    disabled
                    value={form.margin || ""}
                    className="border w-full h-6 px-1 rounded bg-gray-100 appearance-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </td>
                <td className="border p-1">
                  <input
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
                    className="border w-full h-6 px-1 rounded appearance-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Narcotic (separate row, compact) */}
        <div className="grid grid-cols-3 gap-4">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              name="narcotic"
              checked={form.narcotic === "yes"}
              onChange={(e) =>
                setForm({ ...form, narcotic: e.target.checked ? "yes" : "no" })
              }
              className="h-4 w-4"
            />
            <span>Narcotic</span>
          </label>
        </div>

        {/* Save / Back buttons */}
        <div className="flex items-stretch gap-2">
          <button
            id="save-product-btn"
            ref={saveBtnRef}
            type="submit"
            title="Shortcuts: Alt+S or Alt+N"
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Save Product
          </button>

          <Link
            to="/products"
            title="Shortcut: Alt + C"
            className="bg-gray-500 text-white px-4 py-2 rounded flex items-center justify-center hover:bg-gray-600"
          >
            Back to Products
          </Link>
        </div>
      </form>

      {/* RIGHT SIDE: BATCH TABLE */}
      {isEdit && (
        <div className="col-span-1 border rounded-lg shadow-sm p-4 bg-white">
          <h2 className="text-lg font-semibold mb-3">Batches</h2>
          {batches.length > 0 ? (
            <table className="w-full text-sm border">
              <thead>
                <tr className="bg-gray-100 text-left">
                  <th className="p-2 border">Batch #</th>
                  <th className="p-2 border">Expiry</th>
                  <th className="p-2 border">Qty</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((batch) => (
                  <tr key={batch.id} className="border-t">
                    <td className="p-2 border">{batch.batch_number}</td>
                    <td className="p-2 border">{batch.expiry_date}</td>
                    <td className="p-2 border">{batch.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-gray-500 text-sm">No batches available.</p>
          )}
        </div>
      )}
    </div>
  );
}
