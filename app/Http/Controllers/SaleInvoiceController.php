<?php

namespace App\Http\Controllers;

use App\Models\Batch;
use App\Models\Product;
use App\Models\SaleInvoice;
use App\Models\SaleInvoiceItem;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class SaleInvoiceController extends Controller
{
    public function generateNewCode()
    {
        $last = SaleInvoice::orderBy('id', 'desc')->first();
        $next = $last ? ($last->id + 1) : 1;
        $code = 'SI-' . str_pad((string)$next, 6, '0', STR_PAD_LEFT);

        return response()->json(['posted_number' => $code]);
    }

    public function index()
    {
        return SaleInvoice::with(['customer'])
            ->orderBy('id', 'desc')
            ->get();
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

    $data = $request->validate([
        // ... your existing validation rules ...
    ]);

    return DB::transaction(function () use ($data, $request) {
        $invoice = SaleInvoice::create([
            'user_id'        => $request->user()->id, // <-- logged-in user
            'customer_id'    => $data['customer_id'],
            'posted_number'  => $data['posted_number'],
            'date'           => $data['date'],
            'remarks'        => $data['remarks'] ?? null,
            'doctor_name'    => $data['doctor_name'] ?? null,
            'patient_name'   => $data['patient_name'] ?? null,
            'discount_percentage' => $data['discount_percentage'] ?? 0,
            'discount_amount'     => $data['discount_amount'] ?? 0,
            'tax_percentage'      => $data['tax_percentage'] ?? 0,
            'tax_amount'          => $data['tax_amount'] ?? 0,
            'item_discount'       => $data['item_discount'] ?? 0,
            'gross_amount'   => $data['gross_amount'],
            'total'          => $data['total'],
        ]);

        // ... keep the rest of your stock adjustments exactly as-is ...
        foreach ($data['items'] as $row) {
            $item = new SaleInvoiceItem($row);
            $item->sale_invoice_id = $invoice->id;
            $item->save();

            if (!empty($row['batch_number'])) {
                $batch = Batch::where('product_id', $row['product_id'])
                    ->where('batch', $row['batch_number'])
                    ->lockForUpdate()
                    ->first();
                if ($batch) {
                    $batch->quantity = max(0, (int)$batch->quantity - (int)$row['quantity']);
                    $batch->save();
                }
            }

            $product = Product::lockForUpdate()->find($row['product_id']);
            if ($product) {
                $product->quantity = max(0, (int)$product->quantity - (int)$row['quantity']);
                $product->save();
            }
        }

        return response()->json(['message' => 'Sale Invoice created', 'id' => $invoice->id], 201);
    });
}

    public function update(Request $request, $id)
    {
        $invoice = SaleInvoice::with('items')->findOrFail($id);

        $data = $request->validate([
            'customer_id' => 'required|exists:customers,id',
            'posted_number' => 'required|string|unique:sale_invoices,posted_number,' . $invoice->id,
            'date' => 'required|date',
            'remarks' => 'nullable|string',
            'doctor_name' => 'nullable|string',
            'patient_name' => 'nullable|string',
            'discount_percentage' => 'nullable|numeric',
            'discount_amount' => 'nullable|numeric',
            'tax_percentage' => 'nullable|numeric',
            'tax_amount' => 'nullable|numeric',
            'item_discount' => 'nullable|numeric',
            'gross_amount' => 'required|numeric',
            'total' => 'required|numeric',

            'items' => 'required|array|min:1',
            'items.*.id' => 'nullable|integer', // present for existing lines
            'items.*.product_id' => 'required|exists:products,id',
            'items.*.pack_size' => 'required|integer|min:1',
            'items.*.batch_number' => 'required|string',
            'items.*.expiry' => 'nullable|date',
            'items.*.current_quantity' => 'nullable|integer',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.price' => 'required|numeric|min:0',
            'items.*.item_discount_percentage' => 'nullable|numeric|min:0',
            'items.*.sub_total' => 'required|numeric|min:0',
        ]);

        return DB::transaction(function () use ($invoice, $data) {
            // 1) Revert old stock
            foreach ($invoice->items as $old) {
                if ($old->batch_number) {
                    $batch = Batch::where('product_id', $old->product_id)
                        ->where('batch', $old->batch_number)
                        ->lockForUpdate()
                        ->first();
                    if ($batch) {
                        $batch->quantity = (int)$batch->quantity + (int)$old->quantity;
                        $batch->save();
                    }
                }
                $product = Product::lockForUpdate()->find($old->product_id);
                if ($product) {
                    $product->quantity = (int)$product->quantity + (int)$old->quantity;
                    $product->save();
                }
            }

            // 2) Replace items
            $invoice->items()->delete();

            // 3) Update master invoice
            $invoice->update([
                'customer_id' => $data['customer_id'],
                'posted_number' => $data['posted_number'],
                'date' => $data['date'],
                'remarks' => $data['remarks'] ?? null,
                'doctor_name' => $data['doctor_name'] ?? null,
                'patient_name' => $data['patient_name'] ?? null,
                'discount_percentage' => $data['discount_percentage'] ?? 0,
                'discount_amount' => $data['discount_amount'] ?? 0,
                'tax_percentage' => $data['tax_percentage'] ?? 0,
                'tax_amount' => $data['tax_amount'] ?? 0,
                'item_discount' => $data['item_discount'] ?? 0,
                'gross_amount' => $data['gross_amount'],
                'total' => $data['total'],
            ]);

            // 4) Insert new lines + adjust stock
            foreach ($data['items'] as $row) {
                $item = new SaleInvoiceItem($row);
                $item->sale_invoice_id = $invoice->id;
                $item->save();

                if (!empty($row['batch_number'])) {
                    $batch = Batch::where('product_id', $row['product_id'])
                        ->where('batch', $row['batch_number'])
                        ->lockForUpdate()
                        ->first();
                    if ($batch) {
                        $batch->quantity = max(0, (int)$batch->quantity - (int)$row['quantity']);
                        $batch->save();
                    }
                }

                $product = Product::lockForUpdate()->find($row['product_id']);
                if ($product) {
                    $product->quantity = max(0, (int)$product->quantity - (int)$row['quantity']);
                    $product->save();
                }
            }

            return response()->json(['message' => 'Sale Invoice updated']);
        });
    }

    public function destroy($id)
    {
        $invoice = SaleInvoice::with('items')->findOrFail($id);

        return DB::transaction(function () use ($invoice) {
            // Revert stock before delete
            foreach ($invoice->items as $old) {
                if ($old->batch_number) {
                    $batch = Batch::where('product_id', $old->product_id)
                        ->where('batch', $old->batch_number)
                        ->lockForUpdate()
                        ->first();
                    if ($batch) {
                        $batch->quantity = (int)$batch->quantity + (int)$old->quantity;
                        $batch->save();
                    }
                }
                $product = Product::lockForUpdate()->find($old->product_id);
                if ($product) {
                    $product->quantity = (int)$product->quantity + (int)$old->quantity;
                    $product->save();
                }
            }

            $invoice->items()->delete();
            $invoice->delete();

            return response()->json(['message' => 'Sale Invoice deleted']);
        });
    }
}
