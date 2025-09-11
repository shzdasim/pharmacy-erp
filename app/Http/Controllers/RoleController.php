<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;

class RoleController extends Controller
{
    // GET /api/roles?search=&page=&per_page=
    public function index(Request $request)
    {
        // Allow via role_or_permission. Admin will also pass Gate::before
        $this->authorizeViaMiddleware($request, 'role.view');

        $search  = trim($request->query('search', ''));
        $perPage = (int) $request->query('per_page', 15);
        $perPage = $perPage > 0 && $perPage <= 200 ? $perPage : 15;

        $q = Role::query()->where('guard_name', 'sanctum')
            ->when($search, fn($qq) => $qq->where('name', 'like', "%{$search}%"))
            ->orderBy('id', 'desc');

        $roles = $q->paginate($perPage);

        // include permissions count (optional)
        $data = $roles->getCollection()
            ->map(fn($r) => [
                'id' => $r->id,
                'name' => $r->name,
                'guard_name' => $r->guard_name,
                'permissions_count' => $r->permissions()->count(),
            ])->all();

        return response()->json([
            'data' => $data,
            'meta' => [
                'current_page' => $roles->currentPage(),
                'per_page'     => $roles->perPage(),
                'total'        => $roles->total(),
                'last_page'    => $roles->lastPage(),
            ],
        ]);
    }

    // POST /api/roles
    public function store(Request $request)
    {
        $this->authorizeViaMiddleware($request, 'role.create');

        $validated = $request->validate([
            'name' => [
                'required','string','max:255',
                Rule::unique('roles','name')->where('guard_name','sanctum'),
            ],
            'permissions' => ['array'],
            'permissions.*' => ['string'],
        ]);

        $role = Role::create([
            'name' => $validated['name'],
            'guard_name' => 'sanctum',
        ]);

        if (!empty($validated['permissions'])) {
            $perms = Permission::whereIn('name', $validated['permissions'])
                ->where('guard_name','sanctum')->pluck('name')->all();
            $role->syncPermissions($perms);
        }

        return response()->json($role->load('permissions'), 201);
    }

    // GET /api/roles/{role}
public function show(Role $role, Request $request)
{
    $this->authorizeViaMiddleware($request, 'role.view');
    abort_unless($role->guard_name === 'sanctum', 404);

    return response()->json([
  'id' => $role->id,
  'name' => $role->name,
  'guard_name' => $role->guard_name,
  'permissions' => $role->permissions()->pluck('name')->values()->all(), // ✅
]);
}


    // PUT /api/roles/{role}
    public function update(Request $request, Role $role)
    {
        $this->authorizeViaMiddleware($request, 'role.update');
        abort_unless($role->guard_name === 'sanctum', 404);

        $validated = $request->validate([
            'name' => [
                'required','string','max:255',
                Rule::unique('roles','name')
                    ->where('guard_name','sanctum')
                    ->ignore($role->id),
            ],
            'permissions' => ['array'],
            'permissions.*' => ['string'],
        ]);

        // (optional) protect Admin role name if you want
        // if ($role->name === 'Admin' && $validated['name'] !== 'Admin') {
        //     return response()->json(['message' => 'Cannot rename Admin role'], 422);
        // }

        $role->name = $validated['name'];
        $role->save();

        $perms = $validated['permissions'] ?? [];
        $perms = Permission::whereIn('name', $perms)->where('guard_name','sanctum')->pluck('name')->all();
        $role->syncPermissions($perms);

        return response()->json($role->load('permissions'));
    }

    // DELETE /api/roles/{role}
    public function destroy(Request $request, Role $role)
    {
        $this->authorizeViaMiddleware($request, 'role.delete');
        abort_unless($role->guard_name === 'sanctum', 404);

        if ($role->name === 'Admin') {
            return response()->json(['message' => 'Cannot delete Admin role'], 422);
        }

        $role->delete();
        return response()->json(['message' => 'Deleted']);
    }

    private function authorizeViaMiddleware(Request $request, string $permission): void
    {
        // If you prefer route middleware, you can remove this and rely on routes.
        // Here we keep a simple check that aligns with your Gate::before.
        if (method_exists($request->user(), 'can') && $request->user()->can($permission)) {
            return;
        }
        // Admin will pass Gate::before, but if not Admin or missing permission:
        abort_unless($request->user()?->hasRole('Admin') ?? false, 403);
    }
}
