<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Batch extends Model
{
    protected $fillable = [
        'product_id',
        'batch_number',
        'expiry_date',
        'quantity',
    ];

    // Map DB column names to frontend-friendly names
    public function getExpiryDateAttribute($value)
    {
        return $value;
    }

    public function getQuantityAttribute($value)
    {
        return $value;
    }

    // Accessors for frontend compatibility
    public function getExpiryAttribute()
    {
        return $this->expiry_date;
    }

    public function getAvailableUnitsAttribute()
    {
        return $this->quantity;
    }

    public function setExpiryAttribute($value)
    {
        $this->expiry_date = $value;
    }

    public function setAvailableUnitsAttribute($value)
    {
        $this->quantity = $value;
    }

    public function product()
    {
        return $this->belongsTo(Product::class);
    }
}
