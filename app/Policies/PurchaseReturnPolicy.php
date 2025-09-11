<?php

namespace App\Policies;

use App\Models\User;
use App\Models\PurchaseReturn;

class PurchaseReturnPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->can('purchase-return.view');
    }

    public function view(User $user, PurchaseReturn $purchaseReturn): bool
    {
        return $user->can('purchase-return.view');
    }

    public function create(User $user): bool
    {
        return $user->can('purchase-return.create');
    }

    public function update(User $user, PurchaseReturn $purchaseReturn): bool
    {
        return $user->can('purchase-return.update');
    }

    public function delete(User $user, PurchaseReturn $purchaseReturn): bool
    {
        return $user->can('purchase-return.delete');
    }
}
