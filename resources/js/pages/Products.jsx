import { useState, useEffect } from "react";
import axios from "axios";
import Select from "react-select";

export default function Products() {
  const [form, setForm] = useState({
    product_code: "",
    barcode: "",
    name: "",
    image: null,
    formulation: "",
    description: "",
    pack_size: "",
    quantity: "",
    pack_purchase_price: "",
    pack_sale_price: "",
    unit_purchase_price: "",
    unit_sale_price: "",
    avg_price: "",
    narcotic: "no",
    max_discount: "",
    category_id: null,
    brand_id: null,
    supplier_id: null,
    rack: "",
  });

  const [preview, setPreview] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);

  // Fetch categories, brands, suppliers on mount
  useEffect(() => {
    axios.get("/api/categories").then(res => setCategories(res.data));
    axios.get("/api/brands").then(res => setBrands(res.data));
    axios.get("/api/suppliers").then(res => setSuppliers(res.data));
    fetchProducts();
  }, []);

  // Fetch all products
  const fetchProducts = () => {
    axios.get("/api/products")
      .then(res => setProducts(res.data))
      .catch(console.error);
  };

  // Fetch new product_code and barcode when adding new product
  useEffect(() => {
    if (!editingId) {
      axios.get("/api/products/new-code")
        .then(res => {
          setForm(f => ({
            ...f,
            product_code: res.data.product_code,
            barcode: res.data.barcode,
          }));
          setPreview(null);
        })
        .catch(console.error);
    }
  }, [editingId]);

  // Handle input changes for text, number, textarea
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;

    if (type === "checkbox") {
      setForm(f => ({
        ...f,
        [name]: checked ? "yes" : "no",
      }));
    } else {
      setForm(f => ({
        ...f,
        [name]: value,
      }));
    }
  };

  // Handle file input for image
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    setForm(f => ({ ...f, image: file }));
    if (file) {
      setPreview(URL.createObjectURL(file));
    } else {
      setPreview(null);
    }
  };

  // Handle React-Select change for category, brand, supplier
  const handleSelectChange = (selectedOption, actionMeta) => {
    const { name } = actionMeta;
    setForm(f => ({
      ...f,
      [name]: selectedOption ? selectedOption.value : null,
    }));
  };

  // Reset form to initial state
  const resetForm = () => {
    setEditingId(null);
    setForm({
      product_code: "",
      barcode: "",
      name: "",
      image: null,
      formulation: "",
      description: "",
      pack_size: "",
      quantity: "",
      pack_purchase_price: "",
      pack_sale_price: "",
      unit_purchase_price: "",
      unit_sale_price: "",
      avg_price: "",
      narcotic: "no",
      max_discount: "",
      category_id: null,
      brand_id: null,
      supplier_id: null,
      rack: "",
    });
    setPreview(null);
  };

  // Load product data into form for editing
  const handleEdit = (product) => {
    setEditingId(product.id);
    setForm({
      product_code: product.product_code,
      barcode: product.barcode,
      name: product.name,
      image: null,
      formulation: product.formulation || "",
      description: product.description || "",
      pack_size: product.pack_size || "",
      quantity: product.quantity || "",
      pack_purchase_price: product.pack_purchase_price || "",
      pack_sale_price: product.pack_sale_price || "",
      unit_purchase_price: product.unit_purchase_price || "",
      unit_sale_price: product.unit_sale_price || "",
      avg_price: product.avg_price || "",
      narcotic: product.narcotic || "no",
      max_discount: product.max_discount || "",
      category_id: product.category_id || null,
      brand_id: product.brand_id || null,
      supplier_id: product.supplier_id || null,
      rack: product.rack || "",
    });
    setPreview(product.image ? `/storage/${product.image}` : null);
  };

  // Submit form (add or update)
  const handleSubmit = async (e) => {
  e.preventDefault();

  const data = new FormData();

  data.append("product_code", form.product_code || "");
  data.append("barcode", form.barcode || "");
  data.append("name", form.name || "");
  if (form.image) data.append("image", form.image);
  data.append("formulation", form.formulation || "");
  data.append("description", form.description || "");
  data.append("pack_size", form.pack_size || "");
  data.append("quantity", form.quantity || "");
  data.append("pack_purchase_price", form.pack_purchase_price || "");
  data.append("pack_sale_price", form.pack_sale_price || "");
  data.append("unit_purchase_price", form.unit_purchase_price || "");
  data.append("unit_sale_price", form.unit_sale_price || "");
  data.append("avg_price", form.avg_price || "");
  data.append("narcotic", form.narcotic || "no");
  data.append("max_discount", form.max_discount || "");
  data.append("category_id", form.category_id || "");
  data.append("brand_id", form.brand_id || "");
  data.append("supplier_id", form.supplier_id || "");
  data.append("rack", form.rack || "");

  // Log all FormData key-value pairs for debugging
  for (const pair of data.entries()) {
    console.log(pair[0] + ": " + pair[1]);
  }

  try {
    if (editingId) {
      await axios.put(`/api/products/${editingId}`, data, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      alert("Product updated successfully");
    } else {
      await axios.post("/api/products", data, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      alert("Product added successfully");
    }
    resetForm();
    fetchProducts();
  } catch (error) {
    if (error.response && error.response.status === 422) {
      const validationErrors = error.response.data.errors;
      console.error("Validation Errors:", validationErrors);
      alert(
        Object.entries(validationErrors)
          .map(([field, msgs]) => `${field}: ${msgs.join(", ")}`)
          .join("\n")
      );
    } else {
      console.error("Failed to save product:", error);
      alert(error.response?.data?.message || "Failed to save product");
    }
  }
};



  // Delete product
  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this product?")) return;
    try {
      await axios.delete(`/api/products/${id}`);
      fetchProducts();
      if (editingId === id) resetForm();
    } catch (error) {
      console.error("Failed to delete product:", error);
      alert("Could not delete product.");
    }
  };

  // Helper to format product_code for display
  const formatProductCode = (code) => {
    if (!code) return "";
    return `PRD-${code.toString().padStart(4, "0")}`;
  };

  // Prepare options for react-select
  const categoryOptions = categories.map(c => ({ value: c.id, label: c.name }));
  const brandOptions = brands.map(b => ({ value: b.id, label: b.name }));
  const supplierOptions = suppliers.map(s => ({ value: s.id, label: s.name }));

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Products</h1>

      <form onSubmit={handleSubmit} className="mb-10 space-y-6" encType="multipart/form-data">
        {/* Product code & barcode */}
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="block font-semibold mb-1">Product Code</label>
            <input
              type="text"
              name="product_code"
              value={formatProductCode(form.product_code)}
              disabled
              className="border p-2 w-full bg-gray-100 cursor-not-allowed"
              readOnly
            />
          </div>

          <div>
            <label className="block font-semibold mb-1">Barcode</label>
            <input
              type="text"
              name="barcode"
              value={form.barcode}
              disabled
              className="border p-2 w-full bg-gray-100 cursor-not-allowed"
              readOnly
            />
          </div>
        </div>

        {/* Name and Image */}
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="block font-semibold mb-1">Name *</label>
            <input
              type="text"
              name="name"
              value={form.name}
              onChange={handleInputChange}
              required
              className="border p-2 w-full"
              placeholder="Product name"
            />
          </div>

          <div>
            <label className="block font-semibold mb-1">Image</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="border p-2 w-full"
            />
            {preview && (
              <img
                src={preview}
                alt="Preview"
                className="w-32 h-32 object-contain mt-2 border"
              />
            )}
          </div>
        </div>

        {/* Formulation and Description */}
        <div>
          <label className="block font-semibold mb-1">Formulation</label>
          <input
            type="text"
            name="formulation"
            value={form.formulation}
            onChange={handleInputChange}
            className="border p-2 w-full"
            placeholder="Formulation"
          />
        </div>

        <div>
          <label className="block font-semibold mb-1">Description</label>
          <textarea
            name="description"
            value={form.description}
            onChange={handleInputChange}
            className="border p-2 w-full"
            rows={3}
            placeholder="Description"
          />
        </div>

        {/* Numeric fields */}
        <div className="grid grid-cols-3 gap-6">
          <div>
            <label className="block font-semibold mb-1">Pack Size *</label>
            <input
              type="number"
              name="pack_size"
              value={form.pack_size}
              onChange={handleInputChange}
              required
              className="border p-2 w-full"
              min="0"
            />
          </div>

          <div>
            <label className="block font-semibold mb-1">Quantity</label>
            <input
              type="number"
              name="quantity"
              value={form.quantity}
              onChange={handleInputChange}
              className="border p-2 w-full"
              min="0"
            />
          </div>

          <div>
            <label className="block font-semibold mb-1">Max Discount</label>
            <input
              type="number"
              name="max_discount"
              value={form.max_discount}
              onChange={handleInputChange}
              className="border p-2 w-full"
              min="0"
              step="0.01"
            />
          </div>
        </div>

        {/* Pricing */}
        <div className="grid grid-cols-3 gap-6">
          <div>
            <label className="block font-semibold mb-1">Pack Purchase Price</label>
            <input
              type="number"
              name="pack_purchase_price"
              value={form.pack_purchase_price}
              onChange={handleInputChange}
              className="border p-2 w-full"
              min="0"
              step="0.01"
            />
          </div>

          <div>
            <label className="block font-semibold mb-1">Pack Sale Price</label>
            <input
              type="number"
              name="pack_sale_price"
              value={form.pack_sale_price}
              onChange={handleInputChange}
              className="border p-2 w-full"
              min="0"
              step="0.01"
            />
          </div>

          <div>
            <label className="block font-semibold mb-1">Average Price</label>
            <input
              type="number"
              name="avg_price"
              value={form.avg_price}
              onChange={handleInputChange}
              className="border p-2 w-full"
              min="0"
              step="0.01"
            />
          </div>
        </div>

        {/* Unit prices */}
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="block font-semibold mb-1">Unit Purchase Price</label>
            <input
              type="number"
              name="unit_purchase_price"
              value={form.unit_purchase_price}
              onChange={handleInputChange}
              className="border p-2 w-full"
              min="0"
              step="0.01"
            />
          </div>

          <div>
            <label className="block font-semibold mb-1">Unit Sale Price</label>
            <input
              type="number"
              name="unit_sale_price"
              value={form.unit_sale_price}
              onChange={handleInputChange}
              className="border p-2 w-full"
              min="0"
              step="0.01"
            />
          </div>
        </div>

        {/* Narcotic checkbox */}
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            name="narcotic"
            checked={form.narcotic === "yes"}
            onChange={handleInputChange}
            id="narcotic"
            className="form-checkbox h-5 w-5 text-blue-600"
          />
          <label htmlFor="narcotic" className="select-none font-semibold">Narcotic</label>
        </div>

        {/* Selects */}
        <div className="grid grid-cols-3 gap-6">
          <div>
            <label className="block font-semibold mb-1">Category *</label>
            <Select
              name="category_id"
              value={categoryOptions.find(c => c.value === form.category_id) || null}
              onChange={handleSelectChange}
              options={categoryOptions}
              placeholder="Select category"
              isClearable
            />
          </div>

          <div>
            <label className="block font-semibold mb-1">Brand *</label>
            <Select
              name="brand_id"
              value={brandOptions.find(b => b.value === form.brand_id) || null}
              onChange={handleSelectChange}
              options={brandOptions}
              placeholder="Select brand"
              isClearable
            />
          </div>

          <div>
            <label className="block font-semibold mb-1">Supplier</label>
            <Select
              name="supplier_id"
              value={supplierOptions.find(s => s.value === form.supplier_id) || null}
              onChange={handleSelectChange}
              options={supplierOptions}
              placeholder="Select supplier"
              isClearable
            />
          </div>
        </div>

        {/* Rack */}
        <div>
          <label className="block font-semibold mb-1">Rack</label>
          <input
            type="text"
            name="rack"
            value={form.rack}
            onChange={handleInputChange}
            className="border p-2 w-full"
            placeholder="Rack location"
          />
        </div>

        {/* Buttons */}
        <div className="flex space-x-4 mt-4">
          <button
            type="submit"
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 transition"
          >
            {editingId ? "Update Product" : "Add Product"}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="px-6 py-2 border rounded hover:bg-gray-100 transition"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      {/* Product list table */}
      <div>
        <h2 className="text-2xl font-semibold mb-4">Product List</h2>
        <div className="overflow-x-auto border rounded">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Code</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Name</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Category</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Brand</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Supplier</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Image</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {products.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-sm">{formatProductCode(p.product_code)}</td>
                  <td className="px-4 py-2 text-sm">{p.name}</td>
                  <td className="px-4 py-2 text-sm">{p.category?.name || "-"}</td>
                  <td className="px-4 py-2 text-sm">{p.brand?.name || "-"}</td>
                  <td className="px-4 py-2 text-sm">{p.supplier?.name || "-"}</td>
                                    <td className="px-4 py-2 text-sm">
                    {p.image ? (
                      <img
                        src={`/storage/${p.image}`}
                        alt={p.name}
                        className="w-16 h-16 object-contain rounded"
                      />
                    ) : (
                      "No image"
                    )}
                  </td>
                  <td className="px-4 py-2 text-sm space-x-2">
                    <button
                      onClick={() => handleEdit(p)}
                      className="bg-yellow-400 hover:bg-yellow-500 text-white px-3 py-1 rounded"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(p.id)}
                      className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {products.length === 0 && (
                <tr>
                  <td colSpan="7" className="text-center py-4 text-gray-500">
                    No products found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

