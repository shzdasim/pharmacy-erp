import { useEffect, useRef, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import Select from "react-select";
import ProductSearchInput from "../../components/ProductSearchInput.jsx";
import BatchSearchInput from "../../components/BatchSearchInput.jsx";
import { recalcItem, recalcFooter } from "../../Formula/SaleInvoice.js";

export default function SaleInvoiceForm({ saleId, onSuccess }) {
  // ===== form state =====
  const [form, setForm] = useState({
    customer_id: "",
    posted_number: "",
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
      },
    ],
  });

  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [batchesByProduct, setBatchesByProduct] = useState({});

  // refs
  const productRefs = useRef([]);
  const batchRefs = useRef([]);
  const qtyRefs = useRef([]);
  const priceRefs = useRef([]);
  const discRefs = useRef([]);
  const focusedOnce = useRef(false);

  useEffect(() => {
    (async () => {
      await Promise.all([fetchCustomers(), fetchProducts()]);
      if (saleId) {
        await fetchSale();
      } else {
        await fetchNewCode();
      }
      setTimeout(() => {
        if (!focusedOnce.current) {
          productRefs.current[0]?.querySelector?.("input")?.focus?.();
          focusedOnce.current = true;
        }
      }, 80);
    })();
  }, [saleId]);

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

  // ===== data =====
  const fetchCustomers = async () => {
    try {
      const res = await axios.get("/api/customers");
      const list = res.data || [];
      setCustomers(list);
      if (!saleId && !form.customer_id && list.length > 0) {
        setForm((prev) => ({ ...prev, customer_id: list[0].id }));
      }
    } catch {}
  };

  const fetchProducts = async () => {
    try {
      const res = await axios.get("/api/products");
      setProducts(Array.isArray(res.data) ? res.data : []);
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
      const list = raw.map(normalizeBatch).filter((x) => x.batch_number);
      setBatchesByProduct((m) => ({ ...m, [key]: list }));
      return list;
    } catch {
      setBatchesByProduct((m) => ({ ...m, [key]: [] }));
      return [];
    }
  };

  const fetchSale = async () => {
    const res = await axios.get(`/api/sale-invoices/${saleId}`);
    setForm(res.data);
  };

  const fetchNewCode = async () => {
    const res = await axios.get("/api/sale-invoices/new-code");
    setForm((prev) => ({ ...prev, posted_number: res.data.posted_number }));
  };

  // ===== utils =====
  const asISODate = (s) => {
    if (!s) return "";
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    const m = /^(\d{2})[\/-](\d{2})[\/-](\d{4})$/.exec(String(s));
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
    return String(s);
  };
  const sanitizeNumberInput = (value, allowDecimal = false) => {
    if (value === "") return "";
    if (allowDecimal) {
      if (/^\d*\.?\d*$/.test(value)) return value;
      return value.slice(0, -1);
    }
    return value.replace(/\D/g, "");
  };
  const eqId = (a, b) => String(a ?? "") === String(b ?? "");

  // ===== handlers =====
  const handleHeaderChange = (e) => {
    const { name, value } = e.target;
    const decimalFields = new Set([
      "discount_percentage",
      "discount_amount",
      "tax_percentage",
      "tax_amount",
    ]);
    const v = decimalFields.has(name) ? sanitizeNumberInput(value, true) : value;

    const tmp = { ...form, [name]: v };
    let next = recalcFooter(tmp, name);
    next[name] = v;
    setForm(next);
  };

  function handleItemChange(index, field, rawValue) {
    let value = rawValue;
    const allowDecimal = ["price", "item_discount_percentage"];
    const integerFields = ["quantity", "pack_size"];

    if (allowDecimal.includes(field)) {
      if (!/^\d*\.?\d*$/.test(value)) return;
    } else if (integerFields.includes(field)) {
      value = value.replace(/\D/g, "");
    }

    setForm((prev) => {
      const items = [...prev.items];
      // >>> NEW: toast when quantity exceeds available (without spamming)
    if (field === "quantity") {
      const available = Number(items[index].current_quantity || 0);
      const prevQtyNum = Number(items[index].quantity || 0);
      const nextQtyNum = Number(value || 0);
      if (nextQtyNum > available && prevQtyNum <= available) {
        toast.error(`Row ${index + 1}: quantity exceeds available (${available})`);
      }
    }
      items[index] = recalcItem({ ...items[index], [field]: value }, field);
      return recalcFooter({ ...prev, items }, "items");
    });
  }

  const addRow = () => {
    setForm((prev) => ({
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
        },
      ],
    }));
  };

  const removeRow = (i) => {
    if (form.items.length <= 1) return;
    const items = form.items.filter((_, idx) => idx !== i);
    setForm((prev) => recalcFooter({ ...prev, items }, "items"));
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
        },
        "revert_duplicate_product"
      );
      return recalcFooter({ ...prev, items: items2 }, "items");
    });
  };

  // === CHANGED: fill Available from product.quantity immediately + strict unique product ===
  const handleProductSelect = async (rowIndex, productIdOrObj) => {
    const productId = resolveId(productIdOrObj);
    if (!productId && productId !== 0) return;

    // Strict uniqueness: product can appear only once
    const dupIndex = form.items.findIndex(
      (row, idx) => idx !== rowIndex && eqId(row.product_id, productId)
    );
    if (dupIndex !== -1) {
      toast.error(`Product already used in row ${dupIndex + 1}. Each product can be added only once.`);
      resetRow(rowIndex);
      setTimeout(() => {
        productRefs.current[rowIndex]?.querySelector?.("input")?.focus?.();
      }, 50);
      return;
    }

    const selected =
      products.find((p) => eqId(p.id, productId)) ||
      (typeof productIdOrObj === "object" ? productIdOrObj : {}) ||
      {};

    const packSize = selected?.pack_size ?? "";
    const available = selected?.quantity ?? selected?.available_units ?? 0; // <-- use product.quantity
    const price = selected?.unit_sale_price ?? selected?.unit_purchase_price ?? "";

    // Preload batches (to decide focus next)
    const batchList = await fetchBatches(productId);
    const hasBatches = Array.isArray(batchList) && batchList.length > 0;

    setForm((prev) => {
      const items = [...prev.items];
      items[rowIndex] = recalcItem(
        {
          ...items[rowIndex],
          product_id: productId,
          pack_size: packSize,
          price,
          batch_number: "",
          expiry: "",
          current_quantity: available.toString(), // <-- show immediately
          quantity: "",
          sub_total: "",
        },
        "product_select"
      );
      return recalcFooter({ ...prev, items }, "items");
    });

    setTimeout(() => {
      if (hasBatches) {
        batchRefs.current[rowIndex]?.querySelector?.("input")?.focus?.();
      } else {
        qtyRefs.current[rowIndex]?.focus?.();
      }
    }, 60);
  };

  // === CHANGED: keep expiry + overwrite Available with batch specific when batch selected ===
  const handleBatchSelect = async (rowIndex, batchNum) => {
    const row0 = form.items[rowIndex];

    try {
      const batches = await fetchBatches(row0.product_id);
      const b = (batches || []).find((x) => String(x.batch_number) === String(batchNum));

      // Prefer API; fall back to batch value
      const params = new URLSearchParams({
        product_id: row0.product_id || "",
        batch: batchNum || "",
      }).toString();

      let available = Number(b?.available_units ?? 0);
      try {
        const res = await axios.get(`/api/products/available-quantity?${params}`);
        available = Number(
          res?.data?.available ?? res?.data?.available_units ?? res?.data?.quantity ?? available ?? 0
        );
      } catch {}

      const exp = asISODate(b?.expiry || "");

      setForm((prev) => {
        const items = [...prev.items];
        const updated = {
          ...items[rowIndex],
          batch_number: batchNum,
          current_quantity: String(available), // overwrite with batch available
        };
        if (exp) updated.expiry = exp;
        items[rowIndex] = recalcItem(updated, "batch_select");
        return recalcFooter({ ...prev, items }, "items");
      });

      setTimeout(() => {
        qtyRefs.current[rowIndex]?.focus?.();
      }, 60);
    } catch {}
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validations
    for (let i = 0; i < form.items.length; i++) {
      const it = form.items[i];
      if (!it.product_id) return toast.error(`Row ${i + 1}: select a product`);

      // Only require batch if this product actually has batches
      const list = batchesByProduct[String(it.product_id)];
      const hasBatches = Array.isArray(list) && list.length > 0;
      if (hasBatches && !it.batch_number) return toast.error(`Row ${i + 1}: select a batch`);

      if (!it.quantity) return toast.error(`Row ${i + 1}: enter quantity`);
      const available = Number(it.current_quantity || 0);
      if (Number(it.quantity) > available) {
        return toast.error(`Row ${i + 1}: quantity exceeds available (${available})`);
      }
    }

    // Strict unique product across rows
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

    try {
      if (saleId) {
        await axios.put(`/api/sale-invoices/${saleId}`, form);
        toast.success("Sale invoice updated");
      } else {
        await axios.post("/api/sale-invoices", form);
        toast.success("Sale invoice created");
      }
      onSuccess?.();
    } catch {
      toast.error("Failed to save sale invoice");
    }
  };

  // ---------- Keyboard Navigation ----------
  const COLS = ["product", "batch", "quantity", "disc"];

  const focusCell = (row, col) => {
    const map = {
      product: productRefs,
      batch: batchRefs,
      quantity: qtyRefs,
      price: priceRefs,
      disc: discRefs,
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
        addRow();
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
        addRow();
        setTimeout(() => focusCell(row + 1, COLS[0]), 60);
      } else {
        focusCell(row + 1, COLS[0]);
      }
    }
  };

  const onKeyNav = (e, row, col) => {
    if (col === "batch" && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      return;
    }
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

  // ===== render =====
  return (
    <form className="flex flex-col" style={{ minHeight: "74vh", maxHeight: "80vh" }}>
      {/* Header */}
      {/* Header */}
<div className="sticky top-0 bg-white shadow p-2 z-10">
  <h2 className="text-sm font-bold mb-2">
    Sale Invoice (Enter → next field, Arrow ↑/↓ to move rows, Alt+S to save)
  </h2>

  <table className="w-full border-collapse text-xs">
    <tbody>
      {/* Row 1: Posted #, Date, Customer, Doctor, Patient */}
      <tr>
        <td className="border p-1 w-24">
          <label className="block text-[10px]">Posted Number</label>
          <input
            type="text"
            name="posted_number"
            readOnly
            value={form.posted_number || ""}
            className="bg-gray-100 border rounded w-full p-1 h-7 text-xs"
          />
        </td>

        <td className="border p-1 w-40">
          <label className="block text-[10px]">Date</label>
          <input
            type="date"
            name="date"
            value={form.date}
            onChange={handleHeaderChange}
            className="border rounded w-full p-1 h-7 text-xs"
          />
        </td>

        <td className="border p-1 w-[28%]">
          <label className="block text-[10px]">Customer *</label>
          <Select
            options={customers.map((c) => ({ value: c.id, label: c.name }))}
            value={
              customers
                .map((c) => ({ value: c.id, label: c.name }))
                .find((s) => s.value === form.customer_id) || null
            }
            onChange={(val) =>
              setForm((prev) => ({ ...prev, customer_id: val?.value || "" }))
            }
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
              input: (base) => ({ ...base, margin: 0, padding: 0 }),
            }}
          />
        </td>

        <td className="border p-1 w-[22%]">
          <label className="block text-[10px]">Doctor Name</label>
          <input
            type="text"
            name="doctor_name"
            value={form.doctor_name}
            onChange={handleHeaderChange}
            className="border rounded w-full p-1 h-7 text-xs"
          />
        </td>

        <td className="border p-1 w-[22%]">
          <label className="block text-[10px]">Patient Name</label>
          <input
            type="text"
            name="patient_name"
            value={form.patient_name}
            onChange={handleHeaderChange}
            className="border rounded w-full p-1 h-7 text-xs"
          />
        </td>
      </tr>

      {/* Row 2: Remarks only (full width) */}
      <tr>
        <td className="border p-1" colSpan={5}>
          <label className="block text-[10px]">Remarks</label>
          <input
            type="text"
            name="remarks"
            value={form.remarks}
            onChange={handleHeaderChange}
            className="border rounded w-full p-1 h-7 text-xs"
          />
        </td>
      </tr>
    </tbody>
  </table>
</div>


      {/* Items */}
      <div className="flex-1 overflow-auto p-1">
        <h2 className="text-xs font-bold mb-1">Items</h2>
        <table className="w-full border-collapse text-[11px]">
          <thead className="sticky top-0 bg-gray-100">
            <tr>
              <th className="border w-6">#</th>
              <th className="border w-[160px]">Product</th>
              <th className="border w-14">PSize</th>
              <th className="border w-20">Batch</th>
              <th className="border w-20">Expiry</th>
              <th className="border w-16">Available</th>
              <th className="border w-16">Qty</th>
              <th className="border w-20">Price</th>
              <th className="border w-20">Disc%</th>
              <th className="border w-24">Sub Total</th>
              <th className="border w-6">+</th>
            </tr>
          </thead>
          <tbody>
            {form.items.map((it, i) => (
              <tr key={i} className="text-center">
                <td className="border">
                  <button type="button" onClick={() => removeRow(i)} className="bg-red-500 text-white px-1 rounded text-[10px]">X</button>
                </td>
                <td className="border text-left">
                  <div ref={(el) => (productRefs.current[i] = el)}>
                    <ProductSearchInput
                      value={it.product_id}
                      onChange={(val) => handleProductSelect(i, val)}
                      onKeyDown={(e) => onKeyNav(e, i, "product")}
                      products={products}
                      onRefreshProducts={fetchProducts}
                    />
                  </div>
                </td>
                <td className="border">
                  <input type="text" readOnly value={it.pack_size ?? ""}
                    className="border bg-gray-100 w-full h-6 text-[11px] px-1" />
                </td>
                <td className="border">
                  <div ref={(el) => (batchRefs.current[i] = el)}>
                    <BatchSearchInput
                      value={it.batch_number}
                      onChange={(val) => handleBatchSelect(i, val)}
                      batches={(batchesByProduct[it.product_id] || []).map((b) => ({
                        ...b,
                        batch_number: b.batch_number || b.batch,
                      }))}
                      usedBatches={form.items
                        .filter((row, idx) => idx !== i && row.product_id === it.product_id)
                        .map((row) => row.batch_number)
                        .filter(Boolean)}
                      onKeyDown={(e) => onKeyNav(e, i, "batch")}
                    />
                  </div>
                </td>
                <td className="border">
                  <input type="date" value={it.expiry ?? ""} readOnly
                    className="border bg-gray-100 w-full h-6 text-[11px] px-1" />
                </td>
                <td className="border">
                  <input type="text" readOnly value={it.current_quantity ?? ""}
                    className="border bg-gray-100 w-full h-6 text-[11px] px-1" />
                </td>
                <td className="border">
                  <input
                    ref={(el) => (qtyRefs.current[i] = el)}
                    type="text"
                    value={it.quantity ?? ""}
                    onChange={(e) => handleItemChange(i, "quantity", e.target.value)}
                    className={
                      "border w-full h-6 text-[11px] px-1 " +
                      (Number(it.quantity || 0) > Number(it.current_quantity || 0)
                        ? "border-red-500 ring-1 ring-red-400"
                        : "")
                    }
                    onKeyDown={(e) => onKeyNav(e, i, "quantity")}
                  />
                </td>
                <td className="border">
                  <input
                    ref={(el) => (priceRefs.current[i] = el)}
                    type="text"
                    value={it.price ?? ""}
                    readOnly
                    className="border bg-gray-100 w-full h-6 text-[11px] px-1"
                    onKeyDown={(e) => onKeyNav(e, i, "price")}
                  />
                </td>
                <td className="border">
                  <input
                    ref={(el) => (discRefs.current[i] = el)}
                    type="text"
                    value={it.item_discount_percentage ?? ""}
                    onChange={(e) => handleItemChange(i, "item_discount_percentage", e.target.value)}
                    className="border w-full h-6 text-[11px] px-1"
                    onKeyDown={(e) => onKeyNav(e, i, "disc")}
                  />
                </td>
                <td className="border">
                  <input type="text" readOnly value={it.sub_total ?? ""}
                    className="border bg-gray-100 w-full h-6 text-[11px] px-1" />
                </td>
                <td className="border">
                  <button type="button" onClick={addRow} className="bg-blue-500 text-white px-1 rounded text-[10px]">+</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="sticky bottom-0 bg-white shadow p-2 z-10">
        <table className="w-full border-collapse text-xs">
          <tbody>
            <tr>
              <td className="border p-1 w-1/8">
                <label className="block text-[10px]">Tax %</label>
                <input type="text" name="tax_percentage" value={form.tax_percentage ?? ""}
                  onChange={handleHeaderChange} className="border rounded w-full p-1 h-7 text-xs" />
              </td>
              <td className="border p-1 w-1/8">
                <label className="block text-[10px]">Tax Amount</label>
                <input type="text" name="tax_amount" value={form.tax_amount ?? ""}
                  onChange={handleHeaderChange} className="border rounded w-full p-1 h-7 text-xs" />
              </td>
              <td className="border p-1 w-1/8">
                <label className="block text-[10px]">Discount %</label>
                <input type="text" name="discount_percentage" value={form.discount_percentage ?? ""}
                  onChange={handleHeaderChange} className="border rounded w-full p-1 h-7 text-xs" />
              </td>
              <td className="border p-1 w-1/8">
                <label className="block text-[10px]">Discount Amount</label>
                <input type="text" name="discount_amount" value={form.discount_amount ?? ""}
                  onChange={handleHeaderChange} className="border rounded w-full p-1 h-7 text-xs" />
              </td>
              <td className="border p-1 w-1/8">
                <label className="block text-[10px]">Gross Amount</label>
                <input type="text" readOnly value={form.gross_amount ?? ""}
                  className="border rounded w-full p-1 h-7 text-xs bg-gray-100" />
              </td>
              <td className="border p-1 w-1/8">
                <label className="block text-[10px]">Total</label>
                <input type="text" readOnly value={form.total ?? ""}
                  className="border rounded w-full p-1 h-7 text-xs bg-gray-100" />
              </td>
              <td className="border p-1 w-1/6 text-center align-middle">
                <button type="button" onClick={handleSubmit}
                  className="bg-green-600 text-white px-8 py-3 rounded text-sm hover:bg-green-700 transition duration-200">
                  {saleId ? "Update Sale" : "Create Sale"}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </form>
  );
}
