<?php

namespace App\Http\Controllers;

use App\Models\PurchaseReturn;
use App\Models\PurchaseReturnItem;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PurchaseReturnController extends Controller
{
    public function index()
    {
        return PurchaseReturn::with(['supplier', 'purchaseInvoice', 'items.product'])
            ->latest()
            ->get();
    }

    public function show($id)
    {
        return PurchaseReturn::with(['supplier', 'purchaseInvoice', 'items.product'])->findOrFail($id);
    }

    public function generateNewCode()
    {
        $next = (PurchaseReturn::max('id') ?? 0) + 1;
        $code = 'PR-' . str_pad((string)$next, 6, '0', STR_PAD_LEFT);
        return response()->json(['posted_number' => $code]);
    }

    public function store(Request $request)
    {
        $validated = $this->validatePayload($request);
        $data = $this->normalizePayload($validated);

        return DB::transaction(function () use ($data) {
            $pr = new PurchaseReturn();
            $pr->supplier_id         = $data['supplier_id'];
            $pr->purchase_invoice_id = $data['purchase_invoice_id'] ?? null;
            $pr->posted_number       = $data['posted_number'] ?? $this->makeCode();
            $pr->date                = $data['date'];
            $pr->remarks             = $data['remarks'] ?? null;
            $pr->gross_total         = $data['gross_total'] ?? 0;
            $pr->discount_percentage = $data['discount_percentage'] ?? 0;
            $pr->discount_amount     = $data['discount_amount'] ?? 0;
            $pr->tax_percentage      = $data['tax_percentage'] ?? 0;
            $pr->tax_amount          = $data['tax_amount'] ?? 0;
            $pr->total               = $data['total'] ?? 0;
            $pr->save();

            foreach ($data['items'] as $it) {
                $item = new PurchaseReturnItem();
                $item->purchase_return_id      = $pr->id;
                $item->product_id              = $it['product_id'];
                $item->batch                   = $it['batch'] ?? null;
                $item->expiry                  = $it['expiry'] ?? null;
                $item->pack_size               = $it['pack_size'] ?? 0;
                $item->pack_purchased_quantity = $it['pack_purchased_quantity'] ?? 0;
                $item->return_pack_quantity    = $it['return_pack_quantity'] ?? 0;
                $item->return_unit_quantity    = $it['return_unit_quantity'] ?? 0;
                $item->pack_purchase_price     = $it['pack_purchase_price'] ?? 0;
                $item->unit_purchase_price     = $it['unit_purchase_price'] ?? 0;
                $item->item_discount_percentage= $it['item_discount_percentage'] ?? 0;
                $item->sub_total               = $it['sub_total'] ?? 0;
                $item->save();
            }

            return PurchaseReturn::with(['supplier', 'purchaseInvoice', 'items.product'])->find($pr->id);
        });
    }

    public function update(Request $request, $id)
    {
        $validated = $this->validatePayload($request, updating: true);
        $data = $this->normalizePayload($validated);

        return DB::transaction(function () use ($data, $id) {
            $pr = PurchaseReturn::findOrFail($id);
            $pr->supplier_id         = $data['supplier_id'];
            $pr->purchase_invoice_id = $data['purchase_invoice_id'] ?? null;
            $pr->posted_number       = $data['posted_number'] ?? $pr->posted_number ?? $this->makeCode();
            $pr->date                = $data['date'];
            $pr->remarks             = $data['remarks'] ?? null;
            $pr->gross_total         = $data['gross_total'] ?? 0;
            $pr->discount_percentage = $data['discount_percentage'] ?? 0;
            $pr->discount_amount     = $data['discount_amount'] ?? 0;
            $pr->tax_percentage      = $data['tax_percentage'] ?? 0;
            $pr->tax_amount          = $data['tax_amount'] ?? 0;
            $pr->total               = $data['total'] ?? 0;
            $pr->save();

            $pr->items()->delete();
            foreach ($data['items'] as $it) {
                $item = new PurchaseReturnItem();
                $item->purchase_return_id      = $pr->id;
                $item->product_id              = $it['product_id'];
                $item->batch                   = $it['batch'] ?? null;
                $item->expiry                  = $it['expiry'] ?? null;
                $item->pack_size               = $it['pack_size'] ?? 0;
                $item->pack_purchased_quantity = $it['pack_purchased_quantity'] ?? 0;
                $item->return_pack_quantity    = $it['return_pack_quantity'] ?? 0;
                $item->return_unit_quantity    = $it['return_unit_quantity'] ?? 0;
                $item->pack_purchase_price     = $it['pack_purchase_price'] ?? 0;
                $item->unit_purchase_price     = $it['unit_purchase_price'] ?? 0;
                $item->item_discount_percentage= $it['item_discount_percentage'] ?? 0;
                $item->sub_total               = $it['sub_total'] ?? 0;
                $item->save();
            }

            return PurchaseReturn::with(['supplier', 'purchaseInvoice', 'items.product'])->find($pr->id);
        });
    }

    public function destroy($id)
    {
        try {
            return DB::transaction(function () use ($id) {
                $pr = PurchaseReturn::with('items')->findOrFail($id);

                // Delete children first (even though FK cascades; this makes intent explicit)
                $pr->items()->delete();

                // Delete parent
                $pr->delete();

                return response()->json(['message' => 'Purchase return deleted'], 200);
            });
        } catch (\Throwable $e) {
            // If something else references this return, surface a cleaner error
            $code = method_exists($e, 'getCode') ? $e->getCode() : 0;
            $msg  = $e->getMessage();
            return response()->json([
                'message' => 'Unable to delete purchase return',
                'error'   => $msg,
                'code'    => $code,
            ], 409);
        }
    }

    private function validatePayload(Request $request, bool $updating = false): array
    {
        $data = $request->validate([
            'supplier_id'          => ['required', 'integer', 'exists:suppliers,id'],
            'purchase_invoice_id'  => ['nullable', 'integer', 'exists:purchase_invoices,id'],
            'posted_number'        => ['nullable', 'string', 'max:50'],
            'date'                 => ['required', 'date'],
            'remarks'              => ['nullable', 'string'],
            'gross_total'          => ['nullable', 'numeric'],
            'discount_percentage'  => ['nullable', 'numeric'],
            'discount_amount'      => ['nullable', 'numeric'],
            'tax_percentage'       => ['nullable', 'numeric'],
            'tax_amount'           => ['nullable', 'numeric'],
            'total'                => ['nullable', 'numeric'],

            'items'                        => ['required', 'array', 'min:1'],
            'items.*.product_id'           => ['required', 'integer', 'exists:products,id'],
            'items.*.batch'                => ['nullable', 'string', 'max:100'],
            'items.*.expiry'               => ['nullable', 'date'],
            'items.*.pack_size'            => ['nullable', 'numeric'],
            'items.*.pack_purchased_quantity' => ['nullable', 'numeric'],
            'items.*.return_pack_quantity' => ['nullable', 'numeric'],
            'items.*.return_unit_quantity' => ['nullable', 'numeric'],
            'items.*.pack_purchase_price'  => ['nullable', 'numeric'],
            'items.*.unit_purchase_price'  => ['nullable', 'numeric'],
            'items.*.item_discount_percentage' => ['nullable', 'numeric'],
            'items.*.sub_total'            => ['nullable', 'numeric'],
        ]);

        $hasInvoice = !empty($data['purchase_invoice_id']);

        $seen = [];
        foreach ($data['items'] as $idx => $it) {
            $pid = (string)($it['product_id'] ?? '');
            $batch = (string)($it['batch'] ?? '');

            if ($hasInvoice) {
                $key = $pid.'::'.($batch ?: '__NO_BATCH__');
                if (isset($seen[$key])) {
                    abort(422, "Duplicate row for product/batch at rows ".($seen[$key]+1)." and ".($idx+1));
                }
                $seen[$key] = $idx;

                $retPacks = (float)($it['return_pack_quantity'] ?? 0);
                $purchasedPacks = (float)($it['pack_purchased_quantity'] ?? 0);
                if ($retPacks > $purchasedPacks) {
                    abort(422, "Row ".($idx+1).": Return Pack Qty cannot exceed Pack Purchased Qty.");
                }
            } else {
                if (isset($seen[$pid])) {
                    abort(422, "Duplicate product in open return at rows ".($seen[$pid]+1)." and ".($idx+1));
                }
                $seen[$pid] = $idx;
            }
        }

        return $data;
    }

    private function normalizePayload(array $data): array
    {
        if (empty($data['purchase_invoice_id'])) {
            $data['purchase_invoice_id'] = null;
        }

        if (isset($data['items']) && is_array($data['items'])) {
            foreach ($data['items'] as &$it) {
                if (empty($it['batch'])) {
                    $it['batch'] = null;
                }
                if (empty($it['expiry'])) {
                    $it['expiry'] = null;
                }
                foreach (['pack_size','pack_purchased_quantity','return_pack_quantity','return_unit_quantity','pack_purchase_price','unit_purchase_price','item_discount_percentage','sub_total'] as $k) {
                    if (!isset($it[$k]) || $it[$k] === '') $it[$k] = 0;
                }
            }
            unset($it);
        }

        return $data;
    }

    private function makeCode(): string
    {
        $next = (PurchaseReturn::max('id') ?? 0) + 1;
        return 'PR-' . str_pad((string)$next, 6, '0', STR_PAD_LEFT);
    }
}
