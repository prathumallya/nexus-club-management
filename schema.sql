-- ============================================================
-- NEXUS Club Management — MySQL Schema for XAMPP
-- Import via phpMyAdmin or run in MySQL console
-- ============================================================

CREATE DATABASE IF NOT EXISTS club_management CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE club_management;

-- =========================
-- 1. STUDENTS
-- =========================
CREATE TABLE IF NOT EXISTS students (
    student_id   INT AUTO_INCREMENT PRIMARY KEY,
    name         VARCHAR(100) NOT NULL,
    email        VARCHAR(100) UNIQUE NOT NULL,
    department   VARCHAR(100),
    student_code VARCHAR(20) UNIQUE,
    year         TINYINT,
    password     VARCHAR(255) NOT NULL,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =========================
-- 2. ADMIN
-- =========================
CREATE TABLE IF NOT EXISTS admin (
    admin_id   INT AUTO_INCREMENT PRIMARY KEY,
    name       VARCHAR(100),
    email      VARCHAR(100) UNIQUE NOT NULL,
    password   VARCHAR(255) NOT NULL,
    club_id    INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =========================
-- 3. CLUBS
-- =========================
CREATE TABLE IF NOT EXISTS club (
    club_id      INT AUTO_INCREMENT PRIMARY KEY,
    club_name    VARCHAR(100) NOT NULL,
    description  TEXT,
    category     VARCHAR(50),
    icon         VARCHAR(10),
    color        VARCHAR(20),
    member_count INT DEFAULT 0,
    logo         VARCHAR(255),
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =========================
-- 4. MEMBERSHIP APPLICATIONS
-- =========================
CREATE TABLE IF NOT EXISTS membership (
    membership_id INT AUTO_INCREMENT PRIMARY KEY,
    student_id    INT NOT NULL,
    club_id       INT NOT NULL,
    why_join      TEXT,
    skills        TEXT,
    availability  VARCHAR(50),
    joining_date  DATE DEFAULT (CURRENT_DATE),
    status        ENUM('pending','accepted','rejected') DEFAULT 'pending',
    reviewed_by   INT,
    reviewed_at   TIMESTAMP NULL,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_application (student_id, club_id),
    FOREIGN KEY (student_id)  REFERENCES students(student_id) ON DELETE CASCADE,
    FOREIGN KEY (club_id)     REFERENCES club(club_id)        ON DELETE CASCADE,
    FOREIGN KEY (reviewed_by) REFERENCES admin(admin_id)      ON DELETE SET NULL
);

-- =========================
-- 5. EVENTS
-- =========================
CREATE TABLE IF NOT EXISTS events (
    event_id         INT AUTO_INCREMENT PRIMARY KEY,
    event_name       VARCHAR(100) NOT NULL,
    description      TEXT,
    event_date       DATE NOT NULL,
    event_time       TIME,
    venue            VARCHAR(150),
    club_id          INT NOT NULL,
    capacity         INT NOT NULL DEFAULT 100,
    registered_count INT DEFAULT 0,
    team_size        INT DEFAULT 1,
    status           ENUM('open','upcoming','closed') DEFAULT 'open',
    poster           VARCHAR(255),
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (club_id) REFERENCES club(club_id) ON DELETE CASCADE
);

-- =========================
-- 6. TEAMS
-- =========================
CREATE TABLE IF NOT EXISTS teams (
    team_id      INT AUTO_INCREMENT PRIMARY KEY,
    team_code    VARCHAR(20) UNIQUE NOT NULL,
    team_name    VARCHAR(100) NOT NULL,
    event_id     INT NOT NULL,
    leader_id    INT NOT NULL,
    max_size     INT NOT NULL DEFAULT 2,
    current_size INT DEFAULT 0,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id)  REFERENCES events(event_id)     ON DELETE CASCADE,
    FOREIGN KEY (leader_id) REFERENCES students(student_id) ON DELETE CASCADE
);

-- =========================
-- 7. EVENT REGISTRATIONS
-- =========================
CREATE TABLE IF NOT EXISTS event_registrations (
    registration_id   INT AUTO_INCREMENT PRIMARY KEY,
    student_id        INT NOT NULL,
    event_id          INT NOT NULL,
    team_id           INT,
    role              ENUM('solo','leader','member') DEFAULT 'solo',
    registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_reg (student_id, event_id),
    FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE,
    FOREIGN KEY (event_id)   REFERENCES events(event_id)     ON DELETE CASCADE,
    FOREIGN KEY (team_id)    REFERENCES teams(team_id)       ON DELETE SET NULL
);

-- =========================
-- 8. ATTENDANCE
-- =========================
CREATE TABLE IF NOT EXISTS attendance (
    attendance_id INT AUTO_INCREMENT PRIMARY KEY,
    event_id      INT NOT NULL,
    student_id    INT NOT NULL,
    present       TINYINT(1) DEFAULT 0,
    marked_by     INT,
    marked_at     TIMESTAMP NULL,
    UNIQUE KEY unique_attendance (event_id, student_id),
    FOREIGN KEY (event_id)   REFERENCES events(event_id)     ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE,
    FOREIGN KEY (marked_by)  REFERENCES admin(admin_id)      ON DELETE SET NULL
);

-- =========================
-- TRIGGERS
-- =========================
DROP TRIGGER IF EXISTS after_membership_update;
DROP TRIGGER IF EXISTS after_event_reg_insert;
DROP TRIGGER IF EXISTS after_event_reg_delete;
DROP TRIGGER IF EXISTS after_team_join;

DELIMITER $$

CREATE TRIGGER after_membership_update
AFTER UPDATE ON membership FOR EACH ROW
BEGIN
    IF NEW.status='accepted' AND OLD.status!='accepted' THEN
        UPDATE club SET member_count=member_count+1 WHERE club_id=NEW.club_id;
    ELSEIF OLD.status='accepted' AND NEW.status!='accepted' THEN
        UPDATE club SET member_count=GREATEST(member_count-1,0) WHERE club_id=NEW.club_id;
    END IF;
END$$

CREATE TRIGGER after_event_reg_insert
AFTER INSERT ON event_registrations FOR EACH ROW
BEGIN
    UPDATE events SET registered_count=registered_count+1 WHERE event_id=NEW.event_id;
END$$

CREATE TRIGGER after_event_reg_delete
AFTER DELETE ON event_registrations FOR EACH ROW
BEGIN
    UPDATE events SET registered_count=GREATEST(registered_count-1,0) WHERE event_id=OLD.event_id;
END$$

CREATE TRIGGER after_team_join
AFTER INSERT ON event_registrations FOR EACH ROW
BEGIN
    IF NEW.team_id IS NOT NULL THEN
        UPDATE teams SET current_size=current_size+1 WHERE team_id=NEW.team_id;
    END IF;
END$$

DELIMITER ;

-- =========================
-- SAMPLE DATA
-- =========================
INSERT INTO club (club_name,description,category,icon,color) VALUES
('Code Crafters',    'Build real-world projects, compete in hackathons, and level up your dev skills.','tech',   '💻','cyan'),
('AI Lab Society',   'Explore machine learning, NLP, and robotics through workshops and research.',   'tech',   '🤖','cyan'),
('Pixel & Lens',     'Photography, filmmaking, and visual storytelling.',                            'arts',   '📷','purple'),
('Design Collective','UI/UX, branding, motion design, and creative direction.',                      'arts',   '🎨','purple'),
('Thunderbolts FC',  'Inter-college football team open to all skill levels.',                        'sports', '⚽','green'),
('Smash Circuit',    'Badminton and table tennis tournaments and coaching.',                          'sports', '🏸','green'),
('Harmony Choir',    'Classical and contemporary choral singing.',                                   'culture','🎵','amber'),
('Rangmanch Drama',  'Theatre, improv, and street plays.',                                           'culture','🎭','amber'),
('Green Campus',     'Environmental advocacy and campus sustainability.',                            'social', '🌿','green'),
('Debate Society',   'Competitive debating, Model UN, public speaking workshops.',                   'social', '🗣️','cyan'),
('Music Syndicate',  'Live performances, jam sessions, and annual music festival.',                  'arts',   '🎸','pink'),
('Robotics Guild',   'Build autonomous robots and participate in national competitions.',            'tech',   '🦾','cyan');

-- Admin passwords are set by running setup.php in your browser after import.
-- Inserting placeholder text for now (setup.php will overwrite with real bcrypt hash).
INSERT INTO admin (name,email,password,club_id) VALUES
('Code Crafters Admin',  'admin.codecrafters@college.edu', 'run_setup.php',  1),
('AI Lab Admin',         'admin.ailab@college.edu',        'run_setup.php',  2),
('Pixel Lens Admin',     'admin.pixellens@college.edu',    'run_setup.php',  3),
('Design Admin',         'admin.design@college.edu',       'run_setup.php',  4),
('Thunderbolts Admin',   'admin.thunderbolts@college.edu', 'run_setup.php',  5),
('Smash Circuit Admin',  'admin.smash@college.edu',        'run_setup.php',  6),
('Harmony Choir Admin',  'admin.harmony@college.edu',      'run_setup.php',  7),
('Rangmanch Admin',      'admin.rangmanch@college.edu',    'run_setup.php',  8),
('Green Campus Admin',   'admin.green@college.edu',        'run_setup.php',  9),
('Debate Admin',         'admin.debate@college.edu',       'run_setup.php', 10),
('Music Admin',          'admin.music@college.edu',        'run_setup.php', 11),
('Robotics Admin',       'admin.robotics@college.edu',     'run_setup.php', 12);

-- Sample events
INSERT INTO events (event_name,description,event_date,event_time,venue,club_id,capacity,team_size,status) VALUES
('24-Hour Hackathon InnoSprint','Build something wild in 24 hours. Cash prizes ₹50,000.',          '2026-03-18','10:00:00','Innovation Lab, Block C',  1,100,3,'open'),
('Golden Hour Photography Walk','Capture the golden hour magic around campus.',                     '2026-03-19','17:30:00','Campus Gardens',             3, 60,1,'open'),
('Cultural Fest Grand Rehearsal','Full dress rehearsal for Spring Cultural Fest.',                   '2026-03-21','15:00:00','Main Auditorium',            8, 80,1,'upcoming'),
('Sunrise Yoga & Wellness Day', 'Yoga, meditation, and a healthy breakfast. Free!',                 '2026-03-22','07:00:00','Open Ground, Sports Block',  9,120,1,'open'),
('AI & Future of Work Panel',   'Industry experts discuss how AI is reshaping careers.',            '2026-03-25','14:00:00','Seminar Hall B',             2,150,2,'open'),
('Battle of Bands Spring',      '8 college bands compete for the Spring Cup.',                      '2026-03-28','18:00:00','Open Air Theatre',           11,200,4,'upcoming'),
('Inter-College Debate Champ',  '8 colleges, 3 rounds, 1 champion.',                               '2026-03-30','09:00:00','Conference Centre',          10, 80,1,'upcoming'),
('Spring Robotics Showcase',    'Watch autonomous robots navigate obstacle courses.',               '2026-04-02','11:00:00','Workshop Hall, Block D',     12,100,3,'upcoming');
