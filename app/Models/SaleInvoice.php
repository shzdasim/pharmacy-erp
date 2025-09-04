<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SaleInvoice extends Model
{
    protected $fillable = [
        'user_id',
        'customer_id',
        'posted_number',
        'date',
        'remarks',
        'doctor_name',
        'patient_name',
        'discount_percentage',
        'discount_amount',
        'tax_percentage',
        'tax_amount',
        'item_discount',
        'gross_amount',
        'total',
    ];

    public function customer()
    {
        return $this->belongsTo(Customer::class);
    }
    public function user()
    {
        return $this->belongsTo(User::class);
    }
    public function items()
    {
        return $this->hasMany(SaleInvoiceItem::class);
    }
    
}
