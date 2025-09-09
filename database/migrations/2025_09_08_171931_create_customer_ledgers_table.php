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
        Schema::create('customer_ledgers', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('customer_id');
            $table->unsignedBigInteger('sale_invoice_id')->nullable(); // null for manual/payment-only rows

            $table->date('entry_date')->index();

            // Snapshot of invoice identifiers (even if source changes later)
            $table->string('posted_number')->nullable()->index();
            $table->string('invoice_number')->nullable()->index();

            // Money (AR side)
            $table->decimal('invoice_total', 15, 2)->default(0);     // amount of the invoice (credit to AR)
            $table->decimal('total_received', 15, 2)->default(0);     // cumulative received for this invoice (if tied)
            $table->decimal('balance_remaining', 15, 2)->default(0);  // running customer balance after this entry

            $table->string('description')->nullable();
            $table->boolean('is_manual')->default(false);

            $table->enum('entry_type', ['invoice', 'payment', 'manual'])
                  ->default('invoice')
                  ->index();

            // Payment (cash/bank receipt) info
            $table->decimal('credited_amount', 15, 2)->default(0);
            $table->string('payment_ref')->nullable();

            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();

            $table->foreign('customer_id')->references('id')->on('customers')->cascadeOnDelete();
            $table->foreign('sale_invoice_id')->references('id')->on('sale_invoices')->nullOnDelete();

            $table->unique(['customer_id', 'sale_invoice_id'], 'uniq_customer_invoice');
            $table->index(['customer_id', 'entry_date']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('customer_ledgers');
    }
};
