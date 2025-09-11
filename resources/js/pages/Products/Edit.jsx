import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { useParams, useNavigate, Link } from "react-router-dom";
import ProductForm from "./ProductForm";
import { usePermissions, Guard } from "@/api/usePermissions.js";

export default function EditProduct() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { loading: permsLoading, canFor } = usePermissions();
  const can = useMemo(
    () => (typeof canFor === "function" ? canFor("product") : {
      view:false, create:false, update:false, delete:false, import:false, export:false
    }),
    [canFor]
  );

  const [initialData, setInitialData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchErr, setFetchErr] = useState(null);

  useEffect(() => { document.title = "Edit Product - Pharmacy ERP"; }, []);

  useEffect(() => {
    if (permsLoading || !can.view) return;
    (async () => {
      try {
        setLoading(true);
        const { data } = await axios.get(`/api/products/${id}`);
        setInitialData(data);
        setFetchErr(null);
      } catch (e) {
        const status = e?.response?.status;
        if (status === 403) setFetchErr("You don't have permission to view this product.");
        else if (status === 404) setFetchErr("Product not found.");
        else setFetchErr("Failed to load product.");
      } finally {
        setLoading(false);
      }
    })();
  }, [id, permsLoading, can.view]);

  const handleUpdate = async (formData) => {
    if (!can.update) {
      toast.error("You don't have permission to update products.");
      return;
    }
    try {
      await axios.post(`/api/products/${id}?_method=PUT`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success("Product updated");
      navigate("/products");
    } catch (e) {
      const msg = e?.response?.data?.message || "Update failed";
      toast.error(msg);
    }
  };

  if (permsLoading) return <div className="p-6">Loading…</div>;
  if (!can.view) return <div className="p-6 text-sm text-gray-700">You don’t have permission to view products.</div>;
  if (loading) return <div className="p-6">Loading product…</div>;
  if (fetchErr) return <div className="p-6 text-red-600">{fetchErr}</div>;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Edit Product</h1>
        <Link to="/products" className="text-blue-600 hover:underline">← Back</Link>
      </div>

      <Guard when={can.update}>
        <ProductForm initialData={initialData} onSubmit={handleUpdate} />
      </Guard>
      {!can.update && (
        <div className="text-sm text-gray-700">You don’t have permission to update products.</div>
      )}
    </div>
  );
}
