import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Login from "../pages/Login";
import DashboardLayout from "../layouts/ DashboardLayout.jsx";
import ProtectedRoute from "../components/ProtectedRoute.jsx";

function DashboardHome() {
  return <h1 className="text-2xl font-bold">Welcome to the Dashboard</h1>;
}

export default function AppRoutes() {
  return (
      <Routes>
        {/* Public */}
        <Route path="/" element={<Login />} />

         {/* Protected Routes */}
  <Route
    path="/dashboard"
    element={
      <ProtectedRoute>
        <DashboardLayout>
          <DashboardHome />
        </DashboardLayout>
      </ProtectedRoute>
    }
  />

  <Route
    path="/profile"
    element={
      <ProtectedRoute>
        <DashboardLayout>
          <h1 className="text-xl font-bold">Profile Page</h1>
        </DashboardLayout>
      </ProtectedRoute>
    }
  />
</Routes>
  );
}
