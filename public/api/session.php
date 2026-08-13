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
    respond(200, ['isAdmin' => !empty($_SESSION['is_admin'])]);
}

if ($method === 'POST') {
    $data = readJson();
    $username = (string) ($data['username'] ?? '');
    $password = (string) ($data['password'] ?? '');
    $env = loadEnv();

    if (!usernameMatches($username, $env) || !passwordMatches($password, $env)) {
        respond(401, ['error' => 'Invalid password.']);
    }

    session_regenerate_id(true);
    $_SESSION['is_admin'] = true;
    respond(200, ['isAdmin' => true]);
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
