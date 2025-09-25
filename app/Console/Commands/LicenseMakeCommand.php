<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

class LicenseMakeCommand extends Command
{
    protected $signature = 'license:make 
        {--name= : Customer or company name}
        {--email= : Customer email}
        {--days=365 : Validity in days (ignored if --exp set)}
        {--features=core : CSV list of feature flags}
        {--seats=1 : Seat count}
        {--machine= : Optional exact machine hash for binding}
        {--nbf= : Not-before UNIX timestamp}
        {--exp= : Expiry UNIX timestamp}
        {--private= : PRIVATE key in base64url (if omitted, read from LICENSE_PRIVATE_KEY env)}';

    protected $description = 'Generate a signed offline license';

    private function b64u(string $bin): string {
        return rtrim(strtr(base64_encode($bin), '+/', '-_'), '=');
    }
    private function b64uDecode(string $txt): string {
        $r = strtr($txt, '-_', '+/');
        $pad = strlen($r) % 4;
        if ($pad) $r .= str_repeat('=', 4 - $pad);
        return base64_decode($r);
    }

    public function handle()
    {
        $privB64u = $this->option('private') ?: env('LICENSE_PRIVATE_KEY');
        if (!$privB64u) {
            $this->error('Provide --private or set LICENSE_PRIVATE_KEY in env on your laptop.');
            return self::FAILURE;
        }

        $secret = $this->b64uDecode($privB64u);

        $now = time();
        $nbf = $this->option('nbf') ? (int)$this->option('nbf') : $now;
        $exp = $this->option('exp') ? (int)$this->option('exp') : ($now + ((int)$this->option('days'))*86400);

        $payload = [
            'iss' => 'YourCompany',
            'sub' => 'YourApp',
            'ver' => 1,
            'name' => $this->option('name') ?: null,
            'email'=> $this->option('email') ?: null,
            'features' => array_filter(array_map('trim', explode(',', (string)$this->option('features')))),
            'seats' => (int)$this->option('seats'),
            'nbf' => $nbf,
            'exp' => $exp,
        ];

        if ($this->option('machine')) {
            $payload['machine'] = $this->option('machine');
        }

        $payloadJson = json_encode($payload, JSON_UNESCAPED_SLASHES);
        $sig = sodium_crypto_sign_detached($payloadJson, $secret);

        $license = $this->b64u($sig).'.'.$this->b64u($payloadJson);

        $this->info('LICENSE:');
        $this->line($license);

        return self::SUCCESS;
    }
}
