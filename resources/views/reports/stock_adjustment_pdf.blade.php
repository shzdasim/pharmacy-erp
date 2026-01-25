<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Stock Adjustment Report</title>
  <style>
    @page { margin: 18px; }
    body { font-family: DejaVu Sans, sans-serif; font-size: 9px; color: #111; }
    h1 { font-size: 16px; margin: 0 0 6px 0; }
    .meta { font-size: 10px; margin-bottom: 10px; }
    .card { border: 1px solid #e5e7eb; border-radius: 6px; margin-bottom: 10px; }
    .card-hd { background: #f3f4f6; padding: 6px 8px; border-bottom: 1px solid #e5e7eb; }
    .row { display: inline-block; margin-right: 12px; }
    table { width: 100%; border-collapse: collapse; table-layout: auto; }
    th, td { border: 1px solid #e5e7eb; padding: 3px 5px; line-height: 1.3; font-size: 9px; }
    th { background: #f9fafb; text-align: left; font-weight: 700; color: #111827; }
    td.num, th.num { text-align: right; }
    .nowrap { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .footer td { font-weight: 600; }
    .summary-box { background: #f0fdf4; border: 1px solid #86efac; border-radius: 6px; padding: 8px; margin-top: 10px; }
    .summary-box h3 { margin: 0 0 6px 0; font-size: 12px; color: #166534; }
    .summary-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; }
    .summary-item { background: #fff; border-radius: 4px; padding: 6px; text-align: center; }
    .summary-item .label { font-size: 8px; color: #64748b; margin-bottom: 3px; }
    .summary-item .value { font-size: 12px; font-weight: 700; color: #0f172a; }
    .positive { color: #16a34a; }
    .negative { color: #dc2626; }
    .adjustment-header { background: #e0f2fe; }
    .adjustment-header td { font-weight: 700; color: #0369a1; }
    .page-break { page-break-after: always; }
  </style>
</head>
<body>
  <h1>Stock Adjustment Report</h1>
  <div class="meta">
    @if($meta['from'] || $meta['to'])
      Date Range: {{ $meta['from'] ?? 'Start' }} to {{ $meta['to'] ?? 'End' }}<br>
    @endif
    Generated: {{ $meta['generatedAt'] }}
  </div>

  <table>
    <thead>
      <tr>
        <th class="nowrap" style="width: 3%;">#</th>
        <th class="nowrap" style="width: 8%;">Adj #</th>
        <th class="nowrap" style="width: 8%;">Date</th>
        <th class="nowrap" style="width: 20%;">Product</th>
        <th class="nowrap" style="width: 7%;">Batch</th>
        <th class="nowrap" style="width: 8%;">Expiry</th>
        <th class="num nowrap" style="width: 6%;">Prev Qty</th>
        <th class="num nowrap" style="width: 6%;">Actual Qty</th>
        <th class="num nowrap" style="width: 6%;">Diff Qty</th>
        <th class="num nowrap" style="width: 7%;">Unit Price</th>
        <th class="num nowrap" style="width: 8%;">Worth Adj.</th>
        <th class="nowrap" style="width: 10%;">Reason</th>
        <th class="nowrap" style="width: 8%;">User</th>
      </tr>
    </thead>
    <tbody>
      @forelse($rows as $adjIndex => $adj)
        @forelse($adj['items'] as $index => $item)
          <tr>
            <td class="nowrap">{{ $adjIndex + 1 }}</td>
            <td class="nowrap">{{ $adj['posted_number'] ?? '-' }}</td>
            <td class="nowrap">{{ $adj['posted_date'] ?? '-' }}</td>
            <td class="nowrap">
              {{ $item['product_name'] ?? '-' }}
              @if(isset($item['product_code']) && $item['product_code'])
                <br><span style="color:#666;font-size:8px;">{{ $item['product_code'] }}</span>
              @endif
            </td>
            <td class="nowrap">{{ $item['batch_number'] ?? '-' }}</td>
            <td class="nowrap">{{ $item['expiry'] ?? '-' }}</td>
            <td class="num">{{ number_format($item['previous_qty'] ?? 0, 3) }}</td>
            <td class="num">{{ number_format($item['actual_qty'] ?? 0, 3) }}</td>
            <td class="num {{ $item['diff_qty'] > 0 ? 'positive' : ($item['diff_qty'] < 0 ? 'negative' : '') }}">
              {{ $item['diff_qty'] > 0 ? '+' : '' }}{{ number_format($item['diff_qty'] ?? 0, 3) }}
            </td>
            <td class="num">{{ number_format($item['unit_purchase_price'] ?? 0, 4) }}</td>
            <td class="num {{ $item['worth_adjusted'] >= 0 ? 'positive' : 'negative' }}">
              {{ number_format($item['worth_adjusted'] ?? 0, 2) }}
            </td>
            <td class="nowrap" title="{{ $adj['note'] ?? '' }}">{{ $adj['note'] ?? '-' }}</td>
            <td class="nowrap">{{ $adj['user_name'] ?? '-' }}</td>
          </tr>
        @empty
          <tr>
            <td colspan="13" style="text-align:center;color:#666;font-style:italic;">No items in adjustment {{ $adj['posted_number'] ?? '' }}</td>
          </tr>
        @endforelse
      @empty
        <tr>
          <td colspan="13" style="text-align:center;color:#666;">No stock adjustments found.</td>
        </tr>
      @endforelse
    </tbody>
    @if(count($rows) > 0)
    <tfoot class="footer">
      <tr style="background: #f3f4f6;">
        <td colspan="7" class="num"><strong>TOTALS</strong></td>
        <td class="num">-</td>
        <td class="num">-</td>
        <td class="num">-</td>
        <td class="num positive"><strong>{{ number_format($summary['total_worth_adjusted'] ?? 0, 2) }}</strong></td>
        <td colspan="3"></td>
      </tr>
    </tfoot>
    @endif
  </table>

  <!-- Summary Box -->
  @if(count($rows) > 0)
  <div class="summary-box">
    <h3>Stock Adjustment Summary</h3>
    <div class="summary-grid">
      <div class="summary-item">
        <div class="label">Total Adjustments</div>
        <div class="value">{{ number_format($summary['total_adjustments'] ?? 0) }}</div>
      </div>
      <div class="summary-item">
        <div class="label">Total Items</div>
        <div class="value">{{ number_format($summary['total_items'] ?? 0) }}</div>
      </div>
      <div class="summary-item">
        <div class="label">Worth Adjusted</div>
        <div class="value">{{ number_format($summary['total_worth_adjusted'] ?? 0, 2) }}</div>
      </div>
    </div>
  </div>
  @endif

  @if(count($rows) > 30)
    <div class="page-break"></div>
  @endif
</body>
</html>

