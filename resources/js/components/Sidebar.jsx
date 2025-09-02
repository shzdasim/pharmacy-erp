import React, { useState, useRef, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  HomeIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  BuildingStorefrontIcon,
  UserGroupIcon,
  Squares2X2Icon,
  TagIcon,
  CubeIcon,
  DocumentTextIcon,
  FolderMinusIcon,
  DocumentCurrencyDollarIcon,
  DocumentMinusIcon
} from "@heroicons/react/24/outline";

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { pathname } = useLocation();
  const navigate = useNavigate();

  // Menu items
  const menu = [
    { name: "Dashboard", path: "/dashboard", icon: <HomeIcon className="w-6 h-6" /> },
    { name: "Suppliers", path: "/suppliers", icon: <BuildingStorefrontIcon className="w-6 h-6" /> },
    { name: "Customers", path: "/customers", icon: <UserGroupIcon className="w-6 h-6" /> },
    { name: "Categories", path: "/categories", icon: <Squares2X2Icon className="w-6 h-6" /> },
    { name: "Brands", path: "/brands", icon: <TagIcon className="w-6 h-6" /> },
    { name: "Products", path: "/products", icon: <CubeIcon className="w-6 h-6" /> },
    { name: "Purchase Invoice", path: "/purchase-invoices", icon: <DocumentTextIcon className="w-6 h-6" /> },
    { name: "Purchase Return", path: "/purchase-returns", icon: <FolderMinusIcon className="w-6 h-6" /> },
    { name: "Sale Invoice", path: "/sale-invoices", icon: <DocumentCurrencyDollarIcon className="w-6 h-6" /> },
    { name: "Sale Return", path: "/sale-returns", icon: <DocumentMinusIcon className="w-6 h-6" /> },
    { name: "Purchase Orders", path: "/purchase-orders", icon: <DocumentTextIcon className="w-6 h-6" /> }
    

  ];

  // Refs for keyboard focus
  const itemRefs = useRef([]);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  // On pathname change, set focused index
  useEffect(() => {
    const idx = menu.findIndex((item) => item.path === pathname);
    setFocusedIndex(idx);
  }, [pathname]);

  // Focus element on index change
  useEffect(() => {
    if (focusedIndex >= 0 && itemRefs.current[focusedIndex]) {
      itemRefs.current[focusedIndex].focus();
    }
  }, [focusedIndex]);

  // Keyboard navigation
  function handleKeyDown(e) {
    if (menu.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setFocusedIndex((prev) => (prev + 1) % menu.length);
        break;
      case "ArrowUp":
        e.preventDefault();
        setFocusedIndex((prev) => (prev <= 0 ? menu.length - 1 : prev - 1));
        break;
      case "Home":
        e.preventDefault();
        setFocusedIndex(0);
        break;
      case "End":
        e.preventDefault();
        setFocusedIndex(menu.length - 1);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (focusedIndex >= 0) {
          const item = menu[focusedIndex];
          if (item.path) navigate(item.path);
        }
        break;
      default:
        break;
    }
  }

  return (
    <div
      className={`h-screen bg-white shadow-md transition-all duration-300 ${
        collapsed ? "w-20" : "w-64"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        {!collapsed && <span className="text-xl font-bold">Pharmacy ERP</span>}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 rounded hover:bg-gray-100"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRightIcon className="w-5 h-5" />
          ) : (
            <ChevronLeftIcon className="w-5 h-5" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav
        className="mt-4"
        role="list"
        tabIndex={0}
        aria-label="Main navigation"
        onKeyDown={handleKeyDown}
      >
        {menu.map((item, index) => {
          const isActive = pathname === item.path;
          const isFocused = focusedIndex === index;

          return (
            <Link
              key={item.path}
              to={item.path}
              ref={(el) => (itemRefs.current[index] = el)}
              className={`flex items-center p-2 mx-2 mt-2 rounded-lg focus:outline-none ${
                isActive
                  ? "bg-blue-100 text-blue-600"
                  : "hover:bg-gray-100 text-gray-900"
              } ${isFocused && !isActive ? "bg-gray-200 text-gray-900" : ""}`}
              tabIndex={isFocused ? 0 : -1}
              onFocus={() => setFocusedIndex(index)}
              aria-current={isActive ? "page" : undefined}
            >
              {item.icon}
              {!collapsed && <span className="ml-3">{item.name}</span>}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
