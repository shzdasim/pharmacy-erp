<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class CategorySeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $categories = [
        ['name' => 'Tablets'],
        ['name' => 'Syrup'],
        ['name' => 'Injections'],
        ['name' => 'Ointments'],
        ['name' => 'Capsules'],
        ['name' => 'Powders'],
        ['name' => 'Suppositories'],
        ['name' => 'Creams'],
        ['name' => 'Lotions'],
        ['name' => 'Gels'],
        ['name' => 'Sprays'],
        ['name' => 'Drops'],
        ['name' => 'Inhalers'],
        ['name' => 'Pessaries'],
        ['name' => 'Patches'],
        ['name' => 'Elixirs'],
        ['name' => 'Suspensions'],
        ['name' => 'Solutions'],
        ['name' => 'Emulsions'],
        ['name' => 'Tinctures'],
       ];
       foreach ($categories as $category) {
        DB::table('categories')->insert([
            'name' => $category['name'],
            'created_at' => now(),
            'updated_at' => now(),
         ]);
        }
    }
}
