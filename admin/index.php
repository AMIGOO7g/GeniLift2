<?php
/* GeniLift — админка каталога для владельца: вход, товары, импорт/экспорт Excel, публикация на сайт */
declare(strict_types=1);
require __DIR__ . '/lib.php';
require __DIR__ . '/xlsx.php';
require __DIR__ . '/build.php';

@set_time_limit(120);
boot();
$a = (string)($_GET['a'] ?? 'list');
$post = $_SERVER['REQUEST_METHOD'] === 'POST';

/* ---------- оболочка страницы ---------- */
function view(string $title, string $body, bool $nav = true): void
{
    $fl = '';
    foreach ($_SESSION['flash'] ?? [] as [$k, $m]) $fl .= '<p class="fl fl-' . h($k) . '" role="status">' . h($m) . '</p>';
    unset($_SESSION['flash']);
    echo '<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow">'
        . '<title>' . h($title) . ' — GeniLift</title><link rel="stylesheet" href="admin.css?v=1"></head><body>';
    if ($nav) {
        echo '<header class="top"><a class="logo" href="./">GeniLift <span>каталог</span></a><nav>'
            . '<a href="./">Товары</a><a href="?a=edit">+ Добавить</a><a href="?a=import">Импорт Excel</a><a href="?a=export">Экспорт</a><a href="?a=password">Пароль</a>'
            . '<a href="../" target="_blank" rel="noopener">Открыть сайт ↗</a>'
            . '<form method="post" action="?a=logout" class="inl">' . csrf_field() . '<button class="lnk">Выйти</button></form></nav></header>';
    }
    echo '<main class="wrap">' . $fl . $body . '</main></body></html>';
    exit;
}
function need_login(): void { if (!logged_in()) redirect('?a=login'); }
function need_post(): void { global $post; if (!$post || !csrf_ok()) { flash('Сессия устарела — повторите действие.', 'err'); redirect(); } }

/* ---------- вход и первая настройка ---------- */
$conf = cfg();
if (empty($conf['pass_hash'])) {
    $code = setup_code();
    $err = '';
    if ($post && csrf_ok()) {
        $pw = (string)($_POST['pw'] ?? '');
        if (!hash_equals($code, strtoupper(trim((string)($_POST['code'] ?? ''))))) $err = 'Неверный код установки.';
        elseif (mb_strlen($pw) < 8) $err = 'Пароль — не короче 8 символов.';
        elseif ($pw !== (string)($_POST['pw2'] ?? '')) $err = 'Пароли не совпадают.';
        else {
            $conf['pass_hash'] = password_hash($pw, PASSWORD_DEFAULT);
            jwrite('config', $conf);
            @unlink(setup_code_file());
            session_regenerate_id(true);
            $_SESSION['ok'] = 1;
            flash('Пароль задан. Каталог загружен из catalog/products.xlsx.');
            redirect();
        }
    }
    view('Первая настройка', '<section class="card narrow"><h1>Первая настройка</h1>'
        . '<p>Задайте пароль владельца. Код установки лежит на сервере в файле <code>admin/data/setup-code.php</code> — откройте его через FTP или файловый менеджер хостинга.</p>'
        . ($err ? '<p class="fl fl-err">' . h($err) . '</p>' : '')
        . '<form method="post">' . csrf_field()
        . '<label>Код установки<input name="code" autocomplete="off" required></label>'
        . '<label>Новый пароль (от 8 символов)<input name="pw" type="password" autocomplete="new-password" required></label>'
        . '<label>Повторите пароль<input name="pw2" type="password" autocomplete="new-password" required></label>'
        . '<button class="btn">Сохранить и войти</button></form></section>', false);
}
if ($a === 'login') {
    $err = '';
    if ($post && csrf_ok()) {
        if (throttle_blocked()) $err = 'Слишком много попыток. Подождите 15 минут.';
        elseif (password_verify((string)($_POST['pw'] ?? ''), (string)$conf['pass_hash'])) {
            session_regenerate_id(true);
            $_SESSION['ok'] = 1;
            if (password_needs_rehash((string)$conf['pass_hash'], PASSWORD_DEFAULT)) { $conf['pass_hash'] = password_hash((string)$_POST['pw'], PASSWORD_DEFAULT); jwrite('config', $conf); }
            redirect();
        } else { throttle_fail(); $err = 'Неверный пароль.'; }
    }
    view('Вход', '<section class="card narrow"><h1>Вход в каталог</h1>' . ($err ? '<p class="fl fl-err">' . h($err) . '</p>' : '')
        . '<form method="post" action="?a=login">' . csrf_field() . '<label>Пароль<input name="pw" type="password" autocomplete="current-password" autofocus required></label><button class="btn">Войти</button></form></section>', false);
}
if ($a === 'logout') { need_post(); $_SESSION = []; session_destroy(); header('Location: ./?a=login'); exit; }
need_login();

/* ---------- фото: сжатие и сохранение в assets/parts ---------- */
function save_photo(array $f, array $p): ?string
{
    if (($f['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) return null;
    if ($f['error'] !== UPLOAD_ERR_OK || !is_uploaded_file($f['tmp_name']) || $f['size'] > 10 * 1048576) throw new RuntimeException('Фото не загрузилось (до 10 МБ).');
    $info = @getimagesize($f['tmp_name']);
    if (!$info || !in_array($info[2], [IMAGETYPE_JPEG, IMAGETYPE_PNG, IMAGETYPE_WEBP, IMAGETYPE_GIF], true)) throw new RuntimeException('Нужно изображение JPG, PNG или WebP.');
    if (!function_exists('imagecreatefromstring')) throw new RuntimeException('На сервере нет расширения GD — фото не обработать.');
    $im = @imagecreatefromstring((string)file_get_contents($f['tmp_name']));
    if (!$im) throw new RuntimeException('Не удалось прочитать изображение.');
    if ($info[2] === IMAGETYPE_JPEG && function_exists('exif_read_data')) {      // повернуть снимок с телефона
        $ex = @exif_read_data($f['tmp_name']);
        $o = (int)($ex['Orientation'] ?? 1);
        if ($o === 3) $im = imagerotate($im, 180, 0) ?: $im;
        elseif ($o === 6) $im = imagerotate($im, -90, 0) ?: $im;
        elseif ($o === 8) $im = imagerotate($im, 90, 0) ?: $im;
    }
    $w = imagesx($im); $hh = imagesy($im); $S = 800;
    $k = min($S / $w, $S / $hh, 1.0) ;
    $nw = max(1, (int)round($w * $k)); $nh = max(1, (int)round($hh * $k));
    $cv = imagecreatetruecolor($S, $S);
    imagefill($cv, 0, 0, imagecolorallocate($cv, 255, 255, 255));
    imagecopyresampled($cv, $im, intdiv($S - $nw, 2), intdiv($S - $nh, 2), 0, 0, $nw, $nh, $w, $hh);
    $base = $p['photo'] !== '' ? preg_replace('/\.\w+$/', '', $p['photo']) : (preg_replace('/[^A-Za-z0-9._-]+/', '_', $p['sku']) ?: 'part');
    $dir = GL_ROOT . '/assets/parts';
    if (!is_dir($dir)) @mkdir($dir, 0755, true);
    if (function_exists('imagewebp')) { $name = $base . '.webp'; imagewebp($cv, "$dir/$name", 85); }
    else { $name = $base . '.jpg'; imagejpeg($cv, "$dir/$name", 88); }
    return $name;
}

/* ---------- сохранение товара ---------- */
if ($a === 'save') {
    need_post();
    $all = products();
    $in = $_POST['f'] ?? [];
    $orig = (string)($_POST['orig'] ?? '');
    $isNew = $orig === '' || !isset($all[$orig]);
    $p = $isNew ? blank_product() : $all[$orig];
    $err = [];
    if ($isNew || !$p['legacy']) {
        $sku = clean((string)($in['sku'] ?? ''), 80);
        $sku = str_replace('/', '-', $sku);
        $brand = clean((string)($in['brand'] ?? ''), 60);
        if ($sku === '') $err[] = 'Укажите артикул.';
        if ($brand === '') $err[] = 'Укажите марку (производителя).';
        if ($sku !== '' && $sku !== $orig && (isset($all[$sku]) || isset(skus_index()[$sku]))) $err[] = "Артикул «{$sku}» уже есть в каталоге.";
        $p['sku'] = $sku; $p['brand'] = $brand;
        $p['category'] = GL_CATS[cat_slug((string)($in['category'] ?? ''))];
        $p['subcategory'] = clean((string)($in['subcategory'] ?? ''), 80);
    }
    $p['name_ru'] = clean((string)($in['name_ru'] ?? ''), 200);
    $p['short'] = clean((string)($in['short'] ?? ''), 400);
    $p['description'] = clean_long((string)($in['description'] ?? ''), 3000);
    $p['compatibility'] = clean_long((string)($in['compatibility'] ?? ''), 1500);
    $p['specs'] = clean_long((string)($in['specs'] ?? ''), 2000);
    $p['availability'] = in_array($in['availability'] ?? '', GL_AVAIL, true) ? $in['availability'] : 'По запросу';
    $p['price'] = to_price($in['price'] ?? '');
    $p['published'] = !empty($in['published']);
    $p['sort'] = (int)($in['sort'] ?? 100);
    if (!$err) {
        try { if ($ph = save_photo($_FILES['photo'] ?? ['error' => UPLOAD_ERR_NO_FILE], $p)) $p['photo'] = $ph; }
        catch (RuntimeException $e) { $err[] = $e->getMessage(); }
    }
    if ($err) {
        $_SESSION['form'] = ['p' => $p, 'orig' => $orig];
        foreach ($err as $e) flash($e, 'err');
        redirect('?a=edit' . ($orig !== '' ? '&sku=' . rawurlencode($orig) : '') . '&keep=1');
    }
    if ($isNew) { $p['slug'] = free_slug($all, $p['sku'], $p['brand']); $p['src'] = 'admin'; }
    $p['updated'] = time();
    if (!$isNew && $orig !== $p['sku']) unset($all[$orig]);
    $all[$p['sku']] = $p;
    save_products($all);
    $log = build_all();
    flash('Сохранено и опубликовано: ' . $p['sku'] . '. ' . end($log));
    redirect();
}
if ($a === 'toggle') {
    need_post();
    $all = products();
    $k = (string)($_POST['sku'] ?? '');
    if (isset($all[$k])) { $all[$k]['published'] = !$all[$k]['published']; $all[$k]['updated'] = time(); save_products($all); build_all(); flash(($all[$k]['published'] ? 'Показан на сайте: ' : 'Скрыт с сайта: ') . $k); }
    redirect('?' . http_build_query(array_filter(['q' => $_POST['q'] ?? '', 'brand' => $_POST['brand'] ?? '', 'cat' => $_POST['cat'] ?? '', 'st' => $_POST['st'] ?? '', 'pg' => $_POST['pg'] ?? ''])));
}
if ($a === 'delete') {
    need_post();
    $all = products();
    $k = (string)($_POST['sku'] ?? '');
    if (isset($all[$k]) && !$all[$k]['legacy']) { unset($all[$k]); save_products($all); build_all(); flash('Удалён: ' . $k); }
    else flash('Товары, у которых уже есть страница на сайте, не удаляются — их можно скрыть.', 'err');
    redirect();
}
if ($a === 'build') { need_post(); $log = build_all(); flash(implode(' ', $log)); redirect(); }

/* ---------- экспорт ---------- */
if ($a === 'export') {
    $all = products();
    $rows = [];
    foreach ($all as $p) {
        $r = [];
        foreach (GL_EXPORT_COLS as $c) {
            if (isset($p[$c]) && in_array($c, GL_KNOWN_COLS, true)) $v = $p[$c]; else $v = $p['extra'][$c] ?? '';
            if (is_bool($v)) $v = $v ? 'TRUE' : 'FALSE';
            $r[] = $v;
        }
        $rows[] = $r;
    }
    if (($_GET['fmt'] ?? 'xlsx') === 'csv') {
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="genilift-products-' . date('Y-m-d') . '.csv"');
        echo "\xEF\xBB\xBF";
        $o = fopen('php://output', 'w');
        fputcsv($o, GL_EXPORT_COLS, ';', '"', '\\');
        foreach ($rows as $r) fputcsv($o, array_map(fn($v) => (string)$v, $r), ';', '"', '\\');
        exit;
    }
    $tmp = tempnam(sys_get_temp_dir(), 'glx');
    try { xlsx_write($tmp, GL_EXPORT_COLS, $rows); }
    catch (Throwable $e) { flash('Excel не собрался: ' . $e->getMessage() . ' Скачайте CSV.', 'err'); redirect('?a=import'); }
    header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    header('Content-Disposition: attachment; filename="genilift-products-' . date('Y-m-d') . '.xlsx"');
    header('Content-Length: ' . filesize($tmp));
    readfile($tmp); @unlink($tmp); exit;
}

/* ---------- пароль ---------- */
if ($a === 'password') {
    if ($post && csrf_ok()) {
        $pw = (string)($_POST['pw'] ?? '');
        if (!password_verify((string)($_POST['old'] ?? ''), (string)$conf['pass_hash'])) flash('Текущий пароль неверный.', 'err');
        elseif (mb_strlen($pw) < 8 || $pw !== (string)($_POST['pw2'] ?? '')) flash('Новый пароль — от 8 символов, оба поля одинаковые.', 'err');
        else { $conf['pass_hash'] = password_hash($pw, PASSWORD_DEFAULT); jwrite('config', $conf); flash('Пароль изменён.'); redirect(); }
        redirect('?a=password');
    }
    view('Пароль', '<section class="card narrow"><h1>Смена пароля</h1><form method="post">' . csrf_field()
        . '<label>Текущий пароль<input name="old" type="password" autocomplete="current-password" required></label>'
        . '<label>Новый пароль (от 8 символов)<input name="pw" type="password" autocomplete="new-password" required></label>'
        . '<label>Повторите новый пароль<input name="pw2" type="password" autocomplete="new-password" required></label><button class="btn">Изменить</button></form></section>');
}

/* ---------- импорт Excel / CSV: предпросмотр → применить ---------- */
if ($a === 'import') {
    $prev = '';
    if ($post && csrf_ok() && isset($_FILES['file'])) {
        $f = $_FILES['file'];
        try {
            if ($f['error'] !== UPLOAD_ERR_OK || !is_uploaded_file($f['tmp_name']) || $f['size'] > 12 * 1048576) throw new RuntimeException('Файл не загрузился (до 12 МБ).');
            $ext = strtolower(pathinfo((string)$f['name'], PATHINFO_EXTENSION));
            $rows = $ext === 'csv' ? csv_rows($f['tmp_name']) : xlsx_rows($f['tmp_name']);
            if (!$rows) throw new RuntimeException('В файле нет строк с данными.');
            if (!array_key_exists('sku', $rows[0])) throw new RuntimeException('Нет столбца sku (артикул). Скачайте «Экспорт» и используйте его как образец.');
            $all = products();
            $new = $chg = $same = 0; $errs = []; $detail = []; $seen = [];
            $plan = [];
            foreach ($rows as $i => $r) {
                $sku = clean((string)($r['sku'] ?? ''), 80);
                $ln = $i + 2;
                if ($sku === '') { $errs[] = "Строка $ln: пустой артикул."; continue; }
                if (isset($seen[$sku])) { $errs[] = "Строка $ln: артикул «{$sku}» повторяется — берётся последняя строка."; }
                $seen[$sku] = 1;
                if (isset($all[$sku])) {
                    $np = row_to_product($r, $all[$sku]);
                    if ($all[$sku]['legacy']) { foreach (['sku', 'brand', 'category'] as $k) $np[$k] = $all[$sku][$k]; }
                    $diff = [];
                    foreach (['name_ru', 'short', 'description', 'compatibility', 'specs', 'availability', 'price', 'published', 'photo', 'brand', 'category', 'subcategory'] as $k) if ($np[$k] !== $all[$sku][$k]) $diff[] = $k;
                    if ($diff) { $chg++; if (count($detail) < 60) $detail[] = [$sku, 'изменение', implode(', ', $diff)]; $plan[$sku] = $np; } else $same++;
                } else {
                    $np = row_to_product($r, blank_product());
                    if ($np['brand'] === '') { $errs[] = "Строка $ln ($sku): новая позиция без марки (brand) — пропущена."; continue; }
                    if (isset(skus_index()[$sku])) { $errs[] = "Строка $ln ($sku): такой артикул уже есть на сайте, но не в каталоге — пропущена."; continue; }
                    $new++; if (count($detail) < 60) $detail[] = [$sku, 'новая', $np['brand'] . ' · ' . $np['category']]; $plan[$sku] = $np;
                }
            }
            $tok = bin2hex(random_bytes(8));
            jwrite('import-' . $tok, $plan);
            $_SESSION['imp'] = $tok;
            $prev = '<section class="card"><h2>Предпросмотр импорта</h2><p>Новых товаров: <b>' . $new . '</b>. Изменений: <b>' . $chg . '</b>. Без изменений: <b>' . $same . '</b>.'
                . ($errs ? ' Предупреждений: <b>' . count($errs) . '</b>.' : '') . '</p>';
            if ($errs) $prev .= '<ul class="warn">' . implode('', array_map(fn($e) => '<li>' . h($e) . '</li>', array_slice($errs, 0, 30))) . '</ul>';
            if ($detail) {
                $prev .= '<table class="t"><thead><tr><th>Артикул</th><th>Что</th><th>Детали</th></tr></thead><tbody>';
                foreach ($detail as $d) $prev .= '<tr><td>' . h($d[0]) . '</td><td>' . h($d[1]) . '</td><td>' . h($d[2]) . '</td></tr>';
                $prev .= '</tbody></table>' . (($new + $chg) > count($detail) ? '<p class="muted">Показаны первые ' . count($detail) . '.</p>' : '');
            }
            $prev .= ($plan ? '<form method="post" action="?a=import_apply">' . csrf_field() . '<button class="btn">Применить и опубликовать</button> <a class="btn btn-o" href="?a=import">Отмена</a></form>' : '<p>Применять нечего.</p>') . '</section>';
        } catch (Throwable $e) { flash($e->getMessage(), 'err'); redirect('?a=import'); }
    }
    view('Импорт Excel', $prev . '<section class="card"><h1>Импорт из Excel</h1>'
        . '<p>Загрузите файл <b>.xlsx</b> (или .csv) в том же формате, что <code>catalog/products.xlsx</code>. Товары находятся по артикулу (<code>sku</code>): найденные обновляются, новые добавляются. '
        . 'Пустые ячейки старые значения <b>не стирают</b> — можно загрузить файл только с артикулами и ценами. Перед записью будет предпросмотр.</p>'
        . '<form method="post" enctype="multipart/form-data" action="?a=import">' . csrf_field() . '<label>Файл<input type="file" name="file" accept=".xlsx,.csv" required></label><button class="btn">Проверить файл</button></form>'
        . '<p class="muted">Образец: <a href="?a=export">скачать текущий каталог в Excel</a> · <a href="?a=export&fmt=csv">CSV</a>. Столбцы: sku, brand, category, subcategory, name_ru, short, description, compatibility, specs, photo, availability («В наличии», «Под заказ», «По запросу»), price, published (TRUE/FALSE).</p></section>');
}
if ($a === 'import_apply') {
    need_post();
    $tok = (string)($_SESSION['imp'] ?? '');
    $plan = preg_match('/^[a-f0-9]{16}$/', $tok) ? jread('import-' . $tok, null) : null;
    if (!is_array($plan)) { flash('Предпросмотр устарел — загрузите файл ещё раз.', 'err'); redirect('?a=import'); }
    $all = products();
    $n = 0;
    foreach ($plan as $sku => $p) {
        if (!isset($all[$sku])) { $p['slug'] = free_slug($all, $p['sku'], $p['brand']); $p['src'] = 'import'; }
        $p['updated'] = time();
        $all[$sku] = $p; $n++;
    }
    save_products($all);
    @unlink(GL_DATA . '/import-' . $tok . '.json.php'); unset($_SESSION['imp']);
    $log = build_all();
    flash("Импортировано позиций: $n. " . end($log));
    redirect();
}

/* ---------- форма товара ---------- */
if ($a === 'edit') {
    $all = products();
    $sku = (string)($_GET['sku'] ?? '');
    $p = $sku !== '' && isset($all[$sku]) ? $all[$sku] : blank_product();
    if (!empty($_GET['keep']) && !empty($_SESSION['form'])) $p = $_SESSION['form']['p'];
    unset($_SESSION['form']);
    $isNew = $sku === '' || !isset($all[$sku]);
    $ro = !$isNew && $p['legacy'] ? ' readonly' : '';
    $opt = fn(array $list, string $cur) => implode('', array_map(fn($k, $v) => '<option value="' . h($k) . '"' . ($v === $cur || $k === $cur ? ' selected' : '') . '>' . h($v) . '</option>', array_keys($list), $list));
    $brands = implode('', array_map(fn($b) => '<option value="' . h($b) . '">', array_filter(GL_BRANDS, fn($k) => $k !== 'drugie', ARRAY_FILTER_USE_KEY)));
    $url = $p['slug'] !== '' ? '../zapchasti/' . rawurlencode($p['slug']) . '/' : '';
    $thumb = $p['photo'] !== '' && is_file(GL_ROOT . '/assets/parts/' . $p['photo']) ? '../assets/parts/' . rawurlencode($p['photo']) : '';
    $b = '<section class="card"><h1>' . ($isNew ? 'Новый товар' : 'Товар ' . h($p['sku'])) . '</h1>';
    if (!$isNew && $p['legacy']) $b .= '<p class="note">Страница этого товара уже есть на сайте' . ($url ? ' (<a href="' . h($url) . '" target="_blank" rel="noopener">открыть</a>)' : '') . '. Артикул, марку и раздел менять нельзя. Цена, наличие, показ и фото применяются сразу. Тексты сохраняются в каталоге и попадут в Excel, но на готовой странице сайта не меняются.</p>';
    elseif (!$isNew && $url) $b .= '<p class="note">Страница на сайте: <a href="' . h($url) . '" target="_blank" rel="noopener">открыть</a></p>';
    $b .= '<form method="post" action="?a=save" enctype="multipart/form-data" class="fm">' . csrf_field() . '<input type="hidden" name="orig" value="' . h($isNew ? '' : $p['sku']) . '">'
        . '<div class="g2"><label>Артикул *<input name="f[sku]" value="' . h($p['sku']) . '" required maxlength="80"' . $ro . '></label>'
        . '<label>Марка *<input name="f[brand]" value="' . h($p['brand']) . '" list="brands" required maxlength="60"' . $ro . '><datalist id="brands">' . $brands . '</datalist></label></div>'
        . '<div class="g2"><label>Раздел каталога<select name="f[category]"' . ($ro ? ' disabled' : '') . '>' . $opt(GL_CATS, (string)$p['category']) . '</select></label>'
        . '<label>Тип детали (как называть)<input name="f[subcategory]" value="' . h($p['subcategory']) . '" placeholder="Плата управления" maxlength="80"' . $ro . '></label></div>'
        . '<label>Полное название (необязательно)<input name="f[name_ru]" value="' . h($p['name_ru']) . '" maxlength="200" placeholder="Если пусто — тип + марка + артикул"></label>'
        . '<div class="g3"><label>Цена, ₽<input name="f[price]" inputmode="numeric" value="' . h($p['price'] ?? '') . '" placeholder="пусто = по запросу"></label>'
        . '<label>Наличие<select name="f[availability]">' . $opt(array_combine(GL_AVAIL, GL_AVAIL), (string)$p['availability']) . '</select></label>'
        . '<label>Порядок<input name="f[sort]" type="number" value="' . h($p['sort']) . '"></label></div>'
        . '<label class="chk"><input type="checkbox" name="f[published]" value="1"' . ($p['published'] ? ' checked' : '') . '> Показывать на сайте</label>'
        . '<div class="ph">' . ($thumb ? '<img src="' . h($thumb) . '" alt="" width="96" height="96">' : '') . '<label>Фото' . ($thumb ? ' (заменить)' : '') . '<input type="file" name="photo" accept="image/*"></label></div>'
        . '<label>Краткое описание (под заголовком страницы)<input name="f[short]" value="' . h($p['short']) . '" maxlength="400"></label>'
        . '<label>Описание<textarea name="f[description]" rows="4">' . h($p['description']) . '</textarea></label>'
        . '<label>Совместимость<textarea name="f[compatibility]" rows="2" placeholder="Например: KONE MonoSpace, серия V3F">' . h($p['compatibility']) . '</textarea></label>'
        . '<label>Характеристики (по одной в строке: Параметр: значение)<textarea name="f[specs]" rows="4">' . h($p['specs']) . '</textarea></label>'
        . '<div class="act"><button class="btn">Сохранить и опубликовать</button> <a class="btn btn-o" href="./">Отмена</a></div></form></section>';
    if (!$isNew && !$p['legacy']) $b .= '<form method="post" action="?a=delete" onsubmit="return confirm(\'Удалить товар и его страницу с сайта?\')">' . csrf_field() . '<input type="hidden" name="sku" value="' . h($p['sku']) . '"><button class="btn btn-d">Удалить товар</button></form>';
    view($isNew ? 'Новый товар' : 'Товар ' . $p['sku'], $b);
}

/* ---------- список товаров ---------- */
$all = products();
$q = trim((string)($_GET['q'] ?? '')); $fb = (string)($_GET['brand'] ?? ''); $fc = (string)($_GET['cat'] ?? ''); $st = (string)($_GET['st'] ?? '');
$list = array_filter($all, function ($p) use ($q, $fb, $fc, $st) {
    if ($q !== '' && mb_stripos($p['sku'] . ' ' . $p['brand'] . ' ' . $p['name_ru'] . ' ' . $p['subcategory'], $q) === false) return false;
    if ($fb !== '' && brand_slug((string)$p['brand']) !== $fb) return false;
    if ($fc !== '' && cat_slug((string)$p['category']) !== $fc) return false;
    if ($st === 'hidden' && $p['published']) return false;
    if ($st === 'shown' && !$p['published']) return false;
    if ($st === 'noprice' && $p['price']) return false;
    if ($st === 'stock' && $p['availability'] !== 'В наличии') return false;
    if ($st === 'new' && $p['legacy']) return false;
    return true;
});
$total = count($list); $per = 50; $pg = max(1, (int)($_GET['pg'] ?? 1)); $pages = max(1, (int)ceil($total / $per));
$rows = array_slice($list, ($pg - 1) * $per, $per, true);
$cnt = ['all' => count($all), 'price' => count(array_filter($all, fn($p) => $p['price'])), 'stock' => count(array_filter($all, fn($p) => $p['availability'] === 'В наличии')), 'hid' => count(array_filter($all, fn($p) => !$p['published']))];
$qs = fn(array $o = []) => '?' . http_build_query(array_filter(array_merge(['q' => $q, 'brand' => $fb, 'cat' => $fc, 'st' => $st], $o), fn($v) => $v !== '' && $v !== null));
$sel = fn(array $o, string $cur, string $all) => '<option value="">' . h($all) . '</option>' . implode('', array_map(fn($k, $v) => '<option value="' . h($k) . '"' . ($k === $cur ? ' selected' : '') . '>' . h($v) . '</option>', array_keys($o), $o));
$b = '<section class="stats"><div><b>' . $cnt['all'] . '</b><span>товаров</span></div><div><b>' . $cnt['price'] . '</b><span>с ценой</span></div><div><b>' . $cnt['stock'] . '</b><span>в наличии</span></div><div><b>' . $cnt['hid'] . '</b><span>скрыто</span></div>'
    . '<form method="post" action="?a=build">' . csrf_field() . '<button class="btn btn-o" title="Пересобрать данные сайта из каталога">Опубликовать заново</button></form></section>'
    . '<form class="filt" method="get"><input type="search" name="q" value="' . h($q) . '" placeholder="Артикул, марка, название"><select name="brand">' . $sel(GL_BRANDS, $fb, 'Все марки') . '</select><select name="cat">' . $sel(GL_CATS, $fc, 'Все разделы') . '</select>'
    . '<select name="st">' . $sel(['shown' => 'Показаны', 'hidden' => 'Скрыты', 'noprice' => 'Без цены', 'stock' => 'В наличии', 'new' => 'Добавлены в админке'], $st, 'Любой статус') . '</select><button class="btn">Найти</button></form>'
    . '<p class="muted">Найдено: ' . $total . '</p><div class="tw"><table class="t"><thead><tr><th></th><th>Артикул</th><th>Название</th><th>Марка</th><th>Раздел</th><th>Цена</th><th>Наличие</th><th></th></tr></thead><tbody>';
foreach ($rows as $p) {
    $thumb = $p['photo'] !== '' && is_file(GL_ROOT . '/assets/parts/' . $p['photo']) ? '../assets/parts/' . rawurlencode($p['photo']) : '';
    $b .= '<tr class="' . ($p['published'] ? '' : 'off') . '"><td class="th">' . ($thumb ? '<img src="' . h($thumb) . '" alt="" loading="lazy" width="44" height="44">' : '') . '</td>'
        . '<td><a href="?a=edit&sku=' . rawurlencode($p['sku']) . '"><b>' . h($p['sku']) . '</b></a>' . ($p['legacy'] ? '' : ' <span class="tag">новый</span>') . '</td>'
        . '<td>' . h(product_title($p)) . '</td><td>' . h($p['brand']) . '</td><td>' . h($p['category']) . '</td><td>' . ($p['price'] ? number_format((int)$p['price'], 0, '', ' ') . ' ₽' : '—') . '</td>'
        . '<td>' . h($p['availability']) . '</td><td class="ac"><a href="?a=edit&sku=' . rawurlencode($p['sku']) . '">Изменить</a> '
        . '<form method="post" action="?a=toggle" class="inl">' . csrf_field() . '<input type="hidden" name="sku" value="' . h($p['sku']) . '"><input type="hidden" name="q" value="' . h($q) . '"><input type="hidden" name="brand" value="' . h($fb) . '"><input type="hidden" name="cat" value="' . h($fc) . '"><input type="hidden" name="st" value="' . h($st) . '"><input type="hidden" name="pg" value="' . $pg . '"><button class="lnk">' . ($p['published'] ? 'Скрыть' : 'Показать') . '</button></form></td></tr>';
}
$b .= '</tbody></table></div>';
if ($pages > 1) {
    $b .= '<nav class="pgn">';
    if ($pg > 1) $b .= '<a href="' . h($qs(['pg' => $pg - 1])) . '">← Назад</a>';
    $b .= '<span>Страница ' . $pg . ' из ' . $pages . '</span>';
    if ($pg < $pages) $b .= '<a href="' . h($qs(['pg' => $pg + 1])) . '">Вперёд →</a>';
    $b .= '</nav>';
}
view('Товары', $b);
