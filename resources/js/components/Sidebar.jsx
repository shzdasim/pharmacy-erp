import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  HomeIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDownIcon,
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
} from "@heroicons/react/24/outline";

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [openSections, setOpenSections] = useState(() => new Set(["Masters", "Transactions", "Reports & Analytics"]));
  const { pathname } = useLocation();
  const navigate = useNavigate();

  // ==== Menu structure (with sub-menus) ====
  const sections = useMemo(
    () => [
      {
        title: "Dashboard",
        icon: HomeIcon,
        items: [{ name: "Dashboard", path: "/dashboard", icon: HomeIcon }],
      },
      {
        title: "Setup",
        icon: Squares2X2Icon,
        items: [
          { name: "Products", path: "/products", icon: CubeIcon },
          { name: "Categories", path: "/categories", icon: Squares2X2Icon },
          { name: "Brands", path: "/brands", icon: TagIcon },
          { name: "Suppliers", path: "/suppliers", icon: BuildingStorefrontIcon },
          { name: "Customers", path: "/customers", icon: UserGroupIcon },
        ],
      },
      {
        title: "Transactions",
        icon: DocumentTextIcon,
        items: [
          { name: "Sale Invoice", path: "/sale-invoices", icon: DocumentCurrencyDollarIcon },
          { name: "Purchase Invoice", path: "/purchase-invoices", icon: DocumentTextIcon },
          { name: "Sale Return", path: "/sale-returns", icon: DocumentMinusIcon },
          { name: "Purchase Return", path: "/purchase-returns", icon: FolderMinusIcon },
          { name: "Purchase Orders", path: "/purchase-orders", icon: TruckIcon },
        ],
      },
      {
        title: "Reports & Analytics",
        icon: ChartBarIcon,
        items: [
          { name: "Cost of Sale Report", path: "/reports/cost-of-sale", icon: ChartBarIcon },
          { name: "Purchase Detail Report", path: "/reports/purchase-detail", icon: ChartBarIcon },
          { name: "Sale Detail Report", path: "/reports/sale-detail", icon: ChartBarIcon },
        ],
      },
    ],
    []
  );

  // Auto-open the section that contains the active route
  useEffect(() => {
    const containing = sections.find((sec) => sec.items.some((it) => it.path === pathname));
    if (containing && !openSections.has(containing.title)) {
      setOpenSections((prev) => new Set([...Array.from(prev), containing.title]));
    }
  }, [pathname, sections, openSections]);

  // ==== Build a flat list of currently visible, focusable entries (section headers + open items) ====
  const visibleList = useMemo(() => {
    const list = [];
    sections.forEach((sec) => {
      list.push({ type: "section", key: `sec:${sec.title}`, section: sec });
      const isOpen = openSections.has(sec.title);
      // When collapsed, hide submenu items for a clean narrow view
      if (!collapsed && isOpen) {
        sec.items.forEach((it) => list.push({ type: "item", key: `item:${it.path}`, item: it, section: sec }));
      }
    });
    return list;
  }, [sections, openSections, collapsed]);

  // Refs + keyboard focus mgmt
  const entryRefs = useRef([]);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  // Focus active route or first item
  useEffect(() => {
    const activeIdx = visibleList.findIndex(
      (e) => e.type === "item" && e.item.path === pathname
    );
    setFocusedIndex(activeIdx >= 0 ? activeIdx : 0);
  }, [pathname, visibleList.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (focusedIndex >= 0 && entryRefs.current[focusedIndex]) {
      entryRefs.current[focusedIndex].focus();
    }
  }, [focusedIndex, visibleList]);

  const toggleSection = (title) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  };

  const handleSectionClick = (sec) => {
    if (collapsed && sec.items.length === 1) {
      // When collapsed, a single-item section acts like a direct link
      navigate(sec.items[0].path);
    } else {
      toggleSection(sec.title);
    }
  };

  // Keyboard navigation for visible entries
  function handleKeyDown(e) {
    if (visibleList.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setFocusedIndex((prev) => (prev + 1) % visibleList.length);
        break;
      case "ArrowUp":
        e.preventDefault();
        setFocusedIndex((prev) => (prev <= 0 ? visibleList.length - 1 : prev - 1));
        break;
      case "Home":
        e.preventDefault();
        setFocusedIndex(0);
        break;
      case "End":
        e.preventDefault();
        setFocusedIndex(visibleList.length - 1);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (focusedIndex >= 0) {
          const entry = visibleList[focusedIndex];
          if (entry.type === "section") {
            handleSectionClick(entry.section);
          } else if (entry.type === "item") {
            navigate(entry.item.path);
          }
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
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRightIcon className="w-5 h-5" /> : <ChevronLeftIcon className="w-5 h-5" />}
        </button>
      </div>

      {/* Navigation */}
      <nav
        className="mt-2"
        role="list"
        tabIndex={0}
        aria-label="Main navigation"
        onKeyDown={handleKeyDown}
      >
        {visibleList.map((entry, idx) => {
          if (entry.type === "section") {
            const sec = entry.section;
            const isOpen = openSections.has(sec.title);
            const SectionIcon = sec.icon;

            return (
              <button
                key={entry.key}
                ref={(el) => (entryRefs.current[idx] = el)}
                onClick={() => handleSectionClick(sec)}
                onFocus={() => setFocusedIndex(idx)}
                className={`w-full flex items-center justify-between px-3 py-2 mt-2 text-left focus:outline-none ${
                  collapsed ? "mx-0" : "mx-2"
                } rounded-lg hover:bg-gray-100`}
                tabIndex={focusedIndex === idx ? 0 : -1}
                aria-expanded={!collapsed ? isOpen : undefined}
                title={collapsed ? sec.title : undefined}
              >
                <span className="flex items-center gap-3">
                  <SectionIcon className="w-6 h-6" />
                  {!collapsed && <span className="font-semibold text-gray-700">{sec.title}</span>}
                </span>
                {!collapsed && (
                  <ChevronDownIcon
                    className={`w-5 h-5 transition-transform ${isOpen ? "rotate-0" : "-rotate-90"}`}
                  />
                )}
              </button>
            );
          }

          // item
          const item = entry.item;
          const isActive = pathname === item.path;
          const isFocused = focusedIndex === idx;
          const ItemIcon = item.icon;

          return (
            <Link
              key={entry.key}
              to={item.path}
              ref={(el) => (entryRefs.current[idx] = el)}
              className={`flex items-center ${
                collapsed ? "mx-0" : "mx-3"
              } mt-1 px-3 py-2 rounded-lg focus:outline-none ${
                isActive
                  ? "bg-blue-100 text-blue-600"
                  : isFocused
                  ? "bg-gray-200 text-gray-900"
                  : "hover:bg-gray-100 text-gray-900"
              }`}
              tabIndex={isFocused ? 0 : -1}
              onFocus={() => setFocusedIndex(idx)}
              aria-current={isActive ? "page" : undefined}
              title={collapsed ? item.name : undefined}
            >
              <ItemIcon className="w-5 h-5" />
              {!collapsed && <span className="ml-3 text-sm">{item.name}</span>}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
