<?php

namespace App\Services;

use App\Models\Brand;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Http;

class BrandImportService
{
    public const PREVIEW_INVALID_LIMIT = 20;
    public const PREVIEW_VALID_LIMIT   = 10;
    public const CHUNK_SIZE            = 1000;

    private string $disk = 'local';   // where CSV lives
    private string $publicDisk = 'public'; // where images live

    private array $aliases = [
        'name'  => ['name','brand','brand_name','label','company'],
        'image' => ['image','image_path','image_url','logo','logo_url','picture','photo'],
    ];

    public function storeUploaded(UploadedFile $file): array
    {
        $ext = strtolower($file->getClientOriginalExtension() ?: 'csv');
        if (!in_array($ext, ['csv','txt'], true)) {
            throw new \RuntimeException('Only CSV files are supported.');
        }

        $token    = (string) Str::uuid();
        $dir      = 'imports/brands';
        $filename = "{$token}.csv";

        Storage::disk($this->disk)->makeDirectory($dir);
        Storage::disk($this->disk)->putFileAs($dir, $file, $filename);

        return [
            'token' => $token,
            'path'  => Storage::disk($this->disk)->path("{$dir}/{$filename}"),
        ];
    }

    // ---------- Validate ----------

    public function validateCsv(string $absolutePath, string $delimiter = ','): array
    {
        $delimiter = $this->normalizeDelimiter($delimiter);
        [$header, $colIdx, $delimiter] = $this->readAndMapHeader($absolutePath, $delimiter);

        if (!$header || !$colIdx) {
            return [
                'ok' => false,
                'message' => 'CSV must contain header columns: name[, image] (any order).',
                'detected_header' => $header,
                'hint' => 'Accepted: name|brand|brand_name and image|image_url|logo.',
            ];
        }

        // existing (lowercased) names + images for quick checks
        $existing = Brand::select('name')
            ->get()->pluck('name')->map(fn($n)=>mb_strtolower(trim((string)$n)))->filter()->unique()->flip();

        $fh = $this->openCsv($absolutePath, $delimiter);
        $this->readNextNonEmpty($fh); // consume header

        $seenInFile = [];
        $total = $valid = $invalid = 0;
        $invalidSamples = [];
        $validSamples   = [];

        $rowNo = 1;
        while (!$fh->eof()) {
            $row = $this->readNextNonEmpty($fh);
            if ($row === null) break;
            $rowNo++;

            $data = [
                'name'  => $row[$colIdx['name']]  ?? null,
                'image' => array_key_exists('image', $colIdx) ? ($row[$colIdx['image']] ?? null) : null,
            ];

            [$errors, $warnings] = $this->rowIssues($data, $existing, $seenInFile, true);

            $total++;
            if ($errors) {
                $invalid++;
                if (count($invalidSamples) < self::PREVIEW_INVALID_LIMIT) {
                    $invalidSamples[] = [
                        'row' => $rowNo, 'data' => $data, 'errors' => $errors, 'warnings' => $warnings
                    ];
                }
            } else {
                $valid++;
                $lower = mb_strtolower(trim((string)$data['name']));
                if ($lower !== '') $seenInFile[$lower] = true;
                if (count($validSamples) < self::PREVIEW_VALID_LIMIT) {
                    $validSamples[] = [
                        'row' => $rowNo, 'data' => $data, 'warnings' => $warnings
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

    // ---------- Commit ----------

    /**
     * insert_valid_only=true: skips bad rows; otherwise aborts on first bad row
     */
    public function commit(string $absolutePath, bool $insertValidOnly = true, string $delimiter = ','): array
    {
        $delimiter = $this->normalizeDelimiter($delimiter);
        [$header, $colIdx, $delimiter] = $this->readAndMapHeader($absolutePath, $delimiter);
        if (!$colIdx) throw new \RuntimeException('CSV header not recognized. Expected: name[, image].');

        // existing maps
        $existing = Brand::select('name','image')->get();
        $existingLower = $existing->pluck('name')->map(fn($n)=>mb_strtolower(trim((string)$n)))->flip();
        $existingImages = $existing->mapWithKeys(function($b){
            return [mb_strtolower(trim((string)$b->name)) => (string)($b->image ?? '')];
        });

        $stats = [
            'total' => 0, 'valid' => 0, 'invalid' => 0,
            'committed' => 0, 'new' => 0, 'existing' => 0,
            'images_downloaded' => 0, 'image_failures' => 0,
        ];

        $toUpsert = [];
        $flush = function () use (&$toUpsert, &$stats) {
            if (empty($toUpsert)) return;
            Brand::upsert($toUpsert, ['name'], ['image']);
            $stats['committed'] += count($toUpsert);
            $toUpsert = [];
        };

        $fh = $this->openCsv($absolutePath, $delimiter);
        $this->readNextNonEmpty($fh); // consume header

        while (!$fh->eof()) {
            $row = $this->readNextNonEmpty($fh);
            if ($row === null) break;

            $name  = trim((string)($row[$colIdx['name']] ?? ''));
            $imageRaw = array_key_exists('image', $colIdx) ? ($row[$colIdx['image']] ?? null) : null;
            $imageRaw = is_string($imageRaw) ? trim($imageRaw) : ($imageRaw ?? '');

            $stats['total']++;

            // validate row (strict=false in commit)
            [$errors] = $this->rowIssues(['name'=>$name,'image'=>$imageRaw], $existingLower, [], false);
            if ($errors) {
                $stats['invalid']++;
                if ($insertValidOnly) continue;
                throw new \RuntimeException('Import aborted due to validation error.');
            }

            $stats['valid']++;
            $lower = mb_strtolower($name);

            // compute final image value:
            $imageFinal = $existingImages[$lower] ?? ''; // preserve if CSV blank
            if ($imageRaw !== '') {
                if ($this->isHttpUrl($imageRaw)) {
                    $saved = $this->downloadImageFromUrl($imageRaw);
                    if ($saved) {
                        $imageFinal = $saved;
                        $stats['images_downloaded']++;
                    } else {
                        $stats['image_failures']++;
                        // keep previous imageFinal as-is
                    }
                } else {
                    // treat as relative path string under public storage (optional)
                    $imageFinal = $imageRaw;
                }
            }

            if (isset($existingLower[$lower])) { $stats['existing']++; }
            else { $stats['new']++; $existingLower[$lower] = true; }

            $toUpsert[] = [
                'name'  => $name,
                'image' => $imageFinal !== '' ? $imageFinal : null,
            ];

            if (count($toUpsert) >= self::CHUNK_SIZE) $flush();
        }

        DB::transaction(fn() => $flush());

        return $stats;
    }

    // ---------- helpers ----------

    private function normalizeDelimiter(string $delimiter): string
    {
        return $delimiter === '\t' ? "\t" : $delimiter;
    }

    private function openCsv(string $absolutePath, string $delimiter): \SplFileObject
    {
        $fh = new \SplFileObject($absolutePath, 'r');
        $fh->setFlags(\SplFileObject::READ_CSV | \SplFileObject::SKIP_EMPTY | \SplFileObject::DROP_NEW_LINE);
        $fh->setCsvControl($delimiter);
        return $fh;
    }

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

    private function normalizeRow(array $row): array
    {
        $out = [];
        foreach ($row as $i => $v) {
            if ($v === null) { $out[$i] = null; continue; }
            $s = is_string($v) ? trim($v) : (string)$v;
            if ($i === 0) $s = preg_replace('/^\xEF\xBB\xBF/', '', $s); // strip BOM
            $out[$i] = ($s === '') ? null : $s;
        }
        while (!empty($out) && end($out) === null) array_pop($out);
        return $out;
    }

    private function mapHeaderToCanonical(array $header): array
    {
        $lower = array_map(fn($h)=>mb_strtolower(trim((string)$h)), $header);
        if (!empty($lower)) $lower[0] = preg_replace('/^\xEF\xBB\xBF/', '', $lower[0]);

        $map = [];
        foreach (['name','image'] as $key) {
            $idx = null;
            foreach ($this->aliases[$key] as $alias) {
                $i = array_search($alias, $lower, true);
                if ($i !== false) { $idx = $i; break; }
            }
            if ($key === 'name' && $idx === null) return []; // name is mandatory
            if ($idx !== null) $map[$key] = $idx;
        }
        return $map;
    }

    private function guessDelimiterFromSample(string $path, array $candidates=[',',';',"\t",'|']): string
    {
        $h = @fopen($path, 'r'); if (!$h) return ',';
        $sample = fgets($h, 8192) ?: '';
        fclose($h);
        $best = $candidates[0]; $bestCount = -1;
        foreach ($candidates as $d) {
            $c = substr_count($sample, $d);
            if ($c > $bestCount) { $best=$d; $bestCount=$c; }
        }
        return $best;
    }

    private function readAndMapHeader(string $absolutePath, string $delimiter): array
    {
        $fh = $this->openCsv($absolutePath, $delimiter);
        $header = $this->readNextNonEmpty($fh);
        $colIdx = $header ? $this->mapHeaderToCanonical($header) : [];

        if ($colIdx) return [$header, $colIdx, $delimiter];

        $auto = $this->guessDelimiterFromSample($absolutePath);
        if ($auto !== $delimiter) {
            $fh = $this->openCsv($absolutePath, $auto);
            $header = $this->readNextNonEmpty($fh);
            $colIdx = $header ? $this->mapHeaderToCanonical($header) : [];
            if ($colIdx) return [$header, $colIdx, $auto];
        }
        return [$header, [], $delimiter];
    }

    private function rowIssues(array $data, \ArrayAccess|array $existingLower, array $seenInFile=[], bool $strict=true): array
    {
        $errors=[]; $warnings=[];
        $name = trim((string)($data['name'] ?? ''));
        $image= (string)($data['image'] ?? '');

        if ($name === '') $errors['name'] = 'Name is required.';
        elseif (mb_strlen($name) > 255) $errors['name'] = 'Name too long (max 255).';

        $lower = mb_strtolower($name);
        if ($name !== '') {
            if ($strict && isset($seenInFile[$lower])) $errors['duplicate_in_file'] = 'Duplicate name within file.';
            if (isset($existingLower[$lower])) $warnings['duplicate_db'] = 'Name exists (will upsert).';
        }

        if ($image !== '' && mb_strlen($image) > 255) $errors['image'] = 'Image path/url too long.';
        if ($image !== '' && $this->isHttpUrl($image) === false && !str_starts_with($image, 'brands/')) {
            // not an error, just a hint: prefer URLs or storage-relative paths
            $warnings['image_hint'] = 'Image will be treated as a storage path or ignored.';
        }

        return [$errors, $warnings];
    }

    private function isHttpUrl(string $s): bool
    {
        return (bool) preg_match('/^https?:\/\//i', $s);
    }

    private function downloadImageFromUrl(string $url): ?string
    {
        try {
            $resp = Http::timeout(15)->get($url);
            if (!$resp->ok()) return null;

            $mime = strtolower($resp->header('Content-Type') ?? '');
            if (!str_starts_with($mime, 'image/')) return null;

            $ext = match (true) {
                str_contains($mime, 'jpeg') => 'jpg',
                str_contains($mime, 'png')  => 'png',
                str_contains($mime, 'webp') => 'webp',
                str_contains($mime, 'gif')  => 'gif',
                default => 'jpg',
            };

            $dir = 'brands/imports';
            Storage::disk($this->publicDisk)->makeDirectory($dir);

            $filename = Str::uuid().'.'.$ext;
            $path = "{$dir}/{$filename}";
            Storage::disk($this->publicDisk)->put($path, $resp->body());

            return $path; // relative (works with /storage/{path})
        } catch (\Throwable $e) {
            return null;
        }
    }
}
