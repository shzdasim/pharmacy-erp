<?php

namespace App\Http\Controllers;

use App\Models\PurchaseInvoice;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class ReportsController extends Controller
{
    /**
     * GET /api/reports/cost-of-sale?from=YYYY-MM-DD&to=YYYY-MM-DD
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
        try {
            $from = $req->query('from');
            $to   = $req->query('to');

            // Defaults: current month
            $fromDate = $from ? Carbon::parse($from)->startOfDay() : Carbon::now()->startOfMonth();
            $toDate   = $to   ? Carbon::parse($to)->endOfDay()   : Carbon::now()->endOfDay();
            if ($fromDate->gt($toDate)) {
                [$fromDate, $toDate] = [$toDate->copy()->startOfDay(), $fromDate->copy()->endOfDay()];
            }

            // ===== Sales header sums (per day) =====
            // sale_invoices has: date, gross_amount, item_discount, discount_amount, tax_amount, total
            $sales = DB::table('sale_invoices as si')
                ->whereBetween('si.date', [$fromDate, $toDate])
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
            $returns = DB::table('sale_returns as sr')
                ->whereBetween('sr.date', [$fromDate, $toDate])
                ->selectRaw('DATE(sr.date) as sale_date')
                ->selectRaw('SUM(COALESCE(sr.total, 0)) as sale_return')
                ->groupBy('sale_date')
                ->get()
                ->keyBy('sale_date');

            // ===== COGS on sales (per day) =====
            // Approximate cost using products.avg_price * sale_invoice_items.quantity
            $cogsSales = DB::table('sale_invoice_items as sii')
                ->join('sale_invoices as si', 'si.id', '=', 'sii.sale_invoice_id')
                ->join('products as p', 'p.id', '=', 'sii.product_id')
                ->whereBetween('si.date', [$fromDate, $toDate])
                ->selectRaw('DATE(si.date) as sale_date')
                ->selectRaw('SUM(COALESCE(sii.quantity, 0) * COALESCE(p.avg_price, 0)) as cogs_sales')
                ->groupBy('sale_date')
                ->get()
                ->keyBy('sale_date');

            // ===== COGS reversed on returns (per day) =====
            // Approximate cost using products.avg_price * sale_return_items.unit_return_quantity
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
}
