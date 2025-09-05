// PurchaseReturnForm.jsx
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import Select from "react-select";

import ProductSearchInput from "../../components/ProductSearchInput.jsx";
import BatchSearchInput from "../../components/BatchSearchInput.jsx";
import SupplierSearchInput from "../../components/SupplierSearchInput.jsx";
import { recalcItem, recalcFooter } from "../../Formula/PurchaseReturn.js";

export default function PurchaseReturnForm({ returnId, initialData, onSuccess }) {
  // ===== defaults =====
  const defaultItem = {
    id: Date.now() + Math.random(),
    product_id: "",
    batch: "",
    expiry: "",
    pack_size: 0,
    // kept for reference; not used in validation
    pack_purchased_quantity: 0,
    // used for display/validation
    available_units: 0,
    return_pack_quantity: 0,
    return_unit_quantity: 0,
    pack_purchase_price: 0,
    unit_purchase_price: 0,
    item_discount_percentage: 0,
    sub_total: 0,
  };

  // ===== state =====
  const [form, setForm] = useState({
    posted_number: "",
    date: new Date().toISOString().slice(0, 10),
    supplier_id: "",
    purchase_invoice_id: "",
    remarks: "",
    items: [{ ...defaultItem }],
    gross_total: 0,
    discount_percentage: 0,
    discount_amount: 0,
    tax_percentage: 0,
    tax_amount: 0,
    total: 0,
  });

  const [suppliers, setSuppliers] = useState([]);
  const refreshProducts = async (q = "") => {
    // In invoice mode, do not override the restricted product list
    if (form.purchase_invoice_id) return;
    try {
      const { data } = await axios.get("/api/products/search", { params: { q, limit: 30 } });
      setProducts(Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : []);
    } catch (e) {}
  };

  const [catalogProducts, setCatalogProducts] = useState([]);
  const [products, setProducts] = useState([]);
  const [purchaseInvoices, setPurchaseInvoices] = useState([]);

  const [invoiceItems, setInvoiceItems] = useState([]);
  // Per-row batch options to avoid cross-row interference
  const [rowBatches, setRowBatches] = useState([]);

  const [currentField, setCurrentField] = useState(null);
  const [currentRowIndex, setCurrentRowIndex] = useState(0);

  // per-row validation flags
  const [rowErrors, setRowErrors] = useState([]); // [{ product: false, batch: false }]

  // Track react-select menu state to mimic SaleReturn behavior
  const [invoiceMenuOpen, setInvoiceMenuOpen] = useState(false);

  // ===== refs =====
  const supplierSelectRef = useRef(null);
  const purchaseInvoiceRef = useRef(null);
  const productSearchRefs = useRef([]);
  const packQuantityRefs = useRef([]);
  const packPurchasePriceRefs = useRef([]);
  const itemDiscountRefs = useRef([]);

  // OPEN RETURN: cache of product → list of batches fetched from server
  const productBatchCache = useRef(new Map()); // Map<string(productId), Array<{batch_number, expiry, available_units, pack_size?}>

  useEffect(() => {
    productSearchRefs.current = productSearchRefs.current.slice(0, form.items.length);
    packQuantityRefs.current = packQuantityRefs.current.slice(0, form.items.length);
    packPurchasePriceRefs.current = packPurchasePriceRefs.current.slice(0, form.items.length);
    itemDiscountRefs.current = itemDiscountRefs.current.slice(0, form.items.length);
  }, [form.items.length]);

  // keep rowErrors aligned with items length
  useEffect(() => {
    setRowErrors((prev) => {
      const next = prev.slice(0, form.items.length);
      while (next.length < form.items.length) next.push({ product: false, batch: false });
      return next;
    });
  }, [form.items.length]);

  // keep rowBatches aligned with items length
  useEffect(() => {
    setRowBatches((prev) => {
      const next = prev.slice(0, form.items.length);
      while (next.length < form.items.length) next.push([]);
      return next;
    });
  }, [form.items.length]);

  // ===== helpers =====
  const toNum = (v) => (v === undefined || v === null || v === "" ? 0 : Number(v));
  const firstDefined = (...vals) => vals.find((v) => v !== undefined && v !== null);
  const eqPid = (a, b) => String(a ?? "") === String(b ?? "");

  const setBatchesForRow = (rowIndex, list) => {
    setRowBatches((prev) => {
      const next = prev.slice();
      next[rowIndex] = Array.isArray(list) ? list : [];
      return next;
    });
  };

  const setRowError = (idx, field) => {
    setRowErrors((prev) => {
      const next = prev.slice();
      if (!next[idx]) next[idx] = { product: false, batch: false };
      next[idx][field] = true;
      return next;
    });
  };
  const clearRowError = (idx, field) => {
    setRowErrors((prev) => {
      const next = prev.slice();
      if (!next[idx]) next[idx] = { product: false, batch: false };
      next[idx][field] = false;
      return next;
    });
  };

  // === duplicate helpers ===
  const findDuplicateProductIndex = (pid, exceptIndex = -1) =>
    form.items.findIndex((it, idx) => idx !== exceptIndex && eqPid(it?.product_id, pid));

  const findDuplicateProductBatchIndex = (pid, batch, exceptIndex = -1) =>
    form.items.findIndex(
      (it, idx) =>
        idx !== exceptIndex &&
        eqPid(it?.product_id, pid) &&
        String(it?.batch ?? "") === String(batch ?? "")
    );

  const sumBy = (rows, get) => rows.reduce((s, r) => s + toNum(get(r)), 0);
  const weightedAvg = (rows, valueKey, weightKey = "pack_quantity") => {
    const wSum = sumBy(rows, (r) => r[weightKey]);
    if (!wSum) return 0;
    const vSum = rows.reduce((s, r) => s + toNum(r[valueKey]) * toNum(r[weightKey]), 0);
    return vSum / wSum;
  };
  const mostCommon = (rows, key) => {
    const map = new Map();
    rows.forEach((r) => {
      const k = r[key];
      if (k === undefined || k === null || k === "") return;
      map.set(k, (map.get(k) || 0) + 1);
    });
    let maxK, maxC = -1;
    map.forEach((c, k) => { if (c > maxC) { maxC = c; maxK = k; } });
    return maxK;
  };

  // --- normalize product (richer for ProductSearchInput picker)
  const normalizeProduct = (src) => ({
    id: Number(firstDefined(src?.id, src?.product_id, src?.ProductId, src?.product?.id)),
    name: firstDefined(src?.name, src?.product_name, src?.product?.name, src?.title, src?.label),

    // purchase size / prices
    pack_size: toNum(firstDefined(src?.pack_size, src?.product?.pack_size)),
    pack_purchase_price: toNum(firstDefined(src?.pack_purchase_price, src?.product?.pack_purchase_price)),
    unit_purchase_price: toNum(firstDefined(src?.unit_purchase_price, src?.product?.unit_purchase_price)),

    // sale prices + stock + margin + avg price
    pack_sale_price: toNum(firstDefined(src?.pack_sale_price, src?.product?.pack_sale_price)),
    unit_sale_price: toNum(firstDefined(src?.unit_sale_price, src?.product?.unit_sale_price)),
    quantity: toNum(firstDefined(src?.quantity, src?.product?.quantity)),
    margin: toNum(firstDefined(src?.margin, src?.margin_percentage, src?.product?.margin)),

    avg_price: toNum(
      firstDefined(
        src?.avg_price,
        src?.average_unit_cost,
        src?.average_price,
        src?.avg_unit_price,
        src?.product?.avg_price
      )
    ),

    // relations (for picker columns)
    brand_id: firstDefined(src?.brand_id, src?.product?.brand_id),
    supplier_id: firstDefined(src?.supplier_id, src?.product?.supplier_id),
    brand: firstDefined(src?.brand, src?.product?.brand) || null,
    supplier: firstDefined(src?.supplier, src?.product?.supplier) || null,

    // open-return support
    available_units: toNum(firstDefined(src?.available_units, src?.available_quantity, src?.stock_units, src?.quantity, src?.stock)),
  });

  const productNameById = (pid) => {
    const p =
      products.find((p) => eqPid(firstDefined(p.id, p.value), pid)) ||
      catalogProducts.find((p) => eqPid(firstDefined(p.id, p.value), pid));
    return p?.name || `#${pid}`;
  };

  // Robustly resolve a product id from various shapes
  const resolveProductId = (obj) => {
    if (obj === null || obj === undefined) return "";
    if (typeof obj === "number") return obj;
    if (typeof obj === "string") return obj.trim();
    if (typeof obj === "object") {
      const cand = [
        obj.product_id, obj.id, obj.value, obj.ProductId, obj.productId,
        obj.product?.id, obj.product?.ProductId, obj?.data?.id
      ].find((v) => v !== undefined && v !== null && String(v).trim() !== "");
      return cand ?? "";
    }
    return "";
  };

  const invoiceItemsForProduct = (productId) =>
    invoiceItems.filter((it) => eqPid(it.product_id, productId));

  const buildBatchOptions = (itemsForProduct) => {
    const seen = new Set();
    const opts = [];
    for (const it of itemsForProduct) {
      const b = (it.batch ?? "").toString().trim();
      if (b && !seen.has(b)) {
        seen.add(b);
        opts.push({
          batch_number: b,
          expiry: it.expiry || "",
          pack_quantity: toNum(it.pack_quantity),
          pack_size: toNum(it.pack_size),
          pack_purchase_price: toNum(it.pack_purchase_price),
          unit_purchase_price: toNum(it.unit_purchase_price),
          item_discount_percentage: toNum(it.item_discount_percentage),
        });
      }
    }
    return opts;
  };

  // productHasBatches must work in both modes
  const productHasBatches = (pid) => {
    if (form.purchase_invoice_id) {
      const opts = buildBatchOptions(invoiceItemsForProduct(pid));
      return opts.length > 0;
    }
    const cached = productBatchCache.current.get(String(pid));
    return Array.isArray(cached) && cached.length > 0;
  };

  const focusProductSearch = (row) => {
    setTimeout(() => {
      productSearchRefs.current[row]?.querySelector("input")?.focus?.();
      setCurrentField("product");
      setCurrentRowIndex(row);
    }, 50);
  };
  const focusOnField = (key, row) => {
    setTimeout(() => {
      if (key === "pack_quantity" && packQuantityRefs.current[row]) packQuantityRefs.current[row].focus();
      else if (key === "pack_purchase_price" && packPurchasePriceRefs.current[row]) packPurchasePriceRefs.current[row].focus();
      else if (key === "item_discount" && itemDiscountRefs.current[row]) itemDiscountRefs.current[row].focus();
      setCurrentField(key);
      setCurrentRowIndex(row);
    }, 50);
  };

  // Helper: advance focus to first product field
  const advanceToFirstProduct = () => {
    setTimeout(() => {
      const el = productSearchRefs.current?.[0]?.querySelector?.("input");
      if (el) {
        el.focus();
        if (typeof el.select === "function") el.select();
      }
      setCurrentField("product");
      setCurrentRowIndex(0);
    }, 0);
  };

  // ===== initial loads =====
  useEffect(() => {
    (async () => {
      try {
        const [supRes, prodRes, codeRes] = await Promise.all([
          axios.get("/api/suppliers"),
          axios.get("/api/products/search", { params: { q: "", limit: 30 } }),
          axios.get("/api/purchase-returns/new-code"),
        ]);
        setSuppliers(supRes.data || []);
        const catalog = Array.isArray(prodRes?.data?.data) ? prodRes.data.data : Array.isArray(prodRes?.data) ? prodRes.data : [];
        setCatalogProducts(catalog);
        setProducts(catalog); // until an invoice is chosen
        setForm((prev) => ({ ...prev, posted_number: codeRes.data?.posted_number || codeRes.data?.code || "" }));
      } catch (err) { console.error(err); }
    })();
  }, []);

  useEffect(() => {
    if (!returnId) return;
    (async () => {
      try {
        const res = await axios.get(`/api/purchase-returns/${returnId}`);
        const data = res.data || {};
        const items = Array.isArray(data.items) && data.items.length ? data.items : [{ ...defaultItem }];
        const normalized = {
          posted_number: data.posted_number || data.code || "",
          date: data.date || new Date().toISOString().slice(0, 10),
          supplier_id: data.supplier_id || "",
          purchase_invoice_id: data.purchase_invoice_id || "",
          remarks: data.remarks || "",
          items: items.map((it) => ({ ...defaultItem, ...it })),
          gross_total: toNum(data.gross_total),
          discount_percentage: toNum(data.discount_percentage),
          discount_amount: toNum(data.discount_amount),
          tax_percentage: toNum(data.tax_percentage),
          tax_amount: toNum(data.tax_amount),
          total: toNum(data.total),
        };
        setForm((prev) => recalcFooter({ ...prev, ...normalized }, "init"));
        if (normalized.supplier_id) await fetchPurchaseInvoices(normalized.supplier_id);
        if (normalized.purchase_invoice_id) await loadInvoice(normalized.purchase_invoice_id);
      } catch (err) { console.error(err); }
    })();
  }, [returnId]);

  // Focus Supplier first when creating a new return
  useEffect(() => {
    if (!returnId) {
      setTimeout(() => supplierSelectRef.current?.focus?.(), 100);
    }
  }, [returnId]);

  // Alt+S to save
  useEffect(() => {
    const keyHandler = (e) => {
      if (e.altKey && (e.key === "s" || e.key === "S")) {
        e.preventDefault();
        handleSubmit();
      }
    };
    document.addEventListener("keydown", keyHandler);
    return () => document.removeEventListener("keydown", keyHandler);
  }, [form, purchaseInvoices, products, invoiceItems]);

  // ===== fetchers =====
  const fetchPurchaseInvoices = async (supplierId) => {
    if (!supplierId) { setPurchaseInvoices([]); return; }
    try {
      const res = await axios.get(`/api/purchase-invoices?supplier_id=${supplierId}`);
      setPurchaseInvoices(res.data || []);
    } catch (err) { console.error(err); }
  };

  const fetchProductDetailsForIds = async (ids) => {
    if (!ids?.length) return new Map();
    try {
      const { data } = await axios.get("/api/products/search", {
        params: { ids: ids.join(",") },
      });
      const arr = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
      const map = new Map();
      for (const row of arr) {
        const n = normalizeProduct(row);
        if (n.quantity && !n.available_units) n.available_units = n.quantity;
        map.set(String(n.id), n);
      }
      if (map.size) return map;
    } catch (e) {}
    const map = new Map();
    await Promise.all(ids.map(async (id) => {
      try {
        const res = await axios.get("/api/products/available-quantity", { params: { product_id: id } });
        const units = Number(res?.data?.available_units ?? 0);
        map.set(String(id), { id, quantity: units, available_units: units });
      } catch (e) {
        map.set(String(id), { id, quantity: 0, available_units: 0 });
      }
    }));
    return map;
  };

  const loadInvoice = async (invoiceId) => {
    try {
      const res = await axios.get(`/api/purchase-invoices/${invoiceId}`);
      const items = Array.isArray(res.data?.items) ? res.data.items : [];
      setInvoiceItems(items);

      // Build unique product list from invoice (keep invoice prices)
      const byId = new Map();
      for (const it of items) {
        let p = normalizeProduct(it.product || it);
        if (!p.id || !p.name) continue;
        p.pack_size           = toNum(firstDefined(it.pack_size, p.pack_size));
        p.pack_purchase_price = toNum(firstDefined(it.pack_purchase_price, p.pack_purchase_price));
        p.unit_purchase_price = toNum(firstDefined(it.unit_purchase_price, p.unit_purchase_price));
        if (!byId.has(p.id)) byId.set(p.id, p);
      }
      const invoiceProducts = Array.from(byId.values());
      const ids = invoiceProducts.map(p => p.id);

      // fetch extra details
      const detailsMap = await fetchProductDetailsForIds(ids);
      const merged = invoiceProducts.map((p) => {
        const d = detailsMap.get(String(p.id));
        if (!d) return p;
        return {
          ...p,
          quantity: toNum(firstDefined(p.quantity, d.quantity)),
          available_units: toNum(firstDefined(p.available_units, d.available_units, d.quantity)),
          pack_sale_price: toNum(firstDefined(p.pack_sale_price, d.pack_sale_price)),
          unit_sale_price: toNum(firstDefined(p.unit_sale_price, d.unit_sale_price)),
          margin: toNum(firstDefined(p.margin, d.margin)),
          avg_price: toNum(firstDefined(p.avg_price, d.avg_price)),
          brand_id: firstDefined(p.brand_id, d.brand_id),
          supplier_id: firstDefined(p.supplier_id, d.supplier_id),
          brand: p.brand || d.brand || null,
          supplier: p.supplier || d.supplier || null,
        };
      });
      setProducts(merged.length ? merged : catalogProducts);
    } catch (err) {
      console.error(err);
      setInvoiceItems([]);
      setProducts(catalogProducts);
    }
  };

  // ===== OPEN RETURN: batch fetcher =====
  const normalizeOpenBatch = (src) => ({
    batch_number: String(firstDefined(src?.batch_number, src?.batch, src?.code, src?.number, "")).trim(),
    expiry: firstDefined(src?.expiry, src?.expiration_date, src?.expiry_date, "") || "",
    available_units: toNum(firstDefined(src?.available_units, src?.quantity, src?.available_quantity, src?.units)),
    pack_size: toNum(firstDefined(src?.pack_size, src?.product?.pack_size, 0)),
  });

  const fetchBatchesForOpenReturn = async (productId) => {
    try {
      const res = await axios.get(`/api/products/${productId}/batches`);
      const list = Array.isArray(res.data) ? res.data.map(normalizeOpenBatch).filter(b => b.batch_number) : [];
      productBatchCache.current.set(String(productId), list);
      return list;
    } catch (e) {
      productBatchCache.current.set(String(productId), []);
      return [];
    }
  };

  // -------- availability lookups --------
  const availabilityCache = useRef(new Map()); // key = `${productId}::${batch|ALL}` → units
  const fetchAvailableUnits = async (productId, batchOrNull, fallbackFromCatalog = true) => {
    const key = `${productId}::${batchOrNull ? String(batchOrNull) : "ALL"}`;
    if (availabilityCache.current.has(key)) return availabilityCache.current.get(key);

    if (fallbackFromCatalog && !batchOrNull) {
      const prod =
        products.find((p) => eqPid(firstDefined(p.id, p.value), productId)) ||
        catalogProducts.find((p) => eqPid(firstDefined(p.id, p.value), productId));
      if (prod?.available_units || prod?.available_units === 0) {
        const units = toNum(prod.available_units);
        availabilityCache.current.set(key, units);
        return units;
      }
    }

    try {
      const params = batchOrNull ? { product_id: productId, batch: batchOrNull } : { product_id: productId };
      const res = await axios.get("/api/products/available-quantity", { params });
      const units = toNum(res?.data?.available_units);
      availabilityCache.current.set(key, units);
      return units;
    } catch (e) {
      availabilityCache.current.set(key, 0);
      return 0;
    }
  };

  // Prefer batch list -> fallback to /available-quantity (usable in both modes)
  const getBatchAvailability = async (productId, batchNumber) => {
    const pid = String(productId);
    let list = productBatchCache.current.get(pid);

    if (!Array.isArray(list)) {
      list = await fetchBatchesForOpenReturn(productId);
    }

    const found = Array.isArray(list)
      ? list.find((b) => String(b.batch_number) === String(batchNumber))
      : null;

    if (found && (found.available_units || found.available_units === 0)) {
      return toNum(found.available_units);
    }

    return await fetchAvailableUnits(productId, batchNumber);
  };

  // ===== handlers =====
  const handleChange = (e) => {
    const { name, value } = e.target;
    let next = { ...form, [name]: value };
    if (name === "discount_percentage" || name === "tax_percentage") {
      next = recalcFooter(next, name);
    }
    setForm(next);
  };

  const handleSelectChange = async (field, value) => {
    const v = value?.value ?? value ?? "";
    if (field === "supplier_id") {
      setForm((prev) => ({ ...prev, supplier_id: v, purchase_invoice_id: "" }));
      await fetchPurchaseInvoices(v);
      setInvoiceItems([]);
      setRowErrors([]);
      productBatchCache.current = new Map(); // reset open-mode cache
      setRowBatches([]);
      setProducts(catalogProducts);
      setForm((prev) => {
        const items = prev.items.map((it) => ({
          ...it,
          product_id: "",
          batch: "",
          expiry: "",
          pack_size: 0,
          pack_purchased_quantity: 0,
          available_units: 0,
          return_pack_quantity: 0,
          return_unit_quantity: 0,
          pack_purchase_price: 0,
          unit_purchase_price: 0,
          item_discount_percentage: 0,
        }));
        return recalcFooter({ ...prev, items }, "supplier_change");
      });
      setTimeout(() => purchaseInvoiceRef.current?.focus?.(), 50);
      return;
    }

    if (field === "purchase_invoice_id") {
      const id = v;
      setForm((prev) => ({ ...prev, purchase_invoice_id: id }));
      if (id) {
        await loadInvoice(id);
      } else {
        setInvoiceItems([]);
        setProducts(catalogProducts);
      }
      setRowErrors([]);
      productBatchCache.current = new Map();
      setRowBatches([]);
      setForm((prev) => {
        const items = prev.items.map((it) => ({
          ...it,
          batch: "",
          expiry: "",
          pack_purchased_quantity: 0,
          available_units: 0,
          return_pack_quantity: 0,
          return_unit_quantity: 0,
          item_discount_percentage: 0,
        }));
        return recalcFooter({ ...prev, items }, "invoice_change");
      });

      // After selecting an invoice, go to the first Product search
      setTimeout(() => {
        const el = productSearchRefs.current?.[0]?.querySelector?.("input");
        if (el) {
          el.focus();
          if (typeof el.select === "function") el.select();
        }
        setCurrentField("product");
        setCurrentRowIndex(0);
      }, 50);

      return;
    }
  };

  const handleProductSelect = async (index, productIdOrObj) => {
    const pidRaw = resolveProductId(productIdOrObj);
    const pidStr = String(pidRaw || "").trim();
    if (!pidStr) return;

    const selFrom = (arr, id) =>
      arr.find((p) => String(p.id ?? p.value ?? "") === id);
    const selected =
      selFrom(products, pidStr) || selFrom(catalogProducts, pidStr) || productIdOrObj;
    const selectedId = resolveProductId(selected);

    const isInvoiceMode = !!form.purchase_invoice_id;
    const itemsForProduct = isInvoiceMode ? invoiceItemsForProduct(selectedId) : [];
    const batchOptsInvoice = isInvoiceMode ? buildBatchOptions(itemsForProduct) : [];

    // Set product early and reset dependent fields
    const newItems = [...form.items];
    const base = {
      ...newItems[index],
      product_id: selectedId,
      batch: "",
      expiry: "",
      pack_size: toNum(firstDefined(selected?.pack_size, newItems[index].pack_size)),
      pack_purchase_price: toNum(firstDefined(selected?.pack_purchase_price, newItems[index].pack_purchase_price)),
      unit_purchase_price: toNum(firstDefined(selected?.unit_purchase_price, newItems[index].unit_purchase_price)),
      pack_purchased_quantity: 0,
      available_units: 0,
      return_pack_quantity: 0,
      return_unit_quantity: 0,
      item_discount_percentage: 0,
    };

    let updated = recalcItem(base, "product_id");
    updated.product_id = selectedId;
    newItems[index] = updated;
    setForm((prev) => recalcFooter({ ...prev, items: newItems }, "items"));

    if (!isInvoiceMode) {
      // OPEN RETURN
      const openBatches = await fetchBatchesForOpenReturn(selectedId);

      if (openBatches.length === 0) {
        // uniqueness (no batch scenario)
        const dupPI = findDuplicateProductIndex(selectedId, index);
        if (dupPI !== -1) {
          toast.error(`Duplicate product "${productNameById(selectedId)}" already used in row ${dupPI + 1}.`);
          setRowError(index, "product");
          focusProductSearch(index);
          return;
        } else {
          clearRowError(index, "product");
        }

        // No batches → product-level availability
        const totalAvail = await fetchAvailableUnits(selectedId, null);
        newItems[index] = recalcItem(
          { ...newItems[index], available_units: toNum(totalAvail) },
          "set_available_units_no_batch_open"
        );
        setBatchesForRow(index, []);
        setForm((prev) => recalcFooter({ ...prev, items: newItems }, "items"));
        focusOnField("pack_quantity", index);
        return;
      }

      // Has batches in open mode
      clearRowError(index, "product");
      setBatchesForRow(index, openBatches);
      if (openBatches.length === 1) {
        const b = openBatches[0];
        const dupPB = findDuplicateProductBatchIndex(selectedId, b.batch_number, index);
        if (dupPB !== -1) {
          toast.error(`Row ${dupPB + 1} already has "${productNameById(selectedId)}" with batch "${b.batch_number}".`);
          setRowError(index, "batch");
          focusProductSearch(index);
          return;
        }
        const availUnits = toNum(firstDefined(b.available_units, await fetchAvailableUnits(selectedId, b.batch_number)));
        newItems[index] = recalcItem(
          {
            ...newItems[index],
            product_id: selectedId,
            batch: b.batch_number,
            expiry: b.expiry || "",
            pack_size: toNum(firstDefined(newItems[index].pack_size, b.pack_size, 0)),
            available_units: availUnits,
          },
          "open_batch_auto_apply"
        );
        clearRowError(index, "batch");
        setForm((prev) => recalcFooter({ ...prev, items: newItems }, "items"));
        focusOnField("pack_quantity", index);
        return;
      }

      // Multiple batches → require a batch; show 0 until picked
      newItems[index] = recalcItem({ ...newItems[index], available_units: 0 }, "open_multi_batches_wait");
      setForm((prev) => recalcFooter({ ...prev, items: newItems }, "items"));
      setCurrentField("batch");
      setCurrentRowIndex(index);
      return;
    }

    // INVOICE MODE
    if (batchOptsInvoice.length === 0) {
      // uniqueness (no batch on invoice)
      const dupPI2 = findDuplicateProductIndex(selectedId, index);
      if (dupPI2 !== -1) {
        toast.error(`Duplicate product "${productNameById(selectedId)}" already used in row ${dupPI2 + 1}.`);
        setRowError(index, "product");
        focusProductSearch(index);
        return;
      } else {
        clearRowError(index, "product");
      }

      // No batches for this product on invoice → product-level availability
      const totalAvail = await fetchAvailableUnits(selectedId, null);
      newItems[index] = recalcItem(
        { ...newItems[index], available_units: toNum(totalAvail) },
        "set_available_units_no_batch_invoice"
      );
      setBatchesForRow(index, []);
      setForm((prev) => recalcFooter({ ...prev, items: newItems }, "items"));
      focusOnField("pack_quantity", index);
      return;
    }

    setBatchesForRow(index, batchOptsInvoice);
    clearRowError(index, "product");

    if (batchOptsInvoice.length === 1) {
      const b = batchOptsInvoice[0];
      const dupPB = findDuplicateProductBatchIndex(selectedId, b.batch_number, index);
      if (dupPB !== -1) {
        toast.error(`Row ${dupPB + 1} already has product "${productNameById(selectedId)}" with batch "${b.batch_number}". Choose a different row or batch.`);
        setRowError(index, "batch");
        focusProductSearch(index);
        return;
      }

      const avail = await getBatchAvailability(selectedId, b.batch_number);
      const upd3 = [...form.items];
      upd3[index] = recalcItem(
        {
          ...upd3[index],
          product_id: selectedId,
          batch: b.batch_number,
          expiry: b.expiry || "",
          pack_size: toNum(firstDefined(b.pack_size, upd3[index].pack_size)),
          pack_purchased_quantity: toNum(b.pack_quantity), // reference only
          available_units: toNum(avail),                    // used for validation
          pack_purchase_price: toNum(firstDefined(b.pack_purchase_price, upd3[index].pack_purchase_price)),
          unit_purchase_price: toNum(firstDefined(b.unit_purchase_price, upd3[index].unit_purchase_price)),
          item_discount_percentage: toNum(b.item_discount_percentage),
        },
        "batch_auto_apply_invoice"
      );
      clearRowError(index, "batch");
      setForm((prev) => recalcFooter({ ...prev, items: upd3 }, "items"));
      focusOnField("pack_quantity", index);
      return;
    }

    // Multiple batches on invoice → require batch; show 0 until picked
    newItems[index] = recalcItem({ ...newItems[index], available_units: 0 }, "invoice_multi_batches_wait");
    setForm((prev) => recalcFooter({ ...prev, items: newItems }, "items"));
    setCurrentField("batch");
    setCurrentRowIndex(index);
  };

  const handleBatchSelect = async (index, valueObjOrString) => {
    const rowItem = form.items[index];
    let ensurePid = rowItem?.product_id;

    const batchNumber =
      typeof valueObjOrString === "string"
        ? valueObjOrString
        : valueObjOrString?.value ?? valueObjOrString?.batch ?? valueObjOrString?.batch_number ?? "";

    const bn = String(batchNumber ?? "").trim();

    if ((!ensurePid || String(ensurePid).trim() === "") && form.purchase_invoice_id) {
      const matches = invoiceItems.filter((it) => String(it.batch ?? "") === bn);
      const uniquePids = Array.from(new Set(matches.map((m) => m.product_id))).filter((x) => x !== undefined && x !== null);
      if (uniquePids.length === 1) { ensurePid = uniquePids[0]; }
    }

    // If selecting a batch that duplicates (product+batch) in another row, block.
    if (ensurePid && bn) {
      const dupIndex2 = findDuplicateProductBatchIndex(ensurePid, bn, index);
      if (dupIndex2 !== -1) {
        toast.error(`Duplicate (product + batch) in row ${dupIndex2 + 1}. Use a unique batch for the same product.`);
        setRowError(index, "batch");
        const updDup = [...form.items];
        updDup[index] = recalcItem(
          { ...updDup[index], batch: "", expiry: "", available_units: 0 },
          "duplicate_product_batch_from_batch"
        );
        setForm((prev) => recalcFooter({ ...prev, items: updDup }, "items"));
        setCurrentField("batch");
        setCurrentRowIndex(index);
        return;
      }
    }

    if (!bn) {
      // Clearing batch
      clearRowError(index, "batch");
      const upd = [...form.items];
      if (form.purchase_invoice_id) {
        const hasB = productHasBatches(ensurePid);
        if (hasB) {
          upd[index] = recalcItem({ ...upd[index], batch: "", expiry: "", available_units: 0 }, "batch_cleared_invoice_has_batches");
        } else {
          const totalAvail = await fetchAvailableUnits(ensurePid, null);
          upd[index] = recalcItem({ ...upd[index], batch: "", expiry: "", available_units: toNum(totalAvail) }, "batch_cleared_invoice_no_batches");
        }
      } else {
        const cached = productBatchCache.current.get(String(ensurePid)) || [];
        if (cached.length > 0) {
          upd[index] = recalcItem({ ...upd[index], batch: "", expiry: "", available_units: 0 }, "batch_cleared_open_has_batches");
        } else {
          const totalAvail = await fetchAvailableUnits(ensurePid, null);
          upd[index] = recalcItem({ ...upd[index], batch: "", expiry: "", available_units: toNum(totalAvail) }, "batch_cleared_open_no_batches");
        }
      }
      setForm((prev) => recalcFooter({ ...prev, items: upd }, "items"));
      return;
    }

    // ===== After picking a batch: always show batch-level availability =====
    const upd = [...form.items];
    if (form.purchase_invoice_id) {
      const matched = invoiceItems.find(
        (it) => eqPid(it.product_id, ensurePid) && String(it.batch ?? "") === bn
      );
      if (!matched) {
        toast.error("Selected batch not found on this invoice.");
        return;
      }
      const avail = await getBatchAvailability(ensurePid, bn);
      clearRowError(index, "batch");
      upd[index] = recalcItem(
        {
          ...upd[index],
          product_id: ensurePid,
          batch: bn,
          expiry: matched.expiry || "",
          pack_size: toNum(firstDefined(matched.pack_size, upd[index].pack_size)),
          pack_purchased_quantity: toNum(matched.pack_quantity),
          available_units: toNum(avail),
          pack_purchase_price: toNum(firstDefined(matched.pack_purchase_price, upd[index].pack_purchase_price)),
          unit_purchase_price: toNum(firstDefined(matched.unit_purchase_price, upd[index].unit_purchase_price)),
          item_discount_percentage: toNum(firstDefined(matched.item_discount_percentage, 0)),
        },
        "batch_selected_invoice"
      );
    } else {
      // open mode — prefer batch list's available_units
      const cached = productBatchCache.current.get(String(ensurePid)) || [];
      const matchedOpen = cached.find((b) => String(b.batch_number) === bn) || null;
      if (!matchedOpen) {
        toast.error("Selected batch not found for this product.");
        return;
      }
      const avail = toNum(firstDefined(matchedOpen.available_units, await fetchAvailableUnits(ensurePid, bn)));
      clearRowError(index, "batch");
      upd[index] = recalcItem(
        {
          ...upd[index],
          product_id: ensurePid,
          batch: bn,
          expiry: matchedOpen.expiry || "",
          pack_size: toNum(firstDefined(upd[index]?.pack_size, matchedOpen.pack_size, 0)),
          available_units: avail,
        },
        "batch_selected_open"
      );
    }
    setForm((prev) => recalcFooter({ ...prev, items: upd }, "items"));
    focusOnField("pack_quantity", index);
  };

  const handleItemChange = (rowIndex, field, rawVal) => {
    const value = rawVal === "" ? "" : Number(rawVal);
    const newItems = [...form.items];
    newItems[rowIndex] = recalcItem({ ...newItems[rowIndex], [field]: value }, field);
    const newForm = recalcFooter({ ...form, items: newItems }, "items");
    setForm(newForm);
  };

  const handleProductKeyDown = (e, rowIndex) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (currentField === "batch") setCurrentRowIndex(rowIndex);
      else focusOnField("pack_quantity", rowIndex);
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (rowIndex === form.items.length - 1) {
        addItem();
        setTimeout(() => focusProductSearch(rowIndex + 1), 150);
      } else {
        focusProductSearch(rowIndex + 1);
      }
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      const prevRow = Math.max(0, rowIndex - 1);
      focusProductSearch(prevRow);
    }
  };

  const handleKeyDown = (e, field, rowIndex) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (field === "pack_quantity") focusOnField("pack_purchase_price", rowIndex);
      else if (field === "pack_purchase_price") focusOnField("item_discount", rowIndex);
      else if (field === "item_discount") {
        if (rowIndex === form.items.length - 1) {
          addItem();
          focusProductSearch(form.items.length);
        } else {
          focusProductSearch(rowIndex + 1);
        }
      }
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (rowIndex === form.items.length - 1) {
        addItem();
        setTimeout(() => focusProductSearch(rowIndex + 1), 150);
      } else {
        const nextRow = Math.min(form.items.length - 1, rowIndex + 1);
        focusOnField(field, nextRow);
      }
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      const prevRow = Math.max(0, rowIndex - 1);
      focusOnField(field, prevRow);
    }
  };

  const addItem = () => {
    const newItem = { ...defaultItem, id: Date.now() + Math.random() };
    setForm((prev) => ({ ...prev, items: [...prev.items, newItem] }));
    setCurrentRowIndex(form.items.length);
  };

  const removeItem = (index) => {
    if (form.items.length <= 1) return;
    const newItems = form.items.filter((_, i) => i !== index);
    const newForm = recalcFooter({ ...form, items: newItems }, "items");
    setForm(newForm);
    setRowErrors((prev) => {
      const next = prev.slice();
      next.splice(index, 1);
      return next;
    });
  };

  // -------- submit with validations --------
  const handleSubmit = async () => {
    try {
      if (!form.supplier_id) {
        toast.error("Please select a supplier");
        supplierSelectRef.current?.focus?.();
        return;
      }

      // Uniqueness validation
      {
        const seen = new Map(); // key → row
        for (let i = 0; i < form.items.length; i++) {
          const it = form.items[i];
          const pid = it?.product_id;
          if (!pid) continue;
          const hasBatches = productHasBatches(pid);
          const batchKey = String(it.batch ?? "");
          const key = hasBatches ? `${pid}::${batchKey}` : `${pid}::__NO_BATCH__`;
          if (seen.has(key)) {
            const firstRow = seen.get(key);
            if (hasBatches && batchKey) {
              toast.error(`Duplicate product & batch in rows ${firstRow + 1} and ${i + 1}. Use a unique batch for the same product.`);
              setRowError(i, "batch");
              setCurrentField("batch"); setCurrentRowIndex(i);
            } else {
              toast.error(`Duplicate product without batch in rows ${firstRow + 1} and ${i + 1}. This product can only appear once when no batch is available.`);
              setRowError(i, "product");
              focusProductSearch(i);
            }
            return;
          }
          seen.set(key, i);
        }
      }

      // Unified quantity validation (Returned units = Unit.Q)
      for (let i = 0; i < form.items.length; i++) {
        const it = form.items[i];
        if (!it.product_id) continue;

        const returnedUnits = toNum(it.return_unit_quantity);

        let available = toNum(it.available_units);
        if (productHasBatches(it.product_id)) {
          if (!it.batch) {
            toast.error(`Row ${i + 1}: Please pick a batch for this product.`);
            setRowError(i, "batch");
            setCurrentField("batch"); setCurrentRowIndex(i);
            return;
          }
          if (!available) {
            available = await getBatchAvailability(it.product_id, it.batch);
          }
        } else {
          if (!available) {
            available = await fetchAvailableUnits(it.product_id, null);
          }
        }
        // Block saving if availability is zero
        if (toNum(available) <= 0) {
          toast.error(`Row ${i + 1}: "${productNameById(it.product_id)}" has Avail.Q (Units) of 0.`);
          if (productHasBatches(it.product_id)) {
            setCurrentField("batch"); setCurrentRowIndex(i);
          } else {
            focusProductSearch(i);
          }
          return;
        }

        if (returnedUnits > toNum(available)) {
          toast.error(`Row ${i + 1}: Returned units (${returnedUnits}) exceed available (${available}).`);
          return;
        }
      }

      // Build payload and save
      const payload = {
        ...form,
        purchase_invoice_id:
          form.purchase_invoice_id && String(form.purchase_invoice_id).trim() !== "" ? form.purchase_invoice_id : null,
        items: form.items
          .filter((it) => it.product_id)
          .map((it) => ({
            ...it,
            pack_size: toNum(it.pack_size),
            pack_purchased_quantity: toNum(it.pack_purchased_quantity),
            available_units: toNum(it.available_units),
            return_pack_quantity: toNum(it.return_pack_quantity),
            return_unit_quantity: toNum(it.return_unit_quantity),
            pack_purchase_price: toNum(it.pack_purchase_price),
            unit_purchase_price: toNum(it.unit_purchase_price),
            item_discount_percentage: toNum(it.item_discount_percentage),
            sub_total: toNum(it.sub_total),
          })),
      };

      if (returnId) {
        await axios.put(`/api/purchase-returns/${returnId}`, payload);
        toast.success("Purchase return updated");
      } else {
        await axios.post(`/api/purchase-returns`, payload);
        toast.success("Purchase return created");
      }

      onSuccess?.();
    } catch (err) {
      console.error(err);
      toast.error("Failed to save purchase return");
    }
  };

  // ===== router (Cancel) =====
  const navigate = useNavigate();
  const INDEX_ROUTE = "/purchase-returns";
  const handleCancel = () => navigate(INDEX_ROUTE);

  // Build invoiceOptions once
  const invoiceOptions = purchaseInvoices.map((inv) => ({
    value: inv.id,
    label: inv.posted_number,
  }));

  // ===== render =====
  return (
    <div className="relative">
      <form className="flex flex-col" style={{ minHeight: "74vh", maxHeight: "80vh" }}>
        {/* ================= HEADER ================= */}
        <div className="sticky top-0 bg-white shadow p-2 z-10">
          <h2 className="text-sm font-bold mb-2">Purchase Return (Use Enter to navigate, Alt+S to save)</h2>
          <table className="w-full border-collapse text-xs">
            <tbody>
              <tr>
                <td className="border p-1 w-1/12">
                  <label className="block text-[10px]">Posted Number</label>
                  <input
                    name="posted_number"
                    type="text"
                    readOnly
                    value={form.posted_number || ""}
                    className="bg-gray-100 border rounded w-full p-1 h-7 text-xs"
                  />
                </td>

                <td className="border p-1 w-1/6">
                  <label className="block text-[10px]">Date</label>
                  <input
                    name="date"
                    type="date"
                    value={form.date}
                    onChange={handleChange}
                    className="border rounded w-full p-1 h-7 text-xs"
                  />
                </td>

                <td className="border p-1 w-1/3">
                  <label className="block text-[10px]">Supplier *</label>
                  <SupplierSearchInput
                    ref={supplierSelectRef}
                    value={form.supplier_id}
                    onChange={(id) => {
                      handleSelectChange("supplier_id", { value: id });
                      setTimeout(() => purchaseInvoiceRef.current?.focus(), 50);
                    }}
                    suppliers={suppliers}
                  />
                </td>

                <td className="border p-1 w-1/3">
                  <label className="block text-[10px]">Purchase Invoice (optional)</label>
                  <Select
                    ref={purchaseInvoiceRef}
                    options={invoiceOptions}
                    value={invoiceOptions.find((inv) => inv.value === form.purchase_invoice_id) || null}
                    onChange={(val) => handleSelectChange("purchase_invoice_id", val)}
                    onMenuOpen={() => setInvoiceMenuOpen(true)}
                    onMenuClose={() => setInvoiceMenuOpen(false)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        // If the menu is CLOSED and nothing is selected, treat Enter as "skip invoice" like SaleReturn
                        if (!invoiceMenuOpen && !form.purchase_invoice_id) {
                          e.preventDefault();
                          // Ensure we're in open-return mode
                          setInvoiceItems([]);
                          setProducts(catalogProducts);
                          productBatchCache.current = new Map();
                          setRowBatches([]);
                          setRowErrors([]);
                          setForm((prev) => recalcFooter(prev));
                          // Focus the first Product
                          advanceToFirstProduct();
                        }
                        // If menu is OPEN, do NOTHING here so react-select can commit the highlighted option.
                        // handleSelectChange will then move focus to Product automatically.
                      }
                    }}
                    isSearchable
                    classNamePrefix="react-select"
                    styles={{
                      control: (base) => ({
                        ...base,
                        minHeight: "28px",
                        height: "28px",
                        fontSize: "12px",
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
                      }),
                    }}
                  />
                </td>

                <td className="border p-1 w-1/4">
                  <label className="block text-[10px]">Remarks</label>
                  <input
                    name="remarks"
                    type="text"
                    value={form.remarks}
                    onChange={handleChange}
                    className="border rounded w-full p-1 h-7 text-xs"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ================= ITEMS ================= */}
        <div className="flex-1 overflow-auto p-1">
          <h2 className="text-xs font-bold mb-1">Items (↑↓ arrows to navigate rows)</h2>

          <table className="w-full border-collapse text-[11px]">
            <thead className="sticky top-0 bg-gray-100 z-5">
              <tr>
                <th rowSpan={2} className="border w-6">#</th>
                <th rowSpan={2} colSpan={1} className="border w-[80px]">Product</th>
                <th colSpan={4} className="border">Pack Size / Batch / Expiry / Available Qty</th>
                <th colSpan={2} className="border">Return Qty (Pack / Unit)</th>
                <th colSpan={2} className="border">Purchase Price (P / U)</th>
                <th colSpan={1} className="border">Disc %</th>
                <th rowSpan={2} className="border w-16">Sub Total</th>
                <th rowSpan={2} className="border w-6">+</th>
              </tr>
              <tr>
                <th className="border w-14">PSize</th>
                <th className="border w-16">Batch</th>
                <th className="border w-20">Exp</th>
                <th className="border w-20">Avail.Q (Units)</th>
                <th className="border w-12">Pack.Q</th>
                <th className="border w-12">Unit.Q</th>
                <th className="border w-14">Pack.P</th>
                <th className="border w-14">Unit.P</th>
                <th className="border w-14">Disc%</th>
              </tr>
            </thead>

            <tbody>
              {form.items.map((item, i) => (
                <tr key={item.id} className="text-center">
                  {/* Remove */}
                  <td className="border">
                    <button
                      type="button"
                      onClick={() => removeItem(i)}
                      className="bg-red-500 text-white px-1 rounded text-[10px]"
                    >
                      X
                    </button>
                  </td>

                  {/* Product Search */}
                  <td colSpan={1} className="border text-left w-[200px]">
                    <div
                      ref={(el) => (productSearchRefs.current[i] = el)}
                      onFocusCapture={() => { if (!form.purchase_invoice_id) refreshProducts(""); }}
                      className={rowErrors[i]?.product ? "ring-2 ring-red-500 rounded" : ""}
                    >
                      <ProductSearchInput
                        value={item.product_id}
                        onChange={(val) => handleProductSelect(i, val)}
                        onKeyDown={(e) => handleProductKeyDown(e, i)}
                        products={products}
                        onRefreshProducts={refreshProducts}
                      />
                    </div>
                  </td>

                  {/* Pack Size */}
                  <td className="border w-14">
                    <input
                      type="number"
                      readOnly
                      value={item.pack_size || ""}
                      className="border bg-gray-100 w-full h-6 text-[11px] px-1 appearance-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </td>

                  {/* Batch */}
                  <td className="border w-16">
                    <div className={rowErrors[i]?.batch ? "ring-2 ring-red-500 rounded" : ""}>
                      <BatchSearchInput
                        ref={(el) => {
                          if (el && currentField === "batch" && currentRowIndex === i) {
                            setTimeout(() => el.focus(), 50);
                          }
                        }}
                        value={item.batch}
                        batches={rowBatches[i] || []}
                        onChange={(batchNumber) => handleBatchSelect(i, { value: batchNumber })}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && item.batch) {
                            e.preventDefault();
                          }
                        }}
                      />
                    </div>
                  </td>

                  {/* Expiry */}
                  <td className="border w-20">
                    <input
                      type="text"
                      readOnly
                      value={item.expiry || ""}
                      className="border bg-gray-100 w-full h-6 text-[11px] px-1"
                    />
                  </td>

                  {/* Available Units */}
                  <td className="border w-20">
                    <input
                      type="number"
                      readOnly
                      value={item.available_units || 0}
                      className="border bg-gray-100 w-full h-6 text-[11px] px-1"
                    />
                  </td>

                  {/* Return Pack Qty */}
                  <td className="border">
                    <input
                      ref={(el) => (packQuantityRefs.current[i] = el)}
                      type="text"
                      value={item.return_pack_quantity === 0 ? "" : item.return_pack_quantity}
                      onChange={(e) => handleItemChange(i, "return_pack_quantity", e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, "pack_quantity", i)}
                      className="border w-full h-6 text-[11px] px-1 appearance-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </td>

                  {/* Return Unit Qty */}
                  <td className="border">
                    <input
                      type="text"
                      value={item.return_unit_quantity === 0 ? "" : item.return_unit_quantity}
                      onChange={(e) => handleItemChange(i, "return_unit_quantity", e.target.value)}
                      className="border w-full h-6 text-[11px] px-1 appearance-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </td>

                  {/* Pack Purchase Price */}
                  <td className="border">
                    <input
                      ref={(el) => (packPurchasePriceRefs.current[i] = el)}
                      type="text"
                      value={item.pack_purchase_price === 0 ? "" : item.pack_purchase_price}
                      onChange={(e) => handleItemChange(i, "pack_purchase_price", e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, "pack_purchase_price", i)}
                      className="border w-full h-6 text-[11px] px-1 appearance-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </td>

                  {/* Unit Purchase Price */}
                  <td className="border">
                    <input
                      type="text"
                      value={item.unit_purchase_price === 0 ? "" : item.unit_purchase_price}
                      onChange={(e) => handleItemChange(i, "unit_purchase_price", e.target.value)}
                      className="border w-full h-6 text-[11px] px-1 appearance-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </td>

                  {/* Item Discount Percentage */}
                  <td className="border">
                    <input
                      ref={(el) => (itemDiscountRefs.current[i] = el)}
                      type="text"
                      value={item.item_discount_percentage === 0 ? "" : item.item_discount_percentage}
                      onChange={(e) => handleItemChange(i, "item_discount_percentage", e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, "item_discount", i)}
                      className="border w-full h-6 text-[11px] px-1 appearance-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </td>

                  {/* Sub Total */}
                  <td className="border">
                    <input
                      type="number"
                      readOnly
                      value={(Number(item.sub_total) || 0).toFixed(2)}
                      className="border bg-gray-100 w-full h-6 text-[11px] px-1 appearance-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </td>

                  {/* Add */}
                  <td className="border">
                    <button
                      type="button"
                      onClick={addItem}
                      className="bg-blue-500 text-white px-1 rounded text-[10px]"
                    >
                      +
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ================= FOOTER ================= */}
        <div className="sticky bottom-0 bg-white shadow p-2 z-10">
          <table className="w-full border-collapse text-xs">
            <tbody>
              <tr>
                <td className="border p-1 w-1/6">
                  <label className="block text-[10px]">Gross Total</label>
                  <input type="number" readOnly value={(Number(form.gross_total) || 0).toFixed(2)} className="border rounded w-full p-1 h-7 text-xs bg-gray-100" />
                </td>

                <td className="border p-1 w-1/6">
                  <label className="block text-[10px]">Discount %</label>
                  <input name="discount_percentage" type="number" value={form.discount_percentage} onChange={handleChange} className="border rounded w-full p-1 h-7 text-xs" />
                </td>

                <td className="border p-1 w-1/6">
                  <label className="block text-[10px]">Discount Amount</label>
                  <input type="number" readOnly value={(Number(form.discount_amount) || 0).toFixed(2)} className="border rounded w-full p-1 h-7 text-xs bg-gray-100" />
                </td>

                <td className="border p-1 w-1/6">
                  <label className="block text-[10px]">Tax %</label>
                  <input name="tax_percentage" type="number" value={form.tax_percentage} onChange={handleChange} className="border rounded w-full p-1 h-7 text-xs" />
                </td>

                <td className="border p-1 w-1/6">
                  <label className="block text-[10px]">Tax Amount</label>
                  <input type="number" readOnly value={(Number(form.tax_amount) || 0).toFixed(2)} className="border rounded w-full p-1 h-7 text-xs bg-gray-100" />
                </td>

                <td className="border p-1 w-1/6 text-right align-middle">
                  <label className="block text-[10px]">Total</label>
                  <input type="number" readOnly value={(Number(form.total) || 0).toFixed(2)} className="border rounded w-full p-1 h-7 text-xs bg-gray-100 text-right" />
                </td>
              </tr>

              <tr>
                <td colSpan={6} className="p-2">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={handleCancel}
                      className="px-6 py-3 rounded text-sm transition bg-gray-200 text-gray-800 hover:bg-gray-300"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSubmit}
                      className="px-8 py-3 rounded text-sm transition bg-green-600 text-white hover:bg-green-700"
                    >
                      {form.returnId || returnId ? "Update Return" : "Create Return"}
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </form>
    </div>
  );
}
