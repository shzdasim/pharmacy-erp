import React, { useEffect, useMemo } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import ProductForm from "./ProductForm";
import { usePermissions } from "@/api/usePermissions.js";

export default function CreateProduct() {
  const navigate = useNavigate();
  const { loading: permsLoading, canFor } = usePermissions();
  const can = useMemo(
    () => (typeof canFor === "function" ? canFor("product") : {
      view:false, create:false, update:false, delete:false, import:false, export:false
    }),
    [canFor]
  );

  useEffect(() => { document.title = "Add Product - Pharmacy ERP"; }, []);

  const handleCreate = async (formData) => {
    if (!can.create) {
      toast.error("You don't have permission to create products.");
      return;
    }
    try {
      await axios.post("/api/products", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success("Product created");
      navigate("/products");
    } catch (e) {
      const msg = e?.response?.data?.message || "Create failed";
      toast.error(msg);
    }
  };

  if (permsLoading) return <div className="p-6">Loading…</div>;
  if (!can.create) return <div className="p-6 text-sm text-gray-700">You don’t have permission to add products.</div>;

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">Add Product</h1>
      <ProductForm onSubmit={handleCreate} />
    </div>
  );
}
