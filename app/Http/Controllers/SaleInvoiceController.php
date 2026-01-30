<?php

namespace App\Http\Controllers;

use App\Models\Batch;
use App\Models\CustomerLedger;
use App\Models\Product;
use App\Models\SaleInvoice;
use App\Models\SaleInvoiceItem;
use App\Models\Setting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class SaleInvoiceController extends Controller
{
    private function i($v): int   { return (int)($v ?? 0); }
    private function f($v): float { return (float)($v ?? 0.0); }

    private function unitsFromArray(array $item): int
    {
        return $this->i($item['quantity'] ?? 0);
    }
    private function unitsFromModel(SaleInvoiceItem $item): int
    {
        return $this->i($item->quantity ?? 0);
    }

    private function applyStockDeltaSmart(int $productId, ?string $batchNo, ?string $expiry, int $deltaUnits): void
    {
        $batchNo = trim((string)($batchNo ?? ''));
        $expiry  = trim((string)($expiry ?? ''));

        $actualApplied = $deltaUnits;

        $batch = null;
        if ($batchNo !== '') {
            $batch = Batch::where('product_id', $productId)
                ->where(function ($q) use ($batchNo) {
                    $q->where('batch_number', $batchNo)->orWhere('batch', $batchNo);
                })
                ->when($expiry !== '', function ($q) use ($expiry) {
                    $q->where(function ($q2) use ($expiry) {
                        $q2->where('expiry', $expiry)->orWhere('expiry_date', $expiry);
                    });
                })
                ->first();
        }

        if ($batch) {
            $before = $this->i($batch->quantity);
            $after  = $before + $deltaUnits;
            if ($after < 0) $after = 0;
            $actualApplied = $after - $before;
            $batch->quantity = $after;
            $batch->save();
        }

        if ($product = Product::find($productId)) {
            $pBefore = $this->i($product->quantity);
            $pAfter  = $pBefore + $actualApplied;
            if ($pAfter < 0) $pAfter = 0;
            $product->quantity = $pAfter;
            $product->save();
        }
    }

    private function createItemsAndReduce(SaleInvoice $invoice, array $items): void
    {
        foreach ($items as $raw) {
            $payload = [
                'product_id'               => $raw['product_id'],
                'pack_size'                => $this->i($raw['pack_size'] ?? 0),
                'batch_number'             => $raw['batch_number'] ?? ($raw['batch'] ?? null),
                'expiry'                   => $raw['expiry'] ?? ($raw['expiry_date'] ?? null),
                'current_quantity'         => $this->i($raw['current_quantity'] ?? 0),
                'quantity'                 => $this->i($raw['quantity'] ?? 0),
                'price'                    => $this->f($raw['price'] ?? 0),
                'item_discount_percentage' => $this->f($raw['item_discount_percentage'] ?? 0),
                'sub_total'                => $this->f($raw['sub_total'] ?? 0),
            ];

            $item = $invoice->items()->create($payload);

            $units = $this->unitsFromArray($payload);
            $this->applyStockDeltaSmart(
                $item->product_id,
                $item->batch_number,
                $item->expiry,
                -$units
            );
        }
    }

    private function revertItems(SaleInvoice $invoice): void
    {
        $invoice->load('items');
        foreach ($invoice->items as $item) {
            $units = $this->unitsFromModel($item);
            $this->applyStockDeltaSmart(
                $item->product_id,
                $item->batch_number ?? null,
                $item->expiry ?? null,
                +$units
            );
        }
    }

    public function generateNewCode()
    {
        // kept for compatibility but frontend no longer uses this on load
        $this->authorize('create', SaleInvoice::class);
        $last = SaleInvoice::orderBy('id', 'desc')->first();
        $next = $last ? ($last->id + 1) : 1;
        $code = 'SI-' . str_pad((string)$next, 6, '0', STR_PAD_LEFT);
        return response()->json(['posted_number' => $code]);
    }

    public function index(Request $request)
    {
        $this->authorize('viewAny', SaleInvoice::class);
        $qPosted   = trim((string) $request->query('posted'));
        $qCustomer = trim((string) $request->query('customer'));

        $query = SaleInvoice::with(['customer'])->orderByDesc('id');

        if ($qPosted !== '') {
            $query->where('posted_number', 'like', '%'.$qPosted.'%');
        }
        if ($qCustomer !== '') {
            $query->whereHas('customer', function ($q) use ($qCustomer) {
                $q->where('name', 'like', '%'.$qCustomer.'%');
            });
        }

        return $query->get();
    }

    public function show($id)
    {
        $invoice = SaleInvoice::with(['customer', 'items.product'])->findOrFail($id);
        $this->authorize('view', $invoice);
        return response()->json($invoice);
    }

    public function store(Request $request)
    {
        $this->authorize('create', SaleInvoice::class);
        if (!$request->user()) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        // ⬇️ posted_number is NOT provided by client anymore (server assigns)
        $data = $request->validate([
            'customer_id'         => 'required|exists:customers,id',
            'invoice_type'        => 'nullable|string|in:credit,debit,default:debit',
            'date'                => 'required|date',
            'remarks'             => 'nullable|string',
            'doctor_name'         => 'nullable|string',
            'patient_name'        => 'nullable|string',
            'discount_percentage' => 'nullable|numeric',
            'discount_amount'     => 'nullable|numeric',
            'tax_percentage'      => 'nullable|numeric',
            'tax_amount'          => 'nullable|numeric',
            'item_discount'       => 'nullable|numeric',
            'gross_amount'        => 'required|numeric',
            'total'               => 'required|numeric',
            'total_receive'       => 'nullable|numeric',

            'items'                            => 'required|array|min:1',
            'items.*.product_id'               => 'required|exists:products,id',
            'items.*.pack_size'                => 'nullable|integer|min:0',
            'items.*.batch_number'             => 'nullable|string',
            'items.*.batch'                    => 'nullable|string',
            'items.*.expiry'                   => 'nullable|string',
            'items.*.expiry_date'              => 'nullable|string',
            'items.*.current_quantity'         => 'nullable|integer',
            'items.*.quantity'                 => 'required|integer|min:1',
            'items.*.price'                    => 'required|numeric|min:0',
            'items.*.item_discount_percentage' => 'nullable|numeric',
            'items.*.sub_total'                => 'required|numeric|min:0',
        ]);

        return DB::transaction(function () use ($data, $request) {
            // 🔐 Concurrency-safe numbering: lock last row, compute next
            $last = SaleInvoice::lockForUpdate()->orderByDesc('id')->first();
            $next = $last ? ($last->id + 1) : 1;
            $posted = 'SI-' . str_pad((string)$next, 6, '0', STR_PAD_LEFT);

            $invoice = SaleInvoice::create([
                'user_id'            => $request->user()->id,
                'customer_id'        => $data['customer_id'],
                'invoice_type'       => $data['invoice_type'] ?? 'debit',
                'posted_number'      => $posted, // assigned on save
                'date'               => $data['date'],
                'remarks'            => $data['remarks'] ?? null,
                'doctor_name'        => $data['doctor_name'] ?? null,
                'patient_name'       => $data['patient_name'] ?? null,
                'discount_percentage'=> $data['discount_percentage'] ?? 0,
                'discount_amount'    => $data['discount_amount'] ?? 0,
                'tax_percentage'     => $data['tax_percentage'] ?? 0,
                'tax_amount'         => $data['tax_amount'] ?? 0,
                'item_discount'      => $data['item_discount'] ?? 0,
                'gross_amount'       => $data['gross_amount'],
                'total'              => $data['total'],
                'total_receive'      => $data['total_receive'] ?? 0,
            ]);

            $this->createItemsAndReduce($invoice, $data['items']);

            // Create customer ledger entry ONLY for credit sales
            $invoiceType = $data['invoice_type'] ?? 'debit';
            if ($invoiceType === 'credit') {
                $ledger = new CustomerLedger();
                $ledger->customer_id       = $data['customer_id'];
                $ledger->sale_invoice_id   = $invoice->id;
                $ledger->entry_type        = 'invoice';
                $ledger->is_manual         = false;
                $ledger->entry_date        = $data['date'];
                $ledger->posted_number     = $posted;
                $ledger->invoice_total     = $data['total'];
                $ledger->total_received    = $data['total_receive'] ?? 0;
                $ledger->balance_remaining = max((float)$data['total'] - (float)($data['total_receive'] ?? 0), 0);
                $ledger->credited_amount   = 0;
                $ledger->payment_ref       = null;
                $ledger->description       = 'Sale invoice ' . $posted;
                $ledger->created_by        = $request->user()->id;
                $ledger->save();
            }

            return response()->json(['message' => 'Sale Invoice created', 'id' => $invoice->id], 201);
        });
    }

    public function update(Request $request, $id)
    {
        $invoice = SaleInvoice::with('items')->findOrFail($id);
        $this->authorize('update', $invoice);

        // keep posted_number unique on update (user may not change it)
        $data = $request->validate([
            'customer_id'         => 'required|exists:customers,id',
            'invoice_type'        => 'nullable|string|in:credit,debit',
            'posted_number'       => 'required|string|unique:sale_invoices,posted_number,' . $invoice->id,
            'date'                => 'required|date',
            'remarks'             => 'nullable|string',
            'doctor_name'         => 'nullable|string',
            'patient_name'        => 'nullable|string',
            'discount_percentage' => 'nullable|numeric',
            'discount_amount'     => 'nullable|numeric',
            'tax_percentage'      => 'nullable|numeric',
            'tax_amount'          => 'nullable|numeric',
            'item_discount'       => 'nullable|numeric',
            'gross_amount'        => 'required|numeric',
            'total'               => 'required|numeric',
            'total_receive'       => 'nullable|numeric',

            'items'                            => 'required|array|min:1',
            'items.*.id'                       => 'nullable|integer',
            'items.*.product_id'               => 'required|exists:products,id',
            'items.*.pack_size'                => 'nullable|integer|min:0',
            'items.*.batch_number'             => 'nullable|string',
            'items.*.batch'                    => 'nullable|string',
            'items.*.expiry'                   => 'nullable|string',
            'items.*.expiry_date'              => 'nullable|string',
            'items.*.current_quantity'         => 'nullable|integer',
            'items.*.quantity'                 => 'required|integer|min:1',
            'items.*.price'                    => 'required|numeric|min:0',
            'items.*.item_discount_percentage' => 'nullable|numeric',
            'items.*.sub_total'                => 'required|numeric|min:0',
        ]);

        return DB::transaction(function () use ($invoice, $data) {
            $this->revertItems($invoice);
            $invoice->items()->delete();

            // Store old invoice type before update
            $oldInvoiceType = $invoice->invoice_type ?? 'debit';
            $newInvoiceType = $data['invoice_type'] ?? $oldInvoiceType;

            $invoice->update([
                'customer_id'        => $data['customer_id'],
                'invoice_type'       => $newInvoiceType,
                'posted_number'      => $data['posted_number'], // keep whatever is on the record
                'date'               => $data['date'],
                'remarks'            => $data['remarks'] ?? null,
                'doctor_name'        => $data['doctor_name'] ?? null,
                'patient_name'       => $data['patient_name'] ?? null,
                'discount_percentage'=> $data['discount_percentage'] ?? 0,
                'discount_amount'    => $data['discount_amount'] ?? 0,
                'tax_percentage'     => $data['tax_percentage'] ?? 0,
                'tax_amount'         => $data['tax_amount'] ?? 0,
                'item_discount'      => $data['item_discount'] ?? 0,
                'gross_amount'       => $data['gross_amount'],
                'total'              => $data['total'],
                'total_receive'      => $data['total_receive'] ?? 0,
            ]);

            $this->createItemsAndReduce($invoice, $data['items']);

            // Handle customer ledger entries
            // If invoice was previously credit but is now debit, delete the ledger entry
            if ($oldInvoiceType === 'credit' && $newInvoiceType !== 'credit') {
                // Remove existing ledger entry for this invoice
                CustomerLedger::where('sale_invoice_id', $invoice->id)->delete();
            }
            // If invoice is now credit, create or update ledger entry
            elseif ($newInvoiceType === 'credit') {
                // Check if a ledger entry already exists for this invoice
                $existingLedger = CustomerLedger::where('sale_invoice_id', $invoice->id)->first();
                
                if ($existingLedger) {
                    // Update existing ledger entry
                    $existingLedger->update([
                        'customer_id'       => $data['customer_id'],
                        'entry_date'        => $data['date'],
                        'invoice_total'     => $data['total'],
                        'total_received'    => $data['total_receive'] ?? 0,
                        'balance_remaining' => max((float)$data['total'] - (float)($data['total_receive'] ?? 0), 0),
                        'description'       => 'Sale invoice ' . $data['posted_number'],
                    ]);
                } else {
                    // Create new ledger entry
                    $ledger = new CustomerLedger();
                    $ledger->customer_id       = $data['customer_id'];
                    $ledger->sale_invoice_id   = $invoice->id;
                    $ledger->entry_type        = 'invoice';
                    $ledger->is_manual         = false;
                    $ledger->entry_date        = $data['date'];
                    $ledger->posted_number     = $data['posted_number'];
                    $ledger->invoice_total     = $data['total'];
                    $ledger->total_received    = $data['total_receive'] ?? 0;
                    $ledger->balance_remaining = max((float)$data['total'] - (float)($data['total_receive'] ?? 0), 0);
                    $ledger->credited_amount   = 0;
                    $ledger->payment_ref       = null;
                    $ledger->description       = 'Sale invoice ' . $data['posted_number'];
                    $ledger->created_by        = optional(Auth::user())->id;
                    $ledger->save();
                }
            }

            return response()->json(['message' => 'Sale Invoice updated', 'id' => $invoice->id]);
        });
    }

    public function destroy(Request $request, $id)
    {
        $invoice = SaleInvoice::with(['items', 'customer'])->findOrFail($id);
        $this->authorize('delete', $invoice);

        $mode = strtolower(trim((string)($request->query('mode', $request->input('mode', 'none')))));
        if (!in_array($mode, ['none', 'credit', 'refund'], true)) {
            $mode = 'none';
        }

        $invTotal = (float)($invoice->total ?? $invoice->grand_total ?? $invoice->gross_amount ?? 0);
        $received = (float)($invoice->total_receive ?? $invoice->total_recieve ?? $invoice->received ?? 0);
        $remaining = max($invTotal - $received, 0);

        return DB::transaction(function () use ($invoice, $mode, $invTotal, $received, $remaining) {
            $this->revertItems($invoice);

            $hasImpact = ($received > 0) || ($remaining > 0);
            
            // Only create customer ledger entries for credit invoices
            // Debit invoices (cash sales) are not tracked in customer ledger
            $isCreditInvoice = ($invoice->invoice_type ?? 'debit') === 'credit';

            if ($hasImpact && $isCreditInvoice) {
                $customerId   = (int)$invoice->customer_id;
                $postedNumber = $invoice->posted_number;
                $entryDate    = $invoice->date ?? now()->toDateString();
                $userId       = optional(Auth::user())->id;

                if ($mode === 'credit' || $mode === 'refund') {
                    $rev = new CustomerLedger();
                    $rev->customer_id       = $customerId;
                    $rev->entry_type        = 'manual';
                    $rev->is_manual         = true;
                    $rev->entry_date        = $entryDate;
                    $rev->posted_number     = $postedNumber;
                    $rev->invoice_total     = -$invTotal;
                    $rev->total_received    = 0;
                    $rev->balance_remaining = max($rev->invoice_total - $rev->total_received, 0);
                    $rev->credited_amount   = 0;
                    $rev->payment_ref       = null;
                    $rev->sale_invoice_id   = null;
                    $rev->description       = 'Reversal of deleted invoice '.$postedNumber;
                    $rev->created_by        = $userId;
                    $rev->save();
                }

                if ($mode === 'refund' && $received > 0) {
                    $refund = new CustomerLedger();
                    $refund->customer_id       = $customerId;
                    $refund->entry_type        = 'payment';
                    $refund->is_manual         = true;
                    $refund->entry_date        = $entryDate;
                    $refund->posted_number     = $postedNumber;
                    $refund->invoice_total     = 0;
                    $refund->total_received    = 0;
                    $refund->balance_remaining = 0;
                    $refund->credited_amount   = -$received;
                    $refund->payment_ref       = 'Refund for '.$postedNumber;
                    $refund->sale_invoice_id   = null;
                    $refund->description       = 'Refund for deleted invoice '.$postedNumber;
                    $refund->created_by        = $userId;
                    $refund->save();
                }

                if ($mode === 'none') {
                    $rev = new CustomerLedger();
                    $rev->customer_id       = $customerId;
                    $rev->entry_type        = 'manual';
                    $rev->is_manual         = true;
                    $rev->entry_date        = $entryDate;
                    $rev->posted_number     = $postedNumber;
                    $rev->invoice_total     = -$invTotal;
                    $rev->total_received    = 0;
                    $rev->balance_remaining = 0;
                    $rev->credited_amount   = 0;
                    $rev->payment_ref       = null;
                    $rev->sale_invoice_id   = null;
                    $rev->description       = 'Reversal (default credit) of deleted invoice '.$postedNumber;
                    $rev->created_by        = optional(Auth::user())->id;
                    $rev->save();
                }
            }

            $invoice->items()->delete();
            $invoice->delete();

            return response()->json(['message' => 'Sale Invoice deleted']);
        });
    }

    public function print(Request $request, SaleInvoice $invoice)
    {
        $invoice->load(['items.product', 'customer', 'user']);
        $setting = Setting::first();

        $type = strtolower($request->query('type', $setting->printer_type ?? 'a4'));
        if (!in_array($type, ['a4', 'thermal'])) {
            $type = 'a4';
        }

        $gross  = (float) ($invoice->items?->sum('sub_total') ?? 0);
        $disc   = (float) ($invoice->discount_amount ?? 0);
        $tax    = (float) ($invoice->tax_amount ?? 0);
        $total  = (float) ($invoice->total ?? ($gross - $disc + $tax));

        $receivedOnInvoice = (float) ($invoice->total_receive ?? 0);
        $remainThis        = max($total - $receivedOnInvoice, 0);

        $customerId = (int) $invoice->customer_id;

        // Calculate customer's Total Due from sale_invoices (like CustomerLedgerController does)
        // Formula: net_balance = (total_invoiced - received_on_invoice) - payments_credited
        $allInvoices = \App\Models\SaleInvoice::where('customer_id', $customerId)
            ->where('invoice_type', 'credit')
            ->get([
                'invoice_total','total','grand_total','net_total','gross_amount','sub_total',
                'total_receive','total_recieve','received','amount_received',
            ]);

        $totalInvoiced = 0.0;
        $receivedOnInv = 0.0;
        foreach ($allInvoices as $inv) {
            $totalInvoiced += (float) ($inv->invoice_total ?? $inv->total ?? $inv->grand_total ?? $inv->net_total ?? $inv->gross_amount ?? $inv->sub_total ?? 0);
            $receivedOnInv += (float) ($inv->total_receive ?? $inv->total_recieve ?? $inv->received ?? $inv->amount_received ?? 0);
        }

        // Get payments from customer_ledgers
        $paymentsCred = \App\Models\CustomerLedger::where('customer_id', $customerId)
            ->where('entry_type', 'payment')
            ->sum(DB::raw('COALESCE(credited_amount,0)'));

        // Calculate Total Due
        $customerTotalDue = ($totalInvoiced - $receivedOnInv) - $paymentsCred;
        if ($customerTotalDue < 0) $customerTotalDue = 0.0;

        $gross  = (float) ($invoice->items?->sum('sub_total') ?? 0);
        $disc   = (float) ($invoice->discount_amount ?? 0);
        $tax    = (float) ($invoice->tax_amount ?? 0);
        $total  = (float) ($invoice->total ?? ($gross - $disc + $tax));

        $receivedOnInvoice = (float) ($invoice->total_receive ?? 0);
        $remainThis        = max($total - $receivedOnInvoice, 0);

        // Determine which template to use
        if ($type === 'thermal') {
            // For thermal, use the selected thermal template from settings
            $thermalTemplate = $setting->thermal_template ?? 'standard';
            $templateName = "sale_invoice_thermal_{$thermalTemplate}";
        } else {
            // For A4, use the standard template
            $templateName = "sale_invoice_a4";
        }

        return view("printer.{$templateName}", [
            'invoice'            => $invoice,
            'setting'            => $setting,
            'printTotal'         => $total,
            'printReceive'       => $receivedOnInvoice,
            'printRemainThis'    => $remainThis,
            'printCustomerTotalDue' => $customerTotalDue,
        ]);
    }


    public function updateMeta(Request $request, SaleInvoice $saleInvoice)
{
    // Permission
    if (! $request->user()->can('report.sale-detail.edit')) {
        abort(403, 'Unauthorized');
    }

    // Safety: allow only doctor/patient
    $data = $request->validate([
        'doctor_name'  => 'nullable|string|max:255',
        'patient_name' => 'nullable|string|max:255',
    ]);

    // Optional: prevent editing cancelled invoices
    if ($saleInvoice->status === 'cancelled') {
        abort(403, 'Cancelled invoice cannot be edited');
    }

    $saleInvoice->update($data);

    return response()->json([
        'success' => true,
        'doctor_name'  => $saleInvoice->doctor_name,
        'patient_name' => $saleInvoice->patient_name,
    ]);
}
}
