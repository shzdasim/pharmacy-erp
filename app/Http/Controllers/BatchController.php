<?php

namespace App\Http\Controllers;

use App\Models\Product;
use Illuminate\Http\Request;

class BatchController extends Controller
{
    public function index(Product $product)
    {
        return response()->json($product->batches()->get());
    }
}
