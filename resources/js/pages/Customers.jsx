import { useState, useEffect, useRef } from "react";
import axios from "axios";

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState({ name: "", email: "", phone: "", address: "" });
  const [editingId, setEditingId] = useState(null);

  // Ref for first input field
  const firstInputRef = useRef(null);

  useEffect(() => {
    document.title = "Customers - Pharmacy ERP";
    fetchCustomers();
  }, []);

  // Focus first input on mount and edit/add mode changes
  useEffect(() => {
    if (firstInputRef.current) {
      firstInputRef.current.focus();
    }
  }, [editingId]);

  const fetchCustomers = async () => {
    try {
      const res = await axios.get("/api/customers");
      setCustomers(res.data);
    } catch (err) {
      console.error("Failed to fetch customers", err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await axios.put(`/api/customers/${editingId}`, form);
      } else {
        await axios.post("/api/customers", form);
      }
      setForm({ name: "", email: "", phone: "", address: "" });
      setEditingId(null);
      fetchCustomers();
    } catch (err) {
      console.error("Failed to save customer", err);
      alert(err.response?.data?.message || "Error saving customer");
    }
  };

  const handleEdit = (customer) => {
    setForm(customer);
    setEditingId(customer.id);
  };

  const handleDelete = async (id) => {
    try {
      await axios.delete(`/api/customers/${id}`);
      setCustomers((prev) => prev.filter((c) => Number(c.id) !== Number(id)));
      if (Number(editingId) === Number(id)) {
        setForm({ name: "", email: "", phone: "", address: "" });
        setEditingId(null);
      }
    } catch (err) {
      console.error("Failed to delete customer", err);
    }
  };

  const handleButtonKeyDown = (e, action) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      action();
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Customers</h1>

      <form onSubmit={handleSubmit} className="mb-4 space-y-2">
        <input
          type="text"
          placeholder="Name (required)"
          className="border p-2 w-full"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          ref={firstInputRef}
          required
        />
        <input
          type="email"
          placeholder="Email"
          className="border p-2 w-full"
          value={form.email || ""}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        <input
          type="text"
          placeholder="Phone"
          className="border p-2 w-full"
          value={form.phone || ""}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
        />
        <input
          type="text"
          placeholder="Address"
          className="border p-2 w-full"
          value={form.address || ""}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
        />
        <button
          type="submit"
          className="bg-blue-500 text-white px-4 py-2 rounded"
        >
          {editingId ? "Update" : "Add"} Customer
        </button>
      </form>

      <table className="w-full border">
        <thead>
          <tr className="bg-gray-200">
            <th className="border p-2">Name</th>
            <th className="border p-2">Email</th>
            <th className="border p-2">Phone</th>
            <th className="border p-2">Address</th>
            <th className="border p-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {customers.map((c) => (
            <tr key={c.id}>
              <td className="border p-2">{c.name}</td>
              <td className="border p-2">{c.email}</td>
              <td className="border p-2">{c.phone}</td>
              <td className="border p-2">{c.address}</td>
              <td className="border p-2 space-x-2">
                <button
                  onClick={() => handleEdit(c)}
                  onKeyDown={(e) => handleButtonKeyDown(e, () => handleEdit(c))}
                  tabIndex={0}
                  className="bg-yellow-500 text-white px-2 py-1 rounded"
                  aria-label={`Edit customer ${c.name}`}
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(c.id)}
                  onKeyDown={(e) => handleButtonKeyDown(e, () => handleDelete(c.id))}
                  tabIndex={0}
                  className="bg-red-500 text-white px-2 py-1 rounded"
                  aria-label={`Delete customer ${c.name}`}
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
