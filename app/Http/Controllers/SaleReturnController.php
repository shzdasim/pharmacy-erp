<?php

namespace App\Http\Controllers;

use App\Models\Product;
use App\Models\Batch;
use App\Models\SaleReturn;
use App\Models\SaleReturnItem;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Auth;

class SaleReturnController extends Controller
{
    // ===== Helpers =====
    private function i($v): int { return (int)($v ?? 0); }
    private function f($v): float { return (float)($v ?? 0.0); }

    private function unitsFromArray(array $item): int
    {
        return $this->i($item['unit_return_quantity'] ?? 0);
    }

    private function unitsFromModel(SaleReturnItem $item): int
    {
        return $this->i($item->unit_return_quantity ?? 0);
    }

    /**
     * Smart stock delta: try to apply to Batch first, then mirror the actual applied delta to Product.
     * $deltaUnits: positive = increase (on create), negative = decrease (on update revert / delete).
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
            if ($after < 0) $after = 0;                 // never below zero
            $actualApplied = $after - $before;          // what really changed
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

    // Create items and INCREASE stock (sale return adds back to inventory)
    private function createItemsAndIncrease(SaleReturn $sr, array $items): void
    {
        foreach ($items as $raw) {
            $payload = [
                'product_id'               => $raw['product_id'],
                'batch_number'             => $raw['batch_number'] ?? ($raw['batch'] ?? null),
                'expiry'                   => $raw['expiry'] ?? null,
                'unit_sale_quantity'       => $this->i($raw['unit_sale_quantity'] ?? 0),
                'unit_sale_price'          => $this->f($raw['unit_sale_price'] ?? 0),
                'item_discount_percentage' => $this->f($raw['item_discount_percentage'] ?? 0),
                'unit_return_quantity'     => $this->i($raw['unit_return_quantity'] ?? 0),
                'sub_total'                => $this->f($raw['sub_total'] ?? 0),
            ];

            $it = new SaleReturnItem($payload);
            $it->sale_return_id = $sr->id;
            $it->save();

            // Apply +units to stock
            $this->applyStockDeltaSmart(
                $this->i($payload['product_id']),
                $payload['batch_number'] ?? null,
                $payload['expiry'] ?? null,
                +$this->i($payload['unit_return_quantity'])
            );
        }
    }

    // Revert items: DECREASE stock by the previously returned quantity
    private function revertItems(SaleReturn $sr): void
    {
        foreach ($sr->items as $it) {
            $this->applyStockDeltaSmart(
                $this->i($it->product_id),
                $it->batch_number,
                $it->expiry,
                -$this->unitsFromModel($it)
            );
        }
    }

    // ===== CRUD =====

    // SaleReturnController@index
public function index(Request $request)
{
    $qPosted   = trim((string) $request->query('posted'));
    $qCustomer = trim((string) $request->query('customer'));

    $query = \App\Models\SaleReturn::with(['customer'])->latest();

    if ($qPosted !== '') {
        $query->where('posted_number', 'like', '%' . $qPosted . '%');
    }
    if ($qCustomer !== '') {
        $query->whereHas('customer', function ($q) use ($qCustomer) {
            $q->where('name', 'like', '%' . $qCustomer . '%');
        });
    }

    return $query->get();
}


    public function show(SaleReturn $saleReturn)
    {
        return $saleReturn->load(['customer', 'saleInvoice', 'items.product']);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'customer_id'         => 'required|exists:customers,id',
            'posted_number'       => 'required|string',
            'date'                => 'required|date',
            'sale_invoice_id'     => 'nullable|exists:sale_invoices,id',
            'remarks'             => 'nullable|string',

            'gross_total'         => 'nullable|numeric',
            'discount_percentage' => 'nullable|numeric',
            'discount_amount'     => 'nullable|numeric',
            'tax_percentage'      => 'nullable|numeric',
            'tax_amount'          => 'nullable|numeric',
            'total'               => 'required|numeric',

            'items'                             => 'required|array|min:1',
            'items.*.product_id'                => 'required|exists:products,id',
            'items.*.batch_number'              => 'nullable|string',
            'items.*.expiry'                    => 'nullable|string',
            'items.*.unit_sale_quantity'        => 'nullable|integer|min:0',
            'items.*.unit_return_quantity'      => 'required|integer|min:0',
            'items.*.unit_sale_price'           => 'nullable|numeric',
            'items.*.item_discount_percentage'  => 'nullable|numeric',
            'items.*.sub_total'                 => 'nullable|numeric',
        ]);

        $userId = Auth::id();
        if (!$userId) {
            abort(401, 'Unauthenticated: user_id is required');
        }

        return DB::transaction(function () use ($data, $userId) {
            $sr = SaleReturn::create([
                'user_id'            => $userId,
                'customer_id'         => $data['customer_id'],
                'sale_invoice_id'     => $data['sale_invoice_id'] ?? null,
                'posted_number'       => $data['posted_number'],
                'date'                => $data['date'],
                'remarks'             => $data['remarks'] ?? null,
                'gross_total'         => $this->f($data['gross_total'] ?? 0),
                'discount_percentage' => $this->f($data['discount_percentage'] ?? 0),
                'discount_amount'     => $this->f($data['discount_amount'] ?? 0),
                'tax_percentage'      => $this->f($data['tax_percentage'] ?? 0),
                'tax_amount'          => $this->f($data['tax_amount'] ?? 0),
                'total'               => $this->f($data['total'] ?? 0),
            ]);

            $this->createItemsAndIncrease($sr, $data['items']);

            return $sr->load(['customer', 'items.product']);
        });
    }

    public function update(Request $request, SaleReturn $saleReturn)
    {
        $data = $request->validate([
            'customer_id'         => 'required|exists:customers,id',
            'posted_number'       => 'required|string',
            'date'                => 'required|date',
            'sale_invoice_id'     => 'nullable|exists:sale_invoices,id',
            'remarks'             => 'nullable|string',

            'gross_total'         => 'nullable|numeric',
            'discount_percentage' => 'nullable|numeric',
            'discount_amount'     => 'nullable|numeric',
            'tax_percentage'      => 'nullable|numeric',
            'tax_amount'          => 'nullable|numeric',
            'total'               => 'required|numeric',

            'items'                             => 'required|array|min:1',
            'items.*.product_id'                => 'required|exists:products,id',
            'items.*.batch_number'              => 'nullable|string',
            'items.*.expiry'                    => 'nullable|string',
            'items.*.unit_sale_quantity'        => 'nullable|integer|min:0',
            'items.*.unit_return_quantity'      => 'required|integer|min:0',
            'items.*.unit_sale_price'           => 'nullable|numeric',
            'items.*.item_discount_percentage'  => 'nullable|numeric',
            'items.*.sub_total'                 => 'nullable|numeric',
        ]);

        $userId = Auth::id();
        if (!$userId) {
            abort(401, 'Unauthenticated: user_id is required');
        }

        return DB::transaction(function () use ($saleReturn, $data, $userId) {
            // Revert previous stock effects
            $this->revertItems($saleReturn);

            // Replace items
            $saleReturn->items()->delete();
            $saleReturn->update([
                'user_id'            => $userId,
                'customer_id'         => $data['customer_id'],
                'sale_invoice_id'     => $data['sale_invoice_id'] ?? null,
                'posted_number'       => $data['posted_number'],
                'date'                => $data['date'],
                'remarks'             => $data['remarks'] ?? null,
                'gross_total'         => $this->f($data['gross_total'] ?? 0),
                'discount_percentage' => $this->f($data['discount_percentage'] ?? 0),
                'discount_amount'     => $this->f($data['discount_amount'] ?? 0),
                'tax_percentage'      => $this->f($data['tax_percentage'] ?? 0),
                'tax_amount'          => $this->f($data['tax_amount'] ?? 0),
                'total'               => $this->f($data['total'] ?? 0),
            ]);

            $this->createItemsAndIncrease($saleReturn, $data['items']);

            return $saleReturn->load(['customer', 'items.product']);
        });
    }

    public function destroy(SaleReturn $saleReturn)
    {
        return DB::transaction(function () use ($saleReturn) {
            $this->revertItems($saleReturn);
            $saleReturn->items()->delete();
            $saleReturn->delete();
            return response()->json(['message' => 'Sale return deleted']);
        });
    }

    public function generateNewCode()
    {
        $last = SaleReturn::orderBy('id', 'desc')->first();
        $next = 1;
        if ($last && !empty($last->posted_number)) {
            if (preg_match('/SLRET-(\d+)/', $last->posted_number, $m)) {
                $next = ((int)$m[1]) + 1;
            } elseif (preg_match('/SL-(\d+)/', $last->posted_number, $m)) {
                $next = ((int)$m[1]) + 1;
            }
        }
        return response()->json(['posted_number' => 'SLRET-'.str_pad($next, 4, '0', STR_PAD_LEFT)]);
    }
}
