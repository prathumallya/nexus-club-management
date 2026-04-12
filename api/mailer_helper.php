<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/PHPMailer/Exception.php';
require_once __DIR__ . '/PHPMailer/PHPMailer.php';
require_once __DIR__ . '/PHPMailer/SMTP.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

/**
 * Send an email using PHPMailer.
 * 
 * @param string|array $to      Single email string, or an array of emails
 * @param string       $subject Email subject
 * @param string       $body    Email HTML body
 * @return bool                 True on success, false on failure
 */
function sendEmail($to, $subject, $body) {
    $mail = new PHPMailer(true);
    try {
        if (defined('SMTP_USER') && SMTP_USER !== 'your_email@gmail.com') {
            $mail->isSMTP();
            $mail->Host       = SMTP_HOST;
            $mail->SMTPAuth   = true;
            $mail->Username   = SMTP_USER;
            $mail->Password   = SMTP_PASS;
            $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
            $mail->Port       = SMTP_PORT;
        } else {
            $mail->isMail();
        }

        $mail->setFrom('noreply@nexusclub.com', 'NEXUS');
        
        if (is_array($to)) {
            foreach ($to as $email) {
                if (filter_var($email, FILTER_VALIDATE_EMAIL)) {
                    $mail->addAddress($email);
                }
            }
        } else {
            $mail->addAddress($to);
        }

        $mail->isHTML(true);
        $mail->Subject = $subject;
        $mail->Body    = $body;
        
        $mail->send();
        return true;
    } catch (Exception $e) {
        error_log("Mail Error: " . $mail->ErrorInfo);
        return false;
    }
}

/**
 * Wraps content in a cool, modern dark-themed HTML email template.
 */
function getEmailTemplate($title, $content) {
    $year = date('Y');
    return "
    <!DOCTYPE html>
    <html>
    <head>
    <meta charset='utf-8'>
    <meta name='viewport' content='width=device-width, initial-scale=1.0'>
    </head>
    <body style='margin: 0; padding: 0; background-color: #050810; font-family: -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;'>
        <div style='max-width: 600px; margin: 40px auto; background-color: #0d121f; border: 1px solid #1e293b; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.5);'>
            <!-- Header (Gradient Border Trick) -->
            <div style='background: linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #ec4899 100%); padding: 3px;'>
                <div style='background-color: #0d121f; padding: 30px; text-align: center; border-radius: 14px 14px 0 0;'>
                    <h1 style='margin: 0; color: #ffffff; font-size: 28px; letter-spacing: 4px; text-transform: uppercase; font-weight: 900;'>NEX<span style='color: #a855f7;'>US</span></h1>
                </div>
            </div>
            
            <!-- Body -->
            <div style='padding: 40px 30px; color: #cbd5e1; line-height: 1.6; font-size: 16px;'>
                <h2 style='color: #f8fafc; font-size: 22px; margin-top: 0; margin-bottom: 24px; font-weight: 600;'>{$title}</h2>
                {$content}
            </div>
            
            <!-- Footer -->
            <div style='padding: 24px 30px; background-color: #080b13; border-top: 1px solid #1e293b; text-align: center;'>
                <p style='margin: 0; color: #64748b; font-size: 12px; line-height: 1.5;'>NEXUS College Club Hub &copy; {$year}<br>You are receiving this because of your activity on the student portal.</p>
            </div>
        </div>
    </body>
    </html>
    ";
}
