<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\SaleInvoiceController;
use App\Http\Controllers\SupplierLedgerController;

// --- Server-rendered routes FIRST ---
Route::get('/print/sale-invoices/{invoice}', [SaleInvoiceController::class, 'print'])
    ->whereNumber('invoice')
    ->name('sale-invoices.print');
Route::get('/supplier-ledger/print', [SupplierLedgerController::class, 'print'])
     ->name('supplier-ledger.print');
// (add any other Blade/PDF routes here)
// Route::get('/reports/sale-detail/pdf', ...);

// --- React SPA catch-all LAST and excluding /print/* ---
Route::view('/{path?}', 'index')
    ->where('path', '^(?!print/).*$');
