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
}
