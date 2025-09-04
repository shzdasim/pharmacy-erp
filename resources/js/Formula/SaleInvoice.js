// resources/js/Formula/SaleInvoice.js

// Safe numeric coercion
const n = (v) => (v === "" || v === null || v === undefined ? 0 : Number(v) || 0);

// Round to 2 decimals
const r2 = (v) => (Number.isFinite(v) ? Number(v.toFixed(2)) : 0);

// Recalculate a single sale item
export function recalcItem(item, changedField = null) {
  const packSize = n(item.pack_size);
  const qty = n(item.quantity);        // units
  const price = n(item.price);         // unit price
  const discPct = n(item.item_discount_percentage);

  // derived
  const gross = qty * price;
  const itemDisc = (gross * discPct) / 100;
  const subTotal = gross - itemDisc;

  return {
    ...item,
    pack_size: packSize,
    quantity: qty,
    price,
    item_discount_percentage: discPct,
    sub_total: r2(subTotal),
  };
}

// Recalculate footer for the whole form
export function recalcFooter(form, changedField = null) {
  const items = form.items || [];
  const grossSum = items.reduce((sum, it) => sum + n(it.quantity) * n(it.price), 0);
  const itemDiscSum = items.reduce((sum, it) => {
    const discPct = n(it.item_discount_percentage);
    const gross = n(it.quantity) * n(it.price);
    return sum + (gross * discPct) / 100;
  }, 0);

  let discountPct = n(form.discount_percentage);
  let discountAmt = n(form.discount_amount);

  // If % changed, recompute amount; if amount changed, recompute %
  if (changedField === "discount_percentage") {
    discountAmt = (grossSum * discountPct) / 100;
  } else if (changedField === "discount_amount") {
    discountPct = grossSum > 0 ? (discountAmt / grossSum) * 100 : 0;
  }

  const taxableBase = grossSum - itemDiscSum - discountAmt;
  let taxPct = n(form.tax_percentage);
  let taxAmt = n(form.tax_amount);

  if (changedField === "tax_percentage") {
    taxAmt = (taxableBase * taxPct) / 100;
  } else if (changedField === "tax_amount") {
    taxPct = taxableBase > 0 ? (taxAmt / taxableBase) * 100 : 0;
  }

  const total = taxableBase + taxAmt;

  return {
    ...form,
    discount_percentage: discountPct === 0 ? "" : String(r2(discountPct)),
    discount_amount: discountAmt === 0 ? "" : String(r2(discountAmt)),
    tax_percentage: taxPct === 0 ? "" : String(r2(taxPct)),
    tax_amount: taxAmt === 0 ? "" : String(r2(taxAmt)),
    item_discount: r2(itemDiscSum),
    gross_amount: r2(grossSum),
    total: r2(total),
  };
}
