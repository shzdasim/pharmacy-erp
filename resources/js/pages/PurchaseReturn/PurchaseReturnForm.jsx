import { useState, useEffect, useRef } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import Select from "react-select";
import ProductSearchInput from "../../components/ProductSearchInput.jsx";
import { recalcItem, recalcFooter } from "../../Formula/PurchaseReturn.js";

export default function PurchaseReturnForm({ returnId, initialData, onSuccess }) {
  const defaultItem = {
    product_id: "",
    batch: "",
    expiry: "",
    pack_size: 0,
    pack_purchased_quantity: 0, // <-- new field
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
  const supplierRef = useRef(null);
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
    setTimeout(() => supplierRef.current && supplierRef.current.focus && supplierRef.current.focus(), 120);
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
      // rely on effect earlier to normalize initialData; set initialData prop instead
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
      // Extract products from invoice items
      const invoiceProducts = invoice.items.map(item => ({
        ...item.product,
        pack_purchase_price: item.pack_purchase_price,
        unit_purchase_price: item.unit_purchase_price,
        pack_size: item.pack_size,
        pack_quantity: item.pack_quantity, // <-- needed for purchased quantity
        batch: item.batch,
        expiry: item.expiry,
      }));
      setProducts(invoiceProducts);
      // Optionally, you could store invoice.items for easier lookup
      // setInvoiceItems(invoice.items);
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
    setForm({ ...form, [field]: valueObj?.value || "" });
    if (field === "supplier_id") {
      fetchPurchaseInvoices(valueObj?.value);
    } else if (field === "purchase_invoice_id") {
      // When purchase invoice is selected, fetch products from that invoice
      fetchProductsFromInvoice(valueObj?.value);
    }
  };

  // Items handling
  function handleItemChange(index, field, rawValue) {
    let value = rawValue;

    const allowDecimalFields = ["pack_purchase_price", "unit_purchase_price", "item_discount_percentage"];
    const integerFields = ["return_pack_quantity", "return_unit_quantity", "pack_size"];

    if (allowDecimalFields.includes(field)) {
      if (!/^\d*\.?\d*$/.test(String(value))) return; // reject invalid
    } else if (integerFields.includes(field)) {
      value = String(value).replace(/\D/g, "");
    }

    const newItems = [...form.items];
    newItems[index] = recalcItem({ ...newItems[index], [field]: value }, field);

    let newForm = { ...form, items: newItems };
    newForm = recalcFooter(newForm, "items");
    setForm(newForm);
  }

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
          // If batches exist, focus will be handled by the batch dropdown
          setCurrentField('batch');
        } else {
          // If no batches, go directly to return pack quantity
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

  const addItem = () => {
    setForm((prev) => ({ ...prev, items: [...prev.items, Object.assign({}, defaultItem)] }));
    setCurrentRowIndex(form.items.length);
  };

  const handleBatchSelect = (index, selectedOption) => {
    const batch = batches.find(b => b.batch_number === selectedOption.value);
    if (batch) {
      const newItems = [...form.items];
      newItems[index] = {
        ...newItems[index],
        batch: batch.batch_number,
        expiry: batch.expiry_date,
      };
      setForm((prev) => ({ ...prev, items: newItems }));
      
      // Move to return pack quantity field after batch selection
      setTimeout(() => {
        if (packQuantityRefs.current[index]) {
          packQuantityRefs.current[index].focus();
          setCurrentField('pack_quantity');
          setCurrentRowIndex(index);
        }
      }, 50);
    }
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
          // After product selection, check if we need to go to batch selection
          const selectedProduct = products.find(p => p.id === form.items[rowIndex]?.product_id);
          if (selectedProduct && batches.length > 0) {
            // If product has batches, we'll handle batch selection through the dropdown
            // The batch dropdown will automatically focus when it appears
            setCurrentField('batch');
          } else {
            // If no batches, go directly to return pack quantity
            if (packQuantityRefs.current[rowIndex]) {
              packQuantityRefs.current[rowIndex].focus();
              setCurrentField('pack_quantity');
            }
          }
          break;
        case 'batch':
          // After batch selection, go to return pack quantity
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
      // The actual navigation will be handled by handleProductSelect after product selection
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

  // Remove onSubmit from <form> and handle submit only via button or Alt+S
  return (
    <form className="flex flex-col" style={{ minHeight: "74vh", maxHeight: "80vh" }}>
      {/* ================= HEADER SECTION ================= */}
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
                <Select
                  ref={supplierRef}
                  options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
                  value={suppliers.map((s) => ({ value: s.id, label: s.name })).find((s) => s.value === form.supplier_id) || null}
                  onChange={(val) => {
                    handleSelectChange("supplier_id", val);
                    navigateToNextField('supplier');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && form.supplier_id) {
                      e.preventDefault();
                      navigateToNextField('supplier');
                    }
                  }}
                  isSearchable
                  className="text-xs"
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

              <td className="border p-1 w-1/3">
                <label className="block text-[10px]">Purchase Invoice *</label>
                <div ref={purchaseInvoiceRef}>
                  <Select
                    options={purchaseInvoices.map((inv) => ({ value: inv.id, label: inv.posted_number }))}
                    value={purchaseInvoices.map((inv) => ({ value: inv.id, label: inv.posted_number })).find((inv) => inv.value === form.purchase_invoice_id) || null}
                    onChange={(val) => {
                      handleSelectChange("purchase_invoice_id", val);
                      navigateToNextField('purchase_invoice');
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && form.purchase_invoice_id) {
                        e.preventDefault();
                        navigateToNextField('purchase_invoice');
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
                </div>
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

      {/* ================= ITEMS SECTION ================= */}
      <div className="flex-1 overflow-auto p-1">
        <h2 className="text-xs font-bold mb-1">Items (↑↓ arrows to navigate rows)</h2>

        <table className="w-full border-collapse text-[11px]">
          <thead className="sticky top-0 bg-gray-100 z-5">
            <tr>
              <th rowSpan={2} className="border w-6">#</th>
              <th rowSpan={2} colSpan={1} className="border w-[80px]">Product</th>
              <th colSpan={4} className="border">Pack Size / Batch / Expiry / Pack Purchased Qty</th> {/* changed colSpan */}
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
              <th className="border w-16">Pack Purchased Qty</th> {/* new header */}
              <th className="border w-12">Pack.Q</th>
              <th className="border w-12">Unit.Q</th>
              <th className="border w-14">Pack.P</th>
              <th className="border w-14">Unit.P</th>
              <th className="border w-14">Disc%</th>
            </tr>
          </thead>

          <tbody>
            {form.items.map((item, i) => (
              <tr key={i} className="text-center">
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

                {/* Product Search Input */}
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
                  {batches.length > 0 && item.product_id ? (
                    <Select
                      ref={(el) => {
                        // Auto-focus the batch dropdown when it appears and current field is 'batch'
                        if (el && currentField === 'batch' && currentRowIndex === i) {
                          setTimeout(() => {
                            if (el && el.focus) {
                              el.focus();
                            }
                          }, 50);
                        }
                      }}
                      options={batches.map((b) => ({ value: b.batch_number, label: b.batch_number }))}
                      value={batches.map((b) => ({ value: b.batch_number, label: b.batch_number })).find((b) => b.value === item.batch) || null}
                      onChange={(val) => handleBatchSelect(i, val)}
                      isSearchable
                      className="text-xs"
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
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && item.batch) {
                          e.preventDefault();
                          navigateToNextField('batch', i);
                        }
                      }}
                    />
                  ) : (
                    <input
                      type="text"
                      value={item.batch || ""}
                      onChange={(e) => handleItemChange(i, "batch", e.target.value)}
                      className="border w-full h-6 text-[11px] px-1"
                    />
                  )}
                </td>

                {/* Expiry */}
                <td className="border w-20">
                  <input
                    type="date"
                    value={item.expiry || ""}
                    onChange={(e) => handleItemChange(i, "expiry", e.target.value)}
                    className="border w-full h-6 text-[11px] px-1"
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
                    onKeyDown={(e) => handleKeyDown(e, 'pack_quantity', i)}
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
                    onKeyDown={(e) => handleKeyDown(e, 'pack_purchase_price', i)}
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
                    onKeyDown={(e) => handleKeyDown(e, 'item_discount', i)}
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

      {/* ================= FOOTER SECTION ================= */}
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
                <input name="discount_percentage" type="number" value={form.discount_percentage} onChange={handleChange} onBlur={() => setForm(recalcFooter(form, 'discount_percentage'))} className="border rounded w-full p-1 h-7 text-xs" />
              </td>

              <td className="border p-1 w-1/6">
                <label className="block text-[10px]">Discount Amount</label>
                <input type="number" readOnly value={(Number(form.discount_amount) || 0).toFixed(2)} className="border rounded w-full p-1 h-7 text-xs bg-gray-100" />
              </td>

              <td className="border p-1 w-1/6">
                <label className="block text-[10px]">Tax %</label>
                <input name="tax_percentage" type="number" value={form.tax_percentage} onChange={handleChange} onBlur={() => setForm(recalcFooter(form, 'tax_percentage'))} className="border rounded w-full p-1 h-7 text-xs" />
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
              <td colSpan={6} className="p-2 text-center">
                <button
                  type="button"
                  onClick={handleSubmit}
                  className="bg-green-600 text-white px-8 py-3 rounded text-sm hover:bg-green-700 transition duration-200"
                >
                  {returnId ? "Update Return" : "Create Return"}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </form>
  );
}
