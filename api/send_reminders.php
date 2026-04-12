<?php
// api/send_reminders.php
// This script should be run periodically via a Cron Job, Windows Task Scheduler, or manually.
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/mailer_helper.php';

// Allow running from CLI or HTTP
if (php_sapi_name() !== 'cli') {
    // Optionally secure this endpoint if it shouldn't be publicly accessible
    // For local testing, we just let it run.
    header('Content-Type: text/plain');
}

echo "Starting reminder checks...\n";

$db = getDB();

// 1. Auto-migration: Ensure the reminder_sent column exists
try {
    $db->query("ALTER TABLE events ADD COLUMN reminder_sent_15h TINYINT(1) DEFAULT 0");
} catch(Exception $e) {
    // Ignore error if column already exists
}

// 2. Find events happening between now and 18 hours from now
// Using 16 hours to ensure events approximately 15 hours away are caught if this runs hourly.
$query = "SELECT event_id, event_name, event_date, event_time, venue 
          FROM events 
          WHERE IFNULL(reminder_sent_15h, 0) = 0 
            AND CONCAT(event_date, ' ', IFNULL(event_time, '00:00:00')) > NOW() 
            AND CONCAT(event_date, ' ', IFNULL(event_time, '00:00:00')) <= DATE_ADD(NOW(), INTERVAL 16 HOUR)";

$result = $db->query($query);

if (!$result) {
    echo "Database error: " . $db->error . "\n";
    exit(1);
}

$events_processed = 0;
$emails_sent = 0;

while ($ev = $result->fetch_assoc()) {
    $event_id = $ev['event_id'];
    echo "Processing event ID {$event_id}: {$ev['event_name']}...\n";
    
    // Fetch all registered students for this event (solo, leaders, members)
    $stmt = $db->prepare('SELECT s.email, s.name FROM event_registrations er JOIN students s ON er.student_id = s.student_id WHERE er.event_id = ?');
    $stmt->bind_param('i', $event_id);
    $stmt->execute();
    $res = $stmt->get_result();
    
    $recipients = [];
    while ($student = $res->fetch_assoc()) {
        $recipients[] = $student['email'];
        // You could send individually if you wanted personalized emails, 
        // but BCC or bulk sending is much more efficient.
    }
    
    if (count($recipients) > 0) {
        $subject = "Reminder: {$ev['event_name']} is happening soon!";
        $fmt_date = date('F j, Y', strtotime($ev['event_date']));
        $fmt_time = $ev['event_time'] ? date('g:i A', strtotime($ev['event_time'])) : '';
        $datetime = $fmt_date . ($fmt_time ? ' at ' . $fmt_time : '');
        $content = "
            <p>Get ready!</p>
            <p>Your registered event <strong style='color: #fff;'>{$ev['event_name']}</strong> is happening in about 15 hours.</p>
            <div style='background-color: #1e293b; padding: 20px; border-radius: 10px; border-left: 4px solid #f59e0b; margin: 30px 0;'>
                <p style='margin: 0 0 10px 0;'><strong>When:</strong> <span style='color:#f8fafc;'>{$datetime}</span></p>
                <p style='margin: 0;'><strong>Where:</strong> <span style='color:#f8fafc;'>{$ev['venue']}</span></p>
            </div>
            <p>We look forward to seeing you there!</p>
        ";
        
        $body = getEmailTemplate("Event Reminder! ⏰", $content);
        
        // Send email
        $success = sendEmail($recipients, $subject, $body);
        if ($success) {
            echo "Successfully sent reminders to " . count($recipients) . " participants for event {$event_id}.\n";
            $emails_sent += count($recipients);
        } else {
            echo "Failed to send reminders for event {$event_id}.\n";
        }
    } else {
        echo "No registered participants for event {$event_id}.\n";
    }
    
    // Mark reminder as sent regardless of participant count so we don't keep polling it
    $db->query("UPDATE events SET reminder_sent_15h = 1 WHERE event_id = {$event_id}");
    $events_processed++;
}

echo "Reminder check complete! Processed {$events_processed} events, sent {$emails_sent} emails.\n";
