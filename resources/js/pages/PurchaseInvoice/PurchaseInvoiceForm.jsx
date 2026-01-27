// /src/pages/purchases/PurchaseInvoiceForm.jsx
import { useState, useEffect, useRef } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import Select from "react-select";
import ProductSearchInput from "../../components/ProductSearchInput.jsx";
import { recalcItem, recalcFooter } from "../../Formula/PurchaseInvoice.js";
import { useTheme } from "@/context/ThemeContext";

// Centralized Axios error → toast mapper
function showAxiosError(err) {
  const resp = err?.response;
  if (!resp) {
    toast.error("Network error. Please check your connection.");
    return;
  }
  const { status, data } = resp;
  // Laravel validation
  if (status === 422) {
    const errs = data?.errors || {};
    const msgs = Object.values(errs).flat();
    if (msgs.length) {
      msgs.slice(0, 6).forEach((m) => toast.error(String(m)));
      return;
    }
  }
  // Conflict/duplicate
  if (status === 409) {
    toast.error(data?.message || "Conflict while saving. Please review and try again.");
    return;
  }
  // Fallback
  toast.error(data?.message || "Unable to save invoice");
}

export default function PurchaseInvoiceForm({ invoiceId, onSuccess, onSubmit }) {
  const [form, setForm] = useState({
    invoice_type: "debit", // "debit" = pay now, "credit" = pay later
    supplier_id: "",
    posted_number: "", // (auto on save, stays empty until saved)
    posted_date: new Date().toISOString().split("T")[0],
    remarks: "",
    invoice_number: "",
    invoice_amount: "",
    tax_percentage: "",
    tax_amount: "",
    discount_percentage: "",
    discount_amount: "",
    total_amount: "",
    total_paid: "",
    items: [
      {
        product_id: "",
        batch: "",
        expiry: "",
        pack_quantity: "",
        pack_size: "",
        unit_quantity: "",
        pack_purchase_price: "",
        unit_purchase_price: "",
        pack_sale_price: "",
        unit_sale_price: "",
        pack_bonus: "",
        unit_bonus: "",
        item_discount_percentage: "",
        margin: "",
        sub_total: "",
        avg_price: "",
        quantity: "",
      },
    ],
  });

  // Track if user has manually edited total_paid
  const [paidTouched, setPaidTouched] = useState(false);

  // only allow numbers (and optionally decimals)
  // allow decimals for price/percentage fields + Pack.Q and PBonus
  const sanitizeNumberInput = (value, allowDecimal = false) => {
    if (value === "") return ""; // allow empty input

    if (allowDecimal) {
      // valid: numbers with at most one decimal point
      if (/^\d*\.?\d*$/.test(value)) {
        return value;
      }
      return value.slice(0, -1); // strip invalid char
    }

    // integer-only fields
    return value.replace(/\D/g, "");
  };
  const to2 = (n) => Number(parseFloat(n || 0).toFixed(2));

  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [currentField, setCurrentField] = useState("supplier");
  const [currentRowIndex, setCurrentRowIndex] = useState(0);

  // Refs for navigation
  const supplierRef = useRef(null);
  const invoiceNumberRef = useRef(null);
  const invoiceAmountRef = useRef(null);
  const taxPercentageRef = useRef(null);
  const discountPercentageRef = useRef(null);
  const saveButtonRef = useRef(null);

  // productSearchRefs will hold container DOM nodes (wrapping ProductSearchInput)
  const productSearchRefs = useRef([]);
  const batchRefs = useRef([]);
  const packQuantityRefs = useRef([]);
  const packPurchasePriceRefs = useRef([]);
  const itemDiscountRefs = useRef([]);
  const packBonusRefs = useRef([]);
  const packSalePriceRefs = useRef([]);

  useEffect(() => {
    fetchSuppliers();
    fetchProducts();
    if (invoiceId) {
      fetchInvoice();
    }
    // IMPORTANT: we NO LONGER prefetch/assign a new posted_number here.
    // It is generated server-side on SAVE to avoid collisions when multiple forms are open.
  }, [invoiceId]);

  useEffect(() => {
    // Focus supplier field on load
    setTimeout(() => {
      if (supplierRef.current) {
        supplierRef.current.focus();
      }
    }, 100);
  }, []);

  useEffect(() => {
    // Handle Alt+S for save (from anywhere)
    const handleKeyDown = (e) => {
      if (e.altKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleSubmit(e);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [form, paidTouched]);

  const fetchSuppliers = async () => {
    const res = await axios.get("/api/suppliers");
    setSuppliers(res.data);
  };

  const fetchProducts = async (q = "") => {
    const { data } = await axios.get("/api/products/search", { params: { q, limit: 30 } });
    setProducts(data);
  };

  // Fetch batches for a product and return the most recent batch (sorted by expiry descending)
  const fetchProductBatches = async (productId) => {
    try {
      const { data } = await axios.get(`/api/products/${productId}/batches`);
      // Sort by expiry date descending to get the most recent/furthest expiring batch first
      const sorted = Array.isArray(data) 
        ? data.sort((a, b) => new Date(b.expiry_date || '1970-01-01') - new Date(a.expiry_date || '1970-01-01'))
        : [];
      return sorted.length > 0 ? sorted[0] : null;
    } catch (err) {
      console.error('Failed to fetch batches:', err);
      return null;
    }
  };

  const fetchInvoice = async () => {
    const res = await axios.get(`/api/purchase-invoices/${invoiceId}`);
    let next = recalcFooter(res.data, "init");
    // 🔗 Keep total_paid linked to total_amount on edit load
    next.total_paid = next.total_amount ?? "";
    setForm(next);
    setPaidTouched(false);
    await ensureProductsForItems(next?.items || []);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    // Fields that should accept decimals as the user types
    const decimalFields = new Set([
      "invoice_amount",
      "tax_percentage",
      "tax_amount",
      "discount_percentage",
      "discount_amount",
    ]);

    const newValue = decimalFields.has(name)
      ? sanitizeNumberInput(value, true)
      : value;

    // Build a temp form with the raw typed value
    const tempForm = { ...form, [name]: newValue };

    // Recalculate totals, but DO NOT overwrite the field the user is typing
    let nextForm = recalcFooter(tempForm, name);
    nextForm[name] = newValue;

    if (!paidTouched) {
      nextForm.total_paid = nextForm.total_amount ?? "";
    }

    setForm(nextForm);
  };

  const handleSelectChange = (field, value) => {
    setForm({ ...form, [field]: value?.value || "" });
  };

  // Handle invoice type change (debit = pay now, credit = pay later)
  const handleInvoiceTypeChange = (type) => {
    setForm((prev) => {
      const next = { ...prev, invoice_type: type };
      // When switching to credit, set total_paid to empty (we owe full amount)
      if (type === "credit") {
        next.total_paid = "";
        setPaidTouched(true); // Mark as touched so it stays at 0
      } else {
        // Debit - auto-fill total_paid with total if not touched
        if (!paidTouched) {
          next.total_paid = next.total_amount ?? "";
        }
      }
      return next;
    });
  };

  function handleItemChange(index, field, rawValue) {
    let value = rawValue;

    // fields that can have decimals (✅ added pack_quantity and pack_bonus)
    const allowDecimalFields = [
      "pack_purchase_price",
      "unit_purchase_price",
      "pack_sale_price",
      "unit_sale_price",
      "item_discount_percentage",
      "pack_quantity",
      "pack_bonus",
    ];

    // integer-only fields
    const integerFields = [
      "unit_quantity",
      "unit_bonus",
    ];

    if (allowDecimalFields.includes(field)) {
      if (!/^\d*\.?\d*$/.test(value)) return;
    } else if (integerFields.includes(field)) {
      value = value.replace(/\D/g, "");
    }

    const newItems = [...form.items];
    newItems[index] = recalcItem({ ...newItems[index], [field]: value }, field);

    let newForm = { ...form, items: newItems };
    newForm = recalcFooter(newForm, "items");

    if (!paidTouched) {
      newForm.total_paid = newForm.total_amount ?? "";
    }

    setForm(newForm);
  }

  const addItem = () => {
    setForm((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          product_id: "",
          batch: "",
          expiry: "",
          pack_quantity: "",
          pack_size: "",
          unit_quantity: "",
          pack_purchase_price: "",
          unit_purchase_price: "",
          pack_sale_price: "",
          unit_sale_price: "",
          pack_bonus: "",
          unit_bonus: "",
          item_discount_percentage: "",
          margin: "",
          sub_total: "",
          avg_price: "",
          quantity: "",
        },
      ],
    }));
    setCurrentRowIndex(form.items.length);
  };

  const removeItem = (index) => {
    if (form.items.length > 1) {
      const newItems = form.items.filter((_, i) => i !== index);
      setForm({ ...form, items: newItems });
      if (currentRowIndex >= newItems.length) {
        setCurrentRowIndex(newItems.length - 1);
      }
    }
  };

  // Helper: robustly focus the ProductSearchInput inside its wrapper
  const focusProductSearch = (rowIndex = 0) => {
    const tryFocus = () => {
      const container = productSearchRefs.current[rowIndex];
      if (!container) return false;

      if (container instanceof HTMLElement) {
        const input = container.querySelector('input, [contenteditable="true"]');
        if (input && typeof input.focus === "function") {
          input.focus();
          if (typeof input.select === "function") input.select();
          setCurrentField("product");
          setCurrentRowIndex(rowIndex);
          return true;
        }
      }

      if (container && typeof container.focus === "function") {
        container.focus();
        setCurrentField("product");
        setCurrentRowIndex(rowIndex);
        return true;
      }

      return false;
    };

    if (tryFocus()) return;

    let attempts = 0;
    const maxAttempts = 10;
    const retry = () => {
      attempts += 1;
      if (tryFocus() || attempts >= maxAttempts) return;
      setTimeout(retry, 50);
    };
    setTimeout(retry, 30);
  };

  // Merge new products into state (by id, dedup)
  const upsertProducts = (list) => {
    if (!Array.isArray(list)) return;
    setProducts((prev) => {
      const map = new Map((prev || []).map((p) => [p.id, p]));
      list.forEach((p) => p?.id && map.set(p.id, p));
      return Array.from(map.values());
    });
  };

  // Make sure all product_ids used in items exist in products[]
  const ensureProductsForItems = async (items = []) => {
    const ids = Array.from(new Set(items.map(it => it.product_id).filter(Boolean)));
    if (ids.length === 0) return;

    const have = new Set((products || []).map(p => p.id));
    const missing = ids.filter(id => !have.has(id));
    if (missing.length === 0) return;

    try {
      const { data } = await axios.get("/api/products/by-ids", {
        params: { ids: missing.join(",") },
      });
      upsertProducts(data);
      return;
    } catch (_) { /* fall back to per-id */ }

    const fetched = await Promise.all(
      missing.map(async (id) => {
        try {
          const { data } = await axios.get(`/api/products/${id}`);
          return data;
        } catch {
          try {
            const { data } = await axios.get("/api/products/search", { params: { q: id, limit: 1 } });
            return Array.isArray(data) ? data[0] : data?.data?.[0];
          } catch {
            return null;
          }
        }
      })
    );
    upsertProducts(fetched.filter(Boolean));
  };

  const focusOnField = (field, rowIndex) => {
    setTimeout(() => {
      switch (field) {
        case "batch":
          if (batchRefs.current[rowIndex]) {
            focusAndSelect(batchRefs.current[rowIndex]);
            setCurrentField("batch");
            setCurrentRowIndex(rowIndex);
          }
          break;
        case "pack_quantity":
          if (packQuantityRefs.current[rowIndex]) {
            focusAndSelect(packQuantityRefs.current[rowIndex]);
            setCurrentField("pack_quantity");
            setCurrentRowIndex(rowIndex);
          }
          break;
        case "pack_purchase_price":
          if (packPurchasePriceRefs.current[rowIndex]) {
            focusAndSelect(packPurchasePriceRefs.current[rowIndex]);
            setCurrentField("pack_purchase_price");
            setCurrentRowIndex(rowIndex);
          }
          break;
        case "item_discount":
          if (itemDiscountRefs.current[rowIndex]) {
            focusAndSelect(itemDiscountRefs.current[rowIndex]);
            setCurrentField("item_discount");
            setCurrentRowIndex(rowIndex);
          }
          break;
        case "pack_bonus":
          if (packBonusRefs.current[rowIndex]) {
            focusAndSelect(packBonusRefs.current[rowIndex]);
            setCurrentField("pack_bonus");
            setCurrentRowIndex(rowIndex);
          }
          break;
        case "pack_sale_price":
          if (packSalePriceRefs.current[rowIndex]) {
            focusAndSelect(packSalePriceRefs.current[rowIndex]);
            setCurrentField("pack_sale_price");
            setCurrentRowIndex(rowIndex);
          }
          break;
        default:
          focusProductSearch(rowIndex);
          break;
      }
    }, 50);
  };

  const navigateToNextField = (currentFieldName, rowIndex = 0) => {
    setTimeout(() => {
      switch (currentFieldName) {
        case "supplier":
          if (invoiceNumberRef.current) {
            focusAndSelect(invoiceNumberRef.current);
            setCurrentField("invoice_number");
          }
          break;
        case "invoice_number":
          if (invoiceAmountRef.current) {
            focusAndSelect(invoiceAmountRef.current);
            setCurrentField("invoice_amount");
          }
          break;
        case "invoice_amount":
          focusProductSearch(0);
          break;
        case "product":
          // If batch field has ref and is visible, check if we should focus it
          if (batchRefs.current[rowIndex]) {
            batchRefs.current[rowIndex].focus();
            setCurrentField("batch");
          } else if (packQuantityRefs.current[rowIndex]) {
            packQuantityRefs.current[rowIndex].focus();
            setCurrentField("pack_quantity");
          }
          break;
        case "batch":
          if (packQuantityRefs.current[rowIndex]) {
            packQuantityRefs.current[rowIndex].focus();
            setCurrentField("pack_quantity");
          }
          break;
        case "pack_quantity":
          if (packPurchasePriceRefs.current[rowIndex]) {
            packPurchasePriceRefs.current[rowIndex].focus();
            setCurrentField("pack_purchase_price");
          }
          break;
        case "pack_purchase_price":
          if (itemDiscountRefs.current[rowIndex]) {
            itemDiscountRefs.current[rowIndex].focus();
            setCurrentField("item_discount");
          }
          break;
        case "item_discount":
          if (packBonusRefs.current[rowIndex]) {
            packBonusRefs.current[rowIndex].focus();
            setCurrentField("pack_bonus");
          }
          break;
        case "pack_bonus":
          if (packSalePriceRefs.current[rowIndex]) {
            packSalePriceRefs.current[rowIndex].focus();
            setCurrentField("pack_sale_price");
          }
          break;
        case "pack_sale_price":
          if (rowIndex < form.items.length - 1) {
            focusProductSearch(rowIndex + 1);
          } else {
            addItem();
            focusProductSearch(rowIndex + 1);
          }
          break;
      }
    }, 50);
  };

  const handleKeyDown = (e, field, rowIndex = 0) => {
    if (e.key === "Enter") {
      e.preventDefault();
      navigateToNextField(field, rowIndex);
    } else if (e.key === "Tab" && field === "invoice_amount") {
      e.preventDefault();
      navigateToNextField(field, rowIndex);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (rowIndex === form.items.length - 1) {
        addItem();
        setTimeout(() => {
          focusProductSearch(rowIndex + 1);
        }, 200);
      } else {
        const nextRowIndex = rowIndex + 1;
        focusOnField(field, nextRowIndex);
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (rowIndex > 0) {
        const prevRowIndex = rowIndex - 1;
        focusOnField(field, prevRowIndex);
      }
    }
  };

  const handleProductKeyDown = (e, rowIndex) => {
    if (e.key === "Enter") {
      e.preventDefault();
      navigateToNextField("product", rowIndex);
    } else if (e.key === "ArrowUp" && rowIndex > 0) {
      e.preventDefault();
      const prevRowIndex = rowIndex - 1;
      focusProductSearch(prevRowIndex);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (rowIndex === form.items.length - 1) {
        addItem();
        setTimeout(() => {
          focusProductSearch(rowIndex + 1);
        }, 200);
      } else {
        focusProductSearch(rowIndex + 1);
      }
    }
  };

  const zeroToEmpty = (v) => (v === 0 || v === "0" ? "" : (v ?? ""));
  const focusAndSelect = (el) => {
    if (!el) return;
    el.focus();
    setTimeout(() => {
      if (typeof el.select === "function") el.select();
    }, 0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate supplier selection for credit invoices
    if (form.invoice_type === "credit" && !form.supplier_id) {
      return toast.error("Please select a supplier for credit purchase");
    }

    // 0) Block if any selected product has margin <= 0 (or not a number)
    const badItem = form.items.find((item) => {
      if (!item.product_id) return false;
      const m = Number(item.margin);
      return !Number.isFinite(m) || m <= 0;
    });
    if (badItem) {
      const idx = form.items.indexOf(badItem);
      const product = products.find((p) => p.id === badItem.product_id);
      const productName = product?.name || `row ${idx + 1}`;
      toast.error(`Margin must be greater than 0 for ${productName}`);
      return;
    }

    // 1) Prevent negative margin (redundant now)
    const negativeMarginItem = form.items.find(
      (item) => item.product_id && Number(item.margin) < 0
    );
    if (negativeMarginItem) {
      const product = products.find((p) => p.id === negativeMarginItem.product_id);
      const productName = product ? product.name : negativeMarginItem.product_id;
      toast.error(`Margin cannot be negative for Product ${productName}`);
      return;
    }

    // 2) Validate invoice vs total
    const invoiceAmount = Number(form.invoice_amount || 0);
    const totalAmount = Number(form.total_amount || 0);
    const totalPaid = Number(form.total_paid || 0);
    if (totalPaid < 0) {
      toast.error("Total Paid cannot be negative");
      return;
    }
    if (totalPaid > totalAmount) {
      toast.error("Total Paid cannot exceed Total Amount");
      return;
    }
    if (Math.abs(invoiceAmount - totalAmount) > 5) {
      toast.error(
        `Invoice amount (${invoiceAmount}) must be equal to total amount (${totalAmount}), difference > 5`
      );
      return;
    }

    try {
      // 3) Duplicate invoice number check per supplier
      const checkRes = await axios.get("/api/purchase-invoices/check-unique", {
        params: {
          supplier_id: form.supplier_id,
          invoice_number: form.invoice_number,
          exclude_id: invoiceId || null,
        },
      });
      if (!checkRes.data.unique) {
        toast.error(
          `Invoice number "${form.invoice_number}" already exists for this supplier`
        );
        return;
      }

      // 🔒 Final guard: keep linked if user never changed it
      const payload = {
        ...form,
        total_paid: paidTouched ? form.total_paid : (form.total_amount ?? ""),
      };

      const payloadToSend = { ...payload };
      if (!invoiceId) {
        // Do NOT send posted_number on CREATE; server will atomically generate it.
        delete payloadToSend.posted_number;
      }

      // If onSubmit prop is provided, use it for API calls
      if (onSubmit) {
        const result = await onSubmit(payloadToSend);
        toast.success("Invoice saved successfully");
        onSuccess && onSuccess();
        return result;
      }

      // Original logic when onSubmit is not provided
      if (invoiceId) {
        await axios.put(`/api/purchase-invoices/${invoiceId}`, payloadToSend);
        toast.success("Invoice updated successfully");
        onSuccess && onSuccess();
      } else {
        const { data: saved } = await axios.post("/api/purchase-invoices", payloadToSend);
        // Server returns created invoice with posted_number assigned — reflect it locally.
        setForm((prev) => ({ ...prev, posted_number: saved?.posted_number || prev.posted_number }));
        toast.success(`Invoice created: ${saved?.posted_number || "(number assigned)"}`);
        onSuccess && onSuccess();
      }
    } catch (err) { showAxiosError(err); }
  };

  // Common anti-autofill props to spread on inputs
  const antiFill = {
    autoComplete: "off",
    autoCorrect: "off",
    autoCapitalize: "off",
    spellCheck: false,
  };

  // Get dark mode state
  const { isDark } = useTheme();

  // Helper to merge dark mode styles - returns function-based styles for react-select
  const getSelectStyles = (isDarkMode = false) => ({
    control: (base) => ({
      ...base,
      minHeight: "28px",
      height: "28px",
      fontSize: "12px",
      borderColor: isDarkMode ? "rgba(71,85,105,0.8)" : "rgba(229,231,235,0.8)",
      backgroundColor: isDarkMode ? "rgba(51,65,85,0.7)" : "rgba(255,255,255,0.7)",
      backdropFilter: "blur(6px)",
      boxShadow: isDarkMode ? "0 1px 2px rgba(0,0,0,0.2)" : "0 1px 2px rgba(15,23,42,0.06)",
      borderRadius: 8,
      color: isDarkMode ? "#f1f5f9" : "#111827",
    }),
    valueContainer: (base) => ({
      ...base,
      height: "28px",
      padding: "0 4px",
    }),
    input: (base) => ({
      ...base,
      margin: 0,
      padding: 0,
      color: isDarkMode ? "#f1f5f9" : "#111827",
    }),
    singleValue: (base) => ({
      ...base,
      color: isDarkMode ? "#f1f5f9" : "#111827",
    }),
    placeholder: (base) => ({
      ...base,
      color: isDarkMode ? "#64748b" : "#9ca3af",
    }),
    menu: (base) => ({
      ...base,
      borderRadius: 8,
      overflow: "hidden",
      backgroundColor: isDarkMode ? "rgba(30,41,59,0.95)" : "rgba(255,255,255,0.95)",
      backdropFilter: "blur(10px)",
      boxShadow: isDarkMode ? "0 10px 30px -10px rgba(0,0,0,0.4)" : "0 10px 30px -10px rgba(30,64,175,0.18)",
      border: isDarkMode ? "1px solid rgba(71,85,105,0.5)" : "none",
    }),
    option: (base, state) => ({
      ...base,
      backgroundColor: isDarkMode
        ? state.isFocused
          ? "rgba(71,85,105,1)"
          : "rgba(51,65,85,1)"
        : state.isFocused
          ? "rgba(241,245,249,1)"
          : "rgba(255,255,255,1)",
      color: isDarkMode ? "#f1f5f9" : "#111827",
      cursor: "pointer",
    }),
    menuPortal: (base) => ({ ...base, zIndex: 9999 }),
  });

  return (
    <form
      className="flex flex-col"
      style={{ minHeight: "74vh", maxHeight: "80vh" }}
      autoComplete="off" // disable browser suggestions globally
    >
      {/* ================= HEADER SECTION ================= */}
      <div className="sticky top-0 bg-white dark:bg-slate-800 shadow p-2 z-10 border-b border-gray-200 dark:border-slate-700" autoComplete="off">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">
            Purchase Invoice (Use Enter to navigate, Alt+S to save)
          </h2>
          
          {/* Invoice Type Radio Buttons */}
          <div className="flex items-center gap-3 bg-gray-50 dark:bg-slate-700/50 px-3 py-1.5 rounded border border-gray-200 dark:border-slate-600">
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="radio"
                name="invoice_type"
                value="debit"
                checked={form.invoice_type === "debit"}
                onChange={() => handleInvoiceTypeChange("debit")}
                className="cursor-pointer"
              />
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Debit</span>
            </label>
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="radio"
                name="invoice_type"
                value="credit"
                checked={form.invoice_type === "credit"}
                onChange={() => handleInvoiceTypeChange("credit")}
                className="cursor-pointer"
              />
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Credit</span>
            </label>
          </div>
        </div>
        
        <table className="w-full border-collapse text-xs">
          <tbody>
            <tr>
              <td className="border p-1 w-1/12 bg-gray-50 dark:bg-slate-700/50">
                <label className="block text-[10px] text-gray-600 dark:text-gray-400">Posted Number</label>
                <input
                  type="text"
                  inputMode="decimal"
                  name="posted_number"
                  readOnly
                  placeholder="(auto on save)"
                  value={form.posted_number || ""}
                  className="bg-gray-100 dark:bg-slate-600 border rounded w-full p-1 h-7 text-xs text-gray-900 dark:text-gray-100"
                  {...antiFill}
                />
              </td>
              <td className="border p-1 w-1/6 bg-gray-50 dark:bg-slate-700/50">
                <label className="block text-[10px] text-gray-600 dark:text-gray-400">Posted Date</label>
                <input
                  type="date"
                  name="posted_date"
                  value={form.posted_date}
                  onChange={handleChange}
                  className="border rounded w-full p-1 h-7 text-xs bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                  {...antiFill}
                />
              </td>
              <td className="border p-1 w-1/3 bg-gray-50 dark:bg-slate-700/50">
                <label className="block text-[10px] text-gray-600 dark:text-gray-400">Supplier *</label>
                <div {...antiFill}>
                  <Select
                    ref={supplierRef}
                    inputId="supplier_select"
                    name="supplier_select"
                    options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
                    value={
                      suppliers
                        .map((s) => ({ value: s.id, label: s.name }))
                        .find((s) => s.value === form.supplier_id) || null
                    }
                    onChange={(val) => {
                      handleSelectChange("supplier_id", val);
                      navigateToNextField("supplier");
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && form.supplier_id) {
                        e.preventDefault();
                        navigateToNextField("supplier");
                      }
                    }}
                    isSearchable
                    className="text-xs"
                    styles={getSelectStyles(isDark)}
                    menuPortalTarget={typeof document !== "undefined" ? document.body : null}
                  />
                </div>
              </td>
              <td className="border p-1 w-1/8 bg-gray-50 dark:bg-slate-700/50">
                <label className="block text-[10px] text-gray-600 dark:text-gray-400">Invoice Number</label>
                <input
                  ref={invoiceNumberRef}
                  type="text"
                  name="invoice_number"
                  value={form.invoice_number}
                  onChange={handleChange}
                  onKeyDown={(e) => handleKeyDown(e, "invoice_number")}
                  onFocus={(e) => e.target.select()}
                  className="border rounded w-full p-1 h-7 text-xs bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                  {...antiFill}
                />
              </td>
              <td className="border p-1 w-1/8 bg-gray-50 dark:bg-slate-700/50">
                <label className="block text-[10px] text-gray-600 dark:text-gray-400">Invoice Amount</label>
                <input
                  ref={invoiceAmountRef}
                  type="text"
                  name="invoice_amount"
                  value={form.invoice_amount}
                  onChange={handleChange}
                  onKeyDown={(e) => handleKeyDown(e, "invoice_amount")}
                  onFocus={(e) => e.target.select()}
                  className="border rounded w-full p-1 h-7 text-xs bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                  {...antiFill}
                />
              </td>
              <td className="border p-1 w-1/8 bg-gray-50 dark:bg-slate-700/50">
                <label className="block text-[10px] text-gray-600 dark:text-gray-400">Difference</label>
                <input
                  type="text"
                  readOnly
                  value={
                    form.invoice_amount && form.total_amount
                      ? (Number(form.invoice_amount) - Number(form.total_amount)).toFixed(2)
                      : ""
                  }
                  className={`border rounded w-full p-1 h-7 text-xs font-bold text-center bg-gray-100 dark:bg-slate-600 ${
                    Number(form.invoice_amount) - Number(form.total_amount) !== 0
                      ? "text-red-600 dark:text-red-400"
                      : "text-gray-700 dark:text-gray-300"
                  }`}
                  {...antiFill}
                />
              </td>
              <td className="border p-1 w-1/6 bg-gray-50 dark:bg-slate-700/50">
                <label className="block text-[10px] text-gray-600 dark:text-gray-400">Remarks</label>
                <input
                  type="text"
                  name="remarks"
                  value={form.remarks}
                  onChange={handleChange}
                  className="border rounded w-full p-1 h-7 text-xs bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                  {...antiFill}
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ================= ITEMS SECTION ================= */}
      <div className="flex-1 overflow-auto p-1 bg-gray-50 dark:bg-slate-800/50" autoComplete="off">
        <h2 className="text-xs font-bold mb-1 text-gray-900 dark:text-gray-100">Items (↑↓ arrows to navigate rows)</h2>

        <table className="w-full border-collapse text-[11px]">
          <thead className="sticky top-0 bg-gray-100 dark:bg-slate-700 z-5">
            <tr>
              <th rowSpan={2} className="border w-6 bg-gray-200 dark:bg-slate-600 text-gray-900 dark:text-gray-100">#</th>
              <th rowSpan={2} colSpan={1} className="border w-[80px] bg-gray-200 dark:bg-slate-600 text-gray-900 dark:text-gray-100">Product</th>
              <th colSpan={3} className="border bg-gray-200 dark:bg-slate-600 text-gray-900 dark:text-gray-100">Pack Size / Batch / Expiry</th>
              <th colSpan={2} className="border bg-gray-200 dark:bg-slate-600 text-gray-900 dark:text-gray-100">Qty (Pack / Unit)</th>
              <th colSpan={2} className="border bg-gray-200 dark:bg-slate-600 text-gray-900 dark:text-gray-100">Purchase Price (P / U)</th>
              <th colSpan={3} className="border bg-gray-200 dark:bg-slate-600 text-gray-900 dark:text-gray-100">Disc % / Bonus (P / U)</th>
              <th colSpan={2} className="border bg-gray-200 dark:bg-slate-600 text-gray-900 dark:text-gray-100">Sale Price (P / U)</th>
              <th colSpan={3} className="border bg-gray-200 dark:bg-slate-600 text-gray-900 dark:text-gray-100">Margin % / Avg / Sub Total</th>
              <th rowSpan={2} className="border w-6 bg-gray-200 dark:bg-slate-600 text-gray-900 dark:text-gray-100">+</th>
            </tr>

            <tr>
              <th className="border w-14 bg-gray-100 dark:bg-slate-600 text-gray-900 dark:text-gray-100">PSize</th>
              <th className="border w-16 bg-gray-100 dark:bg-slate-600 text-gray-900 dark:text-gray-100">Batch</th>
              <th className="border w-20 bg-gray-100 dark:bg-slate-600 text-gray-900 dark:text-gray-100">Exp</th>
              <th className="border w-12 bg-gray-100 dark:bg-slate-600 text-gray-900 dark:text-gray-100">Pack.Q</th>
              <th className="border w-12 bg-gray-100 dark:bg-slate-600 text-gray-900 dark:text-gray-100">Unit.Q</th>
              <th className="border w-14 bg-gray-100 dark:bg-slate-600 text-gray-900 dark:text-gray-100">Pack.P</th>
              <th className="border w-14 bg-gray-100 dark:bg-slate-600 text-gray-900 dark:text-gray-100">Unit.P</th>
              <th className="border w-14 bg-gray-100 dark:bg-slate-600 text-gray-900 dark:text-gray-100">Disc%</th>
              <th className="border w-14 bg-gray-100 dark:bg-slate-600 text-gray-900 dark:text-gray-100">PBonus</th>
              <th className="border w-14 bg-gray-100 dark:bg-slate-600 text-gray-900 dark:text-gray-100">UBonus</th>
              <th className="border w-14 bg-gray-100 dark:bg-slate-600 text-gray-900 dark:text-gray-100">Pack.S</th>
              <th className="border w-14 bg-gray-100 dark:bg-slate-600 text-gray-900 dark:text-gray-100">Unit.S</th>
              <th className="border w-14 bg-gray-100 dark:bg-slate-600 text-gray-900 dark:text-gray-100">Margin%</th>
              <th className="border w-16 bg-gray-100 dark:bg-slate-600 text-gray-900 dark:text-gray-100">Avg</th>
              <th className="border w-20 bg-gray-100 dark:bg-slate-600 text-gray-900 dark:text-gray-100">Sub Total</th>
            </tr>
          </thead>

          <tbody>
            {form.items.map((item, i) => (
              <tr key={i} className="text-center odd:bg-white even:bg-gray-50 dark:odd:bg-slate-700/30 dark:even:bg-slate-700/50">
                {/* Remove */}
                <td className="border">
                  <button
                    type="button"
                    onClick={() => removeItem(i)}
                    className="bg-red-500 dark:bg-red-600 text-white px-1 rounded text-[10px]"
                  >
                    X
                  </button>
                </td>

                {/* Product Search Input */}
                <td colSpan={1} className="border text-left w-[200px]">
                  <div ref={(el) => (productSearchRefs.current[i] = el)}>
                    <ProductSearchInput
                      value={products.find(p => p.id === item.product_id) || item.product_id}
                      onChange={async (val) => {
                        const list = Array.isArray(products) ? products : (Array.isArray(products?.data) ? products.data : []);
                        const selectedProduct = (val && typeof val === "object") ? val : list.find((p) => p?.id === val);
                        if (!selectedProduct) return;

                        const get = (obj, keys, d="") => {
                          for (const k of keys) {
                            const v = obj?.[k];
                            if (v !== undefined && v !== null && v !== "") return v;
                          }
                          return d;
                        };

                        const toNum = (x) => {
                          const n = Number(x);
                          return Number.isFinite(n) ? n : null;
                        };

                        const packSize = toNum(get(selectedProduct, ["pack_size","packSize","packsize"]));
                        const packPurchase = toNum(get(selectedProduct, ["pack_purchase_price","packPurchasePrice"]));
                        const unitPurchase = toNum(get(selectedProduct, ["unit_purchase_price","unitPurchasePrice"])) ?? ((packPurchase != null && packSize) ? (packPurchase / packSize) : null);
                        const packSale = toNum(get(selectedProduct, ["pack_sale_price","packSalePrice"]));
                        const unitSale = toNum(get(selectedProduct, ["unit_sale_price","unitSalePrice"])) ?? ((packSale != null && packSize) ? (packSale / packSize) : null);
                        const margin = get(selectedProduct, ["margin","margin_percentage","marginPercent"], "");
                        const avg = get(selectedProduct, ["avg_price","average_price","avgPrice"], "");

                        // Fetch batches for the selected product and auto-populate if exists
                        const batchData = await fetchProductBatches(selectedProduct?.id);
                        const batch = batchData?.batch_number || "";
                        const expiry = batchData?.expiry_date || "";

                        const newItems = [...form.items];
                        const prepared = {
                          ...newItems[i],
                          product_id: selectedProduct?.id || "",
                          pack_size: packSize ?? "",
                          pack_purchase_price: zeroToEmpty(packPurchase),
                          unit_purchase_price: unitPurchase ?? "",
                          pack_sale_price: zeroToEmpty(packSale),
                          unit_sale_price: unitSale ?? "",
                          batch: batch,
                          expiry: expiry,
                          pack_quantity: "",
                          unit_quantity: "",
                          pack_bonus: "",
                          unit_bonus: "",
                          item_discount_percentage: "",
                          margin: margin ?? "",
                          sub_total: "",
                          avg_price: avg ?? "",
                          quantity: "",
                        };

                        newItems[i] = recalcItem(prepared, "product");
                        let nextForm = { ...form, items: newItems };
                        nextForm = recalcFooter(nextForm, "items");
                        if (!paidTouched) nextForm.total_paid = nextForm.total_amount ?? "";
                        setForm(nextForm);
                        
                        // Navigate to next field - if batch has data, focus on batch, otherwise go to pack_quantity
                        if (batch) {
                          navigateToNextField("product", i);
                        } else {
                          // No batch, navigate directly to pack_quantity
                          setTimeout(() => {
                            if (packQuantityRefs.current[i]) {
                              packQuantityRefs.current[i].focus();
                              setCurrentField("pack_quantity");
                              setCurrentRowIndex(i);
                            }
                          }, 50);
                        }
                      }}
                      onKeyDown={(e) => handleProductKeyDown(e, i)}
                      products={products}
                      onRefreshProducts={fetchProducts}
                    />
                  </div>
                </td>

                {/* Pack Size */}
                <td className="border w-14">
                  <input
                    type="number"
                    readOnly
                    value={item.pack_size ?? ""}
                    className="border bg-gray-100 dark:bg-slate-600 w-full h-6 text-[11px] px-1 appearance-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-gray-900 dark:text-gray-100"
                    {...antiFill}
                  />
                </td>

                {/* Batch */}
                <td className="border w-16">
                  <input
                    ref={(el) => (batchRefs.current[i] = el)}
                    type="text"
                    value={item.batch ?? ""}
                    onChange={(e) => {
                      const newBatch = e.target.value;
                      const duplicateIndex = form.items.findIndex((it, idx) => {
                        if (idx === i) return false;
                        if (it.product_id !== item.product_id) return false;
                        if (it.batch && it.batch.trim() !== "") {
                          return it.batch === newBatch;
                        }
                        return !newBatch;
                      });

                      if (duplicateIndex !== -1) {
                        toast.error(
                          newBatch
                            ? `Product "${products.find((p) => p.id === item.product_id)?.name}" with batch "${newBatch}" already exists in row ${duplicateIndex + 1}`
                            : `Product "${products.find((p) => p.id === item.product_id)?.name}" without batch already exists in row ${duplicateIndex + 1}`
                        );
                        return;
                      }

                      const newItems = [...form.items];
                      newItems[i] = { ...newItems[i], batch: newBatch };
                      setForm({ ...form, items: newItems });
                    }}
                    onKeyDown={(e) => handleKeyDown(e, "batch", i)}
                    className="border w-full h-6 text-[11px] px-1 bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                    {...antiFill}
                  />
                </td>

                {/* Expiry */}
                <td className="border w-20">
                  <input
                    type="date"
                    value={item.expiry ?? ""}
                    onChange={(e) => handleItemChange(i, "expiry", e.target.value)}
                    className="border w-full h-6 text-[11px] px-1 bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                    {...antiFill}
                  />
                </td>

                {/* Pack Qty (✅ now supports decimals) */}
                <td className="border">
                  <input
                    ref={(el) => (packQuantityRefs.current[i] = el)}
                    type="text"
                    value={item.pack_quantity === 0 ? "" : item.pack_quantity}
                    onChange={(e) => handleItemChange(i, "pack_quantity", e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, "pack_quantity", i)}
                    onFocus={(e) => e.target.select()}
                    className="border w-full h-6 text-[11px] px-1 appearance-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                    {...antiFill}
                  />
                </td>

                {/* Unit Qty */}
                <td className="border">
                  <input
                    type="text"
                    value={item.unit_quantity === 0 ? "" : item.unit_quantity}
                    onChange={(e) => handleItemChange(i, "unit_quantity", e.target.value)}
                    className="border w-full h-6 text-[11px] px-1 appearance-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                    {...antiFill}
                  />
                </td>

                {/* Pack Purchase */}
                <td className="border">
                  <input
                    ref={(el) => (packPurchasePriceRefs.current[i] = el)}
                    type="text"
                    value={item.pack_purchase_price === 0 ? "" : item.pack_purchase_price}
                    onChange={(e) => handleItemChange(i, "pack_purchase_price", e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, "pack_purchase_price", i)}
                    onFocus={(e) => e.target.select()}
                    className="border w-full h-6 text-[11px] px-1 appearance-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                    {...antiFill}
                  />
                </td>

                {/* Unit Purchase */}
                <td className="border">
                  <input
                    type="text"
                    value={item.unit_purchase_price ?? ""}
                    onChange={(e) => handleItemChange(i, "unit_purchase_price", e.target.value)}
                    className="border w-full h-6 text-[11px] px-1 appearance-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                    {...antiFill}
                  />
                </td>

                {/* Disc% */}
                <td className="border">
                  <input
                    ref={(el) => (itemDiscountRefs.current[i] = el)}
                    type="text"
                    value={item.item_discount_percentage ?? ""}
                    onChange={(e) =>
                      handleItemChange(i, "item_discount_percentage", e.target.value)
                    }
                    onKeyDown={(e) => handleKeyDown(e, "item_discount", i)}
                    onFocus={(e) => e.target.select()}
                    className="border w-full h-6 text-[11px] px-1 appearance-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                    {...antiFill}
                  />
                </td>

                {/* Pack Bonus (✅ now supports decimals) */}
                <td className="border">
                  <input
                    ref={(el) => (packBonusRefs.current[i] = el)}
                    type="text"
                    value={item.pack_bonus === 0 ? "" : item.pack_bonus}
                    onChange={(e) => handleItemChange(i, "pack_bonus", e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, "pack_bonus", i)}
                    onFocus={(e) => e.target.select()}
                    className="border w-full h-6 text-[11px] px-1 appearance-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                    {...antiFill}
                  />
                </td>

                {/* Unit Bonus */}
                <td className="border">
                  <input
                    type="text"
                    value={item.unit_bonus === 0 ? "" : item.unit_bonus}
                    onChange={(e) => handleItemChange(i, "unit_bonus", e.target.value)}
                    className="border w-full h-6 text-[11px] px-1 appearance-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                    {...antiFill}
                  />
                </td>

                {/* Pack Sale */}
                <td className="border">
                  <input
                    ref={(el) => (packSalePriceRefs.current[i] = el)}
                    type="text"
                    value={item.pack_sale_price === 0 ? "" : item.pack_sale_price}
                    onChange={(e) => handleItemChange(i, "pack_sale_price", e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, "pack_sale_price", i)}
                    onFocus={(e) => e.target.select()}
                    className="border w-full h-6 text-[11px] px-1 appearance-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                    {...antiFill}
                  />
                </td>

                {/* Unit Sale */}
                <td className="border">
                  <input
                    type="text"
                    value={item.unit_sale_price ?? ""}
                    onChange={(e) => handleItemChange(i, "unit_sale_price", e.target.value)}
                    className="border w-full h-6 text-[11px] px-1 appearance-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                    {...antiFill}
                  />
                </td>

                {/* Margin % */}
                <td className="border">
                  <input
                    type="number"
                    readOnly
                    value={item.margin ?? ""}
                    className="border bg-gray-100 dark:bg-slate-600 w-full h-6 text-[11px] px-1 appearance-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-gray-900 dark:text-gray-100"
                    {...antiFill}
                  />
                </td>

                {/* Avg Price (readonly) */}
                <td className="border">
                  <input
                    type="number"
                    value={item.avg_price ?? ""}
                    readOnly
                    className="border w-full h-6 text-[11px] px-1 bg-gray-100 dark:bg-slate-600 text-gray-900 dark:text-gray-100"
                    {...antiFill}
                  />
                </td>

                {/* Sub Total (readonly) */}
                <td className="border">
                  <input
                    type="number"
                    value={item.sub_total ?? ""}
                    readOnly
                    className="border w-full h-6 text-[11px] px-1 bg-gray-100 dark:bg-slate-600 text-gray-900 dark:text-gray-100"
                    {...antiFill}
                  />
                </td>

                {/* Quantity (hidden) */}
                <td className="border" style={{ display: "none" }}>
                  <input
                    type="number"
                    readOnly
                    hidden
                    value={item.quantity ?? ""}
                    className="border bg-gray-100 dark:bg-slate-600 w-full h-6 text-[11px] px-1 appearance-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-gray-900 dark:text-gray-100"
                    {...antiFill}
                  />
                </td>

                {/* Add */}
                <td className="border">
                  <button
                    type="button"
                    onClick={addItem}
                    className="bg-blue-500 dark:bg-blue-600 text-white px-1 rounded text-[10px]"
                  >
                    +
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ================= FOOTER SECTION ================= */}
      <div className="sticky bottom-0 bg-white dark:bg-slate-800 shadow p-2 z-10 border-t border-gray-200 dark:border-slate-700" autoComplete="off">
        <table className="w-full border-collapse text-xs">
          <tbody>
            <tr>
              <td className="border p-1 w-1/8 bg-gray-50 dark:bg-slate-700/50">
                <label className="block text-[10px] text-gray-600 dark:text-gray-400">Tax %</label>
                <input
                  ref={taxPercentageRef}
                  type="text"
                  name="tax_percentage"
                  value={form.tax_percentage ?? ""}
                  onChange={handleChange}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      discountPercentageRef.current?.focus();
                    }
                  }}
                  className="border rounded w-full p-1 h-7 text-xs bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                  {...antiFill}
                />
              </td>
              <td className="border p-1 w-1/8 bg-gray-50 dark:bg-slate-700/50">
                <label className="block text-[10px] text-gray-600 dark:text-gray-400">Tax Amount</label>
                <input
                  type="text"
                  name="tax_amount"
                  value={form.tax_amount ?? ""}
                  onChange={handleChange}
                  className="border rounded w-full p-1 h-7 text-xs bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                  {...antiFill}
                />
              </td>
              <td className="border p-1 w-1/8 bg-gray-50 dark:bg-slate-700/50">
                <label className="block text-[10px] text-gray-600 dark:text-gray-400">Discount %</label>
                <input
                  ref={discountPercentageRef}
                  type="text"
                  name="discount_percentage"
                  value={form.discount_percentage ?? ""}
                  onChange={handleChange}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      saveButtonRef.current?.focus();
                    }
                  }}
                  className="border rounded w-full p-1 h-7 text-xs bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                  {...antiFill}
                />
              </td>
              <td className="border p-1 w-1/8 bg-gray-50 dark:bg-slate-700/50">
                <label className="block text-[10px] text-gray-600 dark:text-gray-400">Discount Amount</label>
                <input
                  type="text"
                  name="discount_amount"
                  value={form.discount_amount ?? ""}
                  onChange={handleChange}
                  className="border rounded w-full p-1 h-7 text-xs bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                  {...antiFill}
                />
              </td>
              <td className="border p-1 w-1/8 bg-gray-50 dark:bg-slate-700/50">
                <label className="block text-[10px] text-gray-600 dark:text-gray-400">Total Amount</label>
                <input
                  type="number"
                  name="total_amount"
                  readOnly
                  value={form.total_amount}
                  className="border rounded w-full p-1 h-7 text-xs bg-gray-100 dark:bg-slate-600 text-gray-900 dark:text-gray-100"
                  {...antiFill}
                />
              </td>
              <td className="border p-1 w-1/8 bg-gray-50 dark:bg-slate-700/50">
                <label className="block text-[10px] text-gray-600 dark:text-gray-400">Total Paid</label>
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    name="total_paid"
                    value={form.total_paid ?? ""}
                    onChange={(e) => {
                      const v = sanitizeNumberInput(e.target.value, true);
                      setPaidTouched(true);
                      setForm((prev) => ({ ...prev, total_paid: v }));
                    }}
                    onBlur={() => {
                      setForm((prev) => {
                        const normalized = prev.total_paid === "" ? "" : to2(prev.total_paid).toFixed(2);
                        const amt = prev.total_amount === "" || prev.total_amount == null ? "" : to2(prev.total_amount).toFixed(2);
                        if (normalized !== "" && normalized === amt) {
                          setPaidTouched(false);
                        }
                        return { ...prev, total_paid: normalized };
                      });
                    }}
                    className="border rounded w-full p-1 h-7 text-xs bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                    {...antiFill}
                  />
                  <button
                    type="button"
                    title="Relink paid to total"
                    onClick={() => {
                      setPaidTouched(false);
                      setForm((prev) => ({ ...prev, total_paid: prev.total_amount ?? "" }));
                    }}
                    className="px-2 py-1 text-[11px] bg-gray-200 dark:bg-slate-600 rounded"
                  >
                    🔗
                  </button>
                </div>
              </td>
              <td className="border p-1 w-1/8 bg-gray-50 dark:bg-slate-700/50">
                <label className="block text-[10px] text-gray-600 dark:text-gray-400">Remaining</label>
                <input
                  type="number"
                  name="remaining_amount"
                  readOnly
                  value={to2((form.total_amount || 0) - (form.total_paid || 0)).toFixed(2)}
                  className="border rounded w-full p-1 h-7 text-xs bg-gray-100 dark:bg-slate-600 text-gray-900 dark:text-gray-100"
                  {...antiFill}
                />
              </td>
              <td className="border p-1 w-1/8 text-center align-middle bg-gray-50 dark:bg-slate-700/50">
                <button
                  ref={saveButtonRef}
                  type="button"
                  onClick={handleSubmit}
                  className="bg-green-600 dark:bg-green-700 text-white px-9 py-2 rounded text-sm hover:bg-green-700 dark:hover:bg-green-800 transition duration-200"
                >
                  {invoiceId ? "Update " : "Save"}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </form>
  );
}