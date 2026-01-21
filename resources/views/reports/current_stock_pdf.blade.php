<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Current Stock Report</title>
  <style>
    @page { margin: 18px; }
    body { font-family: DejaVu Sans, sans-serif; font-size: 10px; color: #111; }
    h1 { font-size: 16px; margin: 0 0 6px 0; }
    .meta { font-size: 10px; margin-bottom: 10px; }
    .card { border: 1px solid #e5e7eb; border-radius: 6px; margin-bottom: 10px; }
    .card-hd { background: #f3f4f6; padding: 6px 8px; border-bottom: 1px solid #e5e7eb; }
    .row { display: inline-block; margin-right: 12px; }
    table { width: 100%; border-collapse: collapse; table-layout: auto; }
    th, td { border: 1px solid #e5e7eb; padding: 4px 6px; line-height: 1.3; font-size: 10px; }
    th { background: #f9fafb; text-align: left; font-weight: 700; color: #111827; }
    td.num, th.num { text-align: right; }
    .nowrap { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .footer td { font-weight: 600; }
    .summary-box { background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 6px; padding: 8px; margin-top: 10px; }
    .summary-box h3 { margin: 0 0 6px 0; font-size: 12px; color: #0c4a6e; }
    .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
    .summary-item { background: #fff; border-radius: 4px; padding: 6px; text-align: center; }
    .summary-item .label { font-size: 9px; color: #64748b; margin-bottom: 3px; }
    .summary-item .value { font-size: 13px; font-weight: 700; color: #0f172a; }
    .page-break { page-break-after: always; }
  </style>
</head>
<body>
  <h1>Current Stock Report</h1>
  <div class="meta">
    Generated: {{ $meta['generatedAt'] }}
  </div>

  <table>
    <thead>
      <tr>
        <th class="nowrap" style="width: 4%;">#</th>
        <th class="nowrap" style="width: 28%;">Product Name</th>
        <th class="num nowrap" style="width: 7%;">Pack Size</th>
        <th class="num nowrap" style="width: 10%;">Quantity</th>
        <th class="num nowrap" style="width: 10%;">Pack Purchase</th>
        <th class="num nowrap" style="width: 10%;">Pack Sale</th>
        <th class="num nowrap" style="width: 15%;">Total Purchase Value</th>
        <th class="num nowrap" style="width: 16%;">Total Sale Value</th>
      </tr>
    </thead>
    <tbody>
      @forelse($rows as $index => $row)
        <tr>
          <td class="nowrap">{{ $index + 1 }}</td>
          <td class="nowrap">{{ $row['name'] ?? '-' }}</td>
          <td class="num">{{ number_format($row['pack_size'] ?? 0) }}</td>
          <td class="num">{{ number_format($row['quantity'] ?? 0) }}</td>
          <td class="num">{{ number_format($row['pack_purchase_price'] ?? 0, 2) }}</td>
          <td class="num">{{ number_format($row['pack_sale_price'] ?? 0, 2) }}</td>
          <td class="num">{{ number_format($row['total_purchase_value'] ?? 0, 2) }}</td>
          <td class="num">{{ number_format($row['total_sale_value'] ?? 0, 2) }}</td>
        </tr>
      @empty
        <tr>
          <td colspan="8" style="text-align:center;color:#666;">No stock items found with quantity > 0.</td>
        </tr>
      @endforelse
    </tbody>
    @if(count($rows) > 0)
    <tfoot class="footer">
      <tr style="background: #f3f4f6;">
        <td colspan="3" class="num"><strong>TOTAL</strong></td>
        <td class="num"><strong>{{ number_format($summary['total_quantity'] ?? 0) }}</strong></td>
        <td class="num">-</td>
        <td class="num">-</td>
        <td class="num"><strong>{{ number_format($summary['total_purchase_value'] ?? 0, 2) }}</strong></td>
        <td class="num"><strong>{{ number_format($summary['total_sale_value'] ?? 0, 2) }}</strong></td>
      </tr>
    </tfoot>
    @endif
  </table>

  <!-- Summary Box -->
  @if(count($rows) > 0)
  <div class="summary-box">
    <h3>Stock Summary</h3>
    <div class="summary-grid">
      <div class="summary-item">
        <div class="label">Total Items</div>
        <div class="value">{{ number_format($summary['total_items'] ?? 0) }}</div>
      </div>
      <div class="summary-item">
        <div class="label">Total Quantity</div>
        <div class="value">{{ number_format($summary['total_quantity'] ?? 0) }}</div>
      </div>
      <div class="summary-item">
        <div class="label">Total Purchase Value</div>
        <div class="value">{{ number_format($summary['total_purchase_value'] ?? 0, 2) }}</div>
      </div>
      <div class="summary-item">
        <div class="label">Total Sale Value</div>
        <div class="value">{{ number_format($summary['total_sale_value'] ?? 0, 2) }}</div>
      </div>
    </div>
    <div style="margin-top: 8px; text-align: center; font-size: 11px;">
      <strong>Potential Profit:</strong> 
      {{ number_format($summary['potential_profit'] ?? 0, 2) }}
    </div>
  </div>
  @endif

  @if(count($rows) > 30)
    <div class="page-break"></div>
  @endif
</body>
</html>

