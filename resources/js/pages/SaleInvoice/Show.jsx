import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";

export default function SaleInvoiceShow() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [inv, setInv] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        // Expect API to return invoice with items + customer (like your index/show uses)
        const res = await axios.get(`/api/sale-invoices/${id}`);
        setInv(res.data);
      } catch (e) {
        // optionally toast
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e) => {
      const k = e.key.toLowerCase();
      if (!e.altKey) return;
      if (k === "n") { e.preventDefault(); navigate("/sale-invoices/create"); }
      if (k === "b") { e.preventDefault(); navigate(-1); }
      if (k === "p") { e.preventDefault(); window.print(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [navigate]);

  if (loading) return <div className="p-4 text-sm">Loading…</div>;
  if (!inv) return <div className="p-4 text-sm">Invoice not found.</div>;

  const fmt = (v) => (v ?? "") === "" ? "" : String(v);

  return (
    <div className="p-3 space-y-3">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-table th, .print-table td { border: 1px solid #000; }
        }
      `}</style>

      <h2 className="text-lg font-bold">Sale Invoice</h2>

      {/* Header (read-only) */}
      <table className="w-full border-collapse text-xs">
        <tbody>
          <tr>
            <td className="border p-1 w-28">
              <div className="text-[10px]">Posted Number</div>
              <div className="font-semibold">{fmt(inv.posted_number)}</div>
            </td>
            <td className="border p-1 w-32">
              <div className="text-[10px]">Date</div>
              <div>{fmt(inv.date)}</div>
            </td>
            <td className="border p-1 w-[28%]">
              <div className="text-[10px]">Customer</div>
              <div>{inv.customer?.name ?? inv.customer_id}</div>
            </td>
            <td className="border p-1 w-[22%]">
              <div className="text-[10px]">Doctor Name</div>
              <div>{fmt(inv.doctor_name)}</div>
            </td>
            <td className="border p-1 w-[22%]">
              <div className="text-[10px]">Patient Name</div>
              <div>{fmt(inv.patient_name)}</div>
            </td>
          </tr>
          <tr>
            <td className="border p-1" colSpan={5}>
              <div className="text-[10px]">Remarks</div>
              <div>{fmt(inv.remarks)}</div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Items */}
      <div>
        <h3 className="text-xs font-bold mb-1">Items</h3>
        <table className="w-full border-collapse text-[11px] print-table">
          <thead className="bg-gray-100">
            <tr>
              <th className="border p-1">#</th>
              <th className="border p-1 text-left">Product</th>
              <th className="border p-1">PSize</th>
              <th className="border p-1">Batch</th>
              <th className="border p-1">Expiry</th>
              <th className="border p-1">Qty</th>
              <th className="border p-1">Price</th>
              <th className="border p-1">Disc%</th>
              <th className="border p-1">Sub Total</th>
            </tr>
          </thead>
          <tbody>
            {(inv.items || []).map((it, i) => (
              <tr key={i} className="text-center">
                <td className="border p-1">{i + 1}</td>
                <td className="border p-1 text-left">
                  {it.product?.name ?? it.product_id}
                </td>
                <td className="border p-1">{fmt(it.pack_size)}</td>
                <td className="border p-1">{fmt(it.batch_number)}</td>
                <td className="border p-1">{fmt(it.expiry)}</td>
                <td className="border p-1">{fmt(it.quantity)}</td>
                <td className="border p-1">{fmt(it.price)}</td>
                <td className="border p-1">{fmt(it.item_discount_percentage)}</td>
                <td className="border p-1">{fmt(it.sub_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer totals */}
      <table className="w-full border-collapse text-xs">
        <tbody>
          <tr>
            <td className="border p-1 w-1/8">
              <div className="text-[10px]">Tax %</div>
              <div>{fmt(inv.tax_percentage)}</div>
            </td>
            <td className="border p-1 w-1/8">
              <div className="text-[10px]">Tax Amount</div>
              <div>{fmt(inv.tax_amount)}</div>
            </td>
            <td className="border p-1 w-1/8">
              <div className="text-[10px]">Discount %</div>
              <div>{fmt(inv.discount_percentage)}</div>
            </td>
            <td className="border p-1 w-1/8">
              <div className="text-[10px]">Discount Amount</div>
              <div>{fmt(inv.discount_amount)}</div>
            </td>
            <td className="border p-1 w-1/8">
              <div className="text-[10px]">Gross Amount</div>
              <div>{fmt(inv.gross_amount)}</div>
            </td>
            <td className="border p-1 w-1/8">
              <div className="text-[10px]">Total</div>
              <div className="font-semibold">{fmt(inv.total)}</div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Actions */}
      <div className="no-print flex gap-2 justify-end pt-2">
        <button
          className="bg-blue-600 text-white px-4 py-2 rounded text-sm"
          onClick={() => navigate("/sale-invoices/create")}
          title="Alt+N"
        >
          + Add New Invoice
        </button>
        <button
          className="bg-gray-500 text-white px-4 py-2 rounded text-sm"
          onClick={() => navigate(-1)}
          title="Alt+B"
        >
          ← Go Back
        </button>
        <button
          className="bg-green-600 text-white px-4 py-2 rounded text-sm"
          onClick={() => window.print()}
          title="Alt+P"
        >
          🖨️ Print Invoice
        </button>
      </div>
    </div>
  );
}
