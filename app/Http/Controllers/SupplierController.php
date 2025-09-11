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
        $this->authorize('viewAny', Supplier::class);

        $q     = trim($req->input('q', ''));
        $limit = max(1, min((int)$req->input('limit', 20), 100));

        $query = Supplier::select('id','name')->orderBy('name');

        if ($q !== '') {
            $query->where('name','like',"%{$q}%");
        }

        return $query->limit($limit)->get();
    }

    /**
     * GET /api/suppliers
     */
    public function index()
    {
        $this->authorize('viewAny', Supplier::class);

        return response()->json(
            Supplier::withCount('products')->orderBy('name')->get()
        );
    }

    /**
     * POST /api/suppliers
     */
    public function store(Request $request)
    {
        $this->authorize('create', Supplier::class);

        $data = $request->validate([
            'name'    => 'required|string|max:150|unique:suppliers,name',
            'address' => 'nullable|string|max:255',
            'phone'   => 'nullable|string|max:50',
        ]);

        $supplier = Supplier::create($data);

        return response()->json($supplier, 201);
    }

    /**
     * GET /api/suppliers/{supplier}
     */
    public function show(Supplier $supplier)
    {
        $this->authorize('view', $supplier);

        return response()->json($supplier);
    }

    /**
     * PUT/PATCH /api/suppliers/{supplier}
     */
    public function update(Request $request, Supplier $supplier)
    {
        $this->authorize('update', $supplier);

        $data = $request->validate([
            'name'    => 'required|string|max:150|unique:suppliers,name,' . $supplier->id,
            'address' => 'nullable|string|max:255',
            'phone'   => 'nullable|string|max:50',
        ]);

        $supplier->update($data);

        return response()->json($supplier);
    }

    /**
     * DELETE /api/suppliers/{supplier}
     */
    public function destroy(Supplier $supplier)
    {
        $this->authorize('delete', $supplier);

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

    /**
     * GET /api/suppliers/export
     */
    public function export(): StreamedResponse
    {
        $this->authorize('export', Supplier::class);

        $file = 'suppliers_'.now()->format('Y-m-d_H-i-s').'.csv';

        return response()->streamDownload(function () {
            $out = fopen('php://output', 'w');

            // UTF-8 BOM for Excel
            fprintf($out, chr(0xEF).chr(0xBB).chr(0xBF));

            // Header
            fputcsv($out, ['name','address','phone']);

            // Rows (streamed)
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
        }, $file, ['Content-Type' => 'text/csv; charset=UTF-8']);
    }
}
