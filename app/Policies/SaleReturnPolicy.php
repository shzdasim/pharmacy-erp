<?php

namespace App\Policies;

use App\Models\User;
use App\Models\SaleReturn;

class SaleReturnPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->can('sale-return.view');
    }

    public function view(User $user, SaleReturn $saleReturn): bool
    {
        return $user->can('sale-return.view');
    }

    public function create(User $user): bool
    {
        return $user->can('sale-return.create');
    }

    public function update(User $user, SaleReturn $saleReturn): bool
    {
        return $user->can('sale-return.update');
    }

    public function delete(User $user, SaleReturn $saleReturn): bool
    {
        return $user->can('sale-return.delete');
    }
}
