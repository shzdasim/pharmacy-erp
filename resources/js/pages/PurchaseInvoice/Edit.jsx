import { useNavigate, useParams } from "react-router-dom";
import PurchaseInvoiceForm from "./PurchaseInvoiceForm";

export default function EditPurchaseInvoice() {
  const { id } = useParams();
  const navigate = useNavigate();

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Edit Purchase Invoice</h1>
      <PurchaseInvoiceForm
        invoiceId={id}
        onSuccess={() => navigate("/purchase-invoices")}
      />
    </div>
  );
}
