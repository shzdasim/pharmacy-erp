<?php

namespace App\Http\Controllers;

use App\Models\Batch;
use App\Models\Product;
use App\Models\SaleInvoice;
use App\Models\SaleInvoiceItem;
use Illuminate\Http\Request;
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
        $last = SaleInvoice::orderBy('id', 'desc')->first();
        $next = $last ? ($last->id + 1) : 1;
        $code = 'SI-' . str_pad((string)$next, 6, '0', STR_PAD_LEFT);
        return response()->json(['posted_number' => $code]);
    }

    // SaleInvoiceController@index
public function index(Request $request)
{
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
        return response()->json($invoice);
    }

    public function store(Request $request)
    {
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
            ]);

            $this->createItemsAndReduce($invoice, $data['items']);

            return response()->json(['message' => 'Sale Invoice created', 'id' => $invoice->id], 201);
        });
    }

    public function update(Request $request, $id)
    {
        $invoice = SaleInvoice::with('items')->findOrFail($id);

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
            ]);

            // Apply new items and reduce stock
            $this->createItemsAndReduce($invoice, $data['items']);

            return response()->json(['message' => 'Sale Invoice updated']);
        });
    }

    public function destroy($id)
    {
        $invoice = SaleInvoice::with('items')->findOrFail($id);

        return DB::transaction(function () use ($invoice) {
            // Revert stock before delete (exactly like PurchaseReturn)
            $this->revertItems($invoice);

            $invoice->items()->delete();
            $invoice->delete();

            return response()->json(['message' => 'Sale Invoice deleted']);
        });
    }
}
