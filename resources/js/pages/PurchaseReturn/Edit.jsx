import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import PurchaseReturnForm from "./PurchaseReturnForm";
import axios from "axios";
import toast from "react-hot-toast";

export default function EditPurchaseReturn() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [initialData, setInitialData] = useState(null);

  useEffect(() => {
    const fetchReturn = async () => {
      try {
        const res = await axios.get(`/api/purchase-returns/${id}`);
        setInitialData(res.data);
      } catch (err) {
        toast.error("Failed to fetch purchase return data");
      }
    };

    fetchReturn();
  }, [id]);

  const handleSuccess = () => {
    navigate("/purchase-returns");
  };

  if (!initialData) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Edit Purchase Return</h1>
      <PurchaseReturnForm returnId={id} initialData={initialData} onSuccess={handleSuccess} />
    </div>
  );
}
