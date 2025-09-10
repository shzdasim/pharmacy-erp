<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Gate;

class UserController extends Controller
{
    // GET /api/users?search=&page=&per_page=
    public function index(Request $request)
    {
        Gate::authorize('manage-users'); // define below in AuthServiceProvider

        $search   = trim($request->query('search', ''));
        $perPage  = (int) $request->query('per_page', 15);
        $perPage  = $perPage > 0 && $perPage <= 200 ? $perPage : 15;

        $q = User::query()
            ->when($search, function ($qq) use ($search) {
                $like = '%'.$search.'%';
                $qq->where(function ($w) use ($like) {
                    $w->where('name', 'like', $like)
                      ->orWhere('email', 'like', $like);
                });
            })
            ->orderBy('id', 'desc');

        $users = $q->paginate($perPage);

        return response()->json([
            'data' => $users->items(),
            'meta' => [
                'current_page' => $users->currentPage(),
                'per_page'     => $users->perPage(),
                'total'        => $users->total(),
                'last_page'    => $users->lastPage(),
            ],
        ]);
    }

    // POST /api/users
    public function store(Request $request)
    {
        Gate::authorize('manage-users');

        $data = $request->validate([
            'name'     => ['required','string','max:255'],
            'email'    => ['required','email','max:255','unique:users,email'],
            'password' => ['required','string','min:6'],
            'role'     => ['nullable','string','max:64'], // if using spatie roles
            'status'   => ['nullable', Rule::in(['active','inactive'])],
        ]);

        $user = new User();
        $user->name   = $data['name'];
        $user->email  = $data['email'];
        $user->status = $data['status'] ?? 'active';
        $user->password = Hash::make($data['password']);
        $user->save();

        if (isset($data['role']) && method_exists($user, 'assignRole')) {
            $user->assignRole($data['role']);
        }

        return response()->json($user, 201);
    }

    // GET /api/users/{user}
    public function show(User $user)
    {
        Gate::authorize('manage-users');
        return response()->json($user);
    }

    // PUT /api/users/{user}
    public function update(Request $request, User $user)
    {
        Gate::authorize('manage-users');

        $data = $request->validate([
            'name'     => ['required','string','max:255'],
            'email'    => ['required','email','max:255', Rule::unique('users','email')->ignore($user->id)],
            'password' => ['nullable','string','min:6'],
            'role'     => ['nullable','string','max:64'],
            'status'   => ['nullable', Rule::in(['active','inactive'])],
        ]);

        $user->name  = $data['name'];
        $user->email = $data['email'];
        if (isset($data['status'])) $user->status = $data['status'];
        if (!empty($data['password'])) $user->password = Hash::make($data['password']);
        $user->save();

        if (array_key_exists('role', $data) && method_exists($user, 'syncRoles')) {
            $user->syncRoles($data['role'] ? [$data['role']] : []);
        }

        return response()->json($user);
    }

    // DELETE /api/users/{user}
    public function destroy(User $user, Request $request)
    {
        Gate::authorize('manage-users');

        // Don’t allow deleting yourself
        if ($request->user()->id === $user->id) {
            return response()->json(['message' => 'You cannot delete your own account.'], 422);
        }

        $user->delete();
        return response()->json(['message' => 'Deleted']);
    }
}
