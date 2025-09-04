import { useNavigate } from "react-router-dom";
import PurchaseInvoiceForm from "./PurchaseInvoiceForm";

export default function CreatePurchaseInvoice() {
  const navigate = useNavigate();

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Create Purchase Invoice</h1>
      <PurchaseInvoiceForm onSuccess={() => navigate("/purchase-invoices")} />
    </div>
  );
}
