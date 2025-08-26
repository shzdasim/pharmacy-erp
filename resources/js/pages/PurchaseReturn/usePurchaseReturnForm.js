import { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { recalcItem, recalcFooter } from "../../Formula/PurchaseReturn.js";

export default function usePurchaseReturnForm({ returnId, initialData, onSuccess }) {
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

  const [form, setForm] = useState(
    initialData || {
      supplier_id: "",
      posted_number: "",
      date: new Date().toISOString().split("T")[0],
      purchase_invoice_id: "",
      remarks: "",
      gross_total: 0,
      discount_percentage: 0,
      tax_percentage: 0,
      discount_amount: 0,
      tax_amount: 0,
      total: 0,
      items: [Object.assign({}, defaultItem)],
    }
  );

  // Data lists
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [purchaseInvoices, setPurchaseInvoices] = useState([]);
  const [batches, setBatches] = useState([]);
  const [currentField, setCurrentField] = useState('supplier');
  const [currentRowIndex, setCurrentRowIndex] = useState(0);

  // Focus/navigation refs
  const supplierSelectRef = useRef(null);
  const purchaseInvoiceRef = useRef(null);
  const productSearchRefs = useRef([]);
  const packQuantityRefs = useRef([]);
  const packPurchasePriceRefs = useRef([]);
  const itemDiscountRefs = useRef([]);

  // keep refs arrays length in sync with items
  useEffect(() => {
    productSearchRefs.current = productSearchRefs.current.slice(0, form.items.length);
    packQuantityRefs.current = packQuantityRefs.current.slice(0, form.items.length);
    packPurchasePriceRefs.current = packPurchasePriceRefs.current.slice(0, form.items.length);
    itemDiscountRefs.current = itemDiscountRefs.current.slice(0, form.items.length);
  }, [form.items.length]);

  useEffect(() => {
    fetchSuppliers();
    fetchProducts();

    if (!returnId) fetchNewCode();

    if (returnId) fetchReturn(returnId);
  }, [returnId]);

  useEffect(() => {
    setTimeout(() => {
      if (supplierSelectRef.current) {
        supplierSelectRef.current.focus();
        supplierSelectRef.current.openMenu();
      }
    }, 120);
  }, []);

  // When initialData prop changes (edit mode), populate form
  useEffect(() => {
    if (initialData) {
      // normalize numeric fields
      const normalized = {
        ...initialData,
        gross_total: Number(initialData.gross_total || 0),
        discount_percentage: Number(initialData.discount_percentage || 0),
        tax_percentage: Number(initialData.tax_percentage || 0),
        discount_amount: Number(initialData.discount_amount || 0),
        tax_amount: Number(initialData.tax_amount || 0),
        total: Number(initialData.total || 0),
        items:
          (initialData.items && initialData.items.length)
            ? initialData.items.map((it) => ({
                product_id: it.product_id || "",
                batch: it.batch || "",
                expiry: it.expiry || "",
                pack_size: Number(it.pack_size || 0),
                return_pack_quantity: Number(it.return_pack_quantity || 0),
                return_unit_quantity: Number(it.return_unit_quantity || 0),
                pack_purchase_price: Number(it.pack_purchase_price || 0),
                unit_purchase_price: Number(it.unit_purchase_price || 0),
                item_discount_percentage: Number(it.item_discount_percentage || 0),
                sub_total: Number(it.sub_total || 0),
              }))
            : [Object.assign({}, defaultItem)],
      };
      setForm(normalized);
    }
  }, [initialData]);

  // Keyboard shortcut: Alt+S to submit
  useEffect(() => {
    const onKey = (e) => {
      if (e.altKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleSubmit(e);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [form]);

  // ---------------------- API fetchers ----------------------
  const fetchSuppliers = async () => {
    try {
      const res = await axios.get("/api/suppliers");
      setSuppliers(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await axios.get("/api/products");
      setProducts(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchPurchaseInvoices = async (supplierId) => {
    try {
      const res = await axios.get(`/api/purchase-invoices?supplier_id=${supplierId}`);
      setPurchaseInvoices(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchNewCode = async () => {
    try {
      const res = await axios.get("/api/purchase-returns/new-code");
      setForm((prev) => ({ ...prev, posted_number: res.data.posted_number || res.data.code || "" }));
    } catch (err) {
      console.error(err);
    }
  };

  const fetchReturn = async (id) => {
    try {
      const res = await axios.get(`/api/purchase-returns/${id}`);
      const data = res.data;
      setForm((prev) => ({ ...prev, ...(data || {}) }));
    } catch (err) {
      console.error(err);
      toast.error("Failed to load purchase return");
    }
  };

const fetchProductsFromInvoice = async (invoiceId) => {
  try {
    const res = await axios.get(`/api/purchase-invoices/${invoiceId}`);
    const invoice = res.data;

    // Unique products only
    const productMap = new Map();
    invoice.items.forEach(item => {
      if (!productMap.has(item.product.id)) {
        productMap.set(item.product.id, {
          ...item.product,
          pack_purchase_price: item.pack_purchase_price,
          unit_purchase_price: item.unit_purchase_price,
          pack_size: item.pack_size,
          pack_quantity: item.pack_quantity,
        });
      }
    });

    setProducts([...productMap.values()]);
  } catch (err) {
    console.error(err);
    toast.error("Failed to load products from invoice");
  }
};


  // ---------------------- helpers ----------------------
  const sanitizeNumberInput = (value, allowDecimal = false) => {
    if (value === "" || value === null || value === undefined) return "";
    value = String(value);
    if (allowDecimal) {
      if (/^\d*\.?\d*$/.test(value)) return value;
      return value.slice(0, -1);
    }
    return value.replace(/\D/g, "");
  };

  // Header simple change
  const handleChange = (e) => {
    const { name, value } = e.target;
    let v = value;
    const numericFields = ["discount_percentage", "discount_amount", "tax_percentage", "tax_amount"];
    if (numericFields.includes(name)) v = sanitizeNumberInput(value, true);

    let newForm = { ...form, [name]: v };
    if (["tax_percentage", "tax_amount", "discount_percentage", "discount_amount"].includes(name)) {
      newForm = recalcFooter(newForm, name);
    }
    setForm(newForm);
  };

  const handleSelectChange = (field, valueObj) => {
    console.log("Selected Supplier ID:", valueObj?.value); // Debug log
    setForm({ ...form, [field]: valueObj?.value || "" });
    if (field === "supplier_id") {
      fetchPurchaseInvoices(valueObj?.value);
    } else if (field === "purchase_invoice_id") {
      fetchProductsFromInvoice(valueObj?.value);
    }
  };

  // Items handling
  const handleItemChange = (index, field, rawValue) => {
    let value = rawValue;

    const allowDecimalFields = ["pack_purchase_price", "unit_purchase_price", "item_discount_percentage"];
    const integerFields = ["return_pack_quantity", "return_unit_quantity", "pack_size"];

    if (allowDecimalFields.includes(field)) {
      if (!/^\d*\.?\d*$/.test(String(value))) return;
    } else if (integerFields.includes(field)) {
      value = String(value).replace(/\D/g, "");
    }

    const newItems = [...form.items];
    newItems[index] = recalcItem({ ...newItems[index], [field]: value }, field);

    let newForm = { ...form, items: newItems };
    newForm = recalcFooter(newForm, "items");
    setForm(newForm);
  };

  const handleProductSelect = async (index, productId) => {
    const selected = products.find((p) => Number(p.id) === Number(productId));
    let packPurchasedQty = 0;
    if (selected && selected.pack_quantity !== undefined) {
      packPurchasedQty = selected.pack_quantity;
    }
    const newItems = [...form.items];
    newItems[index] = {
      ...newItems[index],
      product_id: selected?.id || "",
      pack_size: selected?.pack_size || 0,
      pack_purchase_price: selected?.pack_purchase_price ?? 0,
      unit_purchase_price: selected?.unit_purchase_price ?? 0,
      pack_purchased_quantity: packPurchasedQty,
    };
    newItems[index] = recalcItem(newItems[index], "product_id");
    
    // Fetch batches for the selected product
    try {
      const res = await axios.get(`/api/products/${selected.id}/batches`);
      const fetchedBatches = res.data || [];
      setBatches(fetchedBatches);
      
      const newForm = recalcFooter({ ...form, items: newItems }, "items");
      setForm(newForm);
      
      // After setting form and batches, navigate to next field
      setTimeout(() => {
        if (fetchedBatches.length > 0) {
          setCurrentField('batch');
        } else {
          if (packQuantityRefs.current[index]) {
            packQuantityRefs.current[index].focus();
            setCurrentField('pack_quantity');
            setCurrentRowIndex(index);
          }
        }
      }, 100);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load batches");
      
      const newForm = recalcFooter({ ...form, items: newItems }, "items");
      setForm(newForm);
      
      // On error, still navigate to return pack quantity
      setTimeout(() => {
        if (packQuantityRefs.current[index]) {
          packQuantityRefs.current[index].focus();
          setCurrentField('pack_quantity');
          setCurrentRowIndex(index);
        }
      }, 100);
    }
  };

  const handleBatchSelect = (index, valueObj) => {
    const batchNumber = valueObj?.value || "";
    const newItems = [...form.items];
    newItems[index] = { ...newItems[index], batch: batchNumber };
    
    // Find the batch details to set expiry
    const selectedBatch = batches.find(b => b.batch_number === batchNumber);
    if (selectedBatch) {
      newItems[index] = { ...newItems[index], expiry: selectedBatch.expiry_date || "" };
    }
    
    setForm({ ...form, items: newItems });
    
    // Navigate to next field after batch selection
    setTimeout(() => {
      if (packQuantityRefs.current[index]) {
        packQuantityRefs.current[index].focus();
        setCurrentField('pack_quantity');
        setCurrentRowIndex(index);
      }
    }, 50);
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
    if (currentRowIndex >= newItems.length) {
      setCurrentRowIndex(newItems.length - 1);
    }
  };

  // Helper: robustly focus the ProductSearchInput inside its wrapper
  const focusProductSearch = (rowIndex = 0) => {
    const tryFocus = () => {
      const container = productSearchRefs.current[rowIndex];
      if (!container) return false;

      if (container instanceof HTMLElement) {
        const input = container.querySelector('input, [contenteditable="true"]');
        if (input && typeof input.focus === 'function') {
          input.focus();
          if (typeof input.select === 'function') input.select();
          setCurrentField('product');
          setCurrentRowIndex(rowIndex);
          return true;
        }
      }

      if (container && typeof container.focus === 'function') {
        container.focus();
        setCurrentField('product');
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

  // Helper function to focus on the same field in a different row
  const focusOnField = (field, rowIndex) => {
    setTimeout(() => {
      switch (field) {
        case 'pack_quantity':
          if (packQuantityRefs.current[rowIndex]) {
            packQuantityRefs.current[rowIndex].focus();
            setCurrentField('pack_quantity');
            setCurrentRowIndex(rowIndex);
          }
          break;
        case 'pack_purchase_price':
          if (packPurchasePriceRefs.current[rowIndex]) {
            packPurchasePriceRefs.current[rowIndex].focus();
            setCurrentField('pack_purchase_price');
            setCurrentRowIndex(rowIndex);
          }
          break;
        case 'item_discount':
          if (itemDiscountRefs.current[rowIndex]) {
            itemDiscountRefs.current[rowIndex].focus();
            setCurrentField('item_discount');
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
        case 'supplier':
          if (purchaseInvoiceRef.current) {
            purchaseInvoiceRef.current.focus();
            setCurrentField('purchase_invoice');
          }
          break;
        case 'purchase_invoice':
          focusProductSearch(0);
          break;
        case 'product':
          const selectedProduct = products.find(p => p.id === form.items[rowIndex]?.product_id);
          if (selectedProduct && batches.length > 0) {
            setCurrentField('batch');
          } else {
            if (packQuantityRefs.current[rowIndex]) {
              packQuantityRefs.current[rowIndex].focus();
              setCurrentField('pack_quantity');
            }
          }
          break;
        case 'batch':
          if (packQuantityRefs.current[rowIndex]) {
            packQuantityRefs.current[rowIndex].focus();
            setCurrentField('pack_quantity');
          }
          break;
        case 'pack_quantity':
          if (packPurchasePriceRefs.current[rowIndex]) {
            packPurchasePriceRefs.current[rowIndex].focus();
            setCurrentField('pack_purchase_price');
          }
          break;
        case 'pack_purchase_price':
          if (itemDiscountRefs.current[rowIndex]) {
            itemDiscountRefs.current[rowIndex].focus();
            setCurrentField('item_discount');
          }
          break;
        case 'item_discount':
          addItem();
          focusProductSearch(rowIndex + 1);
          break;
      }
    }, 50);
  };

  const handleKeyDown = (e, field, rowIndex = 0) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      navigateToNextField(field, rowIndex);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (rowIndex === form.items.length - 1) {
        addItem();
        setTimeout(() => {
          focusOnField(field, rowIndex + 1);
        }, 200);
      } else {
        const nextRowIndex = rowIndex + 1;
        focusOnField(field, nextRowIndex);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (rowIndex > 0) {
        const prevRowIndex = rowIndex - 1;
        focusOnField(field, prevRowIndex);
      }
    }
  };

  const handleProductKeyDown = (e, rowIndex) => {
    if (e.key === 'Enter') {
      e.preventDefault();
    } else if (e.key === 'ArrowUp' && rowIndex > 0) {
      e.preventDefault();
      const prevRowIndex = rowIndex - 1;
      focusProductSearch(prevRowIndex);
    } else if (e.key === 'ArrowDown') {
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

  // ---------------------- submit ----------------------
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        supplier_id: form.supplier_id,
        posted_number: form.posted_number,
        date: form.date,
        purchase_invoice_id: form.purchase_invoice_id,
        remarks: form.remarks,
        gross_total: Number(form.gross_total || 0),
        discount_percentage: Number(form.discount_percentage || 0),
        discount_amount: Number(form.discount_amount || 0),
        tax_percentage: Number(form.tax_percentage || 0),
        tax_amount: Number(form.tax_amount || 0),
        total: Number(form.total || 0),
        items: form.items.map((it) => ({
          product_id: it.product_id,
          batch: it.batch || null,
          expiry: it.expiry || null,
          pack_size: Number(it.pack_size || 0),
          return_pack_quantity: Number(it.return_pack_quantity || 0),
          return_unit_quantity: Number(it.return_unit_quantity || 0),
          pack_purchase_price: Number(it.pack_purchase_price || 0),
          unit_purchase_price: Number(it.unit_purchase_price || 0),
          item_discount_percentage: Number(it.item_discount_percentage || 0),
          sub_total: Number(it.sub_total || 0),
        })),
      };

      if (returnId) {
        await axios.put(`/api/purchase-returns/${returnId}`, payload);
        toast.success("Return updated successfully");
      } else {
        await axios.post(`/api/purchase-returns`, payload);
        toast.success("Return created successfully");
      }

      if (onSuccess) onSuccess();
    } catch (err) {
      console.error(err);
      toast.error("Failed to save return");
    }
  };

  return {
    // State
    form,
    suppliers,
    products,
    purchaseInvoices,
    batches,
    currentField,
    currentRowIndex,
    
    // Refs
    supplierSelectRef,
    purchaseInvoiceRef,
    productSearchRefs,
    packQuantityRefs,
    packPurchasePriceRefs,
    itemDiscountRefs,
    
    // Handlers
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
    
    // Focus helpers
    focusProductSearch,
    focusOnField,
    navigateToNextField
  };
}
