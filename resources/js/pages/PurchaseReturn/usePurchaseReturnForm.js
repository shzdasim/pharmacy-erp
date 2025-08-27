import { useState, useEffect, useRef } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { recalcItem, recalcFooter } from "../../Formula/PurchaseReturn.js";

/**
 * Changes:
 * - Purchase Invoice optional (no submit requirement).
 * - Save-time validation:
 *    • With invoice: Return Pack Qty <= Pack Purchased Qty (per row).
 *    • Without invoice: Return Unit Qty <= available units (fetched from backend).
 * - Discount % auto-populates from invoice item; for no-batch, weighted average.
 */

export default function usePurchaseReturnForm({ returnId, initialData, onSuccess }) {
  // ===== hooks (fixed order) =====
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

  // Refs
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
    // try a few common stock keys so open-return validation can work without extra calls
    available_units: toNum(firstDefined(src?.available_units, src?.available_quantity, src?.stock_units, src?.quantity, src?.stock)),
  });

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
        setProducts(catalog); // invoice optional → search full catalog until invoice chosen
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

      // derive product list from invoice items; fall back to catalog if none
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
      setProducts(catalogProducts); // invoice optional → allow full catalog
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
      if (v) await loadInvoice(v);
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

  const invoiceItemsForProduct = (productId) =>
    invoiceItems.filter((it) => Number(it.product_id) === Number(productId));

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

  const handleProductSelect = async (index, productIdOrObj) => {
    const pid =
      typeof productIdOrObj === "object"
        ? (productIdOrObj?.id ?? productIdOrObj?.value)
        : productIdOrObj;

    const selected =
      products.find((p) => Number(firstDefined(p.id, p.value)) === Number(pid)) ||
      catalogProducts.find((p) => Number(firstDefined(p.id, p.value)) === Number(pid));

    const newItems = [...form.items];
    newItems[index] = recalcItem(
      {
        ...newItems[index],
        product_id: selected?.id || "",
        pack_size: toNum(firstDefined(selected?.pack_size, newItems[index].pack_size)),
        pack_purchase_price: toNum(firstDefined(selected?.pack_purchase_price, newItems[index].pack_purchase_price)),
        unit_purchase_price: toNum(firstDefined(selected?.unit_purchase_price, newItems[index].unit_purchase_price)),
        batch: "",
        expiry: "",
        pack_purchased_quantity: 0,
        return_pack_quantity: 0,
        return_unit_quantity: 0,
        item_discount_percentage: 0,
      },
      "product_id"
    );
    setForm((prev) => recalcFooter({ ...prev, items: newItems }, "items"));

    if (!selected?.id) { setBatches([]); return; }

    // If invoice selected, prepare batch options and auto-fill derived values.
    if (form.purchase_invoice_id) {
      const itemsForProduct = invoiceItemsForProduct(selected.id);
      const batchOpts = buildBatchOptions(itemsForProduct);
      setBatches(batchOpts);

      if (batchOpts.length === 0) {
        // NO batch on invoice → only PackPurchasedQty + prices + pack size + discount(avg)
        const totalPacks = sumBy(itemsForProduct, (it) => it.pack_quantity);
        const pickedPackSize = toNum(mostCommon(itemsForProduct, "pack_size")) || toNum(newItems[index].pack_size) || 0;
        let avgPackPrice = weightedAvg(itemsForProduct, "pack_purchase_price");
        let avgUnitPrice = weightedAvg(itemsForProduct, "unit_purchase_price");
        const avgDiscPct = weightedAvg(itemsForProduct, "item_discount_percentage");
        if (!avgUnitPrice && pickedPackSize) avgUnitPrice = avgPackPrice / pickedPackSize;
        if (!avgPackPrice && pickedPackSize) avgPackPrice = avgUnitPrice * pickedPackSize;

        const uniqueExpiry = (() => {
          const set = new Set(itemsForProduct.map((it) => (it.expiry || "").toString()));
          return set.size === 1 ? Array.from(set)[0] : "";
        })();

        const upd = [...form.items];
        upd[index] = recalcItem(
          {
            ...upd[index],
            batch: "",
            expiry: uniqueExpiry,
            pack_size: pickedPackSize,
            pack_purchased_quantity: toNum(totalPacks),
            pack_purchase_price: toNum(avgPackPrice),
            unit_purchase_price: toNum(avgUnitPrice),
            item_discount_percentage: toNum(avgDiscPct),
          },
          "auto_no_batch_fill"
        );
        setForm((prev) => recalcFooter({ ...prev, items: upd }, "items"));
        focusOnField("pack_quantity", index);
        return;
      }

      if (batchOpts.length === 1) {
        const b = batchOpts[0];
        const upd = [...form.items];
        upd[index] = recalcItem(
          {
            ...upd[index],
            batch: b.batch_number,
            expiry: b.expiry || "",
            pack_size: toNum(firstDefined(b.pack_size, upd[index].pack_size)),
            pack_purchased_quantity: toNum(b.pack_quantity),
            pack_purchase_price: toNum(firstDefined(b.pack_purchase_price, upd[index].pack_purchase_price)),
            unit_purchase_price: toNum(firstDefined(b.unit_purchase_price, upd[index].unit_purchase_price)),
            item_discount_percentage: toNum(b.item_discount_percentage),
          },
          "batch_auto_apply"
        );
        setForm((prev) => recalcFooter({ ...prev, items: upd }, "items"));
        focusOnField("pack_quantity", index);
        return;
      }

      setCurrentField("batch");
      setCurrentRowIndex(index);
    }
  };

  const handleBatchSelect = (index, valueObjOrString) => {
    const rowItem = form.items[index];
    if (!rowItem?.product_id) return;

    const batchNumber =
      typeof valueObjOrString === "string"
        ? valueObjOrString
        : valueObjOrString?.value ?? valueObjOrString?.batch ?? valueObjOrString?.batch_number ?? "";

    if (!batchNumber) {
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
          { ...upd[index], batch: "", expiry: "", pack_purchased_quantity: 0, item_discount_percentage: 0 },
          "batch_clear"
        );
      }
      setForm((prev) => recalcFooter({ ...prev, items: upd }, "items"));
      focusOnField("pack_quantity", index);
      return;
    }

    const matched = invoiceItems.find(
      (it) =>
        Number(it.product_id) === Number(rowItem.product_id) &&
        (it.batch ?? "").toString() === batchNumber
    );

    if (!matched) {
      toast.error("Selected batch not found on this invoice.");
      return;
    }

    const upd = [...form.items];
    upd[index] = recalcItem(
      {
        ...upd[index],
        batch: batchNumber,
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

    // Try to read from catalog product data if present
    if (fallbackFromCatalog) {
      const prod =
        products.find((p) => Number(firstDefined(p.id, p.value)) === Number(productId)) ||
        catalogProducts.find((p) => Number(firstDefined(p.id, p.value)) === Number(productId));
      if (prod?.available_units) {
        availabilityCache.current.set(key, toNum(prod.available_units));
        return toNum(prod.available_units);
      }
    }

    // API lookups:
    try {
      const res = await axios.get("/api/products/available-quantity", {
        params: { product_id: productId, batch: batch || "" },
      });
      const units = toNum(res?.data?.available_units);
      availabilityCache.current.set(key, units);
      return units;
    } catch (e) {
      // graceful fallback
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

      // 1) Validations
      if (form.purchase_invoice_id) {
        // With invoice: Return Pack Qty must not exceed Pack Purchased Qty
        for (let i = 0; i < form.items.length; i++) {
          const it = form.items[i];
          if (!it.product_id) continue;
          const retPack = toNum(it.return_pack_quantity);
          const purchPack = toNum(it.pack_purchased_quantity);
          if (retPack > purchPack) {
            toast.error(`Row ${i + 1}: Return Pack Qty cannot exceed Pack Purchased Qty.`);
            packQuantityRefs.current[i]?.focus?.();
            return;
          }
        }
      } else {
        // Open return: Return Unit Qty must not exceed available units
        for (let i = 0; i < form.items.length; i++) {
          const it = form.items[i];
          if (!it.product_id) continue;
          const retUnits = toNum(it.return_unit_quantity);
          if (!retUnits) continue;
          const available = await fetchAvailableUnits(it.product_id, it.batch);
          if (retUnits > available) {
            toast.error(`Row ${i + 1}: Return Unit Qty (${retUnits}) exceeds available (${available}).`);
            // focus unit quantity input (reuse packQuantityRefs if you have a ref; otherwise leave cursor)
            return;
          }
        }
      }

      // 2) Build payload and save
      const payload = {
        ...form,
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

  return {
    // state
    form,
    suppliers,
    products,
    purchaseInvoices,
    batches,            // [{batch_number, expiry, pack_quantity, pack_size, pack_purchase_price, unit_purchase_price, item_discount_percentage}]
    currentField,
    currentRowIndex,

    // refs
    supplierSelectRef,
    purchaseInvoiceRef,
    productSearchRefs,
    packQuantityRefs,
    packPurchasePriceRefs,
    itemDiscountRefs,

    // handlers
    handleChange,
    handleSelectChange,
    handleItemChange,
    handleProductSelect,
    handleBatchSelect,
    handleProductKeyDown,
    handleKeyDown,
    addItem,
    removeItem,
    handleSubmit,

    // focus helper
    focusOnField,
  };
}
