<?php

namespace App\Policies;

use App\Models\User;
use App\Models\Product;

class ProductPolicy
{
    // If you have an Admin role, you can short-circuit in AuthServiceProvider (see below).
    // Otherwise, keep policies strict here.

    /** List / index */
    public function viewAny(User $user): bool
    {
        return $user->can('product.view');
    }

    /** View a single product */
    public function view(User $user, Product $product): bool
    {
        return $user->can('product.view');
    }

    /** Create */
    public function create(User $user): bool
    {
        return $user->can('product.create');
    }

    /** Update */
    public function update(User $user, Product $product): bool
    {
        return $user->can('product.update');
    }

    /** Delete */
    public function delete(User $user, Product $product): bool
    {
        return $user->can('product.delete');
    }

    /** Optional: CSV export */
    public function export(User $user): bool
    {
        return $user->can('product.export') || false; // keep false if you don't have this perm
    }

    /** Optional: CSV import */
    public function import(User $user): bool
    {
        return $user->can('product.import') || false;
    }

    /** Optional: bulk meta update */
    public function bulkUpdate(User $user): bool
    {
        return $user->can('product.update'); // piggyback on update
    }
}
