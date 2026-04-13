<?php
// api/certificate.php
require_once 'config.php';

// Override the default application/json header from config.php
header('Content-Type: text/html; charset=utf-8');

// The requireAuth() will pull the token from &_token=... since it checks $_GET['_token']
$user = requireAuth();

if (!isset($_GET['event_id'])) {
    die("Event ID is required.");
}
$event_id = (int)$_GET['event_id'];
$student_id = $user['id'];

$db = getDB();

// Fetch certificate details
// We strictly verify the student is registered, attended, and the event exists.
$query = "SELECT s.name AS student_name, e.event_name, e.event_date, c.club_name, c.icon, a.present
          FROM event_registrations er
          JOIN students s ON er.student_id = s.student_id
          JOIN events e ON er.event_id = e.event_id
          JOIN club c ON e.club_id = c.club_id
          LEFT JOIN attendance a ON a.student_id = er.student_id AND a.event_id = er.event_id
          WHERE er.student_id = ? AND er.event_id = ?";

$stmt = $db->prepare($query);
$stmt->bind_param('ii', $student_id, $event_id);
$stmt->execute();
$res = $stmt->get_result();
$data = $res->fetch_assoc();

if (!$data) {
    die("Registration not found.");
}
if ($data['present'] != 1) {
    die("Certificate not available. You must be marked as present by the club admin to receive a certificate.");
}

$safe_event_name = preg_replace('/[^a-zA-Z0-9_\-]/', '_', $data['event_name']);

$date_formatted = date('F jS, Y', strtotime($data['event_date']));

?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Certificate - <?php echo htmlspecialchars($data['event_name']); ?></title>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400;1,700&family=DM+Sans:wght@400;500;700&display=swap" rel="stylesheet">
<style>
  :root {
    --bg: #0f172a;
    --accent: #38bdf8;
    --accent2: #818cf8;
  }
  body, html {
    margin: 0; padding: 0;
    min-height: 100vh;
    display: flex;
    justify-content: center;
    align-items: center;
    background: var(--bg);
    font-family: 'DM Sans', sans-serif;
  }
  
  /* Modern Top Navigation */
  .top-nav {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    z-index: 100;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 32px;
    background: rgba(15, 23, 42, 0.75);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    box-sizing: border-box;
  }
  .nav-title {
    color: #f8fafc;
    font-weight: 700;
    font-size: 18px;
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .badge {
    background: rgba(56, 189, 248, 0.15);
    color: var(--accent);
    padding: 4px 8px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
  }
  .nav-actions {
    display: flex;
    gap: 12px;
  }
  .btn {
    background: rgba(255, 255, 255, 0.05);
    color: #e2e8f0;
    border: 1px solid rgba(255, 255, 255, 0.1);
    padding: 10px 18px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    font-family: 'DM Sans', sans-serif;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
  }
  .btn-primary {
    background: linear-gradient(135deg, var(--accent2), var(--accent));
    border: none;
    color: #fff;
    box-shadow: 0 4px 15px rgba(56, 189, 248, 0.3);
  }
  .btn-primary:hover {
    background: linear-gradient(135deg, #6366f1, #0ea5e9);
    box-shadow: 0 6px 20px rgba(56, 189, 248, 0.5);
    transform: translateY(-2px);
  }

  /* Full Screen Loading Overlay */
  .overlay {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(15, 23, 42, 0.85);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    z-index: 1000;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    color: white;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.4s ease;
  }
  .overlay.active {
    opacity: 1;
    pointer-events: all;
  }
  .spinner {
    width: 48px;
    height: 48px;
    border: 3px solid rgba(255,255,255,0.1);
    border-radius: 50%;
    border-top-color: var(--accent);
    animation: spin 1s cubic-bezier(0.55, 0.15, 0.45, 0.85) infinite;
    margin-bottom: 24px;
    box-shadow: 0 0 20px rgba(56, 189, 248, 0.2);
  }
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  .overlay h2 { margin: 0 0 8px 0; font-size: 24px; font-weight: 700; color: #f8fafc; }
  .overlay p { margin: 0; color: #94a3b8; font-size: 15px; }

  /* Certificate Container */
  .cert-wrapper {
    width: 100%;
    max-width: 1050px;
    aspect-ratio: 1.414 / 1; /* A4 landscape */
    background: #fff;
    position: relative;
    box-shadow: 0 20px 50px rgba(0,0,0,0.5);
    margin: 40px;
    color: #0f172a; /* Reset text color for printable area */
  }
  .cert-inner {
    position: absolute;
    top: 20px; left: 20px; right: 20px; bottom: 20px;
    border: 3px solid #1e293b;
    outline: 1px solid #1e293b;
    outline-offset: -8px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 40px;
    background: radial-gradient(circle at center, #ffffff 0%, #f8fafc 100%);
    overflow: hidden;
  }

  .cert-logo {
    font-size: 64px;
    margin-bottom: 15px;
    z-index: 10;
  }
  .cert-club {
    font-weight: 700;
    color: #475569;
    letter-spacing: 2px;
    text-transform: uppercase;
    font-size: 16px;
    margin-bottom: 30px;
    z-index: 10;
  }
  .cert-title {
    font-family: 'Playfair Display', serif;
    font-size: 56px;
    font-weight: 700;
    color: #0f172a;
    margin-bottom: 10px;
    z-index: 10;
  }
  .cert-subtitle {
    font-size: 18px;
    color: #64748b;
    font-style: italic;
    font-family: 'Playfair Display', serif;
    margin-bottom: 35px;
    z-index: 10;
  }
  .cert-name {
    font-family: 'Playfair Display', serif;
    font-size: 48px;
    font-weight: 700;
    color: #4f46e5;
    border-bottom: 2px solid #cbd5e1;
    padding-bottom: 10px;
    margin-bottom: 30px;
    min-width: 450px;
    display: inline-block;
    z-index: 10;
  }
  .cert-desc {
    font-size: 16px;
    color: #334155;
    max-width: 650px;
    line-height: 1.8;
    margin-bottom: 50px;
    z-index: 10;
  }
  .cert-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 85%;
    margin-top: auto;
    padding-top: 30px;
    z-index: 10;
  }
  .sig-block {
    text-align: center;
  }
  .sig-line {
    border-bottom: 1px solid #1e293b;
    width: 200px;
    margin-bottom: 10px;
  }
  .sig-text {
    font-size: 12px;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 1px;
    font-weight: bold;
  }

  /* Decorative watermarks embedded within the inner border */
  .decoration {
    position: absolute;
    width: 300px;
    height: 300px;
    background: radial-gradient(circle, rgba(99, 102, 241, 0.08) 0%, transparent 70%);
    border-radius: 50%;
    z-index: 1;
  }
  .dec-1 { top: -100px; left: -100px; }
  .dec-2 { bottom: -100px; right: -100px; background: radial-gradient(circle, rgba(56, 189, 248, 0.08) 0%, transparent 70%); }

  /* CSS for Printing: Hide buttons, expand to fit A4 paper exactly */
  @media print {
    @page { margin: 0; size: A4 landscape; }
    body { background: #fff; margin: 0; padding: 0; display: block; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .top-nav, .overlay { display: none !important; }
    .cert-wrapper { 
      box-shadow: none; 
      margin: 0;
      width: 100vw;
      height: 100vh;
      max-width: none;
      aspect-ratio: auto;
    }
  }
</style>
</head>
<body>

  <!-- Loading Overlay -->
  <div class="overlay" id="loadingOverlay">
    <div class="spinner"></div>
    <h2>Generating PDF</h2>
    <p>Please wait while we render your high-quality certificate...</p>
  </div>

  <!-- Modern Top Navigation -->
  <div class="top-nav">
    <div class="nav-title">
      🎓 NEXUS <span class="badge">Certificate</span>
    </div>
    <div class="nav-actions">
      <button class="btn" onclick="window.close()">✕ Close Tab</button>
      <button class="btn" onclick="window.print()">🖨️ Print</button>
      <button class="btn btn-primary" id="downloadBtn">📥 Download PDF</button>
    </div>
  </div>

  <div class="cert-wrapper">
    <div class="cert-inner">
      <div class="decoration dec-1"></div>
      <div class="decoration dec-2"></div>
      
      <div class="cert-logo"><?php echo htmlspecialchars($data['icon'] ?? '🎓'); ?></div>
      <div class="cert-club"><?php echo htmlspecialchars($data['club_name']); ?></div>
      
      <div class="cert-title">Certificate of Participation</div>
      <div class="cert-subtitle">This is proudly presented to</div>
      
      <div class="cert-name"><?php echo htmlspecialchars($data['student_name']); ?></div>
      
      <div class="cert-desc">
        In recognition of their active participation and successful completion of <br>
        <strong><?php echo htmlspecialchars($data['event_name']); ?></strong> <br>
        held on <?php echo $date_formatted; ?>.
      </div>
      
      <div class="cert-footer">
        <div class="sig-block">
          <div class="sig-line"></div>
          <div class="sig-text">Club Coordinator</div>
        </div>
        
        <div class="cert-logo" style="font-size: 24px; font-weight: bold; font-family: sans-serif; letter-spacing: 4px; color: #cbd5e1; margin: 0;">NEXUS</div>
        
        <div class="sig-block">
          <div class="sig-line"></div>
          <div class="sig-text">Faculty Advisor</div>
        </div>
      </div>
      
    </div>
  </div>

<script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
<script>
window.onload = function() {
    // Wait briefly for fonts to load completely
    setTimeout(downloadCert, 500);
};

function downloadCert() {
    var overlay = document.getElementById('loadingOverlay');
    overlay.classList.add('active'); // Show overlay
    
    var element = document.querySelector('.cert-wrapper');
    var opt = {
        margin:       0,
        filename:     'Certificate_<?php echo addslashes($safe_event_name); ?>.pdf',
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true },
        jsPDF:        { unit: 'in', format: 'a4', orientation: 'landscape' }
    };
    
    html2pdf().set(opt).from(element).save().then(function() {
        overlay.classList.remove('active'); // Hide overlay
        var btn = document.getElementById('downloadBtn');
        var originalText = btn.innerHTML;
        btn.innerHTML = '✅ Downloaded!';
        setTimeout(function() { btn.innerHTML = originalText; }, 2000);
    }).catch(function(err) {
        overlay.classList.remove('active');
        console.error("PDF generation failed", err);
    });
}

document.getElementById('downloadBtn').addEventListener('click', downloadCert);
</script>
</body>
</html>
