<?php

namespace App\Http\Controllers;

use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class ProductController extends Controller
{
public function generateNewCode()
{
    // Get last product by id (latest)
    $lastProduct = Product::orderBy('id', 'desc')->first();

    if ($lastProduct && preg_match('/PRD-(\d+)/', $lastProduct->product_code, $matches)) {
        // Extract the numeric part and increment
        $lastCodeNum = (int) $matches[1];
        $newCodeNum = $lastCodeNum + 1;
    } else {
        // First product
        $newCodeNum = 1;
    }

    // Format product code as PRD-0001
    $formattedProductCode = 'PRD-' . str_pad($newCodeNum, 4, '0', STR_PAD_LEFT);

    // Generate barcode
    $barcode = 'PRD' . str_pad((string) random_int(0, 9999999999), 10, '0', STR_PAD_LEFT);

    return response()->json([
        'product_code' => $formattedProductCode,
        'barcode' => $barcode,
    ]);
}


public function availableQuantity(\Illuminate\Http\Request $request)
{
    $productId = $request->query('product_id');
    $batch     = $request->query('batch');

    if (!$productId) {
        return response()->json(['message' => 'product_id is required'], 422);
    }

    // Prefer batch-level quantity when a batch is provided.
    $available = 0;

    if ($batch) {
        // If you track stock per batch:
        $record = \App\Models\Batch::where('product_id', $productId)
            ->where('batch', $batch)
            ->first();
        $available = (int) ($record->available_quantity ?? $record->quantity ?? 0);
    } else {
        // Fallback: product-level on-hand quantity
        $product = \App\Models\Product::find($productId);
        $available = (int) ($product->available_quantity ?? $product->quantity ?? 0);
    }

    return response()->json([
        'product_id'      => (int) $productId,
        'batch'           => $batch,
        'available_units' => $available,
    ]);
}



    public function index()
    {
        return Product::with(['brand', 'category', 'supplier'])->orderBy('created_at', 'desc')->get();
    }

    // Store new product
    public function store(Request $request)
    {
        $validated = $request->validate([
            'product_code' => 'required|unique:products,product_code',
            'name' => 'required|unique:products,name',
            'image' => 'nullable|image|max:2048',
            'formulation' => 'nullable|string',
            'description' => 'nullable|string',
            'pack_size' => 'required|integer',
            'quantity' => 'nullable|integer',
            'pack_purchase_price' => 'nullable|numeric',
            'pack_sale_price' => 'nullable|numeric',
            'unit_purchase_price' => 'nullable|numeric',
            'unit_sale_price' => 'nullable|numeric',
            'avg_price' => 'nullable|numeric',
            'narcotic' => ['required', Rule::in(['yes', 'no'])],
            'max_discount' => 'nullable|integer',
            'category_id' => 'required|exists:categories,id',
            'brand_id' => 'required|exists:brands,id',
            'supplier_id' => 'required|exists:suppliers,id',
            'rack' => 'nullable|string',
            'barcode' => 'required|unique:products,barcode',
        ]);

        if ($request->hasFile('image')) {
            $path = $request->file('image')->store('products', 'public');
            $validated['image'] = $path;
        }

        $product = Product::create($validated);

        return response()->json($product, 201);
    }

    // Show single product
    public function show($id)
    {
        return Product::with(['brand', 'category', 'supplier'])->findOrFail($id);
    }

    // Update product
    public function update(Request $request, $id)
    {
        $product = Product::findOrFail($id);
        
        $validated = $request->validate([
            'product_code' => ['required', Rule::unique('products', 'product_code')->ignore($product->id)],
            'name' => ['required', Rule::unique('products', 'name')->ignore($product->id)],
            'image' => 'nullable|image|max:2048',
            'formulation' => 'nullable|string',
            'description' => 'nullable|string',
            'pack_size' => 'required|integer',
            'quantity' => 'nullable|integer',
            'pack_purchase_price' => 'nullable|numeric',
            'pack_sale_price' => 'nullable|numeric',
            'unit_purchase_price' => 'nullable|numeric',
            'unit_sale_price' => 'nullable|numeric',
            'avg_price' => 'nullable|numeric',
            'narcotic' => ['required', Rule::in(['yes', 'no'])],
            'max_discount' => 'nullable|integer',
            'category_id' => 'required|exists:categories,id',
            'brand_id' => 'required|exists:brands,id',
            'supplier_id' => 'required|exists:suppliers,id',
            'rack' => 'nullable|string',
            'barcode' => ['required', Rule::unique('products', 'barcode')->ignore($product->id)],
        ]);

        if ($request->hasFile('image')) {
            // Delete old image if exists
            if ($product->image) {
                Storage::disk('public')->delete($product->image);
            }
            $path = $request->file('image')->store('products', 'public');
            $validated['image'] = $path;
        }
        $product->update($validated);

        return response()->json($product);
    }

    // Delete product
    public function destroy($id)
    {
        $product = Product::findOrFail($id);

        if ($product->image) {
            Storage::disk('public')->delete($product->image);
        }

        $product->delete();

        return response()->json(['message' => 'Product deleted']);
    }
}
