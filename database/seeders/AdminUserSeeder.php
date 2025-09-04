<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\Models\Role;

class AdminUserSeeder extends Seeder
{
    public function run()
    {
        // Roles
        $roles = ['super-admin', 'admin', 'pharmacist', 'salesman'];
        foreach ($roles as $role) {
            Role::firstOrCreate(['name' => $role, 'guard_name' => 'web']);
        }

        // Super Admin
        $admin = User::updateOrCreate(
    ['email' => 'admin@example.com'],
    ['name' => 'Admin', 'password' => bcrypt('secret123'), 'role' => 'admin']
);

        $admin->assignRole('super-admin');
    }
}
