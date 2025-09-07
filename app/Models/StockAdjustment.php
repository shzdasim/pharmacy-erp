<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class StockAdjustment extends Model
{
     use HasFactory;

    protected $fillable = [
        'posted_number',
        'posted_date',
        'note',
        'total_worth',
        'user_id',
    ];

    protected $casts = [
        'posted_date' => 'date',
    ];

    public function items()
    {
        return $this->hasMany(StockAdjustmentItem::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
