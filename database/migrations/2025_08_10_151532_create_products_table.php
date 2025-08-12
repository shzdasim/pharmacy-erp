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
        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->string('product_code')->unique();
            $table->string('name')->unique();
            $table->string('image')->nullable();
            $table->string('formulation')->nullable();
            $table->text('description')->nullable();
            $table->bigInteger('pack_size');
            $table->bigInteger('quantity')->nullable();
            $table->decimal('pack_purchase_price', 12, 2)->nullable();
            $table->decimal('pack_sale_price', 12, 2)->nullable();
            $table->decimal('unit_purchase_price', 12, 2)->nullable();
            $table->decimal('unit_sale_price', 12, 2)->nullable();
            $table->decimal('avg_price', 12, 2)->nullable();

            $table->enum('narcotic', ['yes', 'no'])->default('no');

            $table->bigInteger('max_discount')->nullable();
            $table->unsignedBigInteger('category_id');
            $table->unsignedBigInteger('brand_id');
            $table->unsignedBigInteger('supplier_id')->nullable();

            $table->string('rack')->nullable();
            $table->string('barcode')->unique();

            $table->timestamps();

            $table->foreign('brand_id')->references('id')->on('brands')->onDelete('cascade');
            $table->foreign('category_id')->references('id')->on('categories')->onDelete('cascade');
            $table->foreign('supplier_id')->references('id')->on('suppliers')->onDelete('set null');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('products');
    }
};
