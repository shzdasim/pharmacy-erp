import { useNavigate } from "react-router-dom";
import SaleInvoiceForm from "./SaleInvoiceForm.jsx";

export default function CreateSaleInvoice() {
  const navigate = useNavigate();
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Create Sale Invoice</h1>
      <SaleInvoiceForm onSuccess={() => navigate("/sale-invoices")} />
    </div>
  );
}
