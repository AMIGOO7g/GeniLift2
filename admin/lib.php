<?php
/* GeniLift — админка каталога: ядро (пути, хранилище, вход, защита форм). Без внешних библиотек, PHP 7.4+ */
declare(strict_types=1);

define('GL_ROOT', dirname(__DIR__));
define('GL_DATA', __DIR__ . '/data');
define('GL_GUARD', "<?php http_response_code(404); exit; ?>\n");

/* Разделы каталога (лифты) и марки — как в zapchasti/index.html */
const GL_CATS = [
    'platy-upravleniya' => 'Платы управления', 'kanaty' => 'Канаты', 'tsepi' => 'Компенсационные цепи',
    'bashmaki' => 'Башмаки', 'vyklyuchateli' => 'Выключатели', 'enkodery' => 'Энкодеры',
    'knopki-i-posty' => 'Кнопки и посты', 'roliki-i-kolesa' => 'Ролики и колёса',
    'instrumenty' => 'Инструменты', 'drugoe' => 'Другое',
];
const GL_BRANDS = [
    'hitachi' => 'Hitachi', 'kone' => 'KONE', 'otis' => 'OTIS', 'lg-sigma' => 'LG Sigma', 'mitsubishi' => 'Mitsubishi',
    'thyssenkrupp' => 'ThyssenKrupp', 'hyundai' => 'Hyundai', 'schindler' => 'Schindler', 'gustav-wolf' => 'Gustav Wolf',
    'draka' => 'Draka', 'fujitec' => 'Fujitec', 'drugie' => 'Другие марки',
];
const GL_AVAIL = ['По запросу', 'В наличии', 'Под заказ'];
const GL_KNOWN_COLS = ['sku', 'brand', 'category', 'subcategory', 'group', 'name_ru', 'short', 'description', 'compatibility', 'specs', 'photo', 'availability', 'price', 'published', 'featured', 'new', 'sort'];
const GL_EXPORT_COLS = ['sku', 'brand', 'category', 'subcategory', 'group', 'name_ru', 'name_en', 'short', 'description', 'compatibility', 'specs', 'photo', 'photo_2', 'photo_3', 'doc', 'availability', 'condition', 'price', 'published', 'featured', 'new', 'sort', 'source_page'];

function h($s): string { return htmlspecialchars((string)$s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }

/* ---------- Хранилище: JSON, закрытый от прямого открытия в браузере ---------- */
function jread(string $name, $def = [])
{
    $f = GL_DATA . "/$name.json.php";
    if (!is_file($f)) return $def;
    $s = (string)file_get_contents($f);
    $p = strpos($s, "\n");
    $j = json_decode($p === false ? '' : substr($s, $p + 1), true);
    return $j === null ? $def : $j;
}
function jwrite(string $name, $v): void
{
    if (!is_dir(GL_DATA)) @mkdir(GL_DATA, 0750, true);
    $f = GL_DATA . "/$name.json.php";
    $tmp = $f . '.' . getmypid() . '.tmp';
    file_put_contents($tmp, GL_GUARD . json_encode($v, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT), LOCK_EX);
    rename($tmp, $f);
}
/* копия перед каждой записью каталога: последние 30 */
function backup_products(): void
{
    $f = GL_DATA . '/products.json.php';
    if (!is_file($f)) return;
    $d = GL_DATA . '/backup';
    if (!is_dir($d)) @mkdir($d, 0750, true);
    @copy($f, $d . '/products-' . date('Ymd-His') . '.json.php');
    $all = glob($d . '/products-*.json.php') ?: [];
    sort($all);
    foreach (array_slice($all, 0, max(0, count($all) - 30)) as $old) @unlink($old);
}

/* ---------- Сессия, вход, CSRF ---------- */
function boot(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) return;
    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
    session_name('gl_admin');
    session_set_cookie_params(['lifetime' => 0, 'path' => '/', 'secure' => $https, 'httponly' => true, 'samesite' => 'Lax']);
    session_start();
    header('X-Robots-Tag: noindex, nofollow');
    header('X-Frame-Options: DENY');
    header('Referrer-Policy: same-origin');
    header('Cache-Control: no-store');
}
function csrf(): string
{
    if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(16));
    return $_SESSION['csrf'];
}
function csrf_field(): string { return '<input type="hidden" name="_t" value="' . h(csrf()) . '">'; }
function csrf_ok(): bool { return !empty($_POST['_t']) && hash_equals(csrf(), (string)$_POST['_t']); }
function logged_in(): bool { return !empty($_SESSION['ok']); }

function cfg(): array { return jread('config', []); }
function setup_code_file(): string { return GL_DATA . '/setup-code.php'; }
function setup_code(): string
{
    $f = setup_code_file();
    if (!is_file($f)) {
        if (!is_dir(GL_DATA)) @mkdir(GL_DATA, 0750, true);
        file_put_contents($f, "<?php exit; /* КОД УСТАНОВКИ: " . strtoupper(bin2hex(random_bytes(4))) . " */\n");
    }
    return preg_match('/КОД УСТАНОВКИ: (\w+)/', (string)file_get_contents($f), $m) ? $m[1] : '';
}

/* не больше 5 неудачных попыток за 15 минут с одного адреса */
function throttle_blocked(): bool
{
    $a = jread('attempts', []);
    $k = hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? '') . 'gl');
    $now = time();
    $list = array_values(array_filter($a[$k] ?? [], fn($t) => $t > $now - 900));
    return count($list) >= 5;
}
function throttle_fail(): void
{
    $a = jread('attempts', []);
    $k = hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? '') . 'gl');
    $now = time();
    foreach ($a as $kk => $l) { $a[$kk] = array_values(array_filter($l, fn($t) => $t > $now - 900)); if (!$a[$kk]) unset($a[$kk]); }
    $a[$k][] = $now;
    jwrite('attempts', $a);
}

/* ---------- Мелкие помощники ---------- */
function translit(string $s): string
{
    static $m = ['а'=>'a','б'=>'b','в'=>'v','г'=>'g','д'=>'d','е'=>'e','ё'=>'e','ж'=>'zh','з'=>'z','и'=>'i','й'=>'y','к'=>'k','л'=>'l','м'=>'m','н'=>'n','о'=>'o','п'=>'p','р'=>'r','с'=>'s','т'=>'t','у'=>'u','ф'=>'f','х'=>'h','ц'=>'ts','ч'=>'ch','ш'=>'sh','щ'=>'sch','ъ'=>'','ы'=>'y','ь'=>'','э'=>'e','ю'=>'yu','я'=>'ya'];
    return strtr(mb_strtolower($s, 'UTF-8'), $m);
}
function slugify(string $s): string
{
    $s = translit($s);
    $s = preg_replace('/[^a-z0-9]+/', '-', $s) ?? '';
    return trim($s, '-');
}
function brand_slug(string $brand): string
{
    foreach (GL_BRANDS as $k => $n) if (mb_strtolower($n, 'UTF-8') === mb_strtolower(trim($brand), 'UTF-8')) return $k;
    return 'drugie';
}
function cat_slug(string $name): string
{
    foreach (GL_CATS as $k => $n) if (mb_strtolower($n, 'UTF-8') === mb_strtolower(trim($name), 'UTF-8')) return $k;
    return isset(GL_CATS[$name]) ? $name : 'drugoe';
}
function norm_avail(string $s): string
{
    $l = mb_strtolower($s, 'UTF-8');
    if (strpos($l, 'налич') !== false && strpos($l, 'нет') === false) return 'В наличии';
    if (strpos($l, 'заказ') !== false && strpos($l, 'по запрос') === false) return 'Под заказ';
    return 'По запросу';
}
/* текстовые поля, которые попадают в HTML и в JSON-атрибуты: без угловых скобок и кавычек */
function clean(string $s, int $max = 300): string
{
    $s = trim(preg_replace('/[\x00-\x1F\x7F]+/u', ' ', $s) ?? '');
    $s = str_replace(['<', '>', '"', "'", '\\', '`'], ['', '', '″', '’', '/', ''], $s);
    return mb_substr($s, 0, $max, 'UTF-8');
}
function clean_long(string $s, int $max = 3000): string
{
    $s = trim(str_replace("\r", '', $s));
    $s = str_replace(['<', '>', '"', "'", '\\', '`'], ['', '', '″', '’', '/', ''], $s);
    return mb_substr($s, 0, $max, 'UTF-8');
}
function to_price($v): ?int
{
    $s = preg_replace('/[^\d,.]/', '', str_replace(["\xC2\xA0", ' '], '', (string)$v)) ?? '';
    if ($s === '') return null;
    $s = str_replace(',', '.', $s);
    $n = (int)round((float)$s);
    return $n > 0 ? $n : null;
}
function to_bool($v, bool $def = true): bool
{
    if ($v === null || $v === '') return $def;
    if (is_bool($v)) return $v;
    $l = mb_strtolower(trim((string)$v), 'UTF-8');
    if (in_array($l, ['1', 'true', 'да', 'yes', 'y', 'истина', '+'], true)) return true;
    if (in_array($l, ['0', 'false', 'нет', 'no', 'n', 'ложь', '-'], true)) return false;
    return $def;
}
function flash(string $m, string $kind = 'ok'): void { $_SESSION['flash'][] = [$kind, $m]; }
function redirect(string $q = ''): void { header('Location: ./' . $q); exit; }

/* ---------- Каталог ---------- */
function skus_index(): array
{
    static $x = null;
    if ($x === null) $x = json_decode((string)@file_get_contents(GL_ROOT . '/assets/skus.json'), true) ?: [];
    return $x;
}
function products(): array
{
    $p = jread('products', null);
    if ($p === null) { $p = seed_products(); jwrite('products', $p); }
    return $p;
}
function save_products(array $p): void { backup_products(); jwrite('products', $p); }

function blank_product(): array
{
    return ['sku' => '', 'brand' => '', 'category' => 'Другое', 'subcategory' => '', 'group' => '', 'name_ru' => '', 'short' => '',
        'description' => '', 'compatibility' => '', 'specs' => '', 'photo' => '', 'availability' => 'По запросу', 'price' => null,
        'published' => true, 'featured' => false, 'new' => false, 'sort' => 100, 'slug' => '', 'legacy' => false, 'src' => 'admin', 'updated' => 0, 'extra' => []];
}
/* первый запуск: каталог из catalog/products.xlsx; страницы для них уже есть на сайте (legacy) */
function seed_products(): array
{
    require_once __DIR__ . '/xlsx.php';
    $out = [];
    $f = GL_ROOT . '/catalog/products.xlsx';
    if (!is_file($f)) return $out;
    $sk = skus_index();
    foreach (xlsx_rows($f) as $r) {
        $p = row_to_product($r, blank_product());
        if ($p['sku'] === '') continue;
        $p['src'] = 'xlsx';
        if (isset($sk[$p['sku']])) {
            $p['legacy'] = true; $p['slug'] = (string)$sk[$p['sku']][0];
            $pg = GL_ROOT . '/zapchasti/' . $p['slug'] . '/index.html';                     // раздел — как на самой странице сайта
            if (is_file($pg) && preg_match('~\?cat=([a-z0-9-]+)"~', (string)file_get_contents($pg), $m) && isset(GL_CATS[$m[1]])) $p['category'] = GL_CATS[$m[1]];
        }
        $out[$p['sku']] = $p;
    }
    return $out;
}
/* строка Excel/CSV (заголовки как в products.xlsx) → поля товара; пустые ячейки не затирают старые значения */
function row_to_product(array $r, array $base): array
{
    $g = fn(string $k) => array_key_exists($k, $r) && trim((string)$r[$k]) !== '' ? trim((string)$r[$k]) : null;
    $p = $base;
    if (($v = $g('sku')) !== null) $p['sku'] = clean($v, 80);
    if (($v = $g('brand')) !== null) $p['brand'] = clean($v, 60);
    if (($v = $g('category')) !== null) $p['category'] = GL_CATS[cat_slug($v)];
    foreach (['subcategory' => 80, 'group' => 80, 'name_ru' => 200, 'short' => 400] as $k => $m) if (($v = $g($k)) !== null) $p[$k] = clean($v, $m);
    foreach (['description' => 3000, 'compatibility' => 1500, 'specs' => 2000] as $k => $m) if (($v = $g($k)) !== null) $p[$k] = clean_long($v, $m);
    if (($v = $g('photo')) !== null) $p['photo'] = preg_replace('/[^A-Za-z0-9._-]+/', '_', basename($v)) ?? '';
    if (($v = $g('availability')) !== null) $p['availability'] = norm_avail($v);
    if (($v = $g('price')) !== null) $p['price'] = to_price($v);
    if (($v = $g('published')) !== null) $p['published'] = to_bool($v, true);
    if (($v = $g('featured')) !== null) $p['featured'] = to_bool($v, false);
    if (($v = $g('new')) !== null) $p['new'] = to_bool($v, false);
    if (($v = $g('sort')) !== null) $p['sort'] = (int)$v;
    foreach ($r as $k => $v) {                                   // прочие столбцы Excel (name_en, photo_2, doc …) храним и отдаём при экспорте
        if (in_array($k, GL_KNOWN_COLS, true) || trim((string)$v) === '') continue;
        $p['extra'][$k] = clean((string)$v, 500);
    }
    return $p;
}
/* подпись типа детали: «Плата управления», «Лифтовый канат» … */
function type_label(array $p): string
{
    if ($p['subcategory'] !== '') return $p['subcategory'];
    return (string)$p['category'];
}
function product_title(array $p): string
{
    if ($p['name_ru'] !== '') return $p['name_ru'];
    return trim(type_label($p) . ' ' . $p['brand'] . ' ' . $p['sku']);
}
function free_slug(array $all, string $sku, string $brand, string $own = ''): string
{
    $base = slugify($brand . ' ' . $sku);
    if ($base === '') $base = 'part';
    $used = [];
    foreach ($all as $q) if ($q['slug'] !== '' && $q['sku'] !== $sku) $used[$q['slug']] = 1;
    foreach (skus_index() as $v) $used[(string)$v[0]] = 1;
    $s = $base; $i = 2;
    while (isset($used[$s]) || (is_dir(GL_ROOT . "/zapchasti/$s") && $s !== $own)) { $s = $base . '-' . $i++; }
    return $s;
}
