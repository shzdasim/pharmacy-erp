import { useState, useEffect, useRef } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import Select from "react-select";
import ProductSearchInput from "../../components/ProductSearchInput.jsx";
import { recalcItem, recalcFooter } from "../../Formula/PurchaseInvoice.js";

export default function PurchaseInvoiceForm({ invoiceId, onSuccess }) {
  const [form, setForm] = useState({
    supplier_id: "",
    posted_number: "",
    posted_date: new Date().toISOString().split("T")[0],
    remarks: "",
    invoice_number: "",
    invoice_amount: "",
    tax_percentage: "",
    tax_amount: "",
    discount_percentage: "",
    discount_amount: "",
    total_amount: "",
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

  // only allow numbers (and optionally decimals)
// allow decimals for price/percentage fields
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



  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [currentField, setCurrentField] = useState('supplier');
  const [currentRowIndex, setCurrentRowIndex] = useState(0);

  // Refs for navigation
  const supplierRef = useRef(null);
  const invoiceNumberRef = useRef(null);
  const invoiceAmountRef = useRef(null);
  // productSearchRefs will hold container DOM nodes (wrapping ProductSearchInput)
  const productSearchRefs = useRef([]);
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
    } else {
      fetchNewCode();
    }
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
    // Handle Alt+S for save
    const handleKeyDown = (e) => {
      if (e.altKey && e.key === 's') {
        e.preventDefault();
        handleSubmit(e);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [form]);

  const fetchSuppliers = async () => {
    const res = await axios.get("/api/suppliers");
    setSuppliers(res.data);
  };

  const fetchProducts = async () => {
    const res = await axios.get("/api/products");
    setProducts(res.data);
  };

  const fetchInvoice = async () => {
    const res = await axios.get(`/api/purchase-invoices/${invoiceId}`);
    setForm(res.data);
  };

  const fetchNewCode = async () => {
    const res = await axios.get("/api/purchase-invoices/new-code");
    setForm((prev) => ({
      ...prev,
      posted_number: res.data.posted_number,
    }));
  };

const handleChange = (e) => {
  const { name, value } = e.target;
  let newValue = value;

  const numericFields = [
    "invoice_amount",
    "tax_percentage",
    "tax_amount",
    "discount_percentage",
    "discount_amount"
  ];

  if (numericFields.includes(name)) {
    newValue = sanitizeNumberInput(value, true);
  }

  let newForm = { ...form, [name]: newValue };

  if (
    ["tax_percentage", "tax_amount", "discount_percentage", "discount_amount"].includes(name)
  ) {
    newForm = recalcFooter(newForm, name);
  }

  setForm(newForm);
};


  const handleSelectChange = (field, value) => {
    setForm({ ...form, [field]: value?.value || "" });
  };

function handleItemChange(index, field, rawValue) {
  let value = rawValue;

  // fields that can have decimals
  const allowDecimalFields = [
    "pack_purchase_price",
    "unit_purchase_price",
    "pack_sale_price",
    "unit_sale_price",
    "item_discount_percentage",
  ];

  // integer-only fields
  const integerFields = [
    "pack_quantity",
    "unit_quantity",
    "pack_bonus",
    "unit_bonus",
  ];

  if (allowDecimalFields.includes(field)) {
    // allow numbers like 34, 34., 34.5, 34.56
    if (!/^\d*\.?\d*$/.test(value)) {
      return; // reject invalid chars
    }
  } else if (integerFields.includes(field)) {
    // strip everything except digits
    value = value.replace(/\D/g, "");
  }

  // push to items
  const newItems = [...form.items];
  newItems[index] = recalcItem(
    { ...newItems[index], [field]: value },
    field
  );

  // recalc totals
  let newForm = { ...form, items: newItems };
  newForm = recalcFooter(newForm, "items");

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

      // If the ref is a DOM node that wraps the input
      if (container instanceof HTMLElement) {
        const input = container.querySelector('input, [contenteditable="true"]');
        if (input && typeof input.focus === 'function') {
          input.focus();
          // select text if applicable
          if (typeof input.select === 'function') input.select();
          setCurrentField('product');
          setCurrentRowIndex(rowIndex);
          return true;
        }
      }

      // If the ref is a component instance exposing focus
      if (container && typeof container.focus === 'function') {
        container.focus();
        setCurrentField('product');
        setCurrentRowIndex(rowIndex);
        return true;
      }

      return false;
    };

    // Try immediately, then retry a few times in case of render delay
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
        case 'pack_bonus':
          if (packBonusRefs.current[rowIndex]) {
            packBonusRefs.current[rowIndex].focus();
            setCurrentField('pack_bonus');
            setCurrentRowIndex(rowIndex);
          }
          break;
        case 'pack_sale_price':
          if (packSalePriceRefs.current[rowIndex]) {
            packSalePriceRefs.current[rowIndex].focus();
            setCurrentField('pack_sale_price');
            setCurrentRowIndex(rowIndex);
          }
          break;
        default:
          // For product field and others, use product search
          focusProductSearch(rowIndex);
          break;
      }
    }, 50);
  };

  const navigateToNextField = (currentFieldName, rowIndex = 0) => {
    setTimeout(() => {
      switch (currentFieldName) {
        case 'supplier':
          if (invoiceNumberRef.current) {
            invoiceNumberRef.current.focus();
            setCurrentField('invoice_number');
          }
          break;
        case 'invoice_number':
          if (invoiceAmountRef.current) {
            invoiceAmountRef.current.focus();
            setCurrentField('invoice_amount');
          }
          break;
        case 'invoice_amount':
          // robust focus into first product search input
          focusProductSearch(0);
          break;
        case 'product':
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
          if (packBonusRefs.current[rowIndex]) {
            packBonusRefs.current[rowIndex].focus();
            setCurrentField('pack_bonus');
          }
          break;
        case 'pack_bonus':
          if (packSalePriceRefs.current[rowIndex]) {
            packSalePriceRefs.current[rowIndex].focus();
            setCurrentField('pack_sale_price');
          }
          break;
        case 'pack_sale_price':
          // Add new row and focus on product search of the new row
          addItem();
          // focusProductSearch will retry until the element exists
          focusProductSearch(rowIndex + 1);
          break;
      }
    }, 50);
  };

  const handleKeyDown = (e, field, rowIndex = 0) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      navigateToNextField(field, rowIndex);
    } else if (e.key === 'Tab' && field === 'invoice_amount') {
      // intercept Tab on invoice amount to move to product search
      e.preventDefault();
      navigateToNextField(field, rowIndex);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (rowIndex === form.items.length - 1) {
        addItem(); // Add a new row if currently on the last row
        setTimeout(() => {
          // Focus on the same field in the new row
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
      navigateToNextField('product', rowIndex);
    } else if (e.key === 'ArrowUp' && rowIndex > 0) {
      e.preventDefault();
      const prevRowIndex = rowIndex - 1;
      focusProductSearch(prevRowIndex);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (rowIndex === form.items.length - 1) {
        addItem(); // Add a new row if currently on the last row
        setTimeout(() => {
          focusProductSearch(rowIndex + 1); // Focus on the new row's product search input
        }, 200);
      } else {
        focusProductSearch(rowIndex + 1);
      }
    }
  };

const handleSubmit = async (e) => {
  e.preventDefault();

  // 1. Prevent negative margin
  const negativeMarginItem = form.items.find((item) => Number(item.margin) < 0);
  if (negativeMarginItem) {
    const product = products.find((p) => p.id === negativeMarginItem.product_id);
    const productName = product ? product.name : negativeMarginItem.product_id;
    toast.error(`Margin cannot be negative for Product ${productName}`);
    return;
  }

  // 2. Validate invoice amount vs total amount
  const invoiceAmount = Number(form.invoice_amount || 0);
  const totalAmount = Number(form.total_amount || 0);
  if (Math.abs(invoiceAmount - totalAmount) > 5) {
    toast.error(
      `Invoice amount (${invoiceAmount}) must be equal to total amount (${totalAmount}), difference > 5`
    );
    return;
  }

  try {
    if (invoiceId) {
      await axios.put(`/api/purchase-invoices/${invoiceId}`, form);
      toast.success("Invoice updated successfully");
    } else {
      await axios.post("/api/purchase-invoices", form);
      toast.success("Invoice created successfully");
    }
    onSuccess();
  } catch (err) {
    toast.error("Failed to save invoice");
  }
};


  return (
    <form className="flex flex-col" style={{minHeight: "74vh", maxHeight: "80vh" }}>
      {/* ================= HEADER SECTION ================= */}
      <div className="sticky top-0 bg-white shadow p-2 z-10">
        <h2 className="text-sm font-bold mb-2">Purchase Invoice (Use Enter to navigate, Alt+S to save)</h2>
        <table className="w-full border-collapse text-xs">
          <tbody>
            <tr>
              <td className="border p-1 w-1/12">
                <label className="block text-[10px]">Posted Number</label>
                <input
                  type="text"
                  name="posted_number"
                  readOnly
                  value={form.posted_number || ""}
                  className="bg-gray-100 border rounded w-full p-1 h-7 text-xs"
                />
              </td>
              <td className="border p-1 w-1/6">
                <label className="block text-[10px]">Posted Date</label>
                <input
                  type="date"
                  name="posted_date"
                  value={form.posted_date}
                  onChange={handleChange}
                  className="border rounded w-full p-1 h-7 text-xs"
                />
              </td>
              <td className="border p-1 w-1/3">
                <label className="block text-[10px]">Supplier *</label>
                <Select
                  ref={supplierRef}
                  options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
                  value={
                    suppliers
                      .map((s) => ({ value: s.id, label: s.name }))
                      .find((s) => s.value === form.supplier_id) || null
                  }
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
              <td className="border p-1 w-1/8">
                <label className="block text-[10px]">Invoice Number</label>
                <input
                  ref={invoiceNumberRef}
                  type="text"
                  name="invoice_number"
                  value={form.invoice_number}
                  onChange={handleChange}
                  onKeyDown={(e) => handleKeyDown(e, 'invoice_number')}
                  className="border rounded w-full p-1 h-7 text-xs"
                />
              </td>
              <td className="border p-1 w-1/8">
                <label className="block text-[10px]">Invoice Amount</label>
                <input
                  ref={invoiceAmountRef}
                  type="text"
                  name="invoice_amount"
                  value={form.invoice_amount}
                  onChange={handleChange}
                  onKeyDown={(e) => handleKeyDown(e, 'invoice_amount')}
                  className="border rounded w-full p-1 h-7 text-xs"
                />
              </td>
              <td className="border p-1 w-1/4">
                <label className="block text-[10px]">Remarks</label>
                <input
                  type="text"
                  name="remarks"
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
              <th colSpan={3} className="border">Pack Size / Batch / Expiry</th>
              <th colSpan={2} className="border">Qty (Pack / Unit)</th>
              <th colSpan={2} className="border">Purchase Price (P / U)</th>
              <th colSpan={3} className="border">Disc % / Bonus (P / U)</th>
              <th colSpan={2} className="border">Sale Price (P / U)</th>
              <th colSpan={2} className="border">Margin % / Avg </th>
              <th rowSpan={2} className="border w-6">+</th>
            </tr>

            <tr>
              <th className="border w-14">PSize</th>
              <th className="border w-16">Batch</th>
              <th className="border w-20">Exp</th>
              <th className="border w-12">Pack.Q</th>
              <th className="border w-12">Unit.Q</th>
              <th className="border w-14">Pack.P</th>
              <th className="border w-14">Unit.P</th>
              <th className="border w-14">Disc%</th>
              <th className="border w-14">PBonus</th>
              <th className="border w-14">UBonus</th>
              <th className="border w-14">Pack.S</th>
              <th className="border w-14">Unit.S</th>
              <th className="border w-14">Margin%</th>
              <th className="border w-16">Avg</th>
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

                {/* Product Search Input - wrapped in a div ref so we can reliably query the inner input */}
                <td colSpan={1} className="border text-left w-[200px]">
                  <div ref={(el) => (productSearchRefs.current[i] = el)}>
                    <ProductSearchInput
                    value={item.product_id}
                    onChange={(val) => {
                    const selectedProduct = products.find((p) => p.id === val);

                    const duplicateIndex = form.items.findIndex((it, idx) => {
                        if (idx === i) return false;
                        if (it.product_id !== selectedProduct?.id) return false;

                        // Case 1: Other row has a batch
                        if (it.batch && it.batch.trim() !== "") {
                        // allow different batch, block same batch
                        return it.batch === form.items[i]?.batch;
                        }

                        // Case 2: Other row has no batch → block duplicate outright
                        return true;
                    });

                    if (duplicateIndex !== -1) {
                        toast.error(
                        form.items[duplicateIndex]?.batch
                            ? `Product "${selectedProduct?.name}" with batch "${form.items[duplicateIndex].batch}" is already in row ${duplicateIndex + 1}`
                            : `Product "${selectedProduct?.name}" is already in row ${duplicateIndex + 1}`
                        );
                        return; // ⛔ stop here
                    }

                    const newItems = [...form.items];
                    newItems[i] = recalcItem(
                        {
                        ...newItems[i],
                        product_id: selectedProduct?.id || "",
                        pack_size: selectedProduct?.pack_size || "",
                        pack_purchase_price: selectedProduct?.pack_purchase_price ?? "",
                        unit_purchase_price: selectedProduct?.unit_purchase_price ?? "",
                        pack_sale_price: selectedProduct?.pack_sale_price ?? "",
                        unit_sale_price: selectedProduct?.unit_sale_price ?? "",
                        // don't overwrite batch here, keep whatever user enters
                        batch: newItems[i].batch || "",
                        // reset user-editable fields
                        pack_quantity: "",
                        unit_quantity: "",
                        pack_bonus: "",
                        unit_bonus: "",
                        item_discount_percentage: "",
                        margin: "",
                        sub_total: "",
                        avg_price: "",
                        quantity: "",
                        },
                        selectedProduct
                    );

                    setForm({ ...form, items: newItems });
                    navigateToNextField("product", i);
                    }}


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
                    value={item.pack_size ?? ""}
                    className="border bg-gray-100 w-full h-6 text-[11px] px-1 appearance-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </td>

                {/* Batch */}
                <td className="border w-16">
                    <input
                        type="text"
                        value={item.batch ?? ""}
                        onChange={(e) => {
                        const newBatch = e.target.value;

                        // ✅ Duplicate check
                        const duplicateIndex = form.items.findIndex((it, idx) => {
                            if (idx === i) return false;
                            if (it.product_id !== item.product_id) return false;

                            // If another row has batch → block only if same batch
                            if (it.batch && it.batch.trim() !== "") {
                            return it.batch === newBatch;
                            }

                            // If another row has no batch → block outright
                            return !newBatch;
                        });

                        if (duplicateIndex !== -1) {
                            toast.error(
                            newBatch
                                ? `Product "${
                                    products.find((p) => p.id === item.product_id)?.name
                                }" with batch "${newBatch}" already exists in row ${
                                    duplicateIndex + 1
                                }`
                                : `Product "${
                                    products.find((p) => p.id === item.product_id)?.name
                                }" without batch already exists in row ${duplicateIndex + 1}`
                            );
                            return; // ⛔ block update
                        }

                        // If no duplicate → update
                        const newItems = [...form.items];
                        newItems[i] = { ...newItems[i], batch: newBatch };
                        setForm({ ...form, items: newItems });
                        }}
                        className="border w-full h-6 text-[11px] px-1"
                    />
                    </td>
                {/* Expiry */}
                <td className="border w-20">
                  <input
                    type="date"
                    value={item.expiry ?? ""}
                    onChange={(e) => handleItemChange(i, "expiry", e.target.value)}
                    className="border w-full h-6 text-[11px] px-1"
                  />
                </td>

                {/* Pack Qty */}
                <td className="border">
                  <input
                    ref={(el) => (packQuantityRefs.current[i] = el)}
                    type="text"
                    value={item.pack_quantity === 0 ? "" : item.pack_quantity}
                    onChange={(e) => handleItemChange(i, "pack_quantity", e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, 'pack_quantity', i)}
                    className="border w-full h-6 text-[11px] px-1 appearance-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </td>

                {/* Unit Qty */}
                <td className="border">
                  <input
                    type="text"
                    value={item.unit_quantity=== 0 ? "" : item.unit_quantity}
                    onChange={(e) => handleItemChange(i, "unit_quantity", e.target.value)}
                    className="border w-full h-6 text-[11px] px-1 appearance-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </td>

                {/* Pack Purchase */}
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

                {/* Unit Purchase */}
                <td className="border">
                  <input
                    type="text"
                    value={item.unit_purchase_price ?? ""}
                    onChange={(e) => handleItemChange(i, "unit_purchase_price", e.target.value)}
                    className="border w-full h-6 text-[11px] px-1 appearance-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </td>

                {/* Disc% */}
                <td className="border">
                  <input
                    ref={(el) => (itemDiscountRefs.current[i] = el)}
                    type="text"
                    value={item.item_discount_percentage ?? ""}
                    onChange={(e) => handleItemChange(i, "item_discount_percentage", e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, 'item_discount', i)}
                    className="border w-full h-6 text-[11px] px-1 appearance-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </td>

                {/* Pack Bonus */}
                <td className="border">
                  <input
                    ref={(el) => (packBonusRefs.current[i] = el)}
                    type="text"
                   value={item.pack_bonus === 0 ? "" : item.pack_bonus}
                    onChange={(e) => handleItemChange(i, "pack_bonus", e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, 'pack_bonus', i)}
                    className="border w-full h-6 text-[11px] px-1 appearance-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </td>

                {/* Unit Bonus */}
                <td className="border">
                  <input
                    type="text"
                    value={item.unit_bonus === 0 ? "" : item.unit_bonus}
                    onChange={(e) => handleItemChange(i, "unit_bonus", e.target.value)}
                    className="border w-full h-6 text-[11px] px-1 appearance-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </td>

                {/* Pack Sale */}
                <td className="border">
                  <input
                    ref={(el) => (packSalePriceRefs.current[i] = el)}
                    type="text"
                    value={item.pack_sale_price ?? ""}
                    onChange={(e) => handleItemChange(i, "pack_sale_price", e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, 'pack_sale_price', i)}
                    className="border w-full h-6 text-[11px] px-1 appearance-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </td>

                {/* Unit Sale */}
                <td className="border">
                  <input
                    type="text"
                    value={item.unit_sale_price ?? ""}
                    onChange={(e) => handleItemChange(i, "unit_sale_price", e.target.value)}
                    className="border w-full h-6 text-[11px] px-1 appearance-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </td>

                {/* Margin % */}
                <td className="border">
                  <input
                    type="number"
                    readOnly
                    value={item.margin ?? ""}
                    className="border bg-gray-100 w-full h-6 text-[11px] px-1 appearance-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </td>

                {/* Avg Price (readonly) */}
                <td className="border">
                  <input
                    type="number"
                    value={item.avg_price ?? ""}
                    readOnly
                    className="border w-full h-6 text-[11px] px-1 bg-gray-100"
                  />
                </td>

                {/* Quantity */}
                <td className="border" style={{ display: 'none' }}>
                  <input
                    type="number"
                    readOnly
                    hidden
                    value={item.quantity ?? ""}
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
                <label className="block text-[10px]">Tax %</label>
                <input
                  type="text"
                  name="tax_percentage"
                  value={form.tax_percentage === 0 ? "" : form.tax_percentage}
                  onChange={handleChange}
                  className="border rounded w-full p-1 h-7 text-xs"
                />
              </td>
              <td className="border p-1 w-1/6">
                <label className="block text-[10px]">Tax Amount</label>
                <input
                  type="text"
                  name="tax_amount"
                  value={form.tax_amount === 0 ? "" : form.tax_amount}
                  onChange={handleChange}
                  className="border rounded w-full p-1 h-7 text-xs"
                />
              </td>
              <td className="border p-1 w-1/6">
                <label className="block text-[10px]">Discount %</label>
                <input
                  type="text"
                  name="discount_percentage"
                  value={form.discount_percentage === 0 ? "" : form.discount_percentage}
                  onChange={handleChange}
                  className="border rounded w-full p-1 h-7 text-xs"
                />
              </td>
              <td className="border p-1 w-1/6">
                <label className="block text-[10px]">Discount Amount</label>
                <input
                  type="text"
                  name="discount_amount"
                  value={form.discount_amount === 0 ? "" : form.discount_amount} 
                  onChange={handleChange}
                  className="border rounded w-full p-1 h-7 text-xs"
                />
              </td>
              <td className="border p-1 w-1/6">
                <label className="block text-[10px]">Total Amount</label>
                <input
                  type="number"
                  name="total_amount"
                  readOnly
                  value={form.total_amount}
                  className="border rounded w-full p-1 h-7 text-xs bg-gray-100"
                />
              </td>
              <td className="border p-1 text-center align-middle">
                <button
                  type="button"
                  onClick={handleSubmit}
                  className="bg-green-600 text-white px-8 py-3 rounded text-sm hover:bg-green-700 transition duration-200"
                >
                  {invoiceId ? "Update Invoice" : "Create Invoice"}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </form>
  );
}
