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
        Schema::create('purchase_invoice_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('purchase_invoice_id')->constrained()->onDelete('cascade');
            $table->foreignId('product_id')->constrained()->onDelete('cascade');
            $table->string('batch')->nullable();
            $table->date('expiry')->nullable();
            $table->integer('pack_quantity');
            $table->integer('pack_size')->nullable();
            $table->integer('unit_quantity');
            $table->decimal('pack_purchase_price', 10, 2);
            $table->decimal('unit_purchase_price', 10, 2);
            $table->decimal('pack_sale_price', 10, 2);
            $table->decimal('unit_sale_price', 10, 2);
            $table->integer('pack_bonus')->nullable();
            $table->integer('unit_bonus')->nullable();
            $table->decimal('item_discount_percentage', 5, 2)->nullable();
            $table->decimal('margin', 10, 2);
            $table->decimal('sub_total', 10, 2);
            $table->decimal('avg_price', 10, 2);
            $table->integer('quantity');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('purchase_invoice_items');
    }
};
