<?php

namespace App\Http\Controllers;

use App\Services\SupplierImportService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class SupplierImportController extends Controller
{
    public function __construct(private SupplierImportService $service) {}

    // GET /api/suppliers/import/template
    public function template(): StreamedResponse
    {
        $headers = ['Content-Type' => 'text/csv'];
        return response()->streamDownload(function () {
            echo "name,address,phone\n";
            echo "Acme Supplies,21 Main Street,+92 300 1234567\n";
            echo "Nexus Traders,Plot #45, +92 333 7654321\n";
        }, 'suppliers_template.csv', $headers);
    }

    // POST /api/suppliers/import/validate  (multipart/form-data with "file")
   public function validateUpload(Request $request)
{
    $request->validate([
        'file' => ['required','file','mimes:csv,txt'],
        'delimiter' => ['nullable','in:,,;,\t,|'],
    ]);

    $stored    = $this->service->storeUploaded($request->file('file')); // uses local disk
    $delimiter = $request->input('delimiter', ',');

    try {
        $res = $this->service->validateCsv($stored['path'], $delimiter);
    } catch (\Throwable $e) {
        // helpful error instead of a Whoops page
        return response()->json(['message' => 'Could not read uploaded file.'], 500);
    }

    if (!$res['ok']) {
        @unlink($stored['path']);
        return response()->json($res, 422);
    }

    $res['token'] = basename($stored['path'], '.csv'); // same token back
    return response()->json($res);
}

public function commit(Request $request)
{
    $request->validate([
        'token' => ['required','uuid'],
        'insert_valid_only' => ['sometimes','boolean'],
        'delimiter' => ['nullable','in:,,;,\t,|'],
    ]);

    $token    = $request->string('token');
    $relative = "imports/suppliers/{$token}.csv";

    // check on the same disk
    if (!Storage::disk('local')->exists($relative)) {
        return response()->json(['message' => 'Upload token expired or file not found.'], 404);
    }

    $path = Storage::disk('local')->path($relative);

    try {
        $stats = $this->service->commit(
            $path,
            $request->boolean('insert_valid_only', true),
            $request->input('delimiter', ',')
        );
    } finally {
        // remove uploaded file regardless of success/failure
        @unlink($path);
    }

    return response()->json(['message' => 'Import complete.','stats' => $stats]);
}
}
