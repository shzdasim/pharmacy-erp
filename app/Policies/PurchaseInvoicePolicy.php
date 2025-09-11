<?php

namespace App\Policies;

use App\Models\User;
use App\Models\PurchaseInvoice;

class PurchaseInvoicePolicy
{
    public function viewAny(User $user): bool
    {
        return $user->can('purchase-invoice.view');
    }

    public function view(User $user, PurchaseInvoice $invoice): bool
    {
        return $user->can('purchase-invoice.view');
    }

    public function create(User $user): bool
    {
        return $user->can('purchase-invoice.create');
    }

    public function update(User $user, PurchaseInvoice $invoice): bool
    {
        return $user->can('purchase-invoice.update');
    }

    public function delete(User $user, PurchaseInvoice $invoice): bool
    {
        return $user->can('purchase-invoice.delete');
    }
}
