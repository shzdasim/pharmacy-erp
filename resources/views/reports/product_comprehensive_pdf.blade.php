<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Product Comprehensive Report</title>
  <style>
    @page { margin: 18px; }
    body { font-family: DejaVu Sans, sans-serif; font-size: 9px; color: #111; }
    h1 { font-size: 16px; margin: 0 0 6px 0; }
    h2 { font-size: 14px; margin: 0 0 4px 0; color: #374151; }
    .meta { font-size: 10px; margin-bottom: 10px; }
    .product-info { background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 6px; padding: 10px; margin-bottom: 10px; }
    .product-info .name { font-size: 13px; font-weight: 700; color: #0369a1; margin-bottom: 4px; }
    .product-info .details { font-size: 10px; color: #475569; }
    .product-info .details span { margin-right: 15px; }
    table { width: 100%; border-collapse: collapse; table-layout: auto; }
    th, td { border: 1px solid #e5e7eb; padding: 3px 5px; line-height: 1.3; font-size: 9px; }
    th { background: #f9fafb; text-align: left; font-weight: 700; color: #111827; }
    td.num, th.num { text-align: right; }
    .nowrap { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .purchase-row { background: #f0fdf4; }
    .sale-row { background: #fef2f2; }
    .purchase-return-row { background: #fffbeb; }
    .sale-return-row { background: #f5f3ff; }
    .footer td { font-weight: 600; }
    .summary-box { background: #f0fdf4; border: 1px solid #86efac; border-radius: 6px; padding: 10px; margin-top: 10px; }
    .summary-box h3 { margin: 0 0 8px 0; font-size: 12px; color: #166534; }
    .summary-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; }
    .summary-item { background: #fff; border-radius: 4px; padding: 6px; text-align: center; }
    .summary-item .label { font-size: 8px; color: #64748b; margin-bottom: 3px; }
    .summary-item .value { font-size: 12px; font-weight: 700; color: #0f172a; }
    .positive { color: #16a34a; }
    .negative { color: #dc2626; }
    .type-purchase { background: #dcfce7; color: #166534; padding: 2px 6px; border-radius: 3px; font-size: 8px; font-weight: 600; }
    .type-sale { background: #fee2e2; color: #991b1b; padding: 2px 6px; border-radius: 3px; font-size: 8px; font-weight: 600; }
    .type-purchase-return { background: #fef3c7; color: #92400e; padding: 2px 6px; border-radius: 3px; font-size: 8px; font-weight: 600; }
    .type-sale-return { background: #e9d5ff; color: #6b21a8; padding: 2px 6px; border-radius: 3px; font-size: 8px; font-weight: 600; }
    .page-break { page-break-after: always; }
    .current-stock { background: #dbeafe; border: 1px solid #93c5fd; border-radius: 4px; padding: 6px; margin-top: 8px; text-align: center; }
    .current-stock .label { font-size: 10px; color: #1e40af; }
    .current-stock .value { font-size: 14px; font-weight: 700; color: #1e3a8a; }
  </style>
</head>
<body>
  <h1>Product Comprehensive Report</h1>

  @if(isset($product) && $product)
  <div class="product-info">
    <div class="name">{{ $product['name'] ?? 'Unknown Product' }}</div>
    <div class="details">
      @if(isset($product['product_code']))
      <span><strong>Code:</strong> {{ $product['product_code'] }}</span>
      @endif
      @if(isset($product['category_name']))
      <span><strong>Category:</strong> {{ $product['category_name'] }}</span>
      @endif
      @if(isset($product['brand_name']))
      <span><strong>Brand:</strong> {{ $product['brand_name'] }}</span>
      @endif
      @if(isset($product['pack_size']))
      <span><strong>Pack Size:</strong> {{ $product['pack_size'] }}</span>
      @endif
    </div>
    <div class="current-stock">
      <span class="label">Current Stock:</span>
      <span class="value">{{ number_format($product['current_quantity'] ?? 0) }} units</span>
    </div>
  </div>
  @endif

  <div class="meta">
    @if(isset($meta['from']) || isset($meta['to']))
      Date Range: {{ $meta['from'] ?? 'Start' }} to {{ $meta['to'] ?? 'End' }}<br>
    @endif
    Generated: {{ $meta['generatedAt'] }}
  </div>

  <table>
    <thead>
      <tr>
        <th class="nowrap" style="width: 3%;">#</th>
        <th class="nowrap" style="width: 7%;">Date</th>
        <th class="nowrap" style="width: 8%;">Type</th>
        <th class="nowrap" style="width: 10%;">Ref #</th>
        <th class="nowrap" style="width: 15%;">Supplier/Customer</th>
        <th class="nowrap" style="width: 7%;">Batch</th>
        <th class="nowrap" style="width: 8%;">Expiry</th>
        <th class="num nowrap" style="width: 6%;">Qty In</th>
        <th class="num nowrap" style="width: 6%;">Qty Out</th>
        <th class="num nowrap" style="width: 7%;">Unit Price</th>
        <th class="num nowrap" style="width: 8%;">Subtotal</th>
      </tr>
    </thead>
    <tbody>
      @forelse($transactions as $index => $txn)
        <tr class="
          @if($txn['type'] == 'purchase') purchase-row
          @elseif($txn['type'] == 'sale') sale-row
          @elseif($txn['type'] == 'purchase_return') purchase-return-row
          @elseif($txn['type'] == 'sale_return') sale-return-row
          @endif
        ">
          <td class="nowrap">{{ $index + 1 }}</td>
          <td class="nowrap">{{ $txn['date'] ?? '-' }}</td>
          <td>
            @if($txn['type'] == 'purchase')
              <span class="type-purchase">PURCHASE</span>
            @elseif($txn['type'] == 'sale')
              <span class="type-sale">SALE</span>
            @elseif($txn['type'] == 'purchase_return')
              <span class="type-purchase-return">P.RETURN</span>
            @elseif($txn['type'] == 'sale_return')
              <span class="type-sale-return">S.RETURN</span>
            @endif
          </td>
          <td class="nowrap">{{ $txn['reference_number'] ?? '-' }}</td>
          <td class="nowrap">{{ $txn['counter_party'] ?? '-' }}</td>
          <td class="nowrap">{{ $txn['batch'] ?? '-' }}</td>
          <td class="nowrap">{{ $txn['expiry'] ?? '-' }}</td>
          <td class="num positive">{{ number_format($txn['quantity_in'] ?? 0, 0) }}</td>
          <td class="num negative">{{ number_format($txn['quantity_out'] ?? 0, 0) }}</td>
          <td class="num">{{ number_format($txn['unit_price'] ?? 0, 2) }}</td>
          <td class="num {{ $txn['sub_total'] >= 0 ? 'positive' : 'negative' }}">
            {{ number_format($txn['sub_total'] ?? 0, 2) }}
          </td>
        </tr>
      @empty
        <tr>
          <td colspan="11" style="text-align:center;color:#666;">No transactions found for this product.</td>
        </tr>
      @endforelse
    </tbody>
    @if(count($transactions) > 0)
    <tfoot class="footer">
      <tr style="background: #f3f4f6;">
        <td colspan="7" class="num"><strong>TOTALS</strong></td>
        <td class="num positive"><strong>{{ number_format($summary['total_quantity_in'] ?? 0, 0) }}</strong></td>
        <td class="num negative"><strong>{{ number_format($summary['total_quantity_out'] ?? 0, 0) }}</strong></td>
        <td class="num">-</td>
        <td class="num">-</td>
      </tr>
    </tfoot>
    @endif
  </table>

  <!-- Summary Box -->
  @if(count($transactions) > 0 && isset($summary))
  <div class="summary-box">
    <h3>Transaction Summary (Price in Currency)</h3>
    <div class="summary-grid">
      <div class="summary-item">
        <div class="label">Total Purchase Price</div>
        <div class="value">{{ number_format($summary['total_purchases'] ?? 0, 2) }}</div>
      </div>
      <div class="summary-item">
        <div class="label">Purchase Returns Price</div>
        <div class="value">{{ number_format($summary['total_purchase_returns'] ?? 0, 2) }}</div>
      </div>
      <div class="summary-item">
        <div class="label">Net Purchase Price</div>
        <div class="value positive">{{ number_format($summary['net_purchases'] ?? 0, 2) }}</div>
      </div>
      <div class="summary-item">
        <div class="label">Total Sale Price</div>
        <div class="value">{{ number_format($summary['total_sales'] ?? 0, 2) }}</div>
      </div>
      <div class="summary-item">
        <div class="label">Sale Returns Price</div>
        <div class="value">{{ number_format($summary['total_sale_returns'] ?? 0, 2) }}</div>
      </div>
      <div class="summary-item">
        <div class="label">Net Sale Price</div>
        <div class="value positive">{{ number_format($summary['net_sales'] ?? 0, 2) }}</div>
      </div>
    </div>
  </div>
  @endif

  @if(count($transactions) > 40)
    <div class="page-break"></div>
  @endif
</body>
</html>

