<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PurchaseReturnItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'purchase_return_id',
        'product_id',
        'batch',
        'expiry',
        'pack_size',
        'return_pack_quantity',
        'return_unit_quantity',
        'pack_purchase_price',
        'unit_purchase_price',
        'item_discount_percentage',
        'sub_total',
    ];

    public function purchaseReturn()
    {
        return $this->belongsTo(PurchaseReturn::class);
    }

    public function product()
    {
        return $this->belongsTo(Product::class);
    }
}
