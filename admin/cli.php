<?php
/* GeniLift — команды без браузера (для администратора сайта).
   php admin/cli.php brands   — пересобрать страницы марок и разделов из каталога
   php admin/cli.php build    — полная публикация (как кнопка «Опубликовать заново» в админке) */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require __DIR__ . '/lib.php';
require __DIR__ . '/xlsx.php';
require __DIR__ . '/build.php';
$cmd = $argv[1] ?? '';
if ($cmd === 'brands') { foreach (build_pages() as $l) echo $l, "\n"; exit(0); }
if ($cmd === 'build') { foreach (build_all() as $l) echo $l, "\n"; exit(0); }
fwrite(STDERR, "Команды: brands | build\n");
exit(1);
