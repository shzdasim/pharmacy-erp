import { useNavigate } from "react-router-dom";
import PurchaseReturnForm from "./PurchaseReturnForm";

export default function CreatePurchaseReturn() {
  const navigate = useNavigate();

  const handleSuccess = () => {
    navigate("/purchase-returns");
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Create Purchase Return</h1>
      <PurchaseReturnForm onSuccess={handleSuccess} />
    </div>
  );
}
