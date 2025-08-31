<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SaleInvoiceItem extends Model
{
    protected $fillable = [
        'sale_invoice_id',
        'product_id',
        'pack_size',
        'batch_number',
        'expiry',
        'current_quantity',
        'quantity',
        'price',
        'item_discount_percentage',
        'sub_total',
    ];
    public function saleInvoice()
    {
        return $this->belongsTo(SaleInvoice::class);
    }
    public function product()
    {
        return $this->belongsTo(Product::class);
    }
}
