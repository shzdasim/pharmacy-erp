import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import PurchaseInvoiceForm from "./PurchaseInvoiceForm";
import { usePermissions, Guard } from "@/api/usePermissions.js";

export default function EditPurchaseInvoice() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { loading: permsLoading, canFor } = usePermissions();
  const can = useMemo(
    () => (typeof canFor === "function" ? canFor("purchase_invoice") : {
      view:false, create:false, update:false, delete:false, import:false, export:false
    }),
    [canFor]
  );

  const [initial, setInitial] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchErr, setFetchErr] = useState(null);

  useEffect(() => { document.title = "Edit Purchase Invoice - Pharmacy ERP"; }, []);

  useEffect(() => {
    if (permsLoading || !can.view) return;
    (async () => {
      try {
        setLoading(true);
        const { data } = await axios.get(`/api/purchase-invoices/${id}`);
        setInitial(data);
        setFetchErr(null);
      } catch (e) {
        const status = e?.response?.status;
        if (status === 403) setFetchErr("You don't have permission to view this invoice.");
        else if (status === 404) setFetchErr("Invoice not found.");
        else setFetchErr("Failed to load invoice.");
      } finally {
        setLoading(false);
      }
    })();
  }, [id, permsLoading, can.view]);

  const onSubmit = async (payload) => {
    if (!can.update) {
      toast.error("You don't have permission to update purchase invoices.");
      return;
    }
    try {
      const { data } = await axios.post(`/api/purchase-invoices/${id}?_method=PUT`, payload);
      toast.success("Purchase invoice updated");
      navigate(`/purchase-invoices/${id}`);
      return data;
    } catch (e) {
      const msg = e?.response?.data?.message || "Update failed";
      toast.error(msg);
    }
  };

  if (permsLoading) return <div className="p-6">Loading…</div>;
  if (!can.view) return <div className="p-6 text-sm text-gray-700">You don’t have permission to view purchase invoices.</div>;
  if (loading) return <div className="p-6">Loading invoice…</div>;
  if (fetchErr) return <div className="p-6 text-red-600">{fetchErr}</div>;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Edit Purchase Invoice</h1>
        <Link to="/purchase-invoices" className="text-blue-600 hover:underline">← Back</Link>
      </div>

      <Guard when={can.update}>
        <PurchaseInvoiceForm
          invoiceId={id}
          initialData={initial}
          onSubmit={onSubmit}
          onSuccess={() => navigate(`/purchase-invoices/${id}`)}
        />
      </Guard>
      {!can.update && <div className="text-sm text-gray-700">You don’t have permission to update purchase invoices.</div>}
    </div>
  );
}
