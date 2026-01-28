// src/components/Sidebar.jsx
import React, { useState, useRef, useEffect, useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  HomeIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  BuildingStorefrontIcon,
  UsersIcon,
  Squares2X2Icon,
  TagIcon,
  CubeIcon,
  ClipboardDocumentListIcon,
  ArrowUturnLeftIcon,
  DocumentCurrencyDollarIcon,
  ArrowUturnDownIcon,
  ClipboardDocumentCheckIcon,
  ArrowsRightLeftIcon,
  BanknotesIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  UserGroupIcon,
  KeyIcon,
} from "@heroicons/react/24/outline";
import { usePermissions } from "@/api/usePermissions";

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const { loading: permsLoading, has } = usePermissions();

  const brandName = "Karobar App";
  const logoCandidates = ["/storage/logos/logo.png", "/logo.png"];

  const rawMenu = useMemo(
    () => [
      { name: "Dashboard", path: "/dashboard", icon: <HomeIcon className="w-6 h-6" /> },

      { type: "section", name: "Masters" },
      { name: "Suppliers",  path: "/suppliers",  icon: <BuildingStorefrontIcon className="w-6 h-6" />, perm: "supplier.view" },
      { name: "Customers",  path: "/customers",  icon: <UsersIcon className="w-6 h-6" />, perm: "customer.view" },
      { name: "Categories", path: "/categories", icon: <Squares2X2Icon className="w-6 h-6" />, perm: "category.view" },
      { name: "Brands",     path: "/brands",     icon: <TagIcon className="w-6 h-6" />, perm: "brand.view" },
      { name: "Products",   path: "/products",   icon: <CubeIcon className="w-6 h-6" />, perm: "product.view" },

      { type: "section", name: "Transactions" },
      { name: "Purchase Invoice",  path: "/purchase-invoices",  icon: <ClipboardDocumentListIcon className="w-6 h-6" />, perm: "purchase-invoice.view" },
      { name: "Purchase Return",   path: "/purchase-returns",   icon: <ArrowUturnLeftIcon className="w-6 h-6" />, perm: "purchase-return.view" },
      { name: "Sale Invoice",      path: "/sale-invoices",      icon: <DocumentCurrencyDollarIcon className="w-6 h-6" />, perm: "sale-invoice.view" },
      { name: "Sale Return",       path: "/sale-returns",       icon: <ArrowUturnDownIcon className="w-6 h-6" />, perm: "sale-return.view" },
      { name: "Purchase Orders",   path: "/purchase-orders",    icon: <ClipboardDocumentCheckIcon className="w-6 h-6" />, perm: "purchase-order.view" },
      { name: "Stock Adjustments", path: "/stock-adjustments",  icon: <ArrowsRightLeftIcon className="w-6 h-6" />, perm: "stock-adjustment.view" },

      { type: "section", name: "Ledger" },
      { name: "Supplier Ledger", path: "/supplier-ledger", icon: <BanknotesIcon className="w-6 h-6" />, perm: "ledger.supplier.view" },
      { name: "Customer Ledger", path: "/customer-ledger", icon: <BanknotesIcon className="w-6 h-6" />, perm: "ledger.customer.view" },

      { type: "section", name: "Reports" },
      { name: "Cost of Sale Report",        path: "/reports/cost-of-sale",        icon: <ChartBarIcon className="w-6 h-6" />, perm: "report.cost-of-sale.view" },
      { name: "Purchase Detail Report",     path: "/reports/purchase-detail",     icon: <ChartBarIcon className="w-6 h-6" />, perm: "report.purchase-detail.view" },
      { name: "Sale Detail Report",         path: "/reports/sale-detail",         icon: <ChartBarIcon className="w-6 h-6" />, perm: "report.sale-detail.view" },
      { name: "Current Stock Report",       path: "/reports/current-stock",       icon: <CubeIcon className="w-6 h-6" />, perm: "report.current-stock.view" },
      { name: "Stock Adjustment Report",    path: "/reports/stock-adjustment",    icon: <ArrowsRightLeftIcon className="w-6 h-6" />, perm: "report.stock-adjustment.view" },
      { name: "Product Comprehensive",      path: "/reports/product-comprehensive", icon: <ChartBarIcon className="w-6 h-6" />, perm: "report.product-comprehensive.view" },

      { type: "section", name: "System" },
      { name: "Settings", path: "/settings", icon: <Cog6ToothIcon className="w-6 h-6" />, perm: "settings.view" },
      { name: "Users",    path: "/users",    icon: <UserGroupIcon className="w-6 h-6" />, perm: "user.view" },
      { name: "Roles",    path: "/roles",    icon: <KeyIcon className="w-6 h-6" />, perm: "role.view" },
    ],
    []
  );

  const menu = useMemo(() => {
    const visible = [];
    for (let i = 0; i < rawMenu.length; i++) {
      const it = rawMenu[i];
      if (it.type === "section") { visible.push(it); continue; }
      const allowed = it.perm ? (!permsLoading && has(it.perm)) : true;
      if (allowed) visible.push(it);
    }
    const cleaned = [];
    for (let i = 0; i < visible.length; i++) {
      const it = visible[i];
      if (it.type === "section") {
        let keep = false;
        for (let j = i + 1; j < visible.length; j++) {
          if (!visible[j].type) { keep = true; break; }
          if (visible[j].type === "section") break;
        }
        if (keep) cleaned.push(it);
      } else cleaned.push(it);
    }
    if (cleaned.length && cleaned[cleaned.length - 1].type === "section") cleaned.pop();
    return cleaned;
  }, [rawMenu, permsLoading, has]);

  const itemRefs = useRef([]);
  const flatMenu = useMemo(() => menu.filter((m) => !m.type), [menu]);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  useEffect(() => {
    const idx = flatMenu.findIndex(
      (item) => pathname === item.path || pathname.startsWith(item.path + "/")
    );
    setFocusedIndex(idx);
  }, [pathname, flatMenu]);

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
        setFocusedIndex((p) => (p + 1) % flatMenu.length);
        break;
      case "ArrowUp":
        e.preventDefault();
        setFocusedIndex((p) => (p <= 0 ? flatMenu.length - 1 : p - 1));
        break;
      case "Home":
        e.preventDefault(); setFocusedIndex(0); break;
      case "End":
        e.preventDefault(); setFocusedIndex(flatMenu.length - 1); break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (focusedIndex >= 0) navigate(flatMenu[focusedIndex].path);
        break;
      default: break;
    }
  }

  const isActive = (path) => pathname === path || pathname.startsWith(path + "/");

  const widthCls = collapsed ? "w-20" : "w-64";

  // Floating shell
  const shell =
    "relative h-screen px-3 py-3 " +
    "bg-transparent";

  const card =
    "relative flex h-full flex-col rounded-2xl " +
    "bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm ring-1 ring-gray-200/60 dark:ring-white/10 shadow-xl " +
    "transition-[width] duration-300 overflow-hidden " + widthCls;

  // Scroll shadows (optimized with simpler gradients for better performance)
  const scrollShadow =
    "before:pointer-events-none before:content-[''] before:absolute before:left-0 before:right-0 before:top-[64px] before:h-4 before:bg-gradient-to-b before:from-white/50 before:to-transparent dark:before:from-slate-800/50 dark:before:to-transparent " +
    "after:pointer-events-none after:content-[''] after:absolute after:left-0 after:right-0 after:bottom-[56px] after:h-4 after:bg-gradient-to-t after:from-white/50 after:to-transparent dark:after:from-slate-800/50 dark:after:to-transparent";

  // Item styles
  const itemBase =
    "group relative mx-2 mt-2 flex items-center gap-3 rounded-xl px-3 py-2 text-gray-900 dark:text-gray-100 " +
    "hover:translate-y-[-2px] hover:bg-white/80 dark:hover:bg-slate-700/80 hover:shadow-md transition focus:outline-none " +
    "focus:ring-2 focus:ring-blue-400/60 focus:ring-offset-2 focus:ring-offset-transparent";
  const itemActive = "bg-white dark:bg-slate-700 shadow-md ring-1 ring-blue-200/70 dark:ring-blue-800/50";
  const leftRail =
    "absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-full transition-all";

  // Custom thin scrollbar (WebKit) – safe fallback elsewhere
  const scrollAreaCls =
    "flex-1 overflow-y-auto min-h-0 mt-2 pb-4 " +
    "[&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full " +
    "[&::-webkit-scrollbar-thumb]:bg-gray-300/70 hover:[&::-webkit-scrollbar-thumb]:bg-gray-400/70 " +
    "[&::-webkit-scrollbar-track]:bg-transparent";

  return (
    <aside className={shell}>
      <div className={`${card} ${scrollShadow}`}>
        {/* Sticky header */}
        <div className="sticky top-0 z-10 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-b border-gray-200/60 dark:border-white/10 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 overflow-hidden">
              <picture>
                {logoCandidates.map((src) => (
                  <img
                    key={src}
                    src={src}
                    alt={brandName}
                    className="h-10 w-10 object-contain rounded hidden"
                    onLoad={(e) => {
                      const imgs = e.currentTarget.parentElement.querySelectorAll("img");
                      imgs.forEach((im) => (im.style.display = "none"));
                      e.currentTarget.style.display = "block";
                    }}
                  />
                ))}
              </picture>
              {!collapsed && <span className="text-base font-semibold truncate text-gray-900 dark:text-gray-100">{brandName}</span>}
            </div>
          </div>
        </div>

        {/* Scrollable NAV */}
        <nav
          className={scrollAreaCls}
          role="navigation"
          tabIndex={0}
          aria-label="Main navigation"
          onKeyDown={handleKeyDown}
        >
          {menu.map((item, i) => {
            if (item.type === "section") {
              return (
                <div key={`sec-${item.name}-${i}`} className={`px-4 ${collapsed ? "mt-5" : "pt-4 pb-1 mt-3"}`}>
                  {!collapsed && (
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                      {item.name}
                    </div>
                  )}
                </div>
              );
            }

            const focusIdx = flatMenu.findIndex((fm) => fm.path === item.path);
            const active = isActive(item.path);

            return (
              <Link
                key={item.path}
                to={item.path}
                ref={(el) => (itemRefs.current[focusIdx] = el)}
                className={[
                  itemBase,
                  active ? itemActive : "hover:ring-1 hover:ring-gray-200/70",
                ].join(" ")}
                tabIndex={focusedIndex === focusIdx ? 0 : -1}
                onFocus={() => setFocusedIndex(focusIdx)}
                aria-current={active ? "page" : undefined}
                title={collapsed ? item.name : undefined}
              >
                {/* active left rail */}
                <span
                  className={`${leftRail} ${active ? "bg-blue-500 w-1.5 opacity-100" : "bg-transparent w-0 opacity-0"}`}
                />
                <span
                  className={[
                    "shrink-0",
                    active ? "text-blue-600 dark:text-blue-400" : "text-gray-700 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-blue-400",
                  ].join(" ")}
                >
                  {item.icon}
                </span>

                {/* Label with smart reveal:
                   - Shown when expanded
                   - In collapsed mode: hidden but slides in on hover to hint discoverability */}
                <span
                  className={[
                    "whitespace-nowrap",
                    collapsed
                      ? "pointer-events-none select-none translate-x-2 opacity-0 group-hover:opacity-100 group-hover:translate-x-0 transition"
                      : "",
                    active ? "text-blue-700 dark:text-blue-300 font-medium" : "text-gray-900 dark:text-gray-100",
                  ].join(" ")}
                >
                  {!collapsed && item.name}
                  {collapsed && <span className="sr-only">{item.name}</span>}
                </span>
              </Link>
            );
          })}
          <div className="h-2" />
        </nav>

        {/* Sticky footer (collapse/expand) */}
        <div className="sticky bottom-0 z-10 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-t border-gray-200/60 dark:border-white/10 px-2 py-2">
          <button
            onClick={() => setCollapsed((v) => !v)}
            className="w-full flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-white dark:hover:bg-slate-700 hover:shadow focus:outline-none focus:ring-2 focus:ring-blue-400/60"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRightIcon className="w-5 h-5" /> : <ChevronLeftIcon className="w-5 h-5" />}
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </div>
    </aside>
  );
}
