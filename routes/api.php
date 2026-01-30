<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Auth\MeController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\BatchController;
use App\Http\Controllers\BackupController;
use App\Http\Controllers\BrandController;
use App\Http\Controllers\BrandImportController;
use App\Http\Controllers\CategoryController;
use App\Http\Controllers\CategoryImportController;
use App\Http\Controllers\CustomerController;
use App\Http\Controllers\CustomerImportController;
use App\Http\Controllers\CustomerLedgerController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\LicenseController;
use App\Http\Controllers\PermissionController;
use App\Http\Controllers\ProductController;
use App\Http\Controllers\ProductImportController;
use App\Http\Controllers\PurchaseInvoiceController;
use App\Http\Controllers\PurchaseOrderController;
use App\Http\Controllers\PurchaseReturnController;
use App\Http\Controllers\ReportsController;
use App\Http\Controllers\RoleController;
use App\Http\Controllers\SaleInvoiceController;
use App\Http\Controllers\SaleReturnController;
use App\Http\Controllers\SettingController;
use App\Http\Controllers\StockAdjustmentController;
use App\Http\Controllers\SupplierController;
use App\Http\Controllers\SupplierImportController;
use App\Http\Controllers\SupplierLedgerController;
use App\Http\Controllers\UpdateController;
use App\Http\Controllers\UserController;

/*
|--------------------------------------------------------------------------
| Public/Auth endpoints
|--------------------------------------------------------------------------
*/
Route::post('/login', [AuthController::class, 'login']);
Route::middleware(['auth:sanctum'])->get('/user', [AuthController::class, 'user']);
Route::middleware('auth:sanctum')->put('/profile', [AuthController::class, 'updateProfile']);
Route::middleware('auth:sanctum')->post('/logout', [AuthController::class, 'logout']);

/*
|--------------------------------------------------------------------------
| Auth-only (NO license gate) — allow shell to render & license to activate
|--------------------------------------------------------------------------
*/
Route::middleware(['auth:sanctum'])->group(function () {
    // Password verification (for license management in settings)
    Route::post('/verify-password', [AuthController::class, 'confirmPassword']);

    // License endpoints
    Route::get('/license/status',     [LicenseController::class, 'status']);
    Route::post('/license/activate',  [LicenseController::class, 'activate']);
    Route::post('/license/deactivate',[LicenseController::class, 'deactivate']); // optional

    // Keep /me here so dashboard shell can mount pre-activation
    Route::get('/me', MeController::class);
});

/*
|--------------------------------------------------------------------------
| Auth + Licensed — EVERYTHING ELSE is gated
|--------------------------------------------------------------------------
*/
Route::middleware(['auth:sanctum', 'licensed'])->group(function () {
    Route::post('/auth/confirm-password', [AuthController::class, 'confirmPassword']);

    // Users
    Route::resource('users', UserController::class);
    Route::put('/users/{user}/roles', [UserController::class, 'syncRoles']);
    Route::put('/users/{user}/permissions', [UserController::class, 'syncPermissions']);

    // Roles
    Route::get('/roles',          [RoleController::class, 'index']);
    Route::post('/roles',         [RoleController::class, 'store']);
    Route::get('/roles/{role}',   [RoleController::class, 'show']);
    Route::put('/roles/{role}',   [RoleController::class, 'update']);
    Route::delete('/roles/{role}',[RoleController::class, 'destroy']);

    // Permissions (single set — removed duplicate index)
    Route::get('/permissions',                     [PermissionController::class, 'index'])->middleware('permission:permission.view');
    Route::post('/permissions',                    [PermissionController::class, 'store'])->middleware('permission:permission.create');
    Route::delete('/permissions/{permission}',     [PermissionController::class, 'destroy'])->middleware('permission:permission.delete');

    // Quick searches
    Route::get('/brands/search',      [BrandController::class, 'search']);
    Route::get('/categories/search',  [CategoryController::class, 'search']);
    Route::get('/suppliers/search',   [SupplierController::class, 'search']);
    Route::get('/customers/search',   [CustomerController::class, 'search']);

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
    Route::get('products/new-code',                [ProductController::class, 'generateNewCode']);
    Route::get('products/{product}/batches',      [BatchController::class, 'index']);
    Route::get('products/available-quantity',     [ProductController::class, 'availableQuantity']);
    Route::get('/products/search',                [ProductController::class, 'search']);
        // Optional extra endpoints (if you rely on them)
    Route::get('/products/export',                 [ProductController::class, 'export'])->middleware('can:product.export');
    Route::patch('/products/bulk-update-meta',     [ProductController::class, 'bulkUpdateMeta'])->middleware('can:product.update');
    Route::post('/products/bulk-destroy', [ProductController::class, 'bulkDestroy']);
    Route::apiResource('products', ProductController::class);

    // Purchases
    Route::get('purchase-invoices/new-code',      [PurchaseInvoiceController::class, 'generateNewCode']);
    Route::get('purchase-invoices/check-unique',  [PurchaseInvoiceController::class, 'checkUnique']);
    Route::apiResource('purchase-invoices',       PurchaseInvoiceController::class);

    // Purchase returns
    Route::get('purchase-returns/new-code',       [PurchaseReturnController::class, 'generateNewCode']);
    Route::apiResource('purchase-returns',        PurchaseReturnController::class);

    // Sales
    Route::get('sale-invoices/new-code',          [SaleInvoiceController::class, 'generateNewCode']);
    Route::apiResource('sale-invoices',           SaleInvoiceController::class);

    // Sale returns
    Route::get('sale-returns/new-code',           [SaleReturnController::class, 'generateNewCode']);
    Route::apiResource('sale-returns',            SaleReturnController::class);

    // Purchase Orders
    Route::get('/purchase-orders/forecast',       [PurchaseOrderController::class, 'forecast']);

    // Dashboard
    Route::get('/dashboard/summary',              [DashboardController::class, 'summary']);
    Route::get('/dashboard/near-expiry',          [DashboardController::class, 'nearExpiry']);
    Route::get('/dashboard/near-expiry/filters',  [DashboardController::class, 'nearExpiryFilters']);
    Route::get('/dashboard/invoice-counts',       [DashboardController::class, 'invoiceCounts']);
    Route::get('/dashboard/sales-by-brands',      [DashboardController::class, 'salesByBrands']);
    Route::get('/dashboard/top-products',         [DashboardController::class, 'topProducts']);
    Route::get('/dashboard/kpi-metrics',          [DashboardController::class, 'kpiMetrics']);

    // Reports
    Route::get('/reports/cost-of-sale',           [ReportsController::class, 'costOfSale']);
    Route::get('/reports/purchase-detail',        [ReportsController::class, 'purchaseDetail']);
    Route::get('/reports/purchase-detail/pdf',    [ReportsController::class, 'purchaseDetailPdf']);
    Route::get('/reports/sale-detail',            [ReportsController::class, 'saleDetail']);
    Route::get('/reports/sale-detail/pdf',        [ReportsController::class, 'saleDetailPdf']);
    Route::get('/reports/current-stock',          [ReportsController::class, 'currentStock']);
    Route::get('/reports/current-stock/pdf',      [ReportsController::class, 'currentStockPdf']);
    Route::get('/reports/stock-adjustment',       [ReportsController::class, 'stockAdjustment']);
    Route::get('/reports/stock-adjustment/pdf',   [ReportsController::class, 'stockAdjustmentPdf']);
    Route::get('/reports/product-comprehensive',  [ReportsController::class, 'productComprehensive']);
    Route::get('/reports/product-comprehensive/pdf', [ReportsController::class, 'productComprehensivePdf']);
    Route::put('/sale-invoices/{saleInvoice}/meta',[SaleInvoiceController::class, 'updateMeta']);


    // Settings
    Route::get('/settings',                       [SettingController::class, 'show']);
    Route::post('/settings',                      [SettingController::class, 'update']);

    // Backups
    Route::get('/backups/stats',                  [BackupController::class, 'stats']);
    Route::get('/backups',                        [BackupController::class, 'index']);
    Route::post('/backups',                       [BackupController::class, 'store']);
    Route::get('/backups/{id}/download',          [BackupController::class, 'download']);
    Route::post('/backups/{id}/restore',          [BackupController::class, 'restore']);
    Route::delete('/backups/{id}',                [BackupController::class, 'destroy']);
    Route::post('/backups/upload/validate',       [BackupController::class, 'validateUpload']);
    Route::post('/backups/upload',                [BackupController::class, 'upload']);
    Route::post('/backups/upload/restore',        [BackupController::class, 'restoreFromUpload']);

    // Updates
    Route::get('/updates/status',                 [UpdateController::class, 'status']);
    Route::get('/updates/check',                  [UpdateController::class, 'check']);
    Route::get('/updates/latest',                 [UpdateController::class, 'latestRelease']);
    Route::post('/updates/install',               [UpdateController::class, 'install']);
    Route::put('/updates/settings',               [UpdateController::class, 'updateSettings']);
    Route::get('/updates/logs',                   [UpdateController::class, 'logs']);

    // Supplier Import
    Route::get('/suppliers/import/template',      [SupplierImportController::class, 'template'])->middleware('permission:supplier.import');
    Route::post('/suppliers/import/validate',     [SupplierImportController::class, 'validateUpload'])->middleware('permission:supplier.import');
    Route::post('/suppliers/import/commit',       [SupplierImportController::class, 'commit'])->middleware('permission:supplier.import');

    // Brands import
    Route::get('/brands/import/template',         [BrandImportController::class, 'template'])->middleware('permission:brand.import');
    Route::post('/brands/import/validate',        [BrandImportController::class, 'validateUpload'])->middleware('permission:brand.import');
    Route::post('/brands/import/commit',          [BrandImportController::class, 'commit'])->middleware('permission:brand.import');

    // Categories import
    Route::get('/categories/import/template',     [CategoryImportController::class, 'template'])->middleware('permission:category.import');
    Route::post('/categories/import/validate',    [CategoryImportController::class, 'validateUpload'])->middleware('permission:category.import');
    Route::post('/categories/import/commit',      [CategoryImportController::class, 'commit'])->middleware('permission:category.import');

    // Customers import
    Route::get('/customers/import/template',      [CustomerImportController::class, 'template'])->middleware('permission:customer.import');
    Route::post('/customers/import/validate',     [CustomerImportController::class, 'validateUpload'])->middleware('permission:customer.import');
    Route::post('/customers/import/commit',       [CustomerImportController::class, 'commit'])->middleware('permission:customer.import');

    // Product import
    Route::get('/products/import/template',       [ProductImportController::class, 'template'])->middleware('permission:product.import');
    Route::post('/products/import/validate',      [ProductImportController::class, 'validateUpload'])->middleware('permission:product.import');
    Route::post('/products/import/commit',        [ProductImportController::class, 'commit'])->middleware('permission:product.import');

    // Stock Adjustments
    Route::get('/stock-adjustments',              [StockAdjustmentController::class, 'index']);
    Route::post('/stock-adjustments',             [StockAdjustmentController::class, 'store']);
    Route::get('/stock-adjustments/new-code',     [StockAdjustmentController::class, 'newCode']);
    Route::get('/stock-adjustments/{id}',         [StockAdjustmentController::class, 'show']);
    Route::put('/stock-adjustments/{id}',         [StockAdjustmentController::class, 'update']);
    Route::delete('/stock-adjustments/{id}',      [StockAdjustmentController::class, 'destroy']);

    // Supplier Ledger
    Route::get('/supplier-ledger',                [SupplierLedgerController::class, 'index']);
    Route::post('/supplier-ledger',               [SupplierLedgerController::class, 'store']);
    Route::put('/supplier-ledger/bulk',           [SupplierLedgerController::class, 'bulkUpdate']);
    Route::delete('/supplier-ledger/{id}',        [SupplierLedgerController::class, 'destroy']);
    Route::post('/supplier-ledger/rebuild',       [SupplierLedgerController::class, 'rebuild']);

    // Customer Ledger
    Route::get('/customer-ledger',                [CustomerLedgerController::class, 'index']);
    Route::post('/customer-ledger',               [CustomerLedgerController::class, 'store']);
    Route::put('/customer-ledger/bulk',           [CustomerLedgerController::class, 'bulkUpdate']);
    Route::delete('/customer-ledger/{customerLedger}', [CustomerLedgerController::class, 'destroy']);
    Route::post('/customer-ledger/rebuild',       [CustomerLedgerController::class, 'rebuild']);
});
