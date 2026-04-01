<?php
// setup.php — Run ONCE after importing schema.sql
// URL: http://localhost/nexus2/setup.php

define('DB_HOST', 'localhost');
define('DB_USER', 'root');
define('DB_PASS', '');               // change if your MySQL has a password
define('DB_NAME', 'club_management');
define('ADMIN_PASSWORD', 'admin123'); // change to your preferred admin password

$conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
if ($conn->connect_error) {
    die("<div style='font-family:sans-serif;background:#0f1117;color:#F472B6;padding:40px;min-height:100vh;'><h2>&#x274C; Database connection failed</h2><p>Error: " . htmlspecialchars($conn->connect_error) . "</p><p>Open setup.php and set the correct DB_PASS value.</p></div>");
}

$hash = password_hash(ADMIN_PASSWORD, PASSWORD_BCRYPT);

if (!password_verify(ADMIN_PASSWORD, $hash)) {
    die("<div style='font-family:sans-serif;background:#0f1117;color:#F472B6;padding:40px;'><h2>&#x274C; Hash verification failed — PHP bcrypt issue on this server.</h2></div>");
}

$stmt = $conn->prepare("UPDATE admin SET password = ?");
$stmt->bind_param("s", $hash);
$ok   = $stmt->execute();
$rows = $stmt->affected_rows;
$total = $conn->query("SELECT COUNT(*) AS n FROM admin")->fetch_assoc()['n'];
?><!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"><title>NEXUS Setup</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Segoe UI',sans-serif;background:#0f1117;color:#e2e8f0;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:20px}
  .box{background:#0c1120;border:1px solid rgba(110,231,255,0.2);border-radius:16px;padding:40px 48px;max-width:560px;width:100%;text-align:center}
  h1{font-size:28px;font-weight:800;color:#6EE7FF;margin-bottom:8px}
  p{color:#7E8BA3;font-size:15px;margin-bottom:6px;line-height:1.6}
  .ok{color:#34D399;font-size:20px;font-weight:700;margin:20px 0 10px}
  .err{color:#F472B6;font-size:18px;font-weight:600;margin:20px 0 8px}
  code{background:rgba(255,255,255,0.08);padding:3px 10px;border-radius:6px;font-family:monospace;color:#A78BFA;font-size:14px}
  .passbox{background:rgba(110,231,255,0.07);border:0.5px solid rgba(110,231,255,0.25);border-radius:12px;padding:16px 24px;margin:20px 0;display:inline-block}
  .pw{font-family:monospace;font-size:24px;font-weight:700;color:#6EE7FF;letter-spacing:2px}
  .label{font-size:12px;color:#7E8BA3;margin-bottom:6px}
  .btn{display:inline-block;margin-top:28px;padding:13px 32px;background:linear-gradient(135deg,#6EE7FF,#A78BFA);color:#050810;font-weight:700;border-radius:10px;text-decoration:none;font-size:15px}
  table{width:100%;margin:20px 0;border-collapse:collapse;text-align:left}
  td,th{padding:9px 12px;border-bottom:1px solid rgba(255,255,255,0.07);font-size:13px}
  th{color:#7E8BA3;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:0.5px}
  td:first-child{color:#e2e8f0}
  td:last-child{color:#A78BFA;font-family:monospace;font-size:12px}
  .warn{background:rgba(252,211,77,0.08);border:0.5px solid rgba(252,211,77,0.25);border-radius:10px;padding:12px 16px;font-size:13px;color:#FCD34D;margin-top:20px}
</style>
</head>
<body>
<div class="box">
  <h1>&#x1F510; NEXUS Setup</h1>
<?php if ($ok && $rows > 0): ?>
  <div class="ok">&#x2713; Setup complete!</div>
  <p>All <strong><?= $rows ?></strong> admin accounts are ready.</p>
  <div class="passbox">
    <div class="label">Password for all admin accounts</div>
    <div class="pw"><?= htmlspecialchars(ADMIN_PASSWORD) ?></div>
  </div>
  <table>
    <tr><th>Club</th><th>Admin Email</th></tr>
    <?php
    $res = $conn->query("SELECT a.email, c.club_name, c.icon FROM admin a JOIN club c ON a.club_id=c.club_id ORDER BY c.club_id");
    while ($r = $res->fetch_assoc()):
    ?>
    <tr>
      <td><?= htmlspecialchars($r['icon'].' '.$r['club_name']) ?></td>
      <td><?= htmlspecialchars($r['email']) ?></td>
    </tr>
    <?php endwhile; ?>
  </table>
  <div class="warn">&#x26A0;&#xFE0F; Delete or rename <code>setup.php</code> after setup.</div>
  <a class="btn" href="club_management.html">Open NEXUS &#8594;</a>
<?php elseif ($total == 0): ?>
  <div class="err">&#x26A0; No admin accounts found</div>
  <p>Import <code>schema.sql</code> in phpMyAdmin first, then refresh this page.</p>
<?php else: ?>
  <div class="err">&#x274C; Update failed: <?= htmlspecialchars($conn->error) ?></div>
<?php endif; ?>
</div>
</body>
</html>
