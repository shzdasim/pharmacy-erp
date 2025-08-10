import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import Sidebar from "../components/Sidebar.jsx";
import Topbar from "../components/Topbar.jsx";

export default function DashboardLayout({ children }) {
  const location = useLocation();

  useEffect(() => {
    // Map URL path to page titles
    const titles = {
      "/dashboard": "Dashboard",
      "/profile": "Profile",
      "/suppliers": "Suppliers",
    };

    const currentPath = location.pathname;
    const pageTitle = titles[currentPath] || "Pharmacy ERP";
    document.title = `${pageTitle} - Pharmacy ERP`;
  }, [location.pathname]);

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Topbar />
        <main className="p-6 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
