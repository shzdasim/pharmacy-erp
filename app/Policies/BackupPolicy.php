<?php

namespace App\Policies;

use App\Models\BackupLog;
use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

class BackupPolicy
{
    use HandlesAuthorization;

    /**
     * Determine whether the user can view any backups.
     */
    public function viewAny(User $user): bool
    {
        return $user->can('backup.view');
    }

    /**
     * Determine whether the user can view the backup.
     */
    public function view(User $user, BackupLog $backup): bool
    {
        return $user->can('backup.view');
    }

    /**
     * Determine whether the user can create backups.
     */
    public function create(User $user): bool
    {
        return $user->can('backup.create');
    }

    /**
     * Determine whether the user can restore backups.
     */
    public function restore(User $user, BackupLog $backup): bool
    {
        return $user->can('backup.restore');
    }

    /**
     * Determine whether the user can delete backups.
     */
    public function delete(User $user, BackupLog $backup): bool
    {
        return $user->can('backup.delete');
    }

    /**
     * Determine whether the user can upload backups.
     */
    public function upload(User $user): bool
    {
        return $user->can('backup.upload');
    }
}

