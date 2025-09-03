<?php

namespace App\Http\Controllers;

use App\Services\CategoryImportService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class CategoryImportController extends Controller
{
    public function __construct(private CategoryImportService $service) {}

    // GET /api/categories/import/template
    public function template(): StreamedResponse
    {
        return response()->streamDownload(function () {
            echo "name\n";
            echo "Analgesics\n";
            echo "Vitamins\n";
        }, 'categories_template.csv', ['Content-Type'=>'text/csv']);
    }

    // POST /api/categories/import/validate
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

    // POST /api/categories/import/commit
    public function commit(Request $request)
    {
        $request->validate([
            'token' => ['required','uuid'],
            'insert_valid_only' => ['sometimes','boolean'],
            'delimiter' => ['nullable','in:,,;,\t,|'],
        ]);

        $token    = (string) $request->string('token');
        $relative = "imports/categories/{$token}.csv";

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

        return response()->json(['message'=>'Import complete.','stats'=>$stats]);
    }
}
