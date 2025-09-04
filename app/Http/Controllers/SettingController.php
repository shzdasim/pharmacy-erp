<?php

namespace App\Http\Controllers;

use App\Models\Setting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class SettingController extends Controller
{
    // GET /api/settings
    public function show()
    {
        $setting = Setting::firstOrCreate(['id' => 1], [
            'printer_type' => 'thermal',
        ]);

        return response()->json($setting);
    }

    // POST /api/settings  (multipart/form-data supported)
    public function update(Request $request)
    {
        $setting = Setting::firstOrCreate(['id' => 1]);

        $validated = $request->validate([
            'store_name'     => ['nullable','string','max:255'],
            'phone_number'   => ['nullable','string','max:30'],
            'address'        => ['nullable','string','max:500'],
            'license_number' => ['nullable','string','max:100'],
            'note'           => ['nullable','string','max:2000'],
            'printer_type'   => ['required', Rule::in(['thermal','a4'])],
            'logo'           => ['nullable','image','mimes:jpg,jpeg,png,webp','max:2048'],
        ]);

        // Handle logo upload (optional)
        if ($request->hasFile('logo')) {
            $newPath = $request->file('logo')->store('logos', 'public');
            // delete old file if exists
            if ($setting->logo_path) {
                Storage::disk('public')->delete($setting->logo_path);
            }
            $setting->logo_path = $newPath;
        }

        // Fill other fields
        $setting->fill(collect($validated)->except('logo')->toArray());
        $setting->save();

        return response()->json($setting->fresh());
    }
}
