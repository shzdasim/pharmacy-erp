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
        Schema::create('sale_invoice_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sale_invoice_id')->constrained()->onDelete('cascade');
            $table->foreignId('product_id')->constrained()->onDelete('cascade');
            $table->integer('pack_size');
            $table->string('batch_number')->nullable();
            $table->date('expiry')->nullable();
            $table->integer('current_quantity')->default(0); // available at sell time (read-only snapshot)
            $table->integer('quantity');                     // units sold
            $table->decimal('price', 15, 2);                 // unit price
            $table->decimal('item_discount_percentage', 5, 2)->default(0)->nullable();
            $table->decimal('sub_total', 15, 2);             // line total after item discount
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('sale_invoice_items');
    }
};
