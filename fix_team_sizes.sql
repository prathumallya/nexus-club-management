-- Run this in phpMyAdmin if teams already exist in your database
-- It recalculates current_size from actual registrations

USE club_management;

-- Fix current_size to match actual member count in event_registrations
UPDATE teams t
SET t.current_size = (
    SELECT COUNT(*) FROM event_registrations er WHERE er.team_id = t.team_id
);

-- Verify
SELECT team_id, team_code, team_name, current_size, max_size FROM teams;
