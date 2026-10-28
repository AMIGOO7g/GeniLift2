<?php
/* GeniLift — страницы марок (/brendy/…) и разделов (/razdely/…) для поиска и навигации.
   Карточки берутся из каталога zapchasti/index.html, поэтому страницы всегда совпадают с каталогом.
   Тексты — в admin/content.php. Запуск: из админки при публикации или `php admin/cli.php brands`. */
declare(strict_types=1);

const GL_PAGES_MARK = '<meta name="generator" content="genilift-pages">';

function pages_content(): array
{
    static $c = null;
    if ($c === null) $c = require __DIR__ . '/content.php';
    return $c;
}

/* карточки каталога: марка, раздел, готовый HTML, артикул, название */
function catalog_cards(): array
{
    $h = rd('zapchasti/index.html');
    $out = [];
    if (!preg_match_all('~<article class="card tag" data-brand="([^"]+)" data-cat="([^"]+)".*?</article>~su', $h, $m, PREG_SET_ORDER)) return $out;
    foreach ($m as $x) {
        $html = $x[0];
        $pn = preg_match('~class="tag-pn"[^>]*>(.*?)</a>~su', $html, $a) ? trim(strip_tags($a[1])) : '';
        $nm = preg_match('~class="tag-name">(.*?)</span>~su', $html, $a) ? trim(strip_tags($a[1])) : '';
        $br = preg_match('~class="tag-brand">(.*?)</span>~su', $html, $a) ? trim(strip_tags($a[1])) : '';
        $hr = preg_match('~class="tag-pn" href="\.\./(zapchasti/[^"]+)"~', $html, $a) ? $a[1] : '';
        $out[] = ['brand' => $x[1], 'cat' => $x[2], 'html' => $html, 'pn' => html_entity_decode($pn, ENT_QUOTES, 'UTF-8'), 'name' => html_entity_decode($nm, ENT_QUOTES, 'UTF-8'), 'brandName' => html_entity_decode($br, ENT_QUOTES, 'UTF-8'), 'href' => $hr];
    }
    return $out;
}

function plural_pos(int $n): string
{
    $m = $n % 100; $d = $n % 10;
    if ($m >= 11 && $m <= 14) return 'позиций';
    return $d === 1 ? 'позиция' : (($d >= 2 && $d <= 4) ? 'позиции' : 'позиций');
}

/* оболочка страницы: шапка, подвал, форма заявки — как на соседней странице сайта */
function pages_shell(): ?array
{
    $s = rd('podbor-po-foto/index.html');
    if ($s === '' || !preg_match('~<main class="page">.*?</main>~su', $s, $mm)) return null;
    $cta = preg_match('~<section class="cta2 cblock">.*?</section>~su', $mm[0], $c) ? $c[0] : '';
    $cta = preg_replace('~<h2>.*?</h2><p class="it">.*?</p>~su', '<h2 class="h3">Остались вопросы?</h2><p class="it">Позвоните или оставьте заявку — менеджер всё расскажет.</p>', $cta) ?? $cta;
    $s = preg_replace('~<script src="[^"]*photo\.js[^"]*" defer></script>\s*~', '', $s) ?? $s;
    $s = preg_replace('~\s*<script type="application/ld\+json"[^>]*>.*?</script>~su', '', $s) ?? $s;      // чужая разметка страницы-образца не нужна
    $s = preg_replace('~<body class="[^"]*"~', '<body class="pg pg-shop pg-brand"', $s, 1) ?? $s;
    return ['html' => $s, 'cta' => $cta];
}

function ld_script(array $j): string
{
    return '<script type="application/ld+json">' . json_encode($j, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . '</script>';
}

/* собрать страницу: подставить заголовок, описание, адрес, основную часть и разметку */
function pages_render(array $sh, string $depthRoot, string $path, string $title, string $desc, string $main, array $ld): string
{
    $base = site_base();
    $url = $base . '/' . $path;
    $s = $sh['html'];
    $s = preg_replace('~<title>.*?</title>~su', '<title>' . h($title) . '</title>', $s, 1) ?? $s;
    $s = preg_replace('~<meta name="description" content="[^"]*">~u', '<meta name="description" content="' . h($desc) . '">', $s, 1) ?? $s;
    $s = preg_replace('~<link rel="canonical" href="[^"]*">~', '<link rel="canonical" href="' . h($url) . '">', $s, 1) ?? $s;
    $s = preg_replace('~(<meta property="og:title" content=")[^"]*"~u', '${1}' . h($title) . '"', $s, 1) ?? $s;
    $s = preg_replace('~(<meta property="og:description" content=")[^"]*"~u', '${1}' . h($desc) . '"', $s, 1) ?? $s;
    $s = preg_replace('~(<meta property="og:url" content=")[^"]*"~', '${1}' . h($url) . '"', $s, 1) ?? $s;
    if ($depthRoot !== '../') $s = preg_replace('~(href|src|data-r|action)="\.\./~', '${1}="' . $depthRoot, $s) ?? $s;   // до подстановки основной части
    $s = preg_replace('~<main class="page">.*?</main>~su', '<main class="page">@@MAIN@@</main>', $s, 1) ?? $s;
    $s = str_replace('@@MAIN@@', $main, $s);
    $ldh = '';
    foreach ($ld as $j) $ldh .= ld_script($j) . "\n";
    $pos = strpos($s, '</head>');
    if ($pos !== false) $s = substr($s, 0, $pos) . GL_PAGES_MARK . "\n" . $ldh . substr($s, $pos);
    return $s;
}

function cards_for(array $cards, string $root): string
{
    $o = '';
    foreach ($cards as $c) {
        $o .= str_replace(['href="../', 'src="../'], ['href="' . $root, 'src="' . $root], $c['html']) . "\n";
    }
    return $o;
}

function faq_html(array $qa): string
{
    $o = '<div class="qa" data-qa>';
    foreach ($qa as $i => [$q, $a]) {
        $n = str_pad((string)($i + 1), 2, '0', STR_PAD_LEFT);
        $on = $i === 0;
        $o .= '<div class="qa-i' . ($on ? ' on' : '') . '"><button class="qa-q" type="button" aria-expanded="' . ($on ? 'true' : 'false') . '"><b>' . $n . '</b><span>' . h($q) . '</span></button><div class="qa-a"><p class="qa-qt">' . h($q) . '</p><p>' . h($a) . '</p></div></div>';
    }
    return $o . '</div>';
}

function faq_ld(array $qa): array
{
    $e = [];
    foreach ($qa as [$q, $a]) $e[] = ['@type' => 'Question', 'name' => $q, 'acceptedAnswer' => ['@type' => 'Answer', 'text' => $a]];
    return ['@context' => 'https://schema.org', '@type' => 'FAQPage', 'mainEntity' => $e];
}

function crumbs_html(string $root, array $items): string
{
    $o = '<ol class="crumbs"><li><a href="' . $root . '">Главная</a></li><li><a href="' . $root . 'zapchasti/">Запчасти</a></li>';
    $last = array_pop($items);
    foreach ($items as [$n, $u]) $o .= '<li><a href="' . $u . '">' . h($n) . '</a></li>';
    return $o . '<li aria-current="page">' . h($last[0]) . '</li></ol>';
}

function crumbs_ld(string $base, array $items): array
{
    $list = [['Главная', $base . '/'], ['Запчасти', $base . '/zapchasti/']];
    foreach ($items as [$n, $u]) $list[] = [$n, $u];
    $e = [];
    foreach ($list as $i => [$n, $u]) $e[] = ['@type' => 'ListItem', 'position' => $i + 1, 'name' => $n, 'item' => $u];
    return ['@context' => 'https://schema.org', '@type' => 'BreadcrumbList', 'itemListElement' => $e];
}

function list_ld(string $base, string $name, string $url, string $desc, array $cards): array
{
    $e = [];
    foreach (array_slice($cards, 0, 100) as $i => $c) {
        if ($c['href'] === '') continue;
        $e[] = ['@type' => 'ListItem', 'position' => $i + 1, 'url' => $base . '/' . $c['href'], 'name' => trim($c['name'] . ' ' . $c['brandName'] . ' ' . $c['pn'])];
    }
    return ['@context' => 'https://schema.org', '@type' => 'CollectionPage', 'name' => $name, 'url' => $url, 'description' => $desc,
        'isPartOf' => ['@id' => $base . '/#website'], 'mainEntity' => ['@type' => 'ItemList', 'numberOfItems' => count($cards), 'itemListElement' => $e]];
}

function photo_cta(string $root, string $line): string
{
    $cam = '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M8 21h9l4-6h22l4 6h9v28H8z"/><circle cx="32" cy="34" r="9"/></svg>';
    return '<a class="phcta" href="' . $root . 'podbor-po-foto/">' . $cam . '<span><b>Не знаете артикул?</b>' . h($line) . '</span><i>Подбор по фото →</i></a>';
}

function common_faq(string $what): array
{
    return [
        ["Как найти артикул детали ($what)?", 'Артикул указан на самой детали, на её наклейке или на шильдике лифта. Если его не видно, сфотографируйте деталь и шильдик и отправьте через подбор по фото — инженер определит обозначение.'],
        ['Поставляете оригинал или аналоги?', 'Подбираем оригинальную деталь или проверенный аналог. Что именно возможно по вашему артикулу, говорим при проверке совместимости, до оплаты.'],
        ['Как быстро можно получить деталь?', 'По Москве — 1–2 дня, срочно — в день подтверждения при наличии. По России — 3–10 дней транспортной компанией.'],
        ['Что делать, если деталь не подошла?', 'Мы проверяем совместимость до оплаты, поэтому такое случается редко. Если случилось — заменим.'],
    ];
}

function steps_html(string $what): string
{
    return '<ol class="bp-steps"><li><b>1</b><span>Найдите обозначение на старой детали или на шильдике лифта.</span></li>'
        . '<li><b>2</b><span>Введите его в поиск каталога или пришлите фото — подбор по фото.</span></li>'
        . '<li><b>3</b><span>Мы сверим совместимость' . ($what !== '' ? ' (' . h($what) . ')' : '') . ' и пришлём цену и срок. Оплата — после подтверждения.</span></li></ol>';
}

function dept_html(array $cards, string $root): string
{
    $by = [];
    foreach ($cards as $c) $by[$c['cat']][] = $c;
    $secs = pages_content()['sections'];
    $o = '<section class="dept dept-dvizhenie bp-dept"><div class="esc-sects">';
    foreach (GL_CATS as $slug => $name) {
        if (empty($by[$slug])) continue;
        $n = count($by[$slug]);
        $o .= '<article class="esc-s" id="' . $slug . '"><h3>' . h($secs[$slug]['name'] ?? $name) . '</h3><p class="it">' . $n . ' ' . plural_pos($n) . ' · по запросу</p>'
            . '<div class="grid esc-grid">' . "\n" . cards_for($by[$slug], $root) . '</div></article>';
    }
    return $o . '</div></section>';
}

function brand_tile(string $root, string $href, string $name, string $sub, int $n): string
{
    return '<a class="bp-tile" href="' . $root . $href . '"><b>' . h($name) . '</b><span>' . h($sub) . '</span><em>' . $n . ' ' . plural_pos($n) . '</em></a>';
}

function build_pages(): array
{
    $log = [];
    $sh = pages_shell();
    $cards = catalog_cards();
    if (!$sh || !$cards) return ['Страницы марок: нет оболочки или карточек каталога — пропущено.'];
    $C = pages_content();
    $base = site_base();
    $all = [];                                   // для карты сайта и поиска: [url-path => [title, kind]]

    $byBrand = []; $bySec = [];
    foreach ($cards as $c) { $byBrand[$c['brand']][] = $c; $bySec[$c['cat']][] = $c; }

    /* ---- страницы марок ---- */
    foreach ($C['brands'] as $slug => $b) {
        $list = $byBrand[$slug] ?? [];
        if (!$list) continue;
        $n = count($list);
        $cnt = [];
        foreach ($list as $c) $cnt[$c['cat']] = ($cnt[$c['cat']] ?? 0) + 1;
        $parts = [];
        foreach (GL_CATS as $cs => $cn) if (!empty($cnt[$cs])) $parts[] = mb_strtolower($C['sections'][$cs]['name'] ?? $cn, 'UTF-8') . ' — ' . $cnt[$cs];
        $stat = 'В каталоге GeniLift — ' . $n . ' ' . plural_pos($n) . ' ' . $b['name'] . ': ' . implode(', ', $parts) . '.';
        $title = 'Запчасти ' . $b['name'] . ' для лифтов — каталог и подбор по фото | GeniLift';
        $desc = 'Запчасти ' . $b['name'] . ': ' . implode(', ', array_map(fn($k) => mb_strtolower($C['sections'][$k]['name'] ?? GL_CATS[$k], 'UTF-8'), array_keys($cnt))) . '. ' . $n . ' ' . plural_pos($n) . ' в каталоге. Подбор по артикулу или по фото шильдика, доставка по Москве и России.';
        $root = '../../';
        $qa = common_faq($b['name']);
        $chips = '<nav class="bp-chips" aria-label="Разделы">';
        foreach ($cnt as $cs => $k) $chips .= '<a href="#' . $cs . '">' . h($C['sections'][$cs]['name'] ?? GL_CATS[$cs]) . '<em>' . $k . '</em></a>';
        $chips .= '</nav>';
        $others = '';
        foreach ($C['brands'] as $os => $ob) if ($os !== $slug && !empty($byBrand[$os])) $others .= '<a href="' . $root . 'brendy/' . $os . '/">' . h($ob['name']) . '</a>';
        $main = '<div class="wrap">' . crumbs_html($root, [['Марки', $root . 'brendy/'], [$b['name'], '']])
            . '<div class="psign" data-fade><div class="mx-head"><span class="ps-k">Марка</span><h1 class="ps-t">' . h($b['name']) . '</h1></div><span class="mx-bar"></span><p class="mx-sub">' . h($b['about']) . '</p></div>'
            . '<p class="bp-stat">' . h($stat) . '</p>' . $chips
            . photo_cta($root, 'Пришлите фото шильдика или детали ' . $b['name'] . ' — подберём сами.')
            . '</div>' . dept_html($list, $root)
            . '<div class="wrap"><section class="bp-help"><h2 class="h3 bp-h">Как подобрать деталь ' . h($b['name']) . '</h2>' . ($b['find'] !== '' ? '<p class="bp-find">' . h($b['find']) . '</p>' : '') . steps_html('') . '</section>'
            . '<section class="del-faq"><h2 class="h3 bp-h">Вопросы о деталях ' . h($b['name']) . '</h2>' . faq_html($qa) . '</section>'
            . $sh['cta']
            . '<nav class="bp-others" aria-label="Другие марки"><p>Другие марки</p>' . $others . '<a href="' . $root . 'brendy/">Все марки и разделы →</a></nav></div>';
        $ld = [crumbs_ld($base, [['Марки', $base . '/brendy/'], [$b['name'], $base . '/brendy/' . $slug . '/']]),
               list_ld($base, 'Запчасти ' . $b['name'], $base . '/brendy/' . $slug . '/', $desc, $list), faq_ld($qa)];
        wr('brendy/' . $slug . '/index.html', pages_render($sh, $root, 'brendy/' . $slug . '/', $title, $desc, $main, $ld));
        $all['brendy/' . $slug . '/'] = ['Запчасти ' . $b['name'], 'Марка'];
    }

    /* ---- страницы разделов ---- */
    foreach ($C['sections'] as $slug => $s) {
        $list = $bySec[$slug] ?? [];
        if (!$list) continue;
        $n = count($list);
        $cnt = [];
        foreach ($list as $c) $cnt[$c['brand']] = ($cnt[$c['brand']] ?? 0) + 1;
        $nm = mb_strtolower($s['name'], 'UTF-8');
        $title = $s['name'] . ' для лифтов — купить, подбор по фото | GeniLift';
        $desc = $s['lead'] . '. ' . $n . ' ' . plural_pos($n) . ' в каталоге. Подбор по артикулу или по фото шильдика, доставка по Москве и России.';
        $root = '../../';
        $chips = '<nav class="bp-chips" aria-label="Марки">';
        foreach ($cnt as $bs => $k) {
            $bn = $C['brands'][$bs]['name'] ?? (GL_BRANDS[$bs] ?? $bs);
            $chips .= isset($C['brands'][$bs]) ? '<a href="' . $root . 'brendy/' . $bs . '/">' . h($bn) . '<em>' . $k . '</em></a>' : '<span>' . h($bn) . '<em>' . $k . '</em></span>';
        }
        $chips .= '</nav>';
        $qa = common_faq($nm);
        $others = '';
        foreach ($C['sections'] as $os => $o2) if ($os !== $slug && !empty($bySec[$os])) $others .= '<a href="' . $root . 'razdely/' . $os . '/">' . h($o2['name']) . '</a>';
        $main = '<div class="wrap">' . crumbs_html($root, [['Разделы', $root . 'brendy/#razdely'], [$s['name'], '']])
            . '<div class="psign" data-fade><div class="mx-head"><span class="ps-k">Раздел каталога</span><h1 class="ps-t">' . h($s['name']) . '</h1></div><span class="mx-bar"></span><p class="mx-sub">' . h($s['about']) . '</p></div>'
            . '<p class="bp-stat">' . h($s['pick']) . '</p>' . $chips
            . photo_cta($root, 'Пришлите фото детали или шильдика — определим артикул и совместимость.')
            . '</div>' . dept_html($list, $root)
            . '<div class="wrap"><section class="bp-help"><h2 class="h3 bp-h">Как подобрать: ' . h($nm) . '</h2>' . steps_html('') . '</section>'
            . '<section class="del-faq"><h2 class="h3 bp-h">Вопросы: ' . h($nm) . '</h2>' . faq_html($qa) . '</section>'
            . $sh['cta']
            . '<nav class="bp-others" aria-label="Другие разделы"><p>Другие разделы</p>' . $others . '<a href="' . $root . 'brendy/">Все марки и разделы →</a></nav></div>';
        $ld = [crumbs_ld($base, [['Разделы', $base . '/brendy/#razdely'], [$s['name'], $base . '/razdely/' . $slug . '/']]),
               list_ld($base, $s['name'], $base . '/razdely/' . $slug . '/', $desc, $list), faq_ld($qa)];
        wr('razdely/' . $slug . '/index.html', pages_render($sh, $root, 'razdely/' . $slug . '/', $title, $desc, $main, $ld));
        $all['razdely/' . $slug . '/'] = [$s['name'] . ' для лифтов', 'Раздел'];
    }

    /* ---- общая страница «Марки и разделы» ---- */
    $root = '../';
    $bt = '<div class="bp-tiles">';
    foreach ($C['brands'] as $slug => $b) if (!empty($byBrand[$slug])) $bt .= brand_tile($root, 'brendy/' . $slug . '/', $b['name'], 'Запчасти ' . $b['name'], count($byBrand[$slug]));
    $bt .= '</div>';
    $st = '<div class="bp-tiles">';
    foreach ($C['sections'] as $slug => $s) if (!empty($bySec[$slug])) $st .= brand_tile($root, 'razdely/' . $slug . '/', $s['name'], $s['lead'], count($bySec[$slug]));
    $st .= '</div>';
    $title = 'Запчасти для лифтов по маркам и разделам | GeniLift';
    $desc = 'Запчасти для лифтов KONE, OTIS, Schindler, Hitachi, Mitsubishi, ThyssenKrupp, Hyundai и других марок: платы управления, канаты, башмаки, выключатели, энкодеры. Подбор по артикулу и по фото.';
    $main = '<div class="wrap">' . crumbs_html($root, [['Марки и разделы', '']])
        . '<div class="psign" data-fade><div class="mx-head"><span class="ps-k">Каталог</span><h1 class="ps-t">Марки и разделы</h1></div><span class="mx-bar"></span><p class="mx-sub">Выберите марку лифта или тип детали. Не знаете — подберём по фото шильдика.</p></div>'
        . photo_cta($root, 'Пришлите фото шильдика или детали — подберём сами.')
        . '<section class="bp-block"><h2 class="h3 bp-h">Марки</h2>' . $bt . '</section>'
        . '<section class="bp-block" id="razdely"><h2 class="h3 bp-h">Разделы каталога</h2>' . $st . '</section>'
        . $sh['cta'] . '</div>';
    $ld = [crumbs_ld($base, [['Марки и разделы', $base . '/brendy/']])];
    wr('brendy/index.html', pages_render($sh, $root, 'brendy/', $title, $desc, $main, $ld));
    $all['brendy/'] = ['Запчасти для лифтов по маркам и разделам', 'Каталог'];

    /* ---- карта сайта и поиск ---- */
    $sm = rd('sitemap.xml');
    if ($sm !== '') {
        $o = $sm;
        $sm = preg_replace('~[ \t]*<url><loc>' . preg_quote($base, '~') . '/(?:brendy|razdely)/[^<]*</loc></url>\n?~', '', $sm) ?? $sm;
        $add = '';
        foreach (array_keys($all) as $u) $add .= '  <url><loc>' . $base . '/' . $u . '</loc></url>' . "\n";
        $sm = preg_replace('~</urlset>~', $add . '</urlset>', $sm, 1) ?? $sm;
        if ($sm !== $o) wr('sitemap.xml', $sm);
    }
    $sj = json_decode(rd('assets/search.json'), true);
    if (is_array($sj) && isset($sj['s'])) {
        $keep = array_values(array_filter($sj['s'], fn($e) => empty($e['g2'])));
        foreach ($all as $u => [$t, $k]) $keep[] = ['t' => $t, 'u' => $u, 'k' => $k, 'g2' => 1];
        $sj['s'] = $keep;
        wr('assets/search.json', json_encode($sj, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    }
    $log[] = 'Страницы марок и разделов: ' . count($all) . '.';
    return $log;
}
