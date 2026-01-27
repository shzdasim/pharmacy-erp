<?php

namespace App\Http\Controllers;

use App\Models\Batch;
use App\Models\Product;
use App\Models\PurchaseInvoice;
use App\Models\SupplierLedger;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class PurchaseInvoiceController extends Controller
{
    // (Legacy helper) Generate new invoice code — kept for backward compatibility, but
    // the UI no longer calls this; posted_number is now assigned server-side on SAVE.
    public function generateNewCode()
    {
        $this->authorize('create', PurchaseInvoice::class);
        $lastInvoice = PurchaseInvoice::orderBy('id', 'desc')->first();

        if ($lastInvoice && $lastInvoice->posted_number && preg_match('/PRINV-(\d+)/', $lastInvoice->posted_number, $matches)) {
            $lastCodeNum = (int) $matches[1];
            $newCodeNum = $lastCodeNum + 1;
        } else {
            $newCodeNum = 1;
        }

        $formattedCode = 'PRINV-' . str_pad($newCodeNum, 4, '0', STR_PAD_LEFT);
        return response()->json(['posted_number' => $formattedCode]);
    }

    // List all invoices
    public function index(Request $request)
    {
        $this->authorize('viewAny', PurchaseInvoice::class);
        $qPosted   = trim((string) $request->query('posted'));
        $qSupplier = trim((string) $request->query('supplier'));

        $query = PurchaseInvoice::with(['supplier']);

        if ($qPosted !== '') {
            $query->where('posted_number', 'like', '%' . $qPosted . '%');
        }

        if ($qSupplier !== '') {
            $query->whereHas('supplier', function ($q) use ($qSupplier) {
                $q->where('name', 'like', '%' . $qSupplier . '%');
            });
        }

        return $query->orderByDesc('id')->get();
    }

    // Show single invoice
    public function show(PurchaseInvoice $purchaseInvoice)
    {
        $this->authorize('view', $purchaseInvoice);
        return $purchaseInvoice->load('supplier', 'items.product');
    }

    // Store new invoice — posted_number is assigned HERE (atomic, race-safe)
    public function store(Request $request)
    {
        $this->authorize('create', PurchaseInvoice::class);
        $data = $request->validate([
            'supplier_id'          => 'required|exists:suppliers,id',
            'invoice_type'         => 'nullable|string|in:credit,debit,default:debit',
            // 'posted_number'      => now generated server-side
            'posted_date'          => 'required|date',
            'remarks'              => 'nullable|string',
            'invoice_number'       => 'required|string|unique:purchase_invoices,invoice_number',
            'invoice_amount'       => 'required|numeric',
            'tax_percentage'       => 'nullable|numeric',
            'tax_amount'           => 'nullable|numeric',
            'discount_percentage'  => 'nullable|numeric',
            'discount_amount'      => 'nullable|numeric',
            'total_amount'         => 'required|numeric|min:0',
            'total_paid'           => 'nullable|numeric|min:0',

            'items'                                => 'required|array',
            'items.*.product_id'                   => 'required|exists:products,id',
            'items.*.pack_size'                    => 'nullable|integer',
            'items.*.batch'                        => 'nullable|string',
            'items.*.expiry'                       => 'nullable|date',
            'items.*.pack_quantity'                => 'required|numeric',
            'items.*.unit_quantity'                => 'required|integer',
            'items.*.pack_purchase_price'          => 'required|numeric',
            'items.*.unit_purchase_price'          => 'required|numeric',
            'items.*.pack_sale_price'              => 'required|numeric',
            'items.*.unit_sale_price'              => 'required|numeric',
            'items.*.item_discount_percentage'     => 'nullable|numeric|min:0',
            'items.*.pack_bonus'                   => 'nullable|numeric|min:0',
            'items.*.unit_bonus'                   => 'nullable|integer|min:0',
            'items.*.margin'                       => 'required|numeric',
            'items.*.sub_total'                    => 'required|numeric',
            'items.*.avg_price'                    => 'required|numeric',
            'items.*.quantity'                     => 'required|integer',
        ]);

        if (!array_key_exists('total_paid', $data) || $data['total_paid'] === null || $data['total_paid'] === '') {
            $data['total_paid'] = $data['total_amount'] ?? 0;
        }

        try {
            return DB::transaction(function () use ($data) {
                // Lock the sequence by selecting last row FOR UPDATE to avoid two requests
                // generating the same posted_number when saving concurrently.
                $prefix = 'PRINV-';
                $lastPosted = DB::table('purchase_invoices')
                    ->whereNotNull('posted_number')
                    ->where('posted_number', 'like', $prefix . '%')
                    ->lockForUpdate()
                    ->orderByDesc('id')
                    ->value('posted_number');

                $nextNum = 1;
                if ($lastPosted && preg_match('/^' . preg_quote($prefix, '/') . '(\d+)$/', $lastPosted, $m)) {
                    $nextNum = (int) $m[1] + 1;
                }
                $nextCode = $prefix . str_pad($nextNum, 4, '0', STR_PAD_LEFT);

                $invoice = PurchaseInvoice::create(array_merge($data, [
                    'posted_number' => $nextCode,
                    'invoice_type'  => $data['invoice_type'] ?? 'debit',
                ]));

                $this->processInvoiceItems($invoice, $data['items']);

                $this->recalcProductsByIds(
                    collect($data['items'])->pluck('product_id')->unique()->all()
                );

                // Create supplier ledger entry ONLY for credit purchases
                $invoiceType = $data['invoice_type'] ?? 'debit';
if ($invoiceType === 'credit') {
                    $ledger = new SupplierLedger();
                    $ledger->supplier_id       = $data['supplier_id'];
                    $ledger->purchase_invoice_id = $invoice->id;
                    $ledger->entry_type        = 'invoice';
                    $ledger->is_manual         = false;
                    $ledger->entry_date        = $data['posted_date'];
                    $ledger->posted_number     = $nextCode;
                    $ledger->invoice_number    = $data['invoice_number'];
                    $ledger->invoice_total     = $data['total_amount'];
                    $ledger->total_paid        = $data['total_paid'] ?? 0;
                    $ledger->debited_amount    = 0;
                    $ledger->credit_remaining  = max((float)$data['total_amount'] - (float)($data['total_paid'] ?? 0), 0);
                    $ledger->payment_ref       = null;
                    $ledger->description       = 'Purchase invoice ' . $nextCode;
                    $ledger->created_by        = optional(Auth::user())->id;
                    $ledger->save();
                }

                // Return the created invoice including items and supplier for the client
                return response()->json($invoice->load('items.product', 'supplier'), 201);
            });
        } catch (\Illuminate\Database\QueryException $e) {
            // Likely unique-constraint violation (invoice_number / posted_number)
            return $this->respondDuplicateError($e);
        } catch (\Illuminate\Database\QueryException $e) {
            return $this->respondDuplicateError($e);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Error creating purchase invoice',
                'error'   => $e->getMessage()
            ], 500);
        }
    }

    // Update invoice (posted_number stays unchanged; do not regenerate)
    public function update(Request $request, PurchaseInvoice $purchaseInvoice)
    {
        $this->authorize('update', $purchaseInvoice);
        $data = $request->validate([
            'supplier_id'          => 'required|exists:suppliers,id',
            'invoice_type'         => 'nullable|string|in:credit,debit',
            // 'posted_number'      => not user-editable on update
            'posted_date'          => 'required|date',
            'remarks'              => 'nullable|string',
            'invoice_number'       => 'required|string|unique:purchase_invoices,invoice_number,' . $purchaseInvoice->id,
            'invoice_amount'       => 'required|numeric',
            'tax_percentage'       => 'nullable|numeric',
            'tax_amount'           => 'nullable|numeric',
            'discount_percentage'  => 'nullable|numeric',
            'discount_amount'      => 'nullable|numeric',
            'total_amount'         => 'required|numeric|min:0',
            'total_paid'           => 'nullable|numeric|min:0',

            'items'                                => 'required|array',
            'items.*.product_id'                   => 'required|exists:products,id',
            'items.*.pack_size'                    => 'nullable|integer',
            'items.*.batch'                        => 'nullable|string',
            'items.*.expiry'                       => 'nullable|date',
            'items.*.pack_quantity'                => 'required|numeric',
            'items.*.unit_quantity'                => 'required|integer',
            'items.*.pack_purchase_price'          => 'required|numeric',
            'items.*.unit_purchase_price'          => 'required|numeric',
            'items.*.pack_sale_price'              => 'required|numeric',
            'items.*.unit_sale_price'              => 'required|numeric',
            'items.*.item_discount_percentage'     => 'nullable|numeric|min:0',
            'items.*.pack_bonus'                   => 'nullable|numeric|min:0',
            'items.*.unit_bonus'                   => 'nullable|integer|min:0',
            'items.*.margin'                       => 'required|numeric',
            'items.*.sub_total'                    => 'required|numeric',
            'items.*.avg_price'                    => 'required|numeric',
            'items.*.quantity'                     => 'required|integer',
        ]);

        try {
            return DB::transaction(function () use ($purchaseInvoice, $data) {
                // Keep existing posted_number intact
                $data['posted_number'] = $purchaseInvoice->posted_number;

                // Store old invoice type before update
                $oldInvoiceType = $purchaseInvoice->invoice_type ?? 'debit';
                $newInvoiceType = $data['invoice_type'] ?? $oldInvoiceType;

                // Update invoice with explicit invoice_type
                $purchaseInvoice->update([
                    'supplier_id'        => $data['supplier_id'],
                    'invoice_type'       => $newInvoiceType,
                    'posted_number'      => $data['posted_number'],
                    'posted_date'        => $data['posted_date'],
                    'remarks'            => $data['remarks'] ?? null,
                    'invoice_number'     => $data['invoice_number'],
                    'invoice_amount'     => $data['invoice_amount'],
                    'tax_percentage'     => $data['tax_percentage'] ?? 0,
                    'tax_amount'         => $data['tax_amount'] ?? 0,
                    'discount_percentage'=> $data['discount_percentage'] ?? 0,
                    'discount_amount'    => $data['discount_amount'] ?? 0,
                    'total_amount'       => $data['total_amount'],
                    'total_paid'         => $data['total_paid'] ?? 0,
                ]);

                $purchaseInvoice->load('items');

                $affectedIds = $purchaseInvoice->items->pluck('product_id')->merge(
                    collect($data['items'])->pluck('product_id')
                )->unique()->all();

                foreach ($purchaseInvoice->items as $oldItem) {
                    $this->revertItem($oldItem, false);
                }

                $purchaseInvoice->items()->delete();
                $this->processInvoiceItems($purchaseInvoice, $data['items']);

                $this->recalcProductsByIds($affectedIds);

                // Handle supplier ledger entries
                // If invoice was previously credit but is now debit, delete the ledger entry
                if ($oldInvoiceType === 'credit' && $newInvoiceType !== 'credit') {
                    // Remove existing ledger entry for this invoice
                    SupplierLedger::where('purchase_invoice_id', $purchaseInvoice->id)->delete();
                }
                // If invoice is now credit, create or update ledger entry
                elseif ($newInvoiceType === 'credit') {
                    // Check if a ledger entry already exists for this invoice
                    $existingLedger = SupplierLedger::where('purchase_invoice_id', $purchaseInvoice->id)->first();
                    
                    if ($existingLedger) {
                        // Update existing ledger entry
                        $existingLedger->update([
                            'supplier_id'        => $data['supplier_id'],
                            'entry_date'         => $data['posted_date'],
                            'invoice_total'      => $data['total_amount'],
                            'total_paid'         => $data['total_paid'] ?? 0,
                            'credit_remaining'   => max((float)$data['total_amount'] - (float)($data['total_paid'] ?? 0), 0),
                            'description'        => 'Purchase invoice ' . $data['posted_number'],
                        ]);
                    } else {
                        // Create new ledger entry
                        $ledger = new SupplierLedger();
                        $ledger->supplier_id         = $data['supplier_id'];
                        $ledger->purchase_invoice_id = $purchaseInvoice->id;
                        $ledger->entry_type          = 'invoice';
                        $ledger->is_manual           = false;
                        $ledger->entry_date          = $data['posted_date'];
                        $ledger->posted_number       = $data['posted_number'];
                        $ledger->invoice_number      = $data['invoice_number'];
                        $ledger->invoice_total       = $data['total_amount'];
                        $ledger->total_paid          = $data['total_paid'] ?? 0;
                        $ledger->debited_amount      = 0;
                        $ledger->credit_remaining    = max((float)$data['total_amount'] - (float)($data['total_paid'] ?? 0), 0);
                        $ledger->payment_ref         = null;
                        $ledger->description         = 'Purchase invoice ' . $data['posted_number'];
                        $ledger->created_by          = optional(Auth::user())->id;
                        $ledger->save();
                    }
                }

                return response()->json($purchaseInvoice->load('items.product', 'supplier'));
            });
        } catch (\Illuminate\Database\QueryException $e) {
            // Likely unique-constraint violation (invoice_number / posted_number)
            return $this->respondDuplicateError($e);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Failed to update purchase invoice',
                'error'   => $e->getMessage()
            ], 500);
        }
    }

    // Delete invoice
    public function destroy(PurchaseInvoice $purchaseInvoice)
    {
        $this->authorize('delete', $purchaseInvoice);
        try {
            return DB::transaction(function () use ($purchaseInvoice) {
                $purchaseInvoice->load('items');

                $affectedIds = $purchaseInvoice->items->pluck('product_id')->unique()->all();

                foreach ($purchaseInvoice->items as $item) {
                    $this->revertItem($item, true);
                }

                $purchaseInvoice->items()->delete();
                $purchaseInvoice->delete();

                $this->recalcProductsByIds($affectedIds);

                return response()->json(['message' => 'Invoice and related data deleted successfully']);
            });
        } catch (\Illuminate\Database\QueryException $e) {
            // Likely unique-constraint violation (invoice_number / posted_number)
            return $this->respondDuplicateError($e);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Failed to delete invoice',
                'error'   => $e->getMessage()
            ], 500);
        }
    }

    
    private function respondDuplicateError(\Throwable $e)
    {
        // Try to infer which field caused the duplicate via constraint name/text
        $errorInfo = method_exists($e, 'errorInfo') ? ($e->errorInfo ?? []) : [];
        $message   = $errorInfo[2] ?? ($e->getMessage() ?? '');
        $mLower    = strtolower($message);

        $errors = [];

        if (str_contains($mLower, 'invoice_number')) {
            $errors['invoice_number'][] = 'Invoice number has already been taken for this supplier or globally.';
        }
        if (str_contains($mLower, 'posted_number')) {
            $errors['posted_number'][] = 'Posted number has already been assigned. Please try again.';
        }

        if (!$errors) {
            $errors['general'][] = 'Duplicate value detected.';
        }

        return response()->json([
            'message' => 'Validation failed. Please correct the highlighted fields.',
            'errors'  => $errors,
        ], 422);
    }

    private function processInvoiceItems(PurchaseInvoice $invoice, array $items): void
    {
        foreach ($items as $item) {
            $invoice->items()->create($item);

            $product = Product::find($item['product_id']);
            if ($product) {
                $product->applyPurchaseFromItem($item); 
            }

            if (!empty($item['batch']) && !empty($item['expiry'])) {
                $batch = \App\Models\Batch::firstOrNew([
                    'product_id'   => $item['product_id'],
                    'batch_number' => $item['batch'],
                    'expiry_date'  => $item['expiry'],
                ]);

                $batch->quantity = ($batch->exists ? (int) $batch->quantity : 0) + (int) $item['quantity'];
                $batch->save();
            }
        }
    }

    private function revertItem($item, bool $deleteBatch = false): void
    {
        $product = Product::find($item->product_id);
        if ($product) {
            $product->revertPurchaseFromItem($item); // uses avg_price
        }

        if (!empty($item->batch) && !empty($item->expiry)) {
            $batch = Batch::where('product_id', $item->product_id)
                ->where('batch_number', $item->batch)
                ->where('expiry_date', $item->expiry)
                ->first();

            if ($batch) {
                if ($deleteBatch) {
                    $batch->delete();
                } else {
                    $batch->quantity = max(0, (int) $batch->quantity - (int) $item->quantity);
                    $batch->save();
                }
            }
        }
    }

    private function recalcProductAverages(Product $product): void
    {
        $items = DB::table('purchase_invoice_items')
            ->where('product_id', $product->id)
            ->select('quantity', 'avg_price', 'id')
            ->orderBy('id')
            ->get();

        $totalQty  = 0;
        $totalCost = 0.0;

        foreach ($items as $item) {
            $q = (int) $item->quantity;
            $totalQty  += $q;
            $totalCost += $q * (float) $item->avg_price;
        }

        $avgPrice = $totalQty > 0 ? ($totalCost / $totalQty) : 0.0;

        $product->avg_price = round($avgPrice, 2);

        $product->margin = ($product->unit_sale_price > 0 && $avgPrice > 0)
            ? round((($product->unit_sale_price - $avgPrice) / $product->unit_sale_price) * 100, 2)
            : 0.0;

        $product->save();
    }

    private function recalcProductsByIds(array $productIds): void
    {
        foreach (array_unique($productIds) as $pid) {
            $product = Product::find($pid);
            if ($product) {
                $this->recalcProductAverages($product);
            }
        }
    }

    // AJAX: unique check per supplier
    public function checkUnique(Request $request)
    {
        $request->validate([
            'supplier_id'    => 'required|integer',
            'invoice_number' => 'required|string',
            'exclude_id'     => 'nullable|integer',
        ]);

        if ($request->filled('exclude_id')) {
            $invoice = PurchaseInvoice::findOrFail($request->input('exclude_id'));
            $this->authorize('update', $invoice);
        } else {
            $this->authorize('create', PurchaseInvoice::class);
        }

        $query = \App\Models\PurchaseInvoice::where('supplier_id', $request->supplier_id)
            ->where('invoice_number', $request->invoice_number);

        if ($request->filled('exclude_id')) {
            $query->where('id', '!=', $request->exclude_id);
        }

        $exists = $query->exists();

        return response()->json([
            'unique' => !$exists,
        ]);
    }
}