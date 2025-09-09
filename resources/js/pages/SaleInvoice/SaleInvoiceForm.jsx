import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
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
    total_receive: "", // mirror of purchase total_paid
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

  // Auto-sync total_receive with total until user edits
  const [receiveTouched, setReceiveTouched] = useState(false);

  // Misc state
  const [marginPct, setMarginPct] = useState("");
  const navigate = useNavigate();
  useEffect(() => {
    setMarginPct("");
    setReceiveTouched(false);
  }, [saleId]);

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
        if (!focusedOnce.current && !saleId) {
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

  // ===== utils/helpers =====
  const to2 = (n) => Number(parseFloat(n || 0).toFixed(2));
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
      // allow "12", "12.", ".5", "12.34"
      if (/^\d*\.?\d*$/.test(value)) return value;
      return value.slice(0, -1);
    }
    return value.replace(/\D/g, "");
  };
  const eqId = (a, b) => String(a ?? "") === String(b ?? "");
  const zeroToEmpty = (v) => (v === 0 || v === "0" ? "" : (v ?? ""));

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
    setReceiveTouched(true); // prevent auto-sync overwrite on edit
    await ensureProductsForItems(res.data?.items || []);
    await ensureBatchesForItems(res.data?.items || []);
  };

  const fetchNewCode = async () => {
    const res = await axios.get("/api/sale-invoices/new-code");
    setForm((prev) => ({ ...prev, posted_number: res.data.posted_number }));
  };

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
    if (!receiveTouched) next.total_receive = next.total ?? "";
    setForm(next);
  };

  function handleItemChange(index, field, rawValue) {
    let value = rawValue;
    const allowDecimal = ["price", "item_discount_percentage"];
    const integerFields = ["quantity", "pack_size"];

    if (allowDecimal.includes(field)) {
      // allow 12, 12., .5, 12.34
      if (!/^\d*\.?\d*$/.test(value)) return;
    } else if (integerFields.includes(field)) {
      value = value.replace(/\D/g, "");
    }

    setForm((prev) => {
      const items = [...prev.items];

      // toast when quantity crosses available
      if (field === "quantity") {
        const available = Number(items[index].current_quantity || 0);
        const prevQtyNum = Number(items[index].quantity || 0);
        const nextQtyNum = Number(value || 0);
        if (nextQtyNum > available && prevQtyNum <= available) {
          toast.error(`Row ${index + 1}: quantity exceeds available (${available})`);
        }
      }

      // run formula
      let row = recalcItem({ ...items[index], [field]: value }, field);

      // Force-keep user's decimal text for item_discount_percentage
      if (field === "item_discount_percentage") {
        row.item_discount_percentage = value;
      }

      items[index] = row;

      let updated = recalcFooter({ ...prev, items }, "items");
      if (!receiveTouched) updated.total_receive = updated.total ?? "";
      return updated;
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
    let next = recalcFooter({ ...form, items }, "items");
    if (!receiveTouched) next.total_receive = next.total ?? "";
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
        },
        "revert_duplicate_product"
      );
      let next = recalcFooter({ ...prev, items: items2 }, "items");
      if (!receiveTouched) next.total_receive = next.total ?? "";
      return next;
    });
  };

  // Product select: set qty & discount empty; unique product constraint; preload batches
  const handleProductSelect = async (rowIndex, productIdOrObj) => {
    const productId = resolveId(productIdOrObj);
    if (!productId && productId !== 0) return;

    // Strict uniqueness
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

    const rawMargin = selected?.margin ?? selected?.margin_percentage ?? selected?.default_margin ?? "";
    setMarginPct(sanitizeNumberInput(String(rawMargin), true));
    const packSize = selected?.pack_size ?? "";
    const available = selected?.quantity ?? selected?.available_units ?? 0;
    const price = selected?.unit_sale_price ?? selected?.unit_purchase_price ?? "";

    // Preload batches
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
          current_quantity: available.toString(),
          quantity: "",                    // empty (not 0)
          item_discount_percentage: "",    // empty (not 0)
          sub_total: "",
        },
        "product_select"
      );
      let next = recalcFooter({ ...prev, items }, "items");
      if (!receiveTouched) next.total_receive = next.total ?? "";
      return next;
    });

    setTimeout(() => {
      if (hasBatches) {
        batchRefs.current[rowIndex]?.querySelector?.("input")?.focus?.();
      } else {
        qtyRefs.current[rowIndex]?.focus?.();
      }
    }, 60);
  };

  // Batch select: update expiry & available
  const handleBatchSelect = async (rowIndex, batchNum) => {
    const row0 = form.items[rowIndex];

    try {
      const batches = await fetchBatches(row0.product_id);
      const b = (batches || []).find((x) => String(x.batch_number) === String(batchNum));

      // Prefer API; fall back to batch
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
          current_quantity: String(available),
        };
        if (exp) updated.expiry = exp;
        items[rowIndex] = recalcItem(updated, "batch_select");
        let next = recalcFooter({ ...prev, items }, "items");
        if (!receiveTouched) next.total_receive = next.total ?? "";
        return next;
      });

      setTimeout(() => {
        qtyRefs.current[rowIndex]?.focus?.();
      }, 60);
    } catch {}
  };

  // Merge new products into state (by id, dedup)
  const upsertProducts = (list) => {
    if (!Array.isArray(list)) return;
    setProducts((prev) => {
      const map = new Map((prev || []).map((p) => [String(p.id), p]));
      list.forEach((p) => p?.id != null && map.set(String(p.id), p));
      return Array.from(map.values());
    });
  };

  // Ensure all product_ids in form.items exist in products[]
  const ensureProductsForItems = async (items = []) => {
    const ids = Array.from(new Set(items.map((it) => it.product_id).filter(Boolean))).map(String);
    if (!ids.length) return;

    const have = new Set((products || []).map((p) => String(p.id)));
    const missing = ids.filter((id) => !have.has(id));
    if (!missing.length) return;

    try {
      const { data } = await axios.get("/api/products/by-ids", {
        params: { ids: missing.join(",") },
      });
      const list = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
      upsertProducts(list);
      return;
    } catch (_) {}

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

    // Row validations
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

    // total_receive validation against total
    {
      const totalNum = Number(form.total || 0);
      const recvNum = Number(form.total_receive || 0);
      if (recvNum < 0) {
        toast.error("Total Receive cannot be negative");
        return;
      }
      if (recvNum > totalNum) {
        toast.error("Total Receive cannot exceed Total");
        return;
      }
    }

    try {
      if (saleId) {
        const res = await axios.put(`/api/sale-invoices/${saleId}`, form);
        const id = res?.data?.id ?? saleId;
        toast.success("Sale invoice updated");
        navigate(`/sale-invoices/${id}`);
      } else {
        const res = await axios.post(`/api/sale-invoices`, form);
        const id = res?.data?.id;
        toast.success("Sale invoice created");
        if (id) {
          navigate(`/sale-invoices/${id}`);
        } else {
          toast.error("Missing invoice ID from server response.");
        }
      }
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
      input.select?.(); // select on focus
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
      return; // BatchSearchInput likely manages its own list navigation
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
      <div className="sticky top-0 bg-white shadow p-2 z-10">
        <h2 className="text-sm font-bold mb-2">
          Sale Invoice (Enter → next field, Arrow ↑/↓ to move rows, Alt+S to save)
        </h2>

        <table className="w-full border-collapse text-xs">
          <tbody>
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
                  <button
                    type="button"
                    onClick={() => removeRow(i)}
                    className="bg-red-500 text-white px-1 rounded text-[10px]"
                  >
                    X
                  </button>
                </td>

                <td className="border text-left">
                  <div ref={(el) => (productRefs.current[i] = el)}>
                    <ProductSearchInput
                      value={products.find((p) => eqId(p.id, it.product_id)) || it.product_id}
                      onChange={(val) => handleProductSelect(i, val)}
                      onKeyDown={(e) => onKeyNav(e, i, "product")}
                      products={products}
                      onRefreshProducts={fetchProducts}
                    />
                  </div>
                </td>

                <td className="border">
                  <input
                    type="text"
                    readOnly
                    value={it.pack_size ?? ""}
                    className="border bg-gray-100 w-full h-6 text-[11px] px-1"
                  />
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
                  <input
                    type="date"
                    value={it.expiry ?? ""}
                    readOnly
                    className="border bg-gray-100 w-full h-6 text-[11px] px-1"
                  />
                </td>

                <td className="border">
                  <input
                    type="text"
                    readOnly
                    value={it.current_quantity ?? ""}
                    className="border bg-gray-100 w-full h-6 text-[11px] px-1"
                  />
                </td>

                <td className="border">
                  <input
                    ref={(el) => (qtyRefs.current[i] = el)}
                    type="text"
                    inputMode="numeric"
                    value={zeroToEmpty(it.quantity)} // show "" instead of 0
                    onChange={(e) => handleItemChange(i, "quantity", e.target.value)}
                    className={
                      "border w-full h-6 text-[11px] px-1 " +
                      (Number(it.quantity || 0) > Number(it.current_quantity || 0)
                        ? "border-red-500 ring-1 ring-red-400"
                        : "")
                    }
                    onKeyDown={(e) => onKeyNav(e, i, "quantity")}
                    onFocus={(e) => e.target.select()} // select on focus
                  />
                </td>

                <td className="border">
                  <input
                    ref={(el) => (priceRefs.current[i] = el)}
                    type="text"
                    value={to2(it.price ?? "")}
                    readOnly
                    className="border bg-gray-100 w-full h-6 text-[11px] px-1"
                    onKeyDown={(e) => onKeyNav(e, i, "price")}
                  />
                </td>

                <td className="border">
                  <input
                    ref={(el) => (discRefs.current[i] = el)}
                    type="text"
                    inputMode="decimal"
                    value={zeroToEmpty(it.item_discount_percentage)} // show "" instead of 0
                    onChange={(e) =>
                      handleItemChange(i, "item_discount_percentage", e.target.value)
                    }
                    onBlur={(e) => {
                      const v = e.target.value;
                      if (v !== "") {
                        const num = Number(v);
                        if (Number.isFinite(num)) {
                          // normalize to 2dp but keep via handleItemChange which preserves decimals
                          handleItemChange(i, "item_discount_percentage", num.toFixed(2));
                        }
                      }
                    }}
                    className="border w-full h-6 text-[11px] px-1"
                    onKeyDown={(e) => onKeyNav(e, i, "disc")}
                    onFocus={(e) => e.target.select()} // select on focus
                  />
                </td>

                <td className="border">
                  <input
                    type="text"
                    readOnly
                    value={it.sub_total ?? ""}
                    className="border bg-gray-100 w-full h-6 text-[11px] px-1"
                  />
                </td>

                <td className="border">
                  <button
                    type="button"
                    onClick={addRow}
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

      {/* Footer */}
      <div className="sticky bottom-0 bg-white shadow p-2 z-10">
        <table className="w-full border-collapse text-xs">
          <tbody>
            <tr>
              <td className="border p-1">
                <label className="block text-[10px]">Margin %</label>
                <input
                  type="text"
                  name="margin_percentage"
                  readOnly
                  value={marginPct}
                  onChange={(e) =>
                    setMarginPct(sanitizeNumberInput(e.target.value, true))
                  }
                  className="border rounded w-full p-1 h-7 text-xs bg-gray-100"
                />
              </td>

              <td className="border p-1 w-1/8">
                <label className="block text-[10px]">Tax %</label>
                <input
                  type="text"
                  name="tax_percentage"
                  value={form.tax_percentage ?? ""}
                  onChange={handleHeaderChange}
                  className="border rounded w-full p-1 h-7 text-xs"
                />
              </td>

              <td className="border p-1 w-1/8">
                <label className="block text-[10px]">Tax Amount</label>
                <input
                  type="text"
                  name="tax_amount"
                  value={form.tax_amount ?? ""}
                  onChange={handleHeaderChange}
                  className="border rounded w-full p-1 h-7 text-xs"
                />
              </td>

              <td className="border p-1 w-1/8">
                <label className="block text-[10px]">Discount %</label>
                <input
                  type="text"
                  name="discount_percentage"
                  value={form.discount_percentage ?? ""}
                  onChange={handleHeaderChange}
                  className="border rounded w-full p-1 h-7 text-xs"
                />
              </td>

              <td className="border p-1 w-1/8">
                <label className="block text-[10px]">Discount Amount</label>
                <input
                  type="text"
                  name="discount_amount"
                  value={form.discount_amount ?? ""}
                  onChange={handleHeaderChange}
                  className="border rounded w-full p-1 h-7 text-xs"
                />
              </td>

              <td className="border p-1 w-1/8">
                <label className="block text-[10px]">Gross Amount</label>
                <input
                  type="text"
                  readOnly
                  value={form.gross_amount ?? ""}
                  className="border rounded w-full p-1 h-7 text-xs bg-gray-100"
                />
              </td>

              <td className="border p-1 w-1/8">
                <label className="block text-[10px]">Total</label>
                <input
                  type="text"
                  readOnly
                  value={form.total ?? ""}
                  className="border rounded w-full p-1 h-7 text-xs bg-gray-100"
                />
              </td>

              {/* Total Receive */}
              <td className="border p-1 w-1/8">
                <label className="block text-[10px]">Total Receive</label>
                <input
                  type="text"
                  name="total_receive"
                  inputMode="decimal"
                  value={form.total_receive ?? ""}
                  onChange={(e) => {
                    const v = sanitizeNumberInput(e.target.value, true);
                    setReceiveTouched(true);
                    setForm((prev) => ({ ...prev, total_receive: v }));
                  }}
                  onBlur={() => {
                    setForm((prev) => ({
                      ...prev,
                      total_receive: to2(prev.total_receive).toFixed(2),
                    }));
                  }}
                  className="border rounded w-full p-1 h-7 text-xs"
                />
              </td>

              {/* Remaining */}
              <td className="border p-1 w-1/8">
                <label className="block text-[10px]">Remaining</label>
                <input
                  type="text"
                  readOnly
                  value={to2(
                    (Number(form.total) || 0) - (Number(form.total_receive) || 0)
                  ).toFixed(2)}
                  className="border rounded w-full p-1 h-7 text-xs bg-gray-100"
                />
              </td>

              <td className="border p-1 w-1/6 text-center align-middle">
                <button
                  type="button"
                  onClick={handleSubmit}
                  className="bg-green-600 text-white px-8 py-3 rounded text-sm hover:bg-green-700 transition duration-200"
                >
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
