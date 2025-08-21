<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PurchaseInvoice extends Model
{
    protected $fillable = [
        'supplier_id',
        'posted_number',
        'posted_date',
        'remarks',
        'invoice_number',
        'invoice_amount',
        'tax_percentage',
        'tax_amount',
        'discount_percentage',
        'discount_amount',
        'total_amount',
    ];
    public function supplier()
    {
        return $this->belongsTo(Supplier::class);
    }

    public function items()
    {
        return $this->hasMany(PurchaseInvoiceItem::class);
    }
}
