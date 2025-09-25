<?php

use App\Http\Middleware\EnsureLicensed;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Spatie\Permission\Middleware\PermissionMiddleware;
use Spatie\Permission\Middleware\RoleMiddleware;
use Spatie\Permission\Middleware\RoleOrPermissionMiddleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__ . '/../routes/web.php',
        api: __DIR__ . '/../routes/api.php',
        commands: __DIR__ . '/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Route middleware aliases (Laravel 11 replaces Http\Kernel)
        $middleware->alias([
            'role'                 => RoleMiddleware::class,
            'permission'           => PermissionMiddleware::class,
            'roles_or_permissions' => RoleOrPermissionMiddleware::class,
            'licensed'             => EnsureLicensed::class,
        ]);

        // DO NOT append 'licensed' globally to the 'api' group.
        // We'll apply it only to protected route groups in routes/api.php.
        // Example (leave disabled):
        // $middleware->appendToGroup('api', [EnsureLicensed::class]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        //
    })
    ->create();
