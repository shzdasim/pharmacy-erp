// /src/pages/sales/SaleInvoiceForm.jsx
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import Select from "react-select";
import ProductSearchInput from "../../components/ProductSearchInput.jsx";
import BatchSearchInput from "../../components/BatchSearchInput.jsx";
import { recalcItem, recalcFooter } from "../../Formula/SaleInvoice.js";
import { useTheme } from "@/context/ThemeContext";

/* -------- utils (unchanged) -------- */
const normalizeFormLoaded = (f) => {
  const safe = { ...f };
  safe.invoice_type = safe.invoice_type ?? "debit";
  safe.remarks = safe.remarks ?? "";
  safe.doctor_name = safe.doctor_name ?? "";
  safe.patient_name = safe.patient_name ?? "";
  safe.date = safe.date ?? new Date().toISOString().split("T")[0];
  safe.discount_percentage = safe.discount_percentage ?? "";
  safe.discount_amount = safe.discount_amount ?? "";
  safe.tax_percentage = safe.tax_percentage ?? "";
  safe.tax_amount = safe.tax_amount ?? "";
  safe.item_discount = safe.item_discount ?? "";
  safe.gross_amount = safe.gross_amount ?? "";
  safe.total = safe.total ?? "";
  safe.total_receive = safe.total_receive ?? "";
  safe.items = Array.isArray(safe.items)
    ? safe.items.map((it) => ({
        product_id: it?.product_id ?? "",
        pack_size: it?.pack_size ?? "",
        batch_number: it?.batch_number ?? "",
        expiry: it?.expiry ?? "",
        current_quantity: it?.current_quantity ?? "",
        quantity: it?.quantity ?? "",
        price: it?.price ?? "",
        item_discount_percentage: it?.item_discount_percentage ?? "",
        sub_total: it?.sub_total ?? "",
        is_narcotic: it?.is_narcotic ?? it?.narcotic === "yes" ?? false,
      }))
    : [];
  return safe;
};

// glassy button presets
const btnBlueGlass = "bg-blue-500/85 text-white ring-1 ring-white/20 backdrop-blur-sm shadow-[0_6px_20px_-6px_rgba(37,99,235,0.45)] hover:bg-blue-500/95";
const btnRoseGlass = "bg-rose-500/85 text-white ring-1 ring-white/20 backdrop-blur-sm shadow-[0_6px_20px_-6px_rgba(244,63,94,0.45)] hover:bg-rose-500/95";

export default function SaleInvoiceForm({ saleId, onSuccess }) {
  /* -------- state -------- */
  const [form, setForm] = useState({
    invoice_type: "debit",
    customer_id: "",
    posted_number: "", // ⚠️ now left empty; server assigns at save
    date: new Date().toISOString().split("T")[0],
    remarks: "",
    doctor_name: "",
    patient_name: "",
    discount_percentage: "",
    discount_amount: "",
    tax_percentage: "",
    tax_amount: "",
    item_discount: "",
    gross_amount: "",
    total: "",
    total_receive: "",
    items: [
      {
        product_id: "",
        pack_size: "",
        batch_number: "",
        expiry: "",
        current_quantity: "",
        quantity: "",
        price: "",
        item_discount_percentage: "",
        sub_total: "",
        is_narcotic: false,
      },
    ],
  });

  const [receiveTouched, setReceiveTouched] = useState(false);
  const [marginPct, setMarginPct] = useState("");
  const navigate = useNavigate();
  useEffect(() => {
    setMarginPct("");
    setReceiveTouched(false);
  }, [saleId]);

  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [batchesByProduct, setBatchesByProduct] = useState({});
  const byIdsSupportedRef = useRef(true);

  // refs for grid navigation
  const productRefs = useRef([]);
  const batchRefs = useRef([]);
  const qtyRefs = useRef([]);
  const priceRefs = useRef([]);
  const discRefs = useRef([]);
  const focusedOnce = useRef(false);

  // scroll container ref for the items table
  const itemsScrollRef = useRef(null);

  /* -------- effects -------- */
  useEffect(() => {
    (async () => {
      await Promise.all([fetchCustomers(), fetchProducts()]);
      if (saleId) {
        await fetchSale();
      }
      // focus first product on brand new form
      setTimeout(() => {
        if (!focusedOnce.current && !saleId) {
          productRefs.current[0]?.querySelector?.("input")?.focus?.();
          focusedOnce.current = true;
        }
      }, 60);
    })();
  }, [saleId]);

  // Alt+S save
  useEffect(() => {
    const handle = (e) => {
      if (e.altKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleSubmit(e);
      }
    };
    document.addEventListener("keydown", handle);
    return () => document.removeEventListener("keydown", handle);
  }, [form]);

  /* -------- helpers -------- */
  const to2 = (n) => Number(parseFloat(n || 0).toFixed(2));
  const asISODate = (s) => {
    if (!s) return "";
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    const m = /^(\d{2})[\/-](\d{2})[\/-](\d{4})$/.exec(String(s));
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
    return String(s);
  };
  const sanitizeNumberInput = (value, allowDecimal = false, allowNegative = false) => {
    if (value === "") return "";
    const sign = allowNegative ? "-?" : "";
    const regex = allowDecimal
      ? new RegExp(`^${sign}\\d*\\.?\\d*$`)
      : new RegExp(`^${sign}\\d*$`);
    if (regex.test(value)) return value;
    return value.slice(0, -1);
  };
  const eqId = (a, b) => String(a ?? "") === String(b ?? "");
  const zeroToEmpty = (v) => (v === 0 || v === "0" ? "" : (v ?? ""));

  // Get dark mode state
  const { isDark } = useTheme();

  // Helper to get react-select styles based on dark mode
  const getSelectStyles = (isDarkMode = false) => ({
    control: (base) => ({
      ...base,
      minHeight: "28px",
      height: "28px",
      fontSize: "11px",
      borderColor: isDarkMode ? "rgba(71,85,105,0.8)" : "rgba(0,0,0,0.8)",
      backgroundColor: isDarkMode ? "rgba(51,65,85,0.7)" : "rgba(255,255,255,0.7)",
      backdropFilter: "blur(6px)",
      boxShadow: isDarkMode ? "0 1px 2px rgba(0,0,0,0.2)" : "none",
      borderRadius: 6,
      color: isDarkMode ? "#f1f5f9" : "#111827",
    }),
    valueContainer: (base) => ({
      ...base,
      height: "28px",
      padding: "0 6px",
    }),
    indicatorsContainer: (base) => ({
      ...base,
      height: "28px",
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
      fontSize: "12px",
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

  /* -------- data -------- */
  const fetchCustomers = async () => {
    try {
      const res = await axios.get("/api/customers");
      let list = Array.isArray(res.data) ? res.data : [];
      // pick the LOWEST ID as default
      list = list.slice().sort((a, b) => (a?.id ?? 0) - (b?.id ?? 0));
      setCustomers(list);
      if (!saleId && !form.customer_id && list.length > 0) {
        setForm((prev) => ({ ...prev, customer_id: list[0].id }));
      }
    } catch {}
  };

  const fetchProducts = async (q = "") => {
    try {
      const { data } = await axios.get("/api/products/search", { params: { q, limit: 30 } });
      setProducts(Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : []);
    } catch {}
  };

  const fetchBatches = async (productId) => {
    if (!productId) return [];
    const key = String(productId);
    if (batchesByProduct[key]) return batchesByProduct[key];
    const normalizeBatch = (b) => ({
      batch_number: String(b?.batch_number ?? b?.batch ?? b?.number ?? "").trim(),
      expiry: b?.expiry ?? b?.expiration_date ?? b?.expiry_date ?? "",
      available_units: Number(b?.available_units ?? b?.available_quantity ?? b?.quantity ?? 0),
      pack_size: Number(b?.pack_size ?? 0),
    });
    try {
      const res = await axios.get(`/api/products/${productId}/batches`);
      const raw = Array.isArray(res.data) ? res.data : [];
      const list = raw.map(normalizeBatch).filter((x) => x.batch_number && x.available_units > 0);
      setBatchesByProduct((m) => ({ ...m, [key]: list }));
      return list;
    } catch {
      setBatchesByProduct((m) => ({ ...m, [key]: [] }));
      return [];
    }
  };

  const fetchSale = async () => {
    const res = await axios.get(`/api/sale-invoices/${saleId}`);
    const loaded = normalizeFormLoaded(res.data);
    const tr = Math.round(Number(loaded?.total_receive ?? 0));
    const tt = Math.round(Number(loaded?.total ?? 0));
    const shouldSync = loaded?.total_receive === "" || tr === tt;
    setForm(loaded);
    setReceiveTouched(!shouldSync);
    await ensureProductsForItems(loaded?.items || []);
    await ensureBatchesForItems(loaded?.items || []);
  };

  /* -------- handlers -------- */
  const handleInvoiceTypeChange = (type) => {
    setForm((prev) => {
      const next = { ...prev, invoice_type: type };
      // When switching to credit, clear customer_id to force selection
      // and set total_receive to 0 (true credit sale)
      if (type === "credit") {
        next.customer_id = "";
        next.total_receive = "";
        setReceiveTouched(true); // Mark as touched so it stays at 0
      } else {
        // Debit - auto-select lowest ID customer if none selected
        if (!next.customer_id && customers.length > 0) {
          const sortedCustomers = [...customers].sort((a, b) => (a?.id ?? 0) - (b?.id ?? 0));
          next.customer_id = sortedCustomers[0].id;
        }
        // For debit, auto-fill total_receive with total
        if (!receiveTouched) {
          next.total_receive = next.total ?? "";
        }
      }
      return next;
    });
  };

  const handleHeaderChange = (e) => {
    const { name, value } = e.target;
    // allow negatives for these summary fields
    const negativeFields = new Set([
      "discount_percentage",
      "discount_amount",
      "tax_percentage",
      "tax_amount",
      ]);
  const allowNegative = negativeFields.has(name);
    const decimalFields = new Set([
      "discount_percentage",
      "discount_amount",
      "tax_percentage",
      "tax_amount",
    ]);
    const v = decimalFields.has(name)
      ? sanitizeNumberInput(value, true, allowNegative)
      : value;
    const tmp = { ...form, [name]: v };
    let next = recalcFooter(tmp, name);
    next[name] = v;
    // For credit sales, total_receive stays at 0; for debit, auto-fill if not touched
    if (!receiveTouched && form.invoice_type !== "credit") next.total_receive = next.total ?? "";
    if (form.invoice_type === "credit") next.total_receive = "";
    setForm(next);
  };

  function handleItemChange(index, field, rawValue) {
    let value = rawValue;
    const allowNegative = field === "item_discount_percentage";
    if (field === "price" || field === "item_discount_percentage") {
      value = sanitizeNumberInput(value, true, allowNegative);
      if (field === "item_discount_percentage" && (value === "-" || value === "-."))
        return setForm((prev) => {
          const items = [...prev.items];
          items[index] = { ...items[index], item_discount_percentage: value };
          return { ...prev, items };
        });
    } else if (field === "quantity" || field === "pack_size") {
      value = sanitizeNumberInput(value, false, false);
    }
    setForm((prev) => {
      const items = [...prev.items];
      if (field === "quantity") {
        const available = Number(items[index].current_quantity || 0);
        const prevQtyNum = Number(items[index].quantity || 0);
        const nextQtyNum = Number(value || 0);
        if (nextQtyNum > available && prevQtyNum <= available) {
          toast.error(`Row ${index + 1}: quantity exceeds available (${available})`);
        }
      }
      let row = recalcItem({ ...items[index], [field]: value }, field);
      if (field === "item_discount_percentage") row.item_discount_percentage = value;
      items[index] = row;
      let updated = recalcFooter({ ...prev, items }, "items");
      // For credit sales, total_receive stays at 0; for debit, auto-fill if not touched
      if (!receiveTouched && prev.invoice_type !== "credit") updated.total_receive = updated.total ?? "";
      if (prev.invoice_type === "credit") updated.total_receive = "";
      return updated;
    });
  }

  const addRow = () => {
    setForm((prev) => {
      const next = {
        ...prev,
        items: [
          ...prev.items,
          {
            product_id: "",
            pack_size: "",
            batch_number: "",
            expiry: "",
            current_quantity: "",
            quantity: "",
            price: "",
            item_discount_percentage: "",
            sub_total: "",
            is_narcotic: false,
          },
        ],
      };
      if (!receiveTouched) {
        const afterFooter = recalcFooter(next, "items");
        // For credit sales, total_receive stays at 0; for debit, auto-fill if not touched
        if (prev.invoice_type !== "credit") {
          afterFooter.total_receive = afterFooter.total ?? "";
        } else {
          afterFooter.total_receive = "";
        }
        return afterFooter;
      }
      // For credit sales, ensure total_receive stays at 0
      if (prev.invoice_type === "credit") {
        next.total_receive = "";
      }
      return next;
    });
  };

  const removeRow = (i) => {
    if (form.items.length <= 1) return;
    const items = form.items.filter((_, idx) => idx !== i);
    let next = recalcFooter({ ...form, items }, "items");
    // For credit sales, total_receive stays at 0; for debit, auto-fill if not touched
    if (!receiveTouched && form.invoice_type !== "credit") next.total_receive = next.total ?? "";
    if (form.invoice_type === "credit") next.total_receive = "";
    setForm(next);
  };

  const resolveId = (val) =>
    typeof val === "object" ? val?.id ?? val?.value ?? val?.product_id : val;

  const resetRow = (rowIndex) => {
    setForm((prev) => {
      const items2 = [...prev.items];
      items2[rowIndex] = recalcItem(
        {
          product_id: "",
          pack_size: "",
          price: "",
          batch_number: "",
          expiry: "",
          current_quantity: "",
          quantity: "",
          sub_total: "",
          item_discount_percentage: "",
          is_narcotic: false,
        },
        "revert_duplicate_product"
      );
      let next = recalcFooter({ ...prev, items: items2 }, "items");
      // For credit sales, total_receive stays at 0; for debit, auto-fill if not touched
      if (!receiveTouched && prev.invoice_type !== "credit") next.total_receive = next.total ?? "";
      if (prev.invoice_type === "credit") next.total_receive = "";
      return next;
    });
  };

  const handleProductSelect = async (rowIndex, productIdOrObj) => {
    const productId = resolveId(productIdOrObj);
    if (!productId && productId !== 0) return;

    const currentRowProductId = form.items[rowIndex]?.product_id;
    
    // Only check for duplicate if the product is different from current row's product
    // This allows re-selecting the same product on the same row (for editing)
    if (!eqId(currentRowProductId, productId)) {
      const dupIndex = form.items.findIndex(
        (row, idx) => idx !== rowIndex && eqId(row.product_id, productId)
      );
      if (dupIndex !== -1) {
        toast.error(`Product already used in row ${dupIndex + 1}. Each product can be added only once.`);
        resetRow(rowIndex);
        setTimeout(() => {
          productRefs.current[rowIndex]?.querySelector?.("input")?.focus?.();
        }, 40);
        return;
      }
    }

    const selected =
      products.find((p) => eqId(p.id, productId)) ||
      (typeof productIdOrObj === "object" ? productIdOrObj : {}) ||
      {};

    // Ensure we have the narcotic field - fetch from API if not present
    let isNarcotic = selected?.narcotic === "yes";
    if (!selected?.hasOwnProperty("narcotic") && productId) {
      try {
        const { data } = await axios.get(`/api/products/${productId}`);
        isNarcotic = data?.narcotic === "yes";
      } catch {}
    }

    const rawMargin = selected?.margin ?? selected?.margin_percentage ?? selected?.default_margin ?? "";
    setMarginPct(sanitizeNumberInput(String(rawMargin), true));
    const packSize = selected?.pack_size ?? "";
    const baseAvailable = selected?.quantity ?? selected?.available_units ?? 0;
    const price = selected?.unit_sale_price ?? selected?.unit_purchase_price ?? "";

    const batchList = await fetchBatches(productId);
    const hasBatches = Array.isArray(batchList) && batchList.length > 0;

    // Calculate existing quantity of this product in OTHER rows (for edit scenario)
    // When editing, the existing quantity is not yet consumed, so add it back to available
    const existingQtyInOtherRows = form.items.reduce((sum, item, idx) => {
      if (idx !== rowIndex && eqId(item.product_id, productId)) {
        return sum + Number(item.quantity || 0);
      }
      return sum;
    }, 0);

    // The actual available quantity to show:
    // When editing: base available + existing quantity (since it's not consumed yet)
    // When new row: base available (no existing quantities to add back)
    // Also add back current row's existing quantity so user can increase it
    const currentRowExistingQty = eqId(currentRowProductId, productId) 
      ? Number(form.items[rowIndex]?.quantity || 0) 
      : 0;
    const available = Number(baseAvailable) + existingQtyInOtherRows + currentRowExistingQty;

    // Preserve existing values if re-selecting the same product
    const existingBatchNumber = eqId(currentRowProductId, productId)
      ? form.items[rowIndex]?.batch_number
      : "";
    const existingExpiry = eqId(currentRowProductId, productId)
      ? form.items[rowIndex]?.expiry
      : "";

    setForm((prev) => {
      const items = [...prev.items];
      
      // If quantity is empty (new product selection), preset it to 1
      // If re-selecting same product, keep the existing quantity
      const presetQty = eqId(currentRowProductId, productId)
        ? items[rowIndex].quantity
        : (items[rowIndex]?.quantity === "" || items[rowIndex]?.quantity == null
           ? "1"
           : items[rowIndex].quantity);
      
      // When re-selecting same product, preserve batch and expiry if they exist
      const shouldPreserveBatch = eqId(currentRowProductId, productId) && existingBatchNumber;
      
      items[rowIndex] = recalcItem(
        {
          ...items[rowIndex],
          product_id: productId,
          pack_size: packSize,
          price,
          batch_number: shouldPreserveBatch ? existingBatchNumber : "",
          expiry: shouldPreserveBatch ? existingExpiry : "",
          current_quantity: available.toString(), // Always use recalculated available
          quantity: presetQty,
          item_discount_percentage: items[rowIndex]?.item_discount_percentage ?? "",
          sub_total: items[rowIndex]?.sub_total ?? "",
          is_narcotic: isNarcotic,
        },
        "product_select"
      );
      let next = recalcFooter({ ...prev, items }, "items");
      // For credit sales, total_receive stays at 0; for debit, auto-fill if not touched
      if (!receiveTouched && prev.invoice_type !== "credit") next.total_receive = next.total ?? "";
      if (prev.invoice_type === "credit") next.total_receive = "";
      return next;
    });

    setTimeout(() => {
      if (hasBatches) {
        batchRefs.current[rowIndex]?.querySelector?.("input")?.focus?.();
      } else {
        qtyRefs.current[rowIndex]?.focus?.();
      }
    }, 40);
  };

  const handleBatchSelect = async (rowIndex, batchNum) => {
    const row0 = form.items[rowIndex];
    if (!row0.product_id || !batchNum) return;
    
    try {
      const batches = await fetchBatches(row0.product_id);
      const b = (batches || []).find((x) => String(x.batch_number) === String(batchNum));
      
      // Calculate existing quantity of this same batch in OTHER rows (for edit scenario)
      // When editing, existing quantities are not yet consumed, so add them back
      const existingQtyInOtherRows = form.items.reduce((sum, item, idx) => {
        if (idx !== rowIndex && String(item.batch_number) === String(batchNum)) {
          return sum + Number(item.quantity || 0);
        }
        return sum;
      }, 0);
      
      const baseAvailable = Number(b?.available_units ?? 0);
      const available = baseAvailable + existingQtyInOtherRows;
      
      const params = new URLSearchParams({
        product_id: row0.product_id || "",
        batch: batchNum || "",
      }).toString();
      
      try {
        const res = await axios.get(`/api/products/available-quantity?${params}`);
        const apiAvailable = Number(
          res?.data?.available_units ?? res?.data?.available ?? res?.data?.quantity ?? 0
        );
        // Use API value if valid, otherwise use local calculation
        if (apiAvailable > 0) {
          // Calculate adjusted available with existing quantities from other rows
          return handleBatchSelectWithCalculatedAvailable(rowIndex, batchNum, apiAvailable, existingQtyInOtherRows);
        }
      } catch {}
      
      // Use local calculation with batch data
      handleBatchSelectWithCalculatedAvailable(rowIndex, batchNum, baseAvailable, existingQtyInOtherRows);
    } catch {}
  };

  const handleBatchSelectWithCalculatedAvailable = (rowIndex, batchNum, baseAvailable, existingQtyInOtherRows) => {
    const available = Number(baseAvailable) + Number(existingQtyInOtherRows);
    const exp = asISODate(form.items[rowIndex]?.expiry || "");
    
    setForm((prev) => {
      const items = [...prev.items];
      const updated = {
        ...items[rowIndex],
        batch_number: batchNum,
        current_quantity: String(available),
      };
      if (exp) updated.expiry = exp;
      items[rowIndex] = recalcItem(updated, "batch_select");
      let next = recalcFooter({ ...prev, items }, "items");
      // For credit sales, total_receive stays at 0; for debit, auto-fill if not touched
      if (!receiveTouched && prev.invoice_type !== "credit") next.total_receive = next.total ?? "";
      if (prev.invoice_type === "credit") next.total_receive = "";
      return next;
    });
    setTimeout(() => {
      qtyRefs.current[rowIndex]?.focus?.();
    }, 40);
  };

  const upsertProducts = (list) => {
    if (!Array.isArray(list)) return;
    setProducts((prev) => {
      const map = new Map((prev || []).map((p) => [String(p.id), p]));
      list.forEach((p) => p?.id != null && map.set(String(p.id), p));
      return Array.from(map.values());
    });
  };

  const ensureProductsForItems = async (items = []) => {
    const ids = Array.from(new Set(items.map((it) => it.product_id).filter(Boolean))).map(String);
    if (!ids.length) return;
    const have = new Set((products || []).map((p) => String(p.id)));
    const missing = ids.filter((id) => !have.has(id));
    if (!missing.length) return;

    if (byIdsSupportedRef.current) {
      try {
        const { data } = await axios.get("/api/products/by-ids", {
          params: { ids: missing.join(",") },
        });
        const list = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
        upsertProducts(list);
        return;
      } catch (err) {
        if (err?.response?.status === 404) {
          byIdsSupportedRef.current = false;
        }
      }
    }

    const fetched = await Promise.all(
      missing.map(async (id) => {
        try {
          const { data } = await axios.get(`/api/products/${id}`);
          return data;
        } catch {
          try {
            const { data } = await axios.get("/api/products/search", { params: { q: id, limit: 1 } });
            return Array.isArray(data?.data) ? data.data[0] : Array.isArray(data) ? data[0] : null;
          } catch {
            return null;
          }
        }
      })
    );
    upsertProducts(fetched.filter(Boolean));
  };

  const ensureBatchesForItems = async (items = []) => {
    const productIds = Array.from(new Set(items.map((it) => it.product_id).filter(Boolean)));
    for (const pid of productIds) {
      try {
        await fetchBatches(pid);
      } catch {}
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate customer selection for credit invoices
    if (form.invoice_type === "credit" && !form.customer_id) {
      return toast.error("Please select a customer for credit sale");
    }

    // Check if any item has a narcotic product
    const hasNarcoticProduct = form.items.some(item => item.is_narcotic === true);

    // If any item is narcotic, require doctor and patient names
    if (hasNarcoticProduct) {
      if (!form.doctor_name || form.doctor_name.trim() === "") {
        return toast.error("Doctor name is required for narcotic products");
      }
      if (!form.patient_name || form.patient_name.trim() === "") {
        return toast.error("Patient name is required for narcotic products");
      }
    }

    for (let i = 0; i < form.items.length; i++) {
      const it = form.items[i];
      if (!it.product_id) return toast.error(`Row ${i + 1}: select a product`);
      const list = batchesByProduct[String(it.product_id)];
      const hasBatches = Array.isArray(list) && list.length > 0;
      if (hasBatches && !it.batch_number) return toast.error(`Row ${i + 1}: select a batch`);
      if (it.quantity === "" || it.quantity == null)
        return toast.error(`Row ${i + 1}: enter quantity`);
      const available = Number(it.current_quantity || 0);
      if (Number(it.quantity || 0) > available) {
        return toast.error(`Row ${i + 1}: quantity exceeds available (${available})`);
      }
    }

    // unique product validation
    {
      const seen = new Set();
      for (let i = 0; i < form.items.length; i++) {
        const id = form.items[i].product_id;
        if (!id) continue;
        if (seen.has(String(id))) {
          toast.error(`Duplicate product in row ${i + 1}. Each product can be added only once.`);
          return;
        }
        seen.add(String(id));
      }
    }

    // total_receive validation
    {
      const totalNum = Math.round(Number(form.total || 0));
      const recvNum = Math.round(Number(form.total_receive || 0));
      if (recvNum < 0) return toast.error("Total Receive cannot be negative");
      if (recvNum > totalNum) return toast.error("Total Receive cannot exceed Total");
    }

    // Let backend assign posted_number; we send whatever is present.
    const payload = {
      ...form,
      invoice_type: form.invoice_type ?? "debit",
      discount_percentage:
        form.discount_percentage === "-" || form.discount_percentage === "-."
          ? "-0"
          : form.discount_percentage,
      items: form.items.map((it) => ({
        ...it,
        item_discount_percentage:
          it.item_discount_percentage === "-" || it.item_discount_percentage === "-."
            ? "-0"
            : it.item_discount_percentage,
      })),
    };

    try {
      if (saleId) {
        const res = await axios.put(`/api/sale-invoices/${saleId}`, payload);
        const id = res?.data?.id ?? saleId;
        toast.success("Sale invoice updated");
        navigate(`/sale-invoices/${id}`);
      } else {
        const res = await axios.post(`/api/sale-invoices`, payload);
        const id = res?.data?.id;
        toast.success("Sale invoice created");
        if (id) navigate(`/sale-invoices/${id}`);
        else toast.error("Missing invoice ID from server response.");
      }
    } catch {
      toast.error("Failed to save sale invoice");
    }
  };

  // --- scroll helpers (unchanged logic) ---
  const scrollTargetIntoItemsView = (node) => {
    const container = itemsScrollRef.current;
    if (!container || !node) return;

    const target = node.closest?.("tr") || node;

    const head = container.querySelector("thead");
    const headH = head ? head.getBoundingClientRect().height : 0;

    const targetTop = target.offsetTop;
    const targetBottom = targetTop + target.offsetHeight;

    const viewTop = container.scrollTop;
    const viewBottom = viewTop + container.clientHeight;

    if (targetTop < viewTop + headH + 4) {
      container.scrollTop = Math.max(targetTop - headH - 4, 0);
    } else if (targetBottom > viewBottom - 4) {
      container.scrollTop = targetBottom - container.clientHeight + 4;
    }
  };

  // --- keyboard nav (unchanged) ---
  const COLS = ["product", "batch", "quantity", "disc"];
  const focusCell = (row, col) => {
    const map = { product: productRefs, batch: batchRefs, quantity: qtyRefs, price: priceRefs, disc: discRefs };
    const ref = map[col]?.current?.[row];
    if (!ref) return;
    const input = ref.querySelector?.("input") || ref;
    if (input?.focus) {
      input.focus();
      input.select?.();
    } else if (ref?.focus) {
      ref.focus();
    }
    requestAnimationFrame(() => {
      scrollTargetIntoItemsView(input || ref);
    });
  };
  const moveSameCol = (row, col, dir) => {
    const lastIdx = form.items.length - 1;
    if (dir === 1) {
      if (row === lastIdx) {
        addRow();
        setTimeout(() => focusCell(row + 1, col === "quantity" || col === "disc" ? "product" : col), 40);
      } else {
        focusCell(row + 1, col);
      }
    } else if (row > 0) {
      focusCell(row - 1, col);
    }
  };
  const moveNextCol = (row, col) => {
    const i = COLS.indexOf(col);
    if (i < 0) return;
    if (i < COLS.length - 1) focusCell(row, COLS[i + 1]);
    else {
      const lastIdx = form.items.length - 1;
      if (row === lastIdx) {
        addRow();
        setTimeout(() => focusCell(row + 1, COLS[0]), 40);
      } else focusCell(row + 1, COLS[0]);
    }
  };
  const onKeyNav = (e, row, col) => {
  // Handle Ctrl + Tab for reverse navigation
  if (e.shiftKey && e.key === "Tab") {
    e.preventDefault();

    const i = COLS.indexOf(col);
    if (i > 0) {
      // Go to previous editable field
      focusCell(row, COLS[i - 1]);
    } else if (i === 0 && row > 0) {
      // If first column, go to previous row's last editable col
      focusCell(row - 1, COLS[COLS.length - 1]);
    }
    return;
  }

  if (col === "batch" && (e.key === "ArrowDown" || e.key === "ArrowUp")) return;

  switch (e.key) {
    case "ArrowDown":
      e.preventDefault();
      moveSameCol(row, col, 1);
      break;
    case "ArrowUp":
      e.preventDefault();
      moveSameCol(row, col, -1);
      break;
    case "Enter":
      e.preventDefault();
      // Existing logic for forward flow
      if (col === "quantity") {
        focusCell(row, "disc");
      } else {
        moveNextCol(row, col);
      }
      break;
    default:
      break;
  }
};


  /* ===================== R E N D E R ===================== */
  return (
    <form
      className={`h-[calc(90vh-100px)] flex flex-col ${isDark ? "bg-slate-900" : "bg-white"}`}
      autoComplete="off" autoCapitalize="off" autoCorrect="off" spellCheck={false}
    >
      {/* Top Bar */}
      <div className={`shrink-0 sticky top-0 z-20 border-b ${isDark ? "bg-slate-800 border-slate-700" : "bg-white border-gray-200"}`}>
        <div className="px-2 py-1 flex items-center gap-2">
          <div className={`text-xs font-semibold ${isDark ? "text-slate-200" : "text-gray-800"}`}>Sale Invoice</div>

          <div className="ml-auto flex items-center gap-2">
            {/* Invoice Type Radio Buttons */}
            <div className={`flex items-center gap-2 mr-2 px-2 py-1 rounded border ${isDark ? "bg-slate-700 border-slate-600" : "bg-gray-50 border-gray-200"}`}>
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="radio"
                  name="invoice_type"
                  value="debit"
                  checked={form.invoice_type === "debit"}
                  onChange={() => handleInvoiceTypeChange("debit")}
                  className="cursor-pointer"
                />
                <span className={`text-[10px] font-medium ${isDark ? "text-slate-300" : "text-gray-700"}`}>Debit</span>
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
                <span className={`text-[10px] font-medium ${isDark ? "text-slate-300" : "text-gray-700"}`}>Credit</span>
              </label>
            </div>

            <div className={`hidden sm:flex items-center gap-2 text-[10px] ${isDark ? "text-slate-400" : "text-gray-600"}`}>
              <span className="inline-flex items-center gap-1">
                <span className={`px-1 py-0.5 border rounded ${isDark ? "bg-slate-700 border-slate-600 text-slate-300" : "bg-gray-50 border-gray-200"}`}>Alt</span>
                <span>+</span>
                <span className={`px-1 py-0.5 border rounded ${isDark ? "bg-slate-700 border-slate-600 text-slate-300" : "bg-gray-50 border-gray-200"}`}>S</span>
                <span>Save</span>
              </span>
              <span>•</span>
              <span>Enter→next</span>
              <span>•</span>
              <span>↑/↓ rows</span>
            </div>

            <button
              type="button"
              onClick={handleSubmit}
              className={`px-3 py-1.5 rounded text-[11px] ${btnBlueGlass}`}
            >
              {saleId ? "Update (Alt+S)" : "Create (Alt+S)"}
            </button>
          </div>
        </div>

        {/* Meta strip */}
        <div className="px-2 pb-1 grid grid-cols-12 gap-1 text-[11px]">
          <div className="col-span-2">
            <label className={`block text-[9px] mb-0.5 ${isDark ? "text-slate-400" : "text-gray-600"}`}>Posted #</label>
            <input
              type="text"
              readOnly
              value={form.posted_number || ""}
              placeholder={saleId ? "" : "Auto on Save"}
              autoComplete="off"
              className={`w-full h-7 border-2 rounded px-1 ${
                isDark 
                  ? "border-slate-600 bg-slate-700 text-slate-200 placeholder-slate-500" 
                  : "border-black bg-gray-100 text-gray-800"
              }`}
            />
          </div>
          <div className="col-span-2">
            <label className={`block text-[9px] mb-0.5 ${isDark ? "text-slate-400" : "text-gray-600"}`}>Date</label>
            <input
              type="date"
              name="date"
              value={form.date ?? ""}
              onChange={handleHeaderChange}
              autoComplete="off"
              className={`w-full h-7 border-2 rounded px-1 ${
                isDark 
                  ? "border-slate-600 bg-slate-700 text-slate-200" 
                  : "border-black text-gray-800"
              }`}
            />
          </div>
          <div className="col-span-4">
            <label className={`block text-[9px] mb-0.5 ${isDark ? "text-slate-400" : "text-gray-600"}`}>Customer *</label>
            <Select
              options={customers.map((c) => ({ value: c.id, label: c.name }))}
              value={
                customers
                  .map((c) => ({ value: c.id, label: c.name }))
                  .find((s) => s.value === form.customer_id) || null
              }
              onChange={(val) => setForm((prev) => ({ ...prev, customer_id: val?.value || "" }))}
              className="text-[11px]"
              name="customer_select" inputId="customer_select" aria-autocomplete="list"
              styles={getSelectStyles(isDark)}
              isSearchable
            />
          </div>
          <div className="col-span-2">
            <label className={`block text-[9px] mb-0.5 ${isDark ? "text-slate-400" : "text-gray-600"}`}>Doctor</label>
            <input
              type="text"
              name="doctor_name"
              value={form.doctor_name ?? ""}
              onChange={handleHeaderChange}
              autoComplete="off"
              className={`w-full h-7 border-2 rounded px-1 ${
                isDark 
                  ? "border-slate-600 bg-slate-700 text-slate-200" 
                  : "border-black text-gray-800"
              }`}
            />
          </div>
            <div className="col-span-2">
            <label className={`block text-[9px] mb-0.5 ${isDark ? "text-slate-400" : "text-gray-600"}`}>Patient</label>
            <input
              type="text"
              name="patient_name"
              value={form.patient_name ?? ""}
              onChange={handleHeaderChange}
              autoComplete="off"
              className={`w-full h-7 border-2 rounded px-1 ${
                isDark 
                  ? "border-slate-600 bg-slate-700 text-slate-200" 
                  : "border-black text-gray-800"
              }`}
            />
          </div>

          <div className="col-span-10">
            <label className={`block text-[9px] mb-0.5 ${isDark ? "text-slate-400" : "text-gray-600"}`}>Remarks</label>
            <input
              type="text"
              name="remarks"
              value={form.remarks ?? ""}
              onChange={handleHeaderChange}
              autoComplete="off"
              className={`w-full h-7 border-2 rounded px-1 ${
                isDark 
                  ? "border-slate-600 bg-slate-700 text-slate-200" 
                  : "border-black text-gray-800"
              }`}
            />
          </div>
          <div className="col-span-2">
            <label className={`block text-[9px] mb-0.5 ${isDark ? "text-slate-400" : "text-gray-600"}`}>Items</label>
            <input
              type="text"
              readOnly
              value={form.items.length}
              autoComplete="off"
              className={`w-full h-7 border-2 rounded px-1 text-center ${
                isDark 
                  ? "border-slate-600 bg-slate-700 text-slate-200" 
                  : "border-black bg-gray-100 text-gray-800"
              }`}
            />
          </div>
        </div>
      </div>

      {/* Main workspace: Items + Summary */}
      <div className={`flex-1 grid grid-cols-[1fr_240px] gap-2 px-2 py-2 overflow-hidden ${isDark ? "bg-slate-900" : "bg-white"}`}>
        {/* LEFT: Items */}
        <div className="flex flex-col min-h-0">
          <div className={`text-[11px] font-semibold mb-1 ${isDark ? "text-slate-300" : "text-gray-700"}`}>Items</div>
          <div ref={itemsScrollRef} className={`flex-1 overflow-auto border-2 rounded relative ${isDark ? "border-slate-700 bg-slate-800" : "border-gray-200 bg-white"}`}>
            <table className="w-full text-[11px] table-fixed border-collapse" autoComplete="off">
              <thead className={`sticky top-0 z-20 ${isDark ? "bg-slate-800/90 backdrop-blur-sm border-slate-700" : "bg-white/80 backdrop-blur-sm border-gray-200/70"} border-b`}>
                <tr className="[&>th]:py-1 [&>th]:px-1 [&>th]:text-left">
                  <th className={`w-7 text-center ${isDark ? "text-rose-400" : "text-red-600"}`}>DEL</th>
                  <th className={`w-7 text-center ${isDark ? "text-slate-400" : "text-gray-600"}`}>#</th>
                  <th className={`w-[180px] ${isDark ? "text-slate-400" : "text-gray-600"}`}>Product</th>
                  <th className={`w-14 text-center ${isDark ? "text-slate-400" : "text-gray-600"}`}>PSize</th>
                  <th className={`w-24 ${isDark ? "text-slate-400" : "text-gray-600"}`}>Batch</th>
                  <th className={`w-15 text-center ${isDark ? "text-slate-400" : "text-gray-600"}`}>Expiry</th>
                  <th className={`w-18 text-center ${isDark ? "text-slate-400" : "text-gray-600"}`}>Avail</th>
                  <th className={`w-25 text-center ${isDark ? "text-slate-400" : "text-gray-600"}`}>Qty</th>
                  <th className={`w-22 text-center ${isDark ? "text-slate-400" : "text-gray-600"}`}>Price</th>
                  <th className={`w-18 text-center ${isDark ? "text-slate-400" : "text-gray-600"}`}>Disc%</th>
                  <th className={`w-26 text-center ${isDark ? "text-slate-400" : "text-gray-600"}`}>Sub Total</th>
                  <th className="w-7 text-center">+</th>
                </tr>
              </thead>
              <tbody className="[&>tr>td]:py-1 [&>tr>td]:px-0.2">
                {form.items.map((it, i) => (
                  <tr key={i} className={`border-b ${isDark ? "border-slate-700 hover:bg-slate-700/50" : "border-gray-100 hover:bg-gray-50"}`}>
                    <td className="text-center">
                      <button
                        type="button"
                        onClick={() => removeRow(i)}
                        className={`px-2 rounded text-white text-[10px] ${btnRoseGlass}`}
                      >
                        X
                      </button>
                    </td>
                    <td className={`text-center ${isDark ? "text-slate-400" : "text-gray-600"}`}>{i + 1}</td>

                    <td>
                      <div ref={(el) => (productRefs.current[i] = el)}>
                        <ProductSearchInput
                          value={products.find((p) => eqId(p.id, it.product_id)) || it.product_id}
                          onChange={(val) => handleProductSelect(i, val)}
                          onKeyDown={(e) => onKeyNav(e, i, "product")}
                          products={products}
                          onRefreshProducts={fetchProducts}
                          inputProps={{ autoComplete: "off", autoCapitalize: "off", autoCorrect: "off", spellCheck: false }}
                        />
                      </div>
                    </td>

                    <td className="text-center">
                      <input
                        type="text"
                        readOnly
                        value={it.pack_size ?? ""}
                        autoComplete="off"
                        className={`w-full h-6 border rounded px-1 text-center ${
                          isDark 
                            ? "border-slate-600 bg-slate-700 text-slate-300" 
                            : "border-gray-200 bg-gray-100 text-gray-700"
                        }`}
                      />
                    </td>

                    <td>
                      <div ref={(el) => (batchRefs.current[i] = el)}>
                        <BatchSearchInput
                          value={it.batch_number}
                          onChange={(val) => handleBatchSelect(i, val)}
                          batches={(batchesByProduct[it.product_id] || [])
                            .filter((b) => (b.available_units ?? 0) > 0)
                            .map((b) => ({
                              ...b,
                              batch_number: b.batch_number || b.batch,
                            }))}
                          usedBatches={form.items
                            .filter((row, idx) => idx !== i && row.product_id === it.product_id)
                            .map((row) => row.batch_number)
                            .filter(Boolean)}
                          onKeyDown={(e) => onKeyNav(e, i, "batch")}
                          inputProps={{ autoComplete: "off", autoCapitalize: "off", autoCorrect: "off", spellCheck: false }}
                        />
                      </div>
                    </td>

                    <td className="text-center">
                      <input
                        type="date"
                        value={it.expiry ?? ""}
                        readOnly
                        autoComplete="off"
                        className={`w-full h-6 border rounded px-1 text-center ${
                          isDark 
                            ? "border-slate-600 bg-slate-700 text-slate-300" 
                            : "border-gray-200 bg-gray-100 text-gray-700"
                        }`}
                      />
                    </td>

                    <td className="text-center">
                      <input
                        type="text"
                        readOnly
                        value={it.current_quantity ?? ""}
                        autoComplete="off"
                        className={`w-full h-6 border rounded px-1 text-center ${
                          isDark 
                            ? "border-slate-600 bg-slate-700 text-slate-300" 
                            : "border-gray-200 bg-gray-100 text-gray-700"
                        }`}
                      />
                    </td>

                    <td className="text-center">
                      <input
                        ref={(el) => (qtyRefs.current[i] = el)}
                        type="text"
                        inputMode="numeric"
                        value={zeroToEmpty(it.quantity)}
                        onChange={(e) => handleItemChange(i, "quantity", e.target.value)}
                        autoComplete="off"
                        className={
                          `w-full h-6 border rounded px-1 text-center ${
                            isDark 
                              ? "bg-slate-700 border-slate-600 text-slate-200" 
                              : "bg-white border-gray-300 text-gray-800"
                          } ` +
                          (Number(it.quantity || 0) > Number(it.current_quantity || 0)
                            ? "border-red-500 ring-1 ring-red-400"
                            : "")
                        }
                        onKeyDown={(e) => onKeyNav(e, i, "quantity")}
                        onFocus={(e) => e.target.select()}
                      />
                    </td>

                    <td className="text-center">
                      <input
                        ref={(el) => (priceRefs.current[i] = el)}
                        type="text"
                        value={to2(it.price ?? "")}
                        readOnly
                        autoComplete="off"
                        className={`w-full h-6 border rounded px-1 text-center ${
                          isDark 
                            ? "border-slate-600 bg-slate-700 text-slate-300" 
                            : "border-gray-200 bg-gray-100 text-gray-700"
                        }`}
                        onKeyDown={(e) => onKeyNav(e, i, "price")}
                      />
                    </td>

                    <td className="text-center">
                      <input
                        ref={(el) => (discRefs.current[i] = el)}
                        type="text"
                        inputMode="decimal"
                        value={zeroToEmpty(it.item_discount_percentage)}
                        onChange={(e) => handleItemChange(i, "item_discount_percentage", e.target.value)}
                        onBlur={(e) => {
                          const v = e.target.value;
                          if (v !== "" && v !== "-" && v !== "-.") {
                            const num = Number(v);
                            if (Number.isFinite(num)) {
                              handleItemChange(i, "item_discount_percentage", num.toFixed(2));
                            }
                          }
                        }}
                        autoComplete="off"
                        className={`w-full h-6 border rounded px-1 text-center ${
                          isDark 
                            ? "bg-slate-700 border-slate-600 text-slate-200" 
                            : "bg-white border-gray-300 text-gray-800"
                        }`}
                        onKeyDown={(e) => onKeyNav(e, i, "disc")}
                        onFocus={(e) => e.target.select()}
                      />
                    </td>

                    <td className="text-center">
                      <input
                        type="text"
                        readOnly
                        value={it.sub_total ?? ""}
                        autoComplete="off"
                        className={`w-full h-6 border rounded px-1 text-center ${
                          isDark 
                            ? "border-slate-600 bg-slate-700 text-slate-300" 
                            : "border-gray-200 bg-gray-100 text-gray-700"
                        }`}
                      />
                    </td>

                    <td className="text-center">
                      <button
                        type="button"
                        onClick={addRow}
                        className={`px-2 rounded text-white text-[10px] ${btnBlueGlass}`}
                      >
                        +
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* RIGHT: Summary */}
        <div className="min-h-0">
          <div className="sticky top-[20px] space-y-2">
            <div className={`border-2 rounded p-2 ${isDark ? "bg-slate-800 border-slate-700" : "bg-white border-gray-200"}`}>
              <div className={`text-[18px] font-semibold mb-1 ${isDark ? "text-slate-200" : "text-gray-800"}`}>Summary</div>
              <div className="grid grid-cols-2 gap-1 text-[11px]">
                <label className={`text-[13px] font-bold self-center ${isDark ? "text-slate-300" : "text-gray-700"}`}>Margin %</label>
                <input
                  type="text"
                  name="margin_percentage"
                  readOnly
                  value={marginPct}
                  onChange={(e) => setMarginPct(sanitizeNumberInput(e.target.value, true))}
                  autoComplete="off"
                  className={`h-7 border-2 rounded px-1 font-extrabold text-lg ${
                    isDark 
                      ? "border-slate-600 bg-slate-700 text-rose-400 placeholder-slate-500" 
                      : "border-black bg-gray-100 text-red-600"
                  }`}
                />

                <label className={`text-[13px] font-bold self-center ${isDark ? "text-slate-300" : "text-gray-700"}`}>Tax %</label>
                <input
                  type="text"
                  name="tax_percentage"
                  value={form.tax_percentage ?? ""}
                  onChange={handleHeaderChange}
                  autoComplete="off"
                  className={`h-7 border-2 rounded px-1 ${
                    isDark 
                      ? "border-slate-600 bg-slate-700 text-slate-200" 
                      : "border-black text-gray-800"
                  }`}
                />

                <label className={`text-[13px] font-bold self-center ${isDark ? "text-slate-300" : "text-gray-700"}`}>Tax Amt</label>
                <input
                  type="text"
                  name="tax_amount"
                  value={form.tax_amount ?? ""}
                  onChange={handleHeaderChange}
                  autoComplete="off"
                  className={`h-7 border-2 rounded px-1 ${
                    isDark 
                      ? "border-slate-600 bg-slate-700 text-slate-200" 
                      : "border-black text-gray-800"
                  }`}
                />

                <label className={`text-[13px] font-bold self-center ${isDark ? "text-slate-300" : "text-gray-700"}`}>Disc %</label>
                <input
                  type="text"
                  name="discount_percentage"
                  value={form.discount_percentage ?? ""}
                  onChange={handleHeaderChange}
                  onBlur={(e) => {
                    const v = e.target.value;
                    if (v !== "" && v !== "-" && v !== "-.") {
                      const num = Number(v);
                      if (Number.isFinite(num)) {
                        handleHeaderChange({ target: { name: "discount_percentage", value: num.toFixed(2) } });
                      }
                    }
                  }}
                  autoComplete="off"
                  className={`h-7 border-2 rounded px-1 ${
                    isDark 
                      ? "border-slate-600 bg-slate-700 text-slate-200" 
                      : "border-black text-gray-800"
                  }`}
                />

                <label className={`text-[13px] font-bold self-center ${isDark ? "text-slate-300" : "text-gray-700"}`}>Disc Amt</label>
                <input
                  type="text"
                  name="discount_amount"
                  value={form.discount_amount ?? ""}
                  onChange={handleHeaderChange}
                  autoComplete="off"
                  className={`h-7 border-2 rounded px-1 ${
                    isDark 
                      ? "border-slate-600 bg-slate-700 text-slate-200" 
                      : "border-black text-gray-800"
                  }`}
                />

                <label className={`text-[13px] font-bold self-center ${isDark ? "text-slate-300" : "text-gray-700"}`}>Gross</label>
                <input
                  type="text"
                  readOnly
                  value={form.gross_amount ?? ""}
                  autoComplete="off"
                  className={`h-7 border-2 rounded px-1 ${
                    isDark 
                      ? "border-slate-600 bg-slate-700 text-slate-300" 
                      : "border-black bg-gray-100 text-gray-700"
                  }`}
                />

                <label className={`text-[13px] font-bold self-center ${isDark ? "text-slate-300" : "text-gray-700"}`}>Total</label>
                <input
                  type="text"
                  readOnly
                  value={form.total ?? ""}
                  autoComplete="off"
                  className={`h-7 border-2 rounded px-1 font-extrabold text-lg ${
                    isDark 
                      ? "border-slate-600 bg-slate-700 text-rose-400" 
                      : "border-black bg-gray-100 text-red-600"
                  }`}
                />

                <label className={`text-[13px] font-bold self-center ${isDark ? "text-slate-300" : "text-gray-700"}`}>Receive</label>
                <input
                  type="text"
                  name="total_receive"
                  inputMode="numeric"
                  readOnly={form.invoice_type === "debit"}
                  value={form.total_receive ?? ""}
                  onChange={(e) => {
                    const v = sanitizeNumberInput(e.target.value, true, false);
                    setReceiveTouched(true);
                    setForm((prev) => ({ ...prev, total_receive: v }));
                  }}
                  onBlur={() => {
                    setForm((prev) => ({
                      ...prev,
                      total_receive: String(Math.round(Number(prev.total_receive || 0))),
                    }));
                  }}
                  autoComplete="off"
                  className={`h-7 border-2 rounded px-1 ${
                    isDark 
                      ? "border-slate-600 bg-slate-700 text-slate-200" 
                      : "border-black text-gray-800"
                  } ${form.invoice_type === "debit" ? (isDark ? "cursor-not-allowed bg-slate-800" : "bg-gray-100 cursor-not-allowed") : ""}`}
                />

                <label className={`text-[13px] font-bold self-center ${isDark ? "text-slate-300" : "text-gray-700"}`}>Remaining</label>
                <input
                  type="text"
                  readOnly
                  value={String(
                    Math.round(Number(form.total || 0)) - Math.round(Number(form.total_receive || 0))
                  )}
                  autoComplete="off"
                  className={`h-7 border-2 rounded px-1 cursor-not-allowed ${
                    isDark 
                      ? "border-slate-600 bg-slate-700 text-slate-300" 
                      : "border-black bg-gray-100 text-gray-700"
                  }`}
                />
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleSubmit}
                  className={`w-full h-9 rounded text-white text-[12px] ${btnBlueGlass}`}
                >
                  {saleId ? "Update Sale" : "Create Sale"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
