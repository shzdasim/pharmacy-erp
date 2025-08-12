import React, { useEffect, useState } from "react";
import axios from "axios";
import { useParams } from "react-router-dom";
import ProductForm from "./ProductForm";

export default function EditProduct() {
  const { id } = useParams();
  const [initialData, setInitialData] = useState(null);

  useEffect(() => {
    axios.get(`/api/products/${id}`).then((res) => {
      setInitialData(res.data);
    });
  }, [id]);

  const handleUpdate = async (formData) => {
    await axios.post(`/api/products/${id}?_method=PUT`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  };

  if (!initialData) return <p>Loading...</p>;

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">Edit Product</h1>
      <ProductForm initialData={initialData} onSubmit={handleUpdate} />
    </div>
  );
}
