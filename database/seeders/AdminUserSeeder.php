<?php
namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class AdminUserSeeder extends Seeder
{
    public function run(): void
    {
        // clear cache (safe to do here too)
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        $user = User::firstOrCreate(
            ['email' => 'admin@example.com'],
            ['name' => 'Admin User', 'password' => Hash::make('password'), 'status' => 'active']
        );

        // fetch the role explicitly on the same guard
        $adminRole = Role::where('name', 'Admin')->where('guard_name', 'sanctum')->first();

        // attach role (user inherits all permissions from the role)
        $user->syncRoles([$adminRole]);

        // (optional) clear cache again
        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
}
