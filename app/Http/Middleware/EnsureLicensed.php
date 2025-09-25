<?php

namespace App\Http\Middleware;

use App\Services\LicenseService;
use Closure;
use Illuminate\Http\Request;

class EnsureLicensed
{
    public function __construct(private LicenseService $svc) {}

    public function handle(Request $request, Closure $next)
    {
        $status = $this->svc->currentStatus();

        if (!$status['valid']) {
            return response()->json([
                'ok' => false,
                'code' => 'license_required',
                'reason' => $status['reason'] ?? 'Not licensed',
            ], 402); // Payment Required (signals the frontend to redirect)
        }

        return $next($request);
    }
}
