<?php

namespace App\Http\Controllers;

use App\Services\CustomerImportService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class CustomerImportController extends Controller
{
    public function __construct(private CustomerImportService $service) {}

    // GET /api/customers/import/template
    public function template(): StreamedResponse
    {
        return response()->streamDownload(function () {
            echo "name,email,phone,address\n";
            echo "Alice Smith,alice@example.com,0300-1234567,123 Main St\n";
            echo "Bob Khan,,021-1112223,Defense Phase 6\n";
        }, 'customers_template.csv', ['Content-Type' => 'text/csv']);
    }

    // POST /api/customers/import/validate
    public function validateUpload(Request $request)
    {
        $request->validate([
            'file' => ['required','file','mimes:csv,txt'],
            'delimiter' => ['nullable','in:,,;,\t,|'],
        ]);

        $stored    = $this->service->storeUploaded($request->file('file'));
        $delimiter = $request->input('delimiter', ',');

        $res = $this->service->validateCsv($stored['path'], $delimiter);
        if (!$res['ok']) {
            @unlink($stored['path']);
            return response()->json($res, 422);
        }
        $res['token'] = $stored['token'];
        return response()->json($res);
    }

    // POST /api/customers/import/commit
    public function commit(Request $request)
    {
        $request->validate([
            'token' => ['required','uuid'],
            'insert_valid_only' => ['sometimes','boolean'],
            'delimiter' => ['nullable','in:,,;,\t,|'],
        ]);

        $token    = (string) $request->string('token');
        $relative = "imports/customers/{$token}.csv";

        if (!Storage::disk('local')->exists($relative)) {
            return response()->json(['message' => 'Upload token expired or file missing.'], 404);
        }

        $path  = Storage::disk('local')->path($relative);
        $stats = $this->service->commit(
            $path,
            $request->boolean('insert_valid_only', true),
            $request->input('delimiter', ',')
        );

        Storage::disk('local')->delete($relative);

        return response()->json(['message' => 'Import complete.', 'stats' => $stats]);
    }
}
