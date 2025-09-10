import { useEffect, useState } from "react";
import { getUser, updateUser } from "@/api/users";
import { useNavigate, useParams } from "react-router-dom";
import UserForm from "./UserForm.jsx";

export default function EditUser() {
  const { id } = useParams();
  const nav = useNavigate();
  const [initial, setInitial] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await getUser(id);
      setInitial(data);
    })();
  }, [id]);

  const onSubmit = async (payload) => {
    setSubmitting(true);
    try {
      await updateUser(id, payload);
      nav("/users");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="title">Edit User</h1>
      </div>
      {initial && <UserForm onSubmit={onSubmit} initial={initial} submitting={submitting} />}
    </div>
  );
}
