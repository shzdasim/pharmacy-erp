// resources/js/Formula/PurchaseInvoice.js

export function recalcItem(item, changedField = null) {
  const packSize = Number(item.pack_size) || 0;

  let packQty = Number(item.pack_quantity) || 0;
  let unitQty = Number(item.unit_quantity) || 0;

  let packPurchase = Number(item.pack_purchase_price) || 0;
  let unitPurchase = Number(item.unit_purchase_price) || 0;

  let packSale = Number(item.pack_sale_price) || 0;
  let unitSale = Number(item.unit_sale_price) || 0;

  let packBonus = Number(item.pack_bonus) || 0;
  let unitBonus = Number(item.unit_bonus) || 0;

  const discountPct = Number(item.item_discount_percentage) || 0;

  // ================================
  // QUANTITY (Pack <-> Unit)
  // ================================
  if (changedField === "pack_quantity" && packSize > 0) {
    unitQty = packQty * packSize;
  } else if (changedField === "unit_quantity" && packSize > 0) {
    packQty = unitQty / packSize;
  }

  // ================================
  // PURCHASE PRICE (Pack <-> Unit)
  // ================================
  if (changedField === "pack_purchase_price" && packSize > 0) {
    unitPurchase = packPurchase / packSize;
  } else if (changedField === "unit_purchase_price" && packSize > 0) {
    packPurchase = unitPurchase * packSize;
  }

  // ================================
  // SALE PRICE (Pack <-> Unit)
  // ================================
  if (changedField === "pack_sale_price" && packSize > 0) {
    unitSale = packSale / packSize;
  } else if (changedField === "unit_sale_price" && packSize > 0) {
    packSale = unitSale * packSize;
  }

  // ================================
  // BONUS (Pack <-> Unit)
  // ================================
  if (changedField === "pack_bonus" && packSize > 0) {
    unitBonus = packBonus * packSize;
  } else if (changedField === "unit_bonus" && packSize > 0) {
    packBonus = unitBonus / packSize;
  }

  // ================================
  // TOTAL UNITS (Qty + Bonus)
  // ================================
  const totalUnits = packQty * packSize + unitQty + unitBonus;

  // ================================
  // SUBTOTAL BEFORE DISCOUNT
  // ================================
  const subTotal = totalUnits * unitPurchase;

  // ================================
  // DISCOUNT
  // ================================
  const discountAmount = (subTotal * discountPct) / 100;

  // ================================
  // FINAL SUBTOTAL
  // ================================
  const netTotal = subTotal - discountAmount;

  // ================================
  // AVG PRICE
  // ================================
  const avgPrice = totalUnits > 0 ? netTotal / totalUnits : 0;

  // ================================
  // MARGIN
  // ================================
  let margin = "";
  if (unitSale && unitPurchase > 0) {
    margin = (((unitSale - unitPurchase) / unitPurchase) * 100).toFixed(2);
  }

  return {
    ...item,
    pack_quantity: packQty,
    unit_quantity: unitQty,
    pack_purchase_price: packPurchase,
    unit_purchase_price: unitPurchase,
    pack_sale_price: packSale,
    unit_sale_price: unitSale,
    pack_bonus: packBonus,
    unit_bonus: unitBonus,
    quantity: totalUnits,
    sub_total: netTotal,
    avg_price: avgPrice,
    margin,
  };
}
