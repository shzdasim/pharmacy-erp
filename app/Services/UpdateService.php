<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Cache;
use ZipArchive;

class UpdateService
{
    private string $owner = 'shzdasim';
    private string $repo = 'pharmacy-erp';
    private string $branch = 'Sale-Invoice';
    private string $apiBase = 'https://api.github.com';
    
    // Update settings storage key (using cache)
    private const SETTINGS_CACHE_KEY = 'update_settings';
    private const SETTINGS_CACHE_TTL = 86400; // 24 hours
    
    // Default settings
    private array $defaultSettings = [
        'auto_check_enabled' => false,
        'auto_install_enabled' => false,
        'require_confirmation' => true,
        'check_on_login' => true,
        'last_check' => null,
        'last_check_result' => null,
    ];

    /**
     * Get current application version
     */
    public function getCurrentVersion(): string
    {
        return config('app.version', '1.0.0');
    }

    /**
     * Get update settings from cache
     */
    public function getSettings(): array
    {
        $cached = Cache::get(self::SETTINGS_CACHE_KEY);
        return array_merge($this->defaultSettings, $cached ?? []);
    }

    /**
     * Update settings in cache
     */
    public function updateSettings(array $settings): void
    {
        $current = $this->getSettings();
        $merged = array_merge($current, $settings);
        
        Cache::put(self::SETTINGS_CACHE_KEY, $merged, self::SETTINGS_CACHE_TTL);
    }

    /**
     * Check for updates from GitHub
     */
    public function checkForUpdates(): array
    {
        try {
            // Try to get the latest release first
            $response = Http::withHeaders([
                'Accept' => 'application/vnd.github.v3+json',
                'User-Agent' => 'Pharmacy-ERP-Updater',
            ])->timeout(30)
              ->get("{$this->apiBase}/repos/{$this->owner}/{$this->repo}/releases/latest");

            $release = null;
            $latestVersion = null;
            
            if ($response->successful()) {
                $release = $response->json();
                if ($release && isset($release['tag_name'])) {
                    $latestVersion = ltrim($release['tag_name'], 'v');
                }
            }
            
            // If no release found, try to get the latest tag
            if (!$latestVersion) {
                $tagsResponse = Http::withHeaders([
                    'Accept' => 'application/vnd.github.v3+json',
                    'User-Agent' => 'Pharmacy-ERP-Updater',
                ])->timeout(30)
                  ->get("{$this->apiBase}/repos/{$this->owner}/{$this->repo}/tags");
                
                if ($tagsResponse->successful()) {
                    $tags = $tagsResponse->json();
                    if (!empty($tags) && isset($tags[0]['name'])) {
                        $latestVersion = ltrim($tags[0]['name'], 'v');
                        $release = [
                            'name' => $tags[0]['name'],
                            'tag_name' => $tags[0]['name'],
                            'body' => 'Version ' . $latestVersion,
                            'published_at' => null,
                            'html_url' => "https://github.com/{$this->owner}/{$this->repo}/releases/tag/{$tags[0]['name']}",
                            'zipball_url' => "https://api.github.com/repos/{$this->owner}/{$this->repo}/zipball/{$tags[0]['name']}",
                            'assets' => [],
                        ];
                    }
                }
            }

            if (!$latestVersion) {
                return [
                    'success' => false,
                    'error' => 'No releases or tags found in the repository. Please create a release or tag to enable updates.',
                    'current_version' => $this->getCurrentVersion(),
                    'latest_version' => null,
                ];
            }

            $currentVersion = $this->getCurrentVersion();
            $isNewVersion = version_compare($latestVersion, $currentVersion, '>');
            
            $result = [
                'success' => true,
                'current_version' => $currentVersion,
                'latest_version' => $latestVersion,
                'is_new_version' => $isNewVersion,
                'release_info' => [
                    'name' => $release['name'] ?? $release['tag_name'],
                    'tag_name' => $release['tag_name'],
                    'body' => $release['body'] ?? '',
                    'published_at' => $release['published_at'] ?? null,
                    'html_url' => $release['html_url'] ?? null,
                    'zipball_url' => $release['zipball_url'] ?? null,
                    'assets' => $release['assets'] ?? [],
                ],
                'checked_at' => now()->toIso8601String(),
            ];

            // Update last check time and result in cache
            $settings = $this->getSettings();
            $settings['last_check'] = now()->toIso8601String();
            $settings['last_check_result'] = $result;
            $this->updateSettings($settings);

            // Log the check
            $this->logUpdate('check', 'info', "Checked for updates. Current: {$currentVersion}, Latest: {$latestVersion}", [
                'is_new_version' => $isNewVersion,
            ]);

            return $result;

        } catch (\Exception $e) {
            Log::error('Update check failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return [
                'success' => false,
                'error' => 'An error occurred while checking for updates: ' . $e->getMessage(),
                'current_version' => $this->getCurrentVersion(),
                'latest_version' => null,
            ];
        }
    }

    /**
     * Get download URL for the latest release
     */
    public function getDownloadUrl(): ?string
    {
        $response = Http::withHeaders([
            'Accept' => 'application/vnd.github.v3+json',
            'User-Agent' => 'Pharmacy-ERP-Updater',
        ])->timeout(30)
          ->get("{$this->apiBase}/repos/{$this->owner}/{$this->repo}/releases/latest");

        if ($response->successful() && $response->json('zipball_url')) {
            return $response->json('zipball_url');
        }

        return null;
    }

    /**
     * Install the latest update
     */
    public function installUpdate(bool $force = false): array
    {
        try {
            // Check for updates first
            $checkResult = $this->checkForUpdates();
            
            if (!$checkResult['success']) {
                return [
                    'success' => false,
                    'error' => $checkResult['error'] ?? 'Could not check for updates.',
                ];
            }

            if (!$checkResult['is_new_version'] && !$force) {
                return [
                    'success' => false,
                    'error' => 'No new updates available. You are already running the latest version.',
                ];
            }

            $downloadUrl = $checkResult['release_info']['zipball_url'];
            $newVersion = $checkResult['latest_version'];
            $currentVersion = $checkResult['current_version'];

            // Log starting installation
            $this->logUpdate('install_start', 'info', "Starting update installation from {$currentVersion} to {$newVersion}", [
                'from_version' => $currentVersion,
                'to_version' => $newVersion,
                'download_url' => $downloadUrl,
            ]);

            // Create backup before updating
            $this->createBackupBeforeUpdate();

            // Download the update
            $zipPath = $this->downloadUpdate($downloadUrl);
            
            // Extract and apply the update
            $this->extractAndApplyUpdate($zipPath, $newVersion);

            // Clean up
            if (file_exists($zipPath)) {
                unlink($zipPath);
            }

            // Clear all caches
            $this->clearCaches();

            // Log successful installation
            $this->logUpdate('install_complete', 'info', "Update completed successfully to version {$newVersion}", [
                'from_version' => $currentVersion,
                'to_version' => $newVersion,
            ]);

            return [
                'success' => true,
                'message' => "Application updated successfully from {$currentVersion} to {$newVersion}.",
                'from_version' => $currentVersion,
                'to_version' => $newVersion,
            ];

        } catch (\Exception $e) {
            $errorMsg = 'Update installation failed: ' . $e->getMessage();
            
            Log::error('Update installation failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            $this->logUpdate('install_error', 'error', $errorMsg);

            return [
                'success' => false,
                'error' => $errorMsg,
            ];
        }
    }

    /**
     * Download update ZIP file
     */
    private function downloadUpdate(string $url): string
    {
        $tempDir = storage_path('app/updates');
        if (!is_dir($tempDir)) {
            mkdir($tempDir, 0755, true);
        }

        $filename = 'update_' . time() . '.zip';
        $zipPath = "{$tempDir}/{$filename}";

        $this->logUpdate('download', 'info', "Downloading update from {$url}");

        $response = Http::withHeaders([
            'Accept' => 'application/zip',
            'User-Agent' => 'Pharmacy-ERP-Updater',
        ])->timeout(300) // 5 minutes timeout for large downloads
          ->get($url);

        if ($response->failed()) {
            throw new \Exception('Failed to download update package. HTTP status: ' . $response->status());
        }

        file_put_contents($zipPath, $response->body());

        if (!file_exists($zipPath)) {
            throw new \Exception('Failed to save update package.');
        }

        $this->logUpdate('download_complete', 'info', "Update downloaded successfully. Size: " . filesize($zipPath) . " bytes");

        return $zipPath;
    }

    /**
     * Extract and apply the update
     */
    private function extractAndApplyUpdate(string $zipPath, string $version): void
    {
        $tempDir = storage_path('app/updates/extracted_' . time());
        if (!is_dir($tempDir)) {
            mkdir($tempDir, 0755, true);
        }

        // Extract ZIP
        $zip = new ZipArchive();
        if ($zip->open($zipPath) !== true) {
            throw new \Exception('Failed to open update package.');
        }

        $zip->extractTo($tempDir);
        $zip->close();

        // Find the extracted directory (GitHub creates a directory with repo name and commit hash)
        $entries = scandir($tempDir);
        $sourceDir = null;
        foreach ($entries as $entry) {
            if ($entry !== '.' && $entry !== '..' && is_dir("{$tempDir}/{$entry}")) {
                $sourceDir = "{$tempDir}/{$entry}";
                break;
            }
        }

        if (!$sourceDir) {
            throw new \Exception('Could not find extracted files.');
        }

        $this->logUpdate('extract', 'info', "Update extracted to temporary directory");

        // Files and directories to exclude from update
        $excludePatterns = [
            '.env',
            '.git',
            'node_modules',
            'vendor',
            'storage/logs',
            'storage/framework/cache',
            'storage/framework/sessions',
            'storage/framework/views',
            'bootstrap/cache',
            'public/uploads',
            'DATA',
        ];

        // Copy files from extracted directory to application root
        $this->copyDirectory($sourceDir, base_path(), $excludePatterns);

        // Clean up extracted directory
        $this->deleteDirectory($tempDir);

        $this->logUpdate('files_copied', 'info', "Update files copied successfully");
    }

    /**
     * Copy directory recursively with exclusions
     */
    private function copyDirectory(string $source, string $destination, array $excludePatterns = []): void
    {
        $dir = opendir($source);
        
        if (!is_dir($destination)) {
            mkdir($destination, 0755, true);
        }

        while (($file = readdir($dir)) !== false) {
            if ($file === '.' || $file === '..') {
                continue;
            }

            $sourcePath = "{$source}/{$file}";
            $destPath = "{$destination}/{$file}";
            $relativePath = str_replace(base_path() . '/', '', $destPath);

            // Check if path matches any exclude pattern
            $shouldExclude = false;
            foreach ($excludePatterns as $pattern) {
                if (str_starts_with($relativePath, $pattern) || $relativePath === $pattern) {
                    $shouldExclude = true;
                    break;
                }
            }

            if ($shouldExclude) {
                continue;
            }

            if (is_dir($sourcePath)) {
                $this->copyDirectory($sourcePath, $destPath, $excludePatterns);
            } else {
                // Create directory if it doesn't exist
                $dirPath = dirname($destPath);
                if (!is_dir($dirPath)) {
                    mkdir($dirPath, 0755, true);
                }
                
                if (copy($sourcePath, $destPath)) {
                    // Optionally set file permissions
                    @chmod($destPath, 0644);
                }
            }
        }

        closedir($dir);
    }

    /**
     * Delete directory recursively
     */
    private function deleteDirectory(string $path): void
    {
        if (!is_dir($path)) {
            return;
        }

        $entries = scandir($path);
        foreach ($entries as $entry) {
            if ($entry === '.' || $entry === '..') {
                continue;
            }

            $fullPath = "{$path}/{$entry}";
            if (is_dir($fullPath)) {
                $this->deleteDirectory($fullPath);
            } else {
                unlink($fullPath);
            }
        }

        rmdir($path);
    }

    /**
     * Create a backup before updating
     */
    private function createBackupBeforeUpdate(): void
    {
        try {
            $this->logUpdate('backup_start', 'info', 'Creating backup before update');

            // Trigger Laravel backup if BackupService is available
            if (class_exists(\App\Services\BackupService::class)) {
                $backupService = new \App\Services\BackupService();
                $backupService->createFullBackup();
            }

            $this->logUpdate('backup_complete', 'info', 'Backup created successfully before update');
        } catch (\Exception $e) {
            $this->logUpdate('backup_warning', 'warning', 'Could not create automatic backup: ' . $e->getMessage());
        }
    }

    /**
     * Clear all Laravel caches
     */
    private function clearCaches(): void
    {
        try {
            $this->logUpdate('cache_clear', 'info', 'Clearing application caches');

            // Run artisan commands
            Artisan::call('config:clear');
            Artisan::call('route:clear');
            Artisan::call('view:clear');
            Artisan::call('cache:clear');

            $this->logUpdate('cache_clear_complete', 'info', 'All caches cleared successfully');
        } catch (\Exception $e) {
            $this->logUpdate('cache_clear_error', 'warning', 'Could not clear some caches: ' . $e->getMessage());
        }
    }

    /**
     * Log update operation
     */
    public function logUpdate(string $type, string $level, string $message, array $context = []): void
    {
        // Store in database if model exists
        if (class_exists(\App\Models\UpdateLog::class)) {
            try {
                \App\Models\UpdateLog::create([
                    'type' => $type,
                    'level' => $level,
                    'message' => $message,
                    'context' => json_encode($context),
                ]);
            } catch (\Exception $e) {
                // Fallback to file logging if DB fails
                Log::channel('updates')->$level($message, $context);
            }
        }

        // Also log to file
        Log::channel('updates')->$level($message, $context);
    }

    /**
     * Get update logs
     */
    public function getUpdateLogs(int $limit = 50): array
    {
        if (class_exists(\App\Models\UpdateLog::class)) {
            return \App\Models\UpdateLog::orderBy('created_at', 'desc')
                ->limit($limit)
                ->get()
                ->toArray();
        }

        // Return empty array if model doesn't exist
        return [];
    }

    /**
     * Get update status summary
     */
    public function getUpdateStatus(): array
    {
        $settings = $this->getSettings();
        $logs = $this->getUpdateLogs(10);
        $latestCheck = $settings['last_check_result'] ?? null;

        return [
            'current_version' => $this->getCurrentVersion(),
            'settings' => $settings,
            'latest_check' => $latestCheck,
            'recent_logs' => $logs,
            'repository' => [
                'owner' => $this->owner,
                'repo' => $this->repo,
                'branch' => $this->branch,
                'url' => "https://github.com/{$this->owner}/{$this->repo}",
            ],
        ];
    }

    /**
     * Rollback to previous version (if backup exists)
     */
    public function rollback(): array
    {
        try {
            // This would need to be implemented with proper backup handling
            // For now, log the rollback attempt
            $this->logUpdate('rollback_attempt', 'warning', 'Rollback functionality needs to be implemented with proper backup system');

            return [
                'success' => false,
                'error' => 'Rollback functionality is not yet implemented. Please restore from a manual backup.',
            ];
        } catch (\Exception $e) {
            return [
                'success' => false,
                'error' => 'Rollback failed: ' . $e->getMessage(),
            ];
        }
    }
}

