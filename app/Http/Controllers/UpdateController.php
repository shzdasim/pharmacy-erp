<?php

namespace App\Http\Controllers;

use App\Services\UpdateService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class UpdateController extends Controller
{
    private UpdateService $updateService;

    public function __construct(UpdateService $updateService)
    {
        $this->updateService = $updateService;
    }

    /**
     * Check for available updates
     */
    public function check(Request $request): JsonResponse
    {
        try {
            $result = $this->updateService->checkForUpdates();
            
            return response()->json($result);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => 'Failed to check for updates: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get current update status and settings
     */
    public function status(Request $request): JsonResponse
    {
        try {
            $status = $this->updateService->getUpdateStatus();
            
            return response()->json([
                'success' => true,
                'data' => $status,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => 'Failed to get update status: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Update settings
     */
    public function updateSettings(Request $request): JsonResponse
    {
        try {
            $validated = $request->validate([
                'auto_check_enabled' => 'sometimes|boolean',
                'auto_install_enabled' => 'sometimes|boolean',
                'require_confirmation' => 'sometimes|boolean',
                'check_on_login' => 'sometimes|boolean',
            ]);

            $this->updateService->updateSettings($validated);

            return response()->json([
                'success' => true,
                'message' => 'Update settings saved successfully.',
                'data' => $this->updateService->getSettings(),
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => 'Failed to update settings: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Install the latest update
     */
    public function install(Request $request): JsonResponse
    {
        try {
            $force = $request->boolean('force', false);
            
            $result = $this->updateService->installUpdate($force);
            
            if (!$result['success']) {
                return response()->json($result, 400);
            }

            return response()->json($result);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => 'Failed to install update: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get update logs/history
     */
    public function logs(Request $request): JsonResponse
    {
        try {
            $limit = $request->integer('limit', 50);
            
            $logs = $this->updateService->getUpdateLogs($limit);
            
            return response()->json([
                'success' => true,
                'data' => $logs,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => 'Failed to get update logs: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get latest release information from GitHub
     */
    public function latestRelease(Request $request): JsonResponse
    {
        try {
            $checkResult = $this->updateService->checkForUpdates();
            
            if ($checkResult['success']) {
                return response()->json([
                    'success' => true,
                    'data' => [
                        'version' => $checkResult['latest_version'],
                        'release_info' => $checkResult['release_info'],
                    ],
                ]);
            }

            return response()->json([
                'success' => false,
                'error' => $checkResult['error'] ?? 'Could not fetch release information.',
            ], 400);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => 'Failed to get release information: ' . $e->getMessage(),
            ], 500);
        }
    }
}

