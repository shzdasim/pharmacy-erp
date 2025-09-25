<?php

return [
    // Public key in URL-safe base64 (no padding). ONLY public key goes in the shipped app.
    'public_key' => env('LICENSE_PUBLIC_KEY'),

    // If true, license payload must include an exact machine hash.
    'bind_to_machine' => env('LICENSE_BIND_TO_MACHINE', false),

    // When to recheck/allow grace, if you want (not used to extend expiry; optional).
    'grace_days' => env('LICENSE_GRACE_DAYS', 0),
];
