import { useState } from "react";
import { createRole } from "@/api/roles";
import { useNavigate } from "react-router-dom";
import RoleForm from "./RoleForm.jsx";

export default function CreateRole() {
  const nav = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (payload) => {
    setSubmitting(true);
    try {
      await createRole(payload);
      nav("/roles");
    } finally {
      setSubmitting(false);
    }
  };

  return <RoleForm onSubmit={onSubmit} submitting={submitting} />;
}
