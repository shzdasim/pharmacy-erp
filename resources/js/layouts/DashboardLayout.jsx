import { useEffect, useState } from "react";
import axios from "axios";
import { useLocation } from "react-router-dom";
import Sidebar from "../components/Sidebar.jsx";
import Topbar from "../components/Topbar.jsx";
import { Toaster } from "react-hot-toast";

export default function DashboardLayout({ children }) {
  const location = useLocation();

  // Brand from /api/settings
  const [appName, setAppName] = useState("ERP");
  const [logoUrl, setLogoUrl] = useState(null);

  // Fetch once
  useEffect(() => {
    (async () => {
      try {
        const { data } = await axios.get("/api/settings");
        const sn = (data?.store_name || "").trim();
        setAppName(sn || "ERP");
        setLogoUrl(data?.logo_url || null);
      } catch {
        setAppName("ERP");
        setLogoUrl(null);
      }
    })();
  }, []);

  // Page titles
  const titles = {
    "/dashboard": "Dashboard",
    "/profile": "Profile",
    "/suppliers": "Suppliers",
    "/customers": "Customers",
    "/Products": "Products",
    "/categories": "Categories",
    "/brands": "Brands",
    "/purchase-invoices": "Purchase Invoices",
    "/purchase-invoices/create": "Create Purchase Invoice",
    "/purchase-invoices/:id": "View Purchase Invoice",
    "/purchase-invoices/:id/edit": "Edit Purchase Invoice",
    "/purchase-returns": "Purchase Returns",
    "/purchase-returns/create": "Create Purchase Return",
    "/purchase-returns/:id": "View Purchase Return",
    "/purchase-returns/:id/edit": "Edit Purchase Return",
    "/sale-invoices": "Sale Invoices",
    "/sale-invoices/create": "Create Sale Invoice",
    "/sale-invoices/:id": "View Sale Invoice",
    "/sale-invoices/:id/edit": "Edit Sale Invoice",
    "/sale-returns": "Sale Returns",
    "/sale-returns/create": "Create Sale Return",
    "/sale-returns/:id": "View Sale Return",
    "/sale-returns/:id/edit": "Edit Sale Return",
    "/purchase-orders": "Purchase Orders",
    "/settings": "Settings",
  };

  const currentPath = location.pathname;
  const pageTitle = titles[currentPath] || "Dashboard";

  // Set browser tab title with app name
  useEffect(() => {
    document.title = `${pageTitle} - ${appName || "ERP"}`;
  }, [pageTitle, appName]);

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar now shows logo + app name */}
      <Sidebar appName={appName} logoUrl={logoUrl} />

      <div className="flex-1 flex flex-col">
        <Toaster position="top-right" reverseOrder={false} />

        {/* Topbar now shows page title */}
        <Topbar pageTitle={pageTitle} />

        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
