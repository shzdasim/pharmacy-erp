import React from "react";
import { Navigate } from "react-router-dom";
import { useLicense } from "../context/LicenseContext.jsx";

export default function ProtectedRoute({ children }) {
  const token = localStorage.getItem("token");

  // Check authentication first
  if (!token) {
    return <Navigate to="/" replace />;
  }

  // Check license validity
  const { loading, valid } = useLicense();

  // Show nothing while checking license status
  if (loading) {
    return null;
  }

  // Redirect to activation page if license is invalid or missing
  if (!valid) {
    return <Navigate to="/activate" replace />;
  }

  return children;
}
