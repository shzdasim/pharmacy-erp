import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import SaleReturnForm from "./SaleReturnForm";

export default function EditSaleReturn() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [initialData, setInitialData] = useState(null);

  useEffect(() => {
    const fetchReturn = async () => {
      try {
        const res = await axios.get(`/api/sale-returns/${id}`);
        setInitialData(res.data);
      } catch (err) {
        toast.error("Failed to fetch sale return");
      }
    };
    fetchReturn();
  }, [id]);

  const handleSuccess = () => {
    navigate("/sale-returns");
  };

  if (!initialData) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Edit Sale Return</h1>
      <SaleReturnForm returnId={id} initialData={initialData} onSuccess={handleSuccess} />
    </div>
  );
}
