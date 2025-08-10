import { useState, useEffect, useRef } from "react";
import axios from "axios";

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [form, setForm] = useState({ name: "", address: "", phone: "" });
  const [editingId, setEditingId] = useState(null);

  // Ref for first input field
  const firstInputRef = useRef(null);

  useEffect(() => {
    fetchSuppliers();
  }, []);

  // Focus first input on mount and on edit/add mode switch
  useEffect(() => {
    if (firstInputRef.current) {
      firstInputRef.current.focus();
    }
  }, [editingId]);

  const fetchSuppliers = async () => {
    try {
      const res = await axios.get("/api/suppliers");
      setSuppliers(res.data);
    } catch (err) {
      console.error("Failed to fetch suppliers", err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await axios.put(`/api/suppliers/${editingId}`, form);
      } else {
        await axios.post("/api/suppliers", form);
      }
      setForm({ name: "", address: "", phone: "" });
      setEditingId(null);
      fetchSuppliers();
    } catch (err) {
      console.error("Failed to save supplier", err);
    }
  };

  const handleEdit = (supplier) => {
    setForm({
      name: supplier.name,
      address: supplier.address || "",
      phone: supplier.phone || "",
    });
    setEditingId(supplier.id);
  };

  const handleDelete = async (id) => {
    try {
      await axios.delete(`/api/suppliers/${id}`);

      setSuppliers((prev) => prev.filter((s) => Number(s.id) !== Number(id)));

      if (Number(editingId) === Number(id)) {
        setForm({ name: "", address: "", phone: "" });
        setEditingId(null);
      }
    } catch (err) {
      console.error("Failed to delete supplier", err);
    }
  };

  // Keyboard handler for Edit/Delete buttons
  const handleButtonKeyDown = (e, action) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      action();
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Suppliers</h1>

      <form onSubmit={handleSubmit} className="mb-4 space-y-2">
        <input
          type="text"
          placeholder="Name"
          className="border p-2 w-full"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          ref={firstInputRef}
          required
        />
        <input
          type="text"
          placeholder="Address"
          className="border p-2 w-full"
          value={form.address}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
        />
        <input
          type="text"
          placeholder="Phone"
          className="border p-2 w-full"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
        />
        <button
          type="submit"
          className="bg-blue-500 text-white px-4 py-2 rounded"
        >
          {editingId ? "Update" : "Add"} Supplier
        </button>
      </form>

      <table className="w-full border">
        <thead>
          <tr className="bg-gray-200">
            <th className="border p-2">Name</th>
            <th className="border p-2">Address</th>
            <th className="border p-2">Phone</th>
            <th className="border p-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {suppliers.map((s) => (
            <tr key={s.id}>
              <td className="border p-2">{s.name}</td>
              <td className="border p-2">{s.address}</td>
              <td className="border p-2">{s.phone}</td>
              <td className="border p-2 space-x-2">
                <button
                  onClick={() => handleEdit(s)}
                  onKeyDown={(e) => handleButtonKeyDown(e, () => handleEdit(s))}
                  tabIndex={0}
                  className="bg-yellow-500 text-white px-2 py-1 rounded"
                  aria-label={`Edit supplier ${s.name}`}
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(s.id)}
                  onKeyDown={(e) => handleButtonKeyDown(e, () => handleDelete(s.id))}
                  tabIndex={0}
                  className="bg-red-500 text-white px-2 py-1 rounded"
                  aria-label={`Delete supplier ${s.name}`}
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
