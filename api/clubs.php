<?php
// api/clubs.php
require_once 'config.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';
$id     = intval($_GET['id'] ?? 0);

// GET /api/clubs.php  — list all clubs
if ($method === 'GET' && !$action && !$id) {
    $db   = getDB();
    $res  = $db->query('SELECT * FROM club ORDER BY club_name');
    $rows = [];
    while ($r = $res->fetch_assoc()) $rows[] = $r;
    respond($rows);
}

// GET /api/clubs.php?id=5  — single club
if ($method === 'GET' && !$action && $id) {
    $db   = getDB();
    $stmt = $db->prepare('SELECT * FROM club WHERE club_id = ?');
    $stmt->bind_param('i', $id);
    $stmt->execute();
    $row  = $stmt->get_result()->fetch_assoc();
    if (!$row) respondError('Club not found', 404);
    respond($row);
}

// POST /api/clubs.php?action=apply&id=5  — student applies by club_id
if ($method === 'POST' && $action === 'apply' && $id) {
    $user = requireAuth();
    $body = getBody();
    $why  = trim($body['why_join']     ?? '');
    $sk   = trim($body['skills']       ?? '');
    $av   = trim($body['availability'] ?? '');
    $sid  = $user['id'];

    $db   = getDB();
    $stmt = $db->prepare(
        'INSERT INTO membership (student_id, club_id, why_join, skills, availability) VALUES (?,?,?,?,?)'
    );
    $stmt->bind_param('iisss', $sid, $id, $why, $sk, $av);
    if (!$stmt->execute()) {
        if ($db->errno == 1062) respondError('Already applied to this club', 409);
        respondError('Application failed: ' . $db->error, 500);
    }
    respond(['message' => 'Application submitted', 'membership_id' => $stmt->insert_id]);
}

// POST /api/clubs.php?action=apply_by_name  — student applies by club_name (fallback when club has no DB id yet)
if ($method === 'POST' && $action === 'apply_by_name') {
    $user      = requireAuth();
    $body      = getBody();
    $club_name = trim($body['club_name'] ?? '');
    $why       = trim($body['why_join']  ?? '');
    $sk        = trim($body['skills']    ?? '');
    $av        = trim($body['availability'] ?? '');
    $sid       = $user['id'];

    if (!$club_name) respondError('club_name required');

    $db   = getDB();
    // Look up club_id by name
    $lk   = $db->prepare('SELECT club_id FROM club WHERE club_name = ?');
    $lk->bind_param('s', $club_name);
    $lk->execute();
    $row  = $lk->get_result()->fetch_assoc();
    if (!$row) respondError('Club not found: ' . $club_name, 404);
    $club_id = $row['club_id'];

    $stmt = $db->prepare(
        'INSERT INTO membership (student_id, club_id, why_join, skills, availability) VALUES (?,?,?,?,?)'
    );
    $stmt->bind_param('iisss', $sid, $club_id, $why, $sk, $av);
    if (!$stmt->execute()) {
        if ($db->errno == 1062) respondError('Already applied to this club', 409);
        respondError('Application failed: ' . $db->error, 500);
    }
    respond(['message' => 'Application submitted', 'membership_id' => $stmt->insert_id]);
}

// GET /api/clubs.php?action=members&id=5  — admin: view applications
if ($method === 'GET' && $action === 'members' && $id) {
    $admin = requireAdmin();
    $db    = getDB();
    $stmt  = $db->prepare(
        'SELECT m.membership_id, m.status, m.created_at, m.why_join, m.skills, m.availability,
                s.student_id, s.name, s.email, s.department, s.student_code, s.year
         FROM membership m JOIN students s ON m.student_id = s.student_id
         WHERE m.club_id = ? ORDER BY m.created_at DESC'
    );
    $stmt->bind_param('i', $id);
    $stmt->execute();
    $res  = $stmt->get_result();
    $rows = [];
    while ($r = $res->fetch_assoc()) $rows[] = $r;
    respond($rows);
}

// PATCH /api/clubs.php?action=review&id={membership_id}  — admin accept/reject
if ($method === 'PATCH' && $action === 'review' && $id) {
    $admin  = requireAdmin();
    $body   = getBody();
    $status = $body['status'] ?? '';
    if (!in_array($status, ['accepted','rejected','pending'])) respondError('Invalid status');
    $aid  = $admin['id'];
    $db   = getDB();
    $stmt = $db->prepare(
        'UPDATE membership SET status=?, reviewed_by=?, reviewed_at=NOW() WHERE membership_id=?'
    );
    $stmt->bind_param('sii', $status, $aid, $id);
    $stmt->execute();
    respond(['message' => 'Status updated']);
}
// POST /api/clubs.php?action=leave  — student leaves a club voluntarily
if ($method === 'POST' && $action === 'leave') {
    $user = requireAuth();
    $body = getBody();
    $membership_id = intval($body['membership_id'] ?? 0);
    $reason = trim($body['reason'] ?? 'No reason provided');

    if (!$membership_id) respondError('Membership ID required');

    $db = getDB();
    
    // First, fetch the membership, club, and student details
    $stmt = $db->prepare('
        SELECT m.status, c.club_id, c.club_name, a.email AS admin_email, s.name AS student_name, s.student_code
        FROM membership m
        JOIN club c ON m.club_id = c.club_id
        LEFT JOIN admin a ON c.club_id = a.club_id
        JOIN students s ON m.student_id = s.student_id
        WHERE m.membership_id = ? AND m.student_id = ?
    ');
    $stmt->bind_param('ii', $membership_id, $user['id']);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();

    if (!$row) respondError('Membership not found or unauthorized', 404);

    // Delete the membership
    $del = $db->prepare('DELETE FROM membership WHERE membership_id = ?');
    $del->bind_param('i', $membership_id);
    $del->execute();

    // If they were an accepted member, decrement the member_count
    if ($row['status'] === 'accepted') {
        $db->query('UPDATE club SET member_count = GREATEST(member_count-1,0) WHERE club_id = ' . $row['club_id']);
    }

    // Send email to admin
    if (!empty($row['admin_email'])) {
        require_once 'mailer_helper.php';
        $subject = 'Member Left: ' . $row['club_name'];
        $bodyHtml = getEmailTemplate('Member Left', '
            <p><strong>' . htmlspecialchars($row['student_name']) . '</strong> (' . htmlspecialchars($row['student_code']) . ') has voluntarily left <strong>' . htmlspecialchars($row['club_name']) . '</strong>.</p>
            <p><strong>Reason provided:</strong></p>
            <blockquote style="border-left: 4px solid #a855f7; padding-left: 12px; color: #94a3b8; font-style: italic;">' . nl2br(htmlspecialchars($reason)) . '</blockquote>
        ');
        sendEmail($row['admin_email'], $subject, $bodyHtml);
    }

    respond(['message' => 'Successfully left the club']);
}

respondError('Invalid request', 404);
