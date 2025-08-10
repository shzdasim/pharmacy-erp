<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;


Route::post('/login', [AuthController::class, 'login']);
Route::middleware(['auth:sanctum'])->get('/user', [AuthController::class, 'user']);
