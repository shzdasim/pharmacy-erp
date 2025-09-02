import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";

export default function SaleInvoiceShow() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [inv, setInv] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [printerType, setPrinterType] = useState("a4"); // from Settings

  // Fetch invoice
  useEffect(() => {
    (async () => {
      try {
        const [invRes, setRes] = await Promise.all([
          axios.get(`/api/sale-invoices/${id}`),
          axios.get("/api/settings").catch(() => null),
        ]);
        setInv(invRes.data);
        if (setRes?.data?.printer_type) {
          setPrinterType(String(setRes.data.printer_type).toLowerCase());
        }
      } catch (e) {
        toast.error("Failed to load invoice");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  // After delete: go to previous invoice (by id), else index
  const goToPrevOrIndex = async (deletedId) => {
    try {
      const res = await axios.get("/api/sale-invoices");
      const list = Array.isArray(res.data) ? res.data : [];
      const prev = list
        .filter((x) => Number(x?.id) < Number(deletedId))
        .sort((a, b) => Number(b?.id) - Number(a?.id))[0];

      if (prev?.id) {
        navigate(`/sale-invoices/${prev.id}`);
      } else {
        navigate("/sale-invoices");
      }
    } catch {
      navigate("/sale-invoices");
    }
  };

  const handleDelete = async () => {
    if (!inv) return;
    try {
      setDeleting(true);
      await axios.delete(`/api/sale-invoices/${id}`);
      toast.success("Sale invoice deleted");
      await goToPrevOrIndex(id);
    } catch (e) {
      toast.error("Failed to delete invoice");
    } finally {
      setDeleting(false);
    }
  };

  // Toast-based confirmation
  const confirmDeleteToast = () => {
    const label = inv?.posted_number ? ` ${inv.posted_number}` : "";
    toast(
      (t) => (
        <div className="rounded border bg-white shadow p-3 text-sm max-w-[320px]">
          <div className="font-semibold mb-1">
            Delete this sale invoice{label}?
          </div>
          <div className="text-[12px] text-gray-600 mb-3">
            This action cannot be undone.
          </div>
          <div className="flex gap-2 justify-end">
            <button
              className="px-3 py-1 rounded border text-gray-700"
              onClick={() => toast.dismiss(t.id)}
            >
              Cancel
            </button>
            <button
              className="px-3 py-1 rounded bg-red-600 text-white disabled:opacity-60"
              disabled={deleting}
              onClick={async () => {
                toast.dismiss(t.id);
                await handleDelete();
              }}
            >
              Delete
            </button>
          </div>
        </div>
      ),
      { duration: 10000, id: `confirm-del-${id}` }
    );
  };

  // Open server-rendered print preview (backend chooses template by Settings)
  // ⬇️ replace your current handlePrint with this
const handlePrint = () => {
  if (!id) return;

  // If you serve SPA and Laravel on different origins, set VITE_BACKEND_WEB_BASE.
  // If they are the same origin, keeping it empty will fall back to window.location.origin.
  const WEB_BASE =
    (import.meta.env.VITE_BACKEND_WEB_BASE || "").replace(/\/$/, "") ||
    window.location.origin;

  // Let backend decide A4 vs Thermal by Settings (no ?type= needed)
  const url = `${WEB_BASE}/print/sale-invoices/${id}`;

  const w = window.open(url, "_blank", "noopener,noreferrer");
  if (!w) {
    toast.error("Popup blocked. Allow popups to print.");
    return;
  }
  try {
    w.onload = () => {
      try { w.focus(); w.print(); } catch {}
    };
    const timer = setInterval(() => {
      try {
        if (w.document?.readyState === "complete") {
          w.focus(); w.print(); clearInterval(timer);
        }
      } catch {}
      if (w.closed) clearInterval(timer);
    }, 400);
  } catch {}
};


  // Keyboard shortcuts: Alt+N (new), Alt+B (back), Alt+P (print), Alt+D (delete confirm), Alt+E (edit)
  useEffect(() => {
    const onKey = (e) => {
      if (!e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === "n") {
        e.preventDefault();
        navigate("/sale-invoices/create");
      }
      if (k === "b") {
        e.preventDefault();
        navigate(-1);
      }
      if (k === "p") {
        e.preventDefault();
        handlePrint();
      }
      if (k === "d") {
        e.preventDefault();
        confirmDeleteToast();
      }
      if (k === "e") {
        e.preventDefault();
        navigate(`/sale-invoices/${id}/edit`);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [navigate, inv, deleting, id, printerType]);

  if (loading) return <div className="p-4 text-sm">Loading…</div>;
  if (!inv) return <div className="p-4 text-sm">Invoice not found.</div>;

  const fmt = (v) => ((v ?? "") === "" ? "" : String(v));

  return (
    <div className="p-3 space-y-3">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-table th, .print-table td { border: 1px solid #000; }
        }
      `}</style>

      <h2 className="text-lg font-bold">Sale Invoice</h2>

      {/* Header */}
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
      <div className="no-print flex flex-wrap gap-2 justify-end pt-2">
        <button
          className="bg-red-600 text-white px-4 py-2 rounded text-sm disabled:opacity-60"
          onClick={confirmDeleteToast}
          disabled={deleting}
          title="Alt+D"
        >
          🗑 Delete
        </button>
        <button
          className="bg-yellow-600 text-white px-4 py-2 rounded text-sm"
          onClick={() => navigate(`/sale-invoices/${id}/edit`)}
          title="Alt+E"
        >
          ✏️ Edit Invoice
        </button>
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
          onClick={handlePrint}
          title="Alt+P"
        >
          🖨️ Print Invoice
        </button>
      </div>

      {/* Hidden info about which printer template will be used */}
      <div className="no-print text-[11px] text-gray-500">
        Using printer template: <b>{printerType?.toUpperCase?.() || "A4"}</b> (from Settings)
      </div>
    </div>
  );
}
