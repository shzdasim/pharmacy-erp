<?php

namespace App\Policies;

use App\Models\User;
use App\Models\CustomerLedger;

class CustomerLedgerPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->can('customer-ledger.view');
    }

    // You likely won’t call this directly, but it’s here for completeness.
    public function view(User $user, CustomerLedger $row): bool
    {
        return $user->can('customer-ledger.view');
    }

    public function create(User $user): bool
    {
        return $user->can('customer-ledger.create');
    }

    public function update(User $user, CustomerLedger $row): bool
    {
        return $user->can('customer-ledger.update');
    }

    public function delete(User $user, CustomerLedger $row): bool
    {
        return $user->can('customer-ledger.delete');
    }

    /** Class-level updates (bulk/rebuild). */
    public function updateAny(User $user): bool
    {
        return $user->can('customer-ledger.update');
    }
}
