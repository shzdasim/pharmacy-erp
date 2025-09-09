<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CustomerLedger extends Model
{
    protected $fillable = [
        'customer_id',
        'sale_invoice_id',
        'entry_date',
        'posted_number',
        'invoice_number',

        'invoice_total',
        'total_received',
        'balance_remaining',

        'entry_type',
        'description',
        'is_manual',

        'credited_amount',
        'payment_ref',

        'created_by',
    ];

    protected $casts = [
        'entry_date' => 'date',
        'is_manual'  => 'boolean',
    ];

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function saleInvoice(): BelongsTo
    {
        return $this->belongsTo(SaleInvoice::class);
    }
}
