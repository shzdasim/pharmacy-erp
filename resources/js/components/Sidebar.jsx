import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  HomeIcon,
  ClipboardDocumentListIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline";

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { pathname } = useLocation();

  const menu = [
    { name: "Dashboard", path: "/dashboard", icon: <HomeIcon className="w-6 h-6" /> },
    { name: "Suppliers", path: "/suppliers", icon: <ClipboardDocumentListIcon className="w-6 h-6" /> },
    { name: "Customers", path: "/customers", icon: <ClipboardDocumentListIcon className="w-6 h-6" /> },
  ];

  return (
    <div
      className={`h-screen bg-white shadow-md transition-all duration-300 ${
        collapsed ? "w-20" : "w-64"
      }`}
    >
      <div className="flex items-center justify-between p-4 border-b">
        {!collapsed && <span className="text-xl font-bold">Pharmacy ERP</span>}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 rounded hover:bg-gray-100"
        >
          {collapsed ? (
            <ChevronRightIcon className="w-5 h-5" />
          ) : (
            <ChevronLeftIcon className="w-5 h-5" />
          )}
        </button>
      </div>
      <nav className="mt-4">
        {menu.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`flex items-center p-2 mx-2 mt-2 rounded-lg ${
              pathname === item.path ? "bg-blue-100 text-blue-600" : "hover:bg-gray-100"
            }`}
          >
            {item.icon}
            {!collapsed && <span className="ml-3">{item.name}</span>}
          </Link>
        ))}
      </nav>
    </div>
  );
}
