<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class License extends Model
{
    protected $fillable = [
        'license_key','payload','valid','reason','machine_hash',
        'activated_at','expires_at','last_verified_at'
    ];

    protected $casts = [
        'payload' => 'array',
        'activated_at' => 'datetime',
        'expires_at' => 'datetime',
        'last_verified_at' => 'datetime',
    ];
}
