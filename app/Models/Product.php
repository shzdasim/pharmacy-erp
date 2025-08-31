<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class Product extends Model
{
    use HasFactory;

    protected $fillable = [
        'product_code',
        'name',
        'image',
        'formulation',
        'description',
        'pack_size',
        'quantity',
        'pack_purchase_price',
        'pack_sale_price',
        'unit_purchase_price',
        'unit_sale_price',
        'avg_price',
        'margin',
        'narcotic',
        'max_discount',
        'category_id',
        'brand_id',
        'supplier_id',
        'rack',
        'barcode',
    ];

    public function brand()
    {
        return $this->belongsTo(Brand::class);
    }

    public function category()
    {
        return $this->belongsTo(Category::class);
    }

    public function supplier()
    {
        return $this->belongsTo(Supplier::class);
    }

    public function batches()
    {
        return $this->hasMany(Batch::class);
    }

    /**
     * Apply a purchase item using incremental weighted-average logic.
     * IMPORTANT: use line-level avg_price (effective cost) so bonuses/discounts are included.
     *
     * $item keys expected:
     * - quantity (units), avg_price
     * - unit_purchase_price/pack_purchase_price/pack_sale_price/unit_sale_price (optional passthroughs)
     */
    public function applyPurchaseFromItem(array $item): void
    {
        $oldQty   = (int) ($this->quantity ?? 0);
        $oldAvg   = (float) ($this->avg_price ?? 0.0);
        $newQty   = (int) ($item['quantity'] ?? 0);
        $effCost  = (float) ($item['avg_price'] ?? $item['unit_purchase_price'] ?? 0.0); // <-- use effective cost

        $totalQty = $oldQty + $newQty;

        $weightedAvg = $totalQty > 0
            ? (($oldQty * $oldAvg) + ($newQty * $effCost)) / $totalQty
            : $effCost;

        // Update live fields (latest prices kept if provided)
        $this->quantity = $totalQty;

        if (array_key_exists('pack_purchase_price', $item)) {
            $this->pack_purchase_price = $item['pack_purchase_price'];
        }
        if (array_key_exists('unit_purchase_price', $item)) {
            $this->unit_purchase_price = $item['unit_purchase_price'];
        }
        if (array_key_exists('pack_sale_price', $item)) {
            $this->pack_sale_price = $item['pack_sale_price'];
        }
        if (array_key_exists('unit_sale_price', $item)) {
            $this->unit_sale_price = $item['unit_sale_price'];
        }

        $this->avg_price = round($weightedAvg, 2);

        // Margin on sale price
        $this->margin = ($this->unit_sale_price > 0)
            ? round((($this->unit_sale_price - $this->avg_price) / $this->unit_sale_price) * 100, 2)
            : 0.0;

        $this->save();
    }

    /**
     * Revert a purchase item using the exact inverse weighted-average math.
     * Also uses line-level avg_price (effective cost).
     *
     * $item may be array or PurchaseInvoiceItem model:
     * - quantity (units), avg_price
     */
    public function revertPurchaseFromItem($item): void
    {
        $qty     = (int) (is_array($item) ? ($item['quantity'] ?? 0) : $item->quantity);
        $effCost = (float) (is_array($item)
                    ? ($item['avg_price'] ?? $item['unit_purchase_price'] ?? 0.0)
                    : ($item->avg_price ?? $item->unit_purchase_price ?? 0.0));

        $oldQty = (int) ($this->quantity ?? 0);
        $oldAvg = (float) ($this->avg_price ?? 0.0);

        if ($qty <= 0 || $oldQty <= 0) {
            return;
        }

        $newQty = max(0, $oldQty - $qty);

        // Inverse weighted-average:
        // oldAvg*oldQty = newAvg*newQty + effCost*qty  => newAvg = (oldAvg*oldQty - effCost*qty) / newQty
        $oldTotalCost = $oldAvg * $oldQty;
        $newTotalCost = $oldTotalCost - ($effCost * $qty);
        if ($newTotalCost < 0) {
            $newTotalCost = 0.0; // rounding guard
        }

        $newAvg = $newQty > 0 ? ($newTotalCost / $newQty) : 0.0;

        $this->quantity  = $newQty;
        $this->avg_price = round($newAvg, 2);

        // Keep current sale price; refresh margin
        $this->margin = ($this->unit_sale_price > 0)
            ? round((($this->unit_sale_price - $this->avg_price) / $this->unit_sale_price) * 100, 2)
            : 0.0;

        $this->save();
    }
}
