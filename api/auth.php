<?php
// api/auth.php
require_once 'config.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

// ── POST /api/auth.php?action=register ──
if ($method === 'POST' && $action === 'register') {
    $body = getBody();
    $name  = trim($body['name']         ?? '');
    $email = trim($body['email']        ?? '');
    $pass  = trim($body['password']     ?? '');
    $sid   = trim($body['student_code'] ?? '');

    if (!$name || !$email || !$pass)
        respondError('Name, email and password are required');

    // Validate email format
    if (!filter_var($email, FILTER_VALIDATE_EMAIL))
        respondError('Please enter a valid email address');

    $db   = getDB();
    $hash = password_hash($pass, PASSWORD_BCRYPT);

    // Use NULL for student_code if empty — avoids UNIQUE constraint clash on blank
    $sid_val = $sid !== '' ? $sid : null;

    $stmt = $db->prepare(
        'INSERT INTO students (name, email, student_code, password) VALUES (?,?,?,?)'
    );
    $stmt->bind_param('ssss', $name, $email, $sid_val, $hash);

    if (!$stmt->execute()) {
        // Identify which unique field caused the conflict
        if ($db->errno == 1062) {
            if (strpos($db->error, 'email') !== false) {
                respondError('This email is already registered. Please sign in instead.', 409);
            } elseif (strpos($db->error, 'student_code') !== false) {
                respondError('This Student ID is already registered. Leave it blank or use a different one.', 409);
            }
            respondError('An account with these details already exists.', 409);
        }
        respondError('Registration failed: ' . $db->error, 500);
    }

    $id    = $stmt->insert_id;
    $token = jwtEncode(['id' => $id, 'email' => $email, 'name' => $name, 'role' => 'student']);
    respond(['token' => $token, 'user' => [
        'id'    => $id,
        'name'  => $name,
        'email' => $email,
        'role'  => 'student'
    ]]);
}

// ── POST /api/auth.php?action=login ──
if ($method === 'POST' && $action === 'login') {
    $body  = getBody();
    $email = trim($body['email']    ?? '');
    $pass  = trim($body['password'] ?? '');

    if (!$email || !$pass) respondError('Email and password required');

    $db   = getDB();
    $stmt = $db->prepare(
        'SELECT student_id, name, email, department, student_code, year, password
         FROM students WHERE email = ?'
    );
    $stmt->bind_param('s', $email);
    $stmt->execute();
    $result = $stmt->get_result()->fetch_assoc();

    if (!$result)
        respondError('No account found with this email. Please register first.', 401);

    if (!password_verify($pass, $result['password']))
        respondError('Incorrect password. Please try again.', 401);

    $token = jwtEncode([
        'id'    => $result['student_id'],
        'email' => $email,
        'name'  => $result['name'],
        'role'  => 'student'
    ]);
    respond(['token' => $token, 'user' => [
        'id'           => $result['student_id'],
        'name'         => $result['name'],
        'email'        => $email,
        'department'   => $result['department'],
        'student_code' => $result['student_code'],
        'year'         => $result['year'],
        'role'         => 'student'
    ]]);
}

// ── POST /api/auth.php?action=admin_login ──
if ($method === 'POST' && $action === 'admin_login') {
    $body  = getBody();
    $email = trim($body['email']    ?? '');
    $pass  = trim($body['password'] ?? '');

    if (!$email || !$pass) respondError('Email and password required');

    $db   = getDB();
    $stmt = $db->prepare(
        'SELECT a.admin_id, a.name, a.email, a.password, a.club_id,
                c.club_name, c.icon, c.color
         FROM admin a
         JOIN club c ON a.club_id = c.club_id
         WHERE a.email = ?'
    );
    $stmt->bind_param('s', $email);
    $stmt->execute();
    $admin = $stmt->get_result()->fetch_assoc();

    if (!$admin)
        respondError('No admin account found with this email.', 401);

    // Detect if setup.php has not been run yet
    if ($admin['password'] === 'run_setup.php' || strlen($admin['password']) < 20)
        respondError('Admin passwords not set up yet. Please run setup.php first: setup.php (in your project folder)', 403);

    if (!password_verify($pass, $admin['password']))
        respondError('Incorrect password. Please try again.', 401);

    $token = jwtEncode([
        'id'      => $admin['admin_id'],
        'email'   => $email,
        'role'    => 'admin',
        'club_id' => $admin['club_id']
    ]);
    respond(['token' => $token, 'admin' => [
        'id'        => $admin['admin_id'],
        'name'      => $admin['name'],
        'email'     => $email,
        'club_id'   => $admin['club_id'],
        'club_name' => $admin['club_name'],
        'icon'      => $admin['icon'],
        'color'     => $admin['color']
    ]]);
}

respondError('Invalid action', 404);
