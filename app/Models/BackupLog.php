<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class BackupLog extends Model
{
    use HasFactory;

    protected $fillable = [
        'filename',
        'type',
        'size',
        'path',
        'metadata',
        'created_by',
        'status',
        'error_message',
        'expires_at',
    ];

    protected $casts = [
        'metadata' => 'array',
        'size' => 'integer',
        'expires_at' => 'datetime',
        'created_at' => 'datetime',
    ];

    const TYPES = ['full', 'database', 'settings'];
    const STATUSES = ['pending', 'completed', 'failed', 'restored'];

    /**
     * Get formatted size for display
     */
    public function getFormattedSizeAttribute(): string
    {
        $bytes = $this->size;
        
        if ($bytes === 0) return '0 B';
        
        $units = ['B', 'KB', 'MB', 'GB'];
        $i = floor(log($bytes, 1024));
        
        return round($bytes / pow(1024, $i), 2) . ' ' . $units[$i];
    }

    /**
     * Get human readable type label
     */
    public function getTypeLabelAttribute(): string
    {
        return match($this->type) {
            'full' => 'Full Backup',
            'database' => 'Database Only',
            'settings' => 'Settings Only',
            default => ucfirst($this->type),
        };
    }

    /**
     * Get full file path
     */
    public function getFullPathAttribute(): string
    {
        return storage_path('app/' . $this->path);
    }

    /**
     * Check if backup file exists
     */
    public function fileExists(): bool
    {
        return file_exists($this->full_path);
    }
}

