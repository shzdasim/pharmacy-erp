<?php

namespace App\Http\Controllers;

use App\Models\PurchaseReturn;
use Illuminate\Http\Request;

class PurchaseReturnController extends Controller
{
public function index()
{
    return PurchaseReturn::with(['supplier', 'purchaseInvoice', 'items.product'])
        ->latest()
        ->get();
}


    public function store(Request $request)
    {
        $data = $request->validate([
            'supplier_id' => 'required|exists:suppliers,id',
            'posted_number' => 'required|unique:purchase_returns',
            'date' => 'required|date',
            'purchase_invoice_id' => 'required|exists:purchase_invoices,id',
            'gross_total' => 'required|numeric',
            'discount_percentage' => 'nullable|numeric',
            'tax_percentage' => 'nullable|numeric',
            'discount_amount' => 'nullable|numeric',
            'tax_amount' => 'nullable|numeric',
            'total' => 'required|numeric',
            'items' => 'required|array',
            'items.*.product_id' => 'required|exists:products,id',
            'items.*.batch' => 'nullable|string',
            'items.*.expiry' => 'nullable|date',
            'items.*.pack_size' => 'required|integer',
            'items.*.return_pack_quantity' => 'required|integer',
            'items.*.return_unit_quantity' => 'required|integer',
            'items.*.pack_purchase_price' => 'required|numeric',
            'items.*.unit_purchase_price' => 'required|numeric',
            'items.*.item_discount_percentage' => 'nullable|numeric',
            'items.*.sub_total' => 'required|numeric',
        ]);

        $purchaseReturn = PurchaseReturn::create($data);
        $purchaseReturn->items()->createMany($data['items']);

        return response()->json($purchaseReturn->load('items.product'), 201);
    }

    public function show(PurchaseReturn $purchaseReturn)
    {
        return $purchaseReturn->load(['supplier', 'purchaseInvoice', 'items.product']);
    }

    public function update(Request $request, PurchaseReturn $purchaseReturn)
    {
        $data = $request->validate([
            'supplier_id' => 'required|exists:suppliers,id',
            'date' => 'required|date',
            'purchase_invoice_id' => 'required|exists:purchase_invoices,id',
            'gross_total' => 'required|numeric',
            'discount_percentage' => 'nullable|numeric',
            'tax_percentage' => 'nullable|numeric',
            'discount_amount' => 'nullable|numeric',
            'tax_amount' => 'nullable|numeric',
            'total' => 'required|numeric',
            'items' => 'required|array',
        ]);

        $purchaseReturn->update($data);
        $purchaseReturn->items()->delete();
        $purchaseReturn->items()->createMany($data['items']);

        return response()->json($purchaseReturn->load('items.product'));
    }

    public function destroy(PurchaseReturn $purchaseReturn)
    {
        $purchaseReturn->delete();
        return response()->json(null, 204);
    }

    public function generateNewCode()
    {
        $latest = PurchaseReturn::latest()->first();
        $code = 'PR-' . str_pad(($latest ? $latest->id + 1 : 1), 5, '0', STR_PAD_LEFT);
        return response()->json(['code' => $code]);
    }
}
