import { useNavigate, useParams } from "react-router-dom";
import StockAdjustmentForm from "./StockAdjustmentForm";

export default function EditStockAdjustment(){
  const { id } = useParams();
  const navigate = useNavigate();
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Edit Stock Adjustment</h1>
      <StockAdjustmentForm adjustmentId={id} onSuccess={()=>navigate('/stock-adjustments')} />
    </div>
  );
}
