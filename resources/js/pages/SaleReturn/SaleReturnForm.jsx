// src/pages/sales-returns/SaleReturnForm.jsx
// Unit-based Sale Return (open return & invoice return modes)
// Tweaks applied earlier + new ones:
// A) Enter on invoice select respects open/close, prevents skipping.
// B) Invoice mode keeps rich product data.
// C) Open return shows Available Qty (and column title changes dynamically).
// D) Footer fields blank-when-zero; empty treated as 0.
// E) Prevent duplicate products across rows; prevent duplicate (product+batch) pairs.
// F) Validate return qty <= allowed; highlight red; block save.
// G) Arrow ↑/↓ navigation across rows for Product/Batch/Qty/Disc. ArrowDown on last row in Qty/Disc adds row and focuses next row Product.

import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import Select from "react-select";

import ProductSearchInput from "../../components/ProductSearchInput.jsx";
import BatchSearchInput from "../../components/BatchSearchInput.jsx";

// ===== helpers =====
const toNum = (v) => (v === undefined || v === null || v === "" ? 0 : Number(v));
const round2 = (n) => (Number.isFinite(Number(n)) ? Number(Number(n).toFixed(2)) : 0);
const eqId = (a, b) => String(a ?? "") === String(b ?? "");

// try multiple possible keys for unit price
const extractUnitPrice = (obj) => {
  if (!obj) return 0;
  const candidates = [
    obj.unit_sale_price,
    obj.unit_price,
    obj.sale_price,
    obj.unit_selling_price,
    obj.price,
    obj.unitRate,
  ];
  const packPrice = obj.pack_sale_price ?? obj.pack_price;
  const packSize = obj.pack_size ?? obj.size ?? obj.units_per_pack;
  if ((packPrice ?? null) !== null && toNum(packPrice) > 0 && toNum(packSize) > 0) {
    candidates.push(toNum(packPrice) / toNum(packSize));
  }
  for (const c of candidates) {
    const n = toNum(c);
    if (n > 0) return n;
  }
  return 0;
};

const extractItemDiscPct = (obj) => {
  if (!obj) return 0;
  const candidates = [
    obj.item_discount_percentage,
    obj.discount_percentage,
    obj.line_discount_percentage,
    obj.item_discount,
    obj.discount,
  ];
  for (const c of candidates) {
    const n = toNum(c);
    if (n > 0) return n;
  }
  return 0;
};

const extractUnitSaleQty = (obj) => {
  if (!obj) return 0;
  const candidates = [obj.unit_sale_quantity, obj.unit_quantity, obj.quantity, obj.units];
  for (const c of candidates) {
    const n = toNum(c);
    if (n > 0) return n;
  }
  return 0;
};

const extractBatchQty = (b) =>
  toNum(
    b?.available_quantity ?? b?.quantity_available ?? b?.available_units ?? b?.on_hand ?? b?.stock ?? b?.balance ?? b?.qty ?? b?.quantity
  );

// subtotal = qty * unit_price - (line discount %)
function recalcItem(item) {
  const qty = toNum(item.unit_return_quantity);
  const price = toNum(item.unit_sale_price);
  const discPct = toNum(item.item_discount_percentage);
  const gross = qty * price;
  const discAmt = (gross * discPct) / 100;
  return { ...item, sub_total: round2(gross - discAmt) };
}

/**
 * Recalculate footer totals.
 * `source` controls which side is authoritative for discount/tax ("pct" or "amt").
 */
function recalcFooter(form, source = {}) {
  const items = Array.isArray(form.items) ? form.items : [];
  const gross = items.reduce((s, it) => s + toNum(it.sub_total), 0);

  let discPct = toNum(form.discount_percentage);
  let discAmt = toNum(form.discount_amount);

  if (source.disc === "pct") {
    discAmt = (gross * discPct) / 100;
  } else if (source.disc === "amt") {
    discPct = gross > 0 ? (discAmt / gross) * 100 : 0;
  } else {
    if (discPct !== 0) discAmt = (gross * discPct) / 100;
    else discPct = gross > 0 ? (discAmt / gross) * 100 : 0;
  }

  const taxable = gross - discAmt;

  let taxPct = toNum(form.tax_percentage);
  let taxAmt = toNum(form.tax_amount);

  if (source.tax === "pct") {
    taxAmt = (taxable * taxPct) / 100;
  } else if (source.tax === "amt") {
    taxPct = taxable > 0 ? (taxAmt / taxable) * 100 : 0;
  } else {
    if (taxPct !== 0) taxAmt = (taxable * taxPct) / 100;
    else taxPct = taxable > 0 ? (taxAmt / taxable) * 100 : 0;
  }

  return {
    ...form,
    gross_total: round2(gross),
    discount_percentage: round2(discPct),
    discount_amount: round2(discAmt),
    tax_percentage: round2(taxPct),
    tax_amount: round2(taxAmt),
    total: round2(taxable + taxAmt),
  };
}

export default function SaleReturnForm({ returnId, initialData, onSuccess }) {
  const defaultItem = {
    id: Date.now() + Math.random(),
    product_id: "",
    batch_number: "",
    expiry: "",
    unit_sale_quantity: 0, // READONLY, from invoice; available qty in open return
    unit_sale_price: 0, // READONLY, from invoice OR product
    unit_return_quantity: 0,
    item_discount_percentage: 0,
    sub_total: 0,
  };

  const [form, setForm] = useState({
    posted_number: "",
    date: new Date().toISOString().slice(0, 10),
    customer_id: "",
    sale_invoice_id: "", // optional
    items: [{ ...defaultItem }],
    discount_percentage: 0,
    discount_amount: 0,
    tax_percentage: 0,
    tax_amount: 0,
    gross_total: 0,
    total: 0,
  });

  const [customers, setCustomers] = useState([]);
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [products, setProducts] = useState([]);
  const [saleInvoices, setSaleInvoices] = useState([]);
  const [invoiceItems, setInvoiceItems] = useState([]);
  const [rowBatches, setRowBatches] = useState([]);

  const [invoiceMenuOpen, setInvoiceMenuOpen] = useState(false);

  const customerSelectRef = useRef(null);
  const saleInvoiceRef = useRef(null);
  const productRefs = useRef([]);
  const batchRefs = useRef([]);
  const qtyRefs = useRef([]);
  const discRefs = useRef([]);

  const productBatchCache = useRef(new Map()); // productId -> [{batch_number, expiry}]

  useEffect(() => {
    productRefs.current = productRefs.current.slice(0, form.items.length);
    batchRefs.current = batchRefs.current.slice(0, form.items.length);
    qtyRefs.current = qtyRefs.current.slice(0, form.items.length);
    discRefs.current = discRefs.current.slice(0, form.items.length);
    setRowBatches((prev) => {
      const next = prev.slice(0, form.items.length);
      while (next.length < form.items.length) next.push([]);
      return next;
    });
  }, [form.items.length]);

  // Init loads
  useEffect(() => {
    (async () => {
      try {
        const [custRes, prodRes, codeRes] = await Promise.all([
          axios.get("/api/customers"),
          axios.get("/api/products"),
          axios.get("/api/sale-returns/new-code"),
        ]);
        const customersArr = Array.isArray(custRes.data) ? custRes.data : [];
        setCustomers(customersArr);

        const catalog = Array.isArray(prodRes.data) ? prodRes.data : [];
        setCatalogProducts(catalog);
        setProducts(catalog);

        setForm((prev) => ({ ...prev, posted_number: codeRes?.data?.posted_number || "" }));

        if (customersArr.length) {
          const firstId = customersArr[0]?.id;
          setForm((prev) => ({ ...prev, customer_id: firstId }));
          await fetchSaleInvoices(firstId);
        }

        if (!returnId) setTimeout(() => saleInvoiceRef.current?.focus?.(), 50);
      } catch (e) {
        console.error(e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If editing, normalize incoming data to unit-based fields
  useEffect(() => {
    if (!returnId) return;
    (async () => {
      try {
        const res = await axios.get(`/api/sale-returns/${returnId}`);
        const data = res.data || {};
        const items = Array.isArray(data.items) ? data.items : [];
        const normalized = {
          posted_number: data.posted_number || "",
          date: data.date || new Date().toISOString().slice(0, 10),
          customer_id: data.customer_id || "",
          sale_invoice_id: data.sale_invoice_id || "",
          items: items.length
            ? items.map((it) => ({
                ...defaultItem,
                product_id: it.product_id,
                batch_number: it.batch_number || it.batch || "",
                expiry: it.expiry || "",
                unit_sale_quantity: toNum(it.unit_sale_quantity),
                unit_sale_price: toNum(it.unit_sale_price),
                unit_return_quantity: toNum(it.unit_return_quantity),
                item_discount_percentage: toNum(it.item_discount_percentage),
                sub_total: toNum(it.sub_total),
                id: Date.now() + Math.random(),
              }))
            : [{ ...defaultItem }],
          discount_percentage: toNum(data.discount_percentage),
          discount_amount: toNum(data.discount_amount),
          tax_percentage: toNum(data.tax_percentage),
          tax_amount: toNum(data.tax_amount),
          gross_total: toNum(data.gross_total),
          total: toNum(data.total),
        };

        setForm((prev) => recalcFooter({ ...prev, ...normalized }));

        if (normalized.customer_id) await fetchSaleInvoices(normalized.customer_id);
        if (normalized.sale_invoice_id) await loadInvoice(normalized.sale_invoice_id);
      } catch (e) {
        console.error(e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [returnId]);

  // Alt+S quick save
  useEffect(() => {
    const onKey = (e) => {
      if (e.altKey && (e.key === "s" || e.key === "S")) {
        e.preventDefault();
        handleSubmit();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form]);

  const fetchSaleInvoices = async (customerId) => {
    if (!customerId) {
      setSaleInvoices([]);
      return;
    }
    try {
      const res = await axios.get(`/api/sale-invoices?customer_id=${customerId}`);
      setSaleInvoices(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      setSaleInvoices([]);
    }
  };

  const loadInvoice = async (invoiceId) => {
    try {
      const res = await axios.get(`/api/sale-invoices/${invoiceId}`);
      const items = Array.isArray(res.data?.items) ? res.data.items : [];
      setInvoiceItems(items);

      // Reduce product list to only invoice items, merging with full catalog product object.
      const byId = new Map();
      for (const it of items) {
        const pid = Number(it?.product_id || it?.product?.id || it?.id);
        if (!pid) continue;
        const name = it?.product?.name || it?.product_name || it?.name || `#${pid}`;
        const unit_sale_price = extractUnitPrice(it);
        const item_discount_percentage = extractItemDiscPct(it);
        const unit_sale_quantity = extractUnitSaleQty(it);
        byId.set(pid, { id: pid, name, unit_sale_price, item_discount_percentage, unit_sale_quantity });
      }
      const invoiceProductsLite = Array.from(byId.values());

      const catalogById = new Map(
        (catalogProducts || []).map((p) => [String(p.id ?? p.value ?? p.product_id ?? p?.data?.id), p])
      );
      const merged = invoiceProductsLite.map((p) => {
        const base = catalogById.get(String(p.id)) || {};
        return {
          ...base,
          id: p.id,
          name: base.name ?? p.name,
          unit_sale_price: p.unit_sale_price ?? extractUnitPrice(base),
          item_discount_percentage: p.item_discount_percentage ?? extractItemDiscPct(base),
          unit_sale_quantity: p.unit_sale_quantity, // from invoice
        };
      });

      setProducts(merged.length ? merged : catalogProducts);
    } catch (e) {
      console.error(e);
      setInvoiceItems([]);
      setProducts(catalogProducts);
    }
  };

  const fetchBatchesForOpenReturn = async (productId) => {
    try {
      const res = await axios.get(`/api/products/${productId}/batches`);
      const rows = Array.isArray(res.data) ? res.data : [];
      const normalized = rows
        .map((b) => ({
          batch_number: String(b.batch_number ?? b.batch ?? b.code ?? "").trim(),
          expiry: String(b.expiry ?? b.expiry_date ?? "").trim(),
          available_units: extractBatchQty(b),
        }))
        .filter((b) => b.batch_number);
      productBatchCache.current.set(String(productId), normalized);
      return normalized;
    } catch (e) {
      productBatchCache.current.set(String(productId), []);
      return [];
    }
  };

  const fetchProductUnitPrice = async (pid) => {
    try {
      const res = await axios.get(`/api/products/${pid}`);
      const data = res.data || {};
      const fromApi = extractUnitPrice(data);
      if (fromApi > 0) return fromApi;
    } catch (e) {
      // ignore
    }
    const local =
      extractUnitPrice(products.find((p) => String(p.id ?? p.value) === String(pid))) ||
      extractUnitPrice(catalogProducts.find((p) => String(p.id ?? p.value) === String(pid)));
    return toNum(local);
  };

  // available qty (best-effort): try product API, then sum batches, then local cache
  const fetchProductAvailableQty = async (pid) => {
    try {
      const res = await axios.get(`/api/products/${pid}`);
      const d = res.data || {};
      const cands = [
        d.available_quantity,
        d.quantity_available,
        d.available_units,
        d.on_hand,
        d.stock,
        d.inventory,
        d.balance,
        d.qty,
        d.quantity,
      ];
      for (const c of cands) {
        const n = toNum(c);
        if (n > 0) return n;
      }
    } catch (e) {}
    try {
      const res = await axios.get(`/api/products/${pid}/batches`);
      const rows = Array.isArray(res.data) ? res.data : [];
      const total = rows.reduce((s, b) => s + extractBatchQty(b), 0);
      if (total > 0) return total;
    } catch (e) {}
    const local =
      products.find((p) => String(p.id ?? p.value) === String(pid)) ||
      catalogProducts.find((p) => String(p.id ?? p.value) === String(pid));
    const localCands = [
      local?.available_quantity,
      local?.quantity_available,
      local?.available_units,
      local?.on_hand,
      local?.stock,
      local?.inventory,
      local?.balance,
      local?.qty,
      local?.quantity,
    ];
    for (const c of localCands) {
      const n = toNum(c);
      if (n > 0) return n;
    }
    return 0;
  };

  const handleSelectChange = async (field, value) => {
    const v = value?.value ?? value ?? "";
    if (field === "customer_id") {
      setForm((prev) => ({ ...prev, customer_id: v, sale_invoice_id: "" }));
      await fetchSaleInvoices(v);
      setInvoiceItems([]);
      setProducts(catalogProducts);
      productBatchCache.current = new Map();
      setRowBatches([]);
      setForm((prev) =>
        recalcFooter({ ...prev, items: prev.items.map((it) => ({ ...defaultItem, id: it.id })) })
      );
      setTimeout(() => saleInvoiceRef.current?.focus?.(), 50);
      return;
    }
    if (field === "sale_invoice_id") {
      setForm((prev) => ({ ...prev, sale_invoice_id: v }));
      if (v) await loadInvoice(v);
      else {
        setInvoiceItems([]);
        setProducts(catalogProducts);
      }
      productBatchCache.current = new Map();
      setRowBatches([]);
      setForm((prev) =>
        recalcFooter({ ...prev, items: prev.items.map((it) => ({ ...defaultItem, id: it.id })) })
      );
      setTimeout(() => productRefs.current[0]?.querySelector("input")?.focus?.(), 50);
    }
  };

  const resolveProductId = (obj) => {
    if (obj === null || obj === undefined) return "";
    if (typeof obj === "number") return obj;
    if (typeof obj === "string") return obj.trim();
    if (typeof obj === "object") {
      return obj.product_id ?? obj.id ?? obj.value ?? obj?.product?.id ?? obj?.data?.id ?? "";
    }
    return "";
  };

  const resetRow = (row) => {
    setForm((prev) => {
      const items = [...prev.items];
      items[row] = { ...defaultItem, id: items[row].id };
      return recalcFooter({ ...prev, items });
    });
  };

  const handleProductSelect = async (row, productObj) => {
    const pid = resolveProductId(productObj);
    if (!pid) return;

    // Prevent duplicate product across rows
    const dupIndex = form.items.findIndex((it, idx) => idx !== row && eqId(it.product_id, pid));
    if (dupIndex !== -1) {
      toast.error(`Product already selected in row ${dupIndex + 1}. Each product can be used only once.`);
      resetRow(row);
      setTimeout(() => productRefs.current[row]?.querySelector("input")?.focus?.(), 40);
      return;
    }

    const newItems = [...form.items];
    let unit_sale_price = 0;
    let item_discount_percentage = 0;
    let unit_sale_quantity = 0;

    if (form.sale_invoice_id) {
      const candidates = invoiceItems.filter((it) => String(it.product_id) === String(pid));
      if (candidates.length) {
        unit_sale_price = extractUnitPrice(candidates[0]);
        item_discount_percentage = extractItemDiscPct(candidates[0]);
        unit_sale_quantity = extractUnitSaleQty(candidates[0]);
      } else {
        unit_sale_price = await fetchProductUnitPrice(pid);
      }
    } else {
      // open mode
      unit_sale_price = await fetchProductUnitPrice(pid);
      item_discount_percentage = toNum(newItems[row]?.item_discount_percentage);
      unit_sale_quantity = await fetchProductAvailableQty(pid); // Available Qty
    }

    newItems[row] = recalcItem({
      ...newItems[row],
      product_id: pid,
      unit_sale_price,
      item_discount_percentage,
      unit_sale_quantity,
      batch_number: "",
      expiry: "",
      unit_return_quantity: 0,
    });
    setForm((prev) => recalcFooter({ ...prev, items: newItems }));

    const batches = await fetchBatchesForOpenReturn(pid);
    setRowBatches((prev) => {
      const next = prev.slice();
      next[row] = batches;
      return next;
    });

    setTimeout(() => {
      // If there are batches, move to batch; else go to qty
      if ((rowBatches[row] || batches).length) {
        const el = batchRefs.current[row];
        const inp = el?.querySelector?.("input");
        inp?.focus?.();
      } else {
        qtyRefs.current[row]?.focus?.();
      }
    }, 50);
  };

  const handleBatchSelect = (row, batchVal) => {
    const bn = typeof batchVal === "string" ? batchVal : batchVal?.value ?? batchVal?.batch_number ?? "";

    // Prevent duplicate product+batch pairs
    if (bn) {
      const duplicate = form.items.findIndex(
        (it, idx) => idx !== row && eqId(it.product_id, form.items[row].product_id) && eqId(it.batch_number, bn)
      );
      if (duplicate !== -1) {
        toast.error(`Same Product & Batch already used in row ${duplicate + 1}.`);
        // clear batch in this row and refocus
        setForm((prev) => {
          const items = [...prev.items];
          items[row] = { ...items[row], batch_number: "" };
          return recalcFooter({ ...prev, items });
        });
        setTimeout(() => batchRefs.current[row]?.querySelector("input")?.focus?.(), 40);
        return;
      }
    }

    const newItems = [...form.items];
    let expiry = "";

    const cached = productBatchCache.current.get(String(newItems[row].product_id)) || [];
    const matchedOpen = cached.find((b) => b.batch_number === bn);
    if (matchedOpen) expiry = matchedOpen.expiry || "";

    let unit_sale_quantity = newItems[row].unit_sale_quantity || 0;
    let unit_sale_price = newItems[row].unit_sale_price || 0;
    let item_discount_percentage = newItems[row].item_discount_percentage || 0;

    if (form.sale_invoice_id) {
      const matchedInv = invoiceItems.find(
        (it) =>
          String(it.product_id) === String(newItems[row].product_id) &&
          String(it.batch_number ?? it.batch ?? "") === String(bn)
      );
      if (matchedInv) {
        unit_sale_quantity = extractUnitSaleQty(matchedInv);
        unit_sale_price = extractUnitPrice(matchedInv) || unit_sale_price;
        item_discount_percentage = extractItemDiscPct(matchedInv);
      }
    } else {
      // open mode: if batch has available_units, prefer it for available quantity display
      const matchedOpen2 = cached.find((b) => b.batch_number === bn);
      if (matchedOpen2 && toNum(matchedOpen2.available_units) > 0) {
        unit_sale_quantity = toNum(matchedOpen2.available_units);
      }
    }

    newItems[row] = recalcItem({
      ...newItems[row],
      batch_number: bn || "",
      expiry,
      unit_sale_quantity,
      unit_sale_price,
      item_discount_percentage,
    });
    setForm((prev) => recalcFooter({ ...prev, items: newItems }));
  };

  const handleItemChange = (row, field, raw) => {
    const v = raw === "" ? "" : Number(raw);
    const newItems = [...form.items];

    // validation: qty cannot exceed allowed (unit_sale_quantity used for both modes)
    if (field === "unit_return_quantity") {
      const allowed = toNum(newItems[row].unit_sale_quantity);
      const prevQty = toNum(newItems[row].unit_return_quantity);
      const nextQty = toNum(v);
      if (nextQty > allowed && prevQty <= allowed) {
        toast.error(`Row ${row + 1}: Return qty exceeds allowed (${allowed}).`);
      }
    }

    newItems[row] = recalcItem({ ...newItems[row], [field]: v });
    setForm((prev) => recalcFooter({ ...prev, items: newItems }));
  };

  const addItem = () => {
    setForm((prev) => ({
      ...prev,
      items: [...prev.items, { ...defaultItem, id: Date.now() + Math.random() }],
    }));
    setTimeout(
      () => productRefs.current[form.items.length]?.querySelector("input")?.focus?.(),
      50
    );
  };

  const removeItem = (row) => {
    if (form.items.length <= 1) return;
    const next = form.items.filter((_, i) => i !== row);
    setForm((prev) => recalcFooter({ ...prev, items: next }));
  };

  // Header footer field handlers (bi-directional)
  const onDiscountPctChange = (val) =>
    setForm((prev) => recalcFooter({ ...prev, discount_percentage: val }, { disc: "pct" }));
  const onDiscountAmtChange = (val) =>
    setForm((prev) => recalcFooter({ ...prev, discount_amount: val }, { disc: "amt" }));
  const onTaxPctChange = (val) =>
    setForm((prev) => recalcFooter({ ...prev, tax_percentage: val }, { tax: "pct" }));
  const onTaxAmtChange = (val) =>
    setForm((prev) => recalcFooter({ ...prev, tax_amount: val }, { tax: "amt" }));

  const handleSubmit = async () => {
    try {
      if (!form.customer_id) {
        toast.error("Please select a customer");
        customerSelectRef.current?.focus?.();
        return;
      }

      // Validations: duplicates & qty
      const seenProducts = new Set();
      const seenPairs = new Set();
      for (let i = 0; i < form.items.length; i++) {
        const it = form.items[i];
        if (!it.product_id) continue; // skip empty rows

        // duplicate product
        const keyP = String(it.product_id);
        if (seenProducts.has(keyP)) {
          toast.error(`Duplicate product detected at row ${i + 1}. Each product only once.`);
          return;
        }
        seenProducts.add(keyP);

        // duplicate product+batch (only when batch present)
        const bn = String(it.batch_number || "");
        if (bn) {
          const keyPB = `${keyP}__${bn}`;
          if (seenPairs.has(keyPB)) {
            toast.error(`Duplicate Product + Batch at row ${i + 1}.`);
            return;
          }
          seenPairs.add(keyPB);
        }

        // qty > allowed
        const allowed = toNum(it.unit_sale_quantity);
        if (toNum(it.unit_return_quantity) > allowed) {
          toast.error(`Row ${i + 1}: Return qty exceeds allowed (${allowed}).`);
          return;
        }
      }

      const payload = {
        posted_number: form.posted_number,
        date: form.date,
        customer_id: form.customer_id,
        sale_invoice_id: form.sale_invoice_id || null,
        discount_percentage: toNum(form.discount_percentage),
        discount_amount: toNum(form.discount_amount),
        tax_percentage: toNum(form.tax_percentage),
        tax_amount: toNum(form.tax_amount),
        gross_total: toNum(form.gross_total),
        total: toNum(form.total),
        items: form.items
          .filter((it) => it.product_id)
          .map((it) => ({
            product_id: it.product_id,
            batch_number: it.batch_number || null,
            expiry: it.expiry || null,
            unit_sale_quantity: toNum(it.unit_sale_quantity),
            unit_sale_price: toNum(it.unit_sale_price),
            unit_return_quantity: toNum(it.unit_return_quantity),
            item_discount_percentage: toNum(it.item_discount_percentage),
            sub_total: toNum(it.sub_total),
          })),
      };

      if (returnId) {
        await axios.put(`/api/sale-returns/${returnId}`, payload);
        toast.success("Sale return updated");
      } else {
        await axios.post(`/api/sale-returns`, payload);
        toast.success("Sale return created");
      }
      onSuccess?.();
    } catch (e) {
      console.error(e);
      toast.error("Failed to save sale return");
    }
  };

  const navigate = useNavigate();
  const handleCancel = () => navigate("/sale-returns");

  // ---------- Keyboard Navigation (similar to SaleInvoiceForm) ----------
  const COLS = ["product", "batch", "quantity", "disc"];

  const focusCell = (row, col) => {
    const map = {
      product: productRefs,
      batch: batchRefs,
      quantity: { current: qtyRefs.current },
      disc: { current: discRefs.current },
    };
    const ref = map[col]?.current?.[row];
    if (!ref) return;
    const input = ref.querySelector?.("input");
    if (input) {
      input.focus();
      input.select?.();
    } else if (ref.focus) {
      ref.focus();
    }
  };

  const moveSameCol = (row, col, dir) => {
    const lastIdx = form.items.length - 1;
    if (dir === 1) {
      if (row === lastIdx) {
        addItem();
        setTimeout(() => {
          const targetCol = col === "quantity" || col === "disc" ? "product" : col;
          focusCell(row + 1, targetCol);
        }, 60);
      } else {
        focusCell(row + 1, col);
      }
    } else {
      if (row > 0) focusCell(row - 1, col);
    }
  };

  const moveNextCol = (row, col) => {
    const i = COLS.indexOf(col);
    if (i < 0) return;
    if (i < COLS.length - 1) {
      focusCell(row, COLS[i + 1]);
    } else {
      const lastIdx = form.items.length - 1;
      if (row === lastIdx) {
        addItem();
        setTimeout(() => focusCell(row + 1, COLS[0]), 60);
      } else {
        focusCell(row + 1, COLS[0]);
      }
    }
  };

  const onKeyNav = (e, row, col) => {
    // Allow Batch dropdown to handle its own Arrow keys (if it opens a menu)
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

  // ===== Render =====
  return (
    <div className="relative">
      <form className="flex flex-col" style={{ minHeight: "74vh", maxHeight: "80vh" }}>
        {/* HEADER */}
        <div className="sticky top-0 bg-white shadow p-2 z-10">
          <h2 className="text-sm font-bold mb-2">Sale Return (Unit-based) — Enter to move, Arrow ↑/↓ to switch rows, Alt+S to save</h2>
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
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="border rounded w-full p-1 h-7 text-xs"
                  />
                </td>
                <td className="border p-1 w-1/3">
                  <label className="block text-[10px]">Customer *</label>
                  <Select
                    ref={customerSelectRef}
                    options={customers.map((c) => ({ value: c.id, label: c.name }))}
                    value={
                      customers
                        .map((c) => ({ value: c.id, label: c.name }))
                        .find((c) => c.value === form.customer_id) || null
                    }
                    onChange={(val) => handleSelectChange("customer_id", val)}
                    isSearchable
                    classNamePrefix="react-select"
                    styles={{
                      control: (b) => ({ ...b, minHeight: "28px", height: "28px", fontSize: "12px" }),
                      valueContainer: (b) => ({ ...b, height: "28px", padding: "0 4px" }),
                      input: (b) => ({ ...b, margin: 0, padding: 0 }),
                    }}
                  />
                </td>
                <td className="border p-1 w-1/3">
                  <label className="block text-[10px]">Sale Invoice (optional)</label>
                  <Select
                    ref={saleInvoiceRef}
                    options={saleInvoices.map((inv) => ({ value: inv.id, label: inv.posted_number }))}
                    value={
                      saleInvoices
                        .map((inv) => ({ value: inv.id, label: inv.posted_number }))
                        .find((x) => x.value === form.sale_invoice_id) || null
                    }
                    onChange={(val) => handleSelectChange("sale_invoice_id", val)}
                    onMenuOpen={() => setInvoiceMenuOpen(true)}
                    onMenuClose={() => setInvoiceMenuOpen(false)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        if (!invoiceMenuOpen && !form.sale_invoice_id) {
                          e.preventDefault();
                          setInvoiceItems([]);
                          setProducts(catalogProducts);
                          productBatchCache.current = new Map();
                          setRowBatches([]);
                          setForm((prev) => recalcFooter(prev));
                          setTimeout(
                            () => productRefs.current[0]?.querySelector("input")?.focus?.(),
                            50
                          );
                        }
                      }
                    }}
                    isSearchable
                    classNamePrefix="react-select"
                    styles={{
                      control: (b) => ({ ...b, minHeight: "28px", height: "28px", fontSize: "12px" }),
                      valueContainer: (b) => ({ ...b, height: "28px", padding: "0 4px" }),
                      input: (b) => ({ ...b, margin: 0, padding: 0 }),
                    }}
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ITEMS */}
        <div className="flex-1 overflow-auto p-1">
          <h2 className="text-xs font-bold mb-1">Items</h2>
          <table className="w-full border-collapse text-[11px]">
            <thead className="sticky top-0 bg-gray-100 z-5">
              <tr>
                <th className="border w-6">#</th>
                <th className="border">Product</th>
                <th className="border w-20">Batch</th>
                <th className="border w-20">Expiry</th>
                <th className="border w-24">{form.sale_invoice_id ? "Unit Sale Qty" : "Available Qty"}</th>
                <th className="border w-24">Unit Sale Price</th>
                <th className="border w-24">Return Qty (Units)</th>
                <th className="border w-16">Disc %</th>
                <th className="border w-20">Sub Total</th>
                <th className="border w-6">+</th>
              </tr>
            </thead>
            <tbody>
              {form.items.map((item, i) => {
                const exceeds = toNum(item.unit_return_quantity) > toNum(item.unit_sale_quantity);
                return (
                  <tr key={item.id} className="text-center">
                    <td className="border">
                      <button
                        type="button"
                        onClick={() => removeItem(i)}
                        className="bg-red-500 text-white px-1 rounded text-[10px]"
                      >
                        X
                      </button>
                    </td>
                    <td className="border text-left w-[260px]">
                      <div ref={(el) => (productRefs.current[i] = el)}>
                        <ProductSearchInput
                          value={item.product_id}
                          onChange={(val) => handleProductSelect(i, val)}
                          products={products}
                          onKeyDown={(e) => onKeyNav(e, i, "product")}
                        />
                      </div>
                    </td>
                    <td className="border w-20">
                      <div ref={(el) => (batchRefs.current[i] = el)}>
                        <BatchSearchInput
                          value={item.batch_number}
                          batches={(rowBatches[i] || []).map((b) => ({ value: b.batch_number, label: b.batch_number }))}
                          onChange={(v) => handleBatchSelect(i, v)}
                          onKeyDown={(e) => onKeyNav(e, i, "batch")}
                        />
                      </div>
                    </td>
                    <td className="border w-20">
                      <input
                        type="text"
                        readOnly
                        value={item.expiry || ""}
                        className="border bg-gray-100 w-full h-6 text-[11px] px-1"
                      />
                    </td>
                    <td className="border w-24">
                      <input
                        type="number"
                        readOnly
                        value={item.unit_sale_quantity || 0}
                        className="border bg-gray-100 w-full h-6 text-[11px] px-1"
                      />
                    </td>
                    <td className="border w-24">
                      <input
                        type="number"
                        readOnly
                        value={item.unit_sale_price || 0}
                        className="border bg-gray-100 w-full h-6 text-[11px] px-1"
                      />
                    </td>
                    <td className="border w-24">
                      <input
                        ref={(el) => (qtyRefs.current[i] = el)}
                        type="text"
                        value={item.unit_return_quantity === 0 ? "" : item.unit_return_quantity}
                        onChange={(e) => handleItemChange(i, "unit_return_quantity", e.target.value)}
                        className={
                          "border w-full h-6 text-[11px] px-1 " + (exceeds ? "border-red-500 ring-1 ring-red-400" : "")
                        }
                        onKeyDown={(e) => onKeyNav(e, i, "quantity")}
                      />
                    </td>
                    <td className="border w-16">
                      <input
                        ref={(el) => (discRefs.current[i] = el)}
                        type="text"
                        value={item.item_discount_percentage === 0 ? "" : item.item_discount_percentage}
                        onChange={(e) => handleItemChange(i, "item_discount_percentage", e.target.value)}
                        className="border w-full h-6 text-[11px] px-1"
                        onKeyDown={(e) => onKeyNav(e, i, "disc")}
                      />
                    </td>
                    <td className="border w-20">
                      <input
                        type="number"
                        readOnly
                        value={(Number(item.sub_total) || 0).toFixed(2)}
                        className="border bg-gray-100 w-full h-6 text-[11px] px-1"
                      />
                    </td>
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
                );
              })}
            </tbody>
          </table>
        </div>

        {/* FOOTER */}
        <div className="sticky bottom-0 bg-white shadow p-2 z-10">
          <table className="w-full border-collapse text-xs">
            <tbody>
              <tr>
                <td className="border p-1 w-1/6">
                  <label className="block text-[10px]">Gross Total</label>
                  <input
                    type="number"
                    readOnly
                    value={(Number(form.gross_total) || 0).toFixed(2)}
                    className="border rounded w-full p-1 h-7 text-xs bg-gray-100"
                  />
                </td>
                <td className="border p-1 w-1/6">
                  <label className="block text-[10px]">Discount %</label>
                  <input
                    type="number"
                    value={form.discount_percentage === 0 ? "" : form.discount_percentage}
                    onChange={(e) => onDiscountPctChange(e.target.value)}
                    className="border rounded w-full p-1 h-7 text-xs"
                  />
                </td>
                <td className="border p-1 w-1/6">
                  <label className="block text-[10px]">Discount Amount</label>
                  <input
                    type="number"
                    value={form.discount_amount === 0 ? "" : form.discount_amount}
                    onChange={(e) => onDiscountAmtChange(e.target.value)}
                    className="border rounded w-full p-1 h-7 text-xs"
                  />
                </td>
                <td className="border p-1 w-1/6">
                  <label className="block text-[10px]">Tax %</label>
                  <input
                    type="number"
                    value={form.tax_percentage === 0 ? "" : form.tax_percentage}
                    onChange={(e) => onTaxPctChange(e.target.value)}
                    className="border rounded w-full p-1 h-7 text-xs"
                  />
                </td>
                <td className="border p-1 w-1/6">
                  <label className="block text-[10px]">Tax Amount</label>
                  <input
                    type="number"
                    value={form.tax_amount === 0 ? "" : form.tax_amount}
                    onChange={(e) => onTaxAmtChange(e.target.value)}
                    className="border rounded w-full p-1 h-7 text-xs"
                  />
                </td>
                <td className="border p-1 w-1/6">
                  <label className="block text-[10px]">Total</label>
                  <input
                    type="number"
                    readOnly
                    value={(Number(form.total) || 0).toFixed(2)}
                    className="border rounded w-full p-1 h-7 text-xs bg-gray-100"
                  />
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
                      {returnId ? "Update Return" : "Create Return"}
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
 