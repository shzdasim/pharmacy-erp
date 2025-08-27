import Select from "react-select";
import ProductSearchInput from "../../components/ProductSearchInput.jsx";
import BatchSearchInput from "../../components/BatchSearchInput.jsx";
import SupplierSearchInput from "../../components/SupplierSearchInput.jsx";

export default function PurchaseReturnFormUI({
  // Props
  returnId,

  // State
  form,
  suppliers,
  products,
  purchaseInvoices,
  batches,
  currentField,
  currentRowIndex,
  dupBlock, // NEW

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

  // New
  onCancel,
}) {
  // helper: whether a cell should remain interactive while locked
  const isUnlockedCell = (rowIdx, kind) => {
    if (!dupBlock) return true;
    if (dupBlock.rowIndex !== rowIdx) return false;
    // Allow Product always; allow Batch as well (so user can fix by changing batch)
    return kind === "product" || kind === "batch";
  };

  return (
    <div className="relative">
      {/* Sticky warning bar outside the disabled container so it's always visible/clickable */}
      {dupBlock && (
        <div className="sticky top-0 z-40 bg-red-50 border-b border-red-200 text-red-700 text-xs px-3 py-2">
          <span className="font-semibold">Duplicate selected:</span>{" "}
          <span>{dupBlock.productName}{dupBlock.batch ? ` (Batch ${dupBlock.batch})` : ""}.</span>{" "}
          Fix row <span className="font-semibold">{dupBlock.rowIndex + 1}</span> by changing the product
          {form.purchase_invoice_id ? " or selecting a different batch" : ""}. All other inputs are disabled until resolved.
        </div>
      )}

      {/* Whole form gets pointer-events disabled when locked */}
      <div className={dupBlock ? "pointer-events-none select-none" : ""}>
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
                    <div className={dupBlock ? "pointer-events-none" : ""}>
                      <SupplierSearchInput
                        ref={supplierSelectRef}
                        value={form.supplier_id}
                        onChange={(id) => {
                          handleSelectChange("supplier_id", { value: id });
                          setTimeout(() => purchaseInvoiceRef.current?.focus(), 50);
                        }}
                        suppliers={suppliers}
                      />
                    </div>
                  </td>

                  <td className="border p-1 w-1/3">
                    <label className="block text-[10px]">Purchase Invoice *</label>
                    <div className={dupBlock ? "pointer-events-none" : ""}>
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
                        onChange={(val) => {
                          handleSelectChange("purchase_invoice_id", val);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && form.purchase_invoice_id) {
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
                        disabled={!!dupBlock}
                      >
                        X
                      </button>
                    </td>

                    {/* Product Search Input */}
                    <td colSpan={1} className="border text-left w-[200px]">
                      <div
                        ref={(el) => (productSearchRefs.current[i] = el)}
                        className={dupBlock ? (isUnlockedCell(i, "product") ? "pointer-events-auto" : "pointer-events-none") : ""}
                      >
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
                      <div className={dupBlock ? (isUnlockedCell(i, "batch") ? "pointer-events-auto" : "pointer-events-none") : ""}>
                        <BatchSearchInput
                          ref={(el) => {
                            if (el && currentField === "batch" && currentRowIndex === i) {
                              setTimeout(() => el.focus(), 50);
                            }
                          }}
                          value={item.batch}
                          batches={batches}
                          usedBatches={form.items.filter((_, rowIdx) => rowIdx !== i).map((r) => r.batch)}
                          onChange={(batchNumber) => handleBatchSelect(i, { value: batchNumber })}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && item.batch) {
                              e.preventDefault();
                            }
                          }}
                        />
                      </div>
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
                        onKeyDown={(e) => handleKeyDown(e, 'pack_quantity', i)}
                        className="border w-full h-6 text-[11px] px-1 appearance-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        disabled={!!dupBlock}
                      />
                    </td>

                    {/* Return Unit Qty */}
                    <td className="border">
                      <input
                        type="text"
                        value={item.return_unit_quantity === 0 ? "" : item.return_unit_quantity}
                        onChange={(e) => handleItemChange(i, "return_unit_quantity", e.target.value)}
                        className="border w-full h-6 text-[11px] px-1 appearance-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        disabled={!!dupBlock}
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
                        disabled={!!dupBlock}
                      />
                    </td>

                    {/* Unit Purchase Price */}
                    <td className="border">
                      <input
                        type="text"
                        value={item.unit_purchase_price === 0 ? "" : item.unit_purchase_price}
                        onChange={(e) => handleItemChange(i, "unit_purchase_price", e.target.value)}
                        className="border w-full h-6 text-[11px] px-1 appearance-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        disabled={!!dupBlock}
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
                        disabled={!!dupBlock}
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
                        disabled={!!dupBlock}
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
                    <input name="discount_percentage" type="number" value={form.discount_percentage} onChange={handleChange} className="border rounded w-full p-1 h-7 text-xs" disabled={!!dupBlock} />
                  </td>

                  <td className="border p-1 w-1/6">
                    <label className="block text-[10px]">Discount Amount</label>
                    <input type="number" readOnly value={(Number(form.discount_amount) || 0).toFixed(2)} className="border rounded w-full p-1 h-7 text-xs bg-gray-100" />
                  </td>

                  <td className="border p-1 w-1/6">
                    <label className="block text-[10px]">Tax %</label>
                    <input name="tax_percentage" type="number" value={form.tax_percentage} onChange={handleChange} className="border rounded w-full p-1 h-7 text-xs" disabled={!!dupBlock} />
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

                {/* Right-aligned actions */}
                <tr>
                  <td colSpan={6} className="p-2">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={onCancel}
                        className={`px-6 py-3 rounded text-sm transition ${dupBlock ? "bg-gray-200 text-gray-400 cursor-not-allowed" : "bg-gray-200 text-gray-800 hover:bg-gray-300"}`}
                        disabled={!!dupBlock}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleSubmit}
                        className={`px-8 py-3 rounded text-sm transition ${dupBlock ? "bg-green-300 text-white cursor-not-allowed" : "bg-green-600 text-white hover:bg-green-700"}`}
                        disabled={!!dupBlock}
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
    </div>
  );
}
