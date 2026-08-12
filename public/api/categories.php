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
    session_name('andeoske_admin');
    session_set_cookie_params([
        'lifetime' => 0,
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

function makeId(): string
{
    return 'cat_' . bin2hex(random_bytes(12));
}

function listCategories(PDO $db): void
{
    $rows = $db->query(
        'SELECT `name` FROM `ReportCategory` WHERE `isActive` = 1 ORDER BY `name` ASC'
    )->fetchAll();

    respond(200, ['categories' => array_column($rows, 'name')]);
}

function createCategory(PDO $db): void
{
    $data = readJson();
    $name = trim((string) ($data['name'] ?? ''));

    if ($name === '' || mb_strlen($name) > 80) {
        respond(422, ['error' => 'Category name is required and must be shorter than 80 characters.']);
    }

    $now = date('Y-m-d H:i:s');

    try {
        $statement = $db->prepare(
            'INSERT INTO `ReportCategory` (`id`, `name`, `isActive`, `createdAt`, `updatedAt`)
             VALUES (?, ?, 1, ?, ?)
             ON DUPLICATE KEY UPDATE `isActive` = 1, `updatedAt` = VALUES(`updatedAt`)'
        );
        $statement->execute([makeId(), $name, $now, $now]);
    } catch (Throwable) {
        respond(500, ['error' => 'Could not save category.']);
    }

    respond(201, ['category' => $name]);
}

function deleteCategory(PDO $db): void
{
    $data = readJson();
    $name = trim((string) ($data['name'] ?? ''));

    if ($name === '') {
        respond(422, ['error' => 'Category name is required.']);
    }

    try {
        $statement = $db->prepare('UPDATE `ReportCategory` SET `isActive` = 0, `updatedAt` = ? WHERE `name` = ?');
        $statement->execute([date('Y-m-d H:i:s'), $name]);
    } catch (Throwable) {
        respond(500, ['error' => 'Could not delete category.']);
    }

    respond(200, ['category' => $name]);
}

$db = pdo();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    listCategories($db);
}

if ($method === 'POST') {
    requireAdmin();
    createCategory($db);
}

if ($method === 'DELETE') {
    requireAdmin();
    deleteCategory($db);
}

respond(405, ['error' => 'Method not allowed.']);
