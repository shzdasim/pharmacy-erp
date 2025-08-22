import { useState, useEffect } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import Select from "react-select";
import ProductSearchInput from "../../components/ProductSearchInput.jsx";
import { recalcItem, recalcFooter } from "../../Formula/PurchaseInvoice.js";
export default function PurchaseInvoiceForm({ invoiceId, onSuccess }) {
  const [form, setForm] = useState({
    supplier_id: "",
    posted_number: "",
    posted_date: "",
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

  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);

  useEffect(() => {
    fetchSuppliers();
    fetchProducts();
    if (invoiceId) {
        fetchInvoice();
    } else {
        fetchNewCode();
    }
  }, [invoiceId]);

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
  let newForm = { ...form, [name]: value };

  // Recalculate footer only if footer fields are being edited
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

function handleItemChange(index, field, value) {
  const newItems = [...form.items];
  newItems[index] = recalcItem(
    { ...newItems[index], [field]: value },
    field
  );

  let newForm = { ...form, items: newItems };
  newForm = recalcFooter(newForm, "items"); // recalc totals when items change

  setForm(newForm);
}


  const addItem = () => {
    setForm({
      ...form,
      items: [...form.items, { product_id: "", batch: "", expiry: "" }],
    });
  };

  const removeItem = (index) => {
    const newItems = form.items.filter((_, i) => i !== index);
    setForm({ ...form, items: newItems });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
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
    <form onSubmit={handleSubmit} className="flex flex-col" style={{minHeight: "74vh", maxHeight: "80vh" }}>
      {/* ================= HEADER SECTION ================= */}
<div className="sticky top-0 bg-white shadow p-2 z-10">
  <h2 className="text-sm font-bold mb-2">Purchase Invoice</h2>
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
            onChange={handleChange}
            className=" bg-gray-100 border rounded w-full p-1 h-7 text-xs"
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
        <td className="border p-1 w-1/3" >
          <label className="block text-[10px]">Supplier</label>
          <Select
            options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
            value={
              suppliers
                .map((s) => ({ value: s.id, label: s.name }))
                .find((s) => s.value === form.supplier_id) || null
            }
            onChange={(val) => handleSelectChange("supplier_id", val)}
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
            type="text"
            name="invoice_number"
            value={form.invoice_number}
            onChange={handleChange}
            className="border rounded w-full p-1 h-7 text-xs"
          />
        </td>
        <td className="border p-1 w-1/8">
          <label className="block text-[10px]">Invoice Amount</label>
          <input
            type="number"
            name="invoice_amount"
            value={form.invoice_amount}
            onChange={handleChange}
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
  <h2 className="text-xs font-bold mb-1">Items</h2>

  <table className="w-full border-collapse text-[11px]">
    <thead className="sticky top-0 bg-gray-100 z-10">
      <tr>
        <th rowSpan={2} className="border w-6">#</th>
        <th rowSpan={2} colSpan={3} className="border w-[300px]">Product</th>
        <th colSpan={3} className="border">Pack Size / Batch / Expiry</th>
        <th colSpan={2} className="border">Qty (Pack / Unit)</th>
        <th colSpan={2} className="border">Purchase Price (P / U)</th>
        <th colSpan={3} className="border">Disc % / Bonus (P / U)</th>
        <th colSpan={2} className="border">Sale Price (P / U)</th>
        <th colSpan={3} className="border">Margin % / Avg / Qty</th>
        <th rowSpan={2} className="border w-6">+</th>
      </tr>

      <tr>
        <th className="border w-14">PSize</th>
        <th className="border w-16">Batch</th>
        <th className="border w-20">Exp</th>

        <th className="border w-12">Pack</th>
        <th className="border w-12">Unit</th>

        <th className="border w-14">Pack</th>
        <th className="border w-14">Unit</th>

        <th className="border w-14">Disc%</th>
        <th className="border w-14">PBonus</th>
        <th className="border w-14">UBonus</th>

        <th className="border w-14">Pack</th>
        <th className="border w-14">Unit</th>

        <th className="border w-14">Margin%</th>
        <th className="border w-16">Avg</th>
        <th className="border w-12">Qty</th>
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

          {/* Product Search Input - colspan 3 */}
        <td colSpan={3} className="border text-left">
        <ProductSearchInput
            value={item.product_id}
            onChange={(val) => {
            const selectedProduct = products.find((p) => p.id === val);
            const newItems = [...form.items];
            // Merge product defaults into row
            newItems[i] = recalcItem(
                {
                ...newItems[i],
                product_id: selectedProduct?.id || "",
                pack_size: selectedProduct?.pack_size || "",
                },
                selectedProduct
            );
            setForm({ ...form, items: newItems });
            }}
            products={products}
        />
        </td>


          {/* Pack Size */}
          <td className="border w-14">
            <input
              type="number"
              readOnly
              value={item.pack_size ?? ""}
              onChange={(e) => handleItemChange(i, "pack_size", e.target.value)}
              className="border bg-gray-100 w-full h-6 text-[11px] px-1 appearance-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </td>

          {/* Batch */}
          <td className="border w-16">
            <input
              type="text"
              value={item.batch ?? ""}
              onChange={(e) => handleItemChange(i, "batch", e.target.value)}
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
              type="number"
              value={item.pack_quantity ?? ""}
              onChange={(e) => handleItemChange(i, "pack_quantity", e.target.value)}
              className="border w-full h-6 text-[11px] px-1 appearance-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </td>

          {/* Unit Qty */}
          <td className="border">
            <input
              type="number"
              value={item.unit_quantity ?? ""}
              onChange={(e) => handleItemChange(i, "unit_quantity", e.target.value)}
              className="border w-full h-6 text-[11px] px-1 appearance-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </td>

          {/* Pack Purchase */}
          <td className="border">
            <input
              type="number"
              value={item.pack_purchase_price ?? ""}
              onChange={(e) => handleItemChange(i, "pack_purchase_price", e.target.value)}
              className="border w-full h-6 text-[11px] px-1 appearance-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </td>

          {/* Unit Purchase */}
          <td className="border">
            <input
              type="number"
              value={item.unit_purchase_price ?? ""}
              onChange={(e) => handleItemChange(i, "unit_purchase_price", e.target.value)}
              className="border w-full h-6 text-[11px] px-1 appearance-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </td>

          {/* Disc% */}
          <td className="border">
            <input
              type="number"
              value={item.item_discount_percentage ?? ""}
              onChange={(e) => handleItemChange(i, "item_discount_percentage", e.target.value)}
              className="border w-full h-6 text-[11px] px-1 appearance-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </td>

          {/* Pack Bonus */}
          <td className="border">
            <input
              type="number"
              value={item.pack_bonus ?? ""}
              onChange={(e) => handleItemChange(i, "pack_bonus", e.target.value)}
              className="border w-full h-6 text-[11px] px-1 appearance-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </td>

          {/* Unit Bonus */}
          <td className="border">
            <input
              type="number"
              value={item.unit_bonus ?? ""}
              onChange={(e) => handleItemChange(i, "unit_bonus", e.target.value)}
              className="border w-full h-6 text-[11px] px-1 appearance-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </td>

          {/* Pack Sale */}
          <td className="border">
            <input
              type="number"
              value={item.pack_sale_price ?? ""}
              onChange={(e) => handleItemChange(i, "pack_sale_price", e.target.value)}
              className="border w-full h-6 text-[11px] px-1 appearance-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </td>

          {/* Unit Sale */}
          <td className="border">
            <input
              type="number"
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
              onChange={(e) => handleItemChange(i, "margin", e.target.value)}
              className="border bg-gray-100 w-full h-6 text-[11px] px-1 appearance-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </td>

          {/* Avg Price (readonly) */}
          <td className="border">
            <input
              type="text"
              value={item.avg_price ?? ""}
              readOnly
              className="border  w-full h-6 text-[11px] px-1 bg-gray-100"
            />
          </td>

          {/* Quantity */}
          <td className="border">
            <input
              type="number"
              readOnly
              value={item.quantity ?? ""}
              onChange={(e) => handleItemChange(i, "quantity", e.target.value)}
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
            type="number"
            name="tax_percentage"
            value={form.tax_percentage}
            onChange={handleChange}
            className="border rounded w-full p-1 h-7 text-xs"
          />
        </td>
        <td className="border p-1 w-1/6">
          <label className="block text-[10px]">Tax Amount</label>
          <input
            type="number"
            name="tax_amount"
            value={form.tax_amount}
            onChange={handleChange}
            className="border rounded w-full p-1 h-7 text-xs"
          />
        </td>
        <td className="border p-1 w-1/6">
          <label className="block text-[10px]">Discount %</label>
          <input
            type="number"
            name="discount_percentage"
            value={form.discount_percentage}
            onChange={handleChange}
            className="border rounded w-full p-1 h-7 text-xs"
          />
        </td>
        <td className="border p-1 w-1/6">
          <label className="block text-[10px]">Discount Amount</label>
          <input
            type="number"
            name="discount_amount"
            value={form.discount_amount}
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
            onChange={handleChange}
            className="border rounded w-full p-1 h-7 text-xs bg-gray-100"
          />
        </td>
        <td className="border p-1 text-center align-middle">
          <button
            type="submit"
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
