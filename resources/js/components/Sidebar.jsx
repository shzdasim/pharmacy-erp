// src/components/Sidebar.jsx
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
  DocumentMinusIcon,
  TruckIcon,
  ChartBarIcon,
  Cog6ToothIcon,
} from "@heroicons/react/24/outline";

export default function Sidebar({ appName = "ERP", logoUrl = null }) {
  const [collapsed, setCollapsed] = useState(false);
  const { pathname } = useLocation();
  const navigate = useNavigate();

  // Menu (with icons)
  const menu = [
    { name: "Dashboard", path: "/dashboard", icon: <HomeIcon className="w-6 h-6" /> },

    { type: "section", name: "Masters" },
    { name: "Suppliers", path: "/suppliers", icon: <BuildingStorefrontIcon className="w-6 h-6" /> },
    { name: "Customers", path: "/customers", icon: <UserGroupIcon className="w-6 h-6" /> },
    { name: "Categories", path: "/categories", icon: <Squares2X2Icon className="w-6 h-6" /> },
    { name: "Brands", path: "/brands", icon: <TagIcon className="w-6 h-6" /> },
    { name: "Products", path: "/products", icon: <CubeIcon className="w-6 h-6" /> },

    { type: "section", name: "Transactions" },
    { name: "Purchase Invoice", path: "/purchase-invoices", icon: <DocumentTextIcon className="w-6 h-6" /> },
    { name: "Purchase Return", path: "/purchase-returns", icon: <FolderMinusIcon className="w-6 h-6" /> },
    { name: "Sale Invoice", path: "/sale-invoices", icon: <DocumentCurrencyDollarIcon className="w-6 h-6" /> },
    { name: "Sale Return", path: "/sale-returns", icon: <DocumentMinusIcon className="w-6 h-6" /> },
    { name: "Purchase Orders", path: "/purchase-orders", icon: <TruckIcon className="w-6 h-6" /> },

    { type: "section", name: "Reports" },
    { name: "Cost of Sale Report", path: "/reports/cost-of-sale", icon: <ChartBarIcon className="w-6 h-6" /> },
    { name: "Purchase Detail Report", path: "/reports/purchase-detail", icon: <ChartBarIcon className="w-6 h-6" /> },
    { name: "Sale Detail Report", path: "/reports/sale-detail", icon: <ChartBarIcon className="w-6 h-6" /> },

    { type: "section", name: "System" },
    { name: "Settings", path: "/settings", icon: <Cog6ToothIcon className="w-6 h-6" /> },
  ];

  // Keyboard focus handling
  const itemRefs = useRef([]);
  const flatMenu = menu.filter((m) => !m.type);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  useEffect(() => {
    const idx = flatMenu.findIndex(
      (item) => pathname === item.path || pathname.startsWith(item.path + "/")
    );
    setFocusedIndex(idx);
  }, [pathname]);

  useEffect(() => {
    if (focusedIndex >= 0 && itemRefs.current[focusedIndex]) {
      itemRefs.current[focusedIndex].focus();
    }
  }, [focusedIndex]);

  function handleKeyDown(e) {
    if (flatMenu.length === 0) return;
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setFocusedIndex((prev) => (prev + 1) % flatMenu.length);
        break;
      case "ArrowUp":
        e.preventDefault();
        setFocusedIndex((prev) => (prev <= 0 ? flatMenu.length - 1 : prev - 1));
        break;
      case "Home":
        e.preventDefault();
        setFocusedIndex(0);
        break;
      case "End":
        e.preventDefault();
        setFocusedIndex(flatMenu.length - 1);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (focusedIndex >= 0) navigate(flatMenu[focusedIndex].path);
        break;
      default:
        break;
    }
  }

  const isActive = (path) => pathname === path || pathname.startsWith(path + "/");
  const linkClass = (path) =>
    `flex items-center p-2 mx-2 mt-2 rounded-lg transition focus:outline-none ${
      isActive(path) ? "bg-blue-100 text-blue-600" : "hover:bg-gray-100 text-gray-900"
    }`;

  const initial = (appName || "ERP").trim().charAt(0).toUpperCase();

  return (
    <aside
      className={`bg-white shadow-md transition-[width] duration-300 ${
        collapsed ? "w-20" : "w-64"
      } h-screen overflow-hidden`} // prevent page scroll from sidebar
    >
      {/* Inner column wrapper ensures proper overflow behavior */}
      <div className="flex flex-col h-full min-h-0">
        {/* Header (brand + collapse) */}
        <div className="flex items-center justify-between p-4 border-b shrink-0">
          <div className="flex items-center gap-2 overflow-hidden">
            {logoUrl ? (
              <img src={logoUrl} alt={appName} className="h-8 w-8 object-contain rounded" />
            ) : (
              <div className="h-8 w-8 rounded bg-blue-600 text-white flex items-center justify-center text-sm font-semibold">
                {initial}
              </div>
            )}
            {!collapsed && <span className="text-lg font-bold truncate">{appName || "ERP"}</span>}
          </div>
          <button
            onClick={() => setCollapsed((v) => !v)}
            className="p-1 rounded hover:bg-gray-100"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRightIcon className="w-5 h-5" /> : <ChevronLeftIcon className="w-5 h-5" />}
          </button>
        </div>

        {/* Scrollable NAV ONLY (so the whole page doesn't scroll) */}
        <nav
          className="flex-1 overflow-y-auto min-h-0 mt-2"
          role="navigation"
          tabIndex={0}
          aria-label="Main navigation"
          onKeyDown={handleKeyDown}
        >
          {menu.map((item, i) => {
            if (item.type === "section") {
              return (
                <div key={`sec-${item.name}`} className={`px-3 ${collapsed ? "mt-4" : "pt-3 pb-1 mt-2"}`}>
                  {!collapsed && (
                    <div className="text-xs uppercase tracking-wider text-gray-400">{item.name}</div>
                  )}
                </div>
              );
            }

            const focusIdx = flatMenu.findIndex((fm) => fm.path === item.path);
            const isFocused = focusedIndex === focusIdx;

            return (
              <Link
                key={item.path}
                to={item.path}
                ref={(el) => (itemRefs.current[focusIdx] = el)}
                className={`${linkClass(item.path)} ${
                  isFocused && !isActive(item.path) ? "bg-gray-200" : ""
                }`}
                tabIndex={isFocused ? 0 : -1}
                onFocus={() => setFocusedIndex(focusIdx)}
                aria-current={isActive(item.path) ? "page" : undefined}
                title={collapsed ? item.name : undefined}
              >
                {item.icon}
                {!collapsed && <span className="ml-3">{item.name}</span>}
              </Link>
            );
          })}

          {/* extra bottom spacer so last item isn't hidden under screen edge */}
          <div className="h-4" />
        </nav>
      </div>
    </aside>
  );
}
