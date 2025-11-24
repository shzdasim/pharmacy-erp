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
        $this->authorize('viewAny', Product::class);

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
                $pattern = $q.'%'; // starts-with
                $b->where('name', 'like', $pattern)
                  ->orWhere('product_code', 'like', $pattern)
                  ->orWhere('barcode', 'like', $pattern);
            });
        }

        return response()->json($query->limit($limit)->get());
    }

    public function generateNewCode()
    {
        $this->authorize('create', Product::class);
        $lastProduct = Product::orderBy('id', 'desc')->first();

        if ($lastProduct && preg_match('/PRD-(\d+)/', $lastProduct->product_code, $matches)) {
            $lastCodeNum = (int) $matches[1];
            $newCodeNum = $lastCodeNum + 1;
        } else {
            $newCodeNum = 1;
        }

        $formattedProductCode = 'PRD-' . str_pad($newCodeNum, 4, '0', STR_PAD_LEFT);
        $barcode = 'PRD' . str_pad((string) random_int(0, 9999999999), 10, '0', STR_PAD_LEFT);

        return response()->json([
            'product_code' => $formattedProductCode,
            'barcode' => $barcode,
        ]);
    }

    public function availableQuantity(Request $request)
    {
        $this->authorize('viewAny', Product::class);
        $productId = $request->query('product_id');
        $batch     = $request->query('batch');

        if (!$productId) {
            return response()->json(['message' => 'product_id is required'], 422);
        }

        $available = 0;

        if ($batch) {
            $record = \App\Models\Batch::where('product_id', $productId)
                ->where('batch_number', $batch)
                ->first();
            $available = (int) ($record->quantity ?? 0);
        } else {
            $product = \App\Models\Product::find($productId);
            $available = (int) ($product->quantity ?? 0);
        }

        return response()->json([
            'product_id'      => (int) $productId,
            'batch'           => $batch,
            'available_units' => $available,
        ]);
    }

    public function index(Request $req)
    {
        $this->authorize('viewAny', Product::class);
        $perPage = max(1, min((int)$req->input('per_page', 25), 100));

        $qName     = trim((string)$req->input('q_name', ''));
        $qBrand    = trim((string)$req->input('q_brand', ''));
        $qSupplier = trim((string)$req->input('q_supplier', ''));

        $q = Product::query()
            ->select([
                'id','product_code','name','image',
                'category_id','brand_id','supplier_id',
                'quantity',
            ])
            ->with([
                'category:id,name',
                'brand:id,name',
                'supplier:id,name',
            ])
            ->withCount('batches');

        // 🔍 Prefix-only matching for name, brand, and supplier
        if ($qName !== '') {
            $q->where('name', 'like', $qName.'%');
        }
        if ($qBrand !== '') {
            $q->whereHas('brand', fn(Builder $b) => $b->where('name', 'like', $qBrand.'%'));
        }
        if ($qSupplier !== '') {
            $q->whereHas('supplier', fn(Builder $s) => $s->where('name', 'like', $qSupplier.'%'));
        }

        $q->orderByDesc('id');
        $page = $q->paginate($perPage);

        return response()->json($page);
    }

    public function store(Request $request)
    {
        $this->authorize('create', Product::class);
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

    public function show($id)
    {
        $product = Product::with(['brand','category','supplier'])->findOrFail($id);
        $this->authorize('view', $product);
        return response()->json($product);
    }

    public function update(Request $request, $id)
    {
        $product = Product::findOrFail($id);
        $this->authorize('update', $product);
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
            if ($product->image) {
                Storage::disk('public')->delete($product->image);
            }
            $path = $request->file('image')->store('products', 'public');
            $validated['image'] = $path;
        }
        $product->update($validated);

        return response()->json($product);
    }

    public function destroy($id)
    {
        $product = Product::findOrFail($id);
        $this->authorize('delete', $product);
        if (($product->quantity ?? 0) > 0) {
            return response()->json(['message' => 'Cannot delete: product has on-hand quantity.'], 422);
        }
        if ($product->batches()->exists()) {
            return response()->json(['message' => 'Cannot delete: product has batch records.'], 422);
        }

        $capPerType = 8;

        $purchaseInvoiceNos = PurchaseInvoiceItem::where('product_id', $product->id)
            ->join('purchase_invoices', 'purchase_invoices.id', '=', 'purchase_invoice_items.purchase_invoice_id')
            ->pluck('purchase_invoices.posted_number', 'purchase_invoices.id')
            ->map(fn($num, $id) => $num ?: $id)
            ->values()
            ->unique();

        $saleInvoiceNos = SaleInvoiceItem::where('product_id', $product->id)
            ->join('sale_invoices', 'sale_invoices.id', '=', 'sale_invoice_items.sale_invoice_id')
            ->pluck('sale_invoices.posted_number', 'sale_invoices.id')
            ->map(fn($num, $id) => $num ?: $id)
            ->values()
            ->unique();

        $purchaseReturnNos = PurchaseReturnItem::where('product_id', $product->id)
            ->join('purchase_returns', 'purchase_returns.id', '=', 'purchase_return_items.purchase_return_id')
            ->pluck('purchase_returns.posted_number', 'purchase_returns.id')
            ->map(fn($num, $id) => $num ?: $id)
            ->values()
            ->unique();

        $saleReturnNos = SaleReturnItem::where('product_id', $product->id)
            ->join('sale_returns', 'sale_returns.id', '=', 'sale_return_items.sale_return_id')
            ->pluck('sale_returns.posted_number', 'sale_returns.id')
            ->map(fn($num, $id) => $num ?: $id)
            ->values()
            ->unique();

        $hasRefs = $purchaseInvoiceNos->isNotEmpty()
            || $saleInvoiceNos->isNotEmpty()
            || $purchaseReturnNos->isNotEmpty()
            || $saleReturnNos->isNotEmpty();

        if ($hasRefs) {
            $fmt = function ($label, $coll) use ($capPerType) {
                if ($coll->isEmpty()) return null;
                $shown = $coll->take($capPerType)->all();
                $more  = max(0, $coll->count() - $capPerType);
                $base  = $label.': '.implode(', ', array_map('strval', $shown));
                return $more > 0 ? $base.' +'.$more.' more' : $base;
            };

            $parts = array_filter([
                $fmt('Purchase Invoices', $purchaseInvoiceNos),
                $fmt('Sale Invoices',     $saleInvoiceNos),
                $fmt('Purchase Returns',  $purchaseReturnNos),
                $fmt('Sale Returns',      $saleReturnNos),
            ]);

            return response()->json([
                'message' => 'Product cannot be deleted because it exists in the following documents. ' . implode(' | ', $parts)
            ], 422);
        }

        if ($product->image) {
            Storage::disk('public')->delete($product->image);
        }
        $product->delete();

        return response()->json(['message' => 'Product deleted']);
    }

    // NEW: Bulk destroy with same checks as single delete
    public function bulkDestroy(Request $request)
    {
        $this->authorize('delete', Product::class);

        $validated = $request->validate([
            'product_ids'   => 'required|array|min:1',
            'product_ids.*' => 'integer|exists:products,id',
        ]);

        $ids = $validated['product_ids'];

        $deleted = 0;
        $failed  = [];

        $capPerType = 8;

        foreach ($ids as $id) {
            $product = Product::find($id);
            if (!$product) {
                $failed[] = ['id' => $id, 'name' => null, 'reason' => 'Not found'];
                continue;
            }
            $this->authorize('delete', $product);

            if (($product->quantity ?? 0) > 0) {
                $failed[] = ['id' => $id, 'name' => $product->name, 'reason' => 'Has on-hand quantity'];
                continue;
            }
            if ($product->batches()->exists()) {
                $failed[] = ['id' => $id, 'name' => $product->name, 'reason' => 'Has batch records'];
                continue;
            }

            $purchaseInvoiceNos = PurchaseInvoiceItem::where('product_id', $product->id)
                ->join('purchase_invoices', 'purchase_invoices.id', '=', 'purchase_invoice_items.purchase_invoice_id')
                ->pluck('purchase_invoices.posted_number', 'purchase_invoices.id')
                ->map(fn($num, $pid) => $num ?: $pid)->values()->unique();

            $saleInvoiceNos = SaleInvoiceItem::where('product_id', $product->id)
                ->join('sale_invoices', 'sale_invoices.id', '=', 'sale_invoice_items.sale_invoice_id')
                ->pluck('sale_invoices.posted_number', 'sale_invoices.id')
                ->map(fn($num, $sid) => $num ?: $sid)->values()->unique();

            $purchaseReturnNos = PurchaseReturnItem::where('product_id', $product->id)
                ->join('purchase_returns', 'purchase_returns.id', '=', 'purchase_return_items.purchase_return_id')
                ->pluck('purchase_returns.posted_number', 'purchase_returns.id')
                ->map(fn($num, $rid) => $num ?: $rid)->values()->unique();

            $saleReturnNos = SaleReturnItem::where('product_id', $product->id)
                ->join('sale_returns', 'sale_returns.id', '=', 'sale_return_items.sale_return_id')
                ->pluck('sale_returns.posted_number', 'sale_returns.id')
                ->map(fn($num, $rid) => $num ?: $rid)->values()->unique();

            $hasRefs = $purchaseInvoiceNos->isNotEmpty()
                || $saleInvoiceNos->isNotEmpty()
                || $purchaseReturnNos->isNotEmpty()
                || $saleReturnNos->isNotEmpty();

            if ($hasRefs) {
                $fmt = function ($label, $coll) use ($capPerType) {
                    if ($coll->isEmpty()) return null;
                    $shown = $coll->take($capPerType)->all();
                    $more  = max(0, $coll->count() - $capPerType);
                    $base  = $label.': '.implode(' | ', array_map('strval', $shown));
                    return $more > 0 ? $base.' +'.$more.' more' : $base;
                };

                $parts = array_filter([
                    $fmt('Purchase Invoices', $purchaseInvoiceNos),
                    $fmt('Sale Invoices',     $saleInvoiceNos),
                    $fmt('Purchase Returns',  $purchaseReturnNos),
                    $fmt('Sale Returns',      $saleReturnNos),
                ]);

                $failed[] = [
                    'id' => $id,
                    'name' => $product->name,
                    'reason' => 'Exists in: '.implode(' | ', $parts),
                ];
                continue;
            }

            if ($product->image) {
                Storage::disk('public')->delete($product->image);
            }
            $product->delete();
            $deleted++;
        }

        return response()->json([
            'deleted' => $deleted,
            'failed'  => $failed,
        ]);
    }

    public function bulkUpdateMeta(Request $request)
    {
        $this->authorize('bulkUpdate', Product::class);
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

        $count = Product::whereIn('id', $validated['product_ids'])->update($updates);

        return response()->json([
            'updated'    => $count,
            'updates'    => $updates,
            'product_ids'=> $validated['product_ids'],
        ]);
    }

    public function export(): StreamedResponse
    {
        $this->authorize('export', Product::class);
        $file = 'products_'.now()->format('Y-m-d_H-i-s').'.csv';

        return response()->streamDownload(function () {
            $out = fopen('php://output', 'w');
            fprintf($out, chr(0xEF).chr(0xBB).chr(0xBF));

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
