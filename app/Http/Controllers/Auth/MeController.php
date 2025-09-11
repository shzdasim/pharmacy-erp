<?php

namespace App\Http\Controllers\Auth;

use Illuminate\Http\Request;

class MeController
{
    public function __invoke(Request $request)
    {
        $u = $request->user();
        return response()->json([
            'user' => $u,
            'roles' => $u->getRoleNames(),
            'permissions' => $u->getAllPermissions()->pluck('name'),
        ]);
    }
}
