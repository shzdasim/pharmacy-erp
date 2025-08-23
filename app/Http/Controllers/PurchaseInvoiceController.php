<?php

namespace App\Http\Controllers;

use App\Models\Batch;
use App\Models\Product;
use App\Models\PurchaseInvoice;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PurchaseInvoiceController extends Controller
{
  
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

    return response()->json([
        'posted_number' => $formattedCode,
    ]);
}


    public function index()
    {
        return PurchaseInvoice::with('supplier', 'items.product')->get();
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'supplier_id' => 'required|exists:suppliers,id',
            'posted_number' => 'required|string',
            'posted_date' => 'required|date',
            'remarks' => 'nullable|string',
            'invoice_number' => 'required|string',
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

        // Use transaction to ensure data consistency across all models
        DB::beginTransaction();

        try {
            // 1. Create the Purchase Invoice (Model 1)
            $invoice = PurchaseInvoice::create($data);

            // Process each item
            foreach ($data['items'] as $item) {
                // 2. Create the Purchase Invoice Item (Model 2)
                $purchaseInvoiceItem = $invoice->items()->create($item);

                // 3. Update the Product model (Model 3)
                $product = Product::find($item['product_id']);
                if ($product) {
                    // Update product quantity by adding the new pack quantity
                    $product->quantity += $item['quantity'];
                    
                    // Update product pricing information with the latest values from invoice
                    $product->pack_purchase_price = $item['pack_purchase_price'];
                    $product->unit_purchase_price = $item['unit_purchase_price'];
                    $product->pack_sale_price = $item['pack_sale_price'];
                    $product->unit_sale_price = $item['unit_sale_price'];
                    $product->avg_price = $item['avg_price'];
                    
                    $product->save();
                }

                // 4. Update Batch model if batch and expiry are provided (Model 4)
                if (!empty($item['batch']) && !empty($item['expiry'])) {
                    // Find existing batch or create new one
                    $batch = Batch::firstOrNew([
                        'product_id' => $item['product_id'],
                        'batch_number' => $item['batch'],
                        'expiry_date' => $item['expiry'],
                    ]);

                    // If batch exists, increment quantity; otherwise set initial quantity
                    if ($batch->exists) {
                        $batch->quantity += $item['quantity'];
                    } else {
                        $batch->quantity = $item['quantity'];
                    }

                    $batch->save();
                }
            }

            // Commit the transaction
            DB::commit();

            return response()->json($invoice->load('items.product', 'supplier'), 201);

        } catch (\Exception $e) {
            // Rollback the transaction on error
            DB::rollBack();
            
            return response()->json([
                'message' => 'Error creating purchase invoice',
                'error' => $e->getMessage()
            ], 500);
        }
    }


    public function show(PurchaseInvoice $purchaseInvoice)
    {
        return $purchaseInvoice->load('supplier', 'items.product');
    }

    public function update(Request $request, PurchaseInvoice $purchaseInvoice)
    {
        $data = $request->validate([
            'supplier_id' => 'required|exists:suppliers,id',
            'posted_number' => 'required|string',
            'posted_date' => 'required|date',
            'remarks' => 'nullable|string',
            'invoice_number' => 'required|string',
            'invoice_amount' => 'required|numeric',
            'tax_percentage' => 'nullable|numeric',
            'tax_amount' => 'nullable|numeric',
            'discount_percentage' => 'nullable|numeric',
            'discount_amount' => 'nullable|numeric',
            'total_amount' => 'required|numeric',
            'items' => 'required|array',
        ]);

        $purchaseInvoice->update($data);

        $purchaseInvoice->items()->delete();
        $purchaseInvoice->items()->createMany($data['items']);

        return response()->json($purchaseInvoice->load('items.product'));
    }

public function destroy(PurchaseInvoice $purchaseInvoice)
{
    DB::beginTransaction();

    try {
        foreach ($purchaseInvoice->items as $item) {
            // Decrease the product quantity
            $product = Product::find($item->product_id);
            if ($product) {
                $product->quantity -= $item->quantity;
                $product->save();
            }

            // Delete corresponding batches
            if ($item->batch && $item->expiry) {
                $batch = Batch::where('product_id', $item->product_id)
                              ->where('batch_number', $item->batch)
                              ->where('expiry_date', $item->expiry)
                              ->first();
                if ($batch) {
                    $batch->delete();
                }
            }
        }

        // Delete invoice items
        $purchaseInvoice->items()->delete();

        // Delete the invoice itself
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

}
