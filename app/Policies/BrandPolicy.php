<?php

namespace App\Policies;

use App\Models\User;
use App\Models\Brand;

class BrandPolicy
{
    public function before(User $user, $ability)
    {
        if ($user->hasRole('Admin')) return true;
    }

    public function viewAny(User $user): bool { return $user->can('brand.view'); }
    public function view(User $user, Brand $brand): bool { return $user->can('brand.view'); }
    public function create(User $user): bool { return $user->can('brand.create'); }
    public function update(User $user, Brand $brand): bool { return $user->can('brand.update'); }
    public function delete(User $user, Brand $brand): bool { return $user->can('brand.delete'); }

    // custom
    public function export(User $user): bool { return $user->can('brand.export'); }
    public function import(User $user): bool { return $user->can('brand.import'); }
}
