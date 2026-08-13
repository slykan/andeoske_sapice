<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

const USER_ROLES = ['REPORTER', 'VOLUNTEER', 'ADMIN', 'ORGANIZATION'];
const REPORT_STATUSES = [
    'Zaprimljeno' => 'RECEIVED',
    'U provjeri' => 'IN_REVIEW',
    'Dodijeljeno' => 'ASSIGNED',
    'Proslijeđeno' => 'FORWARDED',
    'U tijeku' => 'IN_PROGRESS',
    'Zaključeno' => 'CLOSED',
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

function passwordHashFromData(array $data, bool $required): ?string
{
    $password = (string) ($data['password'] ?? '');

    if ($password === '') {
        if ($required) {
            respond(422, ['error' => 'Password is required.']);
        }

        return null;
    }

    if (strlen($password) < 8 || strlen($password) > 200) {
        respond(422, ['error' => 'Password must be between 8 and 200 characters.']);
    }

    return password_hash($password, PASSWORD_DEFAULT);
}

function listAdminData(PDO $db): void
{
    $regions = $db->query(
        'SELECT `id`, `name` FROM `Region` WHERE `isActive` = 1 ORDER BY `name` ASC'
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
         WHERE o.`isActive` = 1
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
         WHERE u.`isActive` = 1
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
             ON DUPLICATE KEY UPDATE `isActive` = 1, `updatedAt` = VALUES(`updatedAt`)'
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
    $passwordHash = passwordHashFromData($data, true);
    $now = date('Y-m-d H:i:s');

    try {
        $statement = $db->prepare(
            'INSERT INTO `User` (`id`, `email`, `passwordHash`, `name`, `phone`, `role`, `regionId`, `organizationId`, `createdAt`, `updatedAt`)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                `passwordHash` = VALUES(`passwordHash`),
                `name` = VALUES(`name`),
                `phone` = VALUES(`phone`),
                `role` = VALUES(`role`),
                `regionId` = VALUES(`regionId`),
                `organizationId` = VALUES(`organizationId`),
                `isActive` = 1,
                `updatedAt` = VALUES(`updatedAt`)'
        );
        $statement->execute([makeId('usr'), $email, $passwordHash, $name, $phone, $role, $regionId, $organizationId, $now, $now]);
    } catch (Throwable) {
        respond(500, ['error' => 'Could not save user.']);
    }

    listAdminData($db);
}

function requiredId(array $data): string
{
    $id = nullableString($data, 'id');
    if ($id === null) {
        respond(422, ['error' => 'Entity id is required.']);
    }

    return $id;
}

function updateRegion(PDO $db, array $data): void
{
    $id = requiredId($data);
    $name = nullableString($data, 'name', 80);
    if ($name === null) {
        respond(422, ['error' => 'Region name is required.']);
    }

    try {
        $statement = $db->prepare('UPDATE `Region` SET `name` = ?, `updatedAt` = ? WHERE `id` = ? AND `isActive` = 1');
        $statement->execute([$name, date('Y-m-d H:i:s'), $id]);
    } catch (Throwable) {
        respond(500, ['error' => 'Could not update region.']);
    }

    listAdminData($db);
}

function updateOrganization(PDO $db, array $data): void
{
    $id = requiredId($data);
    $name = nullableString($data, 'name', 120);
    if ($name === null) {
        respond(422, ['error' => 'Organization name is required.']);
    }

    $regionId = nullableId($db, $data, 'regionId', 'Region');
    $email = nullableString($data, 'email', 190);
    $phone = nullableString($data, 'phone', 80);
    $city = nullableString($data, 'city', 120);

    try {
        $statement = $db->prepare(
            'UPDATE `Organization`
             SET `name` = ?, `email` = ?, `phone` = ?, `city` = ?, `regionId` = ?, `updatedAt` = ?
             WHERE `id` = ? AND `isActive` = 1'
        );
        $statement->execute([$name, $email, $phone, $city, $regionId, date('Y-m-d H:i:s'), $id]);
    } catch (Throwable) {
        respond(500, ['error' => 'Could not update organization.']);
    }

    listAdminData($db);
}

function updateUser(PDO $db, array $data): void
{
    $id = requiredId($data);
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
    $passwordHash = passwordHashFromData($data, false);

    try {
        if ($passwordHash !== null) {
            $statement = $db->prepare(
                'UPDATE `User`
                 SET `email` = ?, `passwordHash` = ?, `name` = ?, `phone` = ?, `role` = ?, `regionId` = ?, `organizationId` = ?, `updatedAt` = ?
                 WHERE `id` = ? AND `isActive` = 1'
            );
            $statement->execute([$email, $passwordHash, $name, $phone, $role, $regionId, $organizationId, date('Y-m-d H:i:s'), $id]);
        } else {
            $statement = $db->prepare(
                'UPDATE `User`
                 SET `email` = ?, `name` = ?, `phone` = ?, `role` = ?, `regionId` = ?, `organizationId` = ?, `updatedAt` = ?
                 WHERE `id` = ? AND `isActive` = 1'
            );
            $statement->execute([$email, $name, $phone, $role, $regionId, $organizationId, date('Y-m-d H:i:s'), $id]);
        }
    } catch (Throwable) {
        respond(500, ['error' => 'Could not update user.']);
    }

    listAdminData($db);
}

function deleteRegion(PDO $db, array $data): void
{
    $id = requiredId($data);
    $now = date('Y-m-d H:i:s');

    try {
        $db->beginTransaction();
        $db->prepare('UPDATE `Report` SET `regionId` = NULL, `updatedAt` = ? WHERE `regionId` = ?')->execute([$now, $id]);
        $db->prepare('UPDATE `Organization` SET `regionId` = NULL, `updatedAt` = ? WHERE `regionId` = ?')->execute([$now, $id]);
        $db->prepare('UPDATE `User` SET `regionId` = NULL, `updatedAt` = ? WHERE `regionId` = ?')->execute([$now, $id]);
        $db->prepare('UPDATE `Region` SET `isActive` = 0, `updatedAt` = ? WHERE `id` = ?')->execute([$now, $id]);
        $db->commit();
    } catch (Throwable) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        respond(500, ['error' => 'Could not delete region.']);
    }

    listAdminData($db);
}

function deleteOrganization(PDO $db, array $data): void
{
    $id = requiredId($data);
    $now = date('Y-m-d H:i:s');

    try {
        $db->beginTransaction();
        $db->prepare('UPDATE `Report` SET `organizationId` = NULL, `updatedAt` = ? WHERE `organizationId` = ?')->execute([$now, $id]);
        $db->prepare('UPDATE `User` SET `organizationId` = NULL, `updatedAt` = ? WHERE `organizationId` = ?')->execute([$now, $id]);
        $db->prepare('UPDATE `Organization` SET `isActive` = 0, `updatedAt` = ? WHERE `id` = ?')->execute([$now, $id]);
        $db->commit();
    } catch (Throwable) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        respond(500, ['error' => 'Could not delete organization.']);
    }

    listAdminData($db);
}

function deleteUser(PDO $db, array $data): void
{
    $id = requiredId($data);
    $now = date('Y-m-d H:i:s');

    try {
        $db->beginTransaction();
        $db->prepare('UPDATE `Report` SET `assignedToId` = NULL, `updatedAt` = ? WHERE `assignedToId` = ?')->execute([$now, $id]);
        $db->prepare('UPDATE `User` SET `isActive` = 0, `updatedAt` = ? WHERE `id` = ?')->execute([$now, $id]);
        $db->commit();
    } catch (Throwable) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        respond(500, ['error' => 'Could not delete user.']);
    }

    listAdminData($db);
}

function cleanMailHeader(string $value): string
{
    return trim(str_replace(["\r", "\n"], '', $value));
}

function sendVolunteerMail(array $report, string $recipientName, string $recipientEmail): array
{
    $env = loadEnv();
    $from = cleanMailHeader((string) ($env['MAIL_FROM'] ?? getenv('MAIL_FROM') ?: 'noreply@andeoske-sapice.app'));
    $replyTo = cleanMailHeader((string) ($env['MAIL_REPLY_TO'] ?? getenv('MAIL_REPLY_TO') ?: $from));
    $host = cleanMailHeader((string) ($_SERVER['HTTP_HOST'] ?? 'andeoske-sapice.app'));
    $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'https';
    $adminUrl = "{$scheme}://{$host}/admin";
    $subject = 'Dodijeljena prijava ' . $report['publicCode'];
    $statusLabel = array_search($report['status'], REPORT_STATUSES, true) ?: $report['status'];

    $body = implode("\n", [
        "Pozdrav {$recipientName},",
        '',
        'Dodijeljena ti je prijava u sustavu Andeoske sapice.',
        '',
        'Broj prijave: ' . $report['publicCode'],
        'Kategorija: ' . $report['category'],
        'Lokacija: ' . $report['locationText'],
        'Status: ' . $statusLabel,
        '',
        'Admin: ' . $adminUrl,
        '',
        'Ova obavijest je poslana iz admin sucelja.',
    ]);

    $headers = implode("\r\n", [
        "From: Andeoske Sapice <{$from}>",
        "Reply-To: {$replyTo}",
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
    ]);

    $sent = @mail($recipientEmail, $subject, $body, $headers);

    return [
        'sent' => $sent,
        'subject' => $subject,
        'error' => $sent ? null : 'Server mail() nije prihvatio poruku.',
    ];
}

function notifyVolunteer(PDO $db, array $data): void
{
    $publicCode = nullableString($data, 'reportId', 80);
    if ($publicCode === null) {
        respond(422, ['error' => 'Report id is required.']);
    }

    $statement = $db->prepare(
        'SELECT
            r.`id`,
            r.`publicCode`,
            r.`category`,
            r.`locationText`,
            r.`status`,
            u.`id` AS `userId`,
            u.`email`,
            u.`name`
         FROM `Report` r
         LEFT JOIN `User` u ON u.`id` = r.`assignedToId` AND u.`isActive` = 1
         WHERE r.`publicCode` = ?
         LIMIT 1'
    );
    $statement->execute([$publicCode]);
    $report = $statement->fetch();

    if (!$report) {
        respond(404, ['error' => 'Report not found.']);
    }

    $recipientEmail = trim((string) ($report['email'] ?? ''));
    if ($recipientEmail === '' || !filter_var($recipientEmail, FILTER_VALIDATE_EMAIL)) {
        respond(422, ['error' => 'Assigned volunteer has no valid email.']);
    }

    $recipientName = trim((string) ($report['name'] ?? ''));
    if ($recipientName === '') {
        $recipientName = $recipientEmail;
    }

    $mail = sendVolunteerMail($report, $recipientName, $recipientEmail);
    $now = date('Y-m-d H:i:s');
    $status = $mail['sent'] ? 'SENT' : 'FAILED';

    try {
        $statement = $db->prepare(
            'INSERT INTO `ReportNotification`
             (`id`, `reportId`, `userId`, `recipientName`, `recipientEmail`, `status`, `subject`, `error`, `createdAt`)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        $statement->execute([
            makeId('notif'),
            $report['id'],
            $report['userId'],
            $recipientName,
            $recipientEmail,
            $status,
            $mail['subject'],
            $mail['error'],
            $now,
        ]);
    } catch (Throwable) {
        respond(500, ['error' => 'Could not save notification log.']);
    }

    if (!$mail['sent']) {
        respond(500, ['error' => 'Notification email could not be sent.']);
    }

    respond(200, ['ok' => true]);
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
    $status = REPORT_STATUSES[(string) ($data['status'] ?? '')] ?? null;
    $now = date('Y-m-d H:i:s');

    if ($status === null) {
        respond(422, ['error' => 'Valid status is required.']);
    }

    if (($organizationId !== null || $assignedToId !== null) && $regionId === null) {
        respond(422, ['error' => 'Region is required before assignment.']);
    }

    if ($organizationId !== null) {
        $statement = $db->prepare('SELECT COUNT(*) FROM `Organization` WHERE `id` = ? AND `regionId` = ? AND `isActive` = 1');
        $statement->execute([$organizationId, $regionId]);
        if ((int) $statement->fetchColumn() === 0) {
            respond(422, ['error' => 'Organization does not belong to selected region.']);
        }
    }

    if ($assignedToId !== null) {
        $statement = $db->prepare('SELECT COUNT(*) FROM `User` WHERE `id` = ? AND `regionId` = ? AND `isActive` = 1');
        $statement->execute([$assignedToId, $regionId]);
        if ((int) $statement->fetchColumn() === 0) {
            respond(422, ['error' => 'User does not belong to selected region.']);
        }
    }

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
             SET `regionId` = ?, `organizationId` = ?, `assignedToId` = ?, `status` = ?, `updatedAt` = ?, `closedAt` = ?
             WHERE `id` = ?'
        );
        $statement->execute([
            $regionId,
            $organizationId,
            $assignedToId,
            $status,
            $now,
            $status === 'CLOSED' ? $now : null,
            $report['id'],
        ]);

        if ($report['status'] !== $status) {
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
                'Status i dodjela spremljeni iz admin pregleda.',
                $now,
            ]);
        }

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
    if (($data['type'] ?? '') === 'notifyVolunteer') {
        notifyVolunteer($db, $data);
    }

    if (($data['type'] ?? '') === 'assignment') {
        assignReport($db, $data);
    }

    if (($data['type'] ?? '') === 'region') {
        updateRegion($db, $data);
    }

    if (($data['type'] ?? '') === 'organization') {
        updateOrganization($db, $data);
    }

    if (($data['type'] ?? '') === 'user') {
        updateUser($db, $data);
    }

    respond(422, ['error' => 'Unsupported admin update type.']);
}

if ($method === 'DELETE') {
    $data = readJson();

    if (($data['type'] ?? '') === 'region') {
        deleteRegion($db, $data);
    }

    if (($data['type'] ?? '') === 'organization') {
        deleteOrganization($db, $data);
    }

    if (($data['type'] ?? '') === 'user') {
        deleteUser($db, $data);
    }

    respond(422, ['error' => 'Unsupported admin delete type.']);
}

respond(405, ['error' => 'Method not allowed.']);
