<?php

namespace App\Http\Controllers;

use App\Models\Product;
use App\Models\PurchaseInvoiceItem;
use App\Models\PurchaseReturnItem;
use App\Models\SaleInvoiceItem;
use App\Models\SaleReturnItem;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ProductController extends Controller
{

    public function search(Request $req)
{
    $q     = trim($req->input('q', ''));
    $ids   = $req->input('ids'); // can be array or comma-separated
    $limit = max(1, min((int)$req->input('limit', 30), 1000));

    $query = Product::select([
            'id','name','product_code','pack_size',
            'unit_purchase_price','unit_sale_price',
            'pack_purchase_price','pack_sale_price',
            'quantity','margin','avg_price',
            'brand_id','supplier_id'
        ])
        ->with(['brand:id,name','supplier:id,name'])
        ->orderBy('name');

    // If ids are provided → return exactly those (no limit)
    if ($ids) {
        if (is_string($ids)) {
            $ids = array_filter(array_map('intval', explode(',', $ids)));
        }
        if (is_array($ids) && count($ids)) {
            return response()->json($query->whereIn('id', $ids)->get());
        }
    }

    if ($q !== '') {
        $query->where(function (Builder $b) use ($q) {
            $b->where('name', 'like', "%{$q}%")
              ->orWhere('product_code', 'like', "%{$q}%")
              ->orWhere('barcode', 'like', "%{$q}%");
        });
    }

    return response()->json($query->limit($limit)->get());
}

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



    public function index(Request $req)
{
    // page size: clamp between 1 and 100 (default 25 or what you like)
    $perPage = max(1, min((int)$req->input('per_page', 25), 100));

    // optional filters
    $qName     = trim((string)$req->input('q_name', ''));
    $qBrand    = trim((string)$req->input('q_brand', ''));
    $qSupplier = trim((string)$req->input('q_supplier', ''));

    $q = Product::query()
        // Select only columns actually needed by index.jsx
        ->select([
            'id','product_code','name','image',
            'category_id','brand_id','supplier_id',
            'quantity',
        ])
        // Only pull id+name for relations to keep payload tiny
        ->with([
            'category:id,name',
            'brand:id,name',
            'supplier:id,name',
        ])
        // Count batches without loading them
        ->withCount('batches');

    if ($qName !== '') {
        $q->where('name', 'like', "%{$qName}%");
    }
    if ($qBrand !== '') {
        $q->whereHas('brand', fn(Builder $b) => $b->where('name', 'like', "%{$qBrand}%"));
    }
    if ($qSupplier !== '') {
        $q->whereHas('supplier', fn(Builder $s) => $s->where('name', 'like', "%{$qSupplier}%"));
    }

    $q->orderByDesc('id');

    // Use paginate (not get!) so we don’t blow memory
    $page = $q->paginate($perPage);

    return response()->json($page);
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
// replace your existing destroy($id) with this version
public function destroy($id)
{
    $product = Product::findOrFail($id);

    // Hard business rules first
    if (($product->quantity ?? 0) > 0) {
        return response()->json([
            'message' => 'Cannot delete: product has on-hand quantity.'
        ], 422);
    }

    if ($product->batches()->exists()) {
        return response()->json([
            'message' => 'Cannot delete: product has batch records.'
        ], 422);
    }

    // ---- NEW: block if referenced in any invoices/returns ----
    // Assumptions (adjust if needed):
    // - purchase_invoice_items table has product_id & purchase_invoice_id
    // - purchase_invoices table has id & invoice_number
    // - sale_invoice_items table has product_id & sale_invoice_id
    // - sale_invoices table has id & invoice_number
    // - purchase_return_items table has product_id & purchase_return_id
    // - purchase_returns table has id & return_number (or invoice_number) -> rename below
    // - sale_return_items table has product_id & sale_return_id
    // - sale_returns table has id & return_number (or invoice_number) -> rename below

    $capPerType = 8; // show up to 8 numbers per type in the toast

    // Purchase Invoices
    $purchaseInvoiceNos = PurchaseInvoiceItem::where('product_id', $product->id)
        ->join('purchase_invoices', 'purchase_invoices.id', '=', 'purchase_invoice_items.purchase_invoice_id')
        ->pluck('purchase_invoices.posted_number')
        ->unique()
        ->values();

    // Sale Invoices
    $saleInvoiceNos = SaleInvoiceItem::where('product_id', $product->id)
        ->join('sale_invoices', 'sale_invoices.id', '=', 'sale_invoice_items.sale_invoice_id')
        ->pluck('sale_invoices.posted_number')
        ->unique()
        ->values();

    // Purchase Returns  (rename 'return_number' -> your actual column; sometimes it's 'invoice_number')
    $purchaseReturnNos = PurchaseReturnItem::where('product_id', $product->id)
        ->join('purchase_returns', 'purchase_returns.id', '=', 'purchase_return_items.purchase_return_id')
        ->pluck('purchase_returns.return_number')
        ->unique()
        ->values();

    // Sale Returns (rename 'return_number' if needed)
    $saleReturnNos = SaleReturnItem::where('product_id', $product->id)
        ->join('sale_returns', 'sale_returns.id', '=', 'sale_return_items.sale_return_id')
        ->pluck('sale_returns.posted_number')
        ->unique()
        ->values();

    $hasRefs = $purchaseInvoiceNos->isNotEmpty()
        || $saleInvoiceNos->isNotEmpty()
        || $purchaseReturnNos->isNotEmpty()
        || $saleReturnNos->isNotEmpty();

    if ($hasRefs) {
        // Helper to pretty print with cap and “+N more”
        $fmt = function ($label, $coll) use ($capPerType) {
            if ($coll->isEmpty()) return null;
            $shown = $coll->take($capPerType)->all();
            $more  = max(0, $coll->count() - $capPerType);
            $base  = $label.': '.implode(', ', array_map('strval', $shown));
            return $more > 0 ? $base.' +'.$more.' more' : $base;
        };

        $parts = array_filter([
            $fmt('Purchase Invoices', $purchaseInvoiceNos),
            $fmt('Sale Invoices', $saleInvoiceNos),
            $fmt('Purchase Returns', $purchaseReturnNos),
            $fmt('Sale Returns', $saleReturnNos),
        ]);

        // One clean message so your frontend toast shows everything nicely
        $message = 'Product cannot be deleted because it exists in the following documents. '
                 . implode(' | ', $parts);

        return response()->json(['message' => $message], 422);
    }

    // If we reach here, safe to remove file and delete record
    if ($product->image) {
        Storage::disk('public')->delete($product->image);
    }

    $product->delete();

    return response()->json(['message' => 'Product deleted']);
}


    public function bulkUpdateMeta(Request $request)
{
    $validated = $request->validate([
        'product_ids'   => 'required|array|min:1',
        'product_ids.*' => 'integer|exists:products,id',
        'category_id'   => 'nullable|integer|exists:categories,id',
        'brand_id'      => 'nullable|integer|exists:brands,id',
        'supplier_id'   => 'nullable|integer|exists:suppliers,id',
    ]);

    $updates = array_filter([
        'category_id' => $validated['category_id'] ?? null,
        'brand_id'    => $validated['brand_id'] ?? null,
        'supplier_id' => $validated['supplier_id'] ?? null,
    ], fn($v) => !is_null($v));

    if (empty($updates)) {
        return response()->json([
            'message' => 'Provide at least one of category_id, brand_id, supplier_id to update.'
        ], 422);
    }

    $count = \App\Models\Product::whereIn('id', $validated['product_ids'])->update($updates);

    return response()->json([
        'updated'    => $count,
        'updates'    => $updates,
        'product_ids'=> $validated['product_ids'],
    ]);
}

public function export(): StreamedResponse
{
    $file = 'products_'.now()->format('Y-m-d_H-i-s').'.csv';

    return response()->streamDownload(function () {
        $out = fopen('php://output', 'w');
        // UTF-8 BOM for Excel
        fprintf($out, chr(0xEF).chr(0xBB).chr(0xBF));

        // Header
        fputcsv($out, [
            'product_code','name','pack_size','unit_purchase_price','unit_sale_price',
            'pack_purchase_price','pack_sale_price','avg_price','margin','quantity',
            'category','brand','supplier','barcode','narcotic','max_discount','formulation','description','rack'
        ]);

        Product::with(['category:id,name','brand:id,name','supplier:id,name'])
            ->orderBy('id')
            ->chunk(1000, function ($chunk) use ($out) {
                foreach ($chunk as $p) {
                    fputcsv($out, [
                        (string)($p->product_code ?? ''),
                        (string)($p->name ?? ''),
                        (int)($p->pack_size ?? 0),
                        (string)($p->unit_purchase_price ?? ''),
                        (string)($p->unit_sale_price ?? ''),
                        (string)($p->pack_purchase_price ?? ''),
                        (string)($p->pack_sale_price ?? ''),
                        (string)($p->avg_price ?? ''),
                        (string)($p->margin ?? ''),
                        (int)($p->quantity ?? 0),
                        (string)($p->category->name ?? ''),
                        (string)($p->brand->name ?? ''),
                        (string)($p->supplier->name ?? ''),
                        (string)($p->barcode ?? ''),
                        (string)($p->narcotic ?? 'no'),
                        (string)($p->max_discount ?? ''),
                        (string)($p->formulation ?? ''),
                        (string)($p->description ?? ''),
                        (string)($p->rack ?? ''),
                    ]);
                }
            });

        fclose($out);
    }, $file, ['Content-Type' => 'text/csv; charset=UTF-8']);
}

}
