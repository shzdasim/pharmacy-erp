import { Navigate } from "react-router-dom";
import { useLicense } from "../context/LicenseContext.jsx";

export default function LicenseGuard({ children }) {
  const { loading, valid } = useLicense();
  if (loading) return null;          // or a spinner
  if (!valid) return <Navigate to="/activate" replace />;
  return children;
}
