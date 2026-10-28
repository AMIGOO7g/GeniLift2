<?php
/* GeniLift — чтение и запись .xlsx без внешних библиотек (ZipArchive + SimpleXML) */
declare(strict_types=1);

function xlsx_col(string $ref): int
{
    $n = 0;
    foreach (str_split(preg_replace('/[^A-Z]/', '', strtoupper($ref)) ?? '') as $c) $n = $n * 26 + (ord($c) - 64);
    return $n - 1;
}
function xlsx_letter(int $i): string
{
    $s = '';
    for ($i++; $i > 0; $i = intdiv($i - 1, 26)) $s = chr(65 + ($i - 1) % 26) . $s;
    return $s;
}
function xlsx_text($v): string
{
    if (is_float($v) && floor($v) == $v && abs($v) < 1e15) return (string)(int)$v;
    return (string)$v;
}

/* Возвращает список строк-ассоциаций (ключи — заголовки первой строки в нижнем регистре) */
function xlsx_rows(string $file): array
{
    if (!class_exists('ZipArchive')) throw new RuntimeException('На сервере нет расширения zip — загрузите CSV вместо Excel.');
    $z = new ZipArchive();
    if ($z->open($file) !== true) throw new RuntimeException('Файл не открывается как Excel (.xlsx).');
    $shared = [];
    if (($s = $z->getFromName('xl/sharedStrings.xml')) !== false) {
        $x = @simplexml_load_string($s, 'SimpleXMLElement', LIBXML_NONET);
        if ($x) foreach ($x->si as $si) {
            $t = '';
            if (isset($si->t)) $t = (string)$si->t;
            else foreach ($si->r as $r) $t .= (string)$r->t;
            $shared[] = $t;
        }
    }
    $sheet = $z->getFromName('xl/worksheets/sheet1.xml');
    if ($sheet === false) {                                     // первый лист может называться иначе
        for ($i = 0; $i < $z->numFiles; $i++) { $n = $z->getNameIndex($i); if (preg_match('#^xl/worksheets/[^/]+\.xml$#', $n)) { $sheet = $z->getFromIndex($i); break; } }
    }
    $z->close();
    if ($sheet === false || $sheet === '') throw new RuntimeException('В файле нет листа с данными.');
    $x = @simplexml_load_string($sheet, 'SimpleXMLElement', LIBXML_NONET);
    if (!$x) throw new RuntimeException('Лист не читается.');
    $rows = [];
    foreach ($x->sheetData->row as $row) {
        $cells = [];
        foreach ($row->c as $c) {
            $i = xlsx_col((string)$c['r']);
            $t = (string)$c['t'];
            if ($t === 's') $v = $shared[(int)$c->v] ?? '';
            elseif ($t === 'inlineStr') { $v = isset($c->is->t) ? (string)$c->is->t : ''; if ($v === '' && isset($c->is->r)) foreach ($c->is->r as $r) $v .= (string)$r->t; }
            elseif ($t === 'b') $v = ((string)$c->v === '1') ? '1' : '0';
            else { $v = (string)$c->v; if (($t === '' || $t === 'n') && $v !== '' && is_numeric($v)) $v = xlsx_text((float)$v); if (strpos($v, '.') !== false && is_numeric($v)) $v = rtrim(rtrim($v, '0'), '.'); }
            $cells[$i] = $v;
        }
        $rows[] = $cells;
    }
    return rows_to_assoc($rows);
}
function rows_to_assoc(array $rows): array
{
    if (!$rows) return [];
    $head = [];
    foreach ($rows[0] as $i => $name) $head[$i] = mb_strtolower(trim((string)$name), 'UTF-8');
    $out = [];
    foreach (array_slice($rows, 1) as $r) {
        $a = [];
        foreach ($head as $i => $name) if ($name !== '') $a[$name] = $r[$i] ?? '';
        if (trim(implode('', $a)) !== '') $out[] = $a;
    }
    return $out;
}

/* CSV из Excel («Сохранить как CSV»): ; или , или табуляция, UTF-8 или Windows-1251 */
function csv_rows(string $file): array
{
    $s = (string)file_get_contents($file);
    if (substr($s, 0, 3) === "\xEF\xBB\xBF") $s = substr($s, 3);
    if (!preg_match('//u', $s)) $s = mb_convert_encoding($s, 'UTF-8', 'Windows-1251');
    $first = strtok($s, "\n") ?: '';
    $d = ';';
    foreach ([';', "\t", ','] as $c) if (substr_count($first, $c) > substr_count($first, $d)) $d = $c;
    $fh = fopen('php://temp', 'r+'); fwrite($fh, $s); rewind($fh);
    $rows = [];
    while (($r = fgetcsv($fh, 0, $d, '"', '\\')) !== false) $rows[] = $r;
    fclose($fh);
    return rows_to_assoc($rows);
}

/* Запись: заголовки + строки (массивы значений) */
function xlsx_write(string $file, array $headers, array $rows, string $sheetName = 'products'): void
{
    $z = new ZipArchive();
    if ($z->open($file, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) throw new RuntimeException('Не удалось создать файл.');
    $z->addFromString('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>');
    $z->addFromString('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
    $z->addFromString('xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="' . htmlspecialchars($sheetName, ENT_XML1) . '" sheetId="1" r:id="rId1"/></sheets></workbook>');
    $z->addFromString('xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>');
    $cell = function (int $c, int $r, $v): string {
        $ref = xlsx_letter($c) . $r;
        if ($v === null || $v === '') return '';
        if (is_int($v) || is_float($v)) return '<c r="' . $ref . '"><v>' . $v . '</v></c>';
        if (is_bool($v)) return '<c r="' . $ref . '" t="b"><v>' . ($v ? 1 : 0) . '</v></c>';
        $t = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F]/', '', (string)$v);
        return '<c r="' . $ref . '" t="inlineStr"><is><t xml:space="preserve">' . htmlspecialchars((string)$t, ENT_XML1 | ENT_SUBSTITUTE, 'UTF-8') . '</t></is></c>';
    };
    $xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>';
    $all = array_merge([$headers], $rows);
    foreach ($all as $ri => $row) {
        $xml .= '<row r="' . ($ri + 1) . '">';
        foreach (array_values($row) as $ci => $v) $xml .= $cell($ci, $ri + 1, $v);
        $xml .= '</row>';
    }
    $z->addFromString('xl/worksheets/sheet1.xml', $xml . '</sheetData></worksheet>');
    $z->close();
}
