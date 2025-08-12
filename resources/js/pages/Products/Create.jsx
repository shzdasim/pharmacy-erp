import React from "react";
import axios from "axios";
import ProductForm from "./ProductForm";

export default function CreateProduct() {
  const handleCreate = async (formData) => {
    await axios.post("/api/products", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  };

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">Add Product</h1>
      <ProductForm onSubmit={handleCreate} />
    </div>
  );
}
