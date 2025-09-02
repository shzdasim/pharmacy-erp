<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Sale Detail Report</title>
  <style>
    @page { margin: 18px; }
    body { font-family: DejaVu Sans, sans-serif; font-size: 12px; color: #111; }
    h1 { font-size: 18px; margin: 0 0 8px 0; }
    .meta { font-size: 11px; margin-bottom: 12px; }
    .card { border: 1px solid #e5e7eb; border-radius: 6px; margin-bottom: 12px; }
    .card-hd { background: #f3f4f6; padding: 8px 10px; border-bottom: 1px solid #e5e7eb; }
    .row { display: inline-block; margin-right: 14px; }
    table { width: 100%; border-collapse: collapse; table-layout: auto; }
    th, td { border: 1px solid #e5e7eb; padding: 6px 8px; line-height: 1.35; font-size: 12px; }
    th { background: #f9fafb; text-align: left; font-weight: 700; color: #111827; }
    td.num, th.num { text-align: right; }
    .nowrap { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .footer td { font-weight: 600; }
    .page-break { page-break-after: always; }
  </style>
</head>
<body>
  <h1>Sale Detail Report</h1>
  <div class="meta">
    From: {{ $meta['from'] ?: '—' }} &nbsp;&nbsp; To: {{ $meta['to'] ?: '—' }} &nbsp;&nbsp; Generated: {{ $meta['generatedAt'] }}
  </div>

  @forelse($rows as $i => $inv)
    <div class="card">
      <div class="card-hd">
        <span class="row"><strong>Posted #:</strong> {{ $inv['posted_number'] ?? '-' }}</span>
        <span class="row"><strong>Date:</strong> {{ $inv['invoice_date'] ?? '-' }}</span>
        <span class="row"><strong>Customer:</strong> {{ $inv['customer_name'] ?? '-' }}</span>
        <span class="row"><strong>User:</strong> {{ $inv['user_name'] ?? '-' }}</span>
        <span class="row"><strong>Doctor:</strong> {{ $inv['doctor_name'] ?? '-' }}</span>
        <span class="row"><strong>Patient:</strong> {{ $inv['patient_name'] ?? '-' }}</span>
      </div>

      <table>
        <thead>
          <tr>
            <th class="nowrap">Product Name</th>
            <th class="num nowrap">Pack Size</th>
            <th class="nowrap">Batch #</th>
            <th class="nowrap">Expiry</th>
            <th class="num nowrap">Current Qty</th>
            <th class="num nowrap">Qty</th>
            <th class="num nowrap">Price</th>
            <th class="num nowrap">Item Disc %</th>
            <th class="num nowrap">Sub Total</th>
          </tr>
        </thead>
        <tbody>
          @forelse(($inv['items'] ?? []) as $it)
            <tr>
              <td class="nowrap">{{ $it['product_name'] ?? '-' }}</td>
              <td class="num">{{ number_format($it['pack_size'] ?? 0) }}</td>
              <td class="nowrap">{{ $it['batch_number'] ?? '-' }}</td>
              <td class="nowrap">{{ $it['expiry'] ?? '-' }}</td>
              <td class="num">{{ number_format($it['current_quantity'] ?? 0) }}</td>
              <td class="num">{{ number_format($it['quantity'] ?? 0) }}</td>
              <td class="num">{{ number_format($it['price'] ?? 0, 2) }}</td>
              <td class="num">{{ number_format($it['item_discount_percentage'] ?? 0, 2) }}</td>
              <td class="num">{{ number_format($it['sub_total'] ?? 0, 2) }}</td>
            </tr>
          @empty
            <tr><td colspan="9" style="text-align:center;color:#666;">No items.</td></tr>
          @endforelse
        </tbody>
        <tfoot class="footer">
          <tr>
            <td colspan="6" class="num">Discount %</td>
            <td colspan="1" class="num">{{ number_format($inv['discount_percentage'] ?? 0, 2) }}</td>
            <td colspan="1" class="num">Discount Amt</td>
            <td colspan="1" class="num">{{ number_format($inv['discount_amount'] ?? 0, 2) }}</td>
          </tr>
          <tr>
            <td colspan="6" class="num">Tax %</td>
            <td colspan="1" class="num">{{ number_format($inv['tax_percentage'] ?? 0, 2) }}</td>
            <td colspan="1" class="num">Tax Amt</td>
            <td colspan="1" class="num">{{ number_format($inv['tax_amount'] ?? 0, 2) }}</td>
          </tr>
          <tr>
            <td colspan="7" class="num">Item Discount</td>
            <td colspan="2" class="num">{{ number_format($inv['item_discount'] ?? 0, 2) }}</td>
          </tr>
          <tr>
            <td colspan="7" class="num">Gross Amount</td>
            <td colspan="2" class="num">{{ number_format($inv['gross_amount'] ?? 0, 2) }}</td>
          </tr>
          <tr>
            <td colspan="7" class="num">Total</td>
            <td colspan="2" class="num">{{ number_format($inv['total'] ?? 0, 2) }}</td>
          </tr>
        </tfoot>
      </table>
    </div>

    @if(($i+1) % 3 === 0)
      <div class="page-break"></div>
    @endif
  @empty
    <p>No results for selected filters.</p>
  @endforelse
</body>
</html>
