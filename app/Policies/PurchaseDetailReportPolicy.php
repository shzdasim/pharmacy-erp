<?php

namespace App\Policies;

use App\Models\User;

class PurchaseDetailReportPolicy
{
    public function view(User $user): bool
    {
        return $user->can('report.purchase-detail.view');
    }

    public function export(User $user): bool
    {
        return $user->can('report.purchase-detail.export');
    }
}
