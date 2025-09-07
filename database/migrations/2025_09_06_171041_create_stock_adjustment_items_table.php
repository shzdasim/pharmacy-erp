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
        Schema::create('stock_adjustment_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('stock_adjustment_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->restrictOnDelete();

            // Optional batch fields
            $table->string('batch_number')->nullable();
            $table->date('expiry')->nullable();
            $table->decimal('pack_size', 18, 3)->nullable();

            $table->decimal('previous_qty', 18, 3)->default(0);
            $table->decimal('actual_qty', 18, 3)->default(0);
            $table->decimal('diff_qty', 18, 3)->default(0);
            $table->decimal('unit_purchase_price', 18, 4)->default(0);
            $table->decimal('worth_adjusted', 18, 2)->default(0);
            $table->timestamps();

            $table->index(['stock_adjustment_id']);
            $table->index(['product_id', 'batch_number']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('stock_adjustment_items');
    }
};
