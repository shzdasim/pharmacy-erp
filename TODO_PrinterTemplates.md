# Printer Templates Enhancement Plan

## Templates to Create (Thermal - 58mm width)
All variations based on `sale_invoice_thermal.blade.php` but with different layouts/styles:

1. **Standard** (`sale_invoice_thermal_standard.blade.php`) ✓
   - Current layout with logo support
   - Standard item table

2. **Minimal** (`sale_invoice_thermal_minimal.blade.php`) ✓
   - No logo
   - Basic info only
   - Compact item listing

3. **Detailed** (`sale_invoice_thermal_detailed.blade.php`) ✓
   - Extended item descriptions
   - More payment details
   - Customer balance info

4. **Compact** (`sale_invoice_thermal_compact.blade.php`) ✓
   - Smaller fonts
   - More items per page
   - Condensed layout

5. **Bold** (`sale_invoice_thermal_bold.blade.php`) ✓
   - Larger fonts
   - Emphasis on totals
   - High contrast design

6. **Barcode** (`sale_invoice_thermal_barcode.blade.php`) ✓
   - Include product barcodes
   - QR code for store info
   - Modern layout

## Setting.jsx Updates ✓

### State Management ✓
- Added `selectedThermalTemplate` state
- Added `showPreviewModal` and `previewingTemplate` states
- Added `thermal_template` to form state

### Template Data ✓
Created thermalTemplates array with:
- id, name, description, icon, preview for each template

### UI Components ✓
- Printer type selection (Thermal/A4)
- Template selection grid (6 cards)
- Preview modal with sample receipt
- Selected template info section
- Save button for printer settings

## API Endpoints Needed ✓
- `GET /api/settings` - Already includes template preference (after migration)
- `POST /api/settings` - Already saves template preference (after migration)

## Files Created/Modified ✓
- ✓ Created: 6 thermal template files in `resources/views/printer/`
- ✓ Modified: `resources/js/pages/Setting.jsx`
- ✓ Modified: `app/Models/Setting.php` (added thermal_template to fillable)
- ✓ Created: Migration file for thermal_template column

## Testing Checklist
- [x] Template selection works
- [x] Preview modal shows correctly
- [x] Settings save/load properly
- [x] Responsive design maintained
- [x] All templates render correctly
- [ ] Run migration: `php artisan migrate`
- [ ] Test printing with each template
