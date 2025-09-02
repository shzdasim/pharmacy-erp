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
  /* --- Page & print setup (78mm width, no browser headers/footers) --- */
  @page { size: 78mm auto; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin:0; padding:0; color:#000; background:#fff; }
  body { 
    font-family: 'Courier New', monospace;
    font-weight: 700;                /* bold for darker thermal output */
    font-size: 13px;
    line-height: 1.25;
    -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
  }

  .print-actions { margin:8px; text-align:right; }
  .print-actions button { padding:6px 10px; cursor:pointer; }
  @media print { .print-actions { display:none; } }

  /* --- Receipt layout --- */
  .receipt { width:78mm; max-width:100%; margin:0 auto; padding:0 6px 6px; position:relative; overflow:hidden; }
  .center { text-align:center; }
  .right  { text-align:right; }
  .logo { max-width:56mm; max-height:32mm; object-fit:contain; display:block; margin:0 auto 6px; }
  .hr { border-top:1px dashed #000; margin:6px 0; }

  .pair { display:flex; justify-content:space-between; }
  .pair + .pair { margin-top:2px; }

  /* --- Watermark layer (real <img>, not CSS background, so it prints) --- */
  .wm {
    position:absolute;
    inset:0;
    display:flex;
    align-items:center;
    justify-content:center;
    top:10px;
    z-index:0;                       /* behind all content */
    pointer-events:none;
    user-select:none;
  }
  .wm img {
    width:58mm;                      /* fits inside 78mm with margins */
    max-width:90%;
    opacity:0.8;                    /* light for readability; adjust 0.05–0.12 if needed */
    filter: grayscale(100%) contrast(90%);
    -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
  }

  /* Keep actual content above the watermark */
  .content { position:relative; z-index:1; }

  /* --- Table (your current borders) --- */
  table { width:100%; border-collapse:collapse; }
  thead th { text-align:left; padding:2px 2px; border:2px solid #000; }
  tbody td { padding:0px 0; border-bottom:1px solid #000; vertical-align:top; }
  th.right, td.right { text-align:right; white-space:nowrap; }
  td.center { text-align:center; }
  /* Fit columns within 100% total on 78mm */
  th.col-name     { width:40%; }
  th.col-qty      { width:13%; }
  th.col-price    { width:15%; }
  th.col-disc     { width:12%; }
  th.col-subtotal { width:20%; }

  /* --- Totals --- */
  .totals .pair.total { font-size:14px; }

  /* --- Footer --- */
  .note { margin-top:6px; white-space:pre-wrap; }
  .foot { margin-top:6px; text-align:center; }

  /* Cut right after Thank you! */
  .receipt, .foot { padding-bottom:0; margin-bottom:0; }
</style>
</head>
<body>
<div class="print-actions">
  <button onclick="window.print()">Print</button>
</div>

<div class="receipt">
  {{-- Watermark behind everything --}}
  @if($logo)
  <div class="wm">
    <img src="{{ $logo }}" alt="Watermark">
  </div>
  @endif

  {{-- Foreground content --}}
  <div class="content">
    <div class="center" style="font-size:29px">{{ $store }}</div>
    @if($addr)<div class="center">{{ $addr }}</div>@endif
    @if($phone)<div class="center">Ph: {{ $phone }}</div>@endif

    <div class="hr"></div>

    <div class="pair"><div>Invoice</div><div># {{ $posted }}</div></div>
    <div class="pair"><div>Date</div><div>{{ $date }}</div></div>
    @if($cust)<div class="pair"><div>Customer</div><div>{{ $cust }}</div></div>@endif
    @if($user)<div class="pair"><div>User</div><div>{{ $user }}</div></div>@endif

    <div class="hr"></div>

    <table>
      <thead>
        <tr>
          <th class="col-name">Name</th>
          <th class="right col-qty">Qty</th>
          <th class="right col-price">Price</th>
          <th class="right col-disc">Disc%</th>
          <th class="right col-subtotal">Subtotal</th>
        </tr>
      </thead>
      <tbody>
        @foreach($invoice->items as $it)
          <tr>
            <td style="font-size: 11px">{{ optional($it->product)->name ?? '-' }}</td>
            <td class="center">{{ number_format((float)$it->quantity) }}</td>
            <td class="right">{{ number_format((float)$it->price, 2) }}</td>
            <td class="center">{{ number_format((float)$it->item_discount_percentage) }}</td>
            <td class="right">{{ number_format((float)$it->sub_total, 2) }}</td>
          </tr>
        @endforeach
      </tbody>
    </table>

    <div class="totals">
      <div class="pair"><div>Gross</div><div>{{ number_format((float)$gross, 2) }}</div></div>
      <div class="pair"><div>Discount</div><div>{{ number_format((float)$disc, 2) }}</div></div>
      <div class="pair"><div>Tax</div><div>{{ number_format((float)$tax, 2) }}</div></div>
      <div class="pair total"><div>Total</div><div>{{ number_format((float)$total, 2) }}</div></div>
    </div>

    @if($footerNote !== '')
      <div class="hr"></div>
      <div class="note">{{ $footerNote }}</div>
    @endif

    <div class="foot">Thank you!</div>
  </div>
</div>
</body>
</html>
