<?php

namespace App\Policies;

use App\Models\User;
use App\Models\Supplier;

class SupplierPolicy
{
    // Optional: let Admin do everything
    public function before(User $user, $ability)
    {
        if ($user->hasRole('Admin')) return true;
    }

    public function viewAny(User $user): bool { return $user->can('supplier.view'); }
    public function view(User $user, Supplier $supplier): bool { return $user->can('supplier.view'); }
    public function create(User $user): bool { return $user->can('supplier.create'); }
    public function update(User $user, Supplier $supplier): bool { return $user->can('supplier.update'); }
    public function delete(User $user, Supplier $supplier): bool { return $user->can('supplier.delete'); }

    // Custom abilities
    public function export(User $user): bool { return $user->can('supplier.export'); }
    public function import(User $user): bool { return $user->can('supplier.import'); }
}
