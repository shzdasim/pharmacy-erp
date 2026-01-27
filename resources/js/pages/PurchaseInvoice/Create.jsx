import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import PurchaseInvoiceForm from "./PurchaseInvoiceForm";
import { usePermissions } from "@/api/usePermissions.js";

export default function CreatePurchaseInvoice() {
  const navigate = useNavigate();
  const { loading: permsLoading, canFor } = usePermissions();
  const can = useMemo(
    () => (typeof canFor === "function" ? canFor("purchase_invoice") : {
      view:false, create:false, update:false, delete:false, import:false, export:false
    }),
    [canFor]
  );

  const handleSubmit = async (payload) => {
    if (!can.create) {
      toast.error("You don't have permission to create purchase invoices.");
      return;
    }
    try {
      const { data } = await axios.post("/api/purchase-invoices", payload);
      toast.success("Purchase invoice created");
      // Navigate to the show page
      navigate(`/purchase-invoices/${data.id}`, { replace: true });
      return data;
    } catch (e) {
      const msg = e?.response?.data?.message || "Create failed";
      toast.error(msg);
      throw e;
    }
  };

  if (permsLoading) return <div className="p-6">Loading…</div>;
  if (!can.create) return <div className="p-6 text-sm text-gray-700">You don't have permission to create purchase invoices.</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Create Purchase Invoice</h1>
      <PurchaseInvoiceForm onSubmit={handleSubmit} />
    </div>
  );
}

