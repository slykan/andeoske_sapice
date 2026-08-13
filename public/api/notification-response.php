<?php
declare(strict_types=1);

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

        if (!empty($env['DATABASE_URL'])) {
            return $env;
        }
    }

    return [];
}

function pdo(): PDO
{
    $env = loadEnv();
    $databaseUrl = $env['DATABASE_URL'] ?? getenv('DATABASE_URL');

    if (!$databaseUrl) {
        http_response_code(500);
        exit('Baza nije konfigurirana.');
    }

    $parts = parse_url($databaseUrl);
    $host = $parts['host'] ?? 'localhost';
    $port = $parts['port'] ?? 3306;
    $database = ltrim($parts['path'] ?? '', '/');
    $user = rawurldecode($parts['user'] ?? '');
    $password = rawurldecode($parts['pass'] ?? '');
    $dsn = "mysql:host={$host};port={$port};dbname={$database};charset=utf8mb4";

    return new PDO($dsn, $user, $password, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
}

function renderPage(string $title, string $message): void
{
    header('Content-Type: text/html; charset=utf-8');
    $safeTitle = htmlspecialchars($title, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $safeMessage = htmlspecialchars($message, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');

    echo <<<HTML
<!doctype html>
<html lang="hr">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{$safeTitle}</title>
    <style>
      body { background:#f6f2ea; color:#1f2a24; font-family:Arial,Helvetica,sans-serif; margin:0; min-height:100vh; display:grid; place-items:center; padding:24px; }
      main { background:#fffdf8; border:1px solid #ded6c8; border-radius:10px; max-width:520px; padding:28px; text-align:center; }
      h1 { font-size:26px; margin:0 0 10px; }
      p { color:#6a5f53; font-size:16px; line-height:1.55; margin:0; }
      a { color:#2f5d50; display:inline-block; font-weight:700; margin-top:22px; }
    </style>
  </head>
  <body>
    <main>
      <h1>{$safeTitle}</h1>
      <p>{$safeMessage}</p>
      <a href="/admin">Otvori admin</a>
    </main>
  </body>
</html>
HTML;
}

$token = trim((string) ($_GET['token'] ?? ''));
$action = trim((string) ($_GET['action'] ?? ''));
$responseStatus = [
    'accept' => 'ACCEPTED',
    'decline' => 'DECLINED',
][$action] ?? null;

if ($token === '' || !preg_match('/^[a-f0-9]{48}$/', $token) || $responseStatus === null) {
    http_response_code(400);
    renderPage('Neispravan link', 'Link za odgovor nije ispravan.');
    exit;
}

try {
    $db = pdo();
    $statement = $db->prepare(
        'UPDATE `ReportNotification`
         SET `responseStatus` = ?, `respondedAt` = ?
         WHERE `responseToken` = ?'
    );
    $statement->execute([$responseStatus, date('Y-m-d H:i:s'), $token]);

    if ($statement->rowCount() === 0) {
        http_response_code(404);
        renderPage('Link nije pronađen', 'Ovaj link za odgovor nije pronađen.');
        exit;
    }
} catch (Throwable) {
    http_response_code(500);
    renderPage('Greška', 'Odgovor trenutno nije moguće spremiti.');
    exit;
}

if ($responseStatus === 'ACCEPTED') {
    renderPage('Prijava prihvaćena', 'Hvala, tvoj odgovor je spremljen u admin log.');
    exit;
}

renderPage('Prijava odbijena', 'Tvoj odgovor je spremljen u admin log.');
