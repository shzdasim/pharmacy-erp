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
    // ===== Helpers (mirroring PurchaseReturn) =====
    private function i($v): int   { return (int)($v ?? 0); }
    private function f($v): float { return (float)($v ?? 0.0); }

    // For Sales, client already sends unit "quantity"
    private function unitsFromArray(array $item): int
    {
        return $this->i($item['quantity'] ?? 0);
    }
    private function unitsFromModel(SaleInvoiceItem $item): int
    {
        return $this->i($item->quantity ?? 0);
    }

    /**
     * Apply delta to Batch first; then apply the *actual applied* delta to Product.
     * $deltaUnits: negative => reduce (on create / new lines), positive => revert (on update/delete).
     */
    private function applyStockDeltaSmart(int $productId, ?string $batchNo, ?string $expiry, int $deltaUnits): void
    {
        $batchNo = trim((string)($batchNo ?? ''));
        $expiry  = trim((string)($expiry ?? ''));

        $actualApplied = $deltaUnits; // default if batch not found

        $batch = null;
        if ($batchNo !== '') {
            $batch = Batch::where('product_id', $productId)
                // support either column name
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
            $actualApplied = $after - $before; // what really changed at batch-level
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
            // Normalize accepted keys to our columns
            $payload = [
                'product_id'               => $raw['product_id'],
                'pack_size'                => $this->i($raw['pack_size'] ?? 0),
                'batch_number'             => $raw['batch_number'] ?? ($raw['batch'] ?? null),
                'expiry'                   => $raw['expiry'] ?? ($raw['expiry_date'] ?? null),
                'current_quantity'         => $this->i($raw['current_quantity'] ?? 0), // snapshot only
                'quantity'                 => $this->i($raw['quantity'] ?? 0),          // units for sale
                'price'                    => $this->f($raw['price'] ?? 0),
                'item_discount_percentage' => $this->f($raw['item_discount_percentage'] ?? 0),
                'sub_total'                => $this->f($raw['sub_total'] ?? 0),
            ];

            /** @var SaleInvoiceItem $item */
            $item = $invoice->items()->create($payload);

            // Sales reduce stock by exactly the units sold
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
                +$units // add back on revert
            );
        }
    }

    // ===== Endpoints =====

    public function generateNewCode()
    {
        // 🔒 require create
        $this->authorize('create', SaleInvoice::class);
        $last = SaleInvoice::orderBy('id', 'desc')->first();
        $next = $last ? ($last->id + 1) : 1;
        $code = 'SI-' . str_pad((string)$next, 6, '0', STR_PAD_LEFT);
        return response()->json(['posted_number' => $code]);
    }

    // SaleInvoiceController@index
public function index(Request $request)
{
    // 🔒 list
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
        // must authorize against the *instance*
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

        // Strict validation (batch is nullable because some products have no batches)
        $data = $request->validate([
            'customer_id'         => 'required|exists:customers,id',
            'posted_number'       => 'required|string|unique:sale_invoices,posted_number',
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
            'total_receive'          => 'nullable|numeric',

            'items'                            => 'required|array|min:1',
            'items.*.product_id'               => 'required|exists:products,id',
            'items.*.pack_size'                => 'nullable|integer|min:0',
            'items.*.batch_number'             => 'nullable|string',      // ← nullable (like PR)
            'items.*.batch'                    => 'nullable|string',      // accept alt key
            'items.*.expiry'                   => 'nullable|string',
            'items.*.expiry_date'              => 'nullable|string',      // accept alt key
            'items.*.current_quantity'         => 'nullable|integer',
            'items.*.quantity'                 => 'required|integer|min:1', // units
            'items.*.price'                    => 'required|numeric|min:0',
            'items.*.item_discount_percentage' => 'nullable|numeric|min:0',
            'items.*.sub_total'                => 'required|numeric|min:0',
        ]);

        return DB::transaction(function () use ($data, $request) {
            $invoice = SaleInvoice::create([
                'user_id'            => $request->user()->id,
                'customer_id'        => $data['customer_id'],
                'posted_number'      => $data['posted_number'],
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
                'total_receive'         => $data['total_receive'] ?? 0,
            ]);

            $this->createItemsAndReduce($invoice, $data['items']);

            return response()->json(['message' => 'Sale Invoice created', 'id' => $invoice->id], 201);
        });
    }

    public function update(Request $request, $id)
    {
        $invoice = SaleInvoice::with('items')->findOrFail($id);
        // 🔒 update against instance
        $this->authorize('update', $invoice);

        $data = $request->validate([
            'customer_id'         => 'required|exists:customers,id',
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
            'total_receive'          => 'nullable|numeric',

            'items'                            => 'required|array|min:1',
            'items.*.id'                       => 'nullable|integer',
            'items.*.product_id'               => 'required|exists:products,id',
            'items.*.pack_size'                => 'nullable|integer|min:0',
            'items.*.batch_number'             => 'nullable|string',      // ← was required; now nullable
            'items.*.batch'                    => 'nullable|string',
            'items.*.expiry'                   => 'nullable|string',
            'items.*.expiry_date'              => 'nullable|string',
            'items.*.current_quantity'         => 'nullable|integer',
            'items.*.quantity'                 => 'required|integer|min:1',
            'items.*.price'                    => 'required|numeric|min:0',
            'items.*.item_discount_percentage' => 'nullable|numeric|min:0',
            'items.*.sub_total'                => 'required|numeric|min:0',
        ]);

        return DB::transaction(function () use ($invoice, $data) {
            // Revert previous stock effects (exactly like PurchaseReturn)
            $this->revertItems($invoice);

            // Replace items
            $invoice->items()->delete();

            // Update header
            $invoice->update([
                'customer_id'        => $data['customer_id'],
                'posted_number'      => $data['posted_number'],
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
                'total_receive'         => $data['total_receive'] ?? 0,
            ]);

            // Apply new items and reduce stock
            $this->createItemsAndReduce($invoice, $data['items']);

            return response()->json(['message' => 'Sale Invoice updated']);
        });
    }

    public function destroy(Request $request, $id)
{
    $invoice = SaleInvoice::with(['items', 'customer'])->findOrFail($id);
    // 🔒 delete against instance
        $this->authorize('delete', $invoice);
    // read chosen mode from query/body; default to 'none'
    $mode = strtolower(trim((string)($request->query('mode', $request->input('mode', 'none')))));
    if (!in_array($mode, ['none', 'credit', 'refund'], true)) {
        $mode = 'none';
    }

    // robust numbers (fallback-friendly)
    $invTotal = (float)($invoice->total ?? $invoice->grand_total ?? $invoice->gross_amount ?? 0);
    $received = (float)($invoice->total_receive ?? $invoice->total_recieve ?? $invoice->received ?? 0);
    $remaining = max($invTotal - $received, 0);

    return DB::transaction(function () use ($invoice, $mode, $invTotal, $received, $remaining) {
        // 1) STOCK: revert stock before delete
        $this->revertItems($invoice);

        // 2) LEDGER: add rows according to the mode (only if there is financial impact)
        $hasImpact = ($received > 0) || ($remaining > 0);

        if ($hasImpact) {
            // Common parts for ledger rows
            $customerId   = (int)$invoice->customer_id;
            $postedNumber = $invoice->posted_number;
            $entryDate    = $invoice->date ?? now()->toDateString();
            $userId       = optional(Auth::user())->id;

            // (A) Manual reversal row:
            //     invoice_total = -invTotal, total_received = 0
            //     This removes the A/R and leaves the received amount as credit (if any).
            if ($mode === 'credit' || $mode === 'refund') {
                $rev = new CustomerLedger();
                $rev->customer_id       = $customerId;
                $rev->entry_type        = 'manual';
                $rev->is_manual         = true;
                $rev->entry_date        = $entryDate;
                $rev->posted_number     = $postedNumber;
                $rev->invoice_total     = -$invTotal;
                $rev->total_received    = 0;
                $rev->balance_remaining = max($rev->invoice_total - $rev->total_received, 0); // usually 0 since negative
                $rev->credited_amount   = 0;
                $rev->payment_ref       = null;
                $rev->sale_invoice_id   = null; // avoid FK pointing to deleted invoice
                $rev->description       = 'Reversal of deleted invoice '.$postedNumber;
                $rev->created_by        = $userId;
                $rev->save();
            }

            // (B) Refund row as a NEGATIVE payment (if refund chosen)
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
                $refund->credited_amount   = -$received; // negative = refund out
                $refund->payment_ref       = 'Refund for '.$postedNumber;
                $refund->sale_invoice_id   = null;
                $refund->description       = 'Refund for deleted invoice '.$postedNumber;
                $refund->created_by        = $userId;
                $refund->save();
            }

            // (C) If mode was 'none' but there is impact, for safety default to CREDIT
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

        // 3) DELETE: items then invoice
        $invoice->items()->delete();
        $invoice->delete();

        return response()->json(['message' => 'Sale Invoice deleted']);
    });
}

    // SaleInvoiceController.php
public function print(Request $request, SaleInvoice $invoice)
{
    $invoice->load(['items.product', 'customer', 'user']);
    $setting = Setting::first();

    // Choose printer type: query param overrides Setting
    $type = strtolower($request->query('type', $setting->printer_type ?? 'a4'));
    if (!in_array($type, ['a4', 'thermal'])) {
        $type = 'a4';
    }

    // ---- Core invoice numbers ----
    $gross  = (float) ($invoice->items?->sum('sub_total') ?? 0);
    $disc   = (float) ($invoice->discount_amount ?? 0);
    $tax    = (float) ($invoice->tax_amount ?? 0);
    $total  = (float) ($invoice->total ?? ($gross - $disc + $tax));

    $receivedOnInvoice = (float) ($invoice->total_receive ?? 0);
    $remainThis        = max($total - $receivedOnInvoice, 0);

// ---- Global Net (ledger header logic) + This-invoice remaining ----
$customerId = (int) $invoice->customer_id;

// 1) Sum ALL invoices (do NOT exclude current one)
$allInv = \App\Models\SaleInvoice::where('customer_id', $customerId)->get([
    'invoice_total','total','grand_total','net_total','gross_amount','sub_total',
    'total_receive','total_recieve','received','amount_received'
]);

$allTotals   = 0.0;
$allReceived = 0.0;
foreach ($allInv as $inv) {
    $t = (float) ($inv->invoice_total ?? $inv->total ?? $inv->grand_total ?? $inv->net_total ?? $inv->gross_amount ?? $inv->sub_total ?? 0);
    $r = (float) ($inv->total_receive ?? $inv->total_recieve ?? $inv->received ?? $inv->amount_received ?? 0);
    $allTotals   += $t;
    $allReceived += $r;
}

// 2) Sum ALL payments from ledger (and include manual rows with credited_amount if you use them)
$paymentsCred = (float) \App\Models\CustomerLedger::where('customer_id', $customerId)
    ->where(function ($q) {
        $q->whereRaw("LOWER(entry_type) = 'payment'")
          ->orWhere(function ($q2) {
              $q2->whereRaw("LOWER(entry_type) = 'manual'")
                 ->whereRaw('COALESCE(credited_amount,0) <> 0');
          });
    })
    ->sum(DB::raw('COALESCE(credited_amount,0)'));

// 3) Global net (matches the ledger header): (Total Invoiced − Received on Invoice) − Received Payments
$globalNet = ($allTotals - $allReceived) - $paymentsCred;
if ($globalNet < 0) $globalNet = 0.0;

// 4) Keep this-invoice remaining as-is (invoice total − invoice’s own received field)
$gross  = (float) ($invoice->items?->sum('sub_total') ?? 0);
$disc   = (float) ($invoice->discount_amount ?? 0);
$tax    = (float) ($invoice->tax_amount ?? 0);
$total  = (float) ($invoice->total ?? ($gross - $disc + $tax));

$receivedOnInvoice = (float) ($invoice->total_receive ?? 0);
$remainThis        = max($total - $receivedOnInvoice, 0);

// 5) For display, you can derive "Old Remaining (Net)" as global minus this invoice’s remain (clamped ≥ 0)
$oldRemainingNet = $globalNet - $remainThis;
if ($oldRemainingNet < 0) $oldRemainingNet = 0.0;

// 6) Pass to view
return view("printer.sale_invoice_{$type}", [
    'invoice'          => $invoice,
    'setting'          => $setting,
    'printTotal'       => $total,
    'printReceive'     => $receivedOnInvoice,
    'printRemainThis'  => $remainThis,
    'printOldRemain'   => $oldRemainingNet,
    'printGrandRemain' => $globalNet,   // <— will now match ledger Net Balance (e.g., 178)
]);

}

}
