<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

const USER_ROLES = ['REPORTER', 'VOLUNTEER', 'ADMIN', 'ORGANIZATION'];

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

function nullableId(PDO $db, array $data, string $key, string $table): ?string
{
    $id = nullableString($data, $key);
    if ($id === null) {
        return null;
    }

    $statement = $db->prepare("SELECT COUNT(*) FROM `{$table}` WHERE `id` = ?");
    $statement->execute([$id]);

    if ((int) $statement->fetchColumn() === 0) {
        respond(422, ['error' => "{$key} does not exist."]);
    }

    return $id;
}

function listAdminData(PDO $db): void
{
    $regions = $db->query(
        'SELECT `id`, `name` FROM `Region` ORDER BY `name` ASC'
    )->fetchAll();

    $organizations = $db->query(
        'SELECT
            o.`id`,
            o.`name`,
            o.`email`,
            o.`phone`,
            o.`city`,
            o.`regionId`,
            r.`name` AS `regionName`
         FROM `Organization` o
         LEFT JOIN `Region` r ON r.`id` = o.`regionId`
         ORDER BY o.`name` ASC'
    )->fetchAll();

    $users = $db->query(
        'SELECT
            u.`id`,
            u.`email`,
            u.`name`,
            u.`phone`,
            u.`role`,
            u.`regionId`,
            u.`organizationId`,
            r.`name` AS `regionName`,
            o.`name` AS `organizationName`
         FROM `User` u
         LEFT JOIN `Region` r ON r.`id` = u.`regionId`
         LEFT JOIN `Organization` o ON o.`id` = u.`organizationId`
         ORDER BY FIELD(u.`role`, "ADMIN", "VOLUNTEER", "ORGANIZATION", "REPORTER"), u.`name`, u.`email`'
    )->fetchAll();

    respond(200, [
        'regions' => $regions,
        'organizations' => $organizations,
        'users' => $users,
    ]);
}

function createRegion(PDO $db, array $data): void
{
    $name = nullableString($data, 'name', 80);
    if ($name === null) {
        respond(422, ['error' => 'Region name is required.']);
    }

    $now = date('Y-m-d H:i:s');

    try {
        $statement = $db->prepare(
            'INSERT INTO `Region` (`id`, `name`, `createdAt`, `updatedAt`)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE `updatedAt` = VALUES(`updatedAt`)'
        );
        $statement->execute([makeId('reg'), $name, $now, $now]);
    } catch (Throwable) {
        respond(500, ['error' => 'Could not save region.']);
    }

    listAdminData($db);
}

function createOrganization(PDO $db, array $data): void
{
    $name = nullableString($data, 'name', 120);
    if ($name === null) {
        respond(422, ['error' => 'Organization name is required.']);
    }

    $regionId = nullableId($db, $data, 'regionId', 'Region');
    $email = nullableString($data, 'email', 190);
    $phone = nullableString($data, 'phone', 80);
    $city = nullableString($data, 'city', 120);
    $now = date('Y-m-d H:i:s');

    try {
        $statement = $db->prepare(
            'INSERT INTO `Organization` (`id`, `name`, `email`, `phone`, `city`, `regionId`, `createdAt`, `updatedAt`)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        );
        $statement->execute([makeId('org'), $name, $email, $phone, $city, $regionId, $now, $now]);
    } catch (Throwable) {
        respond(500, ['error' => 'Could not save organization.']);
    }

    listAdminData($db);
}

function createUser(PDO $db, array $data): void
{
    $email = nullableString($data, 'email', 190);
    $name = nullableString($data, 'name', 120);
    $role = strtoupper(trim((string) ($data['role'] ?? 'VOLUNTEER')));

    if ($email === null || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        respond(422, ['error' => 'Valid email is required.']);
    }

    if (!in_array($role, USER_ROLES, true)) {
        respond(422, ['error' => 'Invalid user role.']);
    }

    $regionId = nullableId($db, $data, 'regionId', 'Region');
    $organizationId = nullableId($db, $data, 'organizationId', 'Organization');
    $phone = nullableString($data, 'phone', 80);
    $now = date('Y-m-d H:i:s');

    try {
        $statement = $db->prepare(
            'INSERT INTO `User` (`id`, `email`, `name`, `phone`, `role`, `regionId`, `organizationId`, `createdAt`, `updatedAt`)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                `name` = VALUES(`name`),
                `phone` = VALUES(`phone`),
                `role` = VALUES(`role`),
                `regionId` = VALUES(`regionId`),
                `organizationId` = VALUES(`organizationId`),
                `updatedAt` = VALUES(`updatedAt`)'
        );
        $statement->execute([makeId('usr'), $email, $name, $phone, $role, $regionId, $organizationId, $now, $now]);
    } catch (Throwable) {
        respond(500, ['error' => 'Could not save user.']);
    }

    listAdminData($db);
}

function assignReport(PDO $db, array $data): void
{
    $publicCode = nullableString($data, 'reportId', 80);
    if ($publicCode === null) {
        respond(422, ['error' => 'Report id is required.']);
    }

    $regionId = nullableId($db, $data, 'regionId', 'Region');
    $organizationId = nullableId($db, $data, 'organizationId', 'Organization');
    $assignedToId = nullableId($db, $data, 'assignedToId', 'User');
    $now = date('Y-m-d H:i:s');

    $statement = $db->prepare('SELECT `id`, `status` FROM `Report` WHERE `publicCode` = ? LIMIT 1');
    $statement->execute([$publicCode]);
    $report = $statement->fetch();

    if (!$report) {
        respond(404, ['error' => 'Report not found.']);
    }

    try {
        $db->beginTransaction();

        $statement = $db->prepare(
            'UPDATE `Report`
             SET `regionId` = ?, `organizationId` = ?, `assignedToId` = ?, `status` = "ASSIGNED", `updatedAt` = ?
             WHERE `id` = ?'
        );
        $statement->execute([$regionId, $organizationId, $assignedToId, $now, $report['id']]);

        $statement = $db->prepare(
            'INSERT INTO `ReportStatusHistory`
             (`id`, `reportId`, `fromStatus`, `toStatus`, `action`, `note`, `createdAt`)
             VALUES (?, ?, ?, "ASSIGNED", "ASSIGNED", ?, ?)'
        );
        $statement->execute([
            makeId('hist'),
            $report['id'],
            $report['status'],
            'Prijava dodijeljena kroz admin operativni pregled.',
            $now,
        ]);

        $db->commit();
    } catch (Throwable) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        respond(500, ['error' => 'Could not assign report.']);
    }

    respond(200, ['ok' => true]);
}

$db = pdo();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

requireAdmin();

if ($method === 'GET') {
    listAdminData($db);
}

if ($method === 'POST') {
    $data = readJson();
    $type = trim((string) ($data['type'] ?? ''));

    if ($type === 'region') {
        createRegion($db, $data);
    }

    if ($type === 'organization') {
        createOrganization($db, $data);
    }

    if ($type === 'user') {
        createUser($db, $data);
    }

    respond(422, ['error' => 'Unsupported admin entity type.']);
}

if ($method === 'PATCH') {
    $data = readJson();
    if (($data['type'] ?? '') === 'assignment') {
        assignReport($db, $data);
    }

    respond(422, ['error' => 'Unsupported admin update type.']);
}

respond(405, ['error' => 'Method not allowed.']);
