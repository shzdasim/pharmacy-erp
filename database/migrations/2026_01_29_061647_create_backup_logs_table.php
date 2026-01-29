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
        Schema::create('backup_logs', function (Blueprint $table) {
            $table->id();
            $table->string('filename')->unique();
            $table->string('type')->comment('full, database, settings');
            $table->unsignedBigInteger('size')->comment('file size in bytes');
            $table->string('path')->comment('relative path to backup file');
            $table->json('metadata')->nullable()->comment('additional info like tables count, etc');
            $table->string('created_by')->nullable()->comment('user who created backup');
            $table->enum('status', ['pending', 'completed', 'failed', 'restored'])->default('pending');
            $table->text('error_message')->nullable()->comment('error details if failed');
            $table->timestamps();
            $table->timestamp('expires_at')->nullable()->comment('when this backup should be auto-deleted');
            
            $table->index(['status', 'created_at']);
            $table->index(['type', 'created_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('backup_logs');
    }
};

