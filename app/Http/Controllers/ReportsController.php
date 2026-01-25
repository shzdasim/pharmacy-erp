<?php

namespace App\Http\Controllers;

use App\Authorizables\CostOfSaleReport;
use App\Authorizables\CurrentStockReport;
use App\Authorizables\ProductComprehensiveReport;
use App\Authorizables\PurchaseDetailReport;
use App\Authorizables\SaleDetailReport;
use App\Authorizables\StockAdjustmentReport;
use App\Models\Product;
use App\Models\PurchaseInvoice;
use App\Models\SaleInvoice;
use App\Models\StockAdjustment;
use App\Models\StockAdjustmentItem;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class ReportsController extends Controller
{
    /**
     * GET /api/reports/cost-of-sale?from=YYYY-MM-DD&to=YYYY-MM-DD&invoice_type=credit|debit|all
     * Returns rows: sale_date, gross_sale, item_discount, discount_amount, tax_amount,
     * total_sales, sale_return, cost_of_sales
     *
     * Frontend then derives:
     * net_sale   = total_sales - sale_return
     * gp_amount  = net_sale - cost_of_sales
     * gp_pct     = (gp_amount / net_sale) * 100
     */
    public function costOfSale(Request $req)
    {
        $this->authorize('view', CostOfSaleReport::class);
        try {
            $from = $req->query('from');
            $to   = $req->query('to');
            $invoiceType = $req->query('invoice_type', 'all'); // all, credit, or debit

            // Defaults: current month
            $fromDate = $from ? Carbon::parse($from)->startOfDay() : Carbon::now()->startOfMonth();
            $toDate   = $to   ? Carbon::parse($to)->endOfDay()   : Carbon::now()->endOfDay();
            if ($fromDate->gt($toDate)) {
                [$fromDate, $toDate] = [$toDate->copy()->startOfDay(), $fromDate->copy()->endOfDay()];
            }

            // Validate invoice_type
            $validInvoiceTypes = ['all', 'credit', 'debit'];
            if (!in_array($invoiceType, $validInvoiceTypes)) {
                $invoiceType = 'all';
            }

            // Build base query for sale_invoices
            $saleQuery = DB::table('sale_invoices as si')
                ->whereBetween('si.date', [$fromDate, $toDate]);

            // Apply invoice_type filter if not 'all'
            if ($invoiceType !== 'all') {
                $saleQuery->where('si.invoice_type', $invoiceType);
            }

            // ===== Sales header sums (per day) =====
            // sale_invoices has: date, gross_amount, item_discount, discount_amount, tax_amount, total
            $sales = $saleQuery
                ->selectRaw('DATE(si.date) as sale_date')
                ->selectRaw('SUM(COALESCE(si.gross_amount, 0))      as gross_sale')
                ->selectRaw('SUM(COALESCE(si.item_discount, 0))     as item_discount')
                ->selectRaw('SUM(COALESCE(si.discount_amount, 0))   as discount_amount')
                ->selectRaw('SUM(COALESCE(si.tax_amount, 0))        as tax_amount')
                ->selectRaw('SUM(COALESCE(si.total, 0))             as total_sales')
                ->groupBy('sale_date')
                ->get()
                ->keyBy('sale_date');

            // ===== Sale returns header sums (per day) =====
            // sale_returns has: date, total (also gross_total but we need total for NetSale)
            // Note: Sale returns are not filtered by invoice_type as they are always linked to original invoices
            $returns = DB::table('sale_returns as sr')
                ->whereBetween('sr.date', [$fromDate, $toDate])
                ->selectRaw('DATE(sr.date) as sale_date')
                ->selectRaw('SUM(COALESCE(sr.total, 0)) as sale_return')
                ->groupBy('sale_date')
                ->get()
                ->keyBy('sale_date');

            // Build base query for COGS (sale_invoice_items joined with sale_invoices)
            $cogsQuery = DB::table('sale_invoice_items as sii')
                ->join('sale_invoices as si', 'si.id', '=', 'sii.sale_invoice_id')
                ->join('products as p', 'p.id', '=', 'sii.product_id')
                ->whereBetween('si.date', [$fromDate, $toDate]);

            // Apply invoice_type filter if not 'all'
            if ($invoiceType !== 'all') {
                $cogsQuery->where('si.invoice_type', $invoiceType);
            }

            // ===== COGS on sales (per day) =====
            // Approximate cost using products.avg_price * sale_invoice_items.quantity
            $cogsSales = $cogsQuery
                ->selectRaw('DATE(si.date) as sale_date')
                ->selectRaw('SUM(COALESCE(sii.quantity, 0) * COALESCE(p.avg_price, 0)) as cogs_sales')
                ->groupBy('sale_date')
                ->get()
                ->keyBy('sale_date');

            // ===== COGS reversed on returns (per day) =====
            // Note: Returns are not filtered by invoice_type as they relate to original sale invoices
            $cogsReturns = DB::table('sale_return_items as sri')
                ->join('sale_returns as sr', 'sr.id', '=', 'sri.sale_return_id')
                ->join('products as p', 'p.id', '=', 'sri.product_id')
                ->whereBetween('sr.date', [$fromDate, $toDate])
                ->selectRaw('DATE(sr.date) as sale_date')
                ->selectRaw('SUM(COALESCE(sri.unit_return_quantity, 0) * COALESCE(p.avg_price, 0)) as cogs_returns')
                ->groupBy('sale_date')
                ->get()
                ->keyBy('sale_date');

            // ===== Merge all days =====
            $allDates = collect(array_unique(array_merge(
                $sales->keys()->all(),
                $returns->keys()->all(),
                $cogsSales->keys()->all(),
                $cogsReturns->keys()->all(),
            )))->sort();

            $rows = [];
            foreach ($allDates as $d) {
                $s  = $sales->get($d);
                $r  = $returns->get($d);
                $cs = $cogsSales->get($d);
                $cr = $cogsReturns->get($d);

                $rows[] = [
                    'sale_date'       => $d,
                    'gross_sale'      => round(($s->gross_sale ?? 0), 2),
                    'item_discount'   => round(($s->item_discount ?? 0), 2),
                    'discount_amount' => round(($s->discount_amount ?? 0), 2),  // Flat discount
                    'tax_amount'      => round(($s->tax_amount ?? 0), 2),
                    'total_sales'     => round(($s->total_sales ?? 0), 2),
                    'sale_return'     => round(($r->sale_return ?? 0), 2),
                    // Cost of Sales = cost on sales - cost reversed by returns
                    'cost_of_sales'   => round((($cs->cogs_sales ?? 0) - ($cr->cogs_returns ?? 0)), 2),
                ];
            }

            return response()->json($rows);
        } catch (\Throwable $e) {
            // Helpful error for debugging in dev
            return response()->json([
                'message' => 'Failed to build Cost of Sale report',
                'error'   => $e->getMessage(),
                'trace'   => config('app.debug') ? $e->getTrace() : null,
            ], 500);
        }
    }

    public function purchaseDetail(Request $req)
    {
        $this->authorize('view', PurchaseDetailReport::class);
        $from = $req->query('from');
        $to   = $req->query('to');
        $supplierId = $req->query('supplier_id');
        $productId  = $req->query('product_id');

        // Defaults to current month if not provided
        try { $fromDate = $from ? Carbon::parse($from)->startOfDay() : Carbon::now()->startOfMonth(); }
        catch (\Throwable $e) { $fromDate = Carbon::now()->startOfMonth(); }
        try { $toDate = $to ? Carbon::parse($to)->endOfDay() : Carbon::now()->endOfDay(); }
        catch (\Throwable $e) { $toDate = Carbon::now()->endOfDay(); }
        if ($fromDate->gt($toDate)) {
            [$fromDate, $toDate] = [$toDate->copy()->startOfDay(), $fromDate->copy()->endOfDay()];
        }

        $invoices = PurchaseInvoice::with([
                'supplier:id,name',
                'items' => function ($q) use ($productId) {
                    if ($productId) $q->where('product_id', $productId);
                    $q->with('product:id,name')
                      ->select([
                          'id','purchase_invoice_id','product_id',
                          'batch','expiry',
                          'pack_quantity','pack_size','unit_quantity',
                          'pack_purchase_price','unit_purchase_price',
                          'pack_sale_price','unit_sale_price',
                          'pack_bonus','unit_bonus',
                          'item_discount_percentage','margin',
                          'sub_total','quantity',
                      ]);
                },
            ])
            // IMPORTANT: filter by posted_date (not date)
            ->whereBetween('posted_date', [$fromDate, $toDate])
            ->when($supplierId, fn($q) => $q->where('supplier_id', $supplierId))
            // If product filter is set, ensure we only include invoices that have that product
            ->when($productId, fn($q) => $q->whereHas('items', fn($iq) => $iq->where('product_id', $productId)))
            ->orderBy('posted_date', 'asc')
            ->orderBy('id', 'asc')
            ->get();

        $rows = $invoices->map(function ($inv) {
            return [
                'id'             => $inv->id,
                'supplier_id'    => $inv->supplier_id,
                'supplier_name'  => $inv->supplier->name ?? null,
                'posted_number'  => $inv->posted_number ?? null,
                'invoice_number' => $inv->invoice_number ?? null,
                'invoice_date'   => optional($inv->posted_date)->format('Y-m-d')
                                   ?? (is_string($inv->posted_date) ? substr($inv->posted_date,0,10) : null),

                // Footer (header) fields from PurchaseInvoice
                'tax_percentage'      => (float)($inv->tax_percentage ?? 0),
                'tax_amount'          => (float)($inv->tax_amount ?? 0),
                'discount_percentage' => (float)($inv->discount_percentage ?? 0),
                'discount_amount'     => (float)($inv->discount_amount ?? 0),
                'total_amount'        => (float)($inv->total_amount ?? ($inv->total ?? 0)),

                // Items
                'items' => ($inv->items ?? collect())->map(function ($it) {
                    return [
                        'id'                        => $it->id,
                        'product_id'                => $it->product_id,
                        'product_name'              => $it->product->name ?? null,
                        'batch'                     => $it->batch,
                        'expiry'                    => $it->expiry,
                        'pack_quantity'             => (int)($it->pack_quantity ?? 0),
                        'pack_size'                 => (int)($it->pack_size ?? 0),
                        'unit_quantity'             => (int)($it->unit_quantity ?? 0),
                        'pack_purchase_price'       => (float)($it->pack_purchase_price ?? 0),
                        'unit_purchase_price'       => (float)($it->unit_purchase_price ?? 0),
                        'pack_sale_price'           => (float)($it->pack_sale_price ?? 0),
                        'unit_sale_price'           => (float)($it->unit_sale_price ?? 0),
                        'pack_bonus'                => (int)($it->pack_bonus ?? 0),
                        'unit_bonus'                => (int)($it->unit_bonus ?? 0),
                        'item_discount_percentage'  => (float)($it->item_discount_percentage ?? 0),
                        'margin'                    => (float)($it->margin ?? 0),
                        'sub_total'                 => (float)($it->sub_total ?? 0),
                        'quantity'                  => (int)($it->quantity ?? 0),
                    ];
                })->values(),
            ];
        })->values();

        return response()->json($rows);
    }
    private function buildPurchaseDetailRows($from, $to, $supplierId, $productId)
    {
        try { $fromDate = $from ? Carbon::parse($from)->startOfDay() : Carbon::now()->startOfMonth(); }
        catch (\Throwable $e) { $fromDate = Carbon::now()->startOfMonth(); }
        try { $toDate = $to ? Carbon::parse($to)->endOfDay() : Carbon::now()->endOfDay(); }
        catch (\Throwable $e) { $toDate = Carbon::now()->endOfDay(); }
        if ($fromDate->gt($toDate)) {
            [$fromDate, $toDate] = [$toDate->copy()->startOfDay(), $fromDate->copy()->endOfDay()];
        }

        $invoices = PurchaseInvoice::with([
                'supplier:id,name',
                'items' => function ($q) use ($productId) {
                    if ($productId) $q->where('product_id', $productId);
                    $q->with('product:id,name')
                      ->select([
                          'id','purchase_invoice_id','product_id',
                          'batch','expiry',
                          'pack_quantity','pack_size','unit_quantity',
                          'pack_purchase_price','unit_purchase_price',
                          'pack_sale_price','unit_sale_price',
                          'pack_bonus','unit_bonus',
                          'item_discount_percentage','margin',
                          'sub_total','quantity',
                      ]);
                },
            ])
            ->whereBetween('posted_date', [$fromDate, $toDate])
            ->when($supplierId, fn($q) => $q->where('supplier_id', $supplierId))
            ->when($productId, fn($q) => $q->whereHas('items', fn($iq) => $iq->where('product_id', $productId)))
            ->orderBy('posted_date', 'asc')
            ->orderBy('id', 'asc')
            ->get();

        return $invoices->map(function ($inv) {
            return [
                'id'                 => $inv->id,
                'supplier_name'      => $inv->supplier->name ?? null,
                'posted_number'      => $inv->posted_number ?? null,
                'invoice_number'     => $inv->invoice_number ?? null,
                'invoice_date'       => optional($inv->posted_date)->format('Y-m-d')
                                        ?? (is_string($inv->posted_date) ? substr($inv->posted_date,0,10) : null),
                'tax_percentage'      => (float)($inv->tax_percentage ?? 0),
                'tax_amount'          => (float)($inv->tax_amount ?? 0),
                'discount_percentage' => (float)($inv->discount_percentage ?? 0),
                'discount_amount'     => (float)($inv->discount_amount ?? 0),
                'total_amount'        => (float)($inv->total_amount ?? ($inv->total ?? 0)),
                'items' => ($inv->items ?? collect())->map(function ($it) {
                    return [
                        'product_name'             => $it->product->name ?? null,
                        'batch'                    => $it->batch,
                        'expiry'                   => $it->expiry,
                        'pack_quantity'            => (int)($it->pack_quantity ?? 0),
                        'pack_size'                => (int)($it->pack_size ?? 0),
                        'unit_quantity'            => (int)($it->unit_quantity ?? 0),
                        'pack_purchase_price'      => (float)($it->pack_purchase_price ?? 0),
                        'unit_purchase_price'      => (float)($it->unit_purchase_price ?? 0),
                        'pack_sale_price'          => (float)($it->pack_sale_price ?? 0),
                        'unit_sale_price'          => (float)($it->unit_sale_price ?? 0),
                        'pack_bonus'               => (int)($it->pack_bonus ?? 0),
                        'unit_bonus'               => (int)($it->unit_bonus ?? 0),
                        'item_discount_percentage' => (float)($it->item_discount_percentage ?? 0),
                        'margin'                   => (float)($it->margin ?? 0),
                        'sub_total'                => (float)($it->sub_total ?? 0),
                        'quantity'                 => (int)($it->quantity ?? 0),
                    ];
                })->values(),
            ];
        })->values();
    }

    /** GET /api/reports/purchase-detail/pdf */
    public function purchaseDetailPdf(Request $req)
    {
        $this->authorize('export', PurchaseDetailReport::class);
        $rows = $this->buildPurchaseDetailRows(
            $req->query('from'),
            $req->query('to'),
            $req->query('supplier_id'),
            $req->query('product_id'),
        );

        $meta = [
            'from'        => $req->query('from'),
            'to'          => $req->query('to'),
            'generatedAt' => now()->format('Y-m-d H:i'),
        ];

        $pdf = Pdf::loadView('reports.purchase_detail_pdf', [
            'rows' => $rows,
            'meta' => $meta,
        ])->setPaper('a4', 'landscape'); // wide tables fit better

        $filename = 'purchase-detail-' . ($meta['from'] ?: 'start') . '-to-' . ($meta['to'] ?: 'today') . '.pdf';
        return $pdf->stream($filename); // 'inline' disposition -> opens in new tab
    }

    /** GET /api/reports/sale-detail */
    public function saleDetail(Request $req)
    {
        $this->authorize('view', SaleDetailReport::class); 
        $from = $req->query('from');
        $to   = $req->query('to');
        $customerId = $req->query('customer_id');
        $productId  = $req->query('product_id');

        try { $fromDate = $from ? Carbon::parse($from)->startOfDay() : Carbon::now()->startOfMonth(); }
        catch (\Throwable $e) { $fromDate = Carbon::now()->startOfMonth(); }
        try { $toDate = $to ? Carbon::parse($to)->endOfDay() : Carbon::now()->endOfDay(); }
        catch (\Throwable $e) { $toDate = Carbon::now()->endOfDay(); }
        if ($fromDate->gt($toDate)) {
            [$fromDate, $toDate] = [$toDate->copy()->startOfDay(), $fromDate->copy()->endOfDay()];
        }

        $invoices = SaleInvoice::with([
                'customer:id,name',
                'user:id,name',
                'items' => function ($q) use ($productId) {
                    if ($productId) $q->where('product_id', $productId);
                    $q->with('product:id,name')
                      ->select([
                          'id','sale_invoice_id','product_id',
                          'pack_size','batch_number','expiry',
                          'current_quantity','quantity','price',
                          'item_discount_percentage','sub_total',
                      ]);
                },
            ])
            // Sales filter by `date`
            ->whereBetween('date', [$fromDate, $toDate])
            ->when($customerId, fn($q) => $q->where('customer_id', $customerId))
            ->when($productId, fn($q) => $q->whereHas('items', fn($iq) => $iq->where('product_id', $productId)))
            ->orderBy('date', 'asc')
            ->orderBy('id', 'asc')
            ->get();

        $rows = $invoices->map(function ($inv) {
            return [
                'id'             => $inv->id,
                'posted_number'  => $inv->posted_number ?? null,
                'invoice_date'   => optional($inv->date)->format('Y-m-d')
                                    ?? (is_string($inv->date) ? substr($inv->date,0,10) : null),
                'customer_name'  => $inv->customer->name ?? null,
                'user_name'      => $inv->user->name ?? null,
                'doctor_name'    => $inv->doctor_name ?? null,
                'patient_name'   => $inv->patient_name ?? null,

                // Footer (header totals on SaleInvoice)
                'discount_percentage' => (float)($inv->discount_percentage ?? 0),
                'discount_amount'     => (float)($inv->discount_amount ?? 0),
                'tax_percentage'      => (float)($inv->tax_percentage ?? 0),
                'tax_amount'          => (float)($inv->tax_amount ?? 0),
                'item_discount'       => (float)($inv->item_discount ?? 0),
                'gross_amount'        => (float)($inv->gross_amount ?? 0),
                'total'               => (float)($inv->total ?? 0),

                // Items
                'items' => ($inv->items ?? collect())->map(function ($it) {
                    return [
                        'id'                        => $it->id,
                        'product_id'                => $it->product_id,
                        'product_name'              => $it->product->name ?? null,
                        'pack_size'                 => (int)($it->pack_size ?? 0),
                        'batch_number'              => $it->batch_number,
                        'expiry'                    => $it->expiry,
                        'current_quantity'          => (int)($it->current_quantity ?? 0),
                        'quantity'                  => (int)($it->quantity ?? 0),
                        'price'                     => (float)($it->price ?? 0),
                        'item_discount_percentage'  => (float)($it->item_discount_percentage ?? 0),
                        'sub_total'                 => (float)($it->sub_total ?? 0),
                    ];
                })->values(),
            ];
        })->values();

        return response()->json($rows);
    }

    private function buildSaleDetailRows($from, $to, $customerId, $productId)
    {
        try { $fromDate = $from ? Carbon::parse($from)->startOfDay() : Carbon::now()->startOfMonth(); }
        catch (\Throwable $e) { $fromDate = Carbon::now()->startOfMonth(); }
        try { $toDate = $to ? Carbon::parse($to)->endOfDay() : Carbon::now()->endOfDay(); }
        catch (\Throwable $e) { $toDate = Carbon::now()->endOfDay(); }
        if ($fromDate->gt($toDate)) {
            [$fromDate, $toDate] = [$toDate->copy()->startOfDay(), $fromDate->copy()->endOfDay()];
        }

        $invoices = SaleInvoice::with([
                'customer:id,name',
                'user:id,name',
                'items' => function ($q) use ($productId) {
                    if ($productId) $q->where('product_id', $productId);
                    $q->with('product:id,name')
                      ->select([
                          'id','sale_invoice_id','product_id',
                          'pack_size','batch_number','expiry',
                          'current_quantity','quantity','price',
                          'item_discount_percentage','sub_total',
                      ]);
                },
            ])
            ->whereBetween('date', [$fromDate, $toDate])
            ->when($customerId, fn($q) => $q->where('customer_id', $customerId))
            ->when($productId, fn($q) => $q->whereHas('items', fn($iq) => $iq->where('product_id', $productId)))
            ->orderBy('date', 'asc')
            ->orderBy('id', 'asc')
            ->get();

        return $invoices->map(function ($inv) {
            return [
                'posted_number'       => $inv->posted_number ?? null,
                'invoice_date'        => optional($inv->date)->format('Y-m-d')
                                         ?? (is_string($inv->date) ? substr($inv->date,0,10) : null),
                'customer_name'       => $inv->customer->name ?? null,
                'user_name'           => $inv->user->name ?? null,
                'doctor_name'         => $inv->doctor_name ?? null,
                'patient_name'        => $inv->patient_name ?? null,
                'discount_percentage' => (float)($inv->discount_percentage ?? 0),
                'discount_amount'     => (float)($inv->discount_amount ?? 0),
                'tax_percentage'      => (float)($inv->tax_percentage ?? 0),
                'tax_amount'          => (float)($inv->tax_amount ?? 0),
                'item_discount'       => (float)($inv->item_discount ?? 0),
                'gross_amount'        => (float)($inv->gross_amount ?? 0),
                'total'               => (float)($inv->total ?? 0),
                'items' => ($inv->items ?? collect())->map(function ($it) {
                    return [
                        'product_name'             => $it->product->name ?? null,
                        'pack_size'                => (int)($it->pack_size ?? 0),
                        'batch_number'             => $it->batch_number,
                        'expiry'                   => $it->expiry,
                        'current_quantity'         => (int)($it->current_quantity ?? 0),
                        'quantity'                 => (int)($it->quantity ?? 0),
                        'price'                    => (float)($it->price ?? 0),
                        'item_discount_percentage' => (float)($it->item_discount_percentage ?? 0),
                        'sub_total'                => (float)($it->sub_total ?? 0),
                    ];
                })->values(),
            ];
        })->values();
    }

    /** GET /api/reports/sale-detail/pdf */
    public function saleDetailPdf(Request $req)
    {
        $this->authorize('export', SaleDetailReport::class);
        $rows = $this->buildSaleDetailRows(
            $req->query('from'),
            $req->query('to'),
            $req->query('customer_id'),
            $req->query('product_id'),
        );

        $meta = [
            'from'        => $req->query('from'),
            'to'          => $req->query('to'),
            'generatedAt' => now()->format('Y-m-d H:i'),
        ];

        $pdf = Pdf::loadView('reports.sale_detail_pdf', [
            'rows' => $rows,
            'meta' => $meta,
        ])->setPaper('a4', 'landscape');

        $filename = 'sale-detail-' . ($meta['from'] ?: 'start') . '-to-' . ($meta['to'] ?: 'today') . '.pdf';
        return $pdf->stream($filename);
    }

    /**
     * GET /api/reports/current-stock
     * Returns products with quantity > 0 (one row per product)
     * Includes: name, pack_size, quantity, pack_purchase_price, pack_sale_price
     * Also returns summary totals at the bottom
     */
    public function currentStock(Request $req)
    {
        $this->authorize('view', CurrentStockReport::class);

        $categoryId = $req->query('category_id');
        $brandId = $req->query('brand_id');
        $supplierId = $req->query('supplier_id');

        // Build query for all products (filtering done client-side for transparency)
        $products = Product::with(['category:id,name', 'brand:id,name', 'supplier:id,name'])
            ->when($categoryId, fn($q) => $q->where('category_id', $categoryId))
            ->when($brandId, fn($q) => $q->where('brand_id', $brandId))
            ->when($supplierId, fn($q) => $q->where('supplier_id', $supplierId))
            ->orderBy('name', 'asc')
            ->get();

        // Filter products with quantity > 0 client-side for display
        $products = $products->filter(fn($p) => (int)($p->quantity ?? 0) > 0);

        // Transform data for frontend
        $rows = $products->map(function ($p) {
            $quantity = (int)($p->quantity ?? 0);
            $packSize = (int)($p->pack_size ?? 1);
            $packPurchasePrice = (float)($p->pack_purchase_price ?? 0);
            $packSalePrice = (float)($p->pack_sale_price ?? 0);
            $unitPurchasePrice = (float)($p->unit_purchase_price ?? 0);
            $unitSalePrice = (float)($p->unit_sale_price ?? 0);
            $avgPrice = (float)($p->avg_price ?? 0);

            // Calculate values
            $totalPurchaseValue = $quantity * $avgPrice; // At average cost
            $totalSaleValue = $quantity * $unitSalePrice; // At retail price

            return [
                'id'                    => $p->id,
                'product_code'          => $p->product_code,
                'name'                  => $p->name,
                'category_name'         => $p->category->name ?? null,
                'brand_name'            => $p->brand->name ?? null,
                'supplier_name'         => $p->supplier->name ?? null,
                'pack_size'             => $packSize,
                'quantity'              => $quantity,
                'pack_purchase_price'   => $packPurchasePrice,
                'pack_sale_price'       => $packSalePrice,
                'unit_purchase_price'   => $unitPurchasePrice,
                'unit_sale_price'       => $unitSalePrice,
                'avg_price'             => $avgPrice,
                'rack'                  => $p->rack ?? null,
                // Calculated values for summary
                'total_purchase_value'  => round($totalPurchaseValue, 2),
                'total_sale_value'      => round($totalSaleValue, 2),
            ];
        })->values();

        // Calculate summary totals
        $summary = [
            'total_items'           => $rows->count(),
            'total_quantity'        => $rows->sum('quantity'),
            'total_purchase_value'  => round($rows->sum('total_purchase_value'), 2),
            'total_sale_value'      => round($rows->sum('total_sale_value'), 2),
            'potential_profit'      => round($rows->sum('total_sale_value') - $rows->sum('total_purchase_value'), 2),
        ];

        return response()->json([
            'rows'    => $rows,
            'summary' => $summary,
        ]);
    }

    /**
     * GET /api/reports/current-stock/pdf
     */
    public function currentStockPdf(Request $req)
    {
        // Increase memory and execution time limits for large reports
        ini_set('memory_limit', '2048M');
        set_time_limit(300); // 5 minutes timeout

        $this->authorize('export', CurrentStockReport::class);

        $categoryId = $req->query('category_id');
        $brandId = $req->query('brand_id');
        $supplierId = $req->query('supplier_id');

        // Build query for all products (filtering done for products with quantity > 0)
        $query = Product::with(['category:id,name', 'brand:id,name', 'supplier:id,name'])
            ->when($categoryId, fn($q) => $q->where('category_id', $categoryId))
            ->when($brandId, fn($q) => $q->where('brand_id', $brandId))
            ->when($supplierId, fn($q) => $q->where('supplier_id', $supplierId))
            ->orderBy('name', 'asc');

        // Use chunking for large datasets to reduce memory usage
        // Only include products with quantity > 0
        $rows = [];
        $totalQuantity = 0;
        $totalPurchaseValue = 0;
        $totalSaleValue = 0;
        $itemCount = 0;

        $query->chunk(500, function ($products) use (&$rows, &$totalQuantity, &$totalPurchaseValue, &$totalSaleValue, &$itemCount) {
            foreach ($products as $p) {
                $quantity = (int)($p->quantity ?? 0);
                
                // Only include products with quantity > 0
                if ($quantity <= 0) continue;
                
                $packSize = (int)($p->pack_size ?? 1);
                $packPurchasePrice = (float)($p->pack_purchase_price ?? 0);
                $packSalePrice = (float)($p->pack_sale_price ?? 0);
                $avgPrice = (float)($p->avg_price ?? 0);
                $unitSalePrice = (float)($p->unit_sale_price ?? 0);

                $rowTotalPurchase = round($quantity * $avgPrice, 2);
                $rowTotalSale = round($quantity * $unitSalePrice, 2);

                $rows[] = [
                    'product_code'         => $p->product_code,
                    'name'                 => $p->name,
                    'pack_size'            => $packSize,
                    'quantity'             => $quantity,
                    'pack_purchase_price'  => $packPurchasePrice,
                    'pack_sale_price'      => $packSalePrice,
                    'avg_price'            => $avgPrice,
                    'total_purchase_value' => $rowTotalPurchase,
                    'total_sale_value'     => $rowTotalSale,
                ];

                $totalQuantity += $quantity;
                $totalPurchaseValue += $rowTotalPurchase;
                $totalSaleValue += $rowTotalSale;
                $itemCount++;
            }
        });

        $summary = [
            'total_items'          => $itemCount,
            'total_quantity'       => $totalQuantity,
            'total_purchase_value' => round($totalPurchaseValue, 2),
            'total_sale_value'     => round($totalSaleValue, 2),
            'potential_profit'     => round($totalSaleValue - $totalPurchaseValue, 2),
        ];

        $meta = [
            'generatedAt' => now()->format('Y-m-d H:i'),
            'category_id' => $categoryId,
            'brand_id'    => $brandId,
            'supplier_id' => $supplierId,
        ];

        $pdf = Pdf::loadView('reports.current_stock_pdf', [
            'rows'    => $rows,
            'summary' => $summary,
            'meta'    => $meta,
        ])->setPaper('a4', 'landscape');

        return $pdf->stream('current-stock-report.pdf');
    }

    /**
     * GET /api/reports/stock-adjustment
     * Returns stock adjustments with items for the given date range
     */
    public function stockAdjustment(Request $req)
    {
        $this->authorize('view', StockAdjustmentReport::class);

        $from = $req->query('from');
        $to   = $req->query('to');

        // Defaults: current month
        $fromDate = $from ? Carbon::parse($from)->startOfDay() : Carbon::now()->startOfMonth();
        $toDate   = $to   ? Carbon::parse($to)->endOfDay()   : Carbon::now()->endOfDay();
        if ($fromDate->gt($toDate)) {
            [$fromDate, $toDate] = [$toDate->copy()->startOfDay(), $fromDate->copy()->endOfDay()];
        }

        $adjustments = StockAdjustment::with([
                'user:id,name',
                'items' => function ($q) {
                    $q->with('product:id,name,product_code')
                      ->select([
                          'id','stock_adjustment_id','product_id',
                          'batch_number','expiry','pack_size',
                          'previous_qty','actual_qty','diff_qty',
                          'unit_purchase_price','worth_adjusted',
                      ]);
                },
            ])
            ->whereBetween('posted_date', [$fromDate, $toDate])
            ->orderBy('posted_date', 'asc')
            ->orderBy('id', 'asc')
            ->get();

        $rows = $adjustments->map(function ($adj) {
            return [
                'id'            => $adj->id,
                'posted_number' => $adj->posted_number ?? null,
                'posted_date'   => optional($adj->posted_date)->format('Y-m-d')
                                  ?? (is_string($adj->posted_date) ? substr($adj->posted_date,0,10) : null),
                'note'          => $adj->note ?? null,
                'total_worth'   => (float)($adj->total_worth ?? 0),
                'user_name'     => $adj->user->name ?? null,
                'items'         => ($adj->items ?? collect())->map(function ($item) {
                    return [
                        'id'                  => $item->id,
                        'product_id'          => $item->product_id,
                        'product_code'        => $item->product->product_code ?? null,
                        'product_name'        => $item->product->name ?? null,
                        'batch_number'        => $item->batch_number,
                        'expiry'              => $item->expiry ? $item->expiry->format('Y-m-d') : null,
                        'pack_size'            => (float)($item->pack_size ?? 0),
                        'previous_qty'         => (float)($item->previous_qty ?? 0),
                        'actual_qty'           => (float)($item->actual_qty ?? 0),
                        'diff_qty'             => (float)($item->diff_qty ?? 0),
                        'unit_purchase_price'  => (float)($item->unit_purchase_price ?? 0),
                        'worth_adjusted'       => (float)($item->worth_adjusted ?? 0),
                    ];
                })->values(),
            ];
        })->values();

        // Calculate summary totals
        $totalAdjustments = $rows->count();
        $totalItems = $rows->sum(fn($row) => count($row['items']));
        $totalWorthAdjusted = $rows->sum(fn($row) => $row['total_worth']);
        $positiveAdjustments = $rows->sum(fn($row) => collect($row['items'])->sum(fn($item) => $item['diff_qty'] > 0 ? $item['diff_qty'] : 0));
        $negativeAdjustments = $rows->sum(fn($row) => collect($row['items'])->sum(fn($item) => $item['diff_qty'] < 0 ? abs($item['diff_qty']) : 0));

        $summary = [
            'total_adjustments'    => $totalAdjustments,
            'total_items'          => $totalItems,
            'total_worth_adjusted' => round($totalWorthAdjusted, 2),
            'positive_adjustments' => round($positiveAdjustments, 3),
            'negative_adjustments' => round($negativeAdjustments, 3),
        ];

        return response()->json([
            'rows'    => $rows,
            'summary' => $summary,
        ]);
    }

    /**
     * GET /api/reports/stock-adjustment/pdf
     */
    public function stockAdjustmentPdf(Request $req)
    {
        $this->authorize('export', StockAdjustmentReport::class);

        $from = $req->query('from');
        $to   = $req->query('to');

        $fromDate = $from ? Carbon::parse($from)->startOfDay() : Carbon::now()->startOfMonth();
        $toDate   = $to   ? Carbon::parse($to)->endOfDay()   : Carbon::now()->endOfDay();
        if ($fromDate->gt($toDate)) {
            [$fromDate, $toDate] = [$toDate->copy()->startOfDay(), $fromDate->copy()->endOfDay()];
        }

        $adjustments = StockAdjustment::with([
                'user:id,name',
                'items' => function ($q) {
                    $q->with('product:id,name,product_code')
                      ->select([
                          'id','stock_adjustment_id','product_id',
                          'batch_number','expiry','pack_size',
                          'previous_qty','actual_qty','diff_qty',
                          'unit_purchase_price','worth_adjusted',
                      ]);
                },
            ])
            ->whereBetween('posted_date', [$fromDate, $toDate])
            ->orderBy('posted_date', 'asc')
            ->orderBy('id', 'asc')
            ->get();

        $rows = $adjustments->map(function ($adj) {
            return [
                'posted_number' => $adj->posted_number ?? null,
                'posted_date'   => optional($adj->posted_date)->format('Y-m-d')
                                  ?? (is_string($adj->posted_date) ? substr($adj->posted_date,0,10) : null),
                'note'          => $adj->note ?? null,
                'user_name'     => $adj->user->name ?? null,
                'total_worth'   => (float)($adj->total_worth ?? 0),
                'items'         => ($adj->items ?? collect())->map(function ($item) {
                    return [
                        'product_code'       => $item->product->product_code ?? null,
                        'product_name'       => $item->product->name ?? null,
                        'batch_number'       => $item->batch_number,
                        'expiry'             => $item->expiry ? $item->expiry->format('Y-m-d') : null,
                        'previous_qty'       => (float)($item->previous_qty ?? 0),
                        'actual_qty'         => (float)($item->actual_qty ?? 0),
                        'diff_qty'           => (float)($item->diff_qty ?? 0),
                        'unit_purchase_price'=> (float)($item->unit_purchase_price ?? 0),
                        'worth_adjusted'     => (float)($item->worth_adjusted ?? 0),
                    ];
                })->values(),
            ];
        })->values();

        $summary = [
            'total_adjustments'    => $rows->count(),
            'total_items'          => $rows->sum(fn($row) => count($row['items'])),
            'total_worth_adjusted' => round($rows->sum(fn($row) => $row['total_worth']), 2),
        ];

        $meta = [
            'from'        => $from,
            'to'          => $to,
            'generatedAt' => now()->format('Y-m-d H:i'),
        ];

        $pdf = Pdf::loadView('reports.stock_adjustment_pdf', [
            'rows'    => $rows,
            'summary' => $summary,
            'meta'    => $meta,
        ])->setPaper('a4', 'landscape');

        $filename = 'stock-adjustment-' . ($from ?: 'start') . '-to-' . ($to ?: 'today') . '.pdf';
        return $pdf->stream($filename);
    }

    /**
     * GET /api/reports/product-comprehensive
     * Returns a comprehensive report of purchase and sale history for a specific product
     */
    public function productComprehensive(Request $req)
    {
        $this->authorize('view', ProductComprehensiveReport::class);

        $from = $req->query('from');
        $to   = $req->query('to');
        $productId = $req->query('product_id');

        // Validate product_id
        if (!$productId) {
            return response()->json([
                'message' => 'Product ID is required',
            ], 400);
        }

        // Get product details
        $product = Product::find($productId);
        if (!$product) {
            return response()->json([
                'message' => 'Product not found',
            ], 404);
        }

        // Defaults: current month
        $fromDate = $from ? Carbon::parse($from)->startOfDay() : Carbon::now()->startOfMonth();
        $toDate   = $to   ? Carbon::parse($to)->endOfDay()   : Carbon::now()->endOfDay();
        if ($fromDate->gt($toDate)) {
            [$fromDate, $toDate] = [$toDate->copy()->startOfDay(), $fromDate->copy()->endOfDay()];
        }

        // Get product with related data
        $productData = [
            'id' => $product->id,
            'product_code' => $product->product_code,
            'name' => $product->name,
            'pack_size' => (int)($product->pack_size ?? 1),
            'current_quantity' => (int)($product->quantity ?? 0),
            'category_name' => $product->category->name ?? null,
            'brand_name' => $product->brand->name ?? null,
        ];

        // ===== Purchase Invoices =====
        $purchases = DB::table('purchase_invoice_items as pii')
            ->join('purchase_invoices as pi', 'pi.id', '=', 'pii.purchase_invoice_id')
            ->join('suppliers as s', 's.id', '=', 'pi.supplier_id')
            ->where('pii.product_id', $productId)
            ->whereBetween('pi.posted_date', [$fromDate, $toDate])
            ->select([
                'pi.posted_date as date',
                'pi.posted_number as reference_number',
                'pi.invoice_number',
                's.name as counter_party',
                'pii.batch',
                'pii.expiry',
                'pii.unit_quantity as quantity',
                'pii.unit_purchase_price as unit_price',
                'pii.sub_total',
            ])
            ->orderBy('date', 'asc')
            ->get()
            ->map(function ($item) {
                return [
                    'date' => $item->date instanceof \Carbon\Carbon ? $item->date->format('Y-m-d') : (is_string($item->date) ? substr($item->date, 0, 10) : $item->date),
                    'reference_number' => $item->reference_number,
                    'type' => 'purchase',
                    'type_label' => 'Purchase',
                    'counter_party' => $item->counter_party,
                    'batch' => $item->batch,
                    'expiry' => $item->expiry ? (($item->expiry instanceof \Carbon\Carbon) ? $item->expiry->format('Y-m-d') : (is_string($item->expiry) ? substr($item->expiry, 0, 10) : $item->expiry)) : null,
                    'quantity_in' => (int)($item->quantity ?? 0),
                    'quantity_out' => 0,
                    'unit_price' => (float)($item->unit_price ?? 0),
                    'sub_total' => (float)($item->sub_total ?? 0),
                ];
            });

        // ===== Purchase Returns =====
        $purchaseReturns = DB::table('purchase_return_items as pri')
            ->join('purchase_returns as pr', 'pr.id', '=', 'pri.purchase_return_id')
            ->join('suppliers as s', 's.id', '=', 'pr.supplier_id')
            ->where('pri.product_id', $productId)
            ->whereBetween('pr.date', [$fromDate, $toDate])
            ->select([
                'pr.date',
                'pr.posted_number as reference_number',
                's.name as counter_party',
                'pri.batch',
                'pri.expiry',
                'pri.return_unit_quantity as quantity',
                'pri.unit_purchase_price as unit_price',
                'pri.sub_total',
            ])
            ->orderBy('date', 'asc')
            ->get()
            ->map(function ($item) {
                return [
                    'date' => $item->date instanceof \Carbon\Carbon ? $item->date->format('Y-m-d') : (is_string($item->date) ? substr($item->date, 0, 10) : $item->date),
                    'reference_number' => $item->reference_number,
                    'type' => 'purchase_return',
                    'type_label' => 'Purchase Return',
                    'counter_party' => $item->counter_party,
                    'batch' => $item->batch,
                    'expiry' => $item->expiry ? (($item->expiry instanceof \Carbon\Carbon) ? $item->expiry->format('Y-m-d') : (is_string($item->expiry) ? substr($item->expiry, 0, 10) : $item->expiry)) : null,
                    'quantity_in' => 0,
                    'quantity_out' => (int)($item->quantity ?? 0),
                    'unit_price' => (float)($item->unit_price ?? 0),
                    'sub_total' => (float)($item->sub_total ?? 0),
                ];
            });

        // ===== Sale Invoices =====
        $sales = DB::table('sale_invoice_items as sii')
            ->join('sale_invoices as si', 'si.id', '=', 'sii.sale_invoice_id')
            ->join('customers as c', 'c.id', '=', 'si.customer_id')
            ->where('sii.product_id', $productId)
            ->whereBetween('si.date', [$fromDate, $toDate])
            ->select([
                'si.date',
                'si.posted_number as reference_number',
                'c.name as counter_party',
                'sii.batch_number as batch',
                'sii.expiry',
                'sii.quantity',
                'sii.price as unit_price',
                'sii.sub_total',
            ])
            ->orderBy('date', 'asc')
            ->get()
            ->map(function ($item) {
                return [
                    'date' => $item->date instanceof \Carbon\Carbon ? $item->date->format('Y-m-d') : (is_string($item->date) ? substr($item->date, 0, 10) : $item->date),
                    'reference_number' => $item->reference_number,
                    'type' => 'sale',
                    'type_label' => 'Sale',
                    'counter_party' => $item->counter_party,
                    'batch' => $item->batch,
                    'expiry' => $item->expiry ? (($item->expiry instanceof \Carbon\Carbon) ? $item->expiry->format('Y-m-d') : (is_string($item->expiry) ? substr($item->expiry, 0, 10) : $item->expiry)) : null,
                    'quantity_in' => 0,
                    'quantity_out' => (int)($item->quantity ?? 0),
                    'unit_price' => (float)($item->unit_price ?? 0),
                    'sub_total' => (float)($item->sub_total ?? 0),
                ];
            });

        // ===== Sale Returns =====
        $saleReturns = DB::table('sale_return_items as sri')
            ->join('sale_returns as sr', 'sr.id', '=', 'sri.sale_return_id')
            ->join('customers as c', 'c.id', '=', 'sr.customer_id')
            ->where('sri.product_id', $productId)
            ->whereBetween('sr.date', [$fromDate, $toDate])
            ->select([
                'sr.date',
                'sr.posted_number as reference_number',
                'c.name as counter_party',
                'sri.batch_number as batch',
                'sri.expiry',
                'sri.unit_return_quantity as quantity',
                'sri.unit_sale_price as unit_price',
                'sri.sub_total',
            ])
            ->orderBy('date', 'asc')
            ->get()
            ->map(function ($item) {
                return [
                    'date' => $item->date instanceof \Carbon\Carbon ? $item->date->format('Y-m-d') : (is_string($item->date) ? substr($item->date, 0, 10) : $item->date),
                    'reference_number' => $item->reference_number,
                    'type' => 'sale_return',
                    'type_label' => 'Sale Return',
                    'counter_party' => $item->counter_party,
                    'batch' => $item->batch,
                    'expiry' => $item->expiry ? (($item->expiry instanceof \Carbon\Carbon) ? $item->expiry->format('Y-m-d') : (is_string($item->expiry) ? substr($item->expiry, 0, 10) : $item->expiry)) : null,
                    'quantity_in' => (int)($item->quantity ?? 0),
                    'quantity_out' => 0,
                    'unit_price' => (float)($item->unit_price ?? 0),
                    'sub_total' => (float)($item->sub_total ?? 0),
                ];
            });

        // Merge all transactions and sort by date
        $allTransactions = $purchases
            ->concat($purchaseReturns)
            ->concat($sales)
            ->concat($saleReturns)
            ->sortBy('date')
            ->values();

        // Calculate summary
        $totalPurchases = $purchases->sum('sub_total');
        $totalPurchaseReturns = $purchaseReturns->sum('sub_total');
        $totalSales = $sales->sum('sub_total');
        $totalSaleReturns = $saleReturns->sum('sub_total');
        $totalQuantityIn = $purchases->sum('quantity_in') + $purchaseReturns->sum('quantity_in') + $saleReturns->sum('quantity_in');
        $totalQuantityOut = $sales->sum('quantity_out') + $purchaseReturns->sum('quantity_out');

        $summary = [
            'total_purchases' => round($totalPurchases, 2),
            'total_purchase_returns' => round($totalPurchaseReturns, 2),
            'net_purchases' => round($totalPurchases - $totalPurchaseReturns, 2),
            'total_sales' => round($totalSales, 2),
            'total_sale_returns' => round($totalSaleReturns, 2),
            'net_sales' => round($totalSales - $totalSaleReturns, 2),
            'total_quantity_in' => $totalQuantityIn,
            'total_quantity_out' => $totalQuantityOut,
            'current_quantity' => $productData['current_quantity'],
        ];

        return response()->json([
            'product' => $productData,
            'date_range' => [
                'from' => $fromDate->format('Y-m-d'),
                'to' => $toDate->format('Y-m-d'),
            ],
            'transactions' => $allTransactions,
            'summary' => $summary,
        ]);
    }

    /**
     * GET /api/reports/product-comprehensive/pdf
     */
    public function productComprehensivePdf(Request $req)
    {
        $this->authorize('export', ProductComprehensiveReport::class);

        $rows = $this->buildProductComprehensiveRows(
            $req->query('from'),
            $req->query('to'),
            $req->query('product_id'),
        );

        $meta = [
            'from' => $req->query('from'),
            'to' => $req->query('to'),
            'generatedAt' => now()->format('Y-m-d H:i'),
        ];

        $pdf = Pdf::loadView('reports.product_comprehensive_pdf', [
            'product' => $rows['product'],
            'transactions' => $rows['transactions'],
            'summary' => $rows['summary'],
            'meta' => $meta,
        ])->setPaper('a4', 'landscape');

        $filename = 'product-comprehensive-' . ($rows['product']['product_code'] ?? 'product') . '.pdf';
        return $pdf->stream($filename);
    }

    private function buildProductComprehensiveRows($from, $to, $productId)
    {
        // Validate product_id
        if (!$productId) {
            return [
                'product' => null,
                'transactions' => [],
                'summary' => [],
            ];
        }

        // Get product details
        $product = Product::find($productId);
        if (!$product) {
            return [
                'product' => null,
                'transactions' => [],
                'summary' => [],
            ];
        }

        // Defaults: current month
        $fromDate = $from ? Carbon::parse($from)->startOfDay() : Carbon::now()->startOfMonth();
        $toDate = $to ? Carbon::parse($to)->endOfDay() : Carbon::now()->endOfDay();
        if ($fromDate->gt($toDate)) {
            [$fromDate, $toDate] = [$toDate->copy()->startOfDay(), $fromDate->copy()->endOfDay()];
        }

        // Get product with related data
        $productData = [
            'id' => $product->id,
            'product_code' => $product->product_code,
            'name' => $product->name,
            'pack_size' => (int)($product->pack_size ?? 1),
            'current_quantity' => (int)($product->quantity ?? 0),
            'category_name' => $product->category->name ?? null,
            'brand_name' => $product->brand->name ?? null,
        ];

        // ===== Purchase Invoices =====
        $purchases = DB::table('purchase_invoice_items as pii')
            ->join('purchase_invoices as pi', 'pi.id', '=', 'pii.purchase_invoice_id')
            ->join('suppliers as s', 's.id', '=', 'pi.supplier_id')
            ->where('pii.product_id', $productId)
            ->whereBetween('pi.posted_date', [$fromDate, $toDate])
            ->select([
                'pi.posted_date as date',
                'pi.posted_number as reference_number',
                'pi.invoice_number',
                's.name as counter_party',
                'pii.batch',
                'pii.expiry',
                'pii.unit_quantity as quantity',
                'pii.unit_purchase_price as unit_price',
                'pii.sub_total',
            ])
            ->orderBy('date', 'asc')
            ->get()
            ->map(function ($item) {
                return [
                    'date' => $item->date instanceof \Carbon\Carbon ? $item->date->format('Y-m-d') : (is_string($item->date) ? substr($item->date, 0, 10) : $item->date),
                    'reference_number' => $item->reference_number,
                    'type' => 'purchase',
                    'type_label' => 'Purchase',
                    'counter_party' => $item->counter_party,
                    'batch' => $item->batch,
                    'expiry' => $item->expiry ? (($item->expiry instanceof \Carbon\Carbon) ? $item->expiry->format('Y-m-d') : (is_string($item->expiry) ? substr($item->expiry, 0, 10) : $item->expiry)) : null,
                    'quantity_in' => (int)($item->quantity ?? 0),
                    'quantity_out' => 0,
                    'unit_price' => (float)($item->unit_price ?? 0),
                    'sub_total' => (float)($item->sub_total ?? 0),
                ];
            });

        // ===== Purchase Returns =====
        $purchaseReturns = DB::table('purchase_return_items as pri')
            ->join('purchase_returns as pr', 'pr.id', '=', 'pri.purchase_return_id')
            ->join('suppliers as s', 's.id', '=', 'pr.supplier_id')
            ->where('pri.product_id', $productId)
            ->whereBetween('pr.date', [$fromDate, $toDate])
            ->select([
                'pr.date',
                'pr.posted_number as reference_number',
                's.name as counter_party',
                'pri.batch',
                'pri.expiry',
                'pri.return_unit_quantity as quantity',
                'pri.unit_purchase_price as unit_price',
                'pri.sub_total',
            ])
            ->orderBy('date', 'asc')
            ->get()
            ->map(function ($item) {
                return [
                    'date' => $item->date instanceof \Carbon\Carbon ? $item->date->format('Y-m-d') : (is_string($item->date) ? substr($item->date, 0, 10) : $item->date),
                    'reference_number' => $item->reference_number,
                    'type' => 'purchase_return',
                    'type_label' => 'Purchase Return',
                    'counter_party' => $item->counter_party,
                    'batch' => $item->batch,
                    'expiry' => $item->expiry ? (($item->expiry instanceof \Carbon\Carbon) ? $item->expiry->format('Y-m-d') : (is_string($item->expiry) ? substr($item->expiry, 0, 10) : $item->expiry)) : null,
                    'quantity_in' => 0,
                    'quantity_out' => (int)($item->quantity ?? 0),
                    'unit_price' => (float)($item->unit_price ?? 0),
                    'sub_total' => (float)($item->sub_total ?? 0),
                ];
            });

        // ===== Sale Invoices =====
        $sales = DB::table('sale_invoice_items as sii')
            ->join('sale_invoices as si', 'si.id', '=', 'sii.sale_invoice_id')
            ->join('customers as c', 'c.id', '=', 'si.customer_id')
            ->where('sii.product_id', $productId)
            ->whereBetween('si.date', [$fromDate, $toDate])
            ->select([
                'si.date',
                'si.posted_number as reference_number',
                'c.name as counter_party',
                'sii.batch_number as batch',
                'sii.expiry',
                'sii.quantity',
                'sii.price as unit_price',
                'sii.sub_total',
            ])
            ->orderBy('date', 'asc')
            ->get()
            ->map(function ($item) {
                return [
                    'date' => $item->date instanceof \Carbon\Carbon ? $item->date->format('Y-m-d') : (is_string($item->date) ? substr($item->date, 0, 10) : $item->date),
                    'reference_number' => $item->reference_number,
                    'type' => 'sale',
                    'type_label' => 'Sale',
                    'counter_party' => $item->counter_party,
                    'batch' => $item->batch,
                    'expiry' => $item->expiry ? (($item->expiry instanceof \Carbon\Carbon) ? $item->expiry->format('Y-m-d') : (is_string($item->expiry) ? substr($item->expiry, 0, 10) : $item->expiry)) : null,
                    'quantity_in' => 0,
                    'quantity_out' => (int)($item->quantity ?? 0),
                    'unit_price' => (float)($item->unit_price ?? 0),
                    'sub_total' => (float)($item->sub_total ?? 0),
                ];
            });

        // ===== Sale Returns =====
        $saleReturns = DB::table('sale_return_items as sri')
            ->join('sale_returns as sr', 'sr.id', '=', 'sri.sale_return_id')
            ->join('customers as c', 'c.id', '=', 'sr.customer_id')
            ->where('sri.product_id', $productId)
            ->whereBetween('sr.date', [$fromDate, $toDate])
            ->select([
                'sr.date',
                'sr.posted_number as reference_number',
                'c.name as counter_party',
                'sri.batch_number as batch',
                'sri.expiry',
                'sri.unit_return_quantity as quantity',
                'sri.unit_sale_price as unit_price',
                'sri.sub_total',
            ])
            ->orderBy('date', 'asc')
            ->get()
            ->map(function ($item) {
                return [
                    'date' => $item->date instanceof \Carbon\Carbon ? $item->date->format('Y-m-d') : (is_string($item->date) ? substr($item->date, 0, 10) : $item->date),
                    'reference_number' => $item->reference_number,
                    'type' => 'sale_return',
                    'type_label' => 'Sale Return',
                    'counter_party' => $item->counter_party,
                    'batch' => $item->batch,
                    'expiry' => $item->expiry ? (($item->expiry instanceof \Carbon\Carbon) ? $item->expiry->format('Y-m-d') : (is_string($item->expiry) ? substr($item->expiry, 0, 10) : $item->expiry)) : null,
                    'quantity_in' => (int)($item->quantity ?? 0),
                    'quantity_out' => 0,
                    'unit_price' => (float)($item->unit_price ?? 0),
                    'sub_total' => (float)($item->sub_total ?? 0),
                ];
            });

        // Merge all transactions and sort by date
        $allTransactions = $purchases
            ->concat($purchaseReturns)
            ->concat($sales)
            ->concat($saleReturns)
            ->sortBy('date')
            ->values();

        // Calculate summary
        $totalPurchases = $purchases->sum('sub_total');
        $totalPurchaseReturns = $purchaseReturns->sum('sub_total');
        $totalSales = $sales->sum('sub_total');
        $totalSaleReturns = $saleReturns->sum('sub_total');
        $totalQuantityIn = $purchases->sum('quantity_in') + $purchaseReturns->sum('quantity_in') + $saleReturns->sum('quantity_in');
        $totalQuantityOut = $sales->sum('quantity_out') + $purchaseReturns->sum('quantity_out');

        $summary = [
            'total_purchases' => round($totalPurchases, 2),
            'total_purchase_returns' => round($totalPurchaseReturns, 2),
            'net_purchases' => round($totalPurchases - $totalPurchaseReturns, 2),
            'total_sales' => round($totalSales, 2),
            'total_sale_returns' => round($totalSaleReturns, 2),
            'net_sales' => round($totalSales - $totalSaleReturns, 2),
            'total_quantity_in' => $totalQuantityIn,
            'total_quantity_out' => $totalQuantityOut,
            'current_quantity' => $productData['current_quantity'],
        ];

        return [
            'product' => $productData,
            'transactions' => $allTransactions,
            'summary' => $summary,
        ];
    }
}
