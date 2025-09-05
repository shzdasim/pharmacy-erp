<?php

namespace App\Http\Controllers;

use App\Models\Product;
use App\Models\Supplier;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class SupplierController extends Controller
{
    public function search(Request $req)
{
    $q     = trim($req->input('q', ''));
    $limit = max(1, min((int)$req->input('limit', 20), 100));

    $query = Supplier::select('id','name')->orderBy('name');

    if ($q !== '') {
        $query->where('name','like',"%{$q}%");
    }

    return $query->limit($limit)->get();
}
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
    public function export(): StreamedResponse
{
    $file = 'suppliers_'.now()->format('Y-m-d_H-i-s').'.csv';

    return response()->streamDownload(function () {
        $out = fopen('php://output', 'w');

        // UTF-8 BOM so Excel opens it correctly
        fprintf($out, chr(0xEF).chr(0xBB).chr(0xBF));

        // Header
        fputcsv($out, ['name','address','phone']);

        // Stream rows in chunks for large datasets
        Supplier::select('name','address','phone')
            ->orderBy('name')
            ->chunk(1000, function ($chunk) use ($out) {
                foreach ($chunk as $s) {
                    fputcsv($out, [
                        (string) ($s->name ?? ''),
                        (string) ($s->address ?? ''),
                        (string) ($s->phone ?? ''),
                    ]);
                }
            });

        fclose($out);
    }, $file, [
        'Content-Type' => 'text/csv; charset=UTF-8',
    ]);
}
}
