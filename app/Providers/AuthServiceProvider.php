<?php

namespace App\Providers;

use App\Models\Brand;
use App\Models\Category;
use App\Models\Supplier;
use App\Policies\BrandPolicy;
use App\Policies\CategoryPolicy;
use App\Policies\SupplierPolicy;
use Illuminate\Foundation\Support\Providers\AuthServiceProvider as ServiceProvider;
use Illuminate\Support\Facades\Gate;

class AuthServiceProvider extends ServiceProvider
{
    protected $policies = [
        Category::class => CategoryPolicy::class,
        Supplier::class => SupplierPolicy::class,
        Brand::class => BrandPolicy::class,
    ];
    /**
     * Register any authentication / authorization services.
     */
    public function boot(): void
    {
        $this->registerPolicies();

        // This makes super-admin have all permissions automatically
        Gate::before(function ($user, $ability) {
            return $user->hasRole('Admin') ? true : null; // <- Admin has all abilities
        });

        // keep your manage-users Gate but let’s tie it to either role or permission
        Gate::define('manage-users', function ($user) {
            if (method_exists($user, 'hasAnyRole') && $user->hasAnyRole(['Admin','Manager'])) {
                return true;
            }
            // OR allow via explicit permission:
            if (method_exists($user, 'can') && $user->can('user.manage')) {
                return true;
            }
            return false;
        });

    }
}
