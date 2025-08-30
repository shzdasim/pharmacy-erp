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
        Schema::create('purchase_returns', function (Blueprint $table) {
            $table->id();

            // Supplier (required)
            $table->foreignId('supplier_id')->constrained()->cascadeOnDelete();

            // Document fields
            $table->string('posted_number')->unique();
            $table->date('date');

            // Invoice is OPTIONAL to support Open Return
            $table->foreignId('purchase_invoice_id')
                  ->nullable()
                  ->constrained()
                  ->nullOnDelete();

            // Totals
            $table->decimal('gross_total', 15, 2)->default(0);
            $table->decimal('discount_percentage', 5, 2)->default(0)->nullable();
            $table->decimal('tax_percentage', 5, 2)->default(0)->nullable();
            $table->decimal('discount_amount', 15, 2)->default(0)->nullable();
            $table->decimal('tax_amount', 15, 2)->default(0)->nullable();
            $table->decimal('total', 15, 2)->default(0);

            $table->text('remarks')->nullable();

            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('purchase_returns');
    }
};
