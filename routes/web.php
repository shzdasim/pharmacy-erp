<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\SaleInvoiceController;

// --- Server-rendered routes FIRST ---
Route::get('/print/sale-invoices/{invoice}', [SaleInvoiceController::class, 'print'])
    ->whereNumber('invoice')
    ->name('sale-invoices.print');

// (add any other Blade/PDF routes here)
// Route::get('/reports/sale-detail/pdf', ...);

// --- React SPA catch-all LAST and excluding /print/* ---
Route::view('/{path?}', 'index')
    ->where('path', '^(?!print/).*$');
