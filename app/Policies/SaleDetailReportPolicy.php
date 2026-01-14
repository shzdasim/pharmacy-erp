<?php

namespace App\Policies;

use App\Models\User;

class SaleDetailReportPolicy
{
    public function view(User $user): bool
    {
        return $user->can('report.sale-detail.view');
    }

    public function export(User $user): bool
    {
        return $user->can('report.sale-detail.export');
    }
    public function edit(User $user): bool
    {
        return $user->can('report.sale-detail.edit');
    }
}
