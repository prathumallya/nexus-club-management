<?php
// api/student.php
require_once 'config.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

// GET /api/student.php?action=me  — student dashboard data
if ($method === 'GET' && $action === 'me') {
    $user = requireAuth();
    $id   = $user['id'];
    $db   = getDB();

    // Profile
    $s = $db->prepare('SELECT student_id,name,email,department,student_code,year,created_at FROM students WHERE student_id=?');
    $s->bind_param('i', $id);
    $s->execute();
    $student = $s->get_result()->fetch_assoc();

    // Clubs
    $c = $db->prepare(
        'SELECT m.membership_id, m.status, m.created_at AS applied_at,
                m.why_join, m.skills, m.availability,
                c.club_id, c.club_name, c.icon, c.color, c.category
         FROM membership m JOIN club c ON m.club_id=c.club_id
         WHERE m.student_id=?'
    );
    $c->bind_param('i', $id);
    $c->execute();
    $clubs = [];
    $cr = $c->get_result();
    while ($r = $cr->fetch_assoc()) $clubs[] = $r;

    // Events
    $e = $db->prepare(
        'SELECT er.registration_date, er.role,
                e.event_id, e.event_name, e.event_date, e.event_time, e.venue, e.status,
                c.club_name, c.icon,
                t.team_id, t.team_code, t.team_name, t.current_size, t.max_size, t.confirmed,
                a.present
         FROM event_registrations er
         JOIN events e ON er.event_id=e.event_id
         JOIN club c ON e.club_id=c.club_id
         LEFT JOIN teams t ON er.team_id=t.team_id
         LEFT JOIN attendance a ON a.student_id=er.student_id AND a.event_id=er.event_id
         WHERE er.student_id=? ORDER BY er.registration_date DESC'
    );
    $e->bind_param('i', $id);
    $e->execute();
    $events = [];
    $er = $e->get_result();
    while ($r = $er->fetch_assoc()) $events[] = $r;

    respond(['student' => $student, 'clubs' => $clubs, 'events' => $events]);
}

// GET /api/student.php?action=admin_dashboard  — admin stats
if ($method === 'GET' && $action === 'admin_dashboard') {
    $admin   = requireAdmin();
    $club_id = $admin['club_id'];
    $db      = getDB();

    $s = $db->prepare(
        "SELECT COUNT(*) AS total,
                SUM(status='pending')  AS pending,
                SUM(status='accepted') AS accepted,
                SUM(status='rejected') AS rejected
         FROM membership WHERE club_id=?"
    );
    $s->bind_param('i', $club_id);
    $s->execute();
    $appStats = $s->get_result()->fetch_assoc();

    $e = $db->prepare(
        'SELECT event_id,event_name,event_date,registered_count,capacity,status
         FROM events WHERE club_id=? ORDER BY event_date'
    );
    $e->bind_param('i', $club_id);
    $e->execute();
    $events = [];
    $er = $e->get_result();
    while ($r = $er->fetch_assoc()) $events[] = $r;

    respond(['applications' => $appStats, 'events' => $events]);
}

respondError('Invalid action', 404);
