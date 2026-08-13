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
    $path = sys_get_temp_dir() . '/andeoske_rate_' . $key . '.json';
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

    if ($startedAt <= 0 || $elapsedMs < 2500 || $elapsedMs > 7200000) {
        respond(422, ['error' => 'Submission timing failed validation.']);
    }

    enforceRateLimit();
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
    if (!empty($row['reportFlags'])) {
        return array_values(array_filter(array_map('trim', explode('||', (string) $row['reportFlags']))));
    }

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

function coordinateFromData(array $data, string $key, float $min, float $max): ?string
{
    if (!array_key_exists($key, $data) || $data[$key] === null || $data[$key] === '') {
        return null;
    }

    if (!is_numeric($data[$key])) {
        respond(422, ['error' => "{$key} must be numeric."]);
    }

    $value = (float) $data[$key];
    if ($value < $min || $value > $max) {
        respond(422, ['error' => "{$key} is out of range."]);
    }

    return number_format($value, 7, '.', '');
}

function selectedFlags(array $data): array
{
    $flags = [];

    foreach (($data['flags'] ?? []) as $flag) {
        $label = trim((string) $flag);
        if ($label === '') {
            continue;
        }

        if (mb_strlen($label) > 100) {
            respond(422, ['error' => 'Selected details are too long.']);
        }

        $flags[] = $label;
    }

    return array_values(array_unique($flags));
}

function attachmentKind(string $mimeType): string
{
    if (strpos($mimeType, 'video/') === 0) {
        return 'VIDEO';
    }

    return 'PHOTO';
}

function maskContact(?string $value): ?string
{
    $value = trim((string) $value);
    if ($value === '') {
        return null;
    }

    $characters = preg_split('//u', $value, -1, PREG_SPLIT_NO_EMPTY);
    if (!$characters || count($characters) <= 2) {
        return str_repeat('*', max(1, strlen($value)));
    }

    return $characters[0] . str_repeat('*', max(3, count($characters) - 2)) . $characters[count($characters) - 1];
}

function extensionForMime(string $mimeType): ?string
{
    return match ($mimeType) {
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
        'image/gif' => 'gif',
        'video/mp4' => 'mp4',
        'video/webm' => 'webm',
        'video/quicktime' => 'mov',
        default => null,
    };
}

function saveAttachments(PDO $db, string $reportId, array $attachments, string $now): void
{
    $attachments = array_slice($attachments, 0, 6);
    if (!$attachments) {
        return;
    }

    $directory = __DIR__ . '/../uploads/reports';
    if (!is_dir($directory) && !mkdir($directory, 0755, true) && !is_dir($directory)) {
        respond(500, ['error' => 'Could not prepare upload directory.']);
    }

    foreach ($attachments as $attachment) {
        if (!is_array($attachment)) {
            continue;
        }

        $dataUrl = (string) ($attachment['dataUrl'] ?? '');
        $fileName = trim((string) ($attachment['fileName'] ?? 'privitak'));
        $mimeType = trim((string) ($attachment['mimeType'] ?? ''));
        $byteSize = (int) ($attachment['byteSize'] ?? 0);
        $extension = extensionForMime($mimeType);

        if ($extension === null || $byteSize <= 0 || $byteSize > 8 * 1024 * 1024) {
            respond(422, ['error' => 'Attachment type or size is not allowed.']);
        }

        if (!preg_match('/^data:([^;]+);base64,(.+)$/', $dataUrl, $matches)) {
            respond(422, ['error' => 'Invalid attachment data.']);
        }

        if ($matches[1] !== $mimeType) {
            respond(422, ['error' => 'Attachment MIME mismatch.']);
        }

        $binary = base64_decode($matches[2], true);
        if ($binary === false || strlen($binary) !== $byteSize) {
            respond(422, ['error' => 'Attachment data is corrupted.']);
        }

        $storageName = makeId('att') . '.' . $extension;
        $storageKey = 'uploads/reports/' . $storageName;
        $targetPath = $directory . '/' . $storageName;

        if (file_put_contents($targetPath, $binary, LOCK_EX) === false) {
            respond(500, ['error' => 'Could not save attachment.']);
        }

        $statement = $db->prepare(
            'INSERT INTO `ReportAttachment`
             (`id`, `reportId`, `kind`, `fileName`, `storageKey`, `mimeType`, `byteSize`, `exifStripped`, `createdAt`)
             VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)'
        );
        $statement->execute([
            makeId('file'),
            $reportId,
            attachmentKind($mimeType),
            mb_substr($fileName, 0, 180),
            $storageKey,
            $mimeType,
            $byteSize,
            $now,
        ]);
    }
}

function subcategoryIds(PDO $db, string $category, array $flags): array
{
    if (!$flags) {
        return [];
    }

    $statement = $db->prepare(
        'SELECT s.`id`, s.`label`
         FROM `ReportSubcategory` s
         INNER JOIN `ReportCategory` c ON c.`id` = s.`categoryId`
         WHERE c.`name` = ? AND c.`isActive` = 1 AND s.`isActive` = 1'
    );
    $statement->execute([$category]);

    $ids = [];
    foreach ($statement->fetchAll() as $row) {
        $ids[$row['label']] = $row['id'];
    }

    return $ids;
}

function reportFromRow(array $row): array
{
    $attachments = $row['attachments'] ? json_decode((string) $row['attachments'], true) : [];
    if (!is_array($attachments)) {
        $attachments = [];
    }

    $attachments = array_values(array_filter(
        $attachments,
        fn ($attachment): bool => is_array($attachment)
            && !empty($attachment['url'])
            && !empty($attachment['mimeType'])
            && !empty($attachment['fileName']),
    ));

    return [
        'id' => $row['publicCode'],
        'dbId' => $row['reportId'],
        'category' => $row['category'],
        'place' => $row['locationText'],
        'latitude' => $row['latitude'] !== null ? (float) $row['latitude'] : null,
        'longitude' => $row['longitude'] !== null ? (float) $row['longitude'] : null,
        'urgency' => URGENCY_FROM_DB[$row['urgency']] ?? 'Srednja',
        'status' => STATUS_FROM_DB[$row['status']] ?? 'Zaprimljeno',
        'animal' => $row['animalType'],
        'description' => $row['description'],
        'reporterEmail' => (bool) $row['isAnonymous'] ? maskContact($row['reporterEmail']) : $row['reporterEmail'],
        'reporterPhone' => (bool) $row['isAnonymous'] ? maskContact($row['reporterPhone']) : $row['reporterPhone'],
        'flags' => flagsFromRow($row),
        'anonymous' => (bool) $row['isAnonymous'],
        'regionId' => $row['regionId'],
        'regionName' => $row['regionName'],
        'assignedToId' => $row['assignedToId'],
        'assignedToName' => $row['assignedToName'],
        'organizationId' => $row['organizationId'],
        'organizationName' => $row['organizationName'],
        'attachments' => $attachments,
        'notifications' => [],
        'statusHistory' => [],
    ];
}

function listReports(PDO $db): void
{
    $rows = $db->query(
        'SELECT
            r.`id` AS `reportId`,
            r.`publicCode`,
            r.`category`,
            r.`animalType`,
            r.`description`,
            r.`reporterEmail`,
            r.`reporterPhone`,
            r.`locationText`,
            r.`latitude`,
            r.`longitude`,
            r.`urgency`,
            r.`status`,
            r.`isAnonymous`,
            r.`regionId`,
            r.`assignedToId`,
            r.`organizationId`,
            region.`name` AS `regionName`,
            assignee.`name` AS `assignedToName`,
            org.`name` AS `organizationName`,
            GROUP_CONCAT(DISTINCT rf.`label` ORDER BY rf.`label` SEPARATOR "||") AS `reportFlags`,
            CONCAT(
                "[",
                COALESCE(
                    GROUP_CONCAT(
                        DISTINCT IF(
                            a.`id` IS NULL,
                            NULL,
                            JSON_OBJECT(
                                "url", CONCAT("/", a.`storageKey`),
                                "fileName", a.`fileName`,
                                "mimeType", a.`mimeType`,
                                "kind", a.`kind`
                            )
                        )
                        ORDER BY a.`createdAt`
                        SEPARATOR ","
                    ),
                    ""
                ),
                "]"
            ) AS `attachments`,
            c.`hasWater`,
            c.`hasFood`,
            c.`hasShelter`,
            c.`visibleInjuries`,
            c.`notes` AS `chainNotes`
         FROM `Report` r
         LEFT JOIN `Region` region ON region.`id` = r.`regionId`
         LEFT JOIN `User` assignee ON assignee.`id` = r.`assignedToId`
         LEFT JOIN `Organization` org ON org.`id` = r.`organizationId`
         LEFT JOIN `ReportFlag` rf ON rf.`reportId` = r.`id`
         LEFT JOIN `ReportAttachment` a ON a.`reportId` = r.`id`
         LEFT JOIN `ChainDetails` c ON c.`reportId` = r.`id`
         GROUP BY
            r.`id`,
            r.`publicCode`,
            r.`category`,
            r.`animalType`,
            r.`description`,
            r.`reporterEmail`,
            r.`reporterPhone`,
            r.`locationText`,
            r.`latitude`,
            r.`longitude`,
            r.`urgency`,
            r.`status`,
            r.`isAnonymous`,
            r.`regionId`,
            r.`assignedToId`,
            r.`organizationId`,
            r.`createdAt`,
            region.`name`,
            assignee.`name`,
            org.`name`,
            c.`hasWater`,
            c.`hasFood`,
            c.`hasShelter`,
            c.`visibleInjuries`,
            c.`notes`
         ORDER BY r.`createdAt` DESC
         LIMIT 100'
    )->fetchAll();

    $reports = [];
    $reportIds = [];
    foreach ($rows as $row) {
        $report = reportFromRow($row);
        $reports[$row['reportId']] = $report;
        $reportIds[] = $row['reportId'];
    }

    if ($reportIds) {
        $placeholders = implode(',', array_fill(0, count($reportIds), '?'));
        $statement = $db->prepare(
            "SELECT
                `id`,
                `reportId`,
                `recipientName`,
                `recipientEmail`,
                `status`,
                `responseStatus`,
                `respondedAt`,
                `createdAt`
             FROM `ReportNotification`
             WHERE `reportId` IN ({$placeholders})
             ORDER BY `createdAt` DESC"
        );
        $statement->execute($reportIds);

        foreach ($statement->fetchAll() as $notification) {
            $reportId = $notification['reportId'];
            if (!isset($reports[$reportId])) {
                continue;
            }

            $reports[$reportId]['notifications'][] = [
                'id' => $notification['id'],
                'recipientName' => $notification['recipientName'],
                'recipientEmail' => $notification['recipientEmail'],
                'status' => $notification['status'],
                'responseStatus' => $notification['responseStatus'],
                'respondedAt' => $notification['respondedAt'],
                'createdAt' => $notification['createdAt'],
            ];
        }

        $statement = $db->prepare(
            "SELECT
                h.`id`,
                h.`reportId`,
                h.`fromStatus`,
                h.`toStatus`,
                h.`action`,
                h.`note`,
                h.`createdAt`,
                u.`name` AS `changedByName`,
                u.`email` AS `changedByEmail`
             FROM `ReportStatusHistory` h
             LEFT JOIN `User` u ON u.`id` = h.`changedById`
             WHERE h.`reportId` IN ({$placeholders})
             ORDER BY h.`createdAt` DESC"
        );
        $statement->execute($reportIds);

        foreach ($statement->fetchAll() as $history) {
            $reportId = $history['reportId'];
            if (!isset($reports[$reportId])) {
                continue;
            }

            $reports[$reportId]['statusHistory'][] = [
                'id' => $history['id'],
                'fromStatus' => $history['fromStatus'] ? (STATUS_FROM_DB[$history['fromStatus']] ?? $history['fromStatus']) : null,
                'toStatus' => STATUS_FROM_DB[$history['toStatus']] ?? $history['toStatus'],
                'action' => $history['action'],
                'note' => $history['note'],
                'changedByName' => $history['changedByName'],
                'changedByEmail' => $history['changedByEmail'],
                'createdAt' => $history['createdAt'],
            ];
        }
    }

    respond(200, ['reports' => array_values($reports)]);
}

function publicStats(PDO $db): void
{
    $totalReports = (int) $db->query('SELECT COUNT(*) FROM `Report`')->fetchColumn();
    $resolvedReports = (int) $db->query('SELECT COUNT(*) FROM `Report` WHERE `status` = "CLOSED"')->fetchColumn();
    $volunteers = (int) $db->query(
        'SELECT COUNT(*) FROM `User` WHERE `isActive` = 1 AND `role` IN ("VOLUNTEER", "ADMIN")'
    )->fetchColumn();

    respond(200, [
        'stats' => [
            'totalReports' => $totalReports,
            'resolvedReports' => $resolvedReports,
            'volunteers' => $volunteers,
        ],
    ]);
}

function createReport(PDO $db): void
{
    $data = readJson();
    validateSubmissionSecurity($data);

    $category = trim((string) ($data['category'] ?? ''));
    $place = trim((string) ($data['place'] ?? ''));
    $animal = trim((string) ($data['animal'] ?? ''));
    $description = trim((string) ($data['description'] ?? ''));
    $reporterEmail = trim((string) ($data['reporterEmail'] ?? ''));
    $reporterPhone = trim((string) ($data['reporterPhone'] ?? ''));
    $urgency = URGENCY_TO_DB[(string) ($data['urgency'] ?? 'Srednja')] ?? 'MEDIUM';
    $anonymous = !empty($data['anonymous']);
    $latitude = coordinateFromData($data, 'latitude', -90, 90);
    $longitude = coordinateFromData($data, 'longitude', -180, 180);
    $flags = selectedFlags($data);
    $attachments = is_array($data['attachments'] ?? null) ? $data['attachments'] : [];

    if ($category === '' || $place === '' || $animal === '' || $description === '' || $reporterEmail === '' || $reporterPhone === '') {
        respond(422, ['error' => 'Missing required report fields.']);
    }

    if (!filter_var($reporterEmail, FILTER_VALIDATE_EMAIL)) {
        respond(422, ['error' => 'Valid email is required.']);
    }

    if (strlen($category) > 120 || strlen($place) > 240 || strlen($animal) > 120 || strlen($description) > 5000 || strlen($reporterEmail) > 190 || strlen($reporterPhone) > 80) {
        respond(422, ['error' => 'Report fields are too long.']);
    }

    $reportId = makeId('rep');
    $publicCode = makePublicCode($db);
    $historyId = makeId('hist');
    $now = date('Y-m-d H:i:s');

    try {
        $db->beginTransaction();

        $statement = $db->prepare(
            'INSERT INTO `Report`
             (`id`, `publicCode`, `category`, `animalType`, `description`, `reporterEmail`, `reporterPhone`, `locationText`, `latitude`, `longitude`, `urgency`, `status`, `isAnonymous`, `createdAt`, `updatedAt`)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, "RECEIVED", ?, ?, ?)'
        );
        $statement->execute([
            $reportId,
            $publicCode,
            $category,
            $animal,
            $description,
            $reporterEmail,
            $reporterPhone,
            $place,
            $latitude,
            $longitude,
            $urgency,
            $anonymous ? 1 : 0,
            $now,
            $now,
        ]);

        $subcategoryIds = subcategoryIds($db, $category, $flags);
        foreach ($flags as $flag) {
            $statement = $db->prepare(
                'INSERT INTO `ReportFlag` (`id`, `reportId`, `subcategoryId`, `label`, `createdAt`)
                 VALUES (?, ?, ?, ?, ?)'
            );
            $statement->execute([
                makeId('flag'),
                $reportId,
                $subcategoryIds[$flag] ?? null,
                $flag,
                $now,
            ]);
        }

        saveAttachments($db, $reportId, $attachments, $now);

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
            'reporterEmail' => $anonymous ? maskContact($reporterEmail) : $reporterEmail,
            'reporterPhone' => $anonymous ? maskContact($reporterPhone) : $reporterPhone,
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
    if (($_GET['stats'] ?? '') === '1') {
        publicStats($db);
    }

    requireAdmin();
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
