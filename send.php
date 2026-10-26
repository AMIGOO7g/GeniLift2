<?php
/* GeniLift — приём заявок с сайта. Письмо на почту + журнал на сервере + сигнал в Telegram без личных данных. */
header('Content-Type: application/json; charset=utf-8');
$C = require __DIR__ . '/config.php';
function out($ok, $err = '') { echo json_encode($ok ? ['ok' => true] : ['ok' => false, 'error' => $err], JSON_UNESCAPED_UNICODE); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') out(false, 'Неверный запрос.');
if (!empty($_POST['website'])) out(true);                       // бот заполнил ловушку — молча «принимаем»
$dir = __DIR__ . '/_leads'; if (!is_dir($dir)) @mkdir($dir, 0750, true);
/* не чаще 1 заявки в 20 секунд с одного адреса */
$ip = $_SERVER['REMOTE_ADDR'] ?? ''; $rl = $dir . '/.rl_' . md5($ip);
if (is_file($rl) && time() - filemtime($rl) < 20) out(false, 'Слишком часто. Подождите немного и попробуйте снова.');
@touch($rl);
$t = function ($k, $max = 2000) { return trim(mb_substr(strip_tags((string)($_POST[$k] ?? '')), 0, $max)); };
$name = $t('name', 100); $phone = $t('phone', 40); $msg = $t('msg', 3000); $page = $t('page', 300); $form = $t('form', 40);
$items = json_decode((string)($_POST['items'] ?? ''), true);
if (($_POST['agree'] ?? '') !== 'yes') out(false, 'Отметьте согласие на обработку данных.');
if (!preg_match('/\d{10,}/', preg_replace('/\D/', '', $phone))) out(false, 'Укажите телефон — по нему перезвоним.');
/* текст заявки */
$lines = ["Новая заявка с сайта {$C['site']}", "Время: " . date('d.m.Y H:i'), "Имя: " . ($name ?: '—'), "Телефон: $phone"];
if ($msg) $lines[] = "Сообщение: $msg";
if (is_array($items) && $items) { $lines[] = 'Детали:'; foreach ($items as $it) { $lines[] = ' • ' . (is_array($it) ? implode(' · ', array_map('strval', array_filter($it, 'is_scalar'))) : (string)$it); } }
$lines[] = "Страница: $page"; $lines[] = "Согласие на обработку ПДн: да";
$body = implode("\n", $lines);
/* журнал на сервере (папка закрыта от интернета) */
@file_put_contents($dir . '/leads-' . date('Y-m') . '.log', $body . "\n-----\n", FILE_APPEND | LOCK_EX);
/* письмо (с фото во вложении, если есть) */
$subject = '=?UTF-8?B?' . base64_encode("Заявка с сайта: $phone") . '?=';
$b = md5(uniqid('', true));
$headers = "From: GeniLift <{$C['mail_from']}>\r\nMIME-Version: 1.0\r\nContent-Type: multipart/mixed; boundary=\"$b\"\r\n";
$mail = "--$b\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n" . chunk_split(base64_encode($body));
$f = $_FILES['photo'] ?? null;
if ($f && $f['error'] === UPLOAD_ERR_OK && $f['size'] > 0 && $f['size'] <= 10 * 1024 * 1024) {
  $mime = mime_content_type($f['tmp_name']);
  if (strpos((string)$mime, 'image/') === 0) {
    $fn = preg_replace('/[^\w.\-]+/u', '_', $f['name']);
    $mail .= "--$b\r\nContent-Type: $mime; name=\"$fn\"\r\nContent-Transfer-Encoding: base64\r\nContent-Disposition: attachment; filename=\"$fn\"\r\n\r\n" . chunk_split(base64_encode(file_get_contents($f['tmp_name'])));
  }
}
$mail .= "--$b--";
$sent = @mail($C['mail_to'], $subject, $mail, $headers);
/* сигнал в Telegram — без имени и телефона */
if (!empty($C['tg_token']) && !empty($C['tg_chat'])) {
  $q = http_build_query(['chat_id' => $C['tg_chat'], 'text' => "🔔 Новая заявка на сайте {$C['site']} — проверьте почту."]);
  @file_get_contents("https://api.telegram.org/bot{$C['tg_token']}/sendMessage?$q");
}
$sent ? out(true) : out(false, 'Не удалось отправить. Позвоните: +7 985 481-72-28');
