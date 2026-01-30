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
        Schema::create('update_logs', function (Blueprint $table) {
            $table->id();
            $table->string('type', 50); // check, download, install, backup, etc.
            $table->string('level', 20); // info, warning, error, success
            $table->text('message');
            $table->json('context')->nullable(); // Additional context data
            $table->timestamps();

            // Index for efficient queries
            $table->index('type');
            $table->index('level');
            $table->index('created_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('update_logs');
    }
};

