<?php

namespace App\Http\Controllers;
use App\Models\Product;
use App\Models\StockAdjustment;
use App\Models\StockAdjustmentItem;
use App\Models\Batch; // assumes your Batch model exists
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class StockAdjustmentController extends Controller
{
    // ===== Helpers to read/set product stock column consistently =====
    protected function getProductQty(Product $p): float
    {
        // TODO: align with your schema
        return (float)($p->available_units ?? $p->quantity_on_hand ?? $p->quantity ?? 0);
    }

    protected function setProductQty(Product $p, float $qty): void
    {
        // TODO: align with your schema
        if ($p->offsetExists('available_units')) $p->available_units = $qty;
        elseif ($p->offsetExists('quantity_on_hand')) $p->quantity_on_hand = $qty;
        else $p->quantity = $qty;
        $p->save();
    }

    protected function sumBatches(Product $p): float
    {
        // Sum all batches for product to keep product-level stock in sync
        return (float) Batch::where('product_id', $p->id)->sum(DB::raw('COALESCE(available_units, 0)'));
    }

    public function index(Request $request)
    {
        $q = trim((string)$request->get('q'));
        $per = (int)($request->get('per_page', 50));
        $query = StockAdjustment::query()
            ->withCount('items')
            ->when($q !== '', fn($qq) => $qq->where('posted_number','like',"%{$q}%")->orWhere('note','like',"%{$q}%"))
            ->orderByDesc('id');
        return $query->paginate($per);
    }

    public function show($id)
    {
        return StockAdjustment::with(['items.product'])->findOrFail($id);
    }

    public function newCode()
    {
        $prefix = 'STADJ-';
        $last = StockAdjustment::where('posted_number','like',$prefix.'%')->orderByDesc('id')->value('posted_number');
        $next = 1;
        if ($last && preg_match('/^'.preg_quote($prefix,'/').'([0-9]+)$/',$last,$m)) $next = ((int)$m[1]) + 1;
        return response()->json(['posted_number' => sprintf($prefix.'%05d', $next)]);
    }

    public function store(Request $request)
    {
        $data = $this->validatePayload($request);

        return DB::transaction(function () use ($data, $request) {
            $adj = StockAdjustment::create([
                'posted_number' => $data['posted_number'],
                'posted_date'   => $data['posted_date'],
                'note'          => $data['note'],
                'total_worth'   => 0,
                'user_id'       => optional($request->user())->id,
            ]);

            $totalWorth = 0.0;
            $touchedProducts = [];

            foreach ($data['items'] as $row) {
                /** @var Product $product */
                $product = Product::query()->lockForUpdate()->findOrFail($row['product_id']);

                $useBatch = isset($row['batch_number']) && $row['batch_number'] !== null && $row['batch_number'] !== '';

                if ($useBatch) {
                    /** @var Batch $batch */
                    $batch = Batch::query()->lockForUpdate()
                        ->where('product_id', $product->id)
                        ->where('batch_number', $row['batch_number'])
                        ->first();

                    if (!$batch) {
                        // create batch if adjusting a new batch code
                        $batch = new Batch();
                        $batch->product_id = $product->id;
                        $batch->batch_number = $row['batch_number'];
                        $batch->expiry = $row['expiry'] ?? null;
                        $batch->available_units = 0;
                    }

                    $previous = (float)($batch->available_units ?? 0);
                    $actual   = (float)$row['actual_qty'];
                    $diff     = $actual - $previous;

                    $unitCost = (float)($row['unit_purchase_price'] ?? $product->unit_purchase_price ?? 0);
                    $worth    = abs($diff) * $unitCost;

                    StockAdjustmentItem::create([
                        'stock_adjustment_id' => $adj->id,
                        'product_id'         => $product->id,
                        'batch_number'       => $row['batch_number'],
                        'expiry'             => $row['expiry'] ?? null,
                        'pack_size'          => $row['pack_size'] ?? null,
                        'previous_qty'       => $previous,
                        'actual_qty'         => $actual,
                        'diff_qty'           => $diff,
                        'unit_purchase_price'=> $unitCost,
                        'worth_adjusted'     => $worth,
                    ]);

                    $totalWorth += $worth;

                    // Apply to batch
                    $batch->available_units = $actual;
                    $batch->save();

                } else {
                    // Product-level adjustment
                    $previous = $this->getProductQty($product);
                    $actual   = (float)$row['actual_qty'];
                    $diff     = $actual - $previous;
                    $unitCost = (float)($row['unit_purchase_price'] ?? $product->unit_purchase_price ?? 0);
                    $worth    = abs($diff) * $unitCost;

                    StockAdjustmentItem::create([
                        'stock_adjustment_id' => $adj->id,
                        'product_id'         => $product->id,
                        'previous_qty'       => $previous,
                        'actual_qty'         => $actual,
                        'diff_qty'           => $diff,
                        'unit_purchase_price'=> $unitCost,
                        'worth_adjusted'     => $worth,
                    ]);

                    $totalWorth += $worth;

                    // Apply to product-level qty
                    $this->setProductQty($product, $actual);
                }

                $touchedProducts[$product->id] = true;
            }

            // Sync product-level totals with batch sums (for products with any batches)
            foreach (array_keys($touchedProducts) as $pid) {
                /** @var Product $p */
                $p = Product::query()->lockForUpdate()->findOrFail($pid);
                $batchCount = Batch::where('product_id', $pid)->count();
                if ($batchCount > 0) {
                    $this->setProductQty($p, $this->sumBatches($p));
                }
            }

            $adj->update(['total_worth' => $totalWorth]);
            return $this->show($adj->id);
        });
    }

    public function update(Request $request, $id)
    {
        $adj = StockAdjustment::with('items')->findOrFail($id);
        $data = $this->validatePayload($request, $id);

        return DB::transaction(function () use ($adj, $data) {
            // Roll back previous effects
            foreach ($adj->items as $old) {
                /** @var Product $product */
                $product = Product::query()->lockForUpdate()->findOrFail($old->product_id);
                if ($old->batch_number) {
                    /** @var Batch $batch */
                    $batch = Batch::query()->lockForUpdate()
                        ->where('product_id', $product->id)
                        ->where('batch_number', $old->batch_number)
                        ->first();
                    if ($batch) {
                        $batch->available_units = $old->previous_qty;
                        $batch->save();
                    }
                } else {
                    $this->setProductQty($product, (float)$old->previous_qty);
                }
            }

            // Delete old items
            $adj->items()->delete();

            // Re-apply fresh
            $totalWorth = 0.0;
            $touchedProducts = [];
            foreach ($data['items'] as $row) {
                /** @var Product $product */
                $product = Product::query()->lockForUpdate()->findOrFail($row['product_id']);
                $useBatch = isset($row['batch_number']) && $row['batch_number'] !== null && $row['batch_number'] !== '';

                if ($useBatch) {
                    /** @var Batch $batch */
                    $batch = Batch::query()->lockForUpdate()
                        ->firstOrCreate(
                            ['product_id' => $product->id, 'batch_number' => $row['batch_number']],
                            ['expiry' => $row['expiry'] ?? null, 'available_units' => 0]
                        );

                    $previous = (float)($batch->available_units ?? 0);
                    $actual   = (float)$row['actual_qty'];
                    $diff     = $actual - $previous;

                    $unitCost = (float)($row['unit_purchase_price'] ?? $product->unit_purchase_price ?? 0);
                    $worth    = abs($diff) * $unitCost;

                    StockAdjustmentItem::create([
                        'stock_adjustment_id' => $adj->id,
                        'product_id'         => $product->id,
                        'batch_number'       => $row['batch_number'],
                        'expiry'             => $row['expiry'] ?? null,
                        'pack_size'          => $row['pack_size'] ?? null,
                        'previous_qty'       => $previous,
                        'actual_qty'         => $actual,
                        'diff_qty'           => $diff,
                        'unit_purchase_price'=> $unitCost,
                        'worth_adjusted'     => $worth,
                    ]);

                    $totalWorth += $worth;
                    $batch->available_units = $actual;
                    $batch->save();
                } else {
                    $previous = $this->getProductQty($product);
                    $actual   = (float)$row['actual_qty'];
                    $diff     = $actual - $previous;
                    $unitCost = (float)($row['unit_purchase_price'] ?? $product->unit_purchase_price ?? 0);
                    $worth    = abs($diff) * $unitCost;

                    StockAdjustmentItem::create([
                        'stock_adjustment_id' => $adj->id,
                        'product_id'         => $product->id,
                        'previous_qty'       => $previous,
                        'actual_qty'         => $actual,
                        'diff_qty'           => $diff,
                        'unit_purchase_price'=> $unitCost,
                        'worth_adjusted'     => $worth,
                    ]);

                    $totalWorth += $worth;
                    $this->setProductQty($product, $actual);
                }

                $touchedProducts[$product->id] = true;
            }

            foreach (array_keys($touchedProducts) as $pid) {
                /** @var Product $p */
                $p = Product::query()->lockForUpdate()->findOrFail($pid);
                $batchCount = Batch::where('product_id', $pid)->count();
                if ($batchCount > 0) {
                    $this->setProductQty($p, $this->sumBatches($p));
                }
            }

            $adj->update([
                'posted_number' => $data['posted_number'],
                'posted_date'   => $data['posted_date'],
                'note'          => $data['note'],
                'total_worth'   => $totalWorth,
            ]);

            return $this->show($adj->id);
        });
    }

    public function destroy($id)
    {
        return DB::transaction(function () use ($id) {
            $adj = StockAdjustment::with('items')->findOrFail($id);
            $touchedProducts = [];

            foreach ($adj->items as $item) {
                /** @var Product $product */
                $product = Product::query()->lockForUpdate()->findOrFail($item->product_id);
                if ($item->batch_number) {
                    /** @var Batch $batch */
                    $batch = Batch::query()->lockForUpdate()
                        ->where('product_id', $product->id)
                        ->where('batch_number', $item->batch_number)
                        ->first();
                    if ($batch) {
                        $batch->available_units = $item->previous_qty;
                        $batch->save();
                    }
                } else {
                    $this->setProductQty($product, (float)$item->previous_qty);
                }
                $touchedProducts[$product->id] = true;
            }

            $adj->items()->delete();
            $adj->delete();

            foreach (array_keys($touchedProducts) as $pid) {
                /** @var Product $p */
                $p = Product::query()->lockForUpdate()->findOrFail($pid);
                $batchCount = Batch::where('product_id', $pid)->count();
                if ($batchCount > 0) {
                    $this->setProductQty($p, $this->sumBatches($p));
                }
            }

            return response()->noContent();
        });
    }

    protected function validatePayload(Request $request, $id = null): array
    {
        return $request->validate([
            'posted_number' => ['required', 'string', Rule::unique('stock_adjustments','posted_number')->ignore($id)],
            'posted_date'   => ['required', 'date'],
            'note'          => ['required', 'string', 'max:2000'],
            'items'         => ['required', 'array', 'min:1'],
            'items.*.product_id'         => ['required','integer','exists:products,id'],
            'items.*.actual_qty'         => ['required','numeric','min:0'],
            'items.*.unit_purchase_price'=> ['nullable','numeric','min:0'],
            'items.*.batch_number'       => ['nullable','string','max:191'],
            'items.*.expiry'             => ['nullable','date'],
            'items.*.pack_size'          => ['nullable','numeric','min:0'],
        ]);
    }
}
