<?php
// ============================================================
// api/config.php
// ============================================================

define('DB_HOST', 'localhost');
define('DB_USER', 'root');
define('DB_PASS', '');
define('DB_NAME', 'club_management');
define('JWT_SECRET', 'nexus_secret_key_change_this_in_production');

// ── Database ──
function getDB() {
    $conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
    if ($conn->connect_error) {
        http_response_code(500);
        echo json_encode(['error' => 'Database connection failed: ' . $conn->connect_error]);
        exit;
    }
    $conn->set_charset('utf8mb4');
    return $conn;
}

// ── CORS ──
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Auth-Token');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// ── Helpers ──
function respond($data, $code = 200) {
    http_response_code($code);
    echo json_encode($data);
    exit;
}
function respondError($msg, $code = 400) {
    respond(['error' => $msg], $code);
}
function getBody() {
    return json_decode(file_get_contents('php://input'), true) ?? [];
}

// ── Get auth token — tries every possible location ──
// Apache on XAMPP often strips the Authorization header.
// We try 5 fallback methods so it works on every server config.
function getToken() {
    // 1. Standard Authorization header
    if (!empty($_SERVER['HTTP_AUTHORIZATION'])) {
        return trim(str_replace('Bearer', '', $_SERVER['HTTP_AUTHORIZATION']));
    }
    // 2. After Apache mod_rewrite redirect
    if (!empty($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
        return trim(str_replace('Bearer', '', $_SERVER['REDIRECT_HTTP_AUTHORIZATION']));
    }
    // 3. X-Auth-Token header (Apache never strips X-* headers)
    if (!empty($_SERVER['HTTP_X_AUTH_TOKEN'])) {
        return trim($_SERVER['HTTP_X_AUTH_TOKEN']);
    }
    // 4. apache_request_headers() — works on some configs
    if (function_exists('apache_request_headers')) {
        $h = apache_request_headers();
        if (!empty($h['Authorization']))   return trim(str_replace('Bearer', '', $h['Authorization']));
        if (!empty($h['authorization']))   return trim(str_replace('Bearer', '', $h['authorization']));
        if (!empty($h['X-Auth-Token']))    return trim($h['X-Auth-Token']);
        if (!empty($h['x-auth-token']))    return trim($h['x-auth-token']);
    }
    // 5. Query string fallback: ?_token=xxx
    if (!empty($_GET['_token'])) {
        return trim($_GET['_token']);
    }
    return '';
}

// ── JWT ──
function jwtEncode($payload) {
    $payload['exp'] = time() + (7 * 24 * 3600);
    $header  = b64e(json_encode(['alg'=>'HS256','typ'=>'JWT']));
    $payload = b64e(json_encode($payload));
    $sig     = b64e(hash_hmac('sha256', "$header.$payload", JWT_SECRET, true));
    return "$header.$payload.$sig";
}
function jwtDecode($token) {
    if (!$token) return null;
    $parts = explode('.', $token);
    if (count($parts) !== 3) return null;
    [$header, $payload, $sig] = $parts;
    $expected = b64e(hash_hmac('sha256', "$header.$payload", JWT_SECRET, true));
    if (!hash_equals($expected, $sig)) return null;
    $data = json_decode(b64d($payload), true);
    if (!$data || $data['exp'] < time()) return null;
    return $data;
}
function b64e($d) { return rtrim(strtr(base64_encode($d), '+/', '-_'), '='); }
function b64d($d) { return base64_decode(strtr($d, '-_', '+/') . str_repeat('=', 3-(3+strlen($d))%4)); }

// ── Auth middleware ──
function requireAuth() {
    $token = getToken();
    if (!$token) respondError('No token — please sign in first', 401);
    $user = jwtDecode($token);
    if (!$user) respondError('Session expired — please sign in again', 401);
    return $user;
}
function requireAdmin() {
    $user = requireAuth();
    if ($user['role'] !== 'admin') respondError('Admin access required', 403);
    return $user;
}

// ── Health check: visit /api/config.php?test=1 ──
if (isset($_GET['test'])) {
    $db    = getDB();
    $token = getToken();
    respond([
        'status'   => 'ok',
        'database' => DB_NAME,
        'php'      => PHP_VERSION,
        'counts'   => [
            'clubs'    => (int)$db->query('SELECT COUNT(*) n FROM club')->fetch_assoc()['n'],
            'admins'   => (int)$db->query('SELECT COUNT(*) n FROM admin')->fetch_assoc()['n'],
            'students' => (int)$db->query('SELECT COUNT(*) n FROM students')->fetch_assoc()['n'],
            'events'   => (int)$db->query('SELECT COUNT(*) n FROM events')->fetch_assoc()['n'],
        ],
        'token_method' => $token ? 'token found' : 'no token (expected for this test)',
        'headers_available' => [
            'HTTP_AUTHORIZATION'          => !empty($_SERVER['HTTP_AUTHORIZATION']) ? 'YES' : 'no',
            'REDIRECT_HTTP_AUTHORIZATION' => !empty($_SERVER['REDIRECT_HTTP_AUTHORIZATION']) ? 'YES' : 'no',
            'HTTP_X_AUTH_TOKEN'           => !empty($_SERVER['HTTP_X_AUTH_TOKEN']) ? 'YES' : 'no',
        ]
    ]);
}
