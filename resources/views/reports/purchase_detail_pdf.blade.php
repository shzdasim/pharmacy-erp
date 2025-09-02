{{-- resources/views/reports/purchase_detail_pdf.blade.php --}}
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Purchase Detail Report</title>
  <style>
    @page { margin: 18px 18px 18px 18px; }
    body { font-family: DejaVu Sans, sans-serif; font-size: 11px; color: #111; }
    h1 { font-size: 16px; margin: 0 0 6px 0; }
    .meta { font-size: 10px; margin-bottom: 10px; }
    .card { border: 1px solid #ddd; border-radius: 6px; margin-bottom: 12px; }
    .card-hd { background: #f6f7f9; padding: 6px 8px; border-bottom: 1px solid #ddd; }
    .row { display: inline-block; margin-right: 14px; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    th, td { border: 1px solid #ddd; padding: 3px 4px; }
    th { background: #fafafa; text-align: left; font-weight: 600; }
    td.num, th.num { text-align: right; }
    .small { font-size: 10px; color: #555; }
    .nowrap { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .mb8 { margin-bottom: 8px; }
    .mb4 { margin-bottom: 4px; }
    .footer td { font-weight: 600; }
    .page-break { page-break-after: always; }
  </style>
</head>
<body>
  <h1>Purchase Detail Report</h1>
  <div class="meta">
    From: {{ $meta['from'] ?: '—' }} &nbsp;&nbsp; To: {{ $meta['to'] ?: '—' }} &nbsp;&nbsp; Generated: {{ $meta['generatedAt'] }}
  </div>

  @forelse($rows as $i => $inv)
    <div class="card">
      <div class="card-hd">
        <span class="row"><strong>Supplier:</strong> {{ $inv['supplier_name'] ?? '-' }}</span>
        <span class="row"><strong>Posted #:</strong> {{ $inv['posted_number'] ?? '-' }}</span>
        <span class="row"><strong>Invoice #:</strong> {{ $inv['invoice_number'] ?? '-' }}</span>
        <span class="row"><strong>Date:</strong> {{ $inv['invoice_date'] ?? '-' }}</span>
      </div>

      <table>
        <thead>
          <tr>
            <th class="nowrap" style="width: 18%;">Product Name</th>
            <th class="nowrap" style="width: 9%;">Batch</th>
            <th class="nowrap" style="width: 9%;">Expiry</th>
            <th class="num nowrap" style="width: 6%;">Pack Qty</th>
            <th class="num nowrap" style="width: 6%;">Pack Size</th>
            <th class="num nowrap" style="width: 6%;">Unit Qty</th>
            <th class="num nowrap" style="width: 8%;">Pack Purchase</th>
            <th class="num nowrap" style="width: 8%;">Unit Purchase</th>
            <th class="num nowrap" style="width: 8%;">Pack Sale</th>
            <th class="num nowrap" style="width: 8%;">Unit Sale</th>
            <th class="num nowrap" style="width: 6%;">Pack Bonus</th>
            <th class="num nowrap" style="width: 6%;">Unit Bonus</th>
            <th class="num nowrap" style="width: 7%;">Item Disc %</th>
            <th class="num nowrap" style="width: 6%;">Margin</th>
            <th class="num nowrap" style="width: 8%;">Sub Total</th>
            <th class="num nowrap" style="width: 7%;">Quantity</th>
          </tr>
        </thead>
        <tbody>
          @forelse(($inv['items'] ?? []) as $it)
            <tr>
              <td class="nowrap">{{ $it['product_name'] ?? '-' }}</td>
              <td class="nowrap">{{ $it['batch'] ?? '-' }}</td>
              <td class="nowrap">{{ $it['expiry'] ?? '-' }}</td>
              <td class="num">{{ number_format($it['pack_quantity'] ?? 0) }}</td>
              <td class="num">{{ number_format($it['pack_size'] ?? 0) }}</td>
              <td class="num">{{ number_format($it['unit_quantity'] ?? 0) }}</td>
              <td class="num">{{ number_format($it['pack_purchase_price'] ?? 0, 2) }}</td>
              <td class="num">{{ number_format($it['unit_purchase_price'] ?? 0, 2) }}</td>
              <td class="num">{{ number_format($it['pack_sale_price'] ?? 0, 2) }}</td>
              <td class="num">{{ number_format($it['unit_sale_price'] ?? 0, 2) }}</td>
              <td class="num">{{ number_format($it['pack_bonus'] ?? 0) }}</td>
              <td class="num">{{ number_format($it['unit_bonus'] ?? 0) }}</td>
              <td class="num">{{ number_format($it['item_discount_percentage'] ?? 0, 2) }}</td>
              <td class="num">{{ number_format($it['margin'] ?? 0, 2) }}</td>
              <td class="num">{{ number_format($it['sub_total'] ?? 0, 2) }}</td>
              <td class="num">{{ number_format($it['quantity'] ?? 0) }}</td>
            </tr>
          @empty
            <tr><td colspan="16" class="small">No items.</td></tr>
          @endforelse
        </tbody>
        <tfoot class="footer">
          <tr>
            <td colspan="10" class="num">Tax %</td>
            <td colspan="2" class="num">{{ number_format($inv['tax_percentage'] ?? 0, 2) }}</td>
            <td colspan="3" class="num">Tax Amount</td>
            <td colspan="1" class="num">{{ number_format($inv['tax_amount'] ?? 0, 2) }}</td>
          </tr>
          <tr>
            <td colspan="10" class="num">Discount %</td>
            <td colspan="2" class="num">{{ number_format($inv['discount_percentage'] ?? 0, 2) }}</td>
            <td colspan="3" class="num">Discount Amount</td>
            <td colspan="1" class="num">{{ number_format($inv['discount_amount'] ?? 0, 2) }}</td>
          </tr>
          <tr>
            <td colspan="15" class="num">Total Amount</td>
            <td class="num">{{ number_format($inv['total_amount'] ?? 0, 2) }}</td>
          </tr>
        </tfoot>
      </table>
    </div>

    {{-- Page break every ~2-3 invoices if they’re long --}}
    @if(($i+1) % 3 === 0)
      <div class="page-break"></div>
    @endif
  @empty
    <p>No results for selected filters.</p>
  @endforelse
</body>
</html>
