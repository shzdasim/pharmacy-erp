<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class RolesAndPermissionsSeeder extends Seeder
{
    public function run(): void
    {
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        $perms = [
            'user.view','user.create','user.update','user.delete',
            'user.assign.roles','user.assign.permissions','user.manage',
            'role.view','role.create','role.update','role.delete','role.sync.permissions',
            'permission.view','permission.create','permission.delete',
            // add your domain perms here...
            'product.view','product.create','product.update','product.delete',
            'invoice.view','invoice.create','invoice.update','invoice.delete',
        ];

        foreach ($perms as $p) {
            Permission::firstOrCreate(['name' => $p, 'guard_name' => 'sanctum']);
        }

        $admin = Role::firstOrCreate(['name' => 'Admin', 'guard_name' => 'sanctum']);
        $admin->syncPermissions(Permission::all());

        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();
    }
}
