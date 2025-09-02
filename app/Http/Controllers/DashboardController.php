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
}
