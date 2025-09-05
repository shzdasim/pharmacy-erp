<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\BatchController;
use App\Http\Controllers\BrandController;
use App\Http\Controllers\BrandImportController;
use App\Http\Controllers\CategoryController;
use App\Http\Controllers\CategoryImportController;
use App\Http\Controllers\CustomerController;
use App\Http\Controllers\CustomerImportController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\ProductController;
use App\Http\Controllers\ProductImportController;
use App\Http\Controllers\PurchaseInvoiceController;
use App\Http\Controllers\PurchaseOrderController;
use App\Http\Controllers\PurchaseReturnController;
use App\Http\Controllers\ReportsController;
use App\Http\Controllers\SaleInvoiceController;
use App\Http\Controllers\SaleReturnController;
use App\Http\Controllers\SettingController;
use App\Http\Controllers\SupplierController;
use App\Http\Controllers\SupplierImportController;

Route::post('/login', [AuthController::class, 'login']);
Route::middleware(['auth:sanctum'])->get('/user', [AuthController::class, 'user']);
Route::middleware('auth:sanctum')->put('/profile', [AuthController::class, 'updateProfile']);
Route::middleware('auth:sanctum')->post('/logout', [AuthController::class, 'logout']);
Route::middleware('auth:sanctum')->group(function () {

    Route::get('/brands/search',    [BrandController::class, 'search']);
    Route::get('/categories/search',[CategoryController::class, 'search']);
    Route::get('/suppliers/search', [SupplierController::class, 'search']);
    // Master data
    Route::get('/categories/export', [CategoryController::class, 'export'])->name('categories.export');
    Route::apiResource('categories', CategoryController::class);
    Route::get('/brands/export', [BrandController::class, 'export'])->name('brands.export');
    Route::apiResource('brands', BrandController::class);
    Route::get('/customers/export', [CustomerController::class, 'export'])->name('customers.export');
    Route::apiResource('customers', CustomerController::class);
    Route::get('/suppliers/export', [SupplierController::class, 'export']);
    Route::apiResource('suppliers', SupplierController::class);

    // Products & batches
    Route::get('/products/search', [ProductController::class, 'search']);
    Route::get('products/new-code', [ProductController::class, 'generateNewCode']);
    Route::get('products/{product}/batches', [BatchController::class, 'index']);
    Route::get('products/available-quantity', [ProductController::class, 'availableQuantity']);
    Route::patch('/products/bulk-update-meta', [ProductController::class, 'bulkUpdateMeta']);
    Route::get('/products/export', [ProductController::class, 'export'])->name('products.export');
    Route::apiResource('products', ProductController::class);

    // Purchases
    Route::get('purchase-invoices/new-code', [PurchaseInvoiceController::class, 'generateNewCode']);
    Route::get('purchase-invoices/check-unique', [PurchaseInvoiceController::class, 'checkUnique']);
    Route::apiResource('purchase-invoices', PurchaseInvoiceController::class);

    // Purchase returns
    Route::get('purchase-returns/new-code', [PurchaseReturnController::class, 'generateNewCode']);
    Route::apiResource('purchase-returns', PurchaseReturnController::class);

    // Sales
    Route::get('sale-invoices/new-code', [SaleInvoiceController::class, 'generateNewCode']);
    Route::apiResource('sale-invoices', SaleInvoiceController::class);

    // Sale Returns
    Route::get('sale-returns/new-code', [SaleReturnController::class, 'generateNewCode']);
    Route::apiResource('sale-returns', SaleReturnController::class);

    // Purchase Orders
    Route::get('/purchase-orders/forecast', [PurchaseOrderController::class, 'forecast']);

    Route::get('/dashboard/summary', [DashboardController::class, 'summary']);
    Route::get('/dashboard/near-expiry', [DashboardController::class, 'nearExpiry']);
    Route::get('/dashboard/near-expiry/filters', [DashboardController::class, 'nearExpiryFilters']);

    // Reports
    Route::get('/reports/cost-of-sale', [ReportsController::class, 'costOfSale']);
    Route::get('/reports/purchase-detail', [ReportsController::class, 'purchaseDetail']);
    Route::get('/reports/purchase-detail/pdf', [ReportsController::class, 'purchaseDetailPdf']);
    Route::get('/reports/sale-detail', [ReportsController::class, 'saleDetail']);
    Route::get('/reports/sale-detail/pdf', [ReportsController::class, 'saleDetailPdf']);

    // Settings
    Route::get('/settings', [SettingController::class, 'show']);
    Route::post('/settings', [SettingController::class, 'update']);

    // Supplier Import
    Route::get('/suppliers/import/template', [SupplierImportController::class, 'template']);
    Route::post('/suppliers/import/validate', [SupplierImportController::class, 'validateUpload']);
    Route::post('/suppliers/import/commit',    [SupplierImportController::class, 'commit']);

    // Brands import
    Route::get('/brands/import/template', [BrandImportController::class, 'template']);
    Route::post('/brands/import/validate', [BrandImportController::class, 'validateUpload']);
    Route::post('/brands/import/commit',    [BrandImportController::class, 'commit']);

    // Categories import
    Route::get('/categories/import/template', [CategoryImportController::class, 'template']);
    Route::post('/categories/import/validate', [CategoryImportController::class, 'validateUpload']);
    Route::post('/categories/import/commit',    [CategoryImportController::class, 'commit']);

    // Customers import
    Route::get('/customers/import/template', [CustomerImportController::class, 'template']);
    Route::post('/customers/import/validate', [CustomerImportController::class, 'validateUpload']);
    Route::post('/customers/import/commit',    [CustomerImportController::class, 'commit']); 
    
    // Product import
    Route::get('/products/import/template', [ProductImportController::class, 'template']);
    Route::post('/products/import/validate', [ProductImportController::class, 'validateUpload']);
    Route::post('/products/import/commit',    [ProductImportController::class, 'commit']);

});


