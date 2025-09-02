<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use App\Models\SaleInvoice;
use App\Models\PurchaseInvoice;
use App\Models\SaleReturn;
use App\Models\PurchaseReturn;

class DashboardController extends Controller
{
    /**
     * GET /api/dashboard/summary?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD
     * If date_from/date_to are missing, defaults to today (local app timezone).
     */
    public function summary(Request $request)
    {
        // Default to "today" if user didn't pick dates
        $today = now()->toDateString();
        $from = $request->query('date_from', $today);
        $to   = $request->query('date_to', $today);

        // Lightweight validation only if present
        $request->validate([
            'date_from' => ['nullable', 'date'],
            'date_to'   => ['nullable', 'date', 'after_or_equal:date_from'],
        ]);

        // ---- Totals (use your actual columns) ----
        $salesTotal = (float) SaleInvoice::whereBetween('date', [$from, $to])->sum('total');

        // Purchases use posted_date; fall back to created_at if null
        $purchasesTotal = (float) PurchaseInvoice::whereBetween(
            DB::raw('DATE(COALESCE(posted_date, created_at))'),
            [$from, $to]
        )->sum('total_amount');

        $saleReturnsTotal = (float) SaleReturn::whereBetween('date', [$from, $to])->sum('total');
        $purchaseReturnsTotal = (float) PurchaseReturn::whereBetween('date', [$from, $to])->sum('total');

        $totals = [
            'sales'            => $salesTotal,
            'purchases'        => $purchasesTotal,
            'sale_returns'     => $saleReturnsTotal,
            'purchase_returns' => $purchaseReturnsTotal,
            'net_sales'        => $salesTotal - $saleReturnsTotal,
        ];

        // ---- Series (group by business date) ----
        $salesSeries = SaleInvoice::selectRaw('DATE(date) as date, SUM(total) as value')
            ->whereBetween('date', [$from, $to])
            ->groupBy(DB::raw('DATE(date)'))
            ->orderBy('date')
            ->get()
            ->map(fn ($r) => ['date' => $r->date, 'value' => (float) $r->value]);

        $purchaseSeries = PurchaseInvoice::selectRaw('DATE(COALESCE(posted_date, created_at)) as date, SUM(total_amount) as value')
            ->whereBetween(DB::raw('DATE(COALESCE(posted_date, created_at))'), [$from, $to])
            ->groupBy(DB::raw('DATE(COALESCE(posted_date, created_at))'))
            ->orderBy('date')
            ->get()
            ->map(fn ($r) => ['date' => $r->date, 'value' => (float) $r->value]);

        $saleReturnSeries = SaleReturn::selectRaw('DATE(date) as date, SUM(total) as value')
            ->whereBetween('date', [$from, $to])
            ->groupBy(DB::raw('DATE(date)'))
            ->orderBy('date')
            ->get()
            ->map(fn ($r) => ['date' => $r->date, 'value' => (float) $r->value]);

        $purchaseReturnSeries = PurchaseReturn::selectRaw('DATE(date) as date, SUM(total) as value')
            ->whereBetween('date', [$from, $to])
            ->groupBy(DB::raw('DATE(date)'))
            ->orderBy('date')
            ->get()
            ->map(fn ($r) => ['date' => $r->date, 'value' => (float) $r->value]);

        return response()->json([
            'totals' => $totals,
            'series' => [
                'sales'            => $salesSeries,
                'purchases'        => $purchaseSeries,
                'sale_returns'     => $saleReturnSeries,
                'purchase_returns' => $purchaseReturnSeries,
            ],
        ]);
    }

    public function nearExpiry(Request $request)
{
    $months = (int) $request->query('months', 3);
    if (!in_array($months, [1,3,6,12,18], true)) {
        $months = 3;
    }

    $supplierId = $request->query('supplier_id');
    $brandId    = $request->query('brand_id');

    $today = now()->toDateString();
    $to    = now()->copy()->addMonths($months)->toDateString();

    $q = DB::table('batches as b')
        ->join('products as p', 'p.id', '=', 'b.product_id')
        ->leftJoin('suppliers as s', 's.id', '=', 'p.supplier_id')
        ->leftJoin('brands as br', 'br.id', '=', 'p.brand_id')
        ->whereNotNull('b.expiry_date')
        ->whereBetween(DB::raw('DATE(b.expiry_date)'), [$today, $to]);

    if (!empty($supplierId)) $q->where('p.supplier_id', $supplierId);
    if (!empty($brandId))    $q->where('p.brand_id', $brandId);

    $rows = $q->orderBy('b.expiry_date')
        ->select(
            'b.id as batch_id',
            'b.batch_number',
            'b.expiry_date',
            'b.quantity',
            'p.id as product_id',
            'p.product_code',
            'p.name as product_name',
            'p.supplier_id',
            'p.brand_id',
            DB::raw('COALESCE(s.name, "") as supplier_name'),
            DB::raw('COALESCE(br.name, "") as brand_name')
        )
        ->limit(1000)
        ->get();

    return response()->json([
        'months' => $months,
        'from'   => $today,
        'to'     => $to,
        'rows'   => $rows,
    ]);
}

public function nearExpiryFilters()
{
    $suppliers = DB::table('suppliers')->select('id','name')->orderBy('name')->get();
    $brands    = DB::table('brands')->select('id','name')->orderBy('name')->get();
    return response()->json(compact('suppliers','brands'));
}

}
