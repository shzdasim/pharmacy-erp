<?php

namespace App\Http\Controllers;

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
}
