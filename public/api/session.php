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

function userByEmail(PDO $db, string $email): ?array
{
    $statement = $db->prepare(
        "SELECT `id`, `email`, `name`, `passwordHash`, `role`, `regionId`, `organizationId`
         FROM `User`
         WHERE `email` = ? AND `isActive` = 1 AND `role` IN ('ADMIN', 'VOLUNTEER', 'ORGANIZATION')
         LIMIT 1"
    );
    $statement->execute([$email]);
    $user = $statement->fetch();

    return $user ?: null;
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

function passwordMatches(string $password, array $env): bool
{
    $hash = $env['ADMIN_PASSWORD_HASH'] ?? getenv('ADMIN_PASSWORD_HASH') ?: '';
    if ($hash !== '') {
        return password_verify($password, $hash);
    }

    $plain = $env['ADMIN_PASSWORD'] ?? getenv('ADMIN_PASSWORD') ?: '';
    return $plain !== '' && hash_equals($plain, $password);
}

function usernameMatches(string $username, array $env): bool
{
    $expected = trim((string) (
        $env['ADMIN_USERNAME']
        ?? $env['ADMIN_EMAIL']
        ?? getenv('ADMIN_USERNAME')
        ?: getenv('ADMIN_EMAIL')
        ?: ''
    ));

    if ($expected === '') {
        return true;
    }

    return hash_equals(mb_strtolower($expected), mb_strtolower(trim($username)));
}

startAdminSession();

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    respond(200, [
        'isAdmin' => !empty($_SESSION['is_admin']),
        'username' => $_SESSION['admin_username'] ?? null,
        'role' => $_SESSION['user_role'] ?? ($_SESSION['is_admin'] ?? false ? 'ADMIN' : null),
    ]);
}

if ($method === 'POST') {
    $data = readJson();
    $username = (string) ($data['username'] ?? '');
    $password = (string) ($data['password'] ?? '');
    $env = loadEnv();

    if (usernameMatches($username, $env) && passwordMatches($password, $env)) {
        session_regenerate_id(true);
        $_SESSION['is_admin'] = true;
        $_SESSION['admin_username'] = trim($username);
        $_SESSION['user_role'] = 'ADMIN';
        $_SESSION['user_id'] = null;
        $_SESSION['user_region_id'] = null;
        $_SESSION['user_organization_id'] = null;
        respond(200, ['isAdmin' => true, 'role' => 'ADMIN']);
    }

    $user = userByEmail(pdo(), trim($username));
    if (!$user || $user['passwordHash'] === null || !password_verify($password, $user['passwordHash'])) {
        respond(401, ['error' => 'Invalid password.']);
    }

    session_regenerate_id(true);
    $_SESSION['is_admin'] = true;
    $_SESSION['admin_username'] = $user['name'] ?: $user['email'];
    $_SESSION['user_role'] = $user['role'];
    $_SESSION['user_id'] = $user['id'];
    $_SESSION['user_region_id'] = $user['regionId'];
    $_SESSION['user_organization_id'] = $user['organizationId'];
    respond(200, ['isAdmin' => true, 'role' => $user['role']]);
}

if ($method === 'DELETE') {
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'] ?? '', $params['secure'], $params['httponly']);
    }
    session_destroy();
    respond(200, ['isAdmin' => false]);
}

respond(405, ['error' => 'Method not allowed.']);
