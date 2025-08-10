// resources/js/pages/Brands.jsx
import { useState, useEffect } from "react";
import axios from "axios";

export default function Brands() {
  const [brands, setBrands] = useState([]);
  const [form, setForm] = useState({ name: "", image: null });
  const [editingId, setEditingId] = useState(null);
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    document.title = "Brands - Pharmacy ERP";
    fetchBrands();
  }, []);

  const fetchBrands = async () => {
    try {
      const res = await axios.get("/api/brands");
      setBrands(res.data);
    } catch (err) {
      console.error("Failed to fetch brands", err);
    }
  };

  const handleInputChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    setForm({ ...form, image: file });

    if (file) {
      setPreview(URL.createObjectURL(file));
    } else {
      setPreview(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const data = new FormData();
      data.append("name", form.name);
      if (form.image) {
        data.append("image", form.image);
      }

      if (editingId) {
        data.append("_method", "PUT");
        await axios.post(`/api/brands/${editingId}`, data, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      } else {
        await axios.post("/api/brands", data, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }

      // Reset form & preview after save
      setForm({ name: "", image: null });
      setPreview(null);
      setEditingId(null);
      fetchBrands();
    } catch (err) {
      console.error("Failed to save brand", err);
      alert(err.response?.data?.message || "Error saving brand");
    }
  };

  const handleEdit = (brand) => {
    setForm({ name: brand.name, image: null });
    setEditingId(brand.id);
    setPreview(brand.image ? `/storage/${brand.image}` : null);
  };

  const handleDelete = async (id) => {
    try {
      await axios.delete(`/api/brands/${id}`);
      setBrands((prev) => prev.filter((b) => b.id !== id));
      if (editingId === id) {
        setForm({ name: "", image: null });
        setEditingId(null);
        setPreview(null);
      }
    } catch (err) {
      console.error("Failed to delete brand", err);
      alert("Could not delete brand.");
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Brands</h1>

      <form
        onSubmit={handleSubmit}
        className="mb-4 space-y-2"
        encType="multipart/form-data"
      >
        <input
          type="text"
          name="name"
          placeholder="Brand Name"
          className="border p-2 w-full"
          value={form.name}
          onChange={handleInputChange}
          required
        />

        <input
          key={editingId || "new"} // <-- dynamic key resets input when editingId changes
          type="file"
          name="image"
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

        <button
          type="submit"
          className="bg-blue-500 text-white px-4 py-2 rounded"
        >
          {editingId ? "Update" : "Add"} Brand
        </button>
      </form>

      <table className="w-full border">
        <thead>
          <tr className="bg-gray-200">
            <th className="border p-2">Name</th>
            <th className="border p-2">Image</th>
            <th className="border p-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {brands.map((b) => (
            <tr key={b.id}>
              <td className="border p-2">{b.name}</td>
              <td className="border p-2">
                {b.image ? (
                  <img
                    src={`/storage/${b.image}`}
                    alt={b.name}
                    className="w-20 h-20 object-contain"
                  />
                ) : (
                  "No image"
                )}
              </td>
              <td className="border p-2 space-x-2">
                <button
                  onClick={() => handleEdit(b)}
                  className="bg-yellow-500 text-white px-2 py-1 rounded"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(b.id)}
                  className="bg-red-500 text-white px-2 py-1 rounded"
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
