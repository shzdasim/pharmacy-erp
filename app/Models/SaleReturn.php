<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SaleReturn extends Model
{
    protected $fillable = [
        'sale_invoice_id', 'user_id', 'customer_id', 'posted_number', 'date',
        'discount_percentage', 'discount_amount', 'tax_percentage', 'tax_amount',
        'total', 'gross_total'
    ];

    public function user(){
        return $this->belongsTo(User::class);
    }
    public function customer(){
        return $this->belongsTo(Customer::class);
    }
    public function saleInvoice(){
        return $this->belongsTo(SaleInvoice::class);
    }
    public function items(){
        return $this->hasMany(SaleReturnItem::class);
    }

    
    
}
