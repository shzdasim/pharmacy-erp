import React, { useState, useRef, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  HomeIcon,
  ClipboardDocumentListIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  UsersIcon,
  TagIcon,
  CubeIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from "@heroicons/react/24/outline";

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { pathname } = useLocation();
  const navigate = useNavigate();

  // State to toggle submenu "Item Creation"
  const [itemCreationOpen, setItemCreationOpen] = useState(true);

  // Menu structure with children
  const menu = [
    { name: "Dashboard", path: "/dashboard", icon: <HomeIcon className="w-6 h-6" /> },
    {
      name: "Item Creation",
      icon: <ClipboardDocumentListIcon className="w-6 h-6" />,
      children: [
        { name: "Suppliers", path: "/suppliers", icon: <UsersIcon className="w-6 h-6" /> },
        { name: "Customers", path: "/customers", icon: <UsersIcon className="w-6 h-6" /> },
        { name: "Categories", path: "/categories", icon: <TagIcon className="w-6 h-6" /> },
        { name: "Brands", path: "/brands", icon: <CubeIcon className="w-6 h-6" /> },
      ],
    },
  ];

  // Flatten menu for keyboard nav (parent + children)
  const flatMenu = [];
  menu.forEach((item) => {
    flatMenu.push({ ...item, isChild: false });
    if (item.children && itemCreationOpen) {
      item.children.forEach((child) =>
        flatMenu.push({ ...child, isChild: true, parentName: item.name })
      );
    }
  });

  // Refs for keyboard focus
  const itemRefs = useRef([]);

  // Track focused index for keyboard nav
  const [focusedIndex, setFocusedIndex] = useState(-1);

  // On pathname change, set focused index to current path item
  useEffect(() => {
    const idx = flatMenu.findIndex((item) => item.path === pathname);
    setFocusedIndex(idx);
  }, [pathname, itemCreationOpen]); // re-check when submenu toggles

  // Focus current focused element on change
  useEffect(() => {
    if (focusedIndex >= 0 && itemRefs.current[focusedIndex]) {
      itemRefs.current[focusedIndex].focus();
    }
  }, [focusedIndex]);

  // Keyboard navigation (up/down/home/end/enter/space)
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
        if (focusedIndex >= 0) {
          const item = flatMenu[focusedIndex];
          if (item.children) {
            // toggle submenu on parent enter
            if (item.name === "Item Creation") {
              setItemCreationOpen((v) => !v);
            }
          } else if (item.path) {
            navigate(item.path);
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

      <nav
        className="mt-4"
        role="list"
        tabIndex={0} // focusable container
        aria-label="Main navigation"
        onKeyDown={handleKeyDown}
      >
        {menu.map((item, index) => {
          const isActiveParent = pathname.startsWith(item.path);
          const isFocusedParent = focusedIndex >= 0 && flatMenu[focusedIndex].name === item.name && !flatMenu[focusedIndex].isChild;

          if (item.children) {
            return (
              <div key={item.name}>
                <button
                  ref={(el) => {
                    const idx = flatMenu.findIndex((i) => i.name === item.name && !i.isChild);
                    itemRefs.current[idx] = el;
                  }}
                  onClick={() => setItemCreationOpen((v) => !v)}
                  className={`flex items-center justify-between w-full p-2 mx-2 mt-2 rounded-lg focus:outline-none ${
                    isActiveParent
                      ? "bg-blue-100 text-blue-600"
                      : "hover:bg-gray-100 text-gray-900"
                  } ${
                    isFocusedParent && !isActiveParent
                      ? "bg-gray-200 text-gray-900"
                      : ""
                  }`}
                  tabIndex={isFocusedParent ? 0 : -1}
                  aria-expanded={itemCreationOpen}
                  aria-controls="item-creation-submenu"
                >
                  <span className="flex items-center space-x-3">
                    {item.icon}
                    {!collapsed && <span>{item.name}</span>}
                  </span>
                  {!collapsed &&
                    (itemCreationOpen ? (
                      <ChevronUpIcon className="w-5 h-5" />
                    ) : (
                      <ChevronDownIcon className="w-5 h-5" />
                    ))}
                </button>

                {itemCreationOpen && !collapsed && (
                  <div id="item-creation-submenu" role="list" className="ml-8">
                    {item.children.map((child) => {
                      const idx = flatMenu.findIndex(
                        (i) => i.name === child.name && i.isChild
                      );
                      const isActiveChild = pathname === child.path;
                      const isFocusedChild = focusedIndex === idx;

                      return (
                        <Link
                          key={child.path}
                          to={child.path}
                          ref={(el) => (itemRefs.current[idx] = el)}
                          className={`flex items-center p-2 mt-1 rounded-lg focus:outline-none ${
                            isActiveChild
                              ? "bg-blue-100 text-blue-600"
                              : "hover:bg-gray-100 text-gray-900"
                          } ${
                            isFocusedChild && !isActiveChild
                              ? "bg-gray-200 text-gray-900"
                              : ""
                          }`}
                          tabIndex={isFocusedChild ? 0 : -1}
                          onFocus={() => setFocusedIndex(idx)}
                          aria-current={isActiveChild ? "page" : undefined}
                        >
                          {child.icon}
                          <span className="ml-3">{child.name}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          } else {
            // single item (like Dashboard)
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
                } ${
                  isFocused && !isActive ? "bg-gray-200 text-gray-900" : ""
                }`}
                tabIndex={isFocused ? 0 : -1}
                onFocus={() => setFocusedIndex(index)}
                aria-current={isActive ? "page" : undefined}
              >
                {item.icon}
                {!collapsed && <span className="ml-3">{item.name}</span>}
              </Link>
            );
          }
        })}
      </nav>
    </div>
  );
}
