@php
    use Illuminate\Support\Facades\DB;

    $store  = $setting->store_name ?? 'Store Name';
    $phone  = $setting->phone_number ?? '';
    $user   = optional($invoice->user)->name ?? '';
    $posted = $invoice->posted_number ?? '';
    $date   = $invoice->date ? \Carbon\Carbon::parse($invoice->date)->format('d/m/Y') : '';
    $cust   = optional($invoice->customer)->name ?? '';

    $gross  = $invoice->items->sum('sub_total');
    $disc   = (float)($invoice->discount_amount ?? 0);
    $tax    = (float)($invoice->tax_amount ?? 0);
    $total  = isset($printTotal) ? (float)$printTotal : (float)($invoice->total ?? ($gross - $disc + $tax));
    $totalReceive = isset($printReceive) ? (float)$printReceive : (float)($invoice->total_receive ?? 0);
    $remainThis = isset($printRemainThis) ? (float)$printRemainThis : max($total - $totalReceive, 0);
    $footerNote = trim(($invoice->footer_note ?? '') !== '' ? $invoice->footer_note : ($setting->note ?? ''));
@endphp
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>Sale Invoice (Minimal Thermal) - {{ $posted }}</title>
<style>
  @page { size: 58mm auto; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin:0; padding:0; color:#000; background:#fff; }
  body {
    font-family: 'Courier New', monospace;
    font-weight: 400;
    font-size: 10px;
    line-height: 1.2;
    -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
  }
  .print-actions { margin:5px; text-align:right; }
  .print-actions button { padding:4px 8px; cursor:pointer; font-size:10px; }
  @media print { .print-actions { display:none; } }
  .receipt { width:58mm; max-width:100%; margin:0 auto; padding:0 4px 4px; }
  .center { text-align:center; }
  .right  { text-align:right; }
  .hr { border-top:1px solid #000; margin:3px 0; }
  .pair { display:flex; justify-content:space-between; }
  .pair + .pair { margin-top:1px; }
  table { width:100%; border-collapse:collapse; }
  tbody td { padding:0; border-bottom:1px dotted #000; vertical-align:top; }
  th.right, td.right { text-align:right; white-space:nowrap; }
  td.center { text-align:center; }
  .item-name { width:50%; }
  .item-qty { width:15%; text-align:center; }
  .item-price { width:35%; text-align:right; }
  .totals .pair { margin-top:2px; }
  .totals .total { font-weight:bold; font-size:12px; border-top:1px solid #000; padding-top:2px; }
  .note { margin-top:4px; white-space:pre-wrap; font-size:8px; }
  .foot { margin-top:6px; text-align:center; font-size:8px; }
</style>
</head>
<body>
<div class="print-actions">
  <button onclick="window.print()">Print</button>
</div>
<div class="receipt">
  <div class="center" style="font-size:16px; font-weight:bold;">{{ $store }}</div>
  @if($phone)<div class="center">{{ $phone }}</div>@endif
  <div class="hr"></div>
  <div class="pair"><span>Inv#</span><span>{{ $posted }}</span></div>
  <div class="pair"><span>Date</span><span>{{ $date }}</span></div>
  @if($cust)<div class="pair"><span>Cust</span><span>{{ $cust }}</span></div>@endif
  <div class="hr"></div>
  <table>
    <tbody>
      @foreach($invoice->items as $it)
        <tr>
          <td class="item-name">{{ optional($it->product)->name ?? '-' }}</td>
          <td class="item-qty">{{ number_format((float)$it->quantity) }}x</td>
          <td class="item-price">{{ number_format((float)$it->sub_total, 2) }}</td>
        </tr>
      @endforeach
    </tbody>
  </table>
  <div class="totals">
    <div class="hr"></div>
    <div class="pair"><span>Total</span><span>{{ number_format((float)$total, 2) }}</span></div>
    @if($remainThis > 0)
      <div class="pair"><span>Paid</span><span>{{ number_format($totalReceive, 2) }}</span></div>
      <div class="pair total"><span>Due</span><span>{{ number_format($remainThis, 2) }}</span></div>
    @endif
  </div>
  @if($footerNote !== '')
    <div class="hr"></div>
    <div class="note">{{ $footerNote }}</div>
  @endif
  <div class="foot">Software by Asim Shahzad<br/>PH:0304-7674787</div>
</div>
</body>
</html>
