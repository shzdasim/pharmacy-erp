<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class BrandSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $brands = [
            [
                'name' => 'Abbott Laboratories',
                'image' => 'brands/Abbott Laboratories.png'
            ],
            [
                'name' => 'Getz Pharma',
                'image' => 'brands/Getz Pharma.png'
            ],
            [
                'name' => 'Hilton Pharma',
                'image' => 'brands/Hilton Pharma.jpeg'
            ],
            [
                'name' => 'GlaxoSmithKline',
                'image' => 'brands/GlaxoSmithKline.svg'
            ],
            [
                'name' => 'Ferozsons Laboratories',
                'image' => 'brands/Ferozsons Laboratories.jpeg'
            ],
            [
                'name' => 'PharmEvo',
                'image' => 'brands/PharmEvo.png'
            ],
            [
                'name' => 'Sami Pharmaceuticals',
                'image' => 'brands/Sami Pharmaceuticals.png'
            ],
            [
                'name' => 'Sanofi Aventis',
                'image' => 'brands/Sanofi Aventis.png'
            ],
            [
                'name' => 'Pfizer',
                'image' => 'brands/Pfizer.png'
            ],
            [
                'name' => 'The Searle Company',
                'image' => 'brands/The Searle Company.png'
            ],
            [
                'name' => 'Highnoon Laboratories',
                'image' => 'brands/Highnoon Laboratories.jpeg'
            ],
            [
                'name' => 'Martin Dow',
                'image' => 'brands/Martin Dow.png'
            ],
            [
                'name' => 'Novartis Pharma',
                'image' => 'brands/Novartis Pharma.png'
            ],
            [
                'name' => 'Aspen Pharma',
                'image' => 'brands/Aspen Pharma.png'
            ],
            [
                'name' => 'Merck Pakistan',
                'image' => 'brands/Merck Pakistan.jpeg'
            ],
            [
                'name' => 'Atco Laboratories',
                'image' => 'brands/Atco Laboratories.png'
            ],
            [
                'name' => 'Platinum Pharmaceutical',
                'image' => 'brands/Platinum Pharmaceutical.png'
            ],
            [
                'name' => 'Bosch Pharmaceuticals',
                'image' => 'brands/Bosch Pharmaceuticals.png'
            ],
            [
                'name' => 'Brooks Pharma',
                'image' => 'brands/Brooks Pharma.png'
            ],
            [
                'name' => 'Genix Pharma',
                'image' => 'brands/Genix Pharma.png'
            ],
            [
                'name' => 'Wilson\'s Pharmaceuticals',
                'image' => 'brands/Wilsons Pharmaceuticals.png'
            ],
            [
                'name' => 'Premier Pharmaceuticals',
                'image' => 'brands/Premier Pharmaceuticals.png'
            ],
            [
                'name' => 'Schazoo Zaka',
                'image' => 'brands/Schazoo Zaka.jpeg'
            ],
            [
                'name' => 'Platinum Pharma',
                'image' => 'brands/Platinum Pharmaceutical.png'
            ],
            [
                'name' => 'Indus Pharma',
                'image' => 'brands/Indus Pharma.png'
            ],
            [
                'name' => 'Helicon Pharmaceutical',
                'image' => 'brands/Helicon Pharmaceutical.png'
            ],
            [
                'name' => 'Zafa Pharmaceutical',
                'image' => 'brands/Zafa Pharmaceutical.png'
            ],
            [
                'name' => 'Scottmann',
                'image' => 'brands/Scottmann.png'
            ],
            [
                'name' => 'Roche',
                'image' => 'brands/Roche.png'
            ],
            [
                'name' => 'Boehringer Ingelheim',
                'image' => 'brands/Boehringer Ingelheim.png'
            ],
            [
                'name' => 'Pharma Health',
                'image' => 'brands/Pharma Health.webp'
            ],
            [
                'name' => 'MediOne',
                'image' => 'brands/MediOne.png'
            ],
            [
                'name' => 'Bio-Labs',
                'image' => 'brands/Bio-Labs.webp'
            ],
            [
                'name' => 'AGP Limited',
                'image' => 'brands/AGP Limited.png'
            ],
            [
                'name' => 'Pacific Pharmaceuticals',
                'image' => 'brands/Pacific Pharmaceuticals.png'
            ],
            [
                'name' => 'Tabros Pharma',
                'image' => 'brands/Tabros Pharma.jpeg'
            ],
            [
                'name' => 'Pharmatec Pakistan',
                'image' => 'brands/Pharmatec Pakistan.png'
            ],
            [
                'name' => 'Selmore Pharma',
                'image' => 'brands/Selmore Pharma.png'
            ],
            [
                'name' => 'Ali Gohar Pharmaceuticals',
                'image' => 'brands/Ali Gohar Pharmaceuticals.jpeg'
            ],
            [
                'name' => 'Chiesi Pakistan',
                'image' => 'brands/Chiesi Pakistan.png'
            ],
            [
                'name' => 'Haleon Pakistan',
                'image' => 'brands/Haleon Pakistan.jpeg'
            ],
            [
                'name' => 'Scilife Pharma',
                'image' => 'brands/Scilife Pharma.png'
            ],
            [
                'name' => 'Adamjee Pharma',
                'image' => 'brands/Adamjee Pharma.png'
            ],
            [
                'name' => 'Shaigan Pharmaceuticals',
                'image' => 'brands/Shaigan Pharmaceuticals.jpeg'
            ],
            [
                'name' => 'Nabi Qasim Industries',
                'image' => 'brands/Nabi Qasim Industries.png'
            ],
            [
                'name' => 'Macter International',
                'image' => 'brands/Macter International.jpeg'
            ],
            [
                'name' => 'Maple Pharma',
                'image' => 'brands/Maple Pharma.jpeg'
            ],
            [
                'name' => 'S.J. & G. Fazal Elahi',
                'image' => 'brands/S.J. & G. Fazal Elahi.jpeg'
            ],
            [
                'name' => 'Genetics Pharmaceuticals',
                'image' => 'brands/genetics pharmaceuticals.jpeg'
            ],
            [
                'name' => 'CCL',
                'image' => 'brands/CCL.png'
            ],
            [
                'name' => 'global pharmaceuticals',
                'image' => 'brands/global pharmaceuticals.jpeg'
            ],
            [
                'name' => 'Horizon Pharmaceuticals',
                'image' => 'brands/Horizon Pharmaceuticals.jpeg'
            ]
        ];

        foreach ($brands as $brand) {
            DB::table('brands')->insert([
                'name' => $brand['name'],
                'image' => $brand['image'],
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }
}
