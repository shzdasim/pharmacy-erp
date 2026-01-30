<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class UpdateLog extends Model
{
    use HasFactory;

    protected $table = 'update_logs';

    protected $fillable = [
        'type',
        'level',
        'message',
        'context',
    ];

    protected $casts = [
        'context' => 'array',
        'created_at' => 'datetime',
    ];

    /**
     * Log levels for updates
     */
    public const LEVEL_INFO = 'info';
    public const LEVEL_WARNING = 'warning';
    public const LEVEL_ERROR = 'error';
    public const LEVEL_SUCCESS = 'success';

    /**
     * Types of update operations
     */
    public const TYPE_CHECK = 'check';
    public const TYPE_DOWNLOAD = 'download';
    public const TYPE_EXTRACT = 'extract';
    public const TYPE_INSTALL = 'install';
    public const TYPE_BACKUP = 'backup';
    public const TYPE_CACHE_CLEAR = 'cache_clear';
    public const TYPE_ROLLBACK = 'rollback';
}

