<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function respond(int $status, array $payload): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function loadEnv(): array
{
    $paths = [
        __DIR__ . '/../../andeoske_sapice/.env',
        __DIR__ . '/../../andeoske_sapice/.env.local',
        __DIR__ . '/../../.env',
        __DIR__ . '/../../.env.local',
    ];

    foreach ($paths as $path) {
        if (!is_readable($path)) {
            continue;
        }

        $env = [];
        foreach (file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [] as $line) {
            $line = trim($line);
            if ($line === '' || strpos($line, '#') === 0 || strpos($line, '=') === false) {
                continue;
            }

            [$key, $value] = explode('=', $line, 2);
            $env[trim($key)] = trim(trim($value), "\"'");
        }

        if (!empty($env)) {
            return $env;
        }
    }

    return [];
}

function readJson(): array
{
    $body = file_get_contents('php://input') ?: '';
    $data = json_decode($body, true);

    if (!is_array($data)) {
        respond(400, ['error' => 'Invalid JSON body.']);
    }

    return $data;
}

function clientIp(): string
{
    $candidates = [
        $_SERVER['HTTP_CF_CONNECTING_IP'] ?? '',
        $_SERVER['HTTP_X_FORWARDED_FOR'] ?? '',
        $_SERVER['REMOTE_ADDR'] ?? 'unknown',
    ];

    foreach ($candidates as $candidate) {
        $ip = trim(explode(',', (string) $candidate)[0]);
        if ($ip !== '') {
            return $ip;
        }
    }

    return 'unknown';
}

function enforceRateLimit(): void
{
    $limit = 5;
    $windowSeconds = 600;
    $now = time();
    $key = hash('sha256', clientIp());
    $path = sys_get_temp_dir() . '/andeoske_contact_rate_' . $key . '.json';
    $handle = fopen($path, 'c+');

    if ($handle === false) {
        return;
    }

    flock($handle, LOCK_EX);
    $contents = stream_get_contents($handle);
    $attempts = json_decode($contents ?: '[]', true);
    if (!is_array($attempts)) {
        $attempts = [];
    }

    $attempts = array_values(array_filter(
        array_map('intval', $attempts),
        fn (int $timestamp): bool => $timestamp > ($now - $windowSeconds),
    ));

    if (count($attempts) >= $limit) {
        flock($handle, LOCK_UN);
        fclose($handle);
        respond(429, ['error' => 'Too many submissions. Please try again later.']);
    }

    $attempts[] = $now;
    ftruncate($handle, 0);
    rewind($handle);
    fwrite($handle, json_encode($attempts));
    fflush($handle);
    flock($handle, LOCK_UN);
    fclose($handle);
}

function validateSubmissionSecurity(array $data): void
{
    if (trim((string) ($data['website'] ?? '')) !== '') {
        respond(204, []);
    }

    $startedAt = (int) ($data['formStartedAt'] ?? 0);
    $elapsedMs = (int) round(microtime(true) * 1000) - $startedAt;

    if ($startedAt <= 0 || $elapsedMs < 1500 || $elapsedMs > 7200000) {
        respond(422, ['error' => 'Submission timing failed validation.']);
    }

    enforceRateLimit();
}

function cleanMailHeader(string $value): string
{
    return trim(str_replace(["\r", "\n"], '', $value));
}

function escapeHtml(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function nullableString(array $data, string $key, int $max = 190): ?string
{
    $value = trim((string) ($data[$key] ?? ''));

    if ($value === '') {
        return null;
    }

    if (mb_strlen($value) > $max) {
        respond(422, ['error' => "{$key} is too long."]);
    }

    return $value;
}

function sendContactMail(array $fields): bool
{
    $env = loadEnv();
    $from = cleanMailHeader((string) (
        $env['MAIL_FROM']
        ?? $env['EMAIL_FROM']
        ?? $env['SMTP_USER']
        ?? getenv('MAIL_FROM')
        ?: getenv('EMAIL_FROM')
        ?: getenv('SMTP_USER')
        ?: 'noreply@andeoske-sapice.app'
    ));
    $to = cleanMailHeader((string) (
        $env['CONTACT_EMAIL']
        ?? $env['MAIL_TO']
        ?? $env['ADMIN_EMAIL']
        ?? getenv('CONTACT_EMAIL')
        ?: getenv('MAIL_TO')
        ?: getenv('ADMIN_EMAIL')
        ?: 'info@andeoske-sapice.app'
    ));
    $replyTo = cleanMailHeader($fields['email']);
    $subject = 'Nova poruka s kontakt forme - ' . $fields['name'];

    $textBody = implode("\n", array_filter([
        'Nova poruka s kontakt forme na andeoske-sapice.app.',
        '',
        'Ime i prezime: ' . $fields['name'],
        $fields['organization'] ? 'Organizacija: ' . $fields['organization'] : null,
        $fields['phone'] ? 'Kontakt telefon: ' . $fields['phone'] : null,
        'Email: ' . $fields['email'],
        $fields['region'] ? 'Regija/Grad: ' . $fields['region'] : null,
        '',
        'Poruka:',
        $fields['message'],
    ], static fn ($line) => $line !== null));

    $safeName = escapeHtml($fields['name']);
    $safeOrganization = $fields['organization'] ? escapeHtml($fields['organization']) : null;
    $safePhone = $fields['phone'] ? escapeHtml($fields['phone']) : null;
    $safeEmail = escapeHtml($fields['email']);
    $safeRegion = $fields['region'] ? escapeHtml($fields['region']) : null;
    $safeMessage = nl2br(escapeHtml($fields['message']));

    $detailRows = '';
    $rows = [
        'Ime i prezime' => $safeName,
        'Organizacija' => $safeOrganization,
        'Kontakt telefon' => $safePhone,
        'Email' => $safeEmail,
        'Regija/Grad' => $safeRegion,
    ];

    foreach ($rows as $label => $value) {
        if ($value === null) {
            continue;
        }
        $detailRows .= '<tr>'
            . '<td style="border-top:1px solid #e6ded1;padding:12px 0;color:#6a5f53;font-size:13px;">' . $label . '</td>'
            . '<td style="border-top:1px solid #e6ded1;padding:12px 0;text-align:right;font-weight:700;">' . $value . '</td>'
            . '</tr>';
    }

    $htmlBody = <<<HTML
<!doctype html>
<html lang="hr">
  <body style="margin:0;background:#f6f2ea;color:#1f2a24;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f2ea;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#fffdf8;border:1px solid #ded6c8;border-radius:10px;overflow:hidden;">
            <tr>
              <td style="background:#2f5d50;color:#ffffff;padding:22px 26px;">
                <div style="font-size:13px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;">Andeoske sapice</div>
                <h1 style="font-size:24px;line-height:1.2;margin:8px 0 0;">Nova poruka s kontakt forme</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 26px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:0 0 22px;">
                  {$detailRows}
                </table>
                <div style="background:#f6f2ea;border:1px solid #e6ded1;border-radius:8px;padding:14px 16px;">
                  <div style="color:#6a5f53;font-size:13px;font-weight:700;margin-bottom:6px;">Poruka</div>
                  <div style="font-size:15px;line-height:1.55;">{$safeMessage}</div>
                </div>
              </td>
            </tr>
            <tr>
              <td style="background:#f6f2ea;color:#6a5f53;font-size:12px;line-height:1.45;padding:14px 26px;">
                Ova poruka je poslana putem kontakt forme na javnoj stranici. Odgovori izravno na ovaj mail za kontakt s posiljateljem.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
HTML;

    $boundary = 'andeoske_' . bin2hex(random_bytes(12));
    $body = implode("\r\n", [
        "--{$boundary}",
        'Content-Type: text/plain; charset=UTF-8',
        'Content-Transfer-Encoding: 8bit',
        '',
        $textBody,
        "--{$boundary}",
        'Content-Type: text/html; charset=UTF-8',
        'Content-Transfer-Encoding: 8bit',
        '',
        $htmlBody,
        "--{$boundary}--",
    ]);

    $headers = implode("\r\n", [
        "From: Andeoske Sapice <{$from}>",
        "Reply-To: {$safeName} <{$replyTo}>",
        'MIME-Version: 1.0',
        "Content-Type: multipart/alternative; boundary=\"{$boundary}\"",
    ]);

    return (bool) @mail($to, $subject, $body, $headers);
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method !== 'POST') {
    respond(405, ['error' => 'Method not allowed.']);
}

$data = readJson();
validateSubmissionSecurity($data);

$name = nullableString($data, 'name', 160);
$organization = nullableString($data, 'organization', 160);
$phone = nullableString($data, 'phone', 80);
$email = nullableString($data, 'email', 190);
$region = nullableString($data, 'region', 160);
$message = nullableString($data, 'message', 5000);

if ($name === null || $phone === null || $email === null || $message === null) {
    respond(422, ['error' => 'Ime, telefon, email i poruka su obavezni.']);
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    respond(422, ['error' => 'Valid email is required.']);
}

$sent = sendContactMail([
    'name' => $name,
    'organization' => $organization,
    'phone' => $phone,
    'email' => $email,
    'region' => $region,
    'message' => $message,
]);

if (!$sent) {
    respond(500, ['error' => 'Poruka nije poslana. Pokusaj ponovno kasnije.']);
}

respond(200, ['ok' => true]);
