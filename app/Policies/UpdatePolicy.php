<?php

namespace App\Policies;

use App\Models\User;
use App\Models\UpdateLog;

class UpdatePolicy
{
    /**
     * Check if user can view update information
     */
    public function view(User $user): bool
    {
        return $user->can('update.view');
    }

    /**
     * Check if user can check for updates
     */
    public function check(User $user): bool
    {
        return $user->can('update.check');
    }

    /**
     * Check if user can install updates
     */
    public function install(User $user): bool
    {
        return $user->can('update.install');
    }

    /**
     * Check if user can view update logs
     */
    public function viewLogs(User $user): bool
    {
        return $user->can('update.logs');
    }

    /**
     * Check if user can update settings
     */
    public function updateSettings(User $user): bool
    {
        return $user->can('update.settings');
    }
}

