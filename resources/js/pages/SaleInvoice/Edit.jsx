import { useNavigate, useParams } from "react-router-dom";
import SaleInvoiceForm from "./SaleInvoiceForm.jsx";

export default function EditSaleInvoice() {
  const { id } = useParams();
  const navigate = useNavigate();
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Edit Sale Invoice</h1>
      <SaleInvoiceForm saleId={id} onSuccess={() => navigate("/sale-invoices")} />
    </div>
  );
}
