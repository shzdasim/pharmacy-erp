<?php

namespace App\Services;

use App\Models\Supplier;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * SupplierImportService
 *
 * - Stores uploaded CSVs on a single disk (default: 'local') so read paths are consistent.
 * - Validates CSV header with aliases and auto-detects delimiter if needed.
 * - Streams rows, flags hard errors vs. soft warnings, previews sample rows.
 * - Commits via chunked upsert on 'name' (updates address/phone for existing).
 */
class SupplierImportService
{
    // --- Tunables ---
    public const PREVIEW_INVALID_LIMIT = 20;
    public const PREVIEW_VALID_LIMIT   = 10;
    public const CHUNK_SIZE            = 1000;

    /** Use the same disk everywhere (store, exists, path) */
    private string $disk = 'local';

    /** Header aliases accepted for mapping to canonical columns */
    private array $aliases = [
        'name'    => ['name','supplier','supplier_name','company','company_name','suppliername'],
        'address' => ['address','addr','supplier_address','location','address1','address_line1'],
        'phone'   => ['phone','mobile','contact','contact_no','contact_number','phone_number','tel','telephone'],
    ];

    // ---------------- Public API ----------------

    /**
     * Save the uploaded file to storage/app/imports/suppliers/{uuid}.csv on the selected disk.
     * Returns ['token' => uuid, 'path' => absolutePath]
     */
    public function storeUploaded(UploadedFile $file): array
    {
        $ext = strtolower($file->getClientOriginalExtension() ?: 'csv');
        if (!in_array($ext, ['csv', 'txt'], true)) {
            throw new \RuntimeException('Only CSV files are supported right now.');
        }

        $token    = (string) Str::uuid();
        $dir      = 'imports/suppliers';
        $filename = "{$token}.csv";

        Storage::disk($this->disk)->makeDirectory($dir);
        Storage::disk($this->disk)->putFileAs($dir, $file, $filename);

        $absolute = Storage::disk($this->disk)->path("{$dir}/{$filename}");
        return ['token' => $token, 'path' => $absolute];
    }

    /**
     * Validate the CSV and return a preview summary + samples.
     * Result:
     *   - ok, message?, used_delimiter, header, header_map
     *   - total, valid, invalid, invalid_samples[], valid_samples[]
     */
    public function validateCsv(string $absolutePath, string $delimiter = ','): array
    {
        $delimiter = $this->normalizeDelimiter($delimiter);

        // 1) Read header with provided delimiter; if not recognized, auto-detect
        [$header, $colIdx, $delimiter] = $this->readAndMapHeader($absolutePath, $delimiter);
        if (!$header || !$colIdx) {
            return [
                'ok'              => false,
                'message'         => "CSV must contain a header with columns: name,address,phone (any order).",
                'detected_header' => $header,
                'hint'            => 'Accepted synonyms: name|supplier|company, address|addr|location, phone|mobile|contact.',
            ];
        }

        // 2) Build lowercase existing set for duplicate checks
        $existing = Supplier::query()
            ->select('name')
            ->get()
            ->pluck('name')
            ->map(fn($n) => mb_strtolower(trim((string) $n)))
            ->filter()
            ->unique()
            ->flip();

        // 3) Iterate rows
        $seenInFile = [];
        $total = $valid = $invalid = 0;
        $invalidSamples = [];
        $validSamples   = [];

        $fh = $this->openCsv($absolutePath, $delimiter);
        // consume header row
        $this->readNextNonEmpty($fh);

        $rowNumber = 1; // header = line 1
        while (!$fh->eof()) {
            $row = $this->readNextNonEmpty($fh);
            if ($row === null) break;
            $rowNumber++;

            $data = [
                'name'    => $row[$colIdx['name']]    ?? null,
                'address' => $row[$colIdx['address']] ?? null,
                'phone'   => $row[$colIdx['phone']]   ?? null,
            ];

            // strict = true: mark in-file duplicates as hard errors; duplicates in DB as warnings
            [$errors, $warnings] = $this->rowIssues($data, $existing, $seenInFile, true);

            $total++;
            if (!empty($errors)) {
                $invalid++;
                if (count($invalidSamples) < self::PREVIEW_INVALID_LIMIT) {
                    $invalidSamples[] = [
                        'row'      => $rowNumber,
                        'data'     => $data,
                        'errors'   => $errors,
                        'warnings' => $warnings,
                    ];
                }
            } else {
                $valid++;
                // mark seen for in-file duplicate detection
                $lower = mb_strtolower(trim((string) ($data['name'] ?? '')));
                if ($lower !== '') $seenInFile[$lower] = true;

                if (count($validSamples) < self::PREVIEW_VALID_LIMIT) {
                    $validSamples[] = [
                        'row'      => $rowNumber,
                        'data'     => $data,
                        'warnings' => $warnings,
                    ];
                }
            }
        }

        return [
            'ok'              => true,
            'used_delimiter'  => $delimiter,
            'header'          => $header,
            'header_map'      => $colIdx,
            'total'           => $total,
            'valid'           => $valid,
            'invalid'         => $invalid,
            'invalid_samples' => $invalidSamples,
            'valid_samples'   => $validSamples,
        ];
    }

    /**
     * Commit the CSV to DB using chunked upserts.
     * - insert_valid_only=true: skip bad rows; continue with good ones
     * - insert_valid_only=false: abort on the first hard error
     *
     * Returns stats:
     *   total, valid, invalid, committed, new, existing
     */
    public function commit(string $absolutePath, bool $insertValidOnly = true, string $delimiter = ','): array
    {
        $delimiter = $this->normalizeDelimiter($delimiter);

        // header + mapping (with fallback to autodetect)
        [$header, $colIdx, $delimiter] = $this->readAndMapHeader($absolutePath, $delimiter);
        if (!$colIdx) {
            throw new \RuntimeException("CSV header not recognized. Expected: name,address,phone (any order).");
        }

        // Lowercased existing set, so we can count new vs existing
        $existingLower = Supplier::query()
            ->select('name')
            ->get()
            ->pluck('name')
            ->map(fn($n) => mb_strtolower(trim((string) $n)))
            ->filter()
            ->unique()
            ->flip();

        $toUpsert = [];
        $stats = [
            'total'     => 0,
            'valid'     => 0,
            'invalid'   => 0,
            'committed' => 0,
            'new'       => 0,
            'existing'  => 0,
        ];

        $flush = function () use (&$toUpsert, &$stats) {
            if (empty($toUpsert)) return;
            Supplier::upsert($toUpsert, ['name'], ['address','phone']);
            $stats['committed'] += count($toUpsert);
            $toUpsert = [];
        };

        $fh = $this->openCsv($absolutePath, $delimiter);
        // consume header
        $this->readNextNonEmpty($fh);

        while (!$fh->eof()) {
            $row = $this->readNextNonEmpty($fh);
            if ($row === null) break;

            $data = [
                'name'    => $row[$colIdx['name']]    ?? null,
                'address' => $row[$colIdx['address']] ?? null,
                'phone'   => $row[$colIdx['phone']]   ?? null,
            ];

            $stats['total']++;

            // strict = false in commit: in-file dupes -> optional, DB dupes -> warnings only
            [$errors, /* $warnings */] = $this->rowIssues($data, $existingLower, /*seen*/[], false);

            if (!empty($errors)) {
                $stats['invalid']++;
                if ($insertValidOnly) {
                    // skip this row
                    continue;
                }
                // abort entire import
                throw new \RuntimeException('Import aborted due to validation error.');
            }

            $stats['valid']++;

            $name  = trim((string) ($data['name'] ?? ''));
            $lower = mb_strtolower($name);
            if ($name === '') {
                // shouldn't happen due to validation, but guard anyway
                continue;
            }

            // Count new vs. existing
            if (isset($existingLower[$lower])) {
                $stats['existing']++;
            } else {
                $stats['new']++;
                $existingLower[$lower] = true; // so later occurrences count as existing
            }

            $toUpsert[] = [
                'name'    => $name,
                'address' => $this->safeStr($data['address']),
                'phone'   => $this->safeStr($data['phone']),
            ];

            if (count($toUpsert) >= self::CHUNK_SIZE) {
                $flush();
            }
        }

        DB::transaction(function () use ($flush) {
            $flush();
        });

        return $stats;
    }

    // ---------------- Internals / Helpers ----------------

    /** Normalize UI delimiter value, turning '\t' into an actual tab char. */
    private function normalizeDelimiter(string $delimiter): string
    {
        return $delimiter === '\t' ? "\t" : $delimiter;
    }

    /**
     * Open CSV file as SplFileObject with CSV flags and given delimiter.
     * @return \SplFileObject
     */
    private function openCsv(string $absolutePath, string $delimiter)
    {
        $fh = new \SplFileObject($absolutePath, 'r');
        $fh->setFlags(\SplFileObject::READ_CSV | \SplFileObject::SKIP_EMPTY | \SplFileObject::DROP_NEW_LINE);
        $fh->setCsvControl($delimiter);
        return $fh;
    }

    /**
     * Read next non-empty CSV row (normalizes strings, strips BOM).
     * Returns array|null.
     */
    private function readNextNonEmpty(\SplFileObject $fh): ?array
    {
        while (!$fh->eof()) {
            $row = $fh->fgetcsv();
            if ($row === false || $row === null) continue;
            $row = $this->normalizeRow($row);
            if ($row === [] || (count($row) === 1 && $row[0] === null)) continue;
            return $row;
        }
        return null;
    }

    /** Convert cells to trimmed strings and remove BOM on first cell if present. */
    private function normalizeRow(array $row): array
    {
        $out = [];
        foreach ($row as $i => $v) {
            if ($v === null) { $out[$i] = null; continue; }
            $s = is_string($v) ? trim($v) : (string) $v;
            if ($i === 0) {
                // strip UTF-8 BOM if present
                $s = preg_replace('/^\xEF\xBB\xBF/', '', $s);
            }
            // normalize empty strings to null
            $out[$i] = ($s === '') ? null : $s;
        }
        // Drop trailing empty cells caused by CSV parsing artifacts
        while (!empty($out) && end($out) === null) { array_pop($out); }
        return $out;
    }

    /**
     * Try to map a header row to canonical indices using aliases.
     * Returns ['name'=>idx, 'address'=>idx, 'phone'=>idx] or [] if missing.
     */
    private function mapHeaderToCanonical(array $header): array
    {
        $lower = array_map(fn($h) => mb_strtolower(trim((string) $h)), $header);
        // strip BOM again for safety
        if (!empty($lower)) { $lower[0] = preg_replace('/^\xEF\xBB\xBF/', '', $lower[0]); }

        $map = [];
        foreach (['name','address','phone'] as $key) {
            $idx = null;
            foreach ($this->aliases[$key] as $alias) {
                $i = array_search($alias, $lower, true);
                if ($i !== false) { $idx = $i; break; }
            }
            if ($idx === null) return [];
            $map[$key] = $idx;
        }
        return $map;
    }

    /**
     * Picks the delimiter that appears most in the first line.
     * Candidates: ',', ';', "\t", '|'
     */
    private function guessDelimiterFromSample(string $path, array $candidates = [',',';',"\t",'|']): string
    {
        $h = @fopen($path, 'r');
        if (!$h) return ',';
        $sample = fgets($h, 8192) ?: '';
        fclose($h);

        $best = $candidates[0];
        $bestCount = -1;
        foreach ($candidates as $d) {
            $c = substr_count($sample, $d);
            if ($c > $bestCount) { $best = $d; $bestCount = $c; }
        }
        return $best;
    }

    /**
     * Reads header with given delimiter; if it doesn't map, auto-detect delimiter
     * and try again. Returns [headerRow, headerMap, usedDelimiter].
     */
    private function readAndMapHeader(string $absolutePath, string $delimiter): array
    {
        // attempt 1: provided delimiter
        $fh = $this->openCsv($absolutePath, $delimiter);
        $header = $this->readNextNonEmpty($fh);
        $colIdx = $header ? $this->mapHeaderToCanonical($header) : [];

        if ($colIdx) {
            return [$header, $colIdx, $delimiter];
        }

        // attempt 2: auto-detected delimiter
        $auto = $this->guessDelimiterFromSample($absolutePath);
        if ($auto !== $delimiter) {
            $fh = $this->openCsv($absolutePath, $auto);
            $header = $this->readNextNonEmpty($fh);
            $colIdx = $header ? $this->mapHeaderToCanonical($header) : [];
            if ($colIdx) {
                return [$header, $colIdx, $auto];
            }
        }

        return [$header, [], $delimiter];
    }

    /**
     * Validate a single row and return [errors[], warnings[]].
     * - Hard errors (fail the row): missing name, name/address/phone length, duplicate in file (strict only).
     * - Warnings (do not fail): duplicate in DB, unusual phone format.
     */
    private function rowIssues(array $data, \ArrayAccess|array $existingLower, array $seenInFile = [], bool $strict = true): array
    {
        $errors   = [];
        $warnings = [];

        $name   = trim((string) ($data['name'] ?? ''));
        $addr   = (string) ($data['address'] ?? '');
        $phone  = (string) ($data['phone'] ?? '');

        if ($name === '') {
            $errors['name'] = 'Name is required.';
        } elseif (mb_strlen($name) > 255) {
            $errors['name'] = 'Name too long (max 255).';
        }

        $lower = mb_strtolower($name);
        if ($name !== '') {
            if ($strict && isset($seenInFile[$lower])) {
                $errors['duplicate_in_file'] = 'Duplicate supplier name within the file.';
            }
            if (isset($existingLower[$lower])) {
                $warnings['duplicate_db'] = 'Name already exists in DB (will update via upsert).';
            }
        }

        if ($addr !== '' && mb_strlen($addr) > 255) {
            $errors['address'] = 'Address too long (max 255).';
        }

        if ($phone !== '' && mb_strlen($phone) > 50) {
            $errors['phone'] = 'Phone too long (max 50).';
        } elseif ($phone !== '' && !preg_match('/^[0-9+\-\s()]{3,}$/', $phone)) {
            $warnings['phone_hint'] = 'Phone looks unusual; check formatting.';
        }

        return [$errors, $warnings];
    }

    /** Trim to null for empty strings. */
    private function safeStr(?string $s): ?string
    {
        $s = $s === null ? null : trim($s);
        return $s === '' ? null : $s;
    }
}
