<?php

namespace App\Policies;

use App\Models\User;
use App\Models\SupplierLedger;

class SupplierLedgerPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->can('supplier-ledger.view');
    }

    // Not used often (you don’t have a show endpoint), but kept for completeness.
    public function view(User $user, SupplierLedger $row): bool
    {
        return $user->can('supplier-ledger.view');
    }

    public function create(User $user): bool
    {
        return $user->can('supplier-ledger.create');
    }

    public function update(User $user, SupplierLedger $row): bool
    {
        return $user->can('supplier-ledger.update');
    }

    public function delete(User $user, SupplierLedger $row): bool
    {
        return $user->can('supplier-ledger.delete');
    }

    /** Class-level updates (bulk/rebuild). */
    public function updateAny(User $user): bool
    {
        return $user->can('supplier-ledger.update');
    }
}
