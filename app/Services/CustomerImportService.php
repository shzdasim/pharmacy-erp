<?php

namespace App\Services;

use App\Models\Customer;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class CustomerImportService
{
    public const PREVIEW_INVALID_LIMIT = 20;
    public const PREVIEW_VALID_LIMIT   = 10;
    public const CHUNK_SIZE            = 1000;

    private string $disk = 'local';

    private array $aliases = [
        'name'    => ['name','customer','customer_name','full_name'],
        'email'   => ['email','e-mail','mail'],
        'phone'   => ['phone','mobile','contact','phone_number','tel','telephone'],
        'address' => ['address','addr','location','street','addr1'],
    ];

    public function storeUploaded(UploadedFile $file): array
    {
        $ext = strtolower($file->getClientOriginalExtension() ?: 'csv');
        if (!in_array($ext, ['csv','txt'], true)) {
            throw new \RuntimeException('Only CSV files are supported.');
        }

        $token    = (string) Str::uuid();
        $dir      = 'imports/customers';
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
                'message' => 'CSV must contain a header with column: name (email, phone, address optional).',
                'detected_header' => $header,
                'hint' => 'Accepted aliases: name|customer|customer_name; email|mail; phone|mobile; address|addr',
            ];
        }

        // Existing maps
        $existing = Customer::select('id','name','email')->get();
        $nameToId = $existing->mapWithKeys(fn($c)=>[mb_strtolower(trim((string)$c->name)) => (int)$c->id])->all();
        $emailTo   = $existing->filter(fn($c)=>$c->email)->mapWithKeys(function($c){
            return [mb_strtolower(trim((string)$c->email)) => ['id'=>(int)$c->id, 'name'=>mb_strtolower(trim((string)$c->name))]];
        })->all();

        $fh = $this->openCsv($absolutePath, $delimiter);
        $this->readNextNonEmpty($fh); // header

        $seenName = [];
        $seenEmail = [];

        $total=$valid=$invalid=0;
        $invalidSamples=[]; $validSamples=[];
        $rowNo=1;

        while (!$fh->eof()) {
            $row = $this->readNextNonEmpty($fh);
            if ($row === null) break;
            $rowNo++;

            $data = [
                'name'    => $row[$colIdx['name']]    ?? null,
                'email'   => array_key_exists('email',$colIdx)   ? ($row[$colIdx['email']]   ?? null) : null,
                'phone'   => array_key_exists('phone',$colIdx)   ? ($row[$colIdx['phone']]   ?? null) : null,
                'address' => array_key_exists('address',$colIdx) ? ($row[$colIdx['address']] ?? null) : null,
            ];

            [$errors, $warnings] = $this->rowIssues($data, $nameToId, $emailTo, $seenName, $seenEmail, true);

            $total++;
            if ($errors) {
                $invalid++;
                if (count($invalidSamples) < self::PREVIEW_INVALID_LIMIT) {
                    $invalidSamples[] = ['row'=>$rowNo, 'data'=>$data, 'errors'=>$errors, 'warnings'=>$warnings];
                }
            } else {
                $valid++;
                $ln = mb_strtolower(trim((string)$data['name'] ?? ''));
                $le = mb_strtolower(trim((string)$data['email'] ?? ''));
                if ($ln!=='') $seenName[$ln]=true;
                if ($le!=='') $seenEmail[$le]=true;
                if (count($validSamples) < self::PREVIEW_VALID_LIMIT) {
                    $validSamples[] = ['row'=>$rowNo, 'data'=>$data, 'warnings'=>$warnings];
                }
            }
        }

        return [
            'ok'=>true,
            'used_delimiter'=>$delimiter,
            'header'=>$header,
            'header_map'=>$colIdx,
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

        // Existing maps for conflict checks
        $existing = Customer::select('id','name','email')->get();
        $nameToId = $existing->mapWithKeys(fn($c)=>[mb_strtolower(trim((string)$c->name)) => (int)$c->id])->all();
        $emailTo   = $existing->filter(fn($c)=>$c->email)->mapWithKeys(function($c){
            return [mb_strtolower(trim((string)$c->email)) => ['id'=>(int)$c->id, 'name'=>mb_strtolower(trim((string)$c->name))]];
        })->all();

        $stats = ['total'=>0,'valid'=>0,'invalid'=>0,'committed'=>0,'new'=>0,'existing'=>0];
        $toUpsert = [];

        $flush = function () use (&$toUpsert, &$stats) {
            if (empty($toUpsert)) return;
            Customer::upsert($toUpsert, ['name'], ['email','phone','address']);
            $stats['committed'] += count($toUpsert);
            $toUpsert = [];
        };

        $fh = $this->openCsv($absolutePath, $delimiter);
        $this->readNextNonEmpty($fh); // header

        while (!$fh->eof()) {
            $row = $this->readNextNonEmpty($fh);
            if ($row === null) break;

            $name    = trim((string)($row[$colIdx['name']] ?? ''));
            $email   = array_key_exists('email',$colIdx)   ? trim((string)($row[$colIdx['email']] ?? ''))   : '';
            $phone   = array_key_exists('phone',$colIdx)   ? trim((string)($row[$colIdx['phone']] ?? ''))   : '';
            $address = array_key_exists('address',$colIdx) ? trim((string)($row[$colIdx['address']] ?? '')) : '';

            $stats['total']++;

            [$errors] = $this->rowIssues(compact('name','email','phone','address'), $nameToId, $emailTo, [], [], false);
            if ($errors) {
                $stats['invalid']++;
                if ($insertValidOnly) continue;
                throw new \RuntimeException('Import aborted due to validation error.');
            }

            $stats['valid']++;
            $ln = mb_strtolower($name);
            if (isset($nameToId[$ln])) $stats['existing']++; else { $stats['new']++; $nameToId[$ln] = -1; }

            $toUpsert[] = [
                'name'    => $name,
                'email'   => ($email !== '') ? $email : null,
                'phone'   => ($phone !== '') ? $phone : null,
                'address' => ($address !== '') ? $address : null,
            ];

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
            if ($i===0) $s = preg_replace('/^\xEF\xBB\xBF/', '', $s); // strip BOM
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
        foreach (['name','email','phone','address'] as $key) {
            $idx=null;
            foreach (($this->aliases[$key] ?? []) as $alias) {
                $i = array_search($alias, $lower, true);
                if ($i!==false) { $idx=$i; break; }
            }
            if ($key==='name' && $idx===null) return [];
            if ($idx!==null) $map[$key]=$idx;
        }
        return $map;
    }

    private function guessDelimiterFromSample(string $path, array $candidates=[',',';',"\t",'|']): string
    {
        $h = @fopen($path,'r'); if(!$h) return ',';
        $sample = fgets($h,8192) ?: ''; fclose($h);
        $best=$candidates[0]; $bestCount=-1;
        foreach($candidates as $d){ $c=substr_count($sample,$d); if($c>$bestCount){$best=$d;$bestCount=$c;} }
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

    /**
     * @return array{0: array<string,string>, 1: array<string,string>}
     */
    private function rowIssues(array $data, array $nameToId, array $emailTo, array $seenName, array $seenEmail, bool $strict): array
    {
        $errors=[]; $warnings=[];

        $name    = trim((string)($data['name']    ?? ''));
        $email   = trim((string)($data['email']   ?? ''));
        $phone   = trim((string)($data['phone']   ?? ''));
        $address = trim((string)($data['address'] ?? ''));

        if ($name==='') $errors['name']='Name is required.';
        elseif (mb_strlen($name)>255) $errors['name']='Name too long (max 255).';

        if ($email!=='') {
            if (mb_strlen($email) > 255) $errors['email']='Email too long (max 255).';
            elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) $errors['email']='Invalid email format.';
        }

        if ($phone!=='' && mb_strlen($phone) > 100) $warnings['phone']='Phone is quite long.';
        if ($address!=='' && mb_strlen($address) > 255) $warnings['address']='Address too long (will be truncated on save).';

        // In-file duplicates
        $ln = mb_strtolower($name);
        $le = mb_strtolower($email);
        if ($strict) {
            if (isset($seenName[$ln]))  $errors['duplicate_name_in_file'] = 'Duplicate name within file.';
            if ($email!=='' && isset($seenEmail[$le])) $errors['duplicate_email_in_file'] = 'Duplicate email within file.';
        }

        // DB duplicates: name ok (we upsert), email must not belong to a different name
        if ($email!=='' && isset($emailTo[$le])) {
            $ownerName = $emailTo[$le]['name'] ?? '';
            if ($ownerName !== $ln) {
                $errors['email_conflict'] = 'Email already used by another customer.';
            }
        }
        if (isset($nameToId[$ln])) $warnings['duplicate_name_db'] = 'Name exists (will upsert).';

        return [$errors,$warnings];
    }
}
