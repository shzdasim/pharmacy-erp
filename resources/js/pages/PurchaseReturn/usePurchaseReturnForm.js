import { useState, useEffect, useRef } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { recalcItem, recalcFooter } from "../../Formula/PurchaseReturn.js";

/**
 * Behavior tied to your models:
 * - Uses PurchaseInvoice -> items[] (PurchaseInvoiceItem) fields:
 *   product_id, batch, expiry, pack_quantity, pack_size, pack_purchase_price, unit_purchase_price
 * - Pack Purchased Qty comes from invoice items:
 *     • If product has batches on the invoice: choosing a batch sets qty = that row's pack_quantity.
 *     • If product has NO batches on the invoice: qty = SUM(pack_quantity) for that product on the invoice.
 * - Batch options are shaped as { batch_number, expiry, pack_quantity } to satisfy BatchSearchInput.
 * - All hooks are called unconditionally at the top level (no hook-order warnings).
 */

export default function usePurchaseReturnForm({ returnId, initialData, onSuccess }) {
  // ===== stable hooks order (DON'T MOVE) =====
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
  const [catalogProducts, setCatalogProducts] = useState([]); // full catalog
  const [products, setProducts] = useState([]);               // filtered to invoice
  const [purchaseInvoices, setPurchaseInvoices] = useState([]);

  // from selected invoice
  const [invoiceItems, setInvoiceItems] = useState([]);       // PurchaseInvoiceItem[]
  const [batches, setBatches] = useState([]);                 // for current row/product: [{batch_number, expiry, pack_quantity}]

  const [currentField, setCurrentField] = useState(null);
  const [currentRowIndex, setCurrentRowIndex] = useState(0);

  // Refs
  const supplierSelectRef = useRef(null);
  const purchaseInvoiceRef = useRef(null);
  const productSearchRefs = useRef([]);
  const packQuantityRefs = useRef([]);
  const packPurchasePriceRefs = useRef([]);
  const itemDiscountRefs = useRef([]);

  // keep ref arrays aligned
  useEffect(() => {
    productSearchRefs.current = productSearchRefs.current.slice(0, form.items.length);
    packQuantityRefs.current = packQuantityRefs.current.slice(0, form.items.length);
    packPurchasePriceRefs.current = packPurchasePriceRefs.current.slice(0, form.items.length);
    itemDiscountRefs.current = itemDiscountRefs.current.slice(0, form.items.length);
  }, [form.items.length]);
  // ===== end of hooks header =====

  // ===== helpers =====
  const toNum = (v) => (v === undefined || v === null || v === "" ? 0 : Number(v));
  const firstDefined = (...vals) => vals.find((v) => v !== undefined && v !== null);

  const normalizeProduct = (src) => ({
    id: Number(firstDefined(src?.id, src?.product_id, src?.ProductId, src?.product?.id)),
    name: firstDefined(src?.name, src?.product_name, src?.product?.name, src?.title, src?.label),
    pack_size: toNum(firstDefined(src?.pack_size, src?.product?.pack_size)),
    pack_purchase_price: toNum(firstDefined(src?.pack_purchase_price, src?.product?.pack_purchase_price)),
    unit_purchase_price: toNum(firstDefined(src?.unit_purchase_price, src?.product?.unit_purchase_price)),
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
      if (key === "pack_quantity" && packQuantityRefs.current[row]) {
        packQuantityRefs.current[row].focus();
      } else if (key === "pack_purchase_price" && packPurchasePriceRefs.current[row]) {
        packPurchasePriceRefs.current[row].focus();
      } else if (key === "item_discount" && itemDiscountRefs.current[row]) {
        itemDiscountRefs.current[row].focus();
      }
      setCurrentField(key);
      setCurrentRowIndex(row);
    }, 50);
  };

  // ===== initial loads (not conditional hooks) =====
  useEffect(() => {
    const boot = async () => {
      try {
        const [supRes, prodRes, codeRes] = await Promise.all([
          axios.get("/api/suppliers"),
          axios.get("/api/products"),
          axios.get("/api/purchase-returns/new-code"),
        ]);
        setSuppliers(supRes.data || []);
        const catalog = Array.isArray(prodRes.data) ? prodRes.data : [];
        setCatalogProducts(catalog);
        setProducts(catalog); // until invoice is chosen, show all for search
        setForm((prev) => ({ ...prev, posted_number: codeRes.data?.posted_number || codeRes.data?.code || "" }));
      } catch (err) { console.error(err); }
    };
    boot();
  }, []);

  useEffect(() => {
    const loadReturn = async () => {
      if (!returnId) return;
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
        if (normalized.supplier_id) {
          await fetchPurchaseInvoices(normalized.supplier_id);
        }
        if (normalized.purchase_invoice_id) {
          await loadInvoice(normalized.purchase_invoice_id);
        }
      } catch (err) { console.error(err); }
    };
    loadReturn();
  }, [returnId]);

  // ===== data fetchers =====
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

      // build unique products list from invoice items
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
      setProducts(catalogProducts);
      setInvoiceItems([]);
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
      setProducts(catalogProducts); // allow product search until invoice chosen
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
        }));
        return recalcFooter({ ...prev, items }, "supplier_change");
      });
      setTimeout(() => purchaseInvoiceRef.current?.focus?.(), 50);
      return;
    }

    if (field === "purchase_invoice_id") {
      setForm((prev) => ({ ...prev, purchase_invoice_id: v }));
      await loadInvoice(v);
      setBatches([]);
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
    // only truthy batches; shape for BatchSearchInput
    const seen = new Set();
    const opts = [];
    for (const it of itemsForProduct) {
      const b = (it.batch ?? "").toString().trim();
      if (b && !seen.has(b)) {
        seen.add(b);
        opts.push({
          batch_number: b,           // REQUIRED by BatchSearchInput
          expiry: it.expiry || "",
          pack_quantity: toNum(it.pack_quantity),
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
      },
      "product_id"
    );
    setForm((prev) => recalcFooter({ ...prev, items: newItems }, "items"));

    if (!selected?.id) { setBatches([]); return; }

    const itemsForProduct = invoiceItemsForProduct(selected.id);
    const batchOpts = buildBatchOptions(itemsForProduct);
    setBatches(batchOpts);

    if (batchOpts.length === 0) {
      // NO batch on invoice → qty = sum(pack_quantity) for that product
      const totalPacks = itemsForProduct.reduce((sum, it) => sum + toNum(it.pack_quantity), 0);
      const onlyOne = itemsForProduct.length === 1 ? itemsForProduct[0] : null;
      const upd = [...form.items];
      upd[index] = recalcItem(
        {
          ...upd[index],
          batch: "",
          expiry: onlyOne?.expiry || "",
          pack_purchased_quantity: toNum(totalPacks),
        },
        "product_no_batch_qty"
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
          pack_purchased_quantity: toNum(b.pack_quantity),
        },
        "batch_auto_apply"
      );
      setForm((prev) => recalcFooter({ ...prev, items: upd }, "items"));
      focusOnField("pack_quantity", index);
      return;
    }

    setCurrentField("batch");
    setCurrentRowIndex(index);
  };

  const handleBatchSelect = (index, valueObjOrString) => {
    const rowItem = form.items[index];
    if (!rowItem?.product_id) return;

    const batchNumber =
      typeof valueObjOrString === "string"
        ? valueObjOrString
        : valueObjOrString?.value ?? valueObjOrString?.batch ?? valueObjOrString?.batch_number ?? "";

    // clear
    if (!batchNumber) {
      const itemsForProduct = invoiceItemsForProduct(rowItem.product_id);
      const batchOpts = buildBatchOptions(itemsForProduct);
      const upd = [...form.items];
      if (batchOpts.length === 0) {
        const totalPacks = itemsForProduct.reduce((s, it) => s + toNum(it.pack_quantity), 0);
        upd[index] = recalcItem(
          { ...upd[index], batch: "", expiry: "", pack_purchased_quantity: toNum(totalPacks) },
          "batch_clear_no_batches"
        );
      } else {
        upd[index] = recalcItem(
          { ...upd[index], batch: "", expiry: "", pack_purchased_quantity: 0 },
          "batch_clear"
        );
      }
      setForm((prev) => recalcFooter({ ...prev, items: upd }, "items"));
      focusOnField("pack_quantity", index);
      return;
    }

    // match invoice item (product + batch)
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
        pack_purchased_quantity: toNum(matched.pack_quantity),
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

  const handleSubmit = async () => {
    try {
      if (!form.supplier_id) {
        toast.error("Please select a supplier");
        supplierSelectRef.current?.focus?.();
        return;
      }
      if (!form.purchase_invoice_id) {
        toast.error("Please select a purchase invoice");
        purchaseInvoiceRef.current?.focus?.();
        return;
      }

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
    products,           // filtered list for ProductSearchInput
    purchaseInvoices,
    batches,            // [{batch_number, expiry, pack_quantity}]
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
