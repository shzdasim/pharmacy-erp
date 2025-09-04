import React, { useState, useEffect } from "react";
import axios from "axios";

export default function Profile() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    password_confirmation: "",
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  
  const token = localStorage.getItem("token");

  // Load user data
  useEffect(() => {
    axios
      .get("/api/user", { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => {
        setForm((prev) => ({
          ...prev,
          name: res.data.name,
          email: res.data.email,
        }));
      })
      .catch((err) => {
        console.error(err);
      });
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    axios
      .put("/api/profile", form, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        setMessage("Profile updated successfully!");
        localStorage.setItem("user", JSON.stringify(res.data));
      })
      .catch((err) => {
        setMessage("Failed to update profile.");
        console.error(err);
      })
      .finally(() => setLoading(false));
  };

  return (
    <div className="max-w-xl mx-auto bg-white p-6 rounded-lg shadow">
      <h2 className="text-2xl font-bold mb-4">My Profile</h2>
      {message && <p className="mb-4 text-green-600">{message}</p>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block font-medium">Name</label>
          <input
            type="text"
            name="name"
            value={form.name}
            onChange={handleChange}
            className="w-full border rounded px-3 py-2"
          />
        </div>
        <div>
          <label className="block font-medium">Email</label>
          <input
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            className="w-full border rounded px-3 py-2"
          />
        </div>
        <div>
          <label className="block font-medium">Password (optional)</label>
          <input
            type="password"
            name="password"
            value={form.password}
            onChange={handleChange}
            className="w-full border rounded px-3 py-2"
          />
        </div>
        <div>
          <label className="block font-medium">Confirm Password</label>
          <input
            type="password"
            name="password_confirmation"
            value={form.password_confirmation}
            onChange={handleChange}
            className="w-full border rounded px-3 py-2"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          {loading ? "Updating..." : "Update Profile"}
        </button>
      </form>
    </div>
  );
}
