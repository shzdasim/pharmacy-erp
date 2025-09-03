<?php

namespace App\Services;

use App\Models\Category;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class CategoryImportService
{
    public const PREVIEW_INVALID_LIMIT = 20;
    public const PREVIEW_VALID_LIMIT   = 10;
    public const CHUNK_SIZE            = 1000;

    private string $disk = 'local';

    private array $aliases = [
        'name' => ['name','category','category_name','cat','title','label'],
    ];

    public function storeUploaded(UploadedFile $file): array
    {
        $ext = strtolower($file->getClientOriginalExtension() ?: 'csv');
        if (!in_array($ext, ['csv','txt'], true)) {
            throw new \RuntimeException('Only CSV files are supported.');
        }

        $token    = (string) Str::uuid();
        $dir      = 'imports/categories';
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
                'message' => 'CSV must contain a header with column: name (any order/alias okay).',
                'detected_header' => $header,
                'hint' => 'Accepted: name|category|category_name|title|label',
            ];
        }

        $existing = Category::select('name')->get()
            ->pluck('name')->map(fn($n)=>mb_strtolower(trim((string)$n)))->filter()->unique()->flip();

        $fh = $this->openCsv($absolutePath, $delimiter);
        $this->readNextNonEmpty($fh); // header

        $seenInFile = [];
        $total=$valid=$invalid=0;
        $invalidSamples=[]; $validSamples=[];

        $rowNo = 1;
        while (!$fh->eof()) {
            $row = $this->readNextNonEmpty($fh);
            if ($row === null) break;
            $rowNo++;

            $data = ['name' => $row[$colIdx['name']] ?? null];

            [$errors, $warnings] = $this->rowIssues($data, $existing, $seenInFile, true);

            $total++;
            if ($errors) {
                $invalid++;
                if (count($invalidSamples) < self::PREVIEW_INVALID_LIMIT) {
                    $invalidSamples[] = ['row'=>$rowNo, 'data'=>$data, 'errors'=>$errors, 'warnings'=>$warnings];
                }
            } else {
                $valid++;
                $lower = mb_strtolower(trim((string)$data['name']));
                if ($lower !== '') $seenInFile[$lower]=true;
                if (count($validSamples) < self::PREVIEW_VALID_LIMIT) {
                    $validSamples[] = ['row'=>$rowNo, 'data'=>$data, 'warnings'=>$warnings];
                }
            }
        }

        return [
            'ok' => true,
            'used_delimiter' => $delimiter,
            'header' => $header,
            'header_map' => $colIdx,
            'total'=>$total, 'valid'=>$valid, 'invalid'=>$invalid,
            'invalid_samples'=>$invalidSamples, 'valid_samples'=>$validSamples,
        ];
    }

    // ---------- Commit ----------

    public function commit(string $absolutePath, bool $insertValidOnly = true, string $delimiter = ','): array
    {
        $delimiter = $this->normalizeDelimiter($delimiter);
        [$header, $colIdx, $delimiter] = $this->readAndMapHeader($absolutePath, $delimiter);
        if (!$colIdx) throw new \RuntimeException('CSV header not recognized (need name).');

        $existingLower = Category::select('name')->get()
            ->pluck('name')->map(fn($n)=>mb_strtolower(trim((string)$n)))->filter()->unique()->flip();

        $stats = ['total'=>0,'valid'=>0,'invalid'=>0,'committed'=>0,'new'=>0,'existing'=>0];
        $toUpsert = [];

        $flush = function () use (&$toUpsert, &$stats) {
            if (empty($toUpsert)) return;
            Category::upsert($toUpsert, ['name'], []); // no other columns
            $stats['committed'] += count($toUpsert);
            $toUpsert = [];
        };

        $fh = $this->openCsv($absolutePath, $delimiter);
        $this->readNextNonEmpty($fh); // header

        while (!$fh->eof()) {
            $row = $this->readNextNonEmpty($fh);
            if ($row === null) break;

            $name = trim((string)($row[$colIdx['name']] ?? ''));
            $stats['total']++;

            [$errors] = $this->rowIssues(['name'=>$name], $existingLower, [], false);
            if ($errors) {
                $stats['invalid']++;
                if ($insertValidOnly) continue;
                throw new \RuntimeException('Import aborted due to validation error.');
            }

            $stats['valid']++;
            $lower = mb_strtolower($name);
            if (isset($existingLower[$lower])) $stats['existing']++; else { $stats['new']++; $existingLower[$lower]=true; }

            $toUpsert[] = ['name' => $name];

            if (count($toUpsert) >= self::CHUNK_SIZE) $flush();
        }

        DB::transaction(fn() => $flush());

        return $stats;
    }

    // ---------- helpers ----------

    private function normalizeDelimiter(string $delimiter): string { return $delimiter === '\t' ? "\t" : $delimiter; }

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
            if ($row === [] || (count($row)===1 && $row[0]===null)) continue;
            return $row;
        }
        return null;
    }

    private function normalizeRow(array $row): array
    {
        $out=[];
        foreach ($row as $i=>$v) {
            if ($v===null) { $out[$i]=null; continue; }
            $s = is_string($v) ? trim($v) : (string)$v;
            if ($i===0) $s = preg_replace('/^\xEF\xBB\xBF/', '', $s); // BOM
            $out[$i] = ($s==='') ? null : $s;
        }
        while (!empty($out) && end($out)===null) array_pop($out);
        return $out;
    }

    private function mapHeaderToCanonical(array $header): array
    {
        $lower = array_map(fn($h)=>mb_strtolower(trim((string)$h)), $header);
        if (!empty($lower)) $lower[0] = preg_replace('/^\xEF\xBB\xBF/', '', $lower[0]);

        $map=[];
        foreach (['name'] as $key) {
            $idx=null;
            foreach ($this->aliases[$key] as $alias) {
                $i = array_search($alias, $lower, true);
                if ($i!==false) { $idx=$i; break; }
            }
            if ($idx===null) return [];
            $map[$key]=$idx;
        }
        return $map;
    }

    private function guessDelimiterFromSample(string $path, array $candidates=[',',';',"\t",'|']): string
    {
        $h = @fopen($path,'r'); if(!$h) return ',';
        $sample = fgets($h,8192) ?: ''; fclose($h);
        $best=$candidates[0]; $bestCount=-1;
        foreach($candidates as $d){ $c=substr_count($sample,$d); if($c>$bestCount){$best=$d;$bestCount=$c;}}
        return $best;
    }

    private function readAndMapHeader(string $absolutePath, string $delimiter): array
    {
        $fh = $this->openCsv($absolutePath, $delimiter);
        $header = $this->readNextNonEmpty($fh);
        $colIdx = $header ? $this->mapHeaderToCanonical($header) : [];

        if ($colIdx) return [$header,$colIdx,$delimiter];

        $auto = $this->guessDelimiterFromSample($absolutePath);
        if ($auto !== $delimiter) {
            $fh = $this->openCsv($absolutePath, $auto);
            $header = $this->readNextNonEmpty($fh);
            $colIdx = $header ? $this->mapHeaderToCanonical($header) : [];
            if ($colIdx) return [$header,$colIdx,$auto];
        }
        return [$header,[],$delimiter];
    }

    private function rowIssues(array $data, \ArrayAccess|array $existingLower, array $seenInFile=[], bool $strict=true): array
    {
        $errors=[]; $warnings=[];
        $name = trim((string)($data['name'] ?? ''));

        if ($name==='') $errors['name']='Name is required.';
        elseif (mb_strlen($name)>255) $errors['name']='Name too long (max 255).';

        $lower = mb_strtolower($name);
        if ($name!=='') {
            if ($strict && isset($seenInFile[$lower])) $errors['duplicate_in_file']='Duplicate name within file.';
            if (isset($existingLower[$lower])) $warnings['duplicate_db']='Name exists (will upsert).';
        }
        return [$errors,$warnings];
    }
}
