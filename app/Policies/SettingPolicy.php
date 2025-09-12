<?php

namespace App\Policies;

use App\Models\User;
use App\Models\Setting;

class SettingPolicy
{
    // viewing the settings page / GET /api/settings
    public function view(User $user): bool
    {
        return $user->can('settings.view');
    }

    // updating settings / POST /api/settings
    public function update(User $user): bool
    {
        return $user->can('settings.update');
    }
}
