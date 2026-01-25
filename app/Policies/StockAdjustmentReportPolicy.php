<?php

namespace App\Policies;

use App\Models\User;

class StockAdjustmentReportPolicy
{
    public function view(User $user): bool
    {
        return $user->can('report.stock-adjustment.view');
    }

    public function export(User $user): bool
    {
        return $user->can('report.stock-adjustment.export');
    }
}

