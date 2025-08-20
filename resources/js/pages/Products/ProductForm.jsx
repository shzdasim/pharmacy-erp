import React, { useEffect, useState } from "react";
import axios from "axios";
import Select from "react-select";
import toast from "react-hot-toast";
import { Link } from "react-router-dom";
// FilePond imports
import { FilePond, registerPlugin } from 'react-filepond';
import FilePondPluginImagePreview from 'filepond-plugin-image-preview';
import FilePondPluginFileValidateType from 'filepond-plugin-file-validate-type';

// Import styles
import 'filepond/dist/filepond.min.css';
import 'filepond-plugin-image-preview/dist/filepond-plugin-image-preview.css';

registerPlugin(FilePondPluginImagePreview, FilePondPluginFileValidateType);

export default function ProductForm({ initialData = null, onSubmitSuccess }) {
  const isEdit = !!initialData;

  const [form, setForm] = useState({
    ...initialData,
    narcotic: initialData?.narcotic || "no",
  });

  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [files, setFiles] = useState([]);

  const fetchDropdowns = async () => {
    const [catRes, brandRes, supRes] = await Promise.all([
      axios.get("/api/categories"),
      axios.get("/api/brands"),
      axios.get("/api/suppliers"),
    ]);
    setCategories(catRes.data);
    setBrands(brandRes.data);
    setSuppliers(supRes.data);
  };

  const fetchNewCodes = async () => {
    const res = await axios.get("/api/products/new-code");
    setForm((prev) => ({
      ...prev,
      product_code: res.data.product_code,
      barcode: res.data.barcode,
    }));
  };

useEffect(() => {
  fetchDropdowns();
  if (!isEdit) {
    fetchNewCodes();
  } else if (initialData?.image) {
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
      setForm({ narcotic: "no" });
      setFiles([]);
      fetchNewCodes();
    }

    if (onSubmitSuccess) onSubmitSuccess();
  } catch (error) {
    if (error.response?.status === 422) {
      // Laravel validation errors
      const errors = error.response.data.errors;
      Object.values(errors).forEach((messages) => {
        messages.forEach((msg) => toast.error(msg));
      });
    } else {
      // Other errors
      toast.error("❌ Something went wrong. Please try again.");
    }
  }
};


  return (
    <form onSubmit={handleSubmit} className="space-y-6">
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
            type="text"
            name="name"
            value={form.name || ""}
            onChange={handleChange}
            className="border w-full px-2 py-1 rounded"
          />
        </div>
        <div>
          <label className="block font-medium">Formulation</label>
          <input
            type="text"
            name="formulation"
            value={form.formulation || ""}
            onChange={handleChange}
            className="border w-full px-2 py-1 rounded"
          />
        </div>
        <div>
          <label className="block font-medium">Pack Size</label>
          <input
            type="text"
            name="pack_size"
            value={form.pack_size || ""}
            onChange={handleChange}
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

      {/* Row 5: Category, Brand, Supplier */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block font-medium">Category</label>
          <Select
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
            value={categories
              .map((c) => ({ value: c.id, label: c.name }))
              .find((opt) => opt.value === form.category_id) || null}
            onChange={(opt) => setForm({ ...form, category_id: opt?.value })}
          />
        </div>
        <div>
          <label className="block font-medium">Brand</label>
          <Select
            options={brands.map((b) => ({ value: b.id, label: b.name }))}
            value={brands
              .map((b) => ({ value: b.id, label: b.name }))
              .find((opt) => opt.value === form.brand_id) || null}
            onChange={(opt) => setForm({ ...form, brand_id: opt?.value })}
          />
        </div>
        <div>
          <label className="block font-medium">Supplier</label>
          <Select
            options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
            value={suppliers
              .map((s) => ({ value: s.id, label: s.name }))
              .find((opt) => opt.value === form.supplier_id) || null}
            onChange={(opt) => setForm({ ...form, supplier_id: opt?.value })}
          />
        </div>
      </div>

      {/* Row 6: Pricing + Margin + Discount + Narcotic */}
      <div className="grid grid-cols-7 gap-2 items-end">
        <input type="number" name="pack_purchase_price" disabled value={form.pack_purchase_price || ""} onChange={handleChange} placeholder="Pack Purchase Price" className="border w-full px-2 py-1 rounded bg-gray-100" />
        <input type="number" name="pack_sale_price" disabled value={form.pack_sale_price || ""} onChange={handleChange} placeholder="Pack Sale Price" className="border w-full px-2 py-1 rounded bg-gray-100" />
        <input type="number" name="unit_purchase_price" disabled value={form.unit_purchase_price || ""} onChange={handleChange} placeholder="Unit Purchase Price" className="border w-full px-2 py-1 rounded bg-gray-100" />
        <input type="number" name="unit_sale_price" disabled value={form.unit_sale_price || ""} onChange={handleChange} placeholder="Unit Sale Price" className="border w-full px-2 py-1 rounded bg-gray-100" />
        <input type="number" name="avg_price" disabled value={form.avg_price || ""} onChange={handleChange} placeholder="Avg Price" className="border w-full px-2 py-1 rounded bg-gray-100" />
        <input type="number" name="margin" disabled value={form.margin || ""} onChange={handleChange} placeholder="Margin %" className="border w-full px-2 py-1 rounded bg-gray-100" />
        <input type="number" name="max_discount" value={form.max_discount || ""} onChange={handleChange} placeholder="Max Discount" className="border px-2 py-1 rounded" />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <label className="flex items-center space-x-2">
          <input type="checkbox" name="narcotic" checked={form.narcotic === "yes"} onChange={(e) => setForm({ ...form, narcotic: e.target.checked ? "yes" : "no" })} className="h-4 w-4" />
          <span>Narcotic</span>
        </label>
      </div>

      {/* Save Button */}
<div className="flex items-stretch gap-2">
  <button
    type="submit"
    className="bg-blue-600 text-white px-4 py-2 rounded"
  >
    Save Product
  </button>

  <Link
    to="/products"
    className="bg-gray-500 text-white px-4 py-2 rounded flex items-center justify-center"
  >
    Back to Products
  </Link>
</div>

    </form>
  );
}
