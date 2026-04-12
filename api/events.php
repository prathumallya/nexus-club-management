<?php
// api/events.php
require_once 'config.php';
require_once 'mailer_helper.php';

$method   = $_SERVER['REQUEST_METHOD'];
$action   = $_GET['action']  ?? '';
$id       = intval($_GET['id']       ?? 0);
$club_id  = intval($_GET['club_id']  ?? 0);

// GET /api/events.php  — all events (optional ?club_id=N)
if ($method === 'GET' && !$action && !$id) {
    $db = getDB();
    // Auto-close events whose date has passed
    $db->query("UPDATE events SET status='closed' WHERE event_date < CURDATE() AND status != 'closed'");
    if ($club_id) {
        $stmt = $db->prepare(
            'SELECT e.*, c.club_name, c.icon, c.color
             FROM events e JOIN club c ON e.club_id=c.club_id
             WHERE e.club_id=? ORDER BY e.event_date'
        );
        $stmt->bind_param('i', $club_id);
    } else {
        $stmt = $db->prepare(
            'SELECT e.*, c.club_name, c.icon, c.color
             FROM events e JOIN club c ON e.club_id=c.club_id ORDER BY e.event_date'
        );
    }
    $stmt->execute();
    $res  = $stmt->get_result();
    $rows = [];
    while ($r = $res->fetch_assoc()) $rows[] = $r;
    respond($rows);
}

// GET /api/events.php?id=N  — single event
if ($method === 'GET' && $id && !$action) {
    $db   = getDB();
    $stmt = $db->prepare(
        'SELECT e.*, c.club_name FROM events e JOIN club c ON e.club_id=c.club_id WHERE e.event_id=?'
    );
    $stmt->bind_param('i', $id);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    if (!$row) respondError('Event not found', 404);
    respond($row);
}

// POST /api/events.php  — admin creates event
if ($method === 'POST' && !$action && !$id) {
    $admin = requireAdmin();
    $body  = getBody();
    $name  = trim($body['event_name'] ?? '');
    $date  = trim($body['event_date'] ?? '');
    $venue = trim($body['venue']      ?? '');
    if (!$name || !$date || !$venue) respondError('event_name, event_date and venue are required');

    $desc     = $body['description'] ?? '';
    $time     = $body['event_time']  ?? null;
    $cap      = intval($body['capacity']  ?? 100);
    $ts       = intval($body['team_size'] ?? 1);
    $status   = $body['status'] ?? 'open';
    $cid      = $admin['club_id'];

    $db   = getDB();
    $stmt = $db->prepare(
        'INSERT INTO events (event_name,description,event_date,event_time,venue,club_id,capacity,team_size,status)
         VALUES (?,?,?,?,?,?,?,?,?)'
    );
    $stmt->bind_param('ssssssiis', $name,$desc,$date,$time,$venue,$cid,$cap,$ts,$status);
    if (!$stmt->execute()) respondError('Failed: ' . $db->error, 500);
    respond(['event_id' => $stmt->insert_id, 'message' => 'Event created']);
}

// PUT /api/events.php?id=N  — admin updates event
if ($method === 'PUT' && $id) {
    $admin = requireAdmin();
    $body  = getBody();
    $name  = trim($body['event_name'] ?? '');
    $date  = trim($body['event_date'] ?? '');
    $venue = trim($body['venue']      ?? '');
    if (!$name || !$date || !$venue) respondError('Missing fields');

    $desc   = $body['description'] ?? '';
    $time   = $body['event_time']  ?? null;
    $cap    = intval($body['capacity']  ?? 100);
    $ts     = intval($body['team_size'] ?? 1);
    $status = $body['status'] ?? 'open';
    $cid    = $admin['club_id'];

    $db   = getDB();
    $stmt = $db->prepare(
        'UPDATE events SET event_name=?,description=?,event_date=?,event_time=?,venue=?,
         capacity=?,team_size=?,status=? WHERE event_id=? AND club_id=?'
    );
    $stmt->bind_param('sssssiisii', $name,$desc,$date,$time,$venue,$cap,$ts,$status,$id,$cid);
    $stmt->execute();
    respond(['message' => 'Updated']);
}

// DELETE /api/events.php?action=cancel_reg&id=N  — student cancels their own registration
if ($method === 'DELETE' && $action === 'cancel_reg' && $id) {
    $user       = requireAuth();
    $student_id = $user['id'];
    $db         = getDB();

    // Get registration details (check if in a team)
    $chk = $db->prepare(
        'SELECT er.registration_id, er.team_id, er.role FROM event_registrations er
         WHERE er.event_id=? AND er.student_id=?'
    );
    $chk->bind_param('ii', $id, $student_id);
    $chk->execute();
    $reg = $chk->get_result()->fetch_assoc();
    if (!$reg) respondError('Registration not found', 404);

    // If team leader — delete the whole team
    if ($reg['role'] === 'leader' && $reg['team_id']) {
        $del_regs = $db->prepare('DELETE FROM event_registrations WHERE team_id=?');
        $del_regs->bind_param('i', $reg['team_id']);
        $del_regs->execute();
        $del_team = $db->prepare('DELETE FROM teams WHERE team_id=?');
        $del_team->bind_param('i', $reg['team_id']);
        $del_team->execute();
        respond(['message' => 'Team registration cancelled']);
    }

    // If team member — just remove this student from team
    if ($reg['role'] === 'member' && $reg['team_id']) {
        $del = $db->prepare('DELETE FROM event_registrations WHERE event_id=? AND student_id=?');
        $del->bind_param('ii', $id, $student_id);
        $del->execute();
        // Decrement team size
        $upd = $db->prepare('UPDATE teams SET current_size=GREATEST(current_size-1,0) WHERE team_id=?');
        $upd->bind_param('i', $reg['team_id']);
        $upd->execute();
        // Remove from attendance
        $da = $db->prepare('DELETE FROM attendance WHERE event_id=? AND student_id=?');
        $da->bind_param('ii', $id, $student_id);
        $da->execute();
        respond(['message' => 'Left team']);
    }

    // Solo registration
    $del = $db->prepare('DELETE FROM event_registrations WHERE event_id=? AND student_id=?');
    $del->bind_param('ii', $id, $student_id);
    $del->execute();
    $da = $db->prepare('DELETE FROM attendance WHERE event_id=? AND student_id=?');
    $da->bind_param('ii', $id, $student_id);
    $da->execute();
    respond(['message' => 'Registration cancelled']);
}
// DELETE /api/events.php?action=admin_del_reg&id=N&student_id=S  — admin removes a registration
if ($method === 'DELETE' && $action === 'admin_del_reg' && $id) {
    requireAdmin();
    $student_id = intval($_GET['student_id'] ?? 0);
    if (!$student_id) respondError('student_id required');
    $db = getDB();

    // Check role (team member vs leader vs solo)
    $chk = $db->prepare('SELECT team_id, role FROM event_registrations WHERE event_id=? AND student_id=?');
    $chk->bind_param('ii', $id, $student_id);
    $chk->execute();
    $reg = $chk->get_result()->fetch_assoc();
    if (!$reg) respondError('Registration not found', 404);

    if ($reg['role'] === 'leader' && $reg['team_id']) {
        // Deleting leader deletes whole team
        $dr = $db->prepare('DELETE FROM event_registrations WHERE team_id=?');
        $dr->bind_param('i', $reg['team_id']);
        $dr->execute();
        $dt = $db->prepare('DELETE FROM teams WHERE team_id=?');
        $dt->bind_param('i', $reg['team_id']);
        $dt->execute();
        respond(['message' => 'Team removed']);
    }

    $del = $db->prepare('DELETE FROM event_registrations WHERE event_id=? AND student_id=?');
    $del->bind_param('ii', $id, $student_id);
    $del->execute();
    if ($reg['team_id']) {
        $upd = $db->prepare('UPDATE teams SET current_size=GREATEST(current_size-1,0) WHERE team_id=?');
        $upd->bind_param('i', $reg['team_id']);
        $upd->execute();
    }
    $da = $db->prepare('DELETE FROM attendance WHERE event_id=? AND student_id=?');
    $da->bind_param('ii', $id, $student_id);
    $da->execute();
    respond(['message' => 'Registration removed']);
}
// DELETE /api/events.php?id=N
if ($method === 'DELETE' && $id) {
    $admin = requireAdmin();
    $cid   = $admin['club_id'];
    $db    = getDB();
    $stmt  = $db->prepare('DELETE FROM events WHERE event_id=? AND club_id=?');
    $stmt->bind_param('ii', $id, $cid);
    $stmt->execute();
    respond(['message' => 'Deleted']);
}

// POST /api/events.php?action=register_solo&id=N  — student solo register
if ($method === 'POST' && $action === 'register_solo' && $id) {
    $user = requireAuth();
    $sid  = $user['id'];
    $db   = getDB();

    $chk  = $db->prepare('SELECT event_name, event_date, event_time, venue, registered_count, capacity, status FROM events WHERE event_id=?');
    $chk->bind_param('i', $id);
    $chk->execute();
    $ev   = $chk->get_result()->fetch_assoc();
    if (!$ev) respondError('Event not found', 404);
    if ($ev['status'] !== 'open') respondError('Registration is down or closed for this event', 403);
    if ($ev['registered_count'] >= $ev['capacity']) respondError('Event is full', 400);

    $stmt = $db->prepare('INSERT INTO event_registrations (student_id,event_id,role) VALUES (?,?,?)');
    $role = 'solo';
    $stmt->bind_param('iis', $sid, $id, $role);
    if (!$stmt->execute()) {
        if ($db->errno == 1062) respondError('Already registered', 409);
        respondError('Failed: ' . $db->error, 500);
    }
    // Pre-insert attendance row
    $att = $db->prepare('INSERT IGNORE INTO attendance (event_id, student_id) VALUES (?,?)');
    respond(['message' => 'Registered']);
}

// POST /api/events.php?action=send_solo_mail&id=N — hidden async call
if ($method === 'POST' && $action === 'send_solo_mail' && $id) {
    $user = requireAuth();
    $db   = getDB();
    $chk  = $db->prepare('SELECT event_name, event_date, event_time, venue FROM events WHERE event_id=?');
    $chk->bind_param('i', $id);
    $chk->execute();
    $ev   = $chk->get_result()->fetch_assoc();
    if ($ev) {
        $subject = "Registration Confirmed: {$ev['event_name']}";
        $fmt_date = date('F j, Y', strtotime($ev['event_date']));
        $fmt_time = $ev['event_time'] ? date('g:i A', strtotime($ev['event_time'])) : '';
        $datetime = $fmt_date . ($fmt_time ? ' at ' . $fmt_time : '');
        
        $content = "
            <p>Hi <strong style='color: #fff;'>{$user['name']}</strong>,</p>
            <p>You have successfully registered for <strong>{$ev['event_name']}</strong>.</p>
            <div style='background-color: #1e293b; padding: 20px; border-radius: 10px; border-left: 4px solid #a855f7; margin: 30px 0;'>
                <p style='margin: 0 0 10px 0;'><strong>When:</strong> <span style='color:#f8fafc;'>{$datetime}</span></p>
                <p style='margin: 0;'><strong>Where:</strong> <span style='color:#f8fafc;'>{$ev['venue']}</span></p>
            </div>
            <p>We look forward to seeing you there! Make sure to arrive on time.</p>
        ";
        
        $body = getEmailTemplate("Registration Successful! 🎉", $content);
        sendEmail($user['email'], $subject, $body);
    }
    respond(['message' => 'Sent']);
}

// POST /api/events.php?action=register_team&id=N  — leader creates team
if ($method === 'POST' && $action === 'register_team' && $id) {
    $user      = requireAuth();
    $leader_id = $user['id'];
    $body      = getBody();
    $team_name = trim($body['team_name'] ?? '');
    if (!$team_name) respondError('team_name required');

    $db  = getDB();
    $ck = $db->prepare('SELECT event_name, event_date, event_time, venue, team_size, registered_count, capacity, status FROM events WHERE event_id=?');
    $ck->bind_param('i', $id);
    $ck->execute();
    $ev = $ck->get_result()->fetch_assoc();
    if (!$ev) respondError('Event not found', 404);
    if ($ev['status'] !== 'open') respondError('Registration is down or closed for this event', 403);
    if ($ev['team_size'] < 2) respondError('Not a team event', 400);
    if ($ev['registered_count'] >= $ev['capacity']) respondError('Event is full', 400);

    // Generate unique team code
    do {
        $code = 'TEAM-' . strtoupper(substr(md5(uniqid()), 0, 4));
        $ck   = $db->prepare('SELECT team_id FROM teams WHERE team_code=?');
        $ck->bind_param('s', $code);
        $ck->execute();
    } while ($ck->get_result()->num_rows > 0);

    $max  = $ev['team_size'];
    $stmt = $db->prepare('INSERT INTO teams (team_code,team_name,event_id,leader_id,max_size) VALUES (?,?,?,?,?)');
    $stmt->bind_param('ssiii', $code, $team_name, $id, $leader_id, $max);
    if (!$stmt->execute()) respondError('Failed: ' . $db->error, 500);
    $team_id = $stmt->insert_id;

    $reg = $db->prepare('INSERT INTO event_registrations (student_id,event_id,team_id,role) VALUES (?,?,?,?)');
    $role = 'leader';
    $reg->bind_param('iiis', $leader_id, $id, $team_id, $role);
    if (!$reg->execute()) {
        if ($db->errno == 1062) respondError('Already registered', 409);
        respondError('Failed', 500);
    }
    $att = $db->prepare('INSERT IGNORE INTO attendance (event_id, student_id) VALUES (?,?)');
    $att->bind_param('ii', $id, $leader_id);
    $att->execute();

    respond(['team_code' => $code, 'team_id' => $team_id, 'message' => 'Team created']);
}

// POST /api/events.php?action=send_team_mail&id=N&code=... — hidden async call
if ($method === 'POST' && $action === 'send_team_mail' && $id) {
    $user = requireAuth();
    $body = getBody();
    $teamName = $body['team_name'] ?? 'Your Team';
    $code     = $body['team_code'] ?? 'N/A';
    
    $db  = getDB();
    $ck = $db->prepare('SELECT event_name, event_date, event_time, venue FROM events WHERE event_id=?');
    $ck->bind_param('i', $id);
    $ck->execute();
    $ev = $ck->get_result()->fetch_assoc();
    
    if ($ev) {
        $subject = "Team Created for {$ev['event_name']}";
        $fmt_date = date('F j, Y', strtotime($ev['event_date']));
        $fmt_time = $ev['event_time'] ? date('g:i A', strtotime($ev['event_time'])) : '';
        $datetime = $fmt_date . ($fmt_time ? ' at ' . $fmt_time : '');
        
        $content = "
            <p>Hi <strong style='color: #fff;'>{$user['name']}</strong>,</p>
            <p>You have successfully registered your team <strong style='color: #fff;'>{$teamName}</strong> for <strong>{$ev['event_name']}</strong>.</p>
            <div style='background-color: #1e293b; padding: 24px; border-radius: 12px; border: 1px solid rgba(167, 139, 250, 0.3); text-align: center; margin: 30px 0;'>
                <p style='margin: 0 0 10px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;'>Your Team Code</p>
                <div style='font-family: monospace; font-size: 32px; font-weight: 800; color: #a855f7; letter-spacing: 4px; padding: 10px;'>{$code}</div>
                <p style='margin: 10px 0 0 0; font-size: 13px; color: #94a3b8;'>Share this code with your teammates so they can join your team on the platform!</p>
            </div>
            <div style='background-color: #0d121f; padding: 20px; border-radius: 10px; margin: 24px 0;'>
                <p style='margin: 0 0 10px 0;'><strong>When:</strong> <span style='color:#f8fafc;'>{$datetime}</span></p>
                <p style='margin: 0;'><strong>Where:</strong> <span style='color:#f8fafc;'>{$ev['venue']}</span></p>
            </div>
            <p style='margin-bottom:0;'>Good luck leading your team!</p>
        ";
        
        $email_body = getEmailTemplate("Team Created Successfully! 🛡️", $content);
        sendEmail($user['email'], $subject, $email_body);
    }
    respond(['message' => 'Sent']);
}

// GET /api/events.php?action=registrations&id=N  — admin view
if ($method === 'GET' && $action === 'registrations' && $id) {
    requireAdmin();
    $db   = getDB();
    $stmt = $db->prepare(
        'SELECT er.*, s.name, s.email, s.student_code,
                t.team_name, t.team_code, t.current_size, t.max_size
         FROM event_registrations er
         JOIN students s ON er.student_id=s.student_id
         LEFT JOIN teams t ON er.team_id=t.team_id
         WHERE er.event_id=? ORDER BY er.registration_date'
    );
    $stmt->bind_param('i', $id);
    $stmt->execute();
    $res  = $stmt->get_result();
    $rows = [];
    while ($r = $res->fetch_assoc()) $rows[] = $r;
    respond($rows);
}

// GET /api/events.php?action=attendance&id=N
if ($method === 'GET' && $action === 'attendance' && $id) {
    requireAdmin();
    $db   = getDB();
    $stmt = $db->prepare(
        'SELECT a.attendance_id, a.present, a.marked_at,
                s.student_id, s.name, s.email, s.student_code, s.department,
                er.role, t.team_name
         FROM attendance a
         JOIN students s ON a.student_id=s.student_id
         JOIN event_registrations er ON er.student_id=s.student_id AND er.event_id=a.event_id
         LEFT JOIN teams t ON er.team_id=t.team_id
         WHERE a.event_id=? ORDER BY s.name'
    );
    $stmt->bind_param('i', $id);
    $stmt->execute();
    $res  = $stmt->get_result();
    $rows = [];
    while ($r = $res->fetch_assoc()) $rows[] = $r;
    respond($rows);
}

// PATCH /api/events.php?action=attendance&id=N  — toggle one
if ($method === 'PATCH' && $action === 'attendance' && $id) {
    $admin = requireAdmin();
    $body  = getBody();
    $sid   = intval($body['student_id'] ?? 0);
    $pres  = $body['present'] ? 1 : 0;
    $aid   = $admin['id'];
    $db    = getDB();
    $stmt  = $db->prepare(
        'UPDATE attendance SET present=?, marked_by=?, marked_at=NOW() WHERE event_id=? AND student_id=?'
    );
    $stmt->bind_param('iiii', $pres, $aid, $id, $sid);
    $stmt->execute();
    respond(['message' => 'Updated']);
}

// PATCH /api/events.php?action=attendance_all&id=N  — mark all
if ($method === 'PATCH' && $action === 'attendance_all' && $id) {
    $admin = requireAdmin();
    $body  = getBody();
    $pres  = $body['present'] ? 1 : 0;
    $aid   = $admin['id'];
    $db    = getDB();
    $stmt  = $db->prepare('UPDATE attendance SET present=?, marked_by=?, marked_at=NOW() WHERE event_id=?');
    $stmt->bind_param('iii', $pres, $aid, $id);
    $stmt->execute();
    respond(['message' => 'All updated']);
}





respondError('Invalid request', 404);
