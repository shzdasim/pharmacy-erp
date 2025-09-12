<?php

namespace App\Policies;

use App\Models\User;

class PurchaseOrderForecastPolicy
{
    /** Can open the page / see results */
    public function view(User $user): bool
    {
        return $user->can('purchase-order.view');
    }

    /** Can call the forecast endpoint (generate data) */
    public function generate(User $user): bool
    {
        return $user->can('purchase-order.generate');
    }
}
