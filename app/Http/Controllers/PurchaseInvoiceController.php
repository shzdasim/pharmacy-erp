<?php

namespace App\Http\Controllers;

use App\Models\PurchaseInvoice;
use Illuminate\Http\Request;

class PurchaseInvoiceController extends Controller
{
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

        $invoice = PurchaseInvoice::create($data);
        $invoice->items()->createMany($data['items']);

        return response()->json($invoice->load('items.product'), 201);
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
        $purchaseInvoice->delete();
        return response()->json(['message' => 'Deleted successfully']);
    }
}
