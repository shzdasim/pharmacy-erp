<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class RolesAndPermissionsSeeder extends Seeder
{
    public function run(): void
    {
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        $guard = 'sanctum';

        // ---- Keep your existing custom perms ----
        $baseCustom = [
            // Users
            'user.view','user.create','user.update','user.delete',
            'user.assign.roles','user.assign.permissions','user.manage',
            // Roles
            'role.view','role.create','role.update','role.delete','role.sync.permissions',
            // Permissions registry
            'permission.view','permission.create','permission.delete',
            // Legacy product/invoice (kept for compatibility if used anywhere)
            'product.view','product.create','product.update','product.delete',
            'invoice.view','invoice.create','invoice.update','invoice.delete',

            // Ledgers
            'customer-ledger.view','customer-ledger.create','customer-ledger.update','customer-ledger.delete',
            'supplier-ledger.view','supplier-ledger.create','supplier-ledger.update','supplier-ledger.delete',

            // Purchase Order Forecast
            'purchase-order.view','purchase-order.generate',

            // Reports
            'report.cost-of-sale.view', 'report.cost-of-sale.export',
            'report.purchase-detail.view', 'report.purchase-detail.export',
            'report.sale-detail.view', 'report.sale-detail.export', 'report.sale-detail.edit',
            'report.current-stock.view', 'report.current-stock.export',
            'report.stock-adjustment.view', 'report.stock-adjustment.export',
            'report.product-comprehensive.view', 'report.product-comprehensive.export',
        ];

        // ---- Domain modules & standard actions ----
        // CRUD + export/import for master data
        $masterModules = ['category','brand','supplier','product','customer'];
        $masterActions = ['view','create','update','delete','export','import'];

        // Documents (invoices/returns) – CRUD (+ export if you plan CSV/PDF dumps)
        $docModules = [
            'sale-invoice',
            'purchase-invoice',
            'sale-return',
            'purchase-return',
        ];
        $docActions = ['view','create','update','delete','export'];

        // Stock Adjustment – CRUD
        $stockModules = ['stock-adjustment'];
        $stockActions = ['view','create','update','delete'];

        // Settings – usually view/update only
        $settingsModules = ['settings'];
        $settingsActions = ['view','update'];

        // Backup System
        $backupModules = ['backup'];
        $backupActions = ['view','create','restore','delete','upload'];

        // Update System
        $updateModules = ['update'];
        $updateActions = ['view','check','install','logs','settings'];

        // Build final list
        $perms = [];

        foreach ($baseCustom as $p) $perms[] = $p;

        foreach ($masterModules as $m) {
            foreach ($masterActions as $a) $perms[] = "{$m}.{$a}";
        }

        foreach ($docModules as $m) {
            foreach ($docActions as $a) $perms[] = "{$m}.{$a}";
        }

        foreach ($stockModules as $m) {
            foreach ($stockActions as $a) $perms[] = "{$m}.{$a}";
        }

        foreach ($settingsModules as $m) {
            foreach ($settingsActions as $a) $perms[] = "{$m}.{$a}";
        }

        foreach ($backupModules as $m) {
            foreach ($backupActions as $a) $perms[] = "{$m}.{$a}";
        }

        foreach ($updateModules as $m) {
            foreach ($updateActions as $a) $perms[] = "{$m}.{$a}";
        }

        // Create if missing
        foreach (array_unique($perms) as $name) {
            Permission::firstOrCreate(['name' => $name, 'guard_name' => $guard]);
        }

        // Ensure Admin role exists and has everything
        $admin = Role::firstOrCreate(['name' => 'Admin', 'guard_name' => $guard]);
        $admin->syncPermissions(Permission::where('guard_name', $guard)->pluck('name')->all());

        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();
    }
}
