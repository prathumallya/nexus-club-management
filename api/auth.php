<?php
// api/auth.php
require_once 'config.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

// ── POST /api/auth.php?action=send_otp ──
if ($method === 'POST' && $action === 'send_otp') {
    $body = getBody();
    $email = trim($body['email'] ?? '');

    if (!$email || !filter_var($email, FILTER_VALIDATE_EMAIL))
        respondError('Please enter a valid email address');

    $db = getDB();
    
    $db->query("CREATE TABLE IF NOT EXISTS email_otps (
        email VARCHAR(100) PRIMARY KEY,
        otp VARCHAR(6) NOT NULL,
        expires_at DATETIME NOT NULL
    )");

    $stmt = $db->prepare('SELECT student_id FROM students WHERE email = ?');
    $stmt->bind_param('s', $email);
    $stmt->execute();
    if ($stmt->get_result()->fetch_assoc())
        respondError('This email is already registered. Please sign in instead.', 409);

    $stmt = $db->prepare('SELECT expires_at FROM email_otps WHERE email = ?');
    $stmt->bind_param('s', $email);
    $stmt->execute();
    $existing = $stmt->get_result()->fetch_assoc();
    if ($existing && strtotime($existing['expires_at']) > time() + 300) {
        $wait_secs = strtotime($existing['expires_at']) - (time() + 300);
        respondError('Please wait ' . ceil($wait_secs / 60) . ' minutes before requesting another OTP.', 429);
    }

    $otp = sprintf('%06d', mt_rand(0, 999999));
    $expires_at = date('Y-m-d H:i:s', time() + 600); // 10 minutes

    $stmt = $db->prepare('INSERT INTO email_otps (email, otp, expires_at) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE otp = ?, expires_at = ?');
    $stmt->bind_param('sssss', $email, $otp, $expires_at, $otp, $expires_at);
    if (!$stmt->execute())
        respondError('Database error generating OTP.', 500);

    require_once 'mailer_helper.php';

    $content = "
        <p>Hi <strong style='color: #fff;'>{$name}</strong>,</p>
        <p>Thank you for registering at NEXUS! To verify your college email address and activate your student account, please use the following One-Time Password (OTP):</p>
        <div style='background-color: #1e293b; padding: 24px; border-radius: 12px; border: 1px solid rgba(99, 102, 241, 0.3); text-align: center; margin: 30px 0;'>
            <p style='margin: 0 0 10px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8;'>Your Verification Code</p>
            <div style='font-family: monospace; font-size: 42px; font-weight: 800; color: #6ee7ff; letter-spacing: 12px; padding: 10px;'>{$otp}</div>
        </div>
        <p style='margin-bottom:0; font-size: 14px; color: #94a3b8;'>This code will expire in 10 minutes. If you did not request this registration, please ignore this email.</p>
    ";
    
    $subject = 'Verify your email - NEXUS';
    $body = getEmailTemplate("Verify Your Account ✉️", $content);
    
    if (sendEmail($email, $subject, $body)) {
        respond(['message' => 'OTP sent successfully']);
    } else {
        respond(['message' => 'OTP generated (Email failed)', 'debug_otp' => $otp]);
    }
}

// ── POST /api/auth.php?action=register ──
if ($method === 'POST' && $action === 'register') {
    $body = getBody();
    $name  = trim($body['name']         ?? '');
    $email = trim($body['email']        ?? '');
    $pass  = trim($body['password']     ?? '');
    $sid   = trim($body['student_code'] ?? '');
    $otp   = trim($body['otp']          ?? '');

    if (!$name || !$email || !$pass || !$otp)
        respondError('Name, email, password and OTP are required');

    // Validate email format
    if (!filter_var($email, FILTER_VALIDATE_EMAIL))
        respondError('Please enter a valid email address');

    $db   = getDB();

    // Verify OTP
    $stmt = $db->prepare('SELECT expires_at FROM email_otps WHERE email = ? AND otp = ?');
    $stmt->bind_param('ss', $email, $otp);
    $stmt->execute();
    $res = $stmt->get_result()->fetch_assoc();
    
    if (!$res) respondError('Invalid OTP', 400);
    if (strtotime($res['expires_at']) < time()) respondError('OTP has expired', 400);
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
    
    $stmt = $db->prepare('DELETE FROM email_otps WHERE email = ?');
    $stmt->bind_param('s', $email);
    $stmt->execute();
    
    $token = jwtEncode(['id' => $id, 'email' => $email, 'name' => $name, 'role' => 'student', 'student_code' => $sid_val]);
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
        'id'           => $result['student_id'],
        'email'        => $email,
        'name'         => $result['name'],
        'role'         => 'student',
        'student_code' => $result['student_code']
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
