<?php

namespace App\Http\Controllers;

use App\Models\Product;
use App\Models\Supplier;
use Illuminate\Http\Request;

class SupplierController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        return response()->json(
            Supplier::withCount('products')->get()
        );
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $supplier = Supplier::create($request->only(['name', 'address', 'phone']));
        return response()->json($supplier, 201);
    }

    /**
     * Display the specified resource.
     */
    public function show(Supplier $supplier)
    {
        return response()->json($supplier);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, Supplier $supplier)
    {
        $supplier->update($request->only(['name', 'address', 'phone']));
        return response()->json($supplier);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Supplier $supplier)
    {
        // HARD GUARD: block delete if any product references this supplier
        $inUse = Product::where('supplier_id', $supplier->id)->exists();
        if ($inUse) {
            return response()->json([
                'message' => 'Cannot delete: supplier is used by one or more products.'
            ], 422);
        }
        $supplier->delete();
        return response()->json(null, 204);
    }
}
