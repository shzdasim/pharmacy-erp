<?php

namespace App\Http\Controllers;

use App\Models\Product;
use App\Models\Batch;
use App\Models\PurchaseReturn;
use App\Models\PurchaseReturnItem;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PurchaseReturnController extends Controller
{
    // ===== Helpers =====
    private function i($v): int { return (int)($v ?? 0); }
    private function f($v): float { return (float)($v ?? 0.0); }

    // IMPORTANT: units are ALREADY precomputed on the client.
    private function unitsFromArray(array $item): int
    {
        return $this->i($item['return_unit_quantity'] ?? 0);
    }

    private function unitsFromModel(PurchaseReturnItem $item): int
    {
        return $this->i($item->return_unit_quantity ?? 0);
    }

    /**
     * Apply delta to Batch first; then apply the *actual* applied delta to Product.
     * $deltaUnits: negative = reduce (creating a return), positive = revert (on update/delete).
     */
    private function applyStockDeltaSmart(int $productId, ?string $batchNo, ?string $expiry, int $deltaUnits): void
    {
        $batchNo = trim((string)($batchNo ?? ''));
        $expiry  = trim((string)($expiry ?? ''));

        $actualApplied = $deltaUnits; // default if batch not found

        $batch = null;
        if ($batchNo !== '' && $expiry !== '') {
            $batch = Batch::where('product_id', $productId)
                ->where(function ($q) use ($batchNo) {
                    $q->where('batch_number', $batchNo)->orWhere('batch', $batchNo);
                })
                ->where(function ($q) use ($expiry) {
                    $q->where('expiry_date', $expiry)->orWhere('expiry', $expiry);
                })
                ->first();
        }

        if ($batch) {
            $before = $this->i($batch->quantity);
            $after  = $before + $deltaUnits;
            if ($after < 0) $after = 0;                // never go below zero
            $actualApplied = $after - $before;         // what really changed
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

    private function createItemsAndReduce(PurchaseReturn $pr, array $items): void
    {
        foreach ($items as $raw) {
            $payload = [
                'product_id'                => $raw['product_id'],
                'batch'                     => $raw['batch'] ?? null,
                'expiry'                    => $raw['expiry'] ?? null,
                'pack_size'                 => $this->i($raw['pack_size'] ?? 0),
                'pack_purchased_quantity'   => $this->i($raw['pack_purchased_quantity'] ?? 0),
                'return_pack_quantity'      => $this->i($raw['return_pack_quantity'] ?? 0),
                'return_unit_quantity'      => $this->i($raw['return_unit_quantity'] ?? 0), // ← already final units
                'pack_purchase_price'       => $this->f($raw['pack_purchase_price'] ?? 0),
                'unit_purchase_price'       => $this->f($raw['unit_purchase_price'] ?? 0),
                'item_discount_percentage'  => $this->f($raw['item_discount_percentage'] ?? 0),
                'sub_total'                 => $this->f($raw['sub_total'] ?? 0),
            ];

            $units = $this->unitsFromArray($payload);
            $payload['quantity'] = $units; // harmless if column absent

            /** @var PurchaseReturnItem $item */
            $item = $pr->items()->create($payload);

            // Returns reduce stock by exactly the units provided
            $this->applyStockDeltaSmart($item->product_id, $item->batch, $item->expiry, -$units);
        }
    }

    private function revertItems(PurchaseReturn $pr): void
    {
        $pr->load('items');
        foreach ($pr->items as $item) {
            $units = $this->unitsFromModel($item);
            $this->applyStockDeltaSmart($item->product_id, $item->batch, $item->expiry, +$units);
        }
    }

    // ===== Endpoints =====

    public function index()
    {
        return PurchaseReturn::with(['supplier', 'purchaseInvoice', 'items.product'])->latest()->get();
    }

    public function show(PurchaseReturn $purchaseReturn)
    {
        return $purchaseReturn->load(['supplier', 'purchaseInvoice', 'items.product']);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'supplier_id'           => 'required|exists:suppliers,id',
            'posted_number'         => 'required|string',
            'date'                  => 'required|date',
            'purchase_invoice_id'   => 'nullable|exists:purchase_invoices,id',
            'remarks'               => 'nullable|string',

            'gross_total'           => 'nullable|numeric',
            'discount_percentage'   => 'nullable|numeric',
            'discount_amount'       => 'nullable|numeric',
            'tax_percentage'        => 'nullable|numeric',
            'tax_amount'            => 'nullable|numeric',
            'total'                 => 'required|numeric',

            'items'                                 => 'required|array|min:1',
            'items.*.product_id'                    => 'required|exists:products,id',
            'items.*.pack_size'                     => 'nullable|integer',
            'items.*.batch'                         => 'nullable|string',
            'items.*.expiry'                        => 'nullable|string',
            'items.*.pack_purchased_quantity'       => 'nullable|integer',
            'items.*.return_pack_quantity'          => 'nullable|integer',
            'items.*.return_unit_quantity'          => 'required|integer|min:0', // ← trust this
            'items.*.pack_purchase_price'           => 'nullable|numeric',
            'items.*.unit_purchase_price'           => 'nullable|numeric',
            'items.*.item_discount_percentage'      => 'nullable|numeric',
            'items.*.sub_total'                     => 'nullable|numeric',
        ]);

        return DB::transaction(function () use ($data) {
            $pr = PurchaseReturn::create([
                'supplier_id'         => $data['supplier_id'],
                'posted_number'       => $data['posted_number'],
                'date'                => $data['date'],
                'purchase_invoice_id' => $data['purchase_invoice_id'] ?? null,
                'remarks'             => $data['remarks'] ?? null,
                'gross_total'         => $data['gross_total'] ?? 0,
                'discount_percentage' => $data['discount_percentage'] ?? 0,
                'discount_amount'     => $data['discount_amount'] ?? 0,
                'tax_percentage'      => $data['tax_percentage'] ?? 0,
                'tax_amount'          => $data['tax_amount'] ?? 0,
                'total'               => $data['total'],
            ]);

            $this->createItemsAndReduce($pr, $data['items']);

            return $pr->load(['supplier', 'purchaseInvoice', 'items.product']);
        });
    }

    public function update(Request $request, PurchaseReturn $purchaseReturn)
    {
        $data = $request->validate([
            'supplier_id'           => 'required|exists:suppliers,id',
            'posted_number'         => 'required|string',
            'date'                  => 'required|date',
            'purchase_invoice_id'   => 'nullable|exists:purchase_invoices,id',
            'remarks'               => 'nullable|string',

            'gross_total'           => 'nullable|numeric',
            'discount_percentage'   => 'nullable|numeric',
            'discount_amount'       => 'nullable|numeric',
            'tax_percentage'        => 'nullable|numeric',
            'tax_amount'            => 'nullable|numeric',
            'total'                 => 'required|numeric',

            'items'                                 => 'required|array|min:1',
            'items.*.product_id'                    => 'required|exists:products,id',
            'items.*.pack_size'                     => 'nullable|integer',
            'items.*.batch'                         => 'nullable|string',
            'items.*.expiry'                        => 'nullable|string',
            'items.*.pack_purchased_quantity'       => 'nullable|integer',
            'items.*.return_pack_quantity'          => 'nullable|integer',
            'items.*.return_unit_quantity'          => 'required|integer|min:0', // ← trust this
            'items.*.pack_purchase_price'           => 'nullable|numeric',
            'items.*.unit_purchase_price'           => 'nullable|numeric',
            'items.*.item_discount_percentage'      => 'nullable|numeric',
            'items.*.sub_total'                     => 'nullable|numeric',
        ]);

        return DB::transaction(function () use ($purchaseReturn, $data) {
            // Revert previous stock effects
            $this->revertItems($purchaseReturn);

            // Replace items
            $purchaseReturn->items()->delete();

            // Update header
            $purchaseReturn->update([
                'supplier_id'         => $data['supplier_id'],
                'posted_number'       => $data['posted_number'],
                'date'                => $data['date'],
                'purchase_invoice_id' => $data['purchase_invoice_id'] ?? null,
                'remarks'             => $data['remarks'] ?? null,
                'gross_total'         => $data['gross_total'] ?? 0,
                'discount_percentage' => $data['discount_percentage'] ?? 0,
                'discount_amount'     => $data['discount_amount'] ?? 0,
                'tax_percentage'      => $data['tax_percentage'] ?? 0,
                'tax_amount'          => $data['tax_amount'] ?? 0,
                'total'               => $data['total'],
            ]);

            // Apply new items
            $this->createItemsAndReduce($purchaseReturn, $data['items']);

            return $purchaseReturn->load(['supplier', 'purchaseInvoice', 'items.product']);
        });
    }

    public function destroy(PurchaseReturn $purchaseReturn)
    {
        return DB::transaction(function () use ($purchaseReturn) {
            $this->revertItems($purchaseReturn);
            $purchaseReturn->items()->delete();
            $purchaseReturn->delete();
            return response()->json(null, 204);
        });
    }

    public function generateNewCode()
    {
        $last = PurchaseReturn::orderBy('id', 'desc')->first();
        $next = 1;
        if ($last && !empty($last->posted_number)) {
            if (preg_match('/PRRET-(\d+)/', $last->posted_number, $m)) {
                $next = ((int)$m[1]) + 1;
            } elseif (preg_match('/PR-(\d+)/', $last->posted_number, $m)) {
                $next = ((int)$m[1]) + 1;
            }
        }
        return response()->json(['posted_number' => 'PRRET-'.str_pad($next, 4, '0', STR_PAD_LEFT)]);
    }
}
