<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class SupplierLedger extends Model
{
    use HasFactory;

    protected $fillable = [
        'supplier_id',
        'purchase_invoice_id',
        'entry_type',          // 'invoice' | 'payment' | 'manual'
        'entry_date',
        'posted_number',
        'invoice_number',
        'invoice_total',
        'total_paid',
        'debited_amount',      // payments
        'payment_ref',
        'credit_remaining',
        'description',
        'is_manual',
        'created_by',
    ];

    protected $casts = [
        'entry_date'        => 'date',
        'invoice_total'     => 'decimal:2',
        'total_paid'        => 'decimal:2',
        'debited_amount'    => 'decimal:2',
        'credit_remaining'  => 'decimal:2',
        'is_manual'         => 'boolean',
    ];

    public function supplier()
    {
        return $this->belongsTo(Supplier::class);
    }

    public function purchaseInvoice()
    {
        return $this->belongsTo(PurchaseInvoice::class);
    }
}
