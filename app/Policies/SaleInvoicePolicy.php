<?php

namespace App\Policies;

use App\Models\SaleInvoice;
use App\Models\User;

class SaleInvoicePolicy
{
   public function viewAny(User $user): bool
   {
    return $user->can('sale-invoice.view');
   }

   public function view(User $user, SaleInvoice $invoice):bool
   {
    return $user->can('sale-invoice.view');
   }

   public function create(User $user): bool
   {
    return $user->can('sale-invoice.create');
   }

   public function update(User $user, SaleInvoice $invoice): bool
   {
    return $user->can('sale-invoice.update');
   }

   public function delete(User $user, SaleInvoice $invoice): bool
   {
    return $user->can('sale-invoice.delete');
   }
}
