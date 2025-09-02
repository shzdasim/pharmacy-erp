<?php

// app/Http/Controllers/BrandController.php
namespace App\Http\Controllers;

use App\Models\Brand;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class BrandController extends Controller
{
    public function index() {
       // Return products_count so UI can disable Delete
        return Brand::withCount('products')
            ->orderBy('name')
            ->get();
    }

    public function store(Request $request) {
        $validated = $request->validate([
            'name' => 'required|unique:brands,name',
            'image' => 'nullable|image|max:2048',
        ]);

        if ($request->hasFile('image')) {
            $path = $request->file('image')->store('brands', 'public');
            $validated['image'] = $path;
        }

        $brand = Brand::create($validated);
        return response()->json($brand, 201);
    }

    public function show(Brand $brand) {
        return $brand;
    }

    public function update(Request $request, Brand $brand) {
        $validated = $request->validate([
            'name' => 'required|unique:brands,name,' . $brand->id,
            'image' => 'nullable|image|max:2048',
        ]);

        if ($request->hasFile('image')) {
            // delete old image if exists
            if ($brand->image) {
                Storage::disk('public')->delete($brand->image);
            }
            $path = $request->file('image')->store('brands', 'public');
            $validated['image'] = $path;
        }

        $brand->update($validated);
        return response()->json($brand);
    }

    public function destroy(Brand $brand) {
        // HARD GUARD: block delete if any product references this brand
        if ($brand->products()->exists()) {
            return response()->json([
                'message' => 'Cannot delete: brand is used by one or more products.'
            ], 422);
        }
        if ($brand->image) {
            Storage::disk('public')->delete($brand->image);
        }
        $brand->delete();
        return response()->json(null, 204);
    }
}
