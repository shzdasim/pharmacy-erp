import React, { useEffect, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import {
  TrashIcon,
  PencilSquareIcon,
  PlusCircleIcon,
} from "@heroicons/react/24/solid";

export default function ProductsIndex() {
  const [products, setProducts] = useState([]);

  const fetchProducts = async () => {
    try {
      const res = await axios.get("/api/products");
      setProducts(res.data);
    } catch (err) {
      console.error("Error fetching products", err);
      toast.error("Failed to load products");
    }
  };

  const handleDelete = async (id) => {
    toast(
      (t) => (
        <span>
          Are you sure you want to delete this product?
          <div className="mt-2 flex gap-2">
            <button
              className="bg-red-600 text-white px-3 py-1 rounded"
              onClick={async () => {
                toast.dismiss(t.id);
                try {
                  await axios.delete(`/api/products/${id}`);
                  toast.success("Product deleted");
                  fetchProducts();
                } catch (err) {
                  toast.error("Delete failed");
                }
              }}
            >
              Yes
            </button>
            <button
              className="bg-gray-300 px-3 py-1 rounded"
              onClick={() => toast.dismiss(t.id)}
            >
              No
            </button>
          </div>
        </span>
      ),
      { duration: 5000 }
    );
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Products</h1>
        <Link
          to="/products/create"
          className="bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2"
        >
          <PlusCircleIcon className="w-5 h-5" />
          Add Product
        </Link>
      </div>

      <table className="w-full border">
        <thead className="bg-gray-100">
          <tr>
            <th className="border px-2 py-1">Code</th>
            <th className="border px-2 py-1">Name</th>
            <th className="border px-2 py-1">Image</th>
            <th className="border px-2 py-1">Category</th>
            <th className="border px-2 py-1">Brand</th>
            <th className="border px-2 py-1">Supplier</th>
            <th className="border px-2 py-1">Actions</th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <tr key={p.id}>
              <td className="border px-2 py-1">{p.product_code}</td>
              <td className="border px-2 py-1">{p.name}</td>
              <td className="border px-2 py-1">
                {p.image ? (
                  <img
                    src={`/storage/${p.image}`}
                    alt={p.name}
                    className="w-12 h-12 object-cover rounded"
                  />
                ) : (
                  <span className="text-gray-500">No image</span>
                )}
              </td>
              <td className="border px-2 py-1">{p.category?.name}</td>
              <td className="border px-2 py-1">{p.brand?.name}</td>
              <td className="border px-2 py-1">{p.supplier?.name}</td>
              <td className="border px-2 py-1 flex gap-2 justify-center">
                <Link
                  to={`/products/${p.id}/edit`}
                  className="bg-yellow-500 text-white p-2 rounded flex items-center gap-1"
                >
                  <PencilSquareIcon className="w-5 h-5" />
                  Edit
                </Link>
                <button
                  onClick={() => handleDelete(p.id)}
                  className="bg-red-600 text-white p-2 rounded flex items-center gap-1"
                >
                  <TrashIcon className="w-5 h-5" />
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
