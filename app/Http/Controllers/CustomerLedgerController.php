<?php

namespace App\Http\Controllers;

use App\Models\CustomerLedger;
use App\Models\SaleInvoice;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class CustomerLedgerController extends Controller
{
    /* -------------------------------
       Helpers to read model fields safely
    --------------------------------- */
    private function num(...$vals): float
    {
        foreach ($vals as $v) {
            if ($v !== null && $v !== '') return (float)$v;
        }
        return 0.0;
    }

    private function str(...$vals): ?string
    {
        foreach ($vals as $v) {
            if (!is_null($v) && $v !== '') return (string)$v;
        }
        return null;
    }

    /** ================================
     * GET /api/customer-ledger?customer_id=&from=&to=
     * Build ledger view:
     *  - INVOICE rows are read-through from SaleInvoice
     *  - PAYMENT & MANUAL rows from CustomerLedger
     * ================================ */
    public function index(Request $request)
    {
        $request->validate([
            'customer_id' => ['required','integer','exists:customers,id'],
            'from'        => ['nullable','date'],
            'to'          => ['nullable','date'],
        ]);

        $customerId = (int)$request->customer_id;
        $from = $request->from;
        $to   = $request->to;

        // ---- Editable rows (payment + manual) ----
        $manualAndPayments = CustomerLedger::query()
            ->where('customer_id', $customerId)
            ->whereIn('entry_type', ['payment','manual'])
            ->when($from, fn($q)=>$q->whereDate('entry_date','>=',$from))
            ->when($to,   fn($q)=>$q->whereDate('entry_date','<=',$to))
            ->orderBy('entry_date')->orderBy('id')
            ->get();

        // ---- Invoice rows (read-through from sale_invoices) ----
        $invoices = SaleInvoice::query()
            ->where('customer_id', $customerId)
            ->when($from, fn($q)=>$q->whereDate('invoice_date','>=',$from))
            ->when($to,   fn($q)=>$q->whereDate('invoice_date','<=',$to))
            ->orderBy('invoice_date')->orderBy('id')
            ->get([
                // include generous set; we’ll pick what exists
                'id',
                'invoice_no',
                'posted_number',
                'invoice_date',
                'invoice_total', 'total', 'grand_total', 'net_total', 'gross_amount', 'sub_total',
                'total_receive', 'total_recieve', 'received', 'amount_received',
            ]);

        $invoiceRows = $invoices->map(function ($inv) use ($customerId) {
            // (3) Invoice Total – pick the first that exists on your model
            $invoiceTotal = $this->num(
                $inv->invoice_total ?? null,
                $inv->total ?? null,
                $inv->grand_total ?? null,
                $inv->net_total ?? null,
                $inv->gross_amount ?? null,
                $inv->sub_total ?? null
            );

            // (4) Received on Invoice – robust to spelling/alt columns
            $receivedOnInv = $this->num(
                $inv->total_receive ?? null,
                $inv->total_recieve ?? null,
                $inv->received ?? null,
                $inv->amount_received ?? null
            );

            $balanceRemain = max($invoiceTotal - $receivedOnInv, 0);

            return [
                'id'                => $inv->id, // invoice id (read-only row)
                'customer_id'       => $customerId,
                'sale_invoice_id'   => $inv->id,
                'entry_type'        => 'invoice',
                'is_manual'         => false,
                'entry_date'        => optional($inv->invoice_date)->format('Y-m-d'),
                // (1) Posted #
                'posted_number'     => $this->str($inv->posted_number),
                // Invoice # removed from UI
                // (3) Invoice Total
                'invoice_total'     => $invoiceTotal,
                // (4) Received on Invoice
                'total_received'    => $receivedOnInv,
                // (5) Received Payment (only for payments / manual)
                'credited_amount'   => 0,
                'payment_ref'       => '',
                // (6) Balance Remaining
                'balance_remaining' => round($balanceRemain, 2),
                'description'       => $this->str($inv->invoice_no ? ('Invoice #'.$inv->invoice_no) : null),
            ];
        });

        // ---- Normalize payment + manual rows ----
        $mp = $manualAndPayments->map(function (CustomerLedger $r) {
            $isInvoiceLike = $r->entry_type === 'manual';
            $invTotal  = $isInvoiceLike ? (float)($r->invoice_total ?? 0) : 0.0;
            $invRecv   = $isInvoiceLike ? (float)($r->total_received ?? 0) : 0.0;
            $balRemain = $isInvoiceLike ? max($invTotal - $invRecv, 0) : 0.0;

            return [
                'id'                => $r->id,
                'customer_id'       => $r->customer_id,
                'sale_invoice_id'   => $r->sale_invoice_id,
                'entry_type'        => $r->entry_type, // payment | manual
                'is_manual'         => (bool)$r->is_manual,
                'entry_date'        => optional($r->entry_date)->format('Y-m-d'),
                'posted_number'     => $r->posted_number,
                // invoice_number not used in UI anymore
                'invoice_total'     => $invTotal,
                'total_received'    => $invRecv,
                // (5) Received Payment
                'credited_amount'   => (float)($r->credited_amount ?? 0),
                'payment_ref'       => $r->payment_ref,
                'balance_remaining' => round($balRemain, 2),
                'description'       => $r->description,
            ];
        });

        // ---- Merge & sort ----
        $all = collect()->merge($invoiceRows)->merge($mp)
            ->sortBy([['entry_date','asc'],['id','asc']])
            ->values()
            ->all();

        // ---- Summary cards ----
        $totalInvoiced = 0.0;
        $receivedOnInv = 0.0;
        $paymentsCred  = 0.0;

        foreach ($all as $row) {
            if ($row['entry_type'] === 'invoice' || $row['entry_type'] === 'manual') {
                $totalInvoiced += (float)($row['invoice_total'] ?? 0);
                $receivedOnInv += (float)($row['total_received'] ?? 0);
            }
            if ($row['entry_type'] === 'payment') {
                $paymentsCred  += (float)($row['credited_amount'] ?? 0);
            }
        }

        $net = ($totalInvoiced - $receivedOnInv) - $paymentsCred;

        return response()->json([
            'data' => $all,
            'summary' => [
                'total_invoiced'      => round($totalInvoiced, 2),
                'received_on_invoice' => round($receivedOnInv, 2),
                'payments_credited'   => round($paymentsCred, 2),
                'net_balance'         => round($net, 2),
            ],
        ]);
    }

    /** ================================
     * POST /api/customer-ledger
     * Create PAYMENT or MANUAL row
     * ================================ */
    public function store(Request $request)
    {
        $data = $request->validate([
            'customer_id'     => ['required','integer','exists:customers,id'],
            'entry_date'      => ['required','date'],
            'entry_type'      => ['nullable', Rule::in(['payment','manual'])],
            'posted_number'   => ['nullable','string','max:100'],
            // invoice_number removed
            'invoice_total'   => ['nullable','numeric'],
            'total_received'  => ['nullable','numeric'],
            'credited_amount' => ['nullable','numeric'],
            'payment_ref'     => ['nullable','string','max:200'],
            'sale_invoice_id' => ['nullable','integer','exists:sale_invoices,id'],
            'description'     => ['nullable','string','max:500'],
        ]);

        $type = $data['entry_type'] ?? (!empty($data['credited_amount']) ? 'payment' : 'manual');

        $row = new CustomerLedger();
        $row->customer_id       = (int)$data['customer_id'];
        $row->entry_date        = $data['entry_date'];
        $row->entry_type        = $type;
        $row->is_manual         = true;
        $row->posted_number     = $data['posted_number'] ?? null;
        $row->invoice_total     = (float)($data['invoice_total']  ?? 0);
        $row->total_received    = (float)($data['total_received'] ?? 0);
        $row->balance_remaining = max($row->invoice_total - $row->total_received, 0);
        $row->credited_amount   = (float)($data['credited_amount'] ?? 0);
        $row->payment_ref       = $data['payment_ref'] ?? null;
        $row->sale_invoice_id   = $data['sale_invoice_id'] ?? null;
        $row->description       = $data['description'] ?? null;
        $row->created_by        = Auth::id();
        $row->save();

        return response()->json(['status' => 'ok', 'row' => $row], 201);
    }

    /** ================================
     * PUT /api/customer-ledger/bulk
     * Update PAYMENT or MANUAL rows
     * ================================ */
    public function bulkUpdate(Request $request)
    {
        $payload = $request->validate([
            'rows' => ['required','array','min:1'],
            'rows.*.id'              => ['required','integer','exists:customer_ledgers,id'],
            'rows.*.entry_date'      => ['required','date'],
            'rows.*.posted_number'   => ['nullable','string','max:100'],
            'rows.*.invoice_total'   => ['nullable','numeric'],
            'rows.*.total_received'  => ['nullable','numeric'],
            'rows.*.credited_amount' => ['nullable','numeric'],
            'rows.*.payment_ref'     => ['nullable','string','max:200'],
            'rows.*.description'     => ['nullable','string','max:500'],
        ]);

        DB::transaction(function () use ($payload) {
            foreach ($payload['rows'] as $r) {
                /** @var CustomerLedger $row */
                $row = CustomerLedger::findOrFail($r['id']);

                if ($row->entry_type === 'invoice' && !$row->is_manual) {
                    abort(422, 'Cannot update invoice rows');
                }

                $row->entry_date      = $r['entry_date'];
                $row->posted_number   = $r['posted_number']  ?? null;

                if ($row->entry_type === 'manual') {
                    $row->invoice_total     = (float)($r['invoice_total']  ?? 0);
                    $row->total_received    = (float)($r['total_received'] ?? 0);
                    $row->balance_remaining = max($row->invoice_total - $row->total_received, 0);
                }

                if ($row->entry_type === 'payment' || $row->is_manual) {
                    $row->credited_amount = (float)($r['credited_amount'] ?? 0);
                    $row->payment_ref     = $r['payment_ref'] ?? null;
                }

                $row->description = $r['description'] ?? null;
                $row->save();
            }
        });

        return response()->json(['status' => 'ok']);
    }

    /** ================================
     * DELETE /api/customer-ledger/{customerLedger}
     * ================================ */
    public function destroy(CustomerLedger $customerLedger)
    {
        if ($customerLedger->entry_type === 'invoice' && !$customerLedger->is_manual) {
            return response()->json(['message' => 'Cannot delete invoice row'], 422);
        }
        $customerLedger->delete();
        return response()->json(['status' => 'ok']);
    }

    /** ================================
     * POST /api/customer-ledger/rebuild { customer_id }
     * Upsert invoice rows with robust field reads
     * ================================ */
    public function rebuild(Request $request)
    {
        $request->validate([
            'customer_id' => ['required','integer','exists:customers,id'],
        ]);
        $customerId = (int)$request->customer_id;

        DB::transaction(function () use ($customerId) {
            $invoices = SaleInvoice::where('customer_id', $customerId)->get([
                'id','invoice_no','posted_number','invoice_date',
                'invoice_total','total','grand_total','net_total','gross_amount','sub_total',
                'total_receive','total_recieve','received','amount_received',
            ]);

            foreach ($invoices as $inv) {
                $invTotal = $this->num(
                    $inv->invoice_total ?? null,
                    $inv->total ?? null,
                    $inv->grand_total ?? null,
                    $inv->net_total ?? null,
                    $inv->gross_amount ?? null,
                    $inv->sub_total ?? null
                );
                $recv = $this->num(
                    $inv->total_receive ?? null,
                    $inv->total_recieve ?? null,
                    $inv->received ?? null,
                    $inv->amount_received ?? null
                );

                CustomerLedger::updateOrCreate(
                    [
                        'customer_id'     => $customerId,
                        'sale_invoice_id' => $inv->id,
                        'entry_type'      => 'invoice',
                        'is_manual'       => false,
                    ],
                    [
                        'entry_date'        => $inv->invoice_date ?? now()->toDateString(),
                        'posted_number'     => $this->str($inv->posted_number),
                        'invoice_total'     => $invTotal,
                        'total_received'    => $recv,
                        'balance_remaining' => max($invTotal - $recv, 0),
                        'credited_amount'   => 0,
                        'payment_ref'       => null,
                        'description'       => $this->str($inv->invoice_no ? ('Invoice #'.$inv->invoice_no) : null),
                    ]
                );
            }
        });

        return response()->json(['status' => 'ok', 'message' => 'Rebuilt from sale invoices']);
    }

    /** ================================
     * POST /api/auth/confirm-password
     * ================================ */
    public function confirmPassword(Request $request)
    {
        $request->validate(['password' => ['required','string']]);
        $user = Auth::user();
        if (!$user || !Hash::check($request->password, $user->password)) {
            return response()->json(['message' => 'Incorrect password'], 422);
        }
        return response()->json(['status' => 'ok']);
    }

    /** ================================
     * GET /customer-ledger/print
     * ================================ */
    public function printView(Request $request)
    {
        return response('<h3 style="font-family:sans-serif">Customer Ledger print endpoint is wired. Implement view as needed.</h3>');
    }
}
