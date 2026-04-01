<?php
// api/teams.php
require_once 'config.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';
$id     = intval($_GET['id'] ?? 0);

// ── POST ?action=join — student joins via team code ──
if ($method === 'POST' && $action === 'join') {
    $user       = requireAuth();
    $student_id = $user['id'];
    $body       = getBody();
    $code       = strtoupper(trim($body['team_code'] ?? ''));
    if (!$code) respondError('team_code required');

    $db   = getDB();
    $stmt = $db->prepare('SELECT * FROM teams WHERE team_code=?');
    $stmt->bind_param('s', $code);
    $stmt->execute();
    $team = $stmt->get_result()->fetch_assoc();
    if (!$team) respondError('Team code not found', 404);
    if ($team['current_size'] >= $team['max_size']) respondError('Team is already full', 400);

    $ec = $db->prepare('SELECT registered_count, capacity FROM events WHERE event_id=?');
    $ec->bind_param('i', $team['event_id']);
    $ec->execute();
    $ev = $ec->get_result()->fetch_assoc();
    if ($ev['registered_count'] >= $ev['capacity']) respondError('Event is full', 400);

    $reg  = $db->prepare('INSERT INTO event_registrations (student_id,event_id,team_id,role) VALUES (?,?,?,?)');
    $role = 'member';
    $reg->bind_param('iiis', $student_id, $team['event_id'], $team['team_id'], $role);
    if (!$reg->execute()) {
        if ($db->errno == 1062) respondError('Already registered for this event', 409);
        respondError('Failed: ' . $db->error, 500);
    }
    $att = $db->prepare('INSERT IGNORE INTO attendance (event_id,student_id) VALUES (?,?)');
    $att->bind_param('ii', $team['event_id'], $student_id);
    $att->execute();

    // Return updated team with members
    $upd = $db->prepare('SELECT * FROM teams WHERE team_id=?');
    $upd->bind_param('i', $team['team_id']);
    $upd->execute();
    $updated = $upd->get_result()->fetch_assoc();

    $mq = $db->prepare(
        'SELECT s.student_id, s.name, s.student_code, s.email, er.role
         FROM event_registrations er
         JOIN students s ON er.student_id = s.student_id
         WHERE er.team_id = ? ORDER BY er.registration_date'
    );
    $mq->bind_param('i', $team['team_id']);
    $mq->execute();
    $members = [];
    $mr = $mq->get_result();
    while ($r = $mr->fetch_assoc()) $members[] = $r;

    respond(['message' => 'Joined team', 'team' => $updated, 'members' => $members]);
}

// ── GET ?action=members&id={team_id} — get team members (leader or admin) ──
if ($method === 'GET' && $action === 'members' && $id) {
    $user = requireAuth();
    $db   = getDB();

    $stmt = $db->prepare('SELECT * FROM teams WHERE team_id=?');
    $stmt->bind_param('i', $id);
    $stmt->execute();
    $team = $stmt->get_result()->fetch_assoc();
    if (!$team) respondError('Team not found', 404);

    // Allow leader or admin
    if ($user['role'] !== 'admin' && $team['leader_id'] !== $user['id']) {
        respondError('Access denied', 403);
    }

    $mq = $db->prepare(
        'SELECT s.student_id, s.name, s.student_code, s.email, s.department, er.role, er.registration_date
         FROM event_registrations er
         JOIN students s ON er.student_id = s.student_id
         WHERE er.team_id = ? ORDER BY er.registration_date'
    );
    $mq->bind_param('i', $id);
    $mq->execute();
    $members = [];
    $mr = $mq->get_result();
    while ($r = $mr->fetch_assoc()) $members[] = $r;

    respond(['team' => $team, 'members' => $members]);
}

// ── GET ?action=by_code&code=TEAM-XXXX — get team by code ──
if ($method === 'GET' && $action === 'by_code') {
    $user = requireAuth();
    $code = strtoupper(trim($_GET['code'] ?? ''));
    if (!$code) respondError('code required');

    $db   = getDB();
    $stmt = $db->prepare('SELECT * FROM teams WHERE team_code=?');
    $stmt->bind_param('s', $code);
    $stmt->execute();
    $team = $stmt->get_result()->fetch_assoc();
    if (!$team) respondError('Team not found', 404);

    $mq = $db->prepare(
        'SELECT s.student_id, s.name, s.student_code, s.email, s.department, er.role
         FROM event_registrations er
         JOIN students s ON er.student_id = s.student_id
         WHERE er.team_id = ? ORDER BY er.registration_date'
    );
    $mq->bind_param('i', $team['team_id']);
    $mq->execute();
    $members = [];
    $mr = $mq->get_result();
    while ($r = $mr->fetch_assoc()) $members[] = $r;

    respond(['team' => $team, 'members' => $members]);
}

// ── GET ?action=for_event&id={event_id} — all teams for an event (admin) ──
if ($method === 'GET' && $action === 'for_event' && $id) {
    requireAdmin();
    $db   = getDB();
    $stmt = $db->prepare(
        'SELECT t.*, s.name AS leader_name, s.email AS leader_email
         FROM teams t JOIN students s ON t.leader_id = s.student_id
         WHERE t.event_id = ? ORDER BY t.created_at'
    );
    $stmt->bind_param('i', $id);
    $stmt->execute();
    $teams = [];
    $res   = $stmt->get_result();
    while ($row = $res->fetch_assoc()) {
        // Get members for each team
        $mq = $db->prepare(
            'SELECT s.student_id, s.name, s.student_code, s.email, er.role
             FROM event_registrations er
             JOIN students s ON er.student_id = s.student_id
             WHERE er.team_id = ? ORDER BY er.registration_date'
        );
        $mq->bind_param('i', $row['team_id']);
        $mq->execute();
        $members = [];
        $mr = $mq->get_result();
        while ($m = $mr->fetch_assoc()) $members[] = $m;
        $row['members'] = $members;
        $teams[] = $row;
    }
    respond($teams);
}

// ── DELETE ?action=delete&id={team_id} — admin deletes a team ──
if ($method === 'DELETE' && $action === 'delete' && $id) {
    requireAdmin();
    $db = getDB();

    // Get team info first
    $stmt = $db->prepare('SELECT * FROM teams WHERE team_id=?');
    $stmt->bind_param('i', $id);
    $stmt->execute();
    $team = $stmt->get_result()->fetch_assoc();
    if (!$team) respondError('Team not found', 404);

    // Delete all event_registrations for this team
    $dr = $db->prepare('DELETE FROM event_registrations WHERE team_id=?');
    $dr->bind_param('i', $id);
    $dr->execute();

    // Delete attendance records
    $da = $db->prepare('DELETE FROM attendance WHERE event_id=? AND student_id NOT IN (SELECT student_id FROM event_registrations WHERE event_id=?)');
    // Simpler: just delete the team — triggers/cascade will handle registrations
    $dt = $db->prepare('DELETE FROM teams WHERE team_id=?');
    $dt->bind_param('i', $id);
    $dt->execute();

    respond(['message' => 'Team deleted']);
}

respondError('Invalid request', 404);
