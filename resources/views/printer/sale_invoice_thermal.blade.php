@php
    use Illuminate\Support\Facades\DB;

    $logo   = $setting->logo_url ?? null;
    $store  = $setting->store_name ?? 'Store Name';
    $phone  = $setting->phone_number ?? '';
    $user   = optional($invoice->user)->name ?? '';
    $addr   = $setting->address ?? '';
    $posted = $invoice->posted_number ?? '';
    $date   = $invoice->date ? \Carbon\Carbon::parse($invoice->date)->format('d M Y') : '';
    $cust   = optional($invoice->customer)->name ?? '';

    $gross  = $invoice->items->sum('sub_total');
    $disc   = (float)($invoice->discount_amount ?? 0);
    $tax    = (float)($invoice->tax_amount ?? 0);
    $total  = isset($printTotal)
                ? (float)$printTotal
                : (float)($invoice->total ?? ($gross - $disc + $tax));

    // NEW: receive + remaining figures (controller can pass these; otherwise compute here safely)
    $totalReceive   = isset($printReceive)    ? (float)$printReceive    : (float)($invoice->total_receive ?? 0);
    $remainThis     = isset($printRemainThis) ? (float)$printRemainThis : max($total - $totalReceive, 0);

    // Old remaining from *previous* invoices of this customer (sum of positive (total - total_receive))
    if (isset($printOldRemain)) {
        $oldRemaining = (float)$printOldRemain;
    } else {
        $oldRemaining = 0.0;
        if ($invoice->customer_id) {
            $oldRemaining = \App\Models\SaleInvoice::where('customer_id', $invoice->customer_id)
                ->where('id', '<', $invoice->id) // strictly older by id; change to date if you prefer
                ->sum(DB::raw("
                    CASE
                        WHEN COALESCE(total,0) - COALESCE(total_receive,0) > 0
                        THEN COALESCE(total,0) - COALESCE(total_receive,0)
                        ELSE 0
                    END
                "));
        }
    }

    $grandRemaining = isset($printGrandRemain)
        ? (float)$printGrandRemain
        : ($remainThis + (float)$oldRemaining);

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
    font-weight: 700;       /* bold for darker thermal output */
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

  /* --- Watermark (real <img> so it prints) --- */
  .wm {
    position: absolute;
    top: 2mm;
    left: 0; right: 0;
    z-index: 0;              /* behind content */
    text-align: center;
    pointer-events: none;
    user-select: none;
  }
  .wm img {
    width: 58mm;             /* fits inside 78mm page */
    max-width: 90%;
    opacity: 0.08;           /* subtle for thermal */
    filter: grayscale(100%) contrast(90%);
    -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
  }

  /* Foreground content above watermark */
  .content { position:relative; z-index:1; }

  /* --- Table --- */
  table { width:100%; border-collapse:collapse; }
  thead th { text-align:left; padding:2px 2px; border:2px solid #000; }
  tbody td { padding:0px 0; border-bottom:1px solid #000; vertical-align:top; }
  th.right, td.right { text-align:right; white-space:nowrap; }
  td.center { text-align:center; }

  /* Column widths to fit 78mm */
  th.col-name     { width:45%; }
  th.col-qty      { width:13%; }
  th.col-price    { width:15%; }
  th.col-disc     { width:12%; }
  th.col-subtotal { width:15%; }

  /* --- Totals --- */
  .totals .pair.total { font-size:14px; }

  /* --- Footer --- */
  .note { margin-top:6px; white-space:pre-wrap; }
  .foot { margin-top:6px; text-align:center; }
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
          <th class="right col-disc">Dis%</th>
          <th class="right col-subtotal">Subt.</th>
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

      {{-- NEW: payment & remaining summary (as requested) --}}
      <div class="hr" style="margin:6px 0;"></div>
      <div class="pair"><div>Total Receive</div><div>{{ number_format($totalReceive, 2) }}</div></div>
      <div class="pair"><div>Remaining (This)</div><div>{{ number_format($remainThis, 2) }}</div></div>
      @if($oldRemaining > 0)
        <div class="pair"><div>Old Remaining</div><div>{{ number_format($oldRemaining, 2) }}</div></div>
      @endif
      <div class="pair total"><div>Total Remaining</div><div>{{ number_format($grandRemaining, 2) }}</div></div>
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
