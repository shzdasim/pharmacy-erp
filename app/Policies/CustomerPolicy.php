<?php

namespace App\Policies;

use App\Models\User;
use App\Models\Customer;

class CustomerPolicy
{
    public function before(User $user, $ability)
    {
        if ($user->hasRole('Admin')) return true;
    }

    public function viewAny(User $user): bool { return $user->can('customer.view'); }
    public function view(User $user, Customer $customer): bool { return $user->can('customer.view'); }
    public function create(User $user): bool { return $user->can('customer.create'); }
    public function update(User $user, Customer $customer): bool { return $user->can('customer.update'); }
    public function delete(User $user, Customer $customer): bool { return $user->can('customer.delete'); }

    // custom abilities
    public function export(User $user): bool { return $user->can('customer.export'); }
    public function import(User $user): bool { return $user->can('customer.import'); }
}
