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
        Schema::create('purchase_return_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('purchase_return_id')->constrained()->onDelete('cascade');
            $table->foreignId('product_id')->constrained()->onDelete('cascade');
            $table->string('batch')->nullable();
            $table->date('expiry')->nullable();
            $table->integer('pack_size')->default(0);
            $table->integer('return_pack_quantity')->default(0);
            $table->integer('return_unit_quantity')->default(0);
            $table->decimal('pack_purchase_price', 15, 2)->default(0);
            $table->decimal('unit_purchase_price', 15, 2)->default(0);
            $table->decimal('item_discount_percentage', 5, 2)->default(0)->nullable();
            $table->decimal('sub_total', 15, 2)->default(0);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('purchase_return_items');
    }
};
