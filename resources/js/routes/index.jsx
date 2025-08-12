import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Login from "../pages/Login";
import DashboardLayout from "../layouts/ DashboardLayout.jsx";
import ProtectedRoute from "../components/ProtectedRoute.jsx";
import Profile from "../pages/Profile.jsx";
import Suppliers from "../pages/Suppliers.jsx";
import Customers from "../pages/Customers.jsx";
import Categories from "../pages/Categories.jsx";
import Brands from "../pages/Brands.jsx";
import ProductsIndex from "../pages/Products/index.jsx";
import CreateProduct from "../pages/Products/Create.jsx";
import EditProduct from "../pages/Products/Edit.jsx";

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
          <Profile />
        </DashboardLayout>
      </ProtectedRoute>
    }
  />
  <Route
    path="/suppliers"
    element={
      <ProtectedRoute>
        <DashboardLayout>
          <Suppliers />
        </DashboardLayout>
      </ProtectedRoute>
    }
  />
  <Route
    path="/customers"
    element={
      <ProtectedRoute>
        <DashboardLayout>
          <Customers />
        </DashboardLayout>
      </ProtectedRoute>
    }
  />

  <Route
    path="/categories"
    element={
      <ProtectedRoute>
        <DashboardLayout>
          <Categories />
        </DashboardLayout>
      </ProtectedRoute>
    }
  />

  <Route
    path="/brands"
    element={
      <ProtectedRoute>
        <DashboardLayout>
          <Brands />
        </DashboardLayout>
      </ProtectedRoute>
    }
  />
  <Route
  path="/products"
  element={
    <ProtectedRoute>
      <DashboardLayout>
        <ProductsIndex />
      </DashboardLayout>
    </ProtectedRoute>
  }
/>

<Route
  path="/products/create"
  element={
    <ProtectedRoute>
      <DashboardLayout>
        <CreateProduct />
      </DashboardLayout>
    </ProtectedRoute>
  }
/>

<Route
  path="/products/:id/edit"
  element={
    <ProtectedRoute>
      <DashboardLayout>
        <EditProduct />
      </DashboardLayout>
    </ProtectedRoute>
  }
/>

</Routes>
  );
}
