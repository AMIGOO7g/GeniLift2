<?php
/* GeniLift — публикация изменений каталога на сайт.
   Что делает: assets/live.json (цены, наличие, скрытые), страницы новых товаров по образцу существующих,
   карточки в каталоге zapchasti/, поиск, карта сайта, индекс артикулов для подбора по фото.
   Существующие страницы сайта не переписываются: только добавленные админкой (с пометкой) и счётчики каталога. */
declare(strict_types=1);

function rd(string $rel): string { return (string)@file_get_contents(GL_ROOT . '/' . $rel); }
function wr(string $rel, string $s): void
{
    $f = GL_ROOT . '/' . $rel;
    if (!is_dir(dirname($f))) @mkdir(dirname($f), 0755, true);
    if (is_file($f) && file_get_contents($f) === $s) return;
    $tmp = $f . '.' . getmypid() . '.tmp';
    file_put_contents($tmp, $s, LOCK_EX);
    rename($tmp, $f);
}
function site_base(): string
{
    return preg_match('~rel="canonical" href="(https?://[^/"]+)/~', rd('index.html'), $m) ? $m[1] : 'https://genilift.ru';
}
/* позиция после </div>, парного к <div ...>, открытому в $open */
function div_end(string $h, int $open): int
{
    $d = 0;
    if (!preg_match_all('~<div\b|</div>~', $h, $m, PREG_OFFSET_CAPTURE, $open)) return -1;
    foreach ($m[0] as [$tag, $pos]) {
        $d += $tag === '</div>' ? -1 : 1;
        if ($d === 0) return $pos + 6;
    }
    return -1;
}

/* ---------- образец страницы той же категории ---------- */
function ex_info(string $E): ?array
{
    $row = function (string $name) use ($E) {
        return preg_match('~<th scope="row">' . preg_quote($name, '~') . '</th><td>(.*?)</td>~u', $E, $m) ? html_entity_decode($m[1], ENT_QUOTES, 'UTF-8') : null;
    };
    $sku = $row('Артикул'); $brand = $row('Производитель'); $type = $row('Тип'); $sec = $row('Раздел');
    if ($sku === null || $brand === null || $type === null || $sec === null) return null;
    if (!preg_match('~rel="canonical" href="https?://[^/"]+/zapchasti/([^/"]+)/"~', $E, $s)) return null;
    if (!preg_match('~Опись № (\d+)~u', $E, $o)) return null;
    if (!preg_match('~<img src="(?:\.\./)+assets/parts/([^"]+)"~', $E, $i)) return null;
    if (!preg_match('~<p class="mx-sub">(.*?)</p>~su', $E, $d)) return null;
    if (!preg_match('~\?cat=([a-z0-9-]+)"~', $E, $c)) return null;
    return ['sku' => $sku, 'brand' => $brand, 'type' => $type, 'sec' => $sec, 'slug' => $s[1], 'opis' => $o[1], 'img' => $i[1], 'desc' => $d[1], 'cat' => $c[1]];
}
function find_exemplar(string $catSlug, array $all): ?array
{
    static $cache = [];
    if (isset($cache[$catSlug])) return $cache[$catSlug];
    $try = function (string $slug, string $want) use (&$cache): ?array {
        $f = GL_ROOT . "/zapchasti/$slug/index.html";
        if (!is_file($f) || strpos((string)file_get_contents($f, false, null, 0, 400), 'genilift-admin') !== false) return null;
        $E = (string)file_get_contents($f);
        if (strpos($E, 'genilift-admin') !== false) return null;
        $i = ex_info($E);
        if (!$i || ($want !== '' && $i['cat'] !== $want)) return null;
        if (mb_strlen($i['sku']) < 6 || mb_strlen($i['brand']) < 3) return null;      // слишком короткие значения могут совпасть с чужим текстом
        foreach ([$i['type'], $i['sec'], $i['brand']] as $t) if (stripos($t, $i['sku']) !== false || stripos($i['sku'], $t) !== false) return null;
        return ['html' => $E, 'i' => $i];
    };
    foreach ([$catSlug, ''] as $want) {
        foreach ($all as $p) {
            if (!$p['legacy'] || $p['slug'] === '' || ($want !== '' && cat_slug((string)$p['category']) !== $want)) continue;
            if ($r = $try($p['slug'], $want)) return $cache[$catSlug] = $r;
        }
    }
    return null;
}

function spec_rows(string $specs): array
{
    $out = [];
    foreach (preg_split('~[\n;]+~u', $specs) ?: [] as $line) {
        $line = trim($line);
        if ($line === '') continue;
        $p = mb_strpos($line, ':');
        $out[] = $p === false ? [$line, ''] : [trim(mb_substr($line, 0, $p)), trim(mb_substr($line, $p + 1))];
    }
    return $out;
}

/* ---------- страница нового товара ---------- */
function gen_page(array $p, array $ex): string
{
    $E = $ex['html']; $i = $ex['i'];
    $cut = strpos($E, '<section class="related">');
    $A = $cut === false ? $E : substr($E, 0, $cut);
    $B = $cut === false ? '' : substr($E, $cut);
    $cat = cat_slug((string)$p['category']);
    $type = type_label($p); $sec = GL_CATS[$cat];
    $img = $p['photo'] !== '' && is_file(GL_ROOT . '/assets/parts/' . $p['photo']) ? $p['photo'] : 'no-photo.webp';
    $desc = $p['short'] !== '' ? $p['short'] : $type . ' ' . $p['brand'] . '. Перед оплатой сверяем артикул с шильдиком вашего оборудования.';
    $lc = fn(string $s) => mb_strtolower($s, 'UTF-8');
    $av = $p['availability'];
    $pr = $p['price'] ? number_format((int)$p['price'], 0, '', "\u{00A0}") . ' ₽' : 'по запросу';

    $A = str_replace('assets/parts/' . $i['img'], 'assets/parts/@@IMG@@', $A);
    $A = str_replace(['zapchasti/' . $i['slug'] . '/', '&quot;' . $i['slug'] . '&quot;'], ['zapchasti/@@SLUG@@/', '&quot;@@SLUG@@&quot;'], $A);
    $descPlain = html_entity_decode((string)$i['desc'], ENT_QUOTES, 'UTF-8');
    if ($descPlain !== '') $A = str_replace($descPlain, '@@DESCJ@@', $A);                // описание в структурированных данных
    $A = str_replace('<p class="mx-sub">' . $i['desc'] . '</p>', '<p class="mx-sub">@@DESC@@</p>', $A);
    $A = preg_replace('~(<th scope="row">Тип</th><td>).*?(</td>)~u', '${1}@@TYPE@@${2}', $A) ?? $A;
    $A = str_replace($i['sec'], '@@SEC@@', $A);
    $A = str_replace([$i['type'], $lc($i['type'])], ['@@TYPE@@', '@@TYPEL@@'], $A);
    $A = str_replace([$i['brand'], $lc($i['brand'])], ['@@BRAND@@', '@@BRANDL@@'], $A);
    $A = str_replace([$i['sku'], $lc($i['sku'])], ['@@SKU@@', '@@SKUL@@'], $A);
    $A = str_replace('Опись № ' . $i['opis'], 'Опись № @@OPIS@@', $A);
    $A = str_replace('?cat=' . $i['cat'], '?cat=@@CAT@@', $A);
    $A = preg_replace('~(<th scope="row">Наличие</th><td>).*?(</td>)~u', '${1}@@AV@@${2}', $A) ?? $A;
    $A = preg_replace('~(<th scope="row">Цена</th><td>).*?(</td>)~u', '${1}@@PR@@${2}', $A) ?? $A;

    $A = strtr($A, [
        '@@DESCJ@@' => trim((string)json_encode($desc, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), '"'), '@@IMG@@' => h($img), '@@SLUG@@' => h($p['slug']), '@@DESC@@' => h($desc), '@@SEC@@' => h($sec),
        '@@TYPE@@' => h($type), '@@TYPEL@@' => h($lc($type)), '@@BRAND@@' => h($p['brand']), '@@BRANDL@@' => h($lc($p['brand'])),
        '@@SKU@@' => h($p['sku']), '@@SKUL@@' => h($lc($p['sku'])), '@@OPIS@@' => (string)(1000 + crc32($p['sku']) % 9000),
        '@@CAT@@' => $cat, '@@AV@@' => h($av), '@@PR@@' => h($pr),
    ]);

    $x = '';
    $rows = spec_rows((string)$p['specs']);
    if ($rows) {
        $x .= '<section class="vtab pextra"><h2 class="sec-t">Характеристики</h2><div class="vt-wrap"><table class="vt"><thead><tr><th>Параметр</th><th>Значение</th></tr></thead><tbody>';
        foreach ($rows as [$k, $v]) $x .= '<tr><td class="vt-a">' . h($k) . '</td><td>' . h($v) . '</td></tr>';
        $x .= '</tbody></table></div></section>';
    }
    $txt = [];
    foreach ([(string)$p['description'], $p['compatibility'] !== '' ? 'Совместимость: ' . $p['compatibility'] : ''] as $t) {
        foreach (preg_split('~\n{1,}~u', trim($t)) ?: [] as $para) if (trim($para) !== '') $txt[] = '<p>' . h(trim($para)) . '</p>';
    }
    if ($txt) $x .= '<section class="pextra pextra-t">' . implode('', $txt) . '</section>';
    if ($x !== '') {
        $at = strpos($A, '<section class="where');
        if ($at === false) $at = strpos($A, '<div class="pacts">');
        if ($at !== false) $A = substr($A, 0, $at) . $x . "\n  " . substr($A, $at);
    }
    $A = preg_replace('~</head>~', '<meta name="generator" content="genilift-admin">' . "\n</head>", $A, 1) ?? $A;
    return $A . $B;
}

/* ---------- карточка в каталоге ---------- */
function gen_card(array $p): string
{
    $cat = cat_slug((string)$p['category']);
    $type = type_label($p);
    $img = $p['photo'] !== '' && is_file(GL_ROOT . '/assets/parts/' . $p['photo']) ? $p['photo'] : 'no-photo.webp';
    $lc = fn(string $s) => mb_strtolower($s, 'UTF-8');
    $q = $lc($p['brand'] . ' ' . $p['sku'] . ' ' . $type . ' ' . $p['brand'] . ' ' . $p['sku'] . ' ' . $type);
    $add = h(json_encode(['a' => $p['sku'], 'b' => $p['brand'], 'n' => $type . ' ' . $p['brand'] . ' ' . $p['sku'], 's' => $p['slug']], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    $href = '../zapchasti/' . h($p['slug']) . '/';
    return '<!--gl:card--><article class="card tag" data-brand="' . brand_slug((string)$p['brand']) . '" data-cat="' . $cat . '" data-q="' . h($q) . '">
  <a class="tag-img" href="' . $href . '"><img src="../assets/parts/' . h($img) . '" alt="' . h($p['brand'] . ' ' . $p['sku'] . ' — ' . $lc($type) . ' ' . $lc($p['brand']) . ' ' . $lc($p['sku'])) . '" loading="lazy"></a>
  <a class="tag-pn" href="' . $href . '">' . h($p['sku']) . '</a><span class="tag-brand">' . h($p['brand']) . '</span><span class="tag-name">' . h($type) . '</span>
  <button class="tag-btn add" type="button" data-add=\'' . $add . '\'><span>Добавить в запрос</span><i>+</i></button>
</article><!--/gl-->';
}

function patch_catalog(array $byCat): int
{
    $h = rd('zapchasti/index.html');
    if ($h === '') return 0;
    $orig = $h;
    $h = preg_replace('~<!--gl:card-->.*?<!--/gl-->~su', '', $h) ?? $h;
    $n = 0;
    foreach (GL_CATS as $cat => $name) {
        $a = strpos($h, '<article class="esc-s" id="' . $cat . '">');
        if ($a === false) continue;
        $g = strpos($h, '<div class="grid esc-grid">', $a);
        if ($g === false) continue;
        $e = div_end($h, $g);
        if ($e < 0) continue;
        $closeAt = $e - 6;
        if (!empty($byCat[$cat])) {
            $ins = implode('', $byCat[$cat]);
            $h = substr($h, 0, $closeAt) . $ins . substr($h, $closeAt);
            $e += strlen($ins); $n += count($byCat[$cat]);
        }
        $grid = substr($h, $g, $e - $g);
        $cnt = preg_match_all('~<article class="card tag" data-brand="([^"]+)"~', $grid, $mm);
        $perBrand = array_count_values($mm[1]);
        /* заголовок раздела: счётчик и марки */
        $head = substr($h, $a, $g - $a);
        $head = preg_replace('~(<p class="it">)\d+( позиций)~u', '${1}' . $cnt . '${2}', $head) ?? $head;
        $seen = [];
        $head = preg_replace_callback('~<button type="button" data-brand="([^"]+)" aria-pressed="false">(.*?)<em>\d+</em></button>~u', function ($m) use ($perBrand, &$seen) {
            $seen[$m[1]] = 1;
            return empty($perBrand[$m[1]]) ? '' : '<button type="button" data-brand="' . $m[1] . '" aria-pressed="false">' . $m[2] . '<em>' . $perBrand[$m[1]] . '</em></button>';
        }, $head) ?? $head;
        $add = '';
        foreach ($perBrand as $b => $c) if (!isset($seen[$b])) $add .= '<button type="button" data-brand="' . h($b) . '" aria-pressed="false">' . h(GL_BRANDS[$b] ?? $b) . '<em>' . $c . '</em></button>';
        if ($add !== '') $head = preg_replace('~(<div class="esc-brands"[^>]*>.*?)(</div>)~su', '${1}' . $add . '${2}', $head, 1) ?? $head;
        $h = substr($h, 0, $a) . $head . substr($h, $g);
        /* полоса разделов */
        $h = preg_replace('~(data-ecat="' . preg_quote($cat, '~') . '"[^>]*>.*?<em>)\d+(</em>)~su', '${1}' . $cnt . '${2}', $h, 1) ?? $h;
    }
    if ($h !== $orig) wr('zapchasti/index.html', $h);
    return $n;
}

/* ---------- публикация ---------- */
function build_all(): array
{
    $log = [];
    $all = products();
    $reg = jread('generated', []);                 // sku => slug: что админка уже создала на сайте
    $now = [];                                      // что должно быть на сайте сейчас
    $live = [];
    $byCat = [];
    $miss = 0;

    foreach ($all as $sku => $p) {
        $info = [];
        if ($p['price']) $info['pr'] = (int)$p['price'];
        if ($p['availability'] !== 'По запросу') $info['av'] = $p['availability'];
        if (!$p['published']) $info['h'] = 1;
        if ($info) $live[$p['sku']] = $info;
    }
    $newOnes = array_filter($all, fn($p) => !$p['legacy'] && $p['published'] && $p['slug'] !== '');
    uasort($newOnes, fn($a, $b) => [$a['sort'], $a['sku']] <=> [$b['sort'], $b['sku']]);
    foreach ($newOnes as $sku => $p) {
        $ex = find_exemplar(cat_slug((string)$p['category']), $all);
        if (!$ex) { $miss++; $log[] = "Нет образца страницы для «{$p['sku']}» — пропущен."; continue; }
        wr('zapchasti/' . $p['slug'] . '/index.html', gen_page($p, $ex));
        $now[$sku] = $p['slug'];
        $byCat[cat_slug((string)$p['category'])][] = gen_card($p);
    }
    /* убрать страницы, которые админка создавала раньше, а теперь они скрыты или удалены */
    foreach ($reg as $sku => $slug) {
        if (isset($now[$sku]) || !preg_match('~^[a-z0-9-]+$~', (string)$slug)) continue;
        $f = GL_ROOT . "/zapchasti/$slug/index.html";
        if (is_file($f) && strpos((string)file_get_contents($f), 'genilift-admin') !== false) { @unlink($f); @rmdir(dirname($f)); $log[] = "Снята страница: $slug"; }
    }
    $cards = patch_catalog($byCat);
    foreach (build_pages() as $l) $log[] = $l;

    wr('assets/live.json', json_encode(['v' => time(), 'p' => (object)$live], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));

    /* поиск по сайту */
    $sj = json_decode(rd('assets/search.json'), true);
    if (is_array($sj) && isset($sj['p'])) {
        $had = false;
        $keep = [];
        foreach ($sj['p'] as $e) { if (!empty($e['g'])) $had = true; else $keep[] = $e; }
        foreach ($now as $sku => $slug) { $keep[] = ['t' => product_title($all[$sku]), 'u' => "zapchasti/$slug/", 'g' => 1]; }
        if ($had || $now) { $sj['p'] = $keep; wr('assets/search.json', json_encode($sj, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)); }
    }
    /* индекс артикулов для подбора по фото */
    $kj = json_decode(rd('assets/skus.json'), true);
    if (is_array($kj)) {
        $had = false;
        foreach ($kj as $k => $v) if (isset($v[3])) { $had = true; unset($kj[$k]); }
        foreach ($now as $sku => $slug) $kj[$all[$sku]['sku']] = [$slug, $all[$sku]['brand'], product_title($all[$sku]), 'g'];
        if ($had || $now) wr('assets/skus.json', json_encode($kj, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    }
    /* карта сайта */
    $sm = rd('sitemap.xml');
    if ($sm !== '') {
        $base = site_base();
        $o = $sm;
        foreach ($reg as $slug) $sm = str_replace("<url><loc>$base/zapchasti/$slug/</loc></url>", '', str_replace("<url><loc>$base/zapchasti/$slug/</loc></url>\n", '', $sm));
        $add = '';
        foreach ($now as $slug) $add .= "<url><loc>$base/zapchasti/$slug/</loc></url>\n";
        if ($add !== '') $sm = preg_replace('~</urlset>~', $add . '</urlset>', $sm, 1) ?? $sm;
        if ($sm !== $o) wr('sitemap.xml', $sm);
    }
    jwrite('generated', $now);
    $log[] = 'Готово: товаров в базе — ' . count($all) . ', с ценой или наличием — ' . count($live) . ', новых страниц — ' . count($now) . ', карточек в каталоге добавлено — ' . $cards . '.';
    return $log;
}

require_once __DIR__ . '/brands.php';
