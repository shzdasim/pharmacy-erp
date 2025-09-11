<?php

namespace App\Http\Controllers\Auth;

use Illuminate\Http\Request;
use App\Http\Controllers\Controller;

class MeController extends Controller
{
    public function __invoke(Request $request)
    {
        $u = $request->user();

        return response()->json([
            'user' => [
                'id'    => $u->id,
                'name'  => $u->name,
                'email' => $u->email,
                'status'=> $u->status ?? 'active',
            ],
            'roles' => $u->getRoleNames()->values()->all(),                  // ["Admin", ...]
            'permissions' => $u->getAllPermissions()->pluck('name')->values()->all(), // ["category.view", ...]
        ]);
    }
}
