import { useNavigate } from "react-router-dom";
import SaleReturnForm from "./SaleReturnForm";

export default function CreateSaleReturn() {
  const navigate = useNavigate();

  const handleSuccess = () => {
    navigate("/sale-returns");
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Create Sale Return</h1>
      <SaleReturnForm onSuccess={handleSuccess} />
    </div>
  );
}
