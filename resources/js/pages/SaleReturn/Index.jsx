import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";

export default function SaleReturnsIndex() {
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReturns();
  }, []);

  const fetchReturns = async () => {
    try {
      const res = await axios.get("/api/sale-returns");
      setReturns(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      toast.error("Failed to fetch sale returns");
      setReturns([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    const confirmed = await new Promise((resolve) => {
      toast((t) => (
        <div className="flex flex-col">
          <p>Are you sure you want to delete this sale return?</p>
          <div className="flex justify-end gap-2 mt-2">
            <button
              className="bg-gray-300 px-3 py-1 rounded"
              onClick={() => {
                toast.dismiss(t.id);
                resolve(false);
              }}
            >
              Cancel
            </button>
            <button
              className="bg-red-500 text-white px-3 py-1 rounded"
              onClick={() => {
                toast.dismiss(t.id);
                resolve(true);
              }}
            >
              Delete
            </button>
          </div>
        </div>
      ));
    });

    if (!confirmed) return;

    try {
      await axios.delete(`/api/sale-returns/${id}`);
      toast.success("Sale return deleted");
      fetchReturns();
    } catch (err) {
      toast.error("Failed to delete sale return");
    }
  };

  if (loading) return <p>Loading...</p>;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Sale Returns</h1>
        <Link
          to="/sale-returns/create"
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          + Add Sale Return
        </Link>
      </div>

      {returns.length === 0 ? (
        <p>No sale returns found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border border-gray-200">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-2 border">#</th>
                <th className="p-2 border">Return No</th>
                <th className="p-2 border">Customer</th>
                <th className="p-2 border">Date</th>
                <th className="p-2 border">Amount</th>
                <th className="p-2 border">Actions</th>
              </tr>
            </thead>
            <tbody>
              {returns.map((ret, index) => (
                <tr key={ret.id} className="text-center">
                  <td className="p-2 border">{index + 1}</td>
                  <td className="p-2 border">{ret.posted_number}</td>
                  <td className="p-2 border">{ret.customer?.name ?? "N/A"}</td>
                  <td className="p-2 border">{ret.date}</td>
                  <td className="p-2 border">{ret.total}</td>
                  <td className="p-2 border">
                    <div className="flex justify-center gap-2">
                      <Link
                        to={`/sale-returns/${ret.id}/edit`}
                        className="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600"
                      >
                        Edit
                      </Link>
                      <button
                        onClick={() => handleDelete(ret.id)}
                        className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
