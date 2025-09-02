@php
    $logo   = $setting->logo_url ?? null;
    $store  = $setting->store_name ?? 'Store Name';
    $phone  = $setting->phone_number ?? '';
    $addr   = $setting->address ?? '';
    $lic    = $setting->license_number ?? '';

    $posted = $invoice->posted_number ?? '';
    $date   = $invoice->date ? \Carbon\Carbon::parse($invoice->date)->format('d M Y') : '';
    $user   = optional($invoice->user)->name ?? '';
    $cust   = optional($invoice->customer)->name ?? '';
    $doc    = $invoice->doctor_name ?? '';
    $pat    = $invoice->patient_name ?? '';
    $remarks= $invoice->remarks ?? '';

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
<title>Sale Invoice (A4) - {{ $posted }}</title>
<style>
  :root { --text:#111; --muted:#666; --border:#ccc; }
  * { box-sizing: border-box; }
  html, body { margin:0; padding:0; font-family: Arial, Helvetica, sans-serif; color:var(--text); }

  /* Make page a column so footer can stick to bottom */
  .page {
    width: 210mm;
    min-height: 297mm;
    padding: 16mm 14mm;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
  }
  .print-actions { margin: 12px auto; width: 210mm; text-align: right; }
  .print-actions button { padding: 8px 12px; cursor: pointer; }
  @media print { .print-actions { display:none; } .page { padding: 10mm 10mm; } }

  .header { display:flex; align-items:center; gap:16px; border-bottom:1px solid var(--border); padding-bottom:12px; }
  .logo { width:100px; height:100px; object-fit:contain; }
  .store h1 { margin:0; font-size:20px; letter-spacing:.4px; }
  .store .meta { margin-top:4px; font-size:12px; color:var(--muted); line-height:1.4; }

  .title-row { display:flex; justify-content:space-between; align-items:baseline; margin:14px 0 6px; }
  .title-row .title { font-size:18px; font-weight:700; }
  .title-row .code { color:var(--muted); }

  .grid { display:grid; grid-template-columns: repeat(3, 1fr); gap:8px 16px; font-size:12px; margin-bottom:10px; }
  .grid .lbl { color:var(--muted); width:110px; display:inline-block; }
  .grid .val { font-weight:600; }

  table { width:100%; border-collapse:collapse; margin-top:8px; font-size:12px; table-layout:fixed; }
  thead th { text-align:left; border-bottom:1px solid var(--border); padding:8px 6px; font-size:12px; }
  tbody td { border-bottom:1px dashed #e0e0e0; padding:7px 6px; vertical-align:top; word-wrap:break-word; }
  tfoot td { padding:8px 6px; font-size:13px; }
  .right { text-align:right; }

  .footer-total { width:50%; margin-left:auto; border:1px solid var(--border); border-radius:6px; overflow:hidden; margin-top:12px; }
  .footer-total .row { display:flex; justify-content:space-between; padding:10px 12px; }
  .footer-total .row + .row { border-top:1px solid var(--border); }
  .footer-total .row.total { font-weight:800; font-size:14px; }

  /* Bottom area pinned to page end */
  .bottom { margin-top:auto; }
  .footer-note { margin-top:12px; padding-top:8px; border-top:1px solid var(--border); font-size:11px; color:var(--muted); white-space:pre-wrap; }
  .thankyou { margin-top:10px; font-size:12px; text-align:center; }
</style>
</head>
<body>
<div class="print-actions">
  <button onclick="window.print()">Print</button>
</div>

<div class="page">
  {{-- Header --}}
  <div class="header">
    @if($logo)
      <img class="logo" src="{{ $logo }}" alt="Logo">
    @endif
    <div class="store">
      <h1>{{ $store }}</h1>
      <div class="meta">
        @if($lic) <div>License: {{ $lic }}</div> @endif
        @if($phone) <div>Phone: {{ $phone }}</div> @endif
        @if($addr) <div>Address: {{ $addr }}</div> @endif
      </div>
    </div>
  </div>

  {{-- Title / Code --}}
  <div class="title-row">
    <div class="title">Sale Invoice</div>
    <div class="code"># {{ $posted }}</div>
  </div>

  {{-- Top Detail --}}
  <div class="grid">
    <div><span class="lbl">Date:</span> <span class="val">{{ $date }}</span></div>
    <div><span class="lbl">User:</span> <span class="val">{{ $user }}</span></div>
    <div><span class="lbl">Customer:</span> <span class="val">{{ $cust }}</span></div>

    <div><span class="lbl">Doctor:</span> <span class="val">{{ $doc }}</span></div>
    <div><span class="lbl">Patient:</span> <span class="val">{{ $pat }}</span></div>
    <div><span class="lbl">Remarks:</span> <span class="val">{{ $remarks }}</span></div>
  </div>

  {{-- Items Table --}}
  <table>
    <thead>
      <tr>
        <th style="width:22%">Product</th>
        <th style="width:8%">Pack</th>
        <th style="width:12%">Batch</th>
        <th style="width:10%">Expiry</th>
        <th class="right" style="width:10%">Current Qty</th>
        <th class="right" style="width:8%">Qty</th>
        <th class="right" style="width:10%">Price</th>
        <th class="right" style="width:10%">Disc %</th>
        <th class="right" style="width:10%">Sub Total</th>
      </tr>
    </thead>
    <tbody>
      @foreach($invoice->items as $it)
        <tr>
          <td>{{ optional($it->product)->name ?? '-' }}</td>
          <td>{{ $it->pack_size }}</td>
          <td>{{ $it->batch_number }}</td>
          <td>{{ $it->expiry }}</td>
          <td class="right">{{ number_format((float)$it->current_quantity, 2) }}</td>
          <td class="right">{{ number_format((float)$it->quantity, 2) }}</td>
          <td class="right">{{ number_format((float)$it->price, 2) }}</td>
          <td class="right">{{ number_format((float)$it->item_discount_percentage, 2) }}</td>
          <td class="right">{{ number_format((float)$it->sub_total, 2) }}</td>
        </tr>
      @endforeach
    </tbody>
  </table>

  {{-- Footer Totals --}}
  <div class="footer-total">
    <div class="row"><div>Gross</div><div>{{ number_format((float)$gross, 2) }}</div></div>
    <div class="row"><div>Discount Amount</div><div>{{ number_format((float)$disc, 2) }}</div></div>
    <div class="row"><div>Tax Amount</div><div>{{ number_format((float)$tax, 2) }}</div></div>
    <div class="row total"><div>Total</div><div>{{ number_format((float)$total, 2) }}</div></div>
  </div>

  {{-- Bottom (sticks to page bottom) --}}
  <div class="bottom">
    @if($footerNote !== '')
      <div class="footer-note">{{ $footerNote }}</div>
    @endif
    <div class="thankyou">Thank you for your business!</div>
  </div>
</div>
</body>
</html>
