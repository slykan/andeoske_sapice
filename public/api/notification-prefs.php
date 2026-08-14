<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

const ALLOWED_CHANNELS = ['EMAIL', 'PUSH', 'BOTH'];

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
        respond(500, ['error' => 'DATABASE_URL is not configured.']);
    }

    $parts = parse_url($databaseUrl);
    if (!$parts || ($parts['scheme'] ?? '') !== 'mysql') {
        respond(500, ['error' => 'DATABASE_URL must be a MySQL URL.']);
    }

    $host = $parts['host'] ?? 'localhost';
    $port = $parts['port'] ?? 3306;
    $database = ltrim($parts['path'] ?? '', '/');
    $user = rawurldecode($parts['user'] ?? '');
    $password = rawurldecode($parts['pass'] ?? '');
    $dsn = "mysql:host={$host};port={$port};dbname={$database};charset=utf8mb4";

    try {
        return new PDO($dsn, $user, $password, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
    } catch (PDOException) {
        respond(500, ['error' => 'Database connection failed.']);
    }
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

function startAdminSession(): void
{
    // 60-day session so admins/volunteers using the mobile app aren't asked
    // to log in again every time the server-side session would otherwise
    // be garbage-collected.
    $sessionLifetime = 60 * 24 * 60 * 60;
    ini_set('session.gc_maxlifetime', (string) $sessionLifetime);
    session_name('andeoske_admin');
    session_set_cookie_params([
        'lifetime' => $sessionLifetime,
        'path' => '/',
        'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}

function requireAdmin(): void
{
    startAdminSession();
    if (empty($_SESSION['is_admin'])) {
        respond(401, ['error' => 'Admin login required.']);
    }
}

requireAdmin();

$userId = $_SESSION['user_id'] ?? null;
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

// The bootstrap admin account (from ADMIN_USERNAME/ADMIN_PASSWORD env vars) has
// no backing User row, so its notification preference can't be persisted.
if ($userId === null) {
    if ($method === 'GET') {
        respond(200, ['notifyChannel' => 'EMAIL', 'editable' => false]);
    }

    respond(409, ['error' => 'Ovaj admin račun nema korisnički zapis pa se postavka ne može spremiti.']);
}

$db = pdo();

if ($method === 'GET') {
    $statement = $db->prepare('SELECT `notifyChannel` FROM `User` WHERE `id` = ? LIMIT 1');
    $statement->execute([$userId]);
    $row = $statement->fetch();

    if (!$row) {
        respond(404, ['error' => 'Korisnik nije pronađen.']);
    }

    respond(200, ['notifyChannel' => $row['notifyChannel'], 'editable' => true]);
}

if ($method === 'PATCH') {
    $data = readJson();
    $channel = strtoupper(trim((string) ($data['notifyChannel'] ?? '')));

    if (!in_array($channel, ALLOWED_CHANNELS, true)) {
        respond(422, ['error' => 'Nepoznat kanal obavijesti.']);
    }

    if ($channel !== 'EMAIL') {
        respond(422, ['error' => 'Push obavijesti još nisu dostupne. Trenutno je moguć samo email.']);
    }

    $statement = $db->prepare('UPDATE `User` SET `notifyChannel` = ? WHERE `id` = ?');
    $statement->execute([$channel, $userId]);

    respond(200, ['notifyChannel' => $channel, 'editable' => true]);
}

respond(405, ['error' => 'Method not allowed.']);
