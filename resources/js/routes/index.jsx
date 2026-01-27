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
import ShowPurchaseInvoice from "../pages/PurchaseInvoice/Show.jsx";
import PurchaseReturnsIndex from "../pages/PurchaseReturn/index.jsx";
import CreatePurchaseReturn from "../pages/PurchaseReturn/Create.jsx";
import EditPurchaseReturn from "../pages/PurchaseReturn/Edit.jsx";
import IndexSaleInvoice from "../pages/SaleInvoice/Index.jsx";
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
import CurrentStockReport from "../pages/Reports/CurrentStockReport.jsx";
import StockAdjustmentReport from "../pages/Reports/StockAdjustmentReport.jsx";
import ProductComprehensiveReport from "../pages/Reports/ProductComprehensiveReport.jsx";
import Setting from "../pages/Setting.jsx";
import StockAdjustmentsIndex from "../pages/stock-adjustments/index.jsx";
import CreateStockAdjustment from "../pages/stock-adjustments/Create.jsx";
import EditStockAdjustment from "../pages/stock-adjustments/Edit.jsx";
import SupplierLedgerPage from "../pages/Ledger/SupplierLedgerPage.jsx";
import CustomerLedgerPage from "../pages/Ledger/CustomerLedgerPage.jsx";
import UsersIndex from "../pages/users/index.jsx";
import CreateUser from "../pages/users/Create.jsx";
import EditUser from "../pages/users/Edit.jsx";
import RolesIndex from "../pages/roles/index.jsx";
import CreateRole from "../pages/roles/Create.jsx";
import EditRole from "../pages/roles/Edit.jsx";
import ActivateLicense from "../pages/ActivateLicense.jsx";


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
      <Route
        path="/purchase-invoices/:id"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <ShowPurchaseInvoice />
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
      <Route
      path="reports/current-stock"
      element= {
        <ProtectedRoute>
          <DashboardLayout>
            <CurrentStockReport />
          </DashboardLayout>
        </ProtectedRoute>
      }
      />
      <Route
      path="reports/stock-adjustment"
      element= {
        <ProtectedRoute>
          <DashboardLayout>
            <StockAdjustmentReport />
          </DashboardLayout>
        </ProtectedRoute>
      }
      />
      <Route
      path="reports/product-comprehensive"
      element= {
        <ProtectedRoute>
          <DashboardLayout>
            <ProductComprehensiveReport />
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
      {/* Stock Adjustments */}
      <Route
      path="stock-adjustments"
      element= {
        <ProtectedRoute>
          <DashboardLayout>
            <StockAdjustmentsIndex />
          </DashboardLayout>
        </ProtectedRoute>
      }
      />
      <Route
      path="stock-adjustments/create"
      element= {
        <ProtectedRoute>
          <DashboardLayout>
            <CreateStockAdjustment />
          </DashboardLayout>
        </ProtectedRoute>
      }
      />
      <Route
      path="stock-adjustments/:id/edit"
      element= {
        <ProtectedRoute>
          <DashboardLayout>
            <EditStockAdjustment />
          </DashboardLayout>
        </ProtectedRoute>
      }
      />
      {/* Supplier Ledger */}
      <Route
      path="/supplier-ledger"
      element= {
        <ProtectedRoute>
          <DashboardLayout>
            <SupplierLedgerPage />
          </DashboardLayout>
        </ProtectedRoute>
      }
      />
      {/* Customer Ledger */}
      <Route
      path="/customer-ledger"
      element= {
        <ProtectedRoute>
          <DashboardLayout>
            <CustomerLedgerPage />
          </DashboardLayout>
        </ProtectedRoute>
      }
      />
      {/* Users */}
      <Route
      path="/users"
      element= {
        <ProtectedRoute>
          <DashboardLayout>
            <UsersIndex />
          </DashboardLayout>
        </ProtectedRoute>
      }
      />
      <Route
      path="/users/create"
      element= {
        <ProtectedRoute>
          <DashboardLayout>
            <CreateUser />
          </DashboardLayout>
        </ProtectedRoute>
      }
      />
      <Route
      path="/users/:id/edit"
      element= {
        <ProtectedRoute>
          <DashboardLayout>
            <EditUser />
          </DashboardLayout>
        </ProtectedRoute>
      }
      />
      {/* Roles */}
      <Route
      path="/roles"
      element= {
        <ProtectedRoute>
          <DashboardLayout>
            <RolesIndex />
          </DashboardLayout>
        </ProtectedRoute>
      }
      />
      <Route
      path="/roles/create"
      element= {
        <ProtectedRoute>
          <DashboardLayout>
            <CreateRole />
          </DashboardLayout>
        </ProtectedRoute>
      }
      />
      <Route
      path="/roles/:id/edit"
      element= {
        <ProtectedRoute>
          <DashboardLayout>
            <EditRole />
          </DashboardLayout>
        </ProtectedRoute>
      }
      />
      {/* License Activation - no DashboardLayout */}
      <Route path="/activate" element={<ActivateLicense />} />

        <Route path="/" element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } />

</Routes>
  );
}
