<?php

namespace App\Services;

use App\Models\License;

class LicenseService
{
    public static function b64uEncode(string $bin): string {
        return rtrim(strtr(base64_encode($bin), '+/', '-_'), '=');
    }

    public static function b64uDecode(string $txt): string {
        $r = strtr($txt, '-_', '+/');
        $pad = strlen($r) % 4;
        if ($pad) $r .= str_repeat('=', 4 - $pad);
        return base64_decode($r);
    }

    public function getPublicKey(): string {
        // Public key is stored in base64url in env; convert to raw binary for sodium
        return self::b64uDecode(config('license.public_key'));
    }

    public function computeMachineId(): string {
        // Bind to installation: create (or reuse) a random machine id saved on first run
        $path = storage_path('app/.machine-id');
        if (!file_exists($path)) {
            $basis = php_uname().'|'.gethostname().'|'.(function_exists('posix_getuid') ? posix_getuid() : 0);
            $id = hash('sha256', $basis.random_bytes(16));
            file_put_contents($path, $id);
        }
        return trim(file_get_contents($path));
    }

    /**
     * @return array [bool valid, array payload|null, string|null reason]
     */
    public function verifyString(string $licenseKey, ?string $machineId = null): array
    {
        if (!str_contains($licenseKey, '.')) {
            return [false, null, 'Malformed license'];
        }

        [$sigB64, $payloadB64] = explode('.', $licenseKey, 2);
        $sig     = self::b64uDecode($sigB64);
        $payloadJson = self::b64uDecode($payloadB64);

        $payload = json_decode($payloadJson, true);
        if (!is_array($payload)) {
            return [false, null, 'Invalid JSON payload'];
        }

        // Signature
        $ok = sodium_crypto_sign_verify_detached($sig, $payloadJson, $this->getPublicKey());
        if (!$ok) {
            return [false, $payload, 'Bad signature'];
        }

        $now = time();
        if (isset($payload['nbf']) && $now < (int)$payload['nbf']) {
            return [false, $payload, 'Not yet valid'];
        }
        if (isset($payload['exp']) && $now > (int)$payload['exp']) {
            return [false, $payload, 'Expired'];
        }

        // Optional machine binding
        if (config('license.bind_to_machine') && !empty($payload['machine'])) {
            if (!$machineId) $machineId = $this->computeMachineId();
            if (!hash_equals($payload['machine'], $machineId)) {
                return [false, $payload, 'Wrong machine'];
            }
        }

        return [true, $payload, null];
    }

    public function currentStatus(): array
    {
        $rec = License::latest('id')->first();
        if (!$rec) {
            return ['valid' => false, 'reason' => 'No license installed'];
        }

        [$ok, $payload, $reason] = $this->verifyString(
            $rec->license_key,
            config('license.bind_to_machine') ? $this->computeMachineId() : null
        );

        return [
            'valid'   => $ok,
            'reason'  => $reason,
            'payload' => $payload,
            'expires_at' => $payload['exp'] ?? null,
        ];
    }
}
