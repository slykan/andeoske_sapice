<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

const STATUS_TO_DB = [
    'Zaprimljeno' => 'RECEIVED',
    'U provjeri' => 'IN_REVIEW',
    'Dodijeljeno' => 'ASSIGNED',
    'Proslijeđeno' => 'FORWARDED',
    'U tijeku' => 'IN_PROGRESS',
    'Zaključeno' => 'CLOSED',
];

const STATUS_FROM_DB = [
    'RECEIVED' => 'Zaprimljeno',
    'IN_REVIEW' => 'U provjeri',
    'ASSIGNED' => 'Dodijeljeno',
    'FORWARDED' => 'Proslijeđeno',
    'IN_PROGRESS' => 'U tijeku',
    'CLOSED' => 'Zaključeno',
];

const URGENCY_TO_DB = [
    'Niska' => 'LOW',
    'Srednja' => 'MEDIUM',
    'Visoka' => 'HIGH',
];

const URGENCY_FROM_DB = [
    'LOW' => 'Niska',
    'MEDIUM' => 'Srednja',
    'HIGH' => 'Visoka',
];

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

function makePublicCode(PDO $db): string
{
    $year = date('Y');

    for ($attempt = 0; $attempt < 10; $attempt++) {
        $code = 'AS-' . $year . '-' . str_pad((string) random_int(1, 999999), 6, '0', STR_PAD_LEFT);
        $statement = $db->prepare('SELECT COUNT(*) FROM `Report` WHERE `publicCode` = ?');
        $statement->execute([$code]);

        if ((int) $statement->fetchColumn() === 0) {
            return $code;
        }
    }

    respond(500, ['error' => 'Could not generate report code.']);
}

function flagsFromRow(array $row): array
{
    if (!empty($row['chainNotes'])) {
        return array_values(array_filter(array_map('trim', explode(',', (string) $row['chainNotes']))));
    }

    $flags = [];
    if (isset($row['hasWater']) && (int) $row['hasWater'] === 0) {
        $flags[] = 'Nema vode';
    }
    if (isset($row['hasFood']) && (int) $row['hasFood'] === 0) {
        $flags[] = 'Nema hrane';
    }
    if (isset($row['hasShelter']) && (int) $row['hasShelter'] === 0) {
        $flags[] = 'Nema zaklona';
    }
    if (isset($row['visibleInjuries']) && (int) $row['visibleInjuries'] === 1) {
        $flags[] = 'Vidljive ozljede';
    }

    return $flags;
}

function reportFromRow(array $row): array
{
    return [
        'id' => $row['publicCode'],
        'category' => $row['category'],
        'place' => $row['locationText'],
        'urgency' => URGENCY_FROM_DB[$row['urgency']] ?? 'Srednja',
        'status' => STATUS_FROM_DB[$row['status']] ?? 'Zaprimljeno',
        'animal' => $row['animalType'],
        'description' => $row['description'],
        'flags' => flagsFromRow($row),
        'anonymous' => (bool) $row['isAnonymous'],
    ];
}

function listReports(PDO $db): void
{
    $rows = $db->query(
        'SELECT
            r.`publicCode`,
            r.`category`,
            r.`animalType`,
            r.`description`,
            r.`locationText`,
            r.`urgency`,
            r.`status`,
            r.`isAnonymous`,
            c.`hasWater`,
            c.`hasFood`,
            c.`hasShelter`,
            c.`visibleInjuries`,
            c.`notes` AS `chainNotes`
         FROM `Report` r
         LEFT JOIN `ChainDetails` c ON c.`reportId` = r.`id`
         ORDER BY r.`createdAt` DESC
         LIMIT 100'
    )->fetchAll();

    $reports = [];
    foreach ($rows as $row) {
        $reports[] = reportFromRow($row);
    }
    respond(200, ['reports' => $reports]);
}

function createReport(PDO $db): void
{
    $data = readJson();
    $category = trim((string) ($data['category'] ?? ''));
    $place = trim((string) ($data['place'] ?? ''));
    $animal = trim((string) ($data['animal'] ?? ''));
    $description = trim((string) ($data['description'] ?? ''));
    $urgency = URGENCY_TO_DB[(string) ($data['urgency'] ?? 'Srednja')] ?? 'MEDIUM';
    $anonymous = !empty($data['anonymous']);
    $flags = array_values(array_filter(array_map('strval', $data['flags'] ?? [])));

    if ($category === '' || $place === '' || $animal === '' || $description === '') {
        respond(422, ['error' => 'Missing required report fields.']);
    }

    $reportId = makeId('rep');
    $publicCode = makePublicCode($db);
    $historyId = makeId('hist');
    $now = date('Y-m-d H:i:s');

    try {
        $db->beginTransaction();

        $statement = $db->prepare(
            'INSERT INTO `Report`
             (`id`, `publicCode`, `category`, `animalType`, `description`, `locationText`, `urgency`, `status`, `isAnonymous`, `createdAt`, `updatedAt`)
             VALUES (?, ?, ?, ?, ?, ?, ?, "RECEIVED", ?, ?, ?)'
        );
        $statement->execute([
            $reportId,
            $publicCode,
            $category,
            $animal,
            $description,
            $place,
            $urgency,
            $anonymous ? 1 : 0,
            $now,
            $now,
        ]);

        if ($category === 'Pas na lancu') {
            $statement = $db->prepare(
                'INSERT INTO `ChainDetails`
                 (`id`, `reportId`, `hasWater`, `hasFood`, `hasShelter`, `visibleInjuries`, `notes`)
                 VALUES (?, ?, ?, ?, ?, ?, ?)'
            );
            $statement->execute([
                makeId('chain'),
                $reportId,
                in_array('Nema vode', $flags, true) ? 0 : 1,
                in_array('Nema hrane', $flags, true) ? 0 : 1,
                in_array('Nema zaklona', $flags, true) ? 0 : 1,
                in_array('Vidljive ozljede', $flags, true) ? 1 : 0,
                $flags ? implode(', ', $flags) : null,
            ]);
        }

        $statement = $db->prepare(
            'INSERT INTO `ReportStatusHistory`
             (`id`, `reportId`, `fromStatus`, `toStatus`, `action`, `note`, `createdAt`)
             VALUES (?, ?, NULL, "RECEIVED", "CREATED", ?, ?)'
        );
        $statement->execute([$historyId, $reportId, 'Prijava zaprimljena putem javnog obrasca.', $now]);

        $db->commit();
    } catch (Throwable) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        respond(500, ['error' => 'Could not save report.']);
    }

    respond(201, [
        'report' => [
            'id' => $publicCode,
            'category' => $category,
            'place' => $place,
            'urgency' => URGENCY_FROM_DB[$urgency],
            'status' => 'Zaprimljeno',
            'animal' => $animal,
            'description' => $description,
            'flags' => $flags,
            'anonymous' => $anonymous,
        ],
    ]);
}

function updateStatus(PDO $db): void
{
    $data = readJson();
    $publicCode = trim((string) ($data['id'] ?? ''));
    $status = STATUS_TO_DB[(string) ($data['status'] ?? '')] ?? null;

    if ($publicCode === '' || $status === null) {
        respond(422, ['error' => 'Missing report id or status.']);
    }

    $statement = $db->prepare('SELECT `id`, `status` FROM `Report` WHERE `publicCode` = ? LIMIT 1');
    $statement->execute([$publicCode]);
    $report = $statement->fetch();

    if (!$report) {
        respond(404, ['error' => 'Report not found.']);
    }

    $now = date('Y-m-d H:i:s');

    try {
        $db->beginTransaction();

        $statement = $db->prepare('UPDATE `Report` SET `status` = ?, `updatedAt` = ?, `closedAt` = ? WHERE `id` = ?');
        $statement->execute([
            $status,
            $now,
            $status === 'CLOSED' ? $now : null,
            $report['id'],
        ]);

        $statement = $db->prepare(
            'INSERT INTO `ReportStatusHistory`
             (`id`, `reportId`, `fromStatus`, `toStatus`, `action`, `note`, `createdAt`)
             VALUES (?, ?, ?, ?, "STATUS_CHANGED", ?, ?)'
        );
        $statement->execute([
            makeId('hist'),
            $report['id'],
            $report['status'],
            $status,
            'Status promijenjen iz operativnog pregleda.',
            $now,
        ]);

        $db->commit();
    } catch (Throwable) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        respond(500, ['error' => 'Could not update report status.']);
    }

    respond(200, ['id' => $publicCode, 'status' => STATUS_FROM_DB[$status]]);
}

$db = pdo();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    listReports($db);
}

if ($method === 'POST') {
    createReport($db);
}

if ($method === 'PATCH') {
    requireAdmin();
    updateStatus($db);
}

respond(405, ['error' => 'Method not allowed.']);
