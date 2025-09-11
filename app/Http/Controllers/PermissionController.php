<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Spatie\Permission\Models\Permission;

class PermissionController extends Controller
{
    public function index(Request $request)
{
    if (!($request->user()?->can('role.view') || $request->user()?->hasRole('Admin'))) {
        abort(403);
    }

    $search = trim($request->query('search', ''));
    $q = Permission::query()
        ->where('guard_name', 'sanctum')
        ->when($search, fn($qq) => $qq->where('name', 'like', "%{$search}%"))
        ->orderBy('name');

    // 🔧 return a proper JSON array
    return response()->json(
  Permission::where('guard_name','sanctum')
    ->orderBy('name')
    ->pluck('name')
    ->values()
    ->all() // ✅
    , 200);
}


    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required','string','max:150', Rule::unique('permissions','name')],
        ]);
        $p = Permission::create(['name' => $data['name'], 'guard_name' => 'sanctum']);
        return response()->json($p, 201);
    }

    public function destroy(Permission $permission)
    {
        $permission->delete();
        return response()->noContent();
    }
}
