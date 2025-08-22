// resources/js/Formula/PurchaseInvoice.js

export function recalcItem(item) {
  const packSize = Number(item.pack_size) || 0;
  const packQty = Number(item.pack_quantity) || 0;
  const unitQty = Number(item.unit_quantity) || 0;
  const packPrice = Number(item.pack_purchase_price) || 0;
  const unitPrice = Number(item.unit_purchase_price) || 0;
  const discountPct = Number(item.item_discount_percentage) || 0;

  // 🔹 Auto-calc unit price if pack size + pack price exist
  let computedUnitPrice = unitPrice;
  if (packSize > 0 && packPrice > 0) {
    computedUnitPrice = packPrice / packSize;
  }

  // 🔹 Total units
  const totalUnits = packQty * packSize + unitQty;

  // 🔹 Subtotal before discount
  const subTotal = totalUnits * computedUnitPrice;

  // 🔹 Discount
  const discountAmount = (subTotal * discountPct) / 100;

  // 🔹 Final subtotal
  const netTotal = subTotal - discountAmount;

  // 🔹 Avg Price (net / units)
  const avgPrice = totalUnits > 0 ? (netTotal / totalUnits) : 0;

  // 🔹 Margin (if sale price is available)
  let margin = "";
  if (item.unit_sale_price && computedUnitPrice > 0) {
    margin = (((Number(item.unit_sale_price) - computedUnitPrice) / computedUnitPrice) * 100).toFixed(2);
  }

  return {
    ...item,
    unit_purchase_price: computedUnitPrice.toFixed(2),
    quantity: totalUnits,
    sub_total: netTotal.toFixed(2),
    avg_price: avgPrice.toFixed(2),
    margin,
  };
}
