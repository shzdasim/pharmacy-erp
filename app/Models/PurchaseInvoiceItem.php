<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PurchaseInvoiceItem extends Model
{
    protected $fillable = [
        'purchase_invoice_id',
        'product_id',
        'batch',
        'expiry',
        'pack_quantity',
        'pack_size',
        'unit_quantity',
        'pack_purchase_price',
        'unit_purchase_price',
        'pack_sale_price',
        'unit_sale_price',
        'pack_bonus',
        'unit_bonus',
        'item_discount_percentage',
        'margin',
        'sub_total',
        'avg_price',
        'quantity',
    ];
     public function purchaseInvoice()
    {
        return $this->belongsTo(PurchaseInvoice::class);
    }

    public function product()
    {
        return $this->belongsTo(Product::class);
    }
}
