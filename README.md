# Nexus Club Management System

Welcome to the Nexus Club Management project! This repository contains the frontend UI, the backend PHP API, and all necessary setup files to run the platform.

Here is a breakdown of the project's file structure and the role of each file and directory within it:

## Root Directory (`/`)

* **`club_management.html`**
  The main entry point and structural HTML file for the single-page application. It contains the layout and forms for navigation, student dashboards, and admin views.
* **`club_management.css`**
  The main styling stylesheet. It holds all the layout styles, visual cues, animations, and color variables applied to the elements defined in the HTML file.
* **`club_management.js`**
  The frontend application logic. It handles form submissions, UI manipulation, API requests (fetching events, user sign in, etc.), and event listeners.
* **`schema.sql`**
  The MySQL database schema definitions. It contains the `CREATE TABLE` and `INSERT INTO` statements to define the relational data structure and populate it with sample dummy data.
* **`setup.php`**
  An initial configuration script intended to act as the first-time installation setup, handling tasks like setting up initial admin credentials or hashing database passwords upon deployment. 
* **`.htaccess`**
  An Apache server configuration file placed in the main directory. It restricts access, configures MIME types, dictates caching, or creates custom routing rules. 
* **`uploads/` (Directory)**
  A designated folder to store user-uploaded content (e.g., event posters, profile pictures, or payment receipts).

## API Directory (`/api/`)
This directory contains the entire PHP backend which handles communication with the MySQL database and answers HTTP requests from the frontend app.

* **`config.php`**
  The core configuration file used across the backend. It holds the database connection settings, SMTP credentials for mailing, and global variables like timezone setups.
* **`auth.php`**
  Handles everything related to user authentication, including logging in users, registering new accounts, password hashing, user session handling, and OTP verification flow.
* **`student.php`**
  Manages endpoints specific to the student view. It handles endpoints allowing students to fetch their profiles, leave clubs, or manage their applications.
* **`clubs.php`**
  Provides APIs for managing club data, such as retrieving the list of all available clubs, getting details of a specific club, and handling membership approvals by admins.
* **`events.php`**
  The core controller for events logic. Handles fetching events, allowing admins to add or edit an event, managing event limits, or tracking participant registration.
* **`teams.php`**
  Contains endpoints dedicated to handling team-based logic for multi-player events, including generating unique team creation codes and adding members to teams.
* **`certificate.php`**
  Contains the backend logic for dynamically generating and serving digital certificates to students dynamically upon their completion of an event or task.
* **`send_reminders.php`**
  A standalone script utilized to filter upcoming events and dispatch automated notification reminders directly to the event’s registered participants. 
* **`mailer_helper.php`**
  A reusable wrapper script that initiates instances of `PHPMailer`, abstracting the SMTP integration process so other files can just pass the recipient and body to easily send emails out.
* **`PHPMailer/` (Directory)**
  The third-party PHP library handling the core generation and transmission of emails safely over SMTP protocols.
* **`.htaccess`**
  A directory-specific apache configuration ensuring unauthorized visitors cannot openly browse the directory files, locking external interference.
