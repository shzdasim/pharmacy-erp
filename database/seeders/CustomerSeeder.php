<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Carbon;

class CustomerSeeder extends Seeder
{
    public function run(): void
    {
        $now = Carbon::now();

        // Use upsert on unique key "email"
        DB::table('customers')->upsert([
            [
                'name'       => 'WALK-IN-CUSTOMER',
                'email'      => 'localcustomer@pos.com',
                'phone'      => '0300-9999999',
                'address'    => '123 Main St',
                'created_at' => $now,
                'updated_at' => $now,
            ],
        ], ['email'], ['name', 'phone', 'address', 'updated_at']);

        // Add any other seeded customers the same way (one row per array element)…
    }
}
