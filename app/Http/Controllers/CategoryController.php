<?php

// app/Http/Controllers/CategoryController.php
namespace App\Http\Controllers;

use App\Models\Category;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class CategoryController extends Controller
{
    public function index() {
        return response()->json(
            Category::withCount('products')
                ->orderBy('name')
                ->get()
        );
    }

    public function store(Request $request) {
        $validated = $request->validate([
            'name' => 'required|unique:categories,name',
        ]);
        $category = Category::create($validated);
        return response()->json($category, 201);
    }

    public function show(Category $category) {
        return $category;
    }

    public function update(Request $request, Category $category) {
        $validated = $request->validate([
            'name' => 'required|unique:categories,name,' . $category->id,
        ]);
        $category->update($validated);
        return response()->json($category);
    }

    public function destroy(Category $category) {
        if ($category->products()->exists()) {
            return response()->json([
                'message' => 'Cannot delete: category is used by one or more products.'
            ], 422);
        }
        $category->delete();
        return response()->json(null, 204);
    }
    public function export(): StreamedResponse
{
    $file = 'categories_'.now()->format('Y-m-d_H-i-s').'.csv';

    return response()->streamDownload(function () {
        $out = fopen('php://output', 'w');
        // UTF-8 BOM for Excel
        fprintf($out, chr(0xEF).chr(0xBB).chr(0xBF));
        // Header
        fputcsv($out, ['name']);
        // Rows
        \App\Models\Category::select('name')
            ->orderBy('name')
            ->chunk(1000, function ($chunk) use ($out) {
                foreach ($chunk as $c) {
                    fputcsv($out, [(string)($c->name ?? '')]);
                }
            });
        fclose($out);
    }, $file, ['Content-Type' => 'text/csv; charset=UTF-8']);
}
}
