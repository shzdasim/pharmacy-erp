<?php

use Illuminate\Support\Facades\Route;

// Your API or Laravel-specific routes go here first

// React catch-all route
Route::view('/{path?}', 'index')
    ->where('path', '.*');
