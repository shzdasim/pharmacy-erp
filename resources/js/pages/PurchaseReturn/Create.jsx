import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import PurchaseReturnForm from "./PurchaseReturnForm";
import { usePermissions } from "@/api/usePermissions.js";

export default function CreatePurchaseReturn() {
  const navigate = useNavigate();
  const { loading: permsLoading, canFor } = usePermissions();
  const can = useMemo(
    () => (typeof canFor === "function" ? canFor("purchase-return") : {
      view:false, create:false, update:false, delete:false, import:false, export:false
    }),
    [canFor]
  );

  const onSubmit = async (payload) => {
    if (!can.create) {
      toast.error("You don't have permission to create purchase returns.");
      return;
    }
    try {
      const { data } = await axios.post("/api/purchase-returns", payload);
      toast.success("Purchase return created");
      navigate("/purchase-returns");
      return data;
    } catch (e) {
      const msg = e?.response?.data?.message || "Create failed";
      toast.error(msg);
    }
  };

  if (permsLoading) return <div className="p-6">Loading…</div>;
  if (!can.create) return <div className="p-6 text-sm text-gray-700">You don’t have permission to create purchase returns.</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Create Purchase Return</h1>
      <PurchaseReturnForm onSubmit={onSubmit} onSuccess={() => navigate("/purchase-returns")} />
    </div>
  );
}
