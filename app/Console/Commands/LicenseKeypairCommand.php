<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

class LicenseKeypairCommand extends Command
{
    protected $signature = 'license:keypair';
    protected $description = 'Generate an Ed25519 keypair for offline licenses';

    public function handle()
    {
        $kp = sodium_crypto_sign_keypair();
        $public = sodium_crypto_sign_publickey($kp);
        $secret = sodium_crypto_sign_secretkey($kp);

        $pubB64u = rtrim(strtr(base64_encode($public), '+/', '-_'), '=');
        $secB64u = rtrim(strtr(base64_encode($secret), '+/', '-_'), '=');

        $this->info('PUBLIC (put in .env LICENSE_PUBLIC_KEY):');
        $this->line($pubB64u);
        $this->newLine();
        $this->warn('PRIVATE (keep secret on your laptop ONLY):');
        $this->line($secB64u);

        return self::SUCCESS;
    }
}
