<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('settings', function (Blueprint $table) {
            $table->id();
            $table->string('store_name')->nullable();
            $table->string('logo_path')->nullable(); // storage path (public disk)
            $table->string('phone_number', 30)->nullable();
            $table->string('address', 500)->nullable();
            $table->string('license_number', 100)->nullable();
            $table->text('note')->nullable(); // printed at invoice bottom
            $table->enum('printer_type', ['thermal', 'a4'])->default('thermal');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('settings');
    }
};
