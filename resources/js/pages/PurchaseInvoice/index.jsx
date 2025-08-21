import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";

export default function PurchaseInvoicesIndex() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    try {
      const res = await axios.get("/api/purchase-invoices");
      setInvoices(res.data);
    } catch (err) {
      toast.error("Failed to fetch purchase invoices");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this invoice?")) return;

    try {
      await axios.delete(`/api/purchase-invoices/${id}`);
      toast.success("Invoice deleted successfully");
      fetchInvoices();
    } catch (err) {
      toast.error("Failed to delete invoice");
    }
  };

  if (loading) return <p>Loading...</p>;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Purchase Invoices</h1>
        <Link
          to="/purchase-invoices/create"
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          + Add Invoice
        </Link>
      </div>

      {invoices.length === 0 ? (
        <p>No invoices found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border border-gray-200">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-2 border">#</th>
                <th className="p-2 border">Invoice No</th>
                <th className="p-2 border">Supplier</th>
                <th className="p-2 border">Date</th>
                <th className="p-2 border">Amount</th>
                <th className="p-2 border">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice, index) => (
                <tr key={invoice.id} className="text-center">
                  <td className="p-2 border">{index + 1}</td>
                  <td className="p-2 border">{invoice.invoice_number}</td>
                  <td className="p-2 border">
                    {invoice.supplier?.name ?? "N/A"}
                  </td>
                  <td className="p-2 border">{invoice.posted_date}</td>
                  <td className="p-2 border">{invoice.total_amount}</td>
                  <td className="p-2 border">
                    <div className="flex justify-center gap-2">
                      <Link
                        to={`/purchase-invoices/${invoice.id}/edit`}
                        className="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600"
                      >
                        Edit
                      </Link>
                      <button
                        onClick={() => handleDelete(invoice.id)}
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
