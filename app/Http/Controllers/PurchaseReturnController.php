<?php

namespace App\Http\Controllers;

use App\Models\PurchaseReturn;
use App\Models\PurchaseReturnItem;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class PurchaseReturnController extends Controller
{
    public function index()
    {
        return PurchaseReturn::with(['supplier', 'purchaseInvoice', 'items.product'])
            ->latest()
            ->get();
    }

    /**
     * Normalize:
     * - turn empty strings into nulls for nullable fields
     * - coerce purchase_invoice_id "" -> null
     */
    private function normalizePayload(array $data): array
    {
        // top-level
        if (!isset($data['purchase_invoice_id']) || trim((string)$data['purchase_invoice_id']) === '') {
            $data['purchase_invoice_id'] = null;
        }

        // items
        $items = $data['items'] ?? [];
        $data['items'] = array_map(function ($it) {
            $it['batch']  = isset($it['batch'])  && trim((string)$it['batch']) !== '' ? trim((string)$it['batch']) : null;
            $it['expiry'] = isset($it['expiry']) && trim((string)$it['expiry']) !== '' ? $it['expiry'] : null;
            return $it;
        }, $items);

        return $data;
    }

    private function baseRules(): array
    {
        return [
            'supplier_id'           => 'required|exists:suppliers,id',
            'posted_number'         => 'required|unique:purchase_returns,posted_number',
            'date'                  => 'required|date',
            // Open return allowed
            'purchase_invoice_id'   => 'nullable|exists:purchase_invoices,id',
            'gross_total'           => 'required|numeric',
            'discount_percentage'   => 'nullable|numeric',
            'tax_percentage'        => 'nullable|numeric',
            'discount_amount'       => 'nullable|numeric',
            'tax_amount'            => 'nullable|numeric',
            'total'                 => 'required|numeric',

            'items'                           => 'required|array|min:1',
            'items.*.product_id'              => 'required|exists:products,id',
            'items.*.batch'                   => 'nullable|string',
            'items.*.expiry'                  => 'nullable|date',
            'items.*.pack_size'               => 'required|integer',
            'items.*.pack_purchased_quantity' => 'nullable|integer',
            'items.*.return_pack_quantity'    => 'required|integer',
            'items.*.return_unit_quantity'    => 'required|integer',
            'items.*.pack_purchase_price'     => 'required|numeric',
            'items.*.unit_purchase_price'     => 'required|numeric',
            'items.*.item_discount_percentage'=> 'nullable|numeric',
            'items.*.sub_total'               => 'required|numeric',
        ];
    }

    /**
     * Build a map: product_id => requireBatch (true only if ALL lines on the invoice had a batch)
     */
    private function productRequireBatchMap(?int $purchaseInvoiceId): array
    {
        if (!$purchaseInvoiceId) return [];

        $rows = DB::table('purchase_invoice_items')
            ->where('purchase_invoice_id', $purchaseInvoiceId)
            ->select('product_id', 'batch')
            ->get();

        // For each product, track whether any line had an empty batch
        $info = []; // product_id => ['has_batch'=>bool, 'has_empty'=>bool]
        foreach ($rows as $r) {
            $pid = $r->product_id;
            $hasBatch = $r->batch !== null && trim((string)$r->batch) !== '';
            if (!isset($info[$pid])) $info[$pid] = ['has_batch' => false, 'has_empty' => false];
            if ($hasBatch) $info[$pid]['has_batch'] = true; else $info[$pid]['has_empty'] = true;
        }

        // Require batch only if ALL lines for that product on that invoice had batch (i.e., no empty)
        $require = [];
        foreach ($info as $pid => $flags) {
            $require[$pid] = $flags['has_batch'] && !$flags['has_empty'];
        }
        return $require;
    }

    public function store(Request $request)
    {
        $payload = $this->normalizePayload($request->all());
        $v = Validator::make($payload, $this->baseRules());

        $v->after(function ($validator) use ($payload) {
            // Only enforce from invoice context
            $requireMap = $this->productRequireBatchMap($payload['purchase_invoice_id'] ?? null);
            if (!$requireMap) return;

            foreach (($payload['items'] ?? []) as $idx => $it) {
                $pid = $it['product_id'] ?? null;
                if (!$pid) continue;
                $mustHave = (bool)($requireMap[$pid] ?? false);
                if ($mustHave && (empty($it['batch']) || trim((string)$it['batch']) === '')) {
                    $validator->errors()->add("items.$idx.batch", 'Batch is required for this product.');
                }
            }
        });

        $data = $v->validate();

        return DB::transaction(function () use ($data) {
            $pr = PurchaseReturn::create(Arr::except($data, ['items']));
            $pr->items()->createMany($data['items']);
            return response()->json($pr->load('items.product'), 201);
        });
    }

    public function show(PurchaseReturn $purchaseReturn)
    {
        return $purchaseReturn->load(['supplier', 'purchaseInvoice', 'items.product']);
    }

    public function update(Request $request, PurchaseReturn $purchaseReturn)
    {
        $payload = $this->normalizePayload($request->all());

        $rules = $this->baseRules();
        $rules['posted_number'] = 'required|unique:purchase_returns,posted_number,' . $purchaseReturn->id;
        $v = Validator::make($payload, $rules);

        $v->after(function ($validator) use ($payload) {
            $requireMap = $this->productRequireBatchMap($payload['purchase_invoice_id'] ?? null);
            if (!$requireMap) return;

            foreach (($payload['items'] ?? []) as $idx => $it) {
                $pid = $it['product_id'] ?? null;
                if (!$pid) continue;
                $mustHave = (bool)($requireMap[$pid] ?? false);
                if ($mustHave && (empty($it['batch']) || trim((string)$it['batch']) === '')) {
                    $validator->errors()->add("items.$idx.batch", 'Batch is required for this product.');
                }
            }
        });

        $data = $v->validate();

        return DB::transaction(function () use ($purchaseReturn, $data) {
            $purchaseReturn->update(Arr::except($data, ['items']));
            $purchaseReturn->items()->delete();
            $purchaseReturn->items()->createMany($data['items']);
            return response()->json($purchaseReturn->load('items.product'));
        });
    }

    public function destroy(PurchaseReturn $purchaseReturn)
    {
        $purchaseReturn->items()->delete();
        $purchaseReturn->delete();
        return response()->json(null, 204);
    }

    public function generateNewCode()
    {
        $latest = PurchaseReturn::latest()->first();
        $code = 'PR-' . str_pad(($latest ? $latest->id + 1 : 1), 5, '0', STR_PAD_LEFT);
        return response()->json(['code' => $code]);
    }
}
