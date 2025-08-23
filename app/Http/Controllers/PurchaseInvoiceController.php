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
    public function index()
    {
        return PurchaseInvoice::with('supplier', 'items.product')->get();
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
            'supplier_id' => 'required|exists:suppliers,id',
            'posted_number' => 'required|string',
            'posted_date' => 'required|date',
            'remarks' => 'nullable|string',
            'invoice_number' => 'required|string|unique:purchase_invoices,invoice_number',
            'invoice_amount' => 'required|numeric',
            'tax_percentage' => 'nullable|numeric',
            'tax_amount' => 'nullable|numeric',
            'discount_percentage' => 'nullable|numeric',
            'discount_amount' => 'nullable|numeric',
            'total_amount' => 'required|numeric',
            'items' => 'required|array',
            'items.*.product_id' => 'required|exists:products,id',
            'items.*.pack_size' => 'nullable|integer',
            'items.*.batch' => 'nullable|string',
            'items.*.expiry' => 'nullable|date',
            'items.*.pack_quantity' => 'required|integer',
            'items.*.unit_quantity' => 'required|integer',
            'items.*.pack_purchase_price' => 'required|numeric',
            'items.*.unit_purchase_price' => 'required|numeric',
            'items.*.pack_sale_price' => 'required|numeric',
            'items.*.unit_sale_price' => 'required|numeric',
            'items.*.margin' => 'required|numeric',
            'items.*.sub_total' => 'required|numeric',
            'items.*.avg_price' => 'required|numeric',
            'items.*.quantity' => 'required|integer',
        ]);

        DB::beginTransaction();

        try {
            $invoice = PurchaseInvoice::create($data);

            $this->processInvoiceItems($invoice, $data['items']);

            DB::commit();

            return response()->json($invoice->load('items.product', 'supplier'), 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'message' => 'Error creating purchase invoice',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    // Update invoice
    public function update(Request $request, PurchaseInvoice $purchaseInvoice)
    {
        $data = $request->validate([
            'supplier_id' => 'required|exists:suppliers,id',
            'posted_number' => 'required|string',
            'posted_date' => 'required|date',
            'remarks' => 'nullable|string',
            'invoice_number' => 'required|string|unique:purchase_invoices,invoice_number,' . $purchaseInvoice->id,
            'invoice_amount' => 'required|numeric',
            'tax_percentage' => 'nullable|numeric',
            'tax_amount' => 'nullable|numeric',
            'discount_percentage' => 'nullable|numeric',
            'discount_amount' => 'nullable|numeric',
            'total_amount' => 'required|numeric',
            'items' => 'required|array',
            'items.*.product_id' => 'required|exists:products,id',
            'items.*.pack_size' => 'nullable|integer',
            'items.*.batch' => 'nullable|string',
            'items.*.expiry' => 'nullable|date',
            'items.*.pack_quantity' => 'required|integer',
            'items.*.unit_quantity' => 'required|integer',
            'items.*.pack_purchase_price' => 'required|numeric',
            'items.*.unit_purchase_price' => 'required|numeric',
            'items.*.pack_sale_price' => 'required|numeric',
            'items.*.unit_sale_price' => 'required|numeric',
            'items.*.margin' => 'required|numeric',
            'items.*.sub_total' => 'required|numeric',
            'items.*.avg_price' => 'required|numeric',
            'items.*.quantity' => 'required|integer',
        ]);

        DB::beginTransaction();

        try {
            // Update invoice main data
            $purchaseInvoice->update($data);

            // Revert old items quantities and batches
            foreach ($purchaseInvoice->items as $oldItem) {
                $this->revertItem($oldItem);
            }

            // Delete old items
            $purchaseInvoice->items()->delete();

            // Process new items
            $this->processInvoiceItems($purchaseInvoice, $data['items']);

            DB::commit();

            return response()->json($purchaseInvoice->load('items.product', 'supplier'));
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'message' => 'Failed to update purchase invoice',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    // Delete invoice
    public function destroy(PurchaseInvoice $purchaseInvoice)
    {
        DB::beginTransaction();

        try {
            foreach ($purchaseInvoice->items as $item) {
                $this->revertItem($item);
            }

            $purchaseInvoice->items()->delete();
            $purchaseInvoice->delete();

            DB::commit();

            return response()->json(['message' => 'Invoice and related data deleted successfully']);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'message' => 'Failed to delete invoice',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Private helper to process items: create invoice items, update product and batch
     */
private function processInvoiceItems(PurchaseInvoice $invoice, array $items)
{
    foreach ($items as $item) {
        $invoice->items()->create($item);

        // Update product
        $product = Product::find($item['product_id']);
        if ($product) {
            // Weighted average calculation for avg_price
            $oldQty = $product->quantity;
            $oldAvg = $product->avg_price ?? 0;

            $newQty = $item['quantity'];
            $newAvg = $item['unit_purchase_price'];

            $totalQty = $oldQty + $newQty;

            if ($totalQty > 0) {
                $weightedAvg = (($oldQty * $oldAvg) + ($newQty * $newAvg)) / $totalQty;
            } else {
                $weightedAvg = $newAvg;
            }

            // Update product fields
            $product->quantity = $totalQty;
            $product->pack_purchase_price = $item['pack_purchase_price'];
            $product->unit_purchase_price = $item['unit_purchase_price'];
            $product->pack_sale_price = $item['pack_sale_price'];
            $product->unit_sale_price = $item['unit_sale_price'];

            // Save avg_price rounded to 2 decimals
            $product->avg_price = round($weightedAvg, 2);

            // Recalculate margin based on updated avg_price and latest sale price
            if ($product->unit_sale_price > 0) {
                $product->margin = round(
                    (($product->unit_sale_price - $product->avg_price) / $product->unit_sale_price) * 100,
                    2
                );
            } else {
                $product->margin = 0;
            }

            $product->save();
        }

        // Update batch
        if (!empty($item['batch']) && !empty($item['expiry'])) {
            $batch = Batch::firstOrNew([
                'product_id' => $item['product_id'],
                'batch_number' => $item['batch'],
                'expiry_date' => $item['expiry'],
            ]);

            if ($batch->exists) {
                $batch->quantity += $item['quantity'];
            } else {
                $batch->quantity = $item['quantity'];
            }

            $batch->save();
        }
    }
}


    private function revertItem($item)
    {
        $product = Product::find($item->product_id);
        if ($product) {
            $product->quantity -= $item->quantity;
            if ($product->quantity < 0) $product->quantity = 0;
            $product->save();
        }

        // update batch
        if (!empty($item->batch) && !empty($item->expiry)) {
            $batch = Batch::where('product_id', $item->product_id)
                ->where('batch_number', $item->batch)
                ->where('expiry_date', $item->expiry)
                ->first();

            if ($batch) {
                $batch->quantity -= $item->quantity;
                if ($batch->quantity < 0) $batch->quantity = 0;
                $batch->save();
            }
        }
    }

    private function recalcProductAverages(Product $product)
    {
        $items = DB::table('purchase_invoice_items')
            ->where('product_id', $product->id)
            ->select('quantity', 'unit_purchase_price', 'unit_sale_price')
            ->get();

        $totalQty = 0;
        $totalCost = 0;

        foreach ($items as $item) {
            $totalQty += $item->quantity;
            $totalCost += $item->quantity * $item->unit_purchase_price;
        }

        if ($totalQty > 0) {
            $avgPrice = $totalCost / $totalQty;
        } else {
            $avgPrice = 0;
        }

        $product->avg_price = round($avgPrice, 2);
        $product->quantity = $totalQty;

        // latest sale price from last invoice item
        $lastItem = $items->last();
        if ($lastItem) {
            $product->unit_sale_price = round($lastItem->unit_sale_price, 2);
            $product->margin = $avgPrice > 0
                ? round((($product->unit_sale_price - $avgPrice) / $avgPrice) * 100, 2)
                : 0;
        } else {
            $product->unit_sale_price = 0;
            $product->margin = 0;
        }

        $product->save();
    }
}