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

function makeId(string $prefix): string
{
    return $prefix . '_' . bin2hex(random_bytes(12));
}

function shortText(array $data, string $key, int $max): string
{
    $value = trim((string) ($data[$key] ?? ''));

    if ($value === '' || mb_strlen($value) > $max) {
        respond(422, ['error' => "{$key} is required and too long values are not allowed."]);
    }

    return $value;
}

function categoryByName(PDO $db, string $name): ?array
{
    $statement = $db->prepare('SELECT `id`, `name` FROM `ReportCategory` WHERE `name` = ? LIMIT 1');
    $statement->execute([$name]);
    $category = $statement->fetch();

    return $category ?: null;
}

function listCategories(PDO $db): void
{
    $categoryRows = $db->query(
        'SELECT `id`, `name` FROM `ReportCategory` WHERE `isActive` = 1 ORDER BY `name` ASC'
    )->fetchAll();

    $categories = array_column($categoryRows, 'name');
    $subcategories = array_fill_keys($categories, []);

    $rows = $db->query(
        'SELECT c.`name` AS `categoryName`, s.`label`
         FROM `ReportSubcategory` s
         INNER JOIN `ReportCategory` c ON c.`id` = s.`categoryId`
         WHERE c.`isActive` = 1 AND s.`isActive` = 1
         ORDER BY c.`name` ASC, s.`label` ASC'
    )->fetchAll();

    foreach ($rows as $row) {
        $subcategories[$row['categoryName']][] = $row['label'];
    }

    respond(200, [
        'categories' => $categories,
        'subcategories' => $subcategories,
    ]);
}

function createCategory(PDO $db, array $data): void
{
    $name = shortText($data, 'name', 80);
    $now = date('Y-m-d H:i:s');

    try {
        $statement = $db->prepare(
            'INSERT INTO `ReportCategory` (`id`, `name`, `isActive`, `createdAt`, `updatedAt`)
             VALUES (?, ?, 1, ?, ?)
             ON DUPLICATE KEY UPDATE `isActive` = 1, `updatedAt` = VALUES(`updatedAt`)'
        );
        $statement->execute([makeId('cat'), $name, $now, $now]);
    } catch (Throwable) {
        respond(500, ['error' => 'Could not save category.']);
    }

    listCategories($db);
}

function createSubcategory(PDO $db, array $data): void
{
    $categoryName = shortText($data, 'category', 80);
    $label = shortText($data, 'label', 100);
    $category = categoryByName($db, $categoryName);

    if (!$category) {
        respond(404, ['error' => 'Category not found.']);
    }

    $now = date('Y-m-d H:i:s');

    try {
        $statement = $db->prepare(
            'INSERT INTO `ReportSubcategory` (`id`, `categoryId`, `label`, `isActive`, `createdAt`, `updatedAt`)
             VALUES (?, ?, ?, 1, ?, ?)
             ON DUPLICATE KEY UPDATE `isActive` = 1, `updatedAt` = VALUES(`updatedAt`)'
        );
        $statement->execute([makeId('sub'), $category['id'], $label, $now, $now]);
    } catch (Throwable) {
        respond(500, ['error' => 'Could not save subcategory.']);
    }

    listCategories($db);
}

function deleteCategory(PDO $db, array $data): void
{
    $name = shortText($data, 'name', 80);

    try {
        $statement = $db->prepare('UPDATE `ReportCategory` SET `isActive` = 0, `updatedAt` = ? WHERE `name` = ?');
        $statement->execute([date('Y-m-d H:i:s'), $name]);
    } catch (Throwable) {
        respond(500, ['error' => 'Could not delete category.']);
    }

    listCategories($db);
}

function deleteSubcategory(PDO $db, array $data): void
{
    $categoryName = shortText($data, 'category', 80);
    $label = shortText($data, 'label', 100);

    try {
        $statement = $db->prepare(
            'UPDATE `ReportSubcategory` s
             INNER JOIN `ReportCategory` c ON c.`id` = s.`categoryId`
             SET s.`isActive` = 0, s.`updatedAt` = ?
             WHERE c.`name` = ? AND s.`label` = ?'
        );
        $statement->execute([date('Y-m-d H:i:s'), $categoryName, $label]);
    } catch (Throwable) {
        respond(500, ['error' => 'Could not delete subcategory.']);
    }

    listCategories($db);
}

$db = pdo();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    listCategories($db);
}

if ($method === 'POST') {
    requireAdmin();
    $data = readJson();

    if (($data['type'] ?? 'category') === 'subcategory') {
        createSubcategory($db, $data);
    }

    createCategory($db, $data);
}

if ($method === 'DELETE') {
    requireAdmin();
    $data = readJson();

    if (($data['type'] ?? 'category') === 'subcategory') {
        deleteSubcategory($db, $data);
    }

    deleteCategory($db, $data);
}

respond(405, ['error' => 'Method not allowed.']);
