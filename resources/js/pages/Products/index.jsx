import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import {
  TrashIcon,
  PencilSquareIcon,
  PlusCircleIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/solid";

export default function ProductsIndex() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);

  // search filters
  const [qName, setQName] = useState("");
  const [qBrand, setQBrand] = useState("");
  const [qSupplier, setQSupplier] = useState("");

  // pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const res = await axios.get("/api/products");
      setProducts(res.data || []);
    } catch (err) {
      console.error("Error fetching products", err);
      toast.error("Failed to load products");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const norm = (v) => (v ?? "").toString().toLowerCase().trim();

  const filtered = useMemo(() => {
    const nName = norm(qName);
    const nBrand = norm(qBrand);
    const nSupp = norm(qSupplier);
    return products.filter((p) => {
      const name = norm(p.name);
      const brand = norm(p.brand?.name);
      const supp = norm(p.supplier?.name);
      return name.includes(nName) && brand.includes(nBrand) && supp.includes(nSupp);
    });
  }, [products, qName, qBrand, qSupplier]);

  // reset to first page when filters/pageSize change
  useEffect(() => {
    setPage(1);
  }, [qName, qBrand, qSupplier, pageSize]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const start = (page - 1) * pageSize;
  const paged = filtered.slice(start, start + pageSize);

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

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between mb-4">
        <h1 className="text-2xl font-bold">Products</h1>
        <Link
          to="/products/create"
          className="bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2 self-start sm:self-auto"
        >
          <PlusCircleIcon className="w-5 h-5" />
          Add Product
        </Link>
      </div>

      {/* Search toolbar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <div className="relative">
          <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={qName}
            onChange={(e) => setQName(e.target.value)}
            placeholder="Search by Product Name…"
            className="w-full pl-10 pr-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="relative">
          <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={qBrand}
            onChange={(e) => setQBrand(e.target.value)}
            placeholder="Search by Brand…"
            className="w-full pl-10 pr-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="relative">
          <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={qSupplier}
            onChange={(e) => setQSupplier(e.target.value)}
            placeholder="Search by Supplier…"
            className="w-full pl-10 pr-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Meta */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
        <div className="text-sm text-gray-600">
          {loading ? (
            <span>Loading…</span>
          ) : (
            <span>
              Showing{" "}
              <strong>
                {filtered.length === 0 ? 0 : start + 1}-
                {Math.min(filtered.length, start + pageSize)}
              </strong>{" "}
              of <strong>{products.length}</strong>{" "}
              {filtered.length !== products.length && (
                <>
                  (filtered: <strong>{filtered.length}</strong>)
                </>
              )}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Rows per page</label>
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="border rounded px-2 py-1"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="w-full overflow-x-auto rounded border">
        <table className="w-full">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="border px-2 py-2 text-left">Code</th>
              <th className="border px-2 py-2 text-left">Name</th>
              <th className="border px-2 py-2 text-left">Image</th>
              <th className="border px-2 py-2 text-left">Category</th>
              <th className="border px-2 py-2 text-left">Brand</th>
              <th className="border px-2 py-2 text-left">Supplier</th>
              <th className="border px-2 py-2 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 && !loading && (
              <tr>
                <td
                  className="border px-3 py-6 text-center text-gray-500"
                  colSpan={7}
                >
                  No products found.
                </td>
              </tr>
            )}
            {paged.map((p) => (
              <tr
                key={p.id}
                className="odd:bg-white even:bg-gray-50 hover:bg-blue-50 transition-colors"
              >
                <td className="border px-2 py-2">{p.product_code}</td>
                <td className="border px-2 py-2">{p.name}</td>
                <td className="border px-2 py-2">
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
                <td className="border px-2 py-2">{p.category?.name}</td>
                <td className="border px-2 py-2">{p.brand?.name}</td>
                <td className="border px-2 py-2">{p.supplier?.name}</td>
                <td className="border px-2 py-2">
                  <div className="flex gap-2 justify-center">
                    <Link
                      to={`/products/${p.id}/edit`}
                      className="bg-yellow-500 text-white px-3 py-1 rounded flex items-center gap-1"
                    >
                      <PencilSquareIcon className="w-5 h-5" />
                      Edit
                    </Link>
                    <button
                      onClick={() => handleDelete(p.id)}
                      className="bg-red-600 text-white px-3 py-1 rounded flex items-center gap-1"
                    >
                      <TrashIcon className="w-5 h-5" />
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="mt-4 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="text-sm text-gray-600">
          Page {page} of {pageCount}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage(1)}
            disabled={page === 1}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            ⏮ First
          </button>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            ◀ Prev
          </button>
          <button
            onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
            disabled={page === pageCount}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            Next ▶
          </button>
          <button
            onClick={() => setPage(pageCount)}
            disabled={page === pageCount}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            Last ⏭
          </button>
        </div>
      </div>
    </div>
  );
}
