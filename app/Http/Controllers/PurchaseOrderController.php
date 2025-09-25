<?php

namespace App\Http\Controllers;

use App\Authorizables\PurchaseOrderForecast;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class PurchaseOrderController extends Controller
{
    public function forecast(Request $request)
    {
        $this->authorize('generate', PurchaseOrderForecast::class);

        // ✅ added optional knobs (packs)
        $data = $request->validate([
            'date_from'      => 'required|date',
            'date_to'        => 'required|date|after_or_equal:date_from',
            'projected_days' => 'required|integer|min:1',
            'supplier_id'    => 'nullable|integer|exists:suppliers,id',
            'brand_id'       => 'nullable|integer|exists:brands,id',
            'safety_packs'   => 'nullable|integer|min:0',
            'moq_packs'      => 'nullable|integer|min:0',
        ]);

        $from = Carbon::parse($data['date_from'])->startOfDay();
        $to   = Carbon::parse($data['date_to'])->endOfDay();
        $days = max(1, $from->diffInDays($to) + 1);
        $proj = (int) $data['projected_days'];

        $safetyPacks = (int) ($data['safety_packs'] ?? 0);
        $moqPacks    = (int) ($data['moq_packs'] ?? 0);

        // --- sales within selected range (STRICT filter) ---
        $salesInRange = DB::table('sale_invoice_items as sii')
            ->join('sale_invoices as si', 'si.id', '=', 'sii.sale_invoice_id')
            ->whereBetween('si.date', [$from->toDateString(), $to->toDateString()])
            ->groupBy('sii.product_id')
            ->select(
                'sii.product_id',
                DB::raw('SUM(sii.quantity) as units_sold'),
                DB::raw('MAX(si.date) as last_sold_date_in_range')
            );

        // Only include products that SOLD in the selected period
        $rows = DB::table('products as p')
            ->joinSub($salesInRange, 'sx', function ($j) {
                $j->on('p.id', '=', 'sx.product_id');
            })
            ->leftJoin('brands as b', 'b.id', '=', 'p.brand_id')
            ->leftJoin('suppliers as s', 's.id', '=', 'p.supplier_id')
            ->when($data['supplier_id'] ?? null, fn($q, $sid) => $q->where('p.supplier_id', $sid))
            ->when($data['brand_id'] ?? null, fn($q, $bid) => $q->where('p.brand_id', $bid))
            ->where('sx.units_sold', '>', 0)
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
                DB::raw('sx.units_sold as units_sold'),
                DB::raw('sx.last_sold_date_in_range as last_sold_date')
            )
            ->orderByDesc('sx.units_sold')
            ->get();

        $items = $rows->map(function ($row) use ($days, $proj, $safetyPacks, $moqPacks) {
            $packSize = max(1, (int) ($row->product_pack_size ?? 0));

            // ===== Demand model (UNITS) =====
            $unitsSold   = (int) ($row->units_sold ?? 0);
            $dailyUnits  = $days > 0 ? ($unitsSold / $days) : 0.0;
            $projUnits   = $dailyUnits * $proj;

            // ===== Stock & safety (UNITS) =====
            $stockUnits  = (int) ($row->current_stock_units ?? 0);
            $safetyUnits = $safetyPacks * $packSize; // request-level safety; extend here if you add per-product RL

            // Projected ending stock after the projection window
            $endingUnits = $stockUnits - $projUnits;

            // Order is DUE iff projected ending stock falls below safety
            $dueUnits    = max(0, $safetyUnits - $endingUnits);
            $suggested   = (int) ceil($dueUnits / $packSize); // round up to whole packs

            // Apply MOQ (packs) if any
            if ($suggested > 0 && $moqPacks > 0) {
                $suggested = max($suggested, $moqPacks);
            }

            // ===== Pricing =====
            $ppu       = (float) ($row->unit_purchase_price ?? 0);
            $ppp       = (float) ($row->pack_purchase_price ?? 0);
            $packPrice = $ppp > 0 ? $ppp : ($ppu > 0 ? $ppu * $packSize : 0);

            return [
                'product_id'            => (int) $row->product_id,
                'product_code'          => $row->product_code,
                'product_name'          => $row->product_name,
                'brand_id'              => $row->brand_id,
                'brand_name'            => $row->brand_name,
                'supplier_id'           => $row->supplier_id,
                'supplier_name'         => $row->supplier_name,
                'pack_size'             => $packSize,
                'units_sold'            => $unitsSold,
                'current_stock_units'   => $stockUnits,
                'projected_days'        => (int) $proj,
                'suggested_packs'       => (int) $suggested,
                'suggested_units'       => (int) ($suggested * $packSize),
                'pack_price'            => round($packPrice, 2),
                'pack_purchase_price'   => (float) $ppp,         // for "Remove Zero"
                'last_sold_date'        => $row->last_sold_date, // within range
                'unit_purchase_price'   => $ppu,
                'unit_sale_price'       => $row->unit_sale_price,

                // Optional: aid debugging in UI (safe to keep or remove)
                'policy' => [
                    'daily_units'  => round($dailyUnits, 4),
                    'proj_units'   => round($projUnits, 2),
                    'ending_units' => round($endingUnits, 2),
                    'safety_units' => $safetyUnits,
                    'due_units'    => round($dueUnits, 2),
                    'moq_packs'    => (int) $moqPacks,
                ],
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
                    'safety_packs'=> $safetyPacks,
                    'moq_packs'   => $moqPacks,
                ],
            ],
            'items' => $items,
        ]);
    }
}
