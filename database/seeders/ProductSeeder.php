<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Product;
use App\Models\Supplier;
use App\Models\Brand;
use App\Models\Category;
use Illuminate\Support\Str;

class ProductSeeder extends Seeder
{
    public function run(): void
    {
        $suppliers = Supplier::all();
        $brands = Brand::all();
        $categories = Category::all();

        for ($i = 1; $i <= 20; $i++) {
            $brand = $brands->random();
            $category = $categories->random();
            $supplier = $suppliers->random();

            Product::create([
                'product_code' => 'P-' . Str::upper(Str::random(6)),
                'name' => 'Product ' . $i,
                'image' => null,
                'formulation' => 'Tablet',
                'description' => 'Sample description for product ' . $i,
                'pack_size' => rand(5, 30),
                'quantity' => null,
                'pack_purchase_price' => rand(100, 500),
                'pack_sale_price' => rand(600, 1000),
                'unit_purchase_price' => rand(10, 50),
                'unit_sale_price' => rand(60, 100),
                'avg_price' => rand(50, 200),
                'margin' => null,
                'narcotic' => (rand(0, 1) ? 'yes' : 'no'),
                'max_discount' => rand(5, 15),
                'category_id' => $category->id,
                'brand_id' => $brand->id,
                'supplier_id' => $supplier->id,
                'rack' => 'Rack-' . rand(1, 10),
                'barcode' => 'BC-' . Str::upper(Str::random(8)),
            ]);
        }
    }
}
