<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class PurchaseOrderController extends Controller
{

    public function forecast(Request $request)
{
    $data = $request->validate([
        'date_from'      => 'required|date',
        'date_to'        => 'required|date|after_or_equal:date_from',
        'projected_days' => 'required|integer|min:1',
        'supplier_id'    => 'nullable|integer|exists:suppliers,id',
        'brand_id'       => 'nullable|integer|exists:brands,id',
    ]);

    $from = \Carbon\Carbon::parse($data['date_from'])->startOfDay();
    $to   = \Carbon\Carbon::parse($data['date_to'])->endOfDay();
    $days = max(1, $from->diffInDays($to) + 1);
    $proj = (int) $data['projected_days'];

    // Aggregate sales in the period by product
    $salesAgg = DB::table('sale_invoice_items as sii')
        ->join('sale_invoices as si', 'si.id', '=', 'sii.sale_invoice_id')
        ->whereBetween('si.date', [$from->toDateString(), $to->toDateString()])
        ->groupBy('sii.product_id')
        ->select(
            'sii.product_id',
            DB::raw('SUM(sii.quantity) as units_sold'),
            DB::raw('MAX(si.date) as last_sold_date')
        );

    // Start from products so zero-sale products are also included
    $rows = DB::table('products as p')
        ->leftJoinSub($salesAgg, 'sx', function ($j) {
            $j->on('p.id', '=', 'sx.product_id');
        })
        ->leftJoin('brands as b', 'b.id', '=', 'p.brand_id')
        ->leftJoin('suppliers as s', 's.id', '=', 'p.supplier_id')
        ->when($data['supplier_id'] ?? null, fn($q, $sid) => $q->where('p.supplier_id', $sid))
        ->when($data['brand_id'] ?? null, fn($q, $bid) => $q->where('p.brand_id', $bid))
        ->select(
            'p.id as product_id',
            'p.product_code',
            'p.name as product_name',
            'p.pack_size as product_pack_size',
            'p.quantity as current_stock_units',
            'p.unit_purchase_price',
            'p.pack_purchase_price',
            'p.unit_sale_price',
            'p.brand_id',
            'p.supplier_id',
            'b.name as brand_name',
            's.name as supplier_name',
            DB::raw('COALESCE(sx.units_sold, 0) as units_sold'),
            'sx.last_sold_date'
        )
        ->orderBy('p.name', 'asc')
        ->get();

    $items = $rows->map(function ($row) use ($days, $proj) {
        $packSize = (int) ($row->product_pack_size ?? 0);
        if ($packSize <= 0) $packSize = 1;

        $unitsSold  = (int) ($row->units_sold ?? 0);
        $packsSold  = $unitsSold / $packSize;
        $dailyRaw   = $packsSold / $days;

        $stockUnits = (int) ($row->current_stock_units ?? 0);
        $stockPacks = $stockUnits / $packSize;

        // pack price: prefer pack_purchase_price; fallback to unit * pack_size
        $ppu        = (float) ($row->unit_purchase_price ?? 0);
        $ppp        = (float) ($row->pack_purchase_price ?? 0);
        $packPrice  = $ppp > 0 ? $ppp : ($ppu > 0 ? $ppu * $packSize : 0);

        // suggested packs (integer). Zero/NULL stock -> at least 1 pack.
        $suggested  = (int) max(0, ceil(($dailyRaw * $proj) - $stockPacks));
        if ($stockUnits <= 0) {
            $suggested = max(1, $suggested);
        }

        return [
            'product_id'            => (int) $row->product_id,
            'product_code'          => $row->product_code,
            'product_name'          => $row->product_name,
            'brand_id'              => $row->brand_id,
            'brand_name'            => $row->brand_name,
            'supplier_id'           => $row->supplier_id,
            'supplier_name'         => $row->supplier_name,
            'pack_size'             => $packSize,
            'units_sold'            => $unitsSold,                         // int
            'packs_sold'            => round($packsSold, 2),               // 2dp
            'days_in_range'         => (int) $days,
            'daily_packs'           => round($dailyRaw, 2),                // 2dp
            'current_stock_units'   => $stockUnits,                        // int
            'current_stock_packs'   => round($stockPacks, 2),              // 2dp
            'projected_days'        => (int) $proj,
            'suggested_packs'       => (int) $suggested,
            'suggested_units'       => (int) ($suggested * $packSize),
            'pack_price'            => round($packPrice, 2),               // 2dp
            'last_sold_date'        => $row->last_sold_date,
            'unit_purchase_price'   => $ppu,
            'unit_sale_price'       => $row->unit_sale_price,
        ];
    })->values();

    return response()->json([
        'meta' => [
            'date_from'      => $from->toDateString(),
            'date_to'        => $to->toDateString(),
            'days'           => (int) $days,
            'projected_days' => $proj,
            'filter'         => [
                'supplier_id' => $data['supplier_id'] ?? null,
                'brand_id'    => $data['brand_id'] ?? null,
            ],
        ],
        'items' => $items,
    ]);
}


}
