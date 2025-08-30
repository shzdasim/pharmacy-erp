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
    pack_purchased_quantity: 0,
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
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [products, setProducts] = useState([]);
  const [purchaseInvoices, setPurchaseInvoices] = useState([]);

  const [invoiceItems, setInvoiceItems] = useState([]);
  const [batches, setBatches] = useState([]);

  const [currentField, setCurrentField] = useState(null);
  const [currentRowIndex, setCurrentRowIndex] = useState(0);

  // ===== refs =====
  const supplierSelectRef = useRef(null);
  const purchaseInvoiceRef = useRef(null);
  const productSearchRefs = useRef([]);
  const packQuantityRefs = useRef([]);
  const packPurchasePriceRefs = useRef([]);
  const itemDiscountRefs = useRef([]);

  useEffect(() => {
    productSearchRefs.current = productSearchRefs.current.slice(0, form.items.length);
    packQuantityRefs.current = packQuantityRefs.current.slice(0, form.items.length);
    packPurchasePriceRefs.current = packPurchasePriceRefs.current.slice(0, form.items.length);
    itemDiscountRefs.current = itemDiscountRefs.current.slice(0, form.items.length);
  }, [form.items.length]);

  // ===== helpers =====
  const toNum = (v) => (v === undefined || v === null || v === "" ? 0 : Number(v));
  const firstDefined = (...vals) => vals.find((v) => v !== undefined && v !== null);
  const eqPid = (a, b) => String(a ?? "") === String(b ?? "");

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

  const normalizeProduct = (src) => ({
    id: Number(firstDefined(src?.id, src?.product_id, src?.ProductId, src?.product?.id)),
    name: firstDefined(src?.name, src?.product_name, src?.product?.name, src?.title, src?.label),
    pack_size: toNum(firstDefined(src?.pack_size, src?.product?.pack_size)),
    pack_purchase_price: toNum(firstDefined(src?.pack_purchase_price, src?.product?.pack_purchase_price)),
    unit_purchase_price: toNum(firstDefined(src?.unit_purchase_price, src?.product?.unit_purchase_price)),
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

  const productHasBatches = (pid) => {
    if (!form.purchase_invoice_id) return false;
    const opts = buildBatchOptions(invoiceItemsForProduct(pid));
    return opts.length > 0;
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

  // ===== initial loads =====
  useEffect(() => {
    (async () => {
      try {
        const [supRes, prodRes, codeRes] = await Promise.all([
          axios.get("/api/suppliers"),
          axios.get("/api/products"),
          axios.get("/api/purchase-returns/new-code"),
        ]);
        setSuppliers(supRes.data || []);
        const catalog = Array.isArray(prodRes.data) ? prodRes.data : [];
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

  const loadInvoice = async (invoiceId) => {
    try {
      const res = await axios.get(`/api/purchase-invoices/${invoiceId}`);
      const items = Array.isArray(res.data?.items) ? res.data.items : [];
      setInvoiceItems(items);

      const byId = new Map();
      for (const it of items) {
        const p = normalizeProduct(it.product || it);
        if (p.id && p.name && !byId.has(p.id)) {
          p.pack_size = toNum(firstDefined(it.pack_size, p.pack_size));
          p.pack_purchase_price = toNum(firstDefined(it.pack_purchase_price, p.pack_purchase_price));
          p.unit_purchase_price = toNum(firstDefined(it.unit_purchase_price, p.unit_purchase_price));
          byId.set(p.id, p);
        }
      }
      const invoiceProducts = Array.from(byId.values());
      setProducts(invoiceProducts.length ? invoiceProducts : catalogProducts);
    } catch (err) {
      console.error(err);
      setInvoiceItems([]);
      setProducts(catalogProducts);
    }
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
      setBatches([]);
      // Open return default: allow full catalog until invoice chosen
      setProducts(catalogProducts);
      setForm((prev) => {
        const items = prev.items.map((it) => ({
          ...it,
          product_id: "",
          batch: "",
          expiry: "",
          pack_size: 0,
          pack_purchased_quantity: 0,
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
      setForm((prev) => ({ ...prev, purchase_invoice_id: v }));
      if (v) {
        await loadInvoice(v);
      } else {
        // Open return: no invoice selected → show all products
        setInvoiceItems([]);
        setProducts(catalogProducts);
      }
      setBatches([]);
      setForm((prev) => {
        const items = prev.items.map((it) => ({
          ...it,
          batch: "",
          expiry: "",
          pack_purchased_quantity: 0,
          return_pack_quantity: 0,
          return_unit_quantity: 0,
          item_discount_percentage: 0,
        }));
        return recalcFooter({ ...prev, items }, "invoice_change");
      });
      setTimeout(() => {
        productSearchRefs.current[0]?.querySelector("input")?.focus?.();
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
    const batchOpts = isInvoiceMode ? buildBatchOptions(itemsForProduct) : [];

    // Duplicates policy:
    // - If product has NO batches (batchOpts.length === 0), product must be unique.
    // - If product has batches (>=1), allow multiple rows for same product,
    //   but later enforce uniqueness by (product + batch) when batch is chosen.
    if (!isInvoiceMode || batchOpts.length === 0) {
      const dupIndex = findDuplicateProductIndex(selectedId, index);
      if (selectedId && dupIndex !== -1) {
        toast.error(`Product "${productNameById(selectedId)}" already used in row ${dupIndex + 1}. Duplicate not allowed when no batches.`);
        // Clear and refocus
        const cleared = {
          ...form.items[index],
          product_id: "",
          batch: "",
          expiry: "",
          pack_size: 0,
          pack_purchased_quantity: 0,
          return_pack_quantity: 0,
          return_unit_quantity: 0,
          pack_purchase_price: 0,
          unit_purchase_price: 0,
          item_discount_percentage: 0,
          sub_total: 0,
        };
        const itemsCopy = [...form.items];
        itemsCopy[index] = recalcItem(cleared, "duplicate_product_clear_no_batch");
        setForm((prev) => recalcFooter({ ...prev, items: itemsCopy }, "duplicate_product"));
        focusProductSearch(index);
        return;
      }
    }

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
      return_pack_quantity: 0,
      return_unit_quantity: 0,
      item_discount_percentage: 0,
    };

    let updated = recalcItem(base, "product_id");
    updated.product_id = selectedId;
    newItems[index] = updated;
    setForm((prev) => recalcFooter({ ...prev, items: newItems }, "items"));

    
if (!isInvoiceMode || !selectedId) {
    // Open return: show available quantity in packs
    try {
      const available = await fetchAvailableUnits(selectedId, "");
      const packSize = toNum(updated.pack_size);
      const packsAvail = packSize ? (available / packSize) : 0;
      newItems[index] = recalcItem(
        { ...newItems[index], pack_purchased_quantity: toNum(packsAvail) },
        "open_pack_purchased_qty"
      );
      setForm((prev) => recalcFooter({ ...prev, items: newItems }, "items"));
    } catch (_) {
      setForm((prev) => recalcFooter({ ...prev, items: newItems }, "items"));
    }
    setBatches([]);
    focusOnField("pack_quantity", index);
    return;
  }
setBatches(batchOpts);

    if (batchOpts.length === 0) {
      // No batches: fill from invoice aggregates (and keep product unique already enforced above)
      const totalPacks = sumBy(itemsForProduct, (it) => it.pack_quantity);
      const pickedPackSize = toNum(mostCommon(itemsForProduct, "pack_size")) || toNum(updated.pack_size) || 0;
      let avgPackPrice = weightedAvg(itemsForProduct, "pack_purchase_price");
      let avgUnitPrice = weightedAvg(itemsForProduct, "unit_purchase_price");
      const avgDiscPct = weightedAvg(itemsForProduct, "item_discount_percentage");
      if (!avgUnitPrice && pickedPackSize) avgUnitPrice = avgPackPrice / pickedPackSize;
      if (!avgPackPrice && pickedPackSize) avgPackPrice = avgUnitPrice * pickedPackSize;

      const uniqueExpiry = (() => {
        const set = new Set(itemsForProduct.map((it) => (it.expiry || "").toString()));
        return set.size === 1 ? Array.from(set)[0] : "";
      })();

      const upd2 = [...form.items];
      upd2[index] = recalcItem(
        {
          ...upd2[index],
          product_id: selectedId,
          batch: "",
          expiry: uniqueExpiry,
          pack_size: toNum(pickedPackSize),
          pack_purchased_quantity: toNum(totalPacks),
          pack_purchase_price: toNum(avgPackPrice),
          unit_purchase_price: toNum(avgUnitPrice),
          item_discount_percentage: toNum(avgDiscPct),
        },
        "auto_no_batch_fill"
      );
      upd2[index].product_id = selectedId;
      setForm((prev) => recalcFooter({ ...prev, items: upd2 }, "items"));
      focusOnField("pack_quantity", index);
      return;
    }

    if (batchOpts.length === 1) {
      const b = batchOpts[0];
      // If another row already has same (product+batch), block here.
      const dupPB = findDuplicateProductBatchIndex(selectedId, b.batch_number, index);
      if (dupPB !== -1) {
        toast.error(`Row ${dupPB + 1} already has product "${productNameById(selectedId)}" with batch "${b.batch_number}". Choose a different row or batch.`);
        const cleared = {
          ...form.items[index],
          product_id: "",
          batch: "",
          expiry: "",
          pack_size: 0,
          pack_purchased_quantity: 0,
          return_pack_quantity: 0,
          return_unit_quantity: 0,
          pack_purchase_price: 0,
          unit_purchase_price: 0,
          item_discount_percentage: 0,
          sub_total: 0,
        };
        const itemsCopy = [...form.items];
        itemsCopy[index] = recalcItem(cleared, "duplicate_product_batch_auto");
        setForm((prev) => recalcFooter({ ...prev, items: itemsCopy }, "duplicate_product_batch"));
        focusProductSearch(index);
        return;
      }

      const upd3 = [...form.items];
      upd3[index] = recalcItem(
        {
          ...upd3[index],
          product_id: selectedId,
          batch: b.batch_number,
          expiry: b.expiry || "",
          pack_size: toNum(firstDefined(b.pack_size, upd3[index].pack_size)),
          pack_purchased_quantity: toNum(b.pack_quantity),
          pack_purchase_price: toNum(firstDefined(b.pack_purchase_price, upd3[index].pack_purchase_price)),
          unit_purchase_price: toNum(firstDefined(b.unit_purchase_price, upd3[index].unit_purchase_price)),
          item_discount_percentage: toNum(b.item_discount_percentage),
        },
        "batch_auto_apply"
      );
      upd3[index].product_id = selectedId;
      setForm((prev) => recalcFooter({ ...prev, items: upd3 }, "items"));
      focusOnField("pack_quantity", index);
      return;
    }

    // Multiple batches available → user must choose a batch
    setCurrentField("batch");
    setCurrentRowIndex(index);
  };

  const handleBatchSelect = (index, valueObjOrString) => {
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
        // Keep product, clear batch
        const updDup = [...form.items];
        updDup[index] = recalcItem(
          { ...updDup[index], batch: "", expiry: "" },
          "duplicate_product_batch_from_batch"
        );
        setForm((prev) => recalcFooter({ ...prev, items: updDup }, "items"));
        setCurrentField("batch");
        setCurrentRowIndex(index);
        return;
      }
    }

    if (!bn) {
      // Clear batch and dependent fields
      const itemsForProduct = invoiceItemsForProduct(rowItem.product_id);
      const batchOpts = buildBatchOptions(itemsForProduct);
      const upd = [...form.items];
      if (batchOpts.length === 0) {
        const totalPacks = sumBy(itemsForProduct, (it) => it.pack_quantity);
        const pickedPackSize = toNum(mostCommon(itemsForProduct, "pack_size")) || toNum(upd[index].pack_size) || 0;
        const avgDiscPct = weightedAvg(itemsForProduct, "item_discount_percentage");
        upd[index] = recalcItem(
          {
            ...upd[index],
            product_id: ensurePid,
            batch: "",
            expiry: "",
            pack_size: pickedPackSize,
            pack_purchased_quantity: toNum(totalPacks),
            item_discount_percentage: toNum(avgDiscPct),
          },
          "batch_clear_no_batches"
        );
      } else {
        upd[index] = recalcItem(
          { ...upd[index], product_id: ensurePid, batch: "", expiry: "", pack_purchased_quantity: 0, item_discount_percentage: 0 },
          "batch_clear"
        );
      }
      setForm((prev) => recalcFooter({ ...prev, items: upd }, "items"));
      return;
    }

    // Validate that the chosen batch exists on the invoice for that product
    const matched = invoiceItems.find(
      (it) => eqPid(it.product_id, ensurePid) && String(it.batch ?? "") === bn
    );

    if (!matched) {
      toast.error("Selected batch not found on this invoice.");
      return;
    }

    const upd = [...form.items];
    upd[index] = recalcItem(
      {
        ...upd[index],
        product_id: ensurePid,
        batch: bn,
        expiry: matched.expiry || "",
        pack_size: toNum(firstDefined(matched.pack_size, upd[index].pack_size)),
        pack_purchased_quantity: toNum(matched.pack_quantity),
        pack_purchase_price: toNum(firstDefined(matched.pack_purchase_price, upd[index].pack_purchase_price)),
        unit_purchase_price: toNum(firstDefined(matched.unit_purchase_price, upd[index].unit_purchase_price)),
        item_discount_percentage: toNum(firstDefined(matched.item_discount_percentage, 0)),
      },
      "batch_selected"
    );
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
      const nextRow = Math.min(form.items.length - 1, rowIndex + 1);
      focusProductSearch(nextRow);
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
      const nextRow = Math.min(form.items.length - 1, rowIndex + 1);
      focusOnField(field, nextRow);
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
  };

  // -------- availability lookups (open return) --------
  const availabilityCache = useRef(new Map()); // key = `${productId}::${batch||""}` → units
  const fetchAvailableUnits = async (productId, batch, fallbackFromCatalog = true) => {
    const key = `${productId}::${batch || ""}`;
    if (availabilityCache.current.has(key)) return availabilityCache.current.get(key);

    if (fallbackFromCatalog) {
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
      const res = await axios.get("/api/products/available-quantity", {
        params: { product_id: productId, batch: batch || "" },
      });
      const units = toNum(res?.data?.available_units);
      availabilityCache.current.set(key, units);
      return units;
    } catch (e) {
      availabilityCache.current.set(key, 0);
      return 0;
    }
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
      // If product has batches -> uniqueness by (product + batch)
      // If product does not have batches -> product must be unique
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
              setCurrentField("batch"); setCurrentRowIndex(i);
            } else {
              toast.error(`Duplicate product without batch in rows ${firstRow + 1} and ${i + 1}. This product can only appear once when no batch is available.`);
              focusProductSearch(i);
            }
            return;
          }
          seen.set(key, i);
        }
      }

      // Quantity validations
      if (form.purchase_invoice_id) {
        // With invoice: Return Pack Qty ≤ Pack Purchased Qty
        for (let i = 0; i < form.items.length; i++) {
          const it = form.items[i];
          if (!it.product_id) continue;
          if (toNum(it.return_pack_quantity) > toNum(it.pack_purchased_quantity)) {
            toast.error(`Row ${i + 1}: Return Pack Qty cannot exceed Pack Purchased Qty.`);
            packQuantityRefs.current[i]?.focus?.();
            return;
          }
        }
      } else {
        // Open return: Return Unit Qty ≤ available units
        for (let i = 0; i < form.items.length; i++) {
          const it = form.items[i];
          if (!it.product_id) continue;
          const retUnits = toNum(it.return_unit_quantity);
          if (!retUnits) continue;
          const available = await fetchAvailableUnits(it.product_id, it.batch);
          if (retUnits > available) {
            toast.error(`Row ${i + 1}: Return Unit Qty (${retUnits}) exceeds available (${available}).`);
            return;
          }
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
                    options={purchaseInvoices.map((inv) => ({
                      value: inv.id,
                      label: inv.posted_number,
                    }))}
                    value={
                      purchaseInvoices
                        .map((inv) => ({ value: inv.id, label: inv.posted_number }))
                        .find((inv) => inv.value === form.purchase_invoice_id) || null
                    }
                    onChange={(val) => handleSelectChange("purchase_invoice_id", val)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        setTimeout(() => {
                          productSearchRefs.current[0]?.querySelector("input")?.focus();
                        }, 50);
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
                <th colSpan={4} className="border">Pack Size / Batch / Expiry / Pack Purchased Qty</th>
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
                <th className="border w-16">Pack Purchased Qty</th>
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
                    <div ref={(el) => (productSearchRefs.current[i] = el)}>
                      <ProductSearchInput
                        value={item.product_id}
                        onChange={(val) => handleProductSelect(i, val)}
                        onKeyDown={(e) => handleProductKeyDown(e, i)}
                        products={products}
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
                    <BatchSearchInput
                      ref={(el) => {
                        if (el && currentField === "batch" && currentRowIndex === i) {
                          setTimeout(() => el.focus(), 50);
                        }
                      }}
                      value={item.batch}
                      batches={batches}
                      onChange={(batchNumber) => handleBatchSelect(i, { value: batchNumber })}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && item.batch) {
                          e.preventDefault();
                        }
                      }}
                    />
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

                  {/* Pack Purchased Qty */}
                  <td className="border w-16">
                    <input
                      type="number"
                      readOnly
                      value={item.pack_purchased_quantity || ""}
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
