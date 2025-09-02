@php
    $logo   = $setting->logo_url ?? null;
    $store  = $setting->store_name ?? 'Store Name';
    $phone  = $setting->phone_number ?? '';
    $user   = optional($invoice->user)->name ?? '';
    $addr   = $setting->address ?? '';
    $posted = $invoice->posted_number ?? '';
    $date   = $invoice->date ? \Carbon\Carbon::parse($invoice->date)->format('d M Y') : '';
    $cust   = optional($invoice->customer)->name ?? '';

    $gross  = $invoice->items->sum('sub_total');
    $disc   = $invoice->discount_amount ?? 0;
    $tax    = $invoice->tax_amount ?? 0;
    $total  = $invoice->total ?? ($gross - $disc + $tax);

    // Footer note: prefer invoice.footer_note, else setting.note
    $footerNote = trim(($invoice->footer_note ?? '') !== '' ? $invoice->footer_note : ($setting->note ?? ''));
@endphp
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>Sale Invoice (Thermal) - {{ $posted }}</title>
<style>
  /* 80mm paper-ish receipt */
  * { box-sizing: border-box; }
  html, body { margin:0; padding:0; font-family:'Courier New', monospace; color:#111; }
  .print-actions { margin:8px; text-align:right; }
  .print-actions button { padding:6px 10px; cursor:pointer; }
  @media print { .print-actions { display:none; } }

  .receipt { width:80mm; max-width:100%; margin:0 auto; padding:8px 10px; }
  .center { text-align:center; }
  .right { text-align:right; }
  .muted { color:#666; }
  .logo { max-width:48mm; max-height:32mm; object-fit:contain; display:block; margin:0 auto 6px; }
  .hr { border-top:1px dashed #999; margin:6px 0; }

  .pair { display:flex; justify-content:space-between; font-size:12px; }
  .pair + .pair { margin-top:2px; }

  table { width:100%; border-collapse:collapse; font-size:12px; }
  thead th { text-align:left; padding:4px 0; border-bottom:1px dashed #999; }
  tbody td { padding:4px 0; border-bottom:1px dashed #eee; vertical-align:top; }

  .totals .pair { font-size:12px; }
  .totals .pair.total { font-weight:700; font-size:13px; }

  .note { margin-top:6px; font-size:11px; white-space:pre-wrap; }
  .foot { margin-top:6px; text-align:center; font-size:11px; }
</style>
</head>
<body>
<div class="print-actions">
  <button onclick="window.print()">Print</button>
</div>

<div class="receipt">
  @if($logo)
    <img class="logo" src="{{ $logo }}" alt="Logo">
  @endif
  <div class="center" style="font-weight:700">{{ $store }}</div>
  @if($addr)<div class="center muted">{{ $addr }}</div>@endif
  @if($phone)<div class="center muted">Ph: {{ $phone }}</div>@endif

  <div class="hr"></div>

  <div class="pair"><div>Invoice</div><div># {{ $posted }}</div></div>
  <div class="pair"><div>Date</div><div>{{ $date }}</div></div>
  @if($cust)<div class="pair"><div>Customer</div><div>{{ $cust }}</div></div>@endif
  @if($user)<div class="pair"><div>User</div><div>{{ $user }}</div></div>@endif

  <div class="hr"></div>

  <table>
    <thead>
      <tr>
        <th style="width:55%">Name</th>
        <th class="right" style="width:15%">Qty</th>
        <th class="right" style="width:15%">Price</th>
        <th class="right" style="width:15%">Disc%</th>
        <th class="right" style="width:20%">Subtotal</th>
      </tr>
    </thead>
    <tbody>
      @foreach($invoice->items as $it)
        <tr>
          <td>{{ optional($it->product)->name ?? '-' }}</td>
          <td class="right">{{ number_format((float)$it->quantity, 2) }}</td>
          <td class="right">{{ number_format((float)$it->price, 2) }}</td>
          <td class="right">{{ number_format((float)$it->item_discount_percentage, 2) }}</td>
          <td class="right">{{ number_format((float)$it->sub_total, 2) }}</td>
        </tr>
      @endforeach
    </tbody>
  </table>

  <div class="hr"></div>

  <div class="totals">
    <div class="pair"><div>Gross</div><div>{{ number_format((float)$gross, 2) }}</div></div>
    <div class="pair"><div>Discount</div><div>{{ number_format((float)$disc, 2) }}</div></div>
    <div class="pair"><div>Tax</div><div>{{ number_format((float)$tax, 2) }}</div></div>
    <div class="pair total"><div>Total</div><div>{{ number_format((float)$total, 2) }}</div></div>
  </div>

  {{-- Footer note at bottom of receipt --}}
  @if($footerNote !== '')
    <div class="hr"></div>
    <div class="note">{{ $footerNote }}</div>
  @endif

  <div class="foot">Thank you!</div>
</div>
</body>
</html>
