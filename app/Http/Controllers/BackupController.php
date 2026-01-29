<?php

namespace App\Http\Controllers;

use App\Models\BackupLog;
use App\Services\BackupService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;

class BackupController extends Controller
{
    protected $backupService;

    public function __construct(BackupService $backupService)
    {
        $this->backupService = $backupService;
    }

    /**
     * List all backups
     * GET /api/backups
     */
    public function index()
    {
        $this->authorize('view', BackupLog::class);
        
        $backups = $this->backupService->listBackups();
        
        return response()->json([
            'backups' => $backups,
            'total' => count($backups),
        ]);
    }

    /**
     * Create a new backup
     * POST /api/backups
     */
    public function store(Request $request)
    {
        $this->authorize('create', BackupLog::class);
        
        $validated = $request->validate([
            'type' => ['required', Rule::in(['full', 'database', 'settings'])],
        ]);
        
        $userId = Auth::id();
        
        try {
            $backup = $this->backupService->createBackup($validated['type'], $userId);
            
            return response()->json([
                'message' => 'Backup created successfully',
                'backup' => [
                    'id' => $backup->id,
                    'filename' => $backup->filename,
                    'type' => $backup->type,
                    'type_label' => $backup->type_label,
                    'size' => $backup->size,
                    'formatted_size' => $backup->formatted_size,
                    'status' => $backup->status,
                    'created_at' => $backup->created_at->format('M d, Y h:i A'),
                ],
            ], 201);
            
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Failed to create backup',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Download a backup
     * GET /api/backups/{id}/download
     */
    public function download(int $id)
    {
        $this->authorize('view', BackupLog::class);
        
        $backup = BackupLog::find($id);
        
        if (!$backup || $backup->status !== 'completed') {
            return response()->json([
                'message' => 'Backup not found or unavailable',
            ], 404);
        }
        
        $filepath = $this->backupService->getDownloadPath($id);
        
        if (!$filepath || !file_exists($filepath)) {
            return response()->json([
                'message' => 'Backup file not found',
            ], 404);
        }
        
        // Determine file extension based on backup type
        $extension = match($backup->type) {
            'full' => 'zip',
            'settings' => 'json',
            default => 'sql.gz',
        };
        
        $filename = $backup->filename . '.' . $extension;
        
        return response()->download($filepath, $filename, [
            'Content-Type' => 'application/octet-stream',
        ]);
    }

    /**
     * Restore from backup
     * POST /api/backups/{id}/restore
     */
    public function restore(Request $request, int $id)
    {
        $this->authorize('restore', BackupLog::class);
        
        $validated = $request->validate([
            'password' => ['required', 'string', 'min:6'],
        ]);
        
        try {
            $this->backupService->restoreBackup($id, $validated['password']);
            
            return response()->json([
                'message' => 'Backup restored successfully. Please refresh the page.',
            ]);
            
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Restore failed',
                'error' => $e->getMessage(),
            ], 422);
        }
    }

    /**
     * Delete a backup
     * DELETE /api/backups/{id}
     */
    public function destroy(int $id)
    {
        $this->authorize('delete', BackupLog::class);
        
        $deleted = $this->backupService->deleteBackup($id);
        
        if (!$deleted) {
            return response()->json([
                'message' => 'Backup not found',
            ], 404);
        }
        
        return response()->json([
            'message' => 'Backup deleted successfully',
        ]);
    }

    /**
     * Get backup statistics
     * GET /api/backups/stats
     */
    public function stats()
    {
        $this->authorize('view', BackupLog::class);
        
        $totalBackups = BackupLog::count();
        $completedBackups = BackupLog::where('status', 'completed')->count();
        $failedBackups = BackupLog::where('status', 'failed')->count();
        
        $totalSize = BackupLog::where('status', 'completed')->sum('size');
        
        $lastBackup = BackupLog::where('status', 'completed')
            ->orderByDesc('created_at')
            ->first();
        
        return response()->json([
            'total_backups' => $totalBackups,
            'completed_backups' => $completedBackups,
            'failed_backups' => $failedBackups,
            'total_size' => $totalSize,
            'formatted_total_size' => $this->formatBytes($totalSize),
            'last_backup_at' => $lastBackup?->created_at?->format('M d, Y h:i A'),
        ]);
    }

    /**
     * Format bytes to human readable
     */
    protected function formatBytes(int $bytes): string
    {
        if ($bytes === 0) return '0 B';
        
        $units = ['B', 'KB', 'MB', 'GB'];
        $i = floor(log($bytes, 1024));
        
        return round($bytes / pow(1024, $i), 2) . ' ' . $units[$i];
    }
}

