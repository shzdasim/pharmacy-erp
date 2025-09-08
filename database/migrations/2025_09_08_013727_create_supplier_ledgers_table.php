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
        Schema::create('supplier_ledgers', function (Blueprint $table) {
             $table->id();

            $table->unsignedBigInteger('supplier_id');
            $table->unsignedBigInteger('purchase_invoice_id')->nullable(); // null for manual rows

            $table->date('entry_date')->index();

            // Snapshot of invoice identifiers (even if source changes later)
            $table->string('posted_number')->nullable()->index();
            $table->string('invoice_number')->nullable()->index();

            // Money
            $table->decimal('invoice_total', 15, 2)->default(0);
            $table->decimal('total_paid', 15, 2)->default(0);
            $table->decimal('credit_remaining', 15, 2)->default(0);

            $table->string('description')->nullable();
            $table->boolean('is_manual')->default(false);

            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();

            $table->foreign('supplier_id')->references('id')->on('suppliers')->cascadeOnDelete();
            $table->foreign('purchase_invoice_id')->references('id')->on('purchase_invoices')->nullOnDelete();

            $table->unique(['supplier_id', 'purchase_invoice_id'], 'uniq_supplier_invoice');
            $table->index(['supplier_id', 'entry_date']);

             $table->enum('entry_type', ['invoice', 'payment', 'manual'])
                  ->default('invoice')
                  ->after('purchase_invoice_id')
                  ->index();

            // Payment (debit) info
            $table->decimal('debited_amount', 15, 2)->default(0)->after('total_paid');
            $table->string('payment_ref')->nullable()->after('debited_amount');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('supplier_ledgers');
    }
};
