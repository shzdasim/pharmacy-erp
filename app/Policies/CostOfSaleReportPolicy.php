<?php

namespace App\Policies;

use App\Models\User;

class CostOfSaleReportPolicy
{
    public function view(User $user): bool
    {
        return $user->can('report.cost-of-sale.view');
    }
}
