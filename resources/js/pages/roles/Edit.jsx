// src/pages/roles/Edit.jsx
import { useEffect, useState } from "react";
import { getRole, updateRole } from "@/api/roles";
import { useNavigate, useParams } from "react-router-dom";
import RoleForm from "./RoleForm.jsx";

export default function EditRole() {
  const { id } = useParams();
  const nav = useNavigate();
  const [initial, setInitial] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data } = await getRole(id);
        // Expecting { id, name, permissions: ["perm.a","perm.b", ...] }
        if (alive) setInitial(data);
      } catch (e) {
        console.error(e);
      }
    })();
    return () => { alive = false; };
  }, [id]);

  const onSubmit = async (payload) => {
    setSubmitting(true);
    try {
      await updateRole(id, payload);
      nav("/roles");
    } finally {
      setSubmitting(false);
    }
  };

  // Don’t render until we have the current role
  if (!initial) return null; // or a spinner

  // key={id} guarantees the form resets if you switch between roles
  return <RoleForm key={id} initial={initial} onSubmit={onSubmit} submitting={submitting} />;
}
