<?php

namespace App\Http\Controllers;

use App\Models\Customer;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\StreamedResponse;

class CustomerController extends Controller
{
    public function index()
    {
        // Count via subqueries (no dependency on relation names)
        $customers = Customer::query()
            ->select('customers.*')
            ->selectSub(
                'SELECT COUNT(*) FROM sale_invoices si WHERE si.customer_id = customers.id',
                'sale_invoices_count'
            )
            ->selectSub(
                'SELECT COUNT(*) FROM sale_returns sr WHERE sr.customer_id = customers.id',
                'sale_returns_count'
            )
            ->orderBy('name')
            ->get();

        // Expose a combined count used by the UI
        $customers->transform(function ($c) {
            $c->transactions_count = (int) ($c->sale_invoices_count ?? 0) + (int) ($c->sale_returns_count ?? 0);
            return $c;
        });

        return response()->json($customers);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name'    => 'required|unique:customers,name',
            'email'   => 'nullable|email|unique:customers,email',
            'phone'   => 'nullable|string',
            'address' => 'nullable|string',
        ]);
        $customer = Customer::create($validated);
        return response()->json($customer, 201);
    }

    public function show(Customer $customer)
    {
        return response()->json($customer);
    }

    public function update(Request $request, Customer $customer)
    {
        $validated = $request->validate([
            'name'    => 'required|unique:customers,name,' . $customer->id,
            'email'   => 'nullable|email|unique:customers,email,' . $customer->id,
            'phone'   => 'nullable|string',
            'address' => 'nullable|string',
        ]);
        $customer->update($validated);
        return response()->json($customer);
    }

    public function destroy(Customer $customer)
    {
        // Hard guard: block delete if referenced in invoices/returns
        $hasInvoices = DB::table('sale_invoices')->where('customer_id', $customer->id)->exists();
        $hasReturns  = DB::table('sale_returns')->where('customer_id', $customer->id)->exists();

        if ($hasInvoices || $hasReturns) {
            return response()->json([
                'message' => 'Cannot delete: customer has related sale invoices/returns.'
            ], 422);
        }

        $customer->delete();
        return response()->json(null, 204);
    }
    public function export(): StreamedResponse
{
    $file = 'customers_'.now()->format('Y-m-d_H-i-s').'.csv';

    return response()->streamDownload(function () {
        $out = fopen('php://output', 'w');
        // UTF-8 BOM for Excel
        fprintf($out, chr(0xEF).chr(0xBB).chr(0xBF));
        // Header
        fputcsv($out, ['name','email','phone','address']);

        \App\Models\Customer::select('name','email','phone','address')
            ->orderBy('name')
            ->chunk(1000, function ($chunk) use ($out) {
                foreach ($chunk as $c) {
                    fputcsv($out, [
                        (string)($c->name ?? ''),
                        (string)($c->email ?? ''),
                        (string)($c->phone ?? ''),
                        (string)($c->address ?? ''),
                    ]);
                }
            });

        fclose($out);
    }, $file, ['Content-Type' => 'text/csv; charset=UTF-8']);
}
}
