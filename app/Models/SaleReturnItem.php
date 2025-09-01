<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SaleReturnItem extends Model
{
    protected $fillable = [
        'sale_return_id', 'product_id', 'batch_number', 'expiry', 'unit_sale_quantity', 
        'unit_return_quantity', 'unit_sale_price', 'item_discount_percentage', 'sub_total'
    ];
    public function saleReturn(){
        return $this->belongsTo(SaleReturn::class);
    }
    public function product(){
        return $this->belongsTo(Product::class);
    }
}
