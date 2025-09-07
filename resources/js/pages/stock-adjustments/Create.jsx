import { useNavigate } from "react-router-dom";
import StockAdjustmentForm from "./StockAdjustmentForm";

export default function CreateStockAdjustment(){
  const navigate = useNavigate();
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Create Stock Adjustment</h1>
      <StockAdjustmentForm onSuccess={()=>navigate('/stock-adjustments')} />
    </div>
  );
}
