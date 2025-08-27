<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\BatchController;
use App\Http\Controllers\BrandController;
use App\Http\Controllers\CategoryController;
use App\Http\Controllers\CustomerController;
use App\Http\Controllers\ProductController;
use App\Http\Controllers\PurchaseInvoiceController;
use App\Http\Controllers\PurchaseReturnController;
use App\Http\Controllers\SupplierController;

Route::post('/login', [AuthController::class, 'login']);
Route::middleware(['auth:sanctum'])->get('/user', [AuthController::class, 'user']);
Route::middleware('auth:sanctum')->put('/profile', [AuthController::class, 'updateProfile']);
Route::apiResource('suppliers', SupplierController::class);
Route::apiResource('customers', CustomerController::class);
Route::apiResource('categories', CategoryController::class);
Route::apiResource('brands', BrandController::class);
Route::get('products/new-code', [ProductController::class, 'generateNewCode']);
Route::get('/products/available-quantity', [ProductController::class, 'availableQuantity']);
Route::apiResource('products', ProductController::class);
Route::get('products/{product}/batches', [BatchController::class, 'index']);
Route::get('/purchase-invoices/check-unique', [PurchaseInvoiceController::class, 'checkUnique']);
Route::get('purchase-invoices/new-code', [PurchaseInvoiceController::class, 'generateNewCode']);
Route::apiResource('purchase-invoices', PurchaseInvoiceController::class);
Route::get('purchase-returns/new-code', [PurchaseReturnController::class, 'generateNewCode']);
Route::apiResource('purchase-returns', PurchaseReturnController::class);
