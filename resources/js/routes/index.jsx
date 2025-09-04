import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Login from "../pages/Login";
import DashboardLayout from "../layouts/DashboardLayout.jsx";
import ProtectedRoute from "../components/ProtectedRoute.jsx";
import Profile from "../pages/Profile.jsx";
import Suppliers from "../pages/Suppliers.jsx";
import Customers from "../pages/Customers.jsx";
import Categories from "../pages/Categories.jsx";
import Brands from "../pages/Brands.jsx";
import ProductsIndex from "../pages/Products/index.jsx";
import CreateProduct from "../pages/Products/Create.jsx";
import EditProduct from "../pages/Products/Edit.jsx";
import PurchaseInvoicesIndex from "../pages/PurchaseInvoice/index.jsx";
import CreatePurchaseInvoice from "../pages/PurchaseInvoice/Create.jsx";
import EditPurchaseInvoice from "../pages/PurchaseInvoice/Edit.jsx";
import PurchaseReturnsIndex from "../pages/PurchaseReturn/index.jsx";
import CreatePurchaseReturn from "../pages/PurchaseReturn/Create.jsx";
import EditPurchaseReturn from "../pages/PurchaseReturn/Edit.jsx";
import IndexSaleInvoice from "../pages/SaleInvoice/index.jsx";
import CreateSaleInvoice from "../pages/SaleInvoice/Create.jsx";
import EditSaleInvoice from "../pages/SaleInvoice/Edit.jsx";
import ShowSaleInvoice from "../pages/SaleInvoice/Show.jsx";
import IndexSaleReturn from "../pages/SaleReturn/Index.jsx";
import CreateSaleReturn from "../pages/SaleReturn/Create.jsx";
import EditSaleReturn from "../pages/SaleReturn/Edit.jsx";
import PurchaseOrder from "../pages/PurchaseOrder.jsx";
import Dashboard from "../pages/Dashboard.jsx";
import CostOfSaleReport from "../pages/Reports/CostOfSaleReport.jsx";
import PurchaseDetailReport from "../pages/Reports/PurchaseDetailReport.jsx";
import SaleDetailReport from "../pages/Reports/SaleDetailReport.jsx";
import Setting from "../pages/Setting.jsx";

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
          <Dashboard />
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
      {/* Purchase Invoices */}
      <Route
        path="/purchase-invoices"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <PurchaseInvoicesIndex />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/purchase-invoices/create"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <CreatePurchaseInvoice />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/purchase-invoices/:id/edit"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <EditPurchaseInvoice />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
      {/* Purchase Returns */}
      <Route
        path="/purchase-returns"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <PurchaseReturnsIndex />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/purchase-returns/create"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <CreatePurchaseReturn />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/purchase-returns/:id/edit"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <EditPurchaseReturn />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
      {/* Sale Invoice */}
      <Route 
      path="sale-invoices"
      element={
        <ProtectedRoute>
          <DashboardLayout>
            <IndexSaleInvoice />
          </DashboardLayout>
        </ProtectedRoute>
      }
      />
      <Route 
      path="sale-invoices/create"
      element={
        <ProtectedRoute>
          <DashboardLayout>
            <CreateSaleInvoice />
          </DashboardLayout>
        </ProtectedRoute>
      }
      />
      <Route
      path="sale-invoices/:id/edit"
      element={
        <ProtectedRoute>
          <DashboardLayout>
            <EditSaleInvoice />
          </DashboardLayout>
        </ProtectedRoute>
      }
      />
      <Route 
      path="sale-invoices/:id"
      element={
        <ProtectedRoute>
          <DashboardLayout>
            <ShowSaleInvoice />
          </DashboardLayout>
        </ProtectedRoute>
      }
      />
      {/* Sale Returns */}
      <Route
      path="sale-returns"
      element= {
        <ProtectedRoute>
          <DashboardLayout>
            <IndexSaleReturn />
          </DashboardLayout>
        </ProtectedRoute>
      }
      />
      <Route
      path="sale-returns/create"
      element= {
        <ProtectedRoute>
          <DashboardLayout>
            <CreateSaleReturn />
          </DashboardLayout>
        </ProtectedRoute>
      }
      />
      <Route
      path="sale-returns/:id/edit"
      element= {
        <ProtectedRoute>
          <DashboardLayout>
            <EditSaleReturn />
          </DashboardLayout>
        </ProtectedRoute>
      }
      />
      {/* Purchase Orders */}
      <Route
      path="purchase-orders"
      element= {
        <ProtectedRoute>
          <DashboardLayout>
            <PurchaseOrder />
          </DashboardLayout>
        </ProtectedRoute>
      }
      />

      { /* Reports */}
      <Route
      path="reports/cost-of-sale"
      element= {
        <ProtectedRoute>
          <DashboardLayout>
            <CostOfSaleReport />
          </DashboardLayout>
        </ProtectedRoute>
      }
      />
      <Route
      path="reports/purchase-detail"
      element= {
        <ProtectedRoute>
          <DashboardLayout>
            <PurchaseDetailReport />
          </DashboardLayout>
        </ProtectedRoute>
      }
      />
      <Route
      path="reports/sale-detail"
      element= {
        <ProtectedRoute>
          <DashboardLayout>
            <SaleDetailReport />
          </DashboardLayout>
        </ProtectedRoute>
      }
      />
      {/* Settings */}
      <Route
      path="settings"
      element= {
        <ProtectedRoute>
          <DashboardLayout>
            <Setting />
          </DashboardLayout>
        </ProtectedRoute>
      }
      />
  

</Routes>
  );
}
