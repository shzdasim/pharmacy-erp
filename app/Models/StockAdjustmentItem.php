<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class StockAdjustmentItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'stock_adjustment_id',
        'product_id',
        'batch_number',
        'expiry',
        'pack_size',
        'previous_qty',
        'actual_qty',
        'diff_qty',
        'unit_purchase_price',
        'worth_adjusted',
    ];

    protected $casts = [
        'expiry' => 'date',
    ];

    public function adjustment()
    {
        return $this->belongsTo(StockAdjustment::class, 'stock_adjustment_id');
    }

    public function product()
    {
        return $this->belongsTo(Product::class);
    }
}
