<?php

namespace App\Http\Controllers;

use App\Models\Batch;
use App\Models\Product;
use App\Models\PurchaseInvoice;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PurchaseInvoiceController extends Controller
{
    // Generate new invoice code
    public function generateNewCode()
    {
        $lastInvoice = PurchaseInvoice::orderBy('id', 'desc')->first();

        if ($lastInvoice && $lastInvoice->posted_number && preg_match('/PRINV-(\d+)/', $lastInvoice->posted_number, $matches)) {
            $lastCodeNum = (int) $matches[1];
            $newCodeNum = $lastCodeNum + 1;
        } else {
            $newCodeNum = 1;
        }

        $formattedCode = 'PRINV-' . str_pad($newCodeNum, 4, '0', STR_PAD_LEFT);

        return response()->json(['posted_number' => $formattedCode]);
    }

    // List all invoices
    public function index(Request $request)
    {
        $query = PurchaseInvoice::with('supplier', 'items.product');

        if ($request->has('supplier_id')) {
            $query->where('supplier_id', $request->supplier_id);
        }

        return $query->get();
    }

    // Show single invoice
    public function show(PurchaseInvoice $purchaseInvoice)
    {
        return $purchaseInvoice->load('supplier', 'items.product');
    }

    // Store new invoice
    public function store(Request $request)
    {
        $data = $request->validate([
            'supplier_id'          => 'required|exists:suppliers,id',
            'posted_number'        => 'required|string',
            'posted_date'          => 'required|date',
            'remarks'              => 'nullable|string',
            'invoice_number'       => 'required|string|unique:purchase_invoices,invoice_number',
            'invoice_amount'       => 'required|numeric',
            'tax_percentage'       => 'nullable|numeric',
            'tax_amount'           => 'nullable|numeric',
            'discount_percentage'  => 'nullable|numeric',
            'discount_amount'      => 'nullable|numeric',
            'total_amount'         => 'required|numeric',

            'items'                                => 'required|array',
            'items.*.product_id'                   => 'required|exists:products,id',
            'items.*.pack_size'                    => 'nullable|integer',
            'items.*.batch'                        => 'nullable|string',
            'items.*.expiry'                       => 'nullable|date',
            'items.*.pack_quantity'                => 'required|integer',
            'items.*.unit_quantity'                => 'required|integer',
            'items.*.pack_purchase_price'          => 'required|numeric',
            'items.*.unit_purchase_price'          => 'required|numeric',
            'items.*.pack_sale_price'              => 'required|numeric',
            'items.*.unit_sale_price'              => 'required|numeric',
            'items.*.item_discount_percentage'     => 'nullable|numeric|min:0',
            'items.*.pack_bonus'                   => 'nullable|integer|min:0',
            'items.*.unit_bonus'                   => 'nullable|integer|min:0',
            'items.*.margin'                       => 'required|numeric',
            'items.*.sub_total'                    => 'required|numeric',
            'items.*.avg_price'                    => 'required|numeric', // effective cost
            'items.*.quantity'                     => 'required|integer',
        ]);

        DB::beginTransaction();

        try {
            $invoice = PurchaseInvoice::create($data);

            $this->processInvoiceItems($invoice, $data['items']);

            // Optionally polish costing (won't touch quantity)
            $this->recalcProductsByIds(
                collect($data['items'])->pluck('product_id')->unique()->all()
            );

            DB::commit();

            return response()->json($invoice->load('items.product', 'supplier'), 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'message' => 'Error creating purchase invoice',
                'error'   => $e->getMessage()
            ], 500);
        }
    }

    // Update invoice
    public function update(Request $request, PurchaseInvoice $purchaseInvoice)
    {
        $data = $request->validate([
            'supplier_id'          => 'required|exists:suppliers,id',
            'posted_number'        => 'required|string',
            'posted_date'          => 'required|date',
            'remarks'              => 'nullable|string',
            'invoice_number'       => 'required|string|unique:purchase_invoices,invoice_number,' . $purchaseInvoice->id,
            'invoice_amount'       => 'required|numeric',
            'tax_percentage'       => 'nullable|numeric',
            'tax_amount'           => 'nullable|numeric',
            'discount_percentage'  => 'nullable|numeric',
            'discount_amount'      => 'nullable|numeric',
            'total_amount'         => 'required|numeric',

            'items'                                => 'required|array',
            'items.*.product_id'                   => 'required|exists:products,id',
            'items.*.pack_size'                    => 'nullable|integer',
            'items.*.batch'                        => 'nullable|string',
            'items.*.expiry'                       => 'nullable|date',
            'items.*.pack_quantity'                => 'required|integer',
            'items.*.unit_quantity'                => 'required|integer',
            'items.*.pack_purchase_price'          => 'required|numeric',
            'items.*.unit_purchase_price'          => 'required|numeric',
            'items.*.pack_sale_price'              => 'required|numeric',
            'items.*.unit_sale_price'              => 'required|numeric',
            'items.*.item_discount_percentage'     => 'nullable|numeric|min:0',
            'items.*.pack_bonus'                   => 'nullable|integer|min:0',
            'items.*.unit_bonus'                   => 'nullable|integer|min:0',
            'items.*.margin'                       => 'required|numeric',
            'items.*.sub_total'                    => 'required|numeric',
            'items.*.avg_price'                    => 'required|numeric', // effective cost
            'items.*.quantity'                     => 'required|integer',
        ]);

        DB::beginTransaction();

        try {
            $purchaseInvoice->update($data);

            $purchaseInvoice->load('items');

            $affectedIds = $purchaseInvoice->items->pluck('product_id')->merge(
                collect($data['items'])->pluck('product_id')
            )->unique()->all();

            foreach ($purchaseInvoice->items as $oldItem) {
                $this->revertItem($oldItem, false);
            }

            $purchaseInvoice->items()->delete();
            $this->processInvoiceItems($purchaseInvoice, $data['items']);

            $this->recalcProductsByIds($affectedIds);

            DB::commit();

            return response()->json($purchaseInvoice->load('items.product', 'supplier'));
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'message' => 'Failed to update purchase invoice',
                'error'   => $e->getMessage()
            ], 500);
        }
    }

    // Delete invoice
    public function destroy(PurchaseInvoice $purchaseInvoice)
    {
        DB::beginTransaction();

        try {
            $purchaseInvoice->load('items');

            $affectedIds = $purchaseInvoice->items->pluck('product_id')->unique()->all();

            foreach ($purchaseInvoice->items as $item) {
                $this->revertItem($item, true);
            }

            $purchaseInvoice->items()->delete();
            $purchaseInvoice->delete();

            $this->recalcProductsByIds($affectedIds);

            DB::commit();

            return response()->json(['message' => 'Invoice and related data deleted successfully']);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'message' => 'Failed to delete invoice',
                'error'   => $e->getMessage()
            ], 500);
        }
    }

    private function processInvoiceItems(PurchaseInvoice $invoice, array $items): void
    {
        foreach ($items as $item) {
            $invoice->items()->create($item);

            $product = Product::find($item['product_id']);
            if ($product) {
                $product->applyPurchaseFromItem($item); // uses avg_price
            }

            if (!empty($item['batch']) && !empty($item['expiry'])) {
                $batch = Batch::firstOrNew([
                    'product_id'   => $item['product_id'],
                    'batch_number' => $item['batch'],
                    'expiry_date'  => $item['expiry'],
                ]);

                $batch->quantity = ($batch->exists ? (int) $batch->quantity : 0) + (int) $item['quantity'];
                $batch->save();
            }
        }
    }

    private function revertItem($item, bool $deleteBatch = false): void
    {
        $product = Product::find($item->product_id);
        if ($product) {
            $product->revertPurchaseFromItem($item); // uses avg_price
        }

        if (!empty($item->batch) && !empty($item->expiry)) {
            $batch = Batch::where('product_id', $item->product_id)
                ->where('batch_number', $item->batch)
                ->where('expiry_date', $item->expiry)
                ->first();

            if ($batch) {
                if ($deleteBatch) {
                    $batch->delete();
                } else {
                    $batch->quantity = max(0, (int) $batch->quantity - (int) $item->quantity);
                    $batch->save();
                }
            }
        }
    }

    /**
     * Recalculate avg_price & margin from purchase history WITHOUT touching quantity.
     * Uses line-level avg_price so bonuses/discounts are included.
     */
    /**
 * Recalculate avg_price & margin from purchase history WITHOUT touching quantity
 * or any sale/purchase price fields. Uses line-level avg_price (effective cost)
 * so bonuses/discounts are included.
 */
private function recalcProductAverages(Product $product): void
{
    $items = DB::table('purchase_invoice_items')
        ->where('product_id', $product->id)
        ->select('quantity', 'avg_price', 'id')
        ->orderBy('id')
        ->get();

    $totalQty  = 0;
    $totalCost = 0.0;

    foreach ($items as $item) {
        $q = (int) $item->quantity;
        $totalQty  += $q;
        $totalCost += $q * (float) $item->avg_price; // effective cost captured per line
    }

    $avgPrice = $totalQty > 0 ? ($totalCost / $totalQty) : 0.0;

    // ✅ Only costing fields — DO NOT touch quantity or any sale/purchase price fields
    $product->avg_price = round($avgPrice, 2);

    // Recompute margin using whatever unit_sale_price the product already has
    $product->margin = ($product->unit_sale_price > 0 && $avgPrice > 0)
        ? round((($product->unit_sale_price - $avgPrice) / $product->unit_sale_price) * 100, 2)
        : 0.0;

    $product->save();
}


    private function recalcProductsByIds(array $productIds): void
    {
        foreach (array_unique($productIds) as $pid) {
            $product = Product::find($pid);
            if ($product) {
                $this->recalcProductAverages($product);
            }
        }
    }

    public function checkUnique(Request $request)
    {
        $request->validate([
            'supplier_id'    => 'required|integer',
            'invoice_number' => 'required|string',
            'exclude_id'     => 'nullable|integer',
        ]);

        $query = \App\Models\PurchaseInvoice::where('supplier_id', $request->supplier_id)
            ->where('invoice_number', $request->invoice_number);

        if ($request->filled('exclude_id')) {
            $query->where('id', '!=', $request->exclude_id);
        }

        $exists = $query->exists();

        return response()->json([
            'unique' => !$exists,
        ]);
    }
}
