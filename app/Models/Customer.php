<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Customer extends Model
{
    protected $fillable = ['name', 'email', 'phone', 'address'];
    public function saleInvoices()
    {
        return $this->hasMany(\App\Models\SaleInvoice::class);
    }

    public function saleReturns()
    {
        return $this->hasMany(\App\Models\SaleReturn::class);
    }
}
