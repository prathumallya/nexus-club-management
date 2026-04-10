// ═══════════════════════════════════════════════════════
// NEXUS — Club Management System
// All data loaded from MySQL via PHP API
// Falls back to static demo data when backend is offline
// ═══════════════════════════════════════════════════════

// ══════════════════════════════════════
// API CONFIG — points to PHP backend
// ══════════════════════════════════════
// Dynamically resolve API path relative to this HTML file's location
// Works whether folder is named nexus, nexus2, or anything else
var API_BASE = (function() {
  var path = window.location.pathname;
  // Get the directory of the current page (strip filename)
  var dir = path.substring(0, path.lastIndexOf('/') + 1);
  return window.location.origin + dir + 'api';
})();
var authToken = null; // will be set by loadSavedToken() after functions are defined
var API_ONLINE = false; // will be set true on first successful API call

function apiHeaders() {
  var h = { 'Content-Type': 'application/json' };
  if (authToken) {
    h['Authorization'] = 'Bearer ' + authToken;
    h['X-Auth-Token']  = authToken;  // fallback — Apache never strips X-* headers
  }
  return h;
}

// Store token in cookie as well (fallback for Apache that strips Authorization header)
function saveToken(token) {
  authToken = token;
  // sessionStorage is cleared automatically when the browser tab closes
  try { sessionStorage.setItem('nexus_token', token); } catch(e) {}
  // Session cookie (no expires = deleted when browser closes)
  try { document.cookie = 'nexus_token=' + encodeURIComponent(token) + '; path=/; SameSite=Lax'; } catch(e) {}
}

function clearToken() {
  authToken = null;
  try { sessionStorage.removeItem('nexus_token'); } catch(e) {}
  try { localStorage.removeItem('nexus_token'); } catch(e) {} // clear legacy if any
  try { document.cookie = 'nexus_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'; } catch(e) {}
}

function loadSavedToken() {
  // sessionStorage is cleared on tab/browser close — perfect for auto-logout
  try {
    var t = sessionStorage.getItem('nexus_token');
    if (t) return t;
  } catch(e) {}
  // Cookie fallback (also a session cookie — cleared on browser close)
  try {
    var match = document.cookie.match(/(?:^|;\s*)nexus_token=([^;]+)/);
    if (match) return decodeURIComponent(match[1]);
  } catch(e) {}
  return null;
}

// Route JS paths → PHP query params
function phpUrl(method, path) {
  var base  = path.split('?')[0].replace(/^\//, '');
  var qs    = path.includes('?') ? path.split('?')[1] : '';
  var parts = base.split('/');

  if (parts[0] === 'auth')
    return API_BASE + '/auth.php?action=' + parts[1].replace(/-/g,'_');
  if (parts[0] === 'clubs' && parts.length === 1)
    return API_BASE + '/clubs.php' + (qs ? '?' + qs : '');
  if (parts[0] === 'clubs' && parts.length === 2 && parts[1] === 'apply_by_name')
    return API_BASE + '/clubs.php?action=apply_by_name';
  if (parts[0] === 'clubs' && parts.length === 2 && !isNaN(parts[1]))
    return API_BASE + '/clubs.php?id=' + parts[1];
  if (parts[0] === 'clubs' && parts[2] === 'apply')
    return API_BASE + '/clubs.php?action=apply&id=' + parts[1];
  if (parts[0] === 'memberships')
    return API_BASE + '/clubs.php?action=review&id=' + parts[1];
  if (parts[0] === 'events' && parts.length === 1)
    return API_BASE + '/events.php' + (qs ? '?' + qs : '');
  if (parts[0] === 'events' && parts.length === 2 && !isNaN(parts[1]) && (method === 'GET'))
    return API_BASE + '/events.php?id=' + parts[1];
  if (parts[0] === 'events' && parts.length === 2 && method === 'DELETE')
    return API_BASE + '/events.php?id=' + parts[1];
  if (parts[0] === 'events' && parts[2] === 'registration' && method === 'DELETE')
    return API_BASE + '/events.php?action=cancel_reg&id=' + parts[1];
  if (parts[0] === 'events' && parts[2] === 'admin_reg' && method === 'DELETE')
    return API_BASE + '/events.php?action=admin_del_reg&id=' + parts[1] + '&student_id=' + parts[3];
  if (parts[0] === 'events' && parts.length === 2 && method === 'PUT')
    return API_BASE + '/events.php?id=' + parts[1];
  if (parts[0] === 'events' && parts.length === 1 && method === 'POST')
    return API_BASE + '/events.php';
  if (parts[0] === 'events' && parts[2] === 'register')
    return API_BASE + '/events.php?action=register_' + parts[3] + '&id=' + parts[1];
  // register_solo / register_team called directly with underscore
  if (parts[0] === 'events' && (parts[2] === 'register_solo' || parts[2] === 'register_team'))
    return API_BASE + '/events.php?action=' + parts[2] + '&id=' + parts[1];
  if (parts[0] === 'events' && parts[2] === 'registrations')
    return API_BASE + '/events.php?action=registrations&id=' + parts[1];
  if (parts[0] === 'events' && parts[2] === 'attendance' && parts[3] === 'all')
    return API_BASE + '/events.php?action=attendance_all&id=' + parts[1];
  if (parts[0] === 'events' && parts[2] === 'attendance')
    return API_BASE + '/events.php?action=attendance&id=' + parts[1];
  if (parts[0] === 'teams' && parts[1] === 'join')
    return API_BASE + '/teams.php?action=join';
  if (parts[0] === 'teams' && parts[1] === 'members')
    return API_BASE + '/teams.php?action=members&id=' + parts[2];
  if (parts[0] === 'teams' && parts[1] === 'by_code')
    return API_BASE + '/teams.php?action=by_code&code=' + (qs.split('=')[1]||'');
  if (parts[0] === 'teams' && parts[1] === 'for_event')
    return API_BASE + '/teams.php?action=for_event&id=' + parts[2];
  if (parts[0] === 'teams' && parts[1] === 'delete')
    return API_BASE + '/teams.php?action=delete&id=' + parts[2];
  if (parts[0] === 'teams')
    return API_BASE + '/teams.php?action=' + parts[1];
  if (parts[0] === 'students')
    return API_BASE + '/student.php?action=me';
  if (parts[0] === 'admin')
    return API_BASE + '/student.php?action=admin_dashboard';
  return API_BASE + '/' + parts[0] + '.php' + (qs ? '?' + qs : '');
}

async function api(method, path, body) {
  try {
    var url  = phpUrl(method, path);
    var opts = { method: method, headers: apiHeaders() };
    if (body && method !== 'GET') opts.body = JSON.stringify(body);
    var res  = await fetch(url, opts);
    var data = await res.json();
    if (!res.ok) { showToast(data.error || 'Server error'); return null; }
    API_ONLINE = true;
    return data;
  } catch(e) {
    console.info('[NEXUS] Backend not reachable:', e.message);
    return null;
  }
}

// ══════════════════════════════════════
// STATIC FALLBACK DATA (used when DB offline)
// ══════════════════════════════════════
var clubs = [
  { name:"Code Crafters",    desc:"Build real-world projects, compete in hackathons, and level up your dev skills.",      icon:"💻", color:"cyan",   tag:"tech",    members:142 },
  { name:"AI Lab Society",   desc:"Explore machine learning, NLP, and robotics through workshops and research.",          icon:"🤖", color:"cyan",   tag:"tech",    members:89  },
  { name:"Pixel & Lens",     desc:"Photography, filmmaking, and visual storytelling — capture the world your way.",       icon:"📷", color:"purple", tag:"arts",    members:67  },
  { name:"Design Collective",desc:"UI/UX, branding, motion design, and creative direction for passionate designers.",     icon:"🎨", color:"purple", tag:"arts",    members:53  },
  { name:"Thunderbolts FC",  desc:"Inter-college football team open to all skill levels. Practice Tue & Thu.",            icon:"⚽", color:"green",  tag:"sports",  members:38  },
  { name:"Smash Circuit",    desc:"Badminton and table tennis tournaments, coaching sessions, and inter-college leagues.", icon:"🏸", color:"green",  tag:"sports",  members:44  },
  { name:"Harmony Choir",    desc:"Classical and contemporary choral singing — no auditions, just passion.",              icon:"🎵", color:"amber",  tag:"culture", members:55  },
  { name:"Rangmanch Drama",  desc:"Theatre, improv, and street plays that push boundaries and spark conversations.",      icon:"🎭", color:"amber",  tag:"culture", members:61  },
  { name:"Green Campus",     desc:"Environmental advocacy, campus sustainability projects, and eco-awareness campaigns.",  icon:"🌿", color:"green",  tag:"social",  members:77  },
  { name:"Debate Society",   desc:"Competitive debating, Model UN, public speaking workshops and national tournaments.",  icon:"🗣️",color:"cyan",   tag:"social",  members:49  },
  { name:"Music Syndicate",  desc:"Live performances, jam sessions, band practice rooms, and annual music festival.",     icon:"🎸", color:"pink",   tag:"arts",    members:91  },
  { name:"Robotics Guild",   desc:"Build autonomous robots, participate in national competitions, explore electronics.",  icon:"🦾", color:"cyan",   tag:"tech",    members:35  },
];

var events = [
  { id:0, day:18, month:"Mar", name:"24-Hour Hackathon — InnoSprint",   club:"Code Crafters",   time:"10:00 AM", location:"Innovation Lab, Block C",  desc:"Build something wild in 24 hours. Cash prizes worth ₹50,000.", badge:"soon",     badgeText:"Tomorrow",  teamSize:3 },
  { id:1, day:19, month:"Mar", name:"Golden Hour Photography Walk",      club:"Pixel & Lens",    time:"5:30 PM",  location:"Campus Gardens",            desc:"Capture the golden hour magic around campus.",               badge:"soon",     badgeText:"This Week"              },
  { id:2, day:21, month:"Mar", name:"Cultural Fest Grand Rehearsal",     club:"Rangmanch Drama", time:"3:00 PM",  location:"Main Auditorium",           desc:"Full dress rehearsal for the Spring Cultural Fest.",          badge:"upcoming", badgeText:"5 Days"                 },
  { id:3, day:22, month:"Mar", name:"Sunrise Yoga & Wellness Day",       club:"Green Campus",    time:"7:00 AM",  location:"Open Ground, Sports Block", desc:"Start your day with yoga, meditation, and a healthy breakfast.", badge:"open",   badgeText:"Open Reg."              },
  { id:4, day:25, month:"Mar", name:"AI & Future of Work Panel",         club:"AI Lab Society",  time:"2:00 PM",  location:"Seminar Hall B",            desc:"Industry experts discuss how AI is reshaping careers.",       badge:"open",     badgeText:"Open Reg.", teamSize:2 },
  { id:5, day:28, month:"Mar", name:"Battle of Bands — Spring Edition",  club:"Music Syndicate", time:"6:00 PM",  location:"Open Air Theatre",          desc:"8 college bands compete for the Spring Cup. Free entry!",     badge:"upcoming", badgeText:"11 Days"                },
  { id:6, day:30, month:"Mar", name:"Inter-College Debate Championship", club:"Debate Society",  time:"9:00 AM",  location:"Conference Centre",         desc:"8 colleges, 3 rounds, 1 champion.",                          badge:"upcoming", badgeText:"13 Days"                },
  { id:7, day:2,  month:"Apr", name:"Spring Robotics Showcase",          club:"Robotics Guild",  time:"11:00 AM", location:"Workshop Hall, Block D",    desc:"Watch autonomous robots navigate obstacle courses.",          badge:"upcoming", badgeText:"Apr"                    },
];

// ══════════════════════════════════════
// LOAD FROM DATABASE
// ══════════════════════════════════════
async function loadFromDB() {
  // Load clubs from MySQL
  var dbClubs = await api('GET', '/clubs');
  if (dbClubs && dbClubs.length) {
    clubs = dbClubs.map(function(c) {
      return {
        id:      c.club_id,
        name:    c.club_name,
        desc:    c.description || '',
        icon:    c.icon        || '🏛️',
        color:   c.color       || 'cyan',
        tag:     c.category    || 'social',
        members: c.member_count|| 0
      };
    });
    console.log('[NEXUS] Loaded', clubs.length, 'clubs from DB');
  } else {
    console.info('[NEXUS] Clubs loaded from static data');
  }

  // Load events from MySQL
  var dbEvents = await api('GET', '/events');
  if (dbEvents && dbEvents.length) {
    events = dbEvents.map(function(e) {
      var d = e.event_date ? new Date(e.event_date + 'T00:00:00') : null;
      return {
        id:        e.event_id,
        day:       d ? d.getDate() : '?',
        month:     d ? d.toLocaleString('en', { month: 'short' }) : '?',
        name:      e.event_name,
        club:      e.club_name  || '',
        time:      e.event_time ? e.event_time.substr(0, 5) : '',
        location:  e.venue      || '',
        desc:      e.description|| '',
        badge:     e.status === 'open' ? 'open' : 'upcoming',
        badgeText: e.status === 'open' ? 'Open Reg.' : 'Upcoming',
        teamSize:  e.team_size > 1 ? e.team_size : null,
        status:    e.status
      };
    }).filter(function(e) {
      return e.status !== 'closed'; // hide past/closed events from students
    });
    console.log('[NEXUS] Loaded', events.length, 'events from DB');
  } else {
    console.info('[NEXUS] Events loaded from static data');
  }

  // Render everything with fresh data
  renderClubs(clubs);
  renderEvents();
  renderSlider();
  renderCalendar();
}

// ══════════════════════════════════════
// STATE
// ══════════════════════════════════════
var applications  = [];
var clubEvents    = [];         // admin-created events (also loaded from DB)
var teamRegistry  = {};         // teamCode -> { eventId, teamName, members[], maxSize }
var eventRegs     = {};         // eventId -> { teamId? }
var userEventLog  = {};         // eventId -> { type, teamId?, teamName?, role? }
var currentAdmin  = null;
var currentUser   = null;
var adminFilter   = 'all';
var currentTag    = 'all';
var currentClubApp= null;
var editingEventId= null;
var sliderIndex   = 0;
var sliderCount   = 0;
var sliderTimer   = null;
var toastTimer    = null;

// ══════════════════════════════════════
// UTILITIES
// ══════════════════════════════════════
function el(id)  { return document.getElementById(id); }
function val(id) { var e = el(id); return e ? e.value.trim() : ''; }


function openModal(id)  { el(id).classList.add('open');    document.body.style.overflow = 'hidden'; }
function closeModal(id) { el(id).classList.remove('open'); document.body.style.overflow = '';       }
function overlayClick(e, id) { if (e.target === el(id)) closeModal(id); }

function setNavArea(node) {
  var area = el('nav-user-area');
  area.innerHTML = '';
  area.appendChild(node);
}

function makeNavBtn(text, fn) {
  var b = document.createElement('button');
  b.className   = 'nav-register';
  b.textContent = text;
  b.onclick     = fn;
  return b;
}

function esc(s) { return String(s).replace(/\\/g,'\\\\').replace(/'/g,"\\'"); }

// ══════════════════════════════════════
// NAVIGATION
// ══════════════════════════════════════
function showSection(id, link) {
  document.querySelectorAll('section').forEach(function(s){ s.classList.remove('active'); });
  el(id).classList.add('active');
  document.querySelectorAll('nav ul li a').forEach(function(a){ a.classList.remove('active'); });
  if (link) link.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (id === 'admin')  renderAdminPanel();
  if (id === 'udash')  renderUserDashboard();
  if (id === 'events') addJoinTeamBtn();
}

// ══════════════════════════════════════
// AUTH MODAL
// ══════════════════════════════════════
function openAuthModal(tab) { switchAuthTab(tab || 'login'); openModal('auth-modal'); }
function closeAuthModal(e)  { if (!e || e.target === el('auth-modal')) closeModal('auth-modal'); }
function scrollToAuth()     { openAuthModal('login'); }

function switchAuthTab(tab) {
  ['login','register','admin'].forEach(function(t) {
    var p = el('modal-' + t), b = el('tab-' + t);
    if (p) p.style.display = t === tab ? 'block' : 'none';
    if (b) b.classList.toggle('active', t === tab);
  });
}

// ── Student login ──
function studentLogin() {
  var email = val('s-email');
  var name  = val('s-name') || '';
  var pass  = el('s-pass') ? el('s-pass').value : '';
  if (!email) { showToast('Please enter your email'); return; }

  api('POST', '/auth/login', { email: email, password: pass }).then(function(result) {
    if (result && result.token) {
      saveToken(result.token);
      var u = result.user;
      currentUser = { id: u.id, name: u.name, email: u.email, initial: u.name.charAt(0).toUpperCase(), studentCode: u.student_code || '' };
      closeModal('auth-modal');
      showToast('Welcome back, ' + currentUser.name + '!');
      buildStudentNav();
      renderClubsFiltered();
      loadDashboardData();
    } else {
      // Error toast already shown by api() with specific reason from PHP
    }
  });
}

// ── Student register ──
function studentRegister() {
  var name  = val('r-name');
  var email = val('r-email');
  var pass  = el('r-pass') ? el('r-pass').value : '';
  var sid   = val('r-sid');
  if (!name || !email || !pass) { showToast('Please fill in name, email and password'); return; }

  api('POST', '/auth/register', { name: name, email: email, password: pass, student_code: sid }).then(function(result) {
    if (result && result.token) {
      saveToken(result.token);
      currentUser = { id: result.user.id, name: name, email: email, initial: name.charAt(0).toUpperCase(), studentCode: sid || '' };
      closeModal('auth-modal');
      showToast('Account created! Welcome to NEXUS 🎉');
      buildStudentNav();
      renderClubsFiltered();
    } else {
      // Error toast already shown by api() with the exact reason from PHP
    }
  });
}

function buildStudentNav() {
  var wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;align-items:center;gap:10px;';
  // Avatar
  var av = document.createElement('div');
  av.style.cssText = 'width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,var(--accent),var(--accent2));display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:#050810;cursor:pointer;flex-shrink:0;';
  av.textContent = currentUser.initial;
  av.onclick = function(){ showSection('udash', null); };
  // Name
  var sp = document.createElement('span');
  sp.style.cssText = 'font-size:13px;color:var(--muted);cursor:pointer;max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
  sp.textContent   = currentUser.name;
  sp.onclick = function(){ showSection('udash', null); };
  // Sign Out button
  var so = document.createElement('button');
  so.style.cssText = 'display:flex;align-items:center;gap:5px;background:rgba(244,114,182,0.08);border:0.5px solid rgba(244,114,182,0.25);color:#F472B6;cursor:pointer;font-size:12px;padding:5px 11px;border-radius:8px;font-family:var(--font-body);font-weight:500;transition:background 0.2s;';
  so.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>Sign Out';
  so.onmouseover = function(){ this.style.background='rgba(244,114,182,0.15)'; };
  so.onmouseout  = function(){ this.style.background='rgba(244,114,182,0.08)'; };
  so.onclick     = studentLogout;
  wrap.appendChild(av); wrap.appendChild(sp); wrap.appendChild(so);
  setNavArea(wrap);
}

function studentLogout() {
  currentUser  = null;
  userEventLog = {};
  eventRegs    = {};
  clearToken();
  setNavArea(makeNavBtn('Sign In / Register', function(){ openAuthModal('login'); }));
  showToast('Signed out');
  renderClubsFiltered();
  renderUserDashboard();
}

// ── Admin login ──
function adminLogin() {
  var email = val('admin-email');
  var pass  = el('admin-pass') ? el('admin-pass').value : '';

  if (!email || !pass) {
    showToast('Please enter your admin email and password');
    return;
  }

  api('POST', '/auth/admin_login', { email: email, password: pass }).then(function(result) {
    if (result && result.token) {
      saveToken(result.token);
      var ad = result.admin;
      currentAdmin = { name: ad.club_name, icon: ad.icon || '🏛️', color: ad.color || 'cyan', id: ad.club_id };
      closeModal('auth-modal');
      buildAdminNav();
      showSection('admin', null);
      showToast('Signed in as ' + ad.club_name + ' admin');
      loadAdminClubEvents();
    } else {
      // Error toast already shown by api() with the specific message from PHP
    }
  });
}

function buildAdminNav() {
  var wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;align-items:center;gap:10px;';
  // Club icon badge
  var ico = document.createElement('div');
  ico.style.cssText  = 'width:32px;height:32px;border-radius:8px;background:rgba(252,211,77,0.15);display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;';
  ico.textContent    = currentAdmin.icon;
  // Club name
  var nm = document.createElement('span');
  nm.style.cssText   = 'font-size:13px;color:var(--accent3);font-weight:500;max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
  nm.textContent     = currentAdmin.name;
  // Dashboard button
  var db = document.createElement('button');
  db.style.cssText   = 'display:flex;align-items:center;gap:5px;background:rgba(252,211,77,0.1);color:var(--accent3);border:0.5px solid rgba(252,211,77,0.2);padding:5px 11px;border-radius:8px;cursor:pointer;font-size:12px;font-family:var(--font-body);font-weight:500;transition:background 0.2s;';
  db.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>Dashboard';
  db.onmouseover = function(){ this.style.background='rgba(252,211,77,0.18)'; };
  db.onmouseout  = function(){ this.style.background='rgba(252,211,77,0.1)'; };
  db.onclick = function(){ showSection('admin', null); };
  // Sign Out button
  var so = document.createElement('button');
  so.style.cssText = 'display:flex;align-items:center;gap:5px;background:rgba(244,114,182,0.08);border:0.5px solid rgba(244,114,182,0.25);color:#F472B6;cursor:pointer;font-size:12px;padding:5px 11px;border-radius:8px;font-family:var(--font-body);font-weight:500;transition:background 0.2s;';
  so.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>Sign Out';
  so.onmouseover = function(){ this.style.background='rgba(244,114,182,0.15)'; };
  so.onmouseout  = function(){ this.style.background='rgba(244,114,182,0.08)'; };
  so.onclick     = adminLogout;
  wrap.appendChild(ico); wrap.appendChild(nm); wrap.appendChild(db); wrap.appendChild(so);
  setNavArea(wrap);
}

function adminLogout() {
  currentAdmin = null;
  adminFilter  = 'all';
  clearToken();
  setNavArea(makeNavBtn('Sign In / Register', function(){ openAuthModal('login'); }));
  el('admin-login-prompt').style.display = 'flex';
  el('admin-dashboard').style.display    = 'none';
  showSection('home', null);
  showToast('Signed out');
}

// Load club-specific events from DB when admin logs in
function loadAdminClubEvents() {
  if (!currentAdmin || !currentAdmin.id) return;
  api('GET', '/events?club_id=' + currentAdmin.id).then(function(rows) {
    if (!rows) return;
    rows.forEach(function(e) {
      if (!clubEvents.find(function(ce){ return ce.id === e.event_id; })) {
        var d = e.event_date ? new Date(e.event_date + 'T00:00:00') : null;
        clubEvents.push({
          id:           e.event_id,
          clubName:     e.club_name || currentAdmin.name,
          title:        e.event_name,
          date:         e.event_date,
          time:         e.event_time ? e.event_time.substr(0,5) : '',
          venue:        e.venue       || '',
          desc:         e.description || '',
          type:         e.team_size > 1 ? 'team' : 'solo',
          teamSize:     e.team_size   || 1,
          maxReg:       e.capacity    || 100,
          status:       e.status,
          registrations:[],
          attendance:   {}
        });
      }
    });
    renderAdminEvents();
    renderAttendanceEventList();
    renderEvents();
  });
}

// ══════════════════════════════════════
// CLUBS
// ══════════════════════════════════════
function renderClubsFiltered() {
  renderClubs(clubs.filter(function(c){ return currentTag === 'all' || c.tag === currentTag; }));
}

function renderClubs(list) {
  var g = el('clubs-grid');
  g.innerHTML = list.map(function(c) {
    var app = currentUser && applications.find(function(a){ return a.club === c.name && a.email === currentUser.email; });
    var action;
    if (app) {
      var colorMap  = { accepted:'sports', rejected:'social', pending:'culture' };
      var labelMap  = { accepted:'✓ Member', rejected:'✗ Rejected', pending:'⏳ Pending' };
      action = '<span class="club-tag ' + (colorMap[app.status]||'culture') + '" style="font-size:11px;">' + (labelMap[app.status]||app.status) + '</span>';
    } else {
      action = '<button class="app-btn view-app" onclick="openClubModal(event,\'' + esc(c.name) + '\')" style="font-size:12px;padding:6px 14px;border-radius:8px;cursor:pointer;">Apply →</button>';
    }
    return '<div class="club-card" data-color="' + c.color + '">' +
      '<div class="club-icon ' + c.color + '">' + c.icon + '</div>' +
      '<div class="club-name">'  + c.name + '</div>' +
      '<div class="club-desc">'  + c.desc + '</div>' +
      '<div class="club-meta">' +
        '<div class="club-members"><div class="member-dots"><div class="member-dot"></div><div class="member-dot"></div><div class="member-dot"></div></div>+' + c.members + ' members</div>' +
        action +
      '</div></div>';
  }).join('');
}

function filterClubs(query) {
  var q = query.toLowerCase();
  renderClubs(clubs.filter(function(c){
    return (currentTag === 'all' || c.tag === currentTag) &&
           (c.name.toLowerCase().includes(q) || c.desc.toLowerCase().includes(q));
  }));
}

function filterTag(tag, btn) {
  currentTag = tag;
  document.querySelectorAll('.filter-pill').forEach(function(b){ b.classList.remove('active'); });
  if (btn) btn.classList.add('active');
  filterClubs(document.querySelector('.search-box') ? document.querySelector('.search-box').value : '');
}

// ── Club Application Modal ──
function openClubModal(e, clubName) {
  e.stopPropagation();
  if (!currentUser) { openAuthModal('login'); showToast('Please sign in to apply'); return; }
  var club = clubs.find(function(c){ return c.name === clubName; });
  if (!club) return;
  currentClubApp = club;
  el('cmi-icon').textContent  = club.icon;
  el('cmi-icon').className    = 'club-modal-icon ' + club.color;
  el('cmi-name').textContent  = club.name;
  el('cmi-tagline').textContent = club.desc.substring(0,60) + '…';
  ['cf-name','cf-id','cf-email','cf-dept','cf-why','cf-skills'].forEach(function(id){ var e=el(id); if(e) e.value=''; });
  el('cf-year').value = ''; el('cf-avail').value = '';
  if (currentUser) {
    var n = el('cf-name');  if (n)  n.value  = currentUser.name;
    var em= el('cf-email'); if (em) em.value = currentUser.email;
  }
  openModal('club-apply-modal');
}
function closeClubModal(e) { if (!e || e.target === el('club-apply-modal')) closeModal('club-apply-modal'); }

function submitApplication() {
  var name = val('cf-name'), email = val('cf-email'), sid = val('cf-id'), why = val('cf-why');
  if (!name||!email||!sid||!why) { showToast('Please fill in all required fields'); return; }

  var appData = {
    id: Date.now(), club: currentClubApp.name, clubIcon: currentClubApp.icon,
    clubColor: currentClubApp.color, name: name, email: email, studentId: sid,
    year: val('cf-year'), dept: val('cf-dept'), why: why,
    skills: val('cf-skills'), availability: val('cf-avail'), status: 'pending',
    date: new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})
  };

  if (!authToken) {
    showToast('Please sign in before applying to a club');
    closeModal('club-apply-modal');
    openAuthModal('login');
    return;
  }

  var clubId = currentClubApp.id;
  var applyUrl = clubId ? '/clubs/' + clubId + '/apply' : '/clubs/apply_by_name';
  api('POST', applyUrl, { club_name: currentClubApp.name, why_join: why, skills: val('cf-skills'), availability: val('cf-avail') }).then(function(r) {
    if (r === null) return; // error shown by api()
    appData.id = r.membership_id || appData.id;
    applications.push(appData);
    closeModal('club-apply-modal');
    showToast('Application submitted! The club admin will review it ✓');
    renderClubsFiltered();
    renderAdminPanel();
    renderUserDashboard();
  });
}

// ══════════════════════════════════════
// EVENTS — public listing
// ══════════════════════════════════════
function isReg(eventId) { return !!eventRegs[eventId]; }

function renderEvents() {
  var today = new Date(); today.setHours(0,0,0,0);

  // Filter out past events from static/DB list
  var liveEvents = events.filter(function(e) {
    if (!e.day || !e.month) return true; // keep if no date info
    var monthNames = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
    var mIdx = monthNames.indexOf((e.month||'').toLowerCase().substr(0,3));
    var yr   = today.getFullYear();
    if (mIdx === -1) return true;
    var evtDate = new Date(yr, mIdx, parseInt(e.day));
    // If event month is earlier than current and no year mismatch, assume next year
    if (evtDate < today && mIdx < today.getMonth()) evtDate.setFullYear(yr + 1);
    return evtDate >= today;
  });

  // Merge static + admin-created events, filtering out past ones (but showing closed if they are today/future or no date)
  var liveClubEvents = clubEvents.filter(function(e) {
    if (!e.date) return true;
    var d = new Date(e.date + 'T00:00:00');
    return d >= today;
  });

  var all = liveEvents.concat(liveClubEvents.map(function(e) {
    var d = e.date ? new Date(e.date + 'T00:00:00') : null;
    return {
      id: e.id, day: d ? d.getDate() : '?', month: d ? d.toLocaleString('en',{month:'short'}) : '?',
      name: e.title, club: e.clubName, time: e.time || '', location: e.venue || '',
      desc: e.desc || '',
      badge: e.status === 'open' ? 'open' : (e.status === 'closed' ? 'closed' : 'upcoming'),
      badgeText: e.status === 'open' ? 'Open Reg.' : (e.status === 'closed' ? 'Closed' : 'Upcoming'),
      teamSize: e.type === 'team' ? e.teamSize : null
    };
  }));

  el('event-list').innerHTML = all.map(function(e) {
    var reg = isReg(e.id);
    return '<div class="event-card">' +
      '<div class="event-date-box"><div class="event-day">'  + e.day   + '</div><div class="event-month">' + e.month + '</div></div>' +
      '<div class="event-info">' +
        '<div class="event-name">' + e.name + '</div>' +
        '<div class="event-meta-row">' +
          (e.time     ? '<div class="event-meta-item">🕐 ' + e.time                       + '</div>' : '') +
          (e.location ? '<div class="event-meta-item">📍 ' + e.location                   + '</div>' : '') +
                        '<div class="event-meta-item">🏷️ '  + e.club                      + '</div>'       +
          (e.teamSize ? '<div class="event-meta-item">👥 Teams of ' + e.teamSize           + '</div>' : '') +
        '</div>' +
        '<div class="event-desc">' + e.desc + '</div>' +
      '</div>' +
      '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px;align-self:flex-start;">' +
        '<span class="event-badge ' + e.badge + '">' + e.badgeText + '</span>' +
        (reg ? 
          '<button class="reg-btn registered" disabled style="opacity:0.8;cursor:default;">✓ Registered</button>' : 
         e.badge === 'upcoming' ? 
          '<button class="reg-btn" disabled style="opacity:0.5;background:rgba(255,255,255,0.05);color:var(--muted);cursor:not-allowed;box-shadow:none;">Reg Opens Soon</button>' : 
         e.badge === 'closed' ?
          '<button class="reg-btn" disabled style="opacity:0.5;background:rgba(244,114,182,0.1);color:#F472B6;cursor:not-allowed;border:0.5px solid rgba(244,114,182,0.2);box-shadow:none;">Closed</button>' :
          '<button class="reg-btn" onclick="openEventReg(' + e.id + ')">Register</button>'
        ) +
      '</div>' +
    '</div>';
  }).join('');
  addJoinTeamBtn();
}

function addJoinTeamBtn() {
  var ph = document.querySelector('#events .page-head');
  if (ph && !el('join-team-btn')) {
    var btn       = document.createElement('button');
    btn.id        = 'join-team-btn';
    btn.className = 'btn-ghost';
    btn.style.cssText = 'font-size:13px;padding:10px 18px;margin-top:12px;display:inline-flex;align-items:center;gap:7px;';
    btn.innerHTML = '👥 Join by Team ID';
    btn.onclick   = openJoinTeamModal;
    ph.appendChild(btn);
  }
}

// ── Event Registration Modal ──
function openEventReg(eventId) {
  if (isReg(eventId)) { showToast('You are already registered for this event!'); return; }
  if (!authToken) {
    showToast('Please sign in to register for events');
    openAuthModal('login');
    return;
  }
  var evt = clubEvents.find(function(e){ return e.id === eventId; });
  var stt = events.find(function(e){ return e.id === eventId; });
  var title, dateStr, venue, isTeam = false, teamSize = 2;
  if (evt)      { title=evt.title; dateStr=evt.date; venue=evt.venue; isTeam=evt.type==='team'; teamSize=evt.teamSize||2; }
  else if (stt) { title=stt.name; dateStr=stt.month+' '+stt.day; venue=stt.location; isTeam=!!stt.teamSize; teamSize=stt.teamSize||2; }
  else return;

  el('erm-header').innerHTML =
    '<div style="font-family:var(--font-head);font-size:18px;font-weight:800;margin-bottom:4px;">' + title + '</div>' +
    '<div style="font-size:12px;color:var(--muted);">' + (dateStr||'') + (venue ? ' &middot; ' + venue : '') + '</div>';

  var body = el('erm-body');
  body.innerHTML = '';

  if (isTeam) {
    var banner = document.createElement('div');
    banner.style.cssText = 'display:flex;align-items:center;gap:12px;margin-bottom:20px;padding:14px 16px;background:rgba(167,139,250,0.07);border:0.5px solid rgba(167,139,250,0.2);border-radius:12px;';
    banner.innerHTML = '<span style="font-size:24px;">👑</span><div>' +
      '<div style="font-size:13px;font-weight:600;color:var(--accent2);">Register as Team Leader</div>' +
      '<div style="font-size:12px;color:var(--muted);margin-top:3px;">You\'ll receive a <strong>Team ID</strong> to share with your ' + (teamSize-1) + ' teammate' + (teamSize>2?'s':'') + '. Others join from the Events page.</div></div>';
    body.appendChild(banner);

    var tg = document.createElement('div'); tg.className = 'input-group';
    tg.innerHTML = '<label>Team Name</label><input id="erm-teamname" class="slot-input" style="width:100%;" placeholder="e.g. NullPointers" />';
    body.appendChild(tg);

    var row = document.createElement('div'); row.className = 'form-row';
    var lg  = document.createElement('div'); lg.className  = 'input-group';
    lg.innerHTML = '<label>Your Name</label><input id="erm-leader-name" class="slot-input" placeholder="Your full name" />';
    var ig  = document.createElement('div'); ig.className  = 'input-group';
    ig.innerHTML = '<label>Student ID</label><input id="erm-leader-id" class="slot-input" placeholder="CS2024001" />';
    row.appendChild(lg); row.appendChild(ig); body.appendChild(row);
    if (currentUser) { 
      var ln = el('erm-leader-name'); if (ln) ln.value = currentUser.name; 
      var lid = el('erm-leader-id');  if (lid && currentUser.studentCode) lid.value = currentUser.studentCode;
    }

    var info = document.createElement('div');
    info.style.cssText = 'background:rgba(255,255,255,0.03);border:0.5px solid var(--border);border-radius:10px;padding:12px 16px;margin-bottom:16px;font-size:12px;color:var(--muted);line-height:1.6;';
    info.textContent = 'Team size: ' + teamSize + ' members total. Other members join using your Team ID from the Events page.';
    body.appendChild(info);

    var sbtn = document.createElement('button'); sbtn.className = 'auth-submit';
    sbtn.textContent = '🚀 Create Team';
    var _eid = eventId, _ts = teamSize;
    sbtn.onclick = function(){ submitTeamReg(_eid, _ts); };
    body.appendChild(sbtn);
  } else {
    var row = document.createElement('div'); row.className = 'form-row';
    var sg  = document.createElement('div'); sg.className  = 'input-group';
    sg.innerHTML = '<label>Your Name</label><input id="erm-solo-name" placeholder="Priya Sharma" />';
    var ig  = document.createElement('div'); ig.className  = 'input-group';
    ig.innerHTML = '<label>Student ID</label><input id="erm-solo-id" placeholder="CS2024001" />';
    row.appendChild(sg); row.appendChild(ig); body.appendChild(row);
    if (currentUser) {
      var sn = el('erm-solo-name');  if (sn)  sn.value  = currentUser.name;
      var sid = el('erm-solo-id');   if (sid && currentUser.studentCode) sid.value = currentUser.studentCode;
    }
    var sbtn2 = document.createElement('button'); sbtn2.className = 'auth-submit'; sbtn2.style.marginTop = '8px';
    sbtn2.textContent = 'Register';
    var _eid2 = eventId;
    sbtn2.onclick = function(){ submitSoloReg(_eid2); };
    body.appendChild(sbtn2);
  }
  openModal('event-reg-modal');
}
function closeEventRegModal(e) { if (!e || e.target === el('event-reg-modal')) closeModal('event-reg-modal'); }

function submitSoloReg(eventId) {
  var name  = val('erm-solo-name');
  var sid   = val('erm-solo-id');
  if (!name) { showToast('Please enter your name'); return; }
  if (!authToken) {
    showToast('Please sign in before registering for events');
    closeModal('event-reg-modal');
    openAuthModal('login');
    return;
  }

  api('POST', '/events/' + eventId + '/register_solo', {}).then(function(r) {
    if (r === null) return; // error already shown (already registered / event full)
    eventRegs[eventId] = {};
    if (currentUser) userEventLog[eventId] = { type:'solo', name: name };
    var evt = clubEvents.find(function(e){ return e.id===eventId; });
    if (evt) evt.registrations.push({ name:name, id:sid, registeredAt: new Date().toLocaleDateString('en-IN') });
    closeModal('event-reg-modal');
    showToast('Registered successfully! ✓');
    renderEvents();
    renderUserDashboard();
  });
}

function submitTeamReg(eventId, teamSize) {
  var teamName   = val('erm-teamname')    || 'My Team';
  var leaderName = val('erm-leader-name') || (currentUser ? currentUser.name : '');
  var leaderId   = val('erm-leader-id');
  if (!teamName)   { showToast('Please enter a team name'); return; }
  if (!leaderName) { showToast('Please enter your name');   return; }
  if (!authToken) {
    showToast('Please sign in before creating a team');
    closeModal('event-reg-modal');
    openAuthModal('login');
    return;
  }

  // Disable button to prevent double-submit
  var sbtn = document.querySelector('#event-reg-modal .auth-submit');
  if (sbtn) { sbtn.disabled = true; sbtn.textContent = 'Creating…'; }

  api('POST', '/events/' + eventId + '/register_team', { team_name: teamName }).then(function(r) {
    if (r === null) {
      if (sbtn) { sbtn.disabled = false; sbtn.textContent = '🚀 Create Team'; }
      return;
    }
    var tid    = r.team_code || ('TEAM-' + Math.random().toString(36).substr(2,4).toUpperCase());
    var teamId = r.team_id   || null;
    teamRegistry[tid] = { eventId: eventId, teamName: teamName, members: [{ name: leaderName, id: leaderId, role:'leader' }], maxSize: teamSize, teamId: teamId };
    eventRegs[eventId] = { teamId: tid };
    if (currentUser) userEventLog[eventId] = { type:'team', teamId: tid, teamName: teamName, role:'leader', dbTeamId: teamId, confirmed: false };
    var evt = clubEvents.find(function(e){ return e.id===eventId; });
    if (evt) evt.registrations.push({ teamId:tid, dbTeamId:teamId, teamName:teamName, members:[{name:leaderName,id:leaderId,role:'leader'}], maxSize:teamSize, registeredAt:new Date().toLocaleDateString('en-IN') });
    closeModal('event-reg-modal');
    renderEvents();
    renderUserDashboard();
    // Open team leader panel so user can see & share the Team ID immediately
    el('vrm-title').innerHTML = '<span style="color:#34D399;">Team Created! 🎉</span>';
    openModal('view-regs-modal');
    api('GET', '/teams/by_code?code=' + tid).then(function(teamData) {
      var members = (teamData && teamData.members) ? teamData.members : [{ name: leaderName, student_code: leaderId, role: 'leader' }];
      renderTeamLeaderPanel(tid, teamName, teamSize, teamId, members);
    });
  });
}

// Show preview: leader confirms before team is actually registered in DB
function showTeamConfirmPreview(eventId, teamSize, teamName, leaderName, leaderId) {
  closeModal('event-reg-modal');
  el('vrm-title').innerHTML = 'Confirm Team Registration';
  var body = el('vrm-body');

  body.innerHTML =
    '<div style="background:var(--card);border:0.5px solid var(--border);border-radius:12px;overflow:hidden;margin-bottom:16px;">' +
      '<div style="padding:14px 16px;border-bottom:0.5px solid var(--border);">' +
        '<div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:0.6px;margin-bottom:4px;">Team Name</div>' +
        '<div style="font-size:16px;font-weight:700;">' + teamName + '</div>' +
      '</div>' +
      '<div style="padding:14px 16px;border-bottom:0.5px solid var(--border);">' +
        '<div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:0.6px;margin-bottom:4px;">Event</div>' +
        '<div style="font-size:14px;font-weight:500;">' + (events.find(function(e){ return e.id===eventId; })||{name:'—'}).name + '</div>' +
      '</div>' +
      '<div style="padding:14px 16px;">' +
        '<div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:0.6px;margin-bottom:8px;">Leader (You)</div>' +
        '<div style="display:flex;align-items:center;gap:10px;">' +
          '<div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,var(--accent),var(--accent2));display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:#050810;">' + (leaderName||'?').charAt(0).toUpperCase() + '</div>' +
          '<div>' +
            '<div style="font-size:13px;font-weight:500;">' + leaderName + '</div>' +
            (leaderId ? '<div style="font-size:11px;color:var(--muted);">' + leaderId + '</div>' : '') +
          '</div>' +
          '<span style="margin-left:auto;font-size:11px;background:rgba(252,211,77,0.1);color:var(--accent3);padding:2px 8px;border-radius:5px;">Leader 👑</span>' +
        '</div>' +
      '</div>' +
    '</div>' +

    '<div style="background:rgba(110,231,255,0.06);border:0.5px solid rgba(110,231,255,0.15);border-radius:10px;padding:12px 14px;margin-bottom:16px;font-size:12px;color:var(--muted);line-height:1.6;">' +
      '👥 Team size: <strong style="color:var(--text);">' + teamSize + ' members</strong>. After confirming you will receive a <strong style="color:var(--accent);">Team ID</strong> to share with your ' + (teamSize - 1) + ' teammate' + (teamSize > 2 ? 's' : '') + '.' +
    '</div>' +

    '<div style="display:flex;gap:10px;">' +
      '<button id="team-preview-back" style="flex:1;padding:13px;border-radius:10px;border:0.5px solid var(--border);background:rgba(255,255,255,0.04);color:var(--muted);cursor:pointer;font-family:var(--font-body);font-size:14px;font-weight:500;">← Back</button>' +
      '<button id="team-preview-confirm" style="flex:2;padding:13px;border-radius:10px;border:none;background:linear-gradient(135deg,#34D399,#059669);color:#050810;cursor:pointer;font-family:var(--font-body);font-size:14px;font-weight:700;">✓ Confirm & Register Team</button>' +
    '</div>';

  // Wire buttons
  document.getElementById('team-preview-back').onclick = function(e) {
    e.stopPropagation();
    closeModal('view-regs-modal');
    openEventReg(eventId);
  };

  document.getElementById('team-preview-confirm').onclick = function(e) {
    e.stopPropagation();  // prevent bubbling to modal backdrop
    var btn = this;
    btn.textContent = 'Registering…';
    btn.style.opacity = '0.7';
    btn.disabled = true;

    api('POST', '/events/' + eventId + '/register_team', { team_name: teamName }).then(function(r) {
      if (r === null) {
        // api() already showed the error toast
        // Also check common issues
        if (!authToken) {
          showToast('Session expired — please sign in again');
          closeModal('view-regs-modal');
          openAuthModal('login');
        }
        btn.textContent = '✓ Confirm & Register Team';
        btn.style.opacity = '1';
        btn.disabled = false;
        return;
      }
      var tid    = r.team_code || ('TEAM-' + Math.random().toString(36).substr(2,4).toUpperCase());
      var teamId = r.team_id   || null;
      teamRegistry[tid] = { eventId: eventId, teamName: teamName, members: [{ name: leaderName, id: leaderId, role:'leader' }], maxSize: teamSize, teamId: teamId };
      eventRegs[eventId] = { teamId: tid };
      if (currentUser) userEventLog[eventId] = { type:'team', teamId: tid, teamName: teamName, role:'leader', dbTeamId: teamId };
      var evt = clubEvents.find(function(e){ return e.id===eventId; });
      if (evt) evt.registrations.push({ teamId:tid, dbTeamId:teamId, teamName:teamName, members:[{name:leaderName,id:leaderId,role:'leader'}], maxSize:teamSize, registeredAt:new Date().toLocaleDateString('en-IN') });
      // Show team panel with Team ID
      el('vrm-title').innerHTML = '<span style="color:#34D399;">Team Registered! 🎉</span>';
      api('GET', '/teams/by_code?code=' + tid).then(function(teamData) {
        var members = (teamData && teamData.members) ? teamData.members : [{ name: leaderName, student_code: leaderId, role: 'leader' }];
        renderTeamLeaderPanel(tid, teamName, teamSize, teamId, members);
      });
      renderEvents();
      renderUserDashboard();
    });
  };

  openModal('view-regs-modal');
}


// ── Team ID ──
// Active team panel — polls DB for live member updates
var _teamPollTimer = null;

function showTeamCreated(tid, teamName, maxSize, teamId) {
  el('vrm-title').innerHTML = '<span style="color:#34D399;">Team Created! 🎉</span>';
  openModal('view-regs-modal');
  // Load current members from DB immediately, then show panel
  api('GET', '/teams/by_code?code=' + tid).then(function(r) {
    var members = (r && r.members) ? r.members : [];
    var dbTeamId = (r && r.team) ? r.team.team_id : teamId;
    renderTeamLeaderPanel(tid, teamName, maxSize, dbTeamId, members);
  });
}

function renderTeamLeaderPanel(tid, teamName, maxSize, teamId, members) {
  var body = el('vrm-body');
  var filled = members.length;
  var remaining = maxSize - filled;

  body.innerHTML =
    '<div style="text-align:center;padding:8px 0 20px;">' +
      '<p style="font-size:13px;color:var(--muted);margin-bottom:12px;">Share this Team ID with teammates — they join from Events page &rarr; Join by Team ID</p>' +
      '<div id="team-copy-badge" data-tid="' + tid + '" style="font-family:monospace;font-size:30px;font-weight:800;letter-spacing:4px;color:var(--accent2);background:rgba(167,139,250,0.1);border:0.5px solid rgba(167,139,250,0.25);border-radius:14px;padding:18px 28px;display:inline-block;cursor:pointer;" title="Click to copy">' + tid + '</div>' +
      '<p style="font-size:11px;color:var(--muted);margin-top:8px;">Click to copy 📋</p>' +
    '</div>' +

    '<div style="background:var(--card);border:0.5px solid var(--border);border-radius:12px;overflow:hidden;margin-bottom:16px;">' +
      '<div style="padding:12px 16px;border-bottom:0.5px solid var(--border);display:flex;justify-content:space-between;align-items:center;">' +
        '<div style="font-size:13px;font-weight:600;">' + teamName + '</div>' +
        '<div style="font-size:12px;color:var(--muted);">' + filled + ' / ' + maxSize + ' members' + (remaining > 0 ? ' &middot; ' + remaining + ' spot' + (remaining===1?'':'s') + ' open' : ' &middot; <span style=&quot;color:#34D399;&quot;>Full ✓</span>') + '</div>' +
      '</div>' +
      '<div style="padding:4px 0;">' +
        (members.length ?
          members.map(function(m, i) {
            return '<div style="display:flex;align-items:center;gap:12px;padding:10px 16px;border-bottom:0.5px solid rgba(255,255,255,0.04);">' +
              '<div style="width:28px;height:28px;border-radius:50%;background:' + (i===0?'linear-gradient(135deg,var(--accent),var(--accent2))':'rgba(255,255,255,0.08)') + ';display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:' + (i===0?'#050810':'var(--text)') + ';">' + (m.name||'?').charAt(0).toUpperCase() + '</div>' +
              '<div style="flex:1;">' +
                '<div style="font-size:13px;font-weight:500;">' + (m.name||'—') + (i===0?' <span style="font-size:10px;color:var(--accent3);background:rgba(252,211,77,0.1);padding:1px 6px;border-radius:4px;margin-left:4px;">Leader 👑</span>':'') + '</div>' +
                '<div style="font-size:11px;color:var(--muted);">' + (m.student_code||m.email||'—') + '</div>' +
              '</div>' +
              (i!==0 ? '<span style="font-size:14px;color:#34D399;">✓</span>' : '') +
            '</div>';
          }).join('')
        : '<div style="padding:20px;text-align:center;font-size:13px;color:var(--muted);">No teammates yet — share the Team ID above</div>'
        ) +
      '</div>' +
    '</div>' +

    '<p style="font-size:12px;color:var(--muted);text-align:center;margin-top:4px;">Use the <strong style="color:var(--accent);">Confirm</strong> button in your Dashboard once all members have joined.</p>';

  // Wire up buttons
  var badge = document.getElementById('team-copy-badge');
  if (badge) badge.onclick = function() { copyTid(this.dataset.tid); };
}

// Confirm team from dashboard — sends team details to admin
function confirmTeamFromDash(tid, dbTeamId) {
  if (!authToken) { showToast('Please sign in'); return; }

  // Fetch latest member data, then post confirm
  api('GET', '/teams/by_code?code=' + tid).then(function(r) {
    if (!r || !r.team) { showToast('Team not found'); return; }
    var cur  = r.members ? r.members.length : 0;
    var max  = r.team.max_size;
    var eid  = r.team.event_id;

    // Update local size
    if (userEventLog[eid]) {
      userEventLog[eid].currentSize = cur;
      userEventLog[eid].maxSize     = max;
    }

    api('POST', '/teams/confirm', { team_code: tid }).then(function(res) {
      if (res === null) return;
      // Mark confirmed locally
      if (userEventLog[eid]) userEventLog[eid].confirmed = true;
      showToast('Team confirmed! ✓');
      renderUserDashboard();
    });
  });
}

function copyTid(tid) {
  if (navigator.clipboard) { navigator.clipboard.writeText(tid).then(function(){ showToast('Copied: ' + tid + ' 📋'); }); }
  else { showToast('Team ID: ' + tid); }
}

// ── Join Team Modal ──
function openJoinTeamModal() {
  if (!authToken) {
    showToast('Please sign in to join a team');
    openAuthModal('login');
    return;
  }
  ['jt-teamid','jt-name','jt-sid'].forEach(function(id){ var e=el(id); if(e) e.value=''; });
  openModal('join-team-modal');
}
function closeJoinTeamModal(e) { if (!e || e.target === el('join-team-modal')) closeModal('join-team-modal'); }

function submitJoinTeam() {
  var tid  = val('jt-teamid').toUpperCase();
  var name = val('jt-name');
  var sid  = val('jt-sid');
  if (!tid)  { showToast('Please enter a Team ID'); return; }
  if (!name) { showToast('Please enter your name'); return; }

  if (!authToken) {
    showToast('Please sign in before joining a team');
    closeModal('join-team-modal');
    openAuthModal('login');
    return;
  }

  api('POST', '/teams/join', { team_code: tid }).then(function(r) {
    if (!r || !r.team) return; // error already shown by api()
    var t = r.team;
    if (!teamRegistry[tid]) teamRegistry[tid] = { eventId: t.event_id, teamName: t.team_name, members: [], maxSize: t.max_size };
    var team = teamRegistry[tid];
    team.members.push({ name: name, id: sid });
    eventRegs[t.event_id] = { teamId: tid };
    if (currentUser) userEventLog[t.event_id] = { type:'team', teamId:tid, teamName:t.team_name, role:'member' };
    closeModal('join-team-modal');
    showToast('Joined team "' + t.team_name + '" (' + t.current_size + '/' + t.max_size + ') ✓');
    renderEvents();
    renderUserDashboard();
  });
}

// ══════════════════════════════════════
// USER DASHBOARD
// ══════════════════════════════════════
function renderUserDashboard() {
  var prompt  = el('udash-login-prompt');
  var content = el('udash-content');
  if (!prompt || !content) return;
  if (!currentUser) { prompt.style.display='flex'; content.style.display='none'; return; }
  prompt.style.display = 'none'; content.style.display = 'block';

  el('ud-avatar').textContent = currentUser.initial;
  el('ud-name').textContent   = currentUser.name;
  el('ud-email').textContent  = currentUser.email;

  var myApps  = applications.filter(function(a){ return a.email === currentUser.email; });
  var evtKeys = Object.keys(userEventLog);
  var myTeams = evtKeys.filter(function(k){ return userEventLog[k].type === 'team'; });
  el('ud-clubs-count').textContent  = myApps.filter(function(a){ return a.status==='accepted'; }).length;
  el('ud-events-count').textContent = evtKeys.length;
  el('ud-teams-count').textContent  = myTeams.length;

  var cg = el('ud-clubs-grid');
  if (!myApps.length) {
    cg.innerHTML = '<div class="ud-empty" style="grid-column:1/-1;"><div class="ud-empty-icon">🏫</div>No club applications yet. <a href="#" onclick="showSection(\'clubs\',null);return false;" style="color:var(--accent);text-decoration:none;">Browse clubs →</a></div>';
  } else {
    cg.innerHTML = myApps.map(function(a) {
      var cl = clubs.find(function(c){ return c.name===a.club; });
      var sc = a.status==='accepted'?'#34D399':a.status==='rejected'?'#F472B6':'var(--accent3)';
      var sl = a.status==='accepted'?'✓ Member':a.status==='rejected'?'✗ Not accepted':'⏳ Pending review';
      return '<div class="ud-club-card">' +
        '<div class="ud-club-icon ' + (cl?cl.color:'cyan') + '">' + (cl?cl.icon:'🏛️') + '</div>' +
        '<div><div class="ud-club-name">' + a.club + '</div><div class="ud-club-status" style="color:' + sc + ';font-size:12px;">' + sl + '</div></div></div>';
    }).join('');
  }

  var evl = el('ud-events-list');
  if (!evtKeys.length) {
    evl.innerHTML = '<div class="ud-empty"><div class="ud-empty-icon">📅</div>No events yet. <a href="#" onclick="showSection(\'events\',null);return false;" style="color:var(--accent);text-decoration:none;">Browse events →</a></div>';
    return;
  }

  // Sort by registration date — most recently registered first
  evtKeys.sort(function(a, b) {
    var ra = userEventLog[a].registeredAt || '';
    var rb = userEventLog[b].registeredAt || '';
    if (rb > ra) return 1;
    if (rb < ra) return -1;
    return parseInt(b) - parseInt(a); // fallback: higher id = newer
  });

  evl.innerHTML = evtKeys.map(function(eid) {
    var reg = userEventLog[eid];
    var evt = clubEvents.find(function(e){ return e.id===parseInt(eid); }) || events.find(function(e){ return e.id===parseInt(eid); });
    // Fallback to stored details in userEventLog for past/closed events
    var isClub, name, club, day, mon, venue, time;
    if (evt) {
      isClub = !!evt.title;
      name   = isClub ? evt.title    : evt.name;
      club   = isClub ? evt.clubName : evt.club;
      var d  = isClub && evt.date ? new Date(evt.date+'T00:00:00') : null;
      day    = d ? d.getDate() : (evt.day||'?');
      mon    = d ? d.toLocaleString('en',{month:'short'}) : (evt.month||'?');
      venue  = isClub ? (evt.venue||'') : (evt.location||'');
      time   = evt.time||'';
    } else if (reg.eventName) {
      // Event was filtered out (past/closed) but we stored details in userEventLog
      isClub = false;
      name   = reg.eventName;
      club   = reg.clubName || '—';
      var pd = reg.eventDate ? new Date(reg.eventDate + 'T00:00:00') : null;
      day    = pd ? pd.getDate()                              : '?';
      mon    = pd ? pd.toLocaleString('en',{month:'short'})  : '?';
      venue  = reg.eventVenue || '';
      time   = reg.eventTime  ? reg.eventTime.substr(0,5) : '';
    } else {
      return ''; // no data at all, skip
    }

    // Determine if event is done (closed status or date already passed)
    var eventIsDone = false;
    if (reg.eventStatus === 'closed') {
      eventIsDone = true;
    } else if (reg.eventDate) {
      var evtDate = new Date(reg.eventDate + 'T00:00:00');
      var today   = new Date(); today.setHours(0,0,0,0);
      if (evtDate < today) eventIsDone = true;
    } else if (evt && (evt.date || evt.status)) {
      if (evt.status === 'closed') eventIsDone = true;
      else if (evt.date) {
        var evtDate2 = new Date(evt.date + 'T00:00:00');
        var today2   = new Date(); today2.setHours(0,0,0,0);
        if (evtDate2 < today2) eventIsDone = true;
      }
    }

    var isTeam   = reg.type === 'team';
    var isLeader = reg.role === 'leader';
    var curSize  = (reg.currentSize != null ? reg.currentSize : (teamRegistry[reg.teamId] ? teamRegistry[reg.teamId].members.length : 0));
    var maxSize  = (reg.maxSize     != null ? reg.maxSize     : (teamRegistry[reg.teamId] ? teamRegistry[reg.teamId].maxSize : 0));
    var isFull   = maxSize > 0 && curSize >= maxSize;
    var tagCls   = isTeam ? 'team' : 'solo';
    var tagLbl   = isTeam ? (reg.teamName || 'Team') : 'Solo';

    // Team status badge (incomplete / full)
    var teamStatus = '';
    if (isTeam && maxSize > 0) {
      teamStatus = isFull
        ? '<div style="font-size:11px;color:#34D399;margin-top:4px;">✓ Full (' + curSize + '/' + maxSize + ')</div>'
        : '<div style="font-size:11px;color:var(--accent3);margin-top:4px;">⏳ ' + curSize + '/' + maxSize + ' members</div>';
    }

    // Team ID badge
    var tidBadge = reg.teamId
      ? '<div style="margin-top:8px;display:flex;align-items:center;gap:8px;">' +
          '<span class="team-id-badge" data-copy="' + reg.teamId + '" style="cursor:pointer;">🆔 ' + reg.teamId + (isLeader ? ' 👑' : '') + '</span>' +
          teamStatus +
        '</div>'
      : '';

    // View team button
    var viewTeamBtn = reg.teamId
      ? '<button class="view-team-btn" data-tid="' + reg.teamId + '" style="background:rgba(110,231,255,0.08);border:0.5px solid rgba(110,231,255,0.2);color:var(--accent);padding:4px 10px;border-radius:7px;cursor:pointer;font-size:11px;font-family:var(--font-body);white-space:nowrap;">👥 My Team</button>'
      : '';

    // Confirm button — only for leader, only when team is full
    var isConfirmed = reg.confirmed === true;
    var confirmBtn = (isTeam && isLeader && isConfirmed)
      ? '<span style="background:rgba(52,211,153,0.12);border:0.5px solid rgba(52,211,153,0.3);color:#34D399;padding:5px 12px;border-radius:7px;font-size:11px;font-family:var(--font-body);font-weight:600;white-space:nowrap;">✓ Team Confirmed</span>'
      : (isTeam && isLeader && isFull && !isConfirmed)
        ? '<button class="confirm-team-btn" data-tid="' + reg.teamId + '" data-teamid="' + (reg.dbTeamId||'') + '" style="background:linear-gradient(135deg,#34D399,#059669);border:none;color:#050810;padding:5px 12px;border-radius:7px;cursor:pointer;font-size:11px;font-family:var(--font-body);font-weight:700;white-space:nowrap;">✓ Confirm</button>'
        : (isTeam && isLeader && !isFull && !isConfirmed)
          ? '<button disabled style="background:rgba(255,255,255,0.05);border:0.5px dashed rgba(255,255,255,0.15);color:var(--muted);padding:5px 12px;border-radius:7px;font-size:11px;font-family:var(--font-body);cursor:not-allowed;white-space:nowrap;">⏳ ' + curSize + '/' + maxSize + ' joined</button>'
          : '';

    // Cancel button — hidden for events that are already done/closed
    var cancelBtn = eventIsDone
      ? '<span style="font-size:10px;color:var(--muted);padding:4px 8px;border-radius:7px;background:rgba(255,255,255,0.04);white-space:nowrap;">✓ Done</span>'
      : '<button class="del-reg-btn" data-eid="' + eid + '" style="background:rgba(244,114,182,0.08);border:0.5px solid rgba(244,114,182,0.2);color:#F472B6;padding:4px 10px;border-radius:7px;cursor:pointer;font-size:11px;font-family:var(--font-body);white-space:nowrap;">✕ Cancel</button>';

    return '<div class="ud-event-row" style="position:relative;">' +
      '<div class="ud-event-date"><div class="ud-event-day">' + day + '</div><div class="ud-event-mon">' + mon + '</div></div>' +
      '<div style="flex:1;">' +
        '<div class="ud-event-name">' + name + '</div>' +
        '<div class="ud-event-meta">' +
          '<span>🏷️ ' + club + '</span>' +
          (venue ? '<span>📍 ' + venue.split(',')[0] + '</span>' : '') +
          (time  ? '<span>🕐 ' + time + '</span>'                 : '') +
        '</div>' + tidBadge +
      '</div>' +
      '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;">' +
        '<span class="ud-event-tag ' + tagCls + '">' + tagLbl + '</span>' +
        confirmBtn +
        viewTeamBtn +
        cancelBtn +
      '</div>' +
    '</div>';
  }).join('');

  // Wire up buttons
  setTimeout(function() {
    el('ud-events-list').querySelectorAll('.del-reg-btn').forEach(function(btn) {
      btn.onclick = function() { deleteRegistration(parseInt(this.dataset.eid)); };
    });
    el('ud-events-list').querySelectorAll('.view-team-btn').forEach(function(btn) {
      btn.onclick = function() { viewMyTeam(this.dataset.tid); };
    });
    el('ud-events-list').querySelectorAll('.confirm-team-btn').forEach(function(btn) {
      btn.onclick = function() { confirmTeamFromDash(this.dataset.tid, this.dataset.teamid); };
    });
    el('ud-events-list').querySelectorAll('[data-copy]').forEach(function(span) {
      span.onclick = function() { copyTid(this.dataset.copy); };
    });
  }, 50);
}

// Delete a student's own event registration
function deleteRegistration(eventId) {
  if (!authToken) { showToast('Please sign in'); return; }
  if (!confirm('Cancel your registration for this event?')) return;
  api('DELETE', '/events/' + eventId + '/registration', null).then(function(r) {
    if (r === null) return;
    // Remove from local state
    delete eventRegs[eventId];
    delete userEventLog[eventId];
    showToast('Registration cancelled ✓');
    renderEvents();
    renderUserDashboard();
  });
}

// Student views their own team members
function viewMyTeam(teamCode) {
  if (!authToken) { showToast('Please sign in'); return; }
  // Open view-regs-modal as a team viewer
  el('vrm-title').innerHTML = '👥 My Team';
  var body = el('vrm-body');
  body.innerHTML = '<div style="text-align:center;padding:20px;color:var(--muted);font-size:13px;">Loading team…</div>';
  openModal('view-regs-modal');

  api('GET', '/teams/by_code?code=' + teamCode).then(function(r) {
    if (!r || !r.team) {
      body.innerHTML = '<div class="empty-state"><div>👥</div>Team not found.</div>';
      return;
    }
    var team    = r.team;
    var members = r.members || [];
    var filled  = members.length;
    var max     = team.max_size;

    el('vrm-title').innerHTML = '👥 ' + team.team_name;

    body.innerHTML =
      // Team ID + copy
      '<div style="text-align:center;padding:8px 0 18px;">' +
        '<p style="font-size:12px;color:var(--muted);margin-bottom:10px;">Team ID — share with teammates who have not joined yet</p>' +
        '<div id="my-team-copy" data-tid="' + team.team_code + '" style="font-family:monospace;font-size:22px;font-weight:800;letter-spacing:3px;color:var(--accent2);background:rgba(167,139,250,0.1);border:0.5px solid rgba(167,139,250,0.25);border-radius:12px;padding:12px 24px;display:inline-block;cursor:pointer;" title="Click to copy">' + team.team_code + '</div>' +
        '<p style="font-size:11px;color:var(--muted);margin-top:6px;">Click to copy 📋</p>' +
      '</div>' +

      // Members
      '<div style="background:var(--card);border:0.5px solid var(--border);border-radius:12px;overflow:hidden;">' +
        '<div style="padding:12px 16px;border-bottom:0.5px solid var(--border);display:flex;justify-content:space-between;">' +
          '<div style="font-size:13px;font-weight:600;">Members</div>' +
          '<div style="font-size:12px;color:var(--muted);">' + filled + ' / ' + max + '</div>' +
        '</div>' +
        members.map(function(m, i) {
          var isLeader = m.role === 'leader' || i === 0;
          var isMe     = currentUser && (m.student_id === currentUser.id || m.email === currentUser.email);
          return '<div style="display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:0.5px solid rgba(255,255,255,0.04);">' +
            '<div style="width:34px;height:34px;border-radius:50%;background:' + (isLeader ? 'linear-gradient(135deg,var(--accent),var(--accent2))' : (isMe ? 'rgba(167,139,250,0.2)' : 'rgba(255,255,255,0.07)')) + ';display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:' + (isLeader ? '#050810' : 'var(--text)') + ';flex-shrink:0;">' + (m.name||'?').charAt(0).toUpperCase() + '</div>' +
            '<div style="flex:1;">' +
              '<div style="font-size:13px;font-weight:500;">' + (m.name||'—') +
                (isMe    ? ' <span style="font-size:10px;background:rgba(167,139,250,0.15);color:var(--accent2);padding:1px 6px;border-radius:4px;margin-left:4px;">You</span>' : '') +
                (isLeader? ' <span style="font-size:10px;background:rgba(252,211,77,0.12);color:var(--accent3);padding:1px 6px;border-radius:4px;margin-left:4px;">Leader 👑</span>' : '') +
              '</div>' +
              '<div style="font-size:11px;color:var(--muted);">' + (m.student_code || m.email || '—') + (m.department ? ' · ' + m.department : '') + '</div>' +
            '</div>' +
            (isLeader ? '' : '<span style="font-size:14px;color:#34D399;">✓</span>') +
          '</div>';
        }).join('') +
        // Empty slots
        (filled < max ? Array(max - filled).fill(0).map(function(_, i) {
          return '<div style="display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:0.5px solid rgba(255,255,255,0.04);opacity:0.4;">' +
            '<div style="width:34px;height:34px;border-radius:50%;border:1.5px dashed rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;">+</div>' +
            '<div style="font-size:13px;color:var(--muted);">Waiting for member ' + (filled + i + 1) + '…</div>' +
          '</div>';
        }).join('') : '') +
      '</div>';

    // Wire copy button
    var copyBadge = document.getElementById('my-team-copy');
    if (copyBadge) copyBadge.onclick = function() { copyTid(this.dataset.tid); };
  });
}

// Admin removes a student's registration
function adminDeleteReg(eventId, studentId) {
  if (!authToken || !currentAdmin) { showToast('Admin access required'); return; }
  api('DELETE', '/events/' + eventId + '/admin_reg/' + studentId, null).then(function(r) {
    if (r === null) return;
    showToast('Registration removed ✓');
    viewEventRegs(eventId); // refresh
  });
}

// Load dashboard data from DB
function loadDashboardData() {
  if (!authToken || !currentUser) return;
  api('GET', '/students').then(function(data) {
    if (!data) return;
    // Update currentUser with full profile from DB
    if (data.student) {
      var s = data.student;
      currentUser.name        = s.name        || currentUser.name;
      currentUser.initial     = (s.name || currentUser.name).charAt(0).toUpperCase();
      currentUser.department  = s.department  || '';
      currentUser.studentCode = s.student_code|| '';
      currentUser.year        = s.year        || '';
    }
    (data.clubs||[]).forEach(function(m) {
      var ex = applications.find(function(a){ return a.email===currentUser.email && a.club===m.club_name; });
      if (!ex) {
        applications.push({
          id: m.membership_id, club: m.club_name, clubIcon: m.icon||'🏛️', clubColor: m.color||'cyan',
          name: currentUser.name, email: currentUser.email,
          studentId: currentUser.studentCode || '',
          year: currentUser.year || '', dept: currentUser.department || '',
          why: m.why_join || '', skills: m.skills || '',
          status: m.status,
          date: m.applied_at ? new Date(m.applied_at).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) : ''
        });
      } else {
        ex.status    = m.status;
        ex.studentId = ex.studentId || currentUser.studentCode || '';
      }
    });
    (data.events||[]).forEach(function(ev) {
      eventRegs[ev.event_id]    = ev.team_code ? { teamId: ev.team_code } : {};
      userEventLog[ev.event_id] = {
        type:         ev.role==='solo' ? 'solo' : 'team',
        teamId:       ev.team_code,
        teamName:     ev.team_name,
        role:         ev.role,
        currentSize:  ev.current_size || 0,
        maxSize:      ev.max_size     || 0,
        dbTeamId:     ev.team_id      || null,
        confirmed:    ev.confirmed    == 1,
        // Store event details directly so past/closed events still show in dashboard
        eventName:    ev.event_name,
        eventDate:    ev.event_date,
        eventTime:    ev.event_time,
        eventVenue:   ev.venue,
        clubName:     ev.club_name,
        clubIcon:     ev.icon,
        eventStatus:  ev.status,
        registeredAt: ev.registration_date
      };
    });
    renderUserDashboard(); renderClubsFiltered();
  });
}

// ══════════════════════════════════════
// ADMIN PANEL
// ══════════════════════════════════════
function renderAdminPanel() {
  var prompt = el('admin-login-prompt'), dash = el('admin-dashboard');
  if (!prompt||!dash) return;
  if (!currentAdmin) { prompt.style.display='flex'; dash.style.display='none'; return; }
  prompt.style.display='none'; dash.style.display='block';

  var bgMap = {cyan:'rgba(110,231,255,0.12)',purple:'rgba(167,139,250,0.12)',green:'rgba(52,211,153,0.12)',amber:'rgba(252,211,77,0.12)',pink:'rgba(244,114,182,0.12)'};
  el('admin-club-icon-big').textContent = currentAdmin.icon;
  el('admin-club-icon-big').style.background = bgMap[currentAdmin.color]||bgMap.cyan;
  el('admin-club-title').textContent = currentAdmin.name;

  var ca = applications.filter(function(a){ return a.club===currentAdmin.name; });
  var fi = adminFilter==='all' ? ca : ca.filter(function(a){ return a.status===adminFilter; });
  el('stat-total').textContent    = ca.length;
  el('stat-pending').textContent  = ca.filter(function(a){ return a.status==='pending'; }).length;
  el('stat-accepted').textContent = ca.filter(function(a){ return a.status==='accepted'; }).length;
  el('stat-rejected').textContent = ca.filter(function(a){ return a.status==='rejected'; }).length;

  var list = el('admin-app-list');
  if (!fi.length) {
    list.innerHTML = '<div class="empty-state"><div>📋</div>' + (adminFilter==='all'?'No applications yet.':'No '+adminFilter+' applications.') + '</div>';
  } else {
    list.innerHTML = fi.map(function(a) {
      return '<div class="app-row">' +
        '<div><div class="app-name">' + a.name + '</div><div style="font-size:12px;color:var(--muted);margin-top:2px;">' + a.email + '</div></div>' +
        '<div><div style="font-size:13px;font-weight:500;">' + (a.year||'—') + ' · ' + (a.dept||'—') + '</div><div style="font-size:12px;color:var(--muted);margin-top:2px;">' + a.studentId + '</div></div>' +
        '<div class="app-date">' + a.date + '</div>' +
        '<div><span class="status-chip ' + a.status + '">' + a.status + '</span></div>' +
        '<div class="app-actions">' +
          '<button class="app-btn view-app" onclick="viewApplication(' + a.id + ')">View</button>' +
          (a.status==='pending'
            ? '<button class="app-btn accept" onclick="setAppStatus(' + a.id + ',\'accepted\')">Accept</button><button class="app-btn reject" onclick="setAppStatus(' + a.id + ',\'rejected\')">Reject</button>'
            : '<button class="app-btn view-app" style="opacity:0.5;" onclick="setAppStatus(' + a.id + ',\'pending\')">Reset</button>') +
        '</div>' +
      '</div>';
    }).join('');
  }
  renderAdminEvents();
  renderAttendanceEventList();
}

function filterApps(filter, btn) {
  adminFilter = filter;
  document.querySelectorAll('.admin-tab').forEach(function(b){ b.classList.remove('active'); });
  if (btn) btn.classList.add('active');
  renderAdminPanel();
}

function setAppStatus(id, status) {
  if (!currentAdmin || !authToken) { showToast('Please sign in as admin'); return; }
  var a = applications.find(function(x){ return x.id===id; });
  if (!a) return;
  api('PATCH', '/memberships/' + id, { status: status }).then(function(r) {
    if (r === null) return;
    a.status = status;
    renderAdminPanel(); renderClubsFiltered(); renderUserDashboard();
    showToast((status==='accepted'?'✅':status==='rejected'?'❌':'🔄') + ' ' + a.name + ' ' + status);
  });
}

function viewApplication(id) {
  var a = applications.find(function(x){ return x.id===id; });
  if (!a) return;
  el('view-app-content').innerHTML =
    '<div style="display:flex;align-items:center;gap:14px;margin-bottom:20px;padding-bottom:18px;border-bottom:0.5px solid var(--border);">' +
      '<div style="width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,var(--accent),var(--accent2));display:flex;align-items:center;justify-content:center;font-family:var(--font-head);font-weight:700;font-size:18px;color:#050810;">' + a.name.charAt(0) + '</div>' +
      '<div><div style="font-weight:600;font-size:16px;">' + a.name + '</div><div style="font-size:13px;color:var(--muted);">' + a.email + ' · ' + a.studentId + '</div></div>' +
      '<span class="status-chip ' + a.status + '" style="margin-left:auto;">' + a.status + '</span>' +
    '</div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:20px;">' +
      [['Club',(a.clubIcon||'')+' '+a.club],['Year',a.year||'—'],['Dept',a.dept||'—'],['Avail',a.availability||'—'],['Applied',a.date]].map(function(kv){
        return '<div style="background:rgba(255,255,255,0.03);border:0.5px solid var(--border);border-radius:10px;padding:12px 14px;">' +
          '<div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:0.6px;margin-bottom:5px;">' + kv[0] + '</div>' +
          '<div style="font-size:14px;font-weight:500;">' + kv[1] + '</div></div>';
      }).join('') +
    '</div>' +
    '<div style="margin-bottom:16px;"><div style="font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:0.6px;margin-bottom:8px;">Why they want to join</div>' +
      '<div style="background:rgba(255,255,255,0.03);border:0.5px solid var(--border);border-radius:10px;padding:14px;font-size:14px;line-height:1.7;">' + (a.why||'—') + '</div></div>' +
    (a.skills ? '<div style="margin-bottom:20px;"><div style="font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:0.6px;margin-bottom:8px;">Skills</div><div style="background:rgba(255,255,255,0.03);border:0.5px solid var(--border);border-radius:10px;padding:14px;font-size:14px;line-height:1.7;">' + a.skills + '</div></div>' : '') +
    (a.status==='pending' ? '<div style="display:flex;gap:12px;">' +
      '<button class="auth-submit" style="background:linear-gradient(135deg,#34D399,#059669);" onclick="setAppStatus(' + a.id + ',\'accepted\');closeViewModal()">Accept Member</button>' +
      '<button class="auth-submit" style="background:rgba(244,114,182,0.2);color:#F472B6;flex:0 0 auto;width:auto;padding:13px 24px;" onclick="setAppStatus(' + a.id + ',\'rejected\');closeViewModal()">Reject</button>' +
    '</div>' : '');
  openModal('view-app-modal');
}
function closeViewModal(e) { if (!e || e.target === el('view-app-modal')) closeModal('view-app-modal'); }

// ── Admin Dashboard Tabs ──
function switchDashTab(tab, btn) {
  document.querySelectorAll('.dash-tab').forEach(function(b){ b.classList.remove('active'); });
  document.querySelectorAll('.dash-panel').forEach(function(p){ p.classList.remove('active'); });
  if (btn) btn.classList.add('active');
  el('dash-' + tab).classList.add('active');
  if (tab==='events')     renderAdminEvents();
  if (tab==='attendance') renderAttendanceEventList();
}

// ── Admin Events CRUD ──
function getClubEvents(clubName) { return clubEvents.filter(function(e){ return e.clubName===clubName; }); }

function openCreateEventModal(evtId) {
  if (!currentAdmin || !authToken) { showToast('Please sign in as admin'); return; }
  editingEventId = evtId || null;
  el('cem-title').textContent      = evtId ? 'Edit Event'     : 'Create Event';
  el('cev-submit-btn').textContent = evtId ? 'Save Changes →' : 'Create Event →';
  if (evtId) {
    var ev = clubEvents.find(function(e){ return e.id===evtId; });
    if (!ev) return;
    el('cev-title').value    = ev.title;  el('cev-date').value  = ev.date;
    el('cev-time').value     = ev.time||''; el('cev-venue').value = ev.venue;
    el('cev-desc').value     = ev.desc||''; el('cev-type').value  = ev.type;
    el('cev-teamsize').value = ev.teamSize||'2'; el('cev-maxreg').value = ev.maxReg||'';
    el('cev-status').value   = ev.status;
    el('cev-teamsize-wrap').style.display = ev.type==='team'?'block':'none';
  } else {
    ['cev-title','cev-date','cev-time','cev-venue','cev-desc','cev-maxreg'].forEach(function(id){ el(id).value=''; });
    el('cev-type').value='solo'; el('cev-teamsize').value='2'; el('cev-status').value='open';
    el('cev-teamsize-wrap').style.display='none';
  }
  openModal('create-event-modal');
}
function closeCreateEventModal(e) { if (!e || e.target === el('create-event-modal')) closeModal('create-event-modal'); }

function submitCreateEvent() {
  var title=val('cev-title'), date=val('cev-date'), venue=val('cev-venue');
  if (!title||!date||!venue) { showToast('Please fill in title, date and venue'); return; }

  var evData = {
    event_name: title, description: val('cev-desc'), event_date: date,
    event_time: val('cev-time'), venue: venue, capacity: parseInt(val('cev-maxreg'))||100,
    team_size: parseInt(val('cev-teamsize'))||1, status: val('cev-status')
  };

  var doSave = function(newId) {
    if (editingEventId) {
      var ev = clubEvents.find(function(e){ return e.id===editingEventId; });
      if (ev) { ev.title=title; ev.date=date; ev.time=val('cev-time'); ev.venue=venue; ev.desc=val('cev-desc'); ev.type=val('cev-type'); ev.teamSize=parseInt(val('cev-teamsize'))||2; ev.maxReg=parseInt(val('cev-maxreg'))||50; ev.status=val('cev-status'); }
      showToast('Event updated!');
    } else {
      clubEvents.push({ id: newId||Date.now(), clubName: currentAdmin.name, title: title, date: date, time: val('cev-time'), venue: venue, desc: val('cev-desc'), type: val('cev-type'), teamSize: parseInt(val('cev-teamsize'))||2, maxReg: parseInt(val('cev-maxreg'))||50, status: val('cev-status'), registrations:[], attendance:{} });
      showToast('Event created: ' + title);
    }
    closeModal('create-event-modal');
    renderAdminEvents(); renderAttendanceEventList(); renderEvents();
  };

  if (!currentAdmin || !authToken) { showToast('Please sign in as admin'); return; }
  var method = editingEventId ? 'PUT' : 'POST';
  var path   = editingEventId ? '/events/' + editingEventId : '/events';
  api(method, path, evData).then(function(r) {
    if (r === null) return;
    doSave(r.event_id || null);
  });
}

function deleteEvent(evtId) {
  if (!currentAdmin || !authToken) { showToast('Please sign in as admin'); return; }
  api('DELETE', '/events/' + evtId, null).then(function(r) {
    if (r === null) return;
    clubEvents = clubEvents.filter(function(e){ return e.id!==evtId; });
    renderAdminEvents(); renderAttendanceEventList(); renderEvents();
    showToast('Event deleted');
  });
}

function renderAdminEvents() {
  var grid = el('admin-evt-grid');
  if (!grid||!currentAdmin) return;
  var bgMap = {cyan:'rgba(110,231,255,0.12)',purple:'rgba(167,139,250,0.12)',green:'rgba(52,211,153,0.12)',amber:'rgba(252,211,77,0.12)',pink:'rgba(244,114,182,0.12)'};
  var evts  = getClubEvents(currentAdmin.name);
  grid.innerHTML = evts.map(function(e) {
    var reg=e.registrations.length, max=e.maxReg||50, pct=Math.min(Math.round(reg/max*100),100);
    var sc=e.status==='open'?'#34D399':e.status==='upcoming'?'var(--accent3)':'var(--muted)';
    var ds=e.date?new Date(e.date+'T00:00:00').toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}):'TBD';
    return '<div class="evt-admin-card">' +
      '<div class="evt-card-head"><div class="evt-card-title">' + e.title + '</div>' +
        '<div class="evt-card-actions">' +
          '<button class="icon-btn" onclick="openCreateEventModal(' + e.id + ')" title="Edit">✏</button>' +
          '<button class="icon-btn" onclick="viewEventRegs(' + e.id + ')" title="Registrations">👥</button>' +
          '<button class="icon-btn danger" onclick="deleteEvent(' + e.id + ')" title="Delete">🗑</button>' +
        '</div></div>' +
      '<div class="evt-card-meta">' +
        '<div class="evt-meta-line">📅 ' + ds + (e.time?' 🕐 '+e.time:'') + '</div>' +
        (e.venue ? '<div class="evt-meta-line">📍 ' + e.venue + '</div>' : '') +
        '<div class="evt-meta-line">🎮 ' + (e.type==='team'?'Team ('+e.teamSize+')':'Solo') + '</div>' +
      '</div>' +
      '<div class="evt-card-footer">' +
        '<div class="evt-reg-count"><strong>' + reg + '</strong> / ' + max + ' registered</div>' +
        '<span class="status-chip" style="background:rgba(52,211,153,0.1);color:' + sc + ';">' + e.status + '</span>' +
      '</div>' +
      '<div style="margin-top:10px;background:rgba(255,255,255,0.05);border-radius:4px;height:4px;overflow:hidden;">' +
        '<div style="height:4px;border-radius:4px;background:linear-gradient(90deg,var(--accent),var(--accent2));width:' + pct + '%;transition:width 0.4s;"></div>' +
      '</div></div>';
  }).join('') + '<button class="add-event-btn" onclick="openCreateEventModal()">+ Create New Event</button>';
}

function viewEventRegs(evtId) {
  var ev = clubEvents.find(function(e){ return e.id===evtId; });
  if (!ev) return;
  el('vrm-title').textContent = ev.title + ' — Registrations';
  var body = el('vrm-body');
  body.innerHTML = '<div style="text-align:center;padding:20px;color:var(--muted);font-size:13px;">Loading…</div>';
  openModal('view-regs-modal');

  if (ev.type === 'team') {
    // Load full team data with members from DB
    api('GET', '/teams/for_event/' + evtId).then(function(teams) {
      if (!teams || !teams.length) {
        body.innerHTML = '<div class="empty-state"><div>👥</div>No teams registered yet.</div>';
        return;
      }
      body.innerHTML = '<div style="display:flex;flex-direction:column;gap:14px;">' +
        teams.map(function(t, i) {
          var isFull      = t.current_size >= t.max_size;
          var isConfirmed = t.confirmed == 1;
          return '<div style="background:var(--card);border:0.5px solid ' + (isConfirmed ? 'rgba(52,211,153,0.35)' : 'var(--border)') + ';border-radius:12px;overflow:hidden;">' +
            // Team header
            '<div style="padding:12px 16px;background:' + (isConfirmed ? 'rgba(52,211,153,0.07)' : 'rgba(255,255,255,0.03)') + ';display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">' +
              '<div>' +
                '<div style="font-family:var(--font-head);font-size:14px;font-weight:700;color:var(--accent);display:flex;align-items:center;gap:8px;">Team ' + (i+1) + ': ' + t.team_name +
                  (isConfirmed ? '<span style="font-size:11px;background:rgba(52,211,153,0.15);border:0.5px solid rgba(52,211,153,0.3);color:#34D399;padding:2px 9px;border-radius:5px;font-family:var(--font-body);font-weight:600;">✓ Confirmed</span>' : '<span style="font-size:11px;background:rgba(252,211,77,0.1);border:0.5px solid rgba(252,211,77,0.2);color:var(--accent3);padding:2px 9px;border-radius:5px;font-family:var(--font-body);">⏳ Awaiting Confirm</span>') +
                '</div>' +
                '<div style="font-size:11px;color:var(--muted);margin-top:2px;">' + t.current_size + ' / ' + t.max_size + ' members · ' + (isFull ? '<span style="color:#34D399;">Full ✓</span>' : '<span style="color:var(--accent3);">Incomplete</span>') + (isConfirmed && t.confirmed_at ? ' · Confirmed at ' + new Date(t.confirmed_at).toLocaleDateString('en-IN',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}) : '') + '</div>' +
              '</div>' +
              '<div style="display:flex;gap:8px;align-items:center;">' +
                '<span style="font-family:monospace;font-size:12px;color:var(--accent2);background:rgba(167,139,250,0.1);border:0.5px solid rgba(167,139,250,0.2);padding:3px 10px;border-radius:6px;cursor:pointer;" data-copy="' + t.team_code + '" class="copy-tid-btn">🆔 ' + t.team_code + '</span>' +
                '<button data-del-team="' + t.team_id + '" data-evt="' + evtId + '" class="delete-team-btn" style="background:rgba(244,114,182,0.08);border:0.5px solid rgba(244,114,182,0.25);color:#F472B6;padding:4px 10px;border-radius:7px;cursor:pointer;font-size:12px;font-family:var(--font-body);">🗑 Delete</button>' +
              '</div>' +
            '</div>' +
            // Members list
            '<div>' +
            t.members.map(function(m, mi) {
              return '<div style="display:flex;align-items:center;gap:12px;padding:10px 16px;border-bottom:0.5px solid rgba(255,255,255,0.04);">' +
                '<div style="width:28px;height:28px;border-radius:50%;background:' + (mi===0?'linear-gradient(135deg,var(--accent),var(--accent2))':'rgba(255,255,255,0.07)') + ';display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:' + (mi===0?'#050810':'var(--text)') + ';">' + (m.name||'?').charAt(0).toUpperCase() + '</div>' +
                '<div style="flex:1;">' +
                  '<div style="font-size:13px;font-weight:500;">' + (m.name||'—') + (mi===0?' <span style="font-size:10px;background:rgba(252,211,77,0.1);color:var(--accent3);padding:1px 6px;border-radius:4px;">Leader</span>':'') + '</div>' +
                  '<div style="font-size:11px;color:var(--muted);">' + (m.email||'—') + (m.student_code?' · '+m.student_code:'') + '</div>' +
                '</div>' +
                (mi===0?'<span style="font-size:16px;">👑</span>':'<span style="font-size:14px;color:#34D399;">✓</span>') +
              '</div>';
            }).join('') +
            '</div>' +
          '</div>';
        }).join('') + '</div>';

      // Wire up delete buttons and copy buttons
      body.querySelectorAll('.delete-team-btn').forEach(function(btn) {
        btn.onclick = function() {
          var tid = this.dataset.delTeam;
          var evId = this.dataset.evt;
          if (!confirm('Delete this team? All members will be unregistered.')) return;
          api('DELETE', '/teams/delete/' + tid, null).then(function(r) {
            if (!r) return;
            showToast('Team deleted ✓');
            viewEventRegs(parseInt(evId)); // refresh
          });
        };
      });
      body.querySelectorAll('.copy-tid-btn').forEach(function(span) {
        span.onclick = function() { copyTid(this.dataset.copy); };
      });
    });
  } else {
    // Solo event registrations
    api('GET', '/events/' + evtId + '/registrations').then(function(rows) {
      if (!rows || !rows.length) {
        body.innerHTML = '<div class="empty-state"><div>📋</div>No registrations yet.</div>';
        return;
      }
      body.innerHTML = '<div style="display:flex;flex-direction:column;gap:6px;">' +
        rows.map(function(r, i) {
          return '<div style="display:grid;grid-template-columns:28px 1fr 1fr 1fr auto;gap:12px;align-items:center;padding:10px 14px;background:var(--card);border:0.5px solid var(--border);border-radius:10px;">' +
            '<div style="font-size:12px;color:var(--muted);font-weight:600;">#' + (i+1) + '</div>' +
            '<div style="font-size:13px;font-weight:500;">' + (r.name||'—') + '</div>' +
            '<div style="font-size:12px;color:var(--muted);">' + (r.email||'—') + '</div>' +
            '<div style="font-size:12px;color:var(--muted);">' + (r.student_code||'—') + '</div>' +
            '<button class="admin-del-reg" data-eid="' + evtId + '" data-sid="' + r.student_id + '" style="background:rgba(244,114,182,0.08);border:0.5px solid rgba(244,114,182,0.2);color:#F472B6;padding:4px 10px;border-radius:7px;cursor:pointer;font-size:11px;font-family:var(--font-body);white-space:nowrap;">✕ Remove</button>' +
          '</div>';
        }).join('') + '</div>';

      // Wire delete buttons
      setTimeout(function() {
        body.querySelectorAll('.admin-del-reg').forEach(function(btn) {
          btn.onclick = function() {
            var eid = this.dataset.eid, sid = this.dataset.sid;
            if (!confirm('Remove this student from the event?')) return;
            adminDeleteReg(parseInt(eid), parseInt(sid));
          };
        });
      }, 50);
    });
  }
}
function closeViewRegsModal(e) { if (!e || e.target === el('view-regs-modal')) closeModal('view-regs-modal'); }

// ── Attendance ──
function renderAttendanceEventList() {
  var sel = el('attend-event-select');
  if (!sel||!currentAdmin) return;
  var evts = getClubEvents(currentAdmin.name);
  sel.innerHTML = '<option value="">Choose an event…</option>';
  evts.forEach(function(e) {
    var o = document.createElement('option');
    o.value = e.id; o.textContent = e.title + ' — ' + (e.date||'TBD');
    sel.appendChild(o);
  });
}

function renderAttendance() {
  var evtId = parseInt(el('attend-event-select').value);
  var cont  = el('attend-container');
  var exportBtn = el('attend-export-btn');
  if (!evtId) { cont.innerHTML=''; if(exportBtn) exportBtn.style.display='none'; return; }
  var ev = clubEvents.find(function(e){ return e.id===evtId; });
  if (!ev) return;

  var render = function(attendees) {
    if (!attendees.length) {
      cont.innerHTML='<div class="empty-state"><div>👥</div>No members or registrations yet.</div>';
      if(exportBtn) exportBtn.style.display='none';
      return;
    }
    if(exportBtn) exportBtn.style.display='inline-flex';
    var pc = attendees.filter(function(a){ return a.present; }).length;
    cont.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">' +
        '<div style="font-size:14px;color:var(--muted);">' + pc + ' / ' + attendees.length + ' present</div>' +
        '<div style="display:flex;gap:8px;">' +
          '<button class="app-btn accept" onclick="markAll(' + evtId + ',true)">Mark All Present</button>' +
          '<button class="app-btn reject" onclick="markAll(' + evtId + ',false)">Clear All</button>' +
        '</div></div>' +
      '<div class="attend-row-head"><div>Name</div><div>Student ID</div><div>Role/Team</div><div>Present</div></div>' +
      '<div class="attend-list">' +
      attendees.map(function(a) {
        return '<div class="attend-row">' +
          '<div class="attend-name">' + (a.name||'—') + (a.role==='leader'?' 👑':'') + '</div>' +
          '<div class="attend-sid">'  + (a.student_code||a.sid||a.studentId||'—') + '</div>' +
          '<div style="font-size:11px;color:var(--muted);">' + (a.team_name||a.source||a.role||'—') + '</div>' +
          '<div><button class="attend-toggle' + (a.present?' present':'') + '" onclick="toggleAttend(' + evtId + ',\'' + (a.student_id||a.key) + '\',this)"></button></div>' +
        '</div>';
      }).join('') + '</div>';
  };

  // Try DB first for DB-backed events
  if (authToken) {
    api('GET', '/events/' + evtId + '/attendance').then(function(rows) {
      if (rows && rows.length) { render(rows); return; }
      renderAttendanceLocal(ev, render);
    });
  } else { renderAttendanceLocal(ev, render); }
}

function renderAttendanceLocal(ev, renderFn) {
  var accepted  = applications.filter(function(a){ return a.club===ev.clubName && a.status==='accepted'; });
  var attendees = [];
  accepted.forEach(function(a) {
    if (ev.attendance[a.id]===undefined) ev.attendance[a.id]=false;
    attendees.push({ key:a.id, name:a.name, sid:a.studentId||'—', present:ev.attendance[a.id], source:'member' });
  });
  if (ev.type!=='team') {
    ev.registrations.forEach(function(r,i) {
      var k='reg-'+i; if(ev.attendance[k]===undefined) ev.attendance[k]=false;
      attendees.push({ key:k, name:r.name, sid:r.id||'—', present:ev.attendance[k], source:'registered' });
    });
  } else {
    ev.registrations.forEach(function(r,ri) {
      r.members.forEach(function(m,mi) {
        var k='reg-'+ri+'-'+mi; if(ev.attendance[k]===undefined) ev.attendance[k]=false;
        attendees.push({ key:k, name:m.name+(mi===0?' 👑':''), sid:m.id||'—', present:ev.attendance[k], source:r.teamName||'Team'+(ri+1) });
      });
    });
  }
  renderFn(attendees);
}

function toggleAttend(evtId, key, btn) {
  if (!currentAdmin || !authToken) { showToast('Please sign in as admin'); return; }
  var present = !btn.classList.contains('present');
  api('PATCH', '/events/' + evtId + '/attendance', { student_id: parseInt(key), present: present }).then(function(){});

  btn.classList.toggle('present', present);
  var cont=el('attend-container'), cd=cont?cont.querySelector('div[style*="font-size:14px"]'):null;
  if (cd) { var pc=cont.querySelectorAll('.attend-toggle.present').length, tot=cont.querySelectorAll('.attend-row').length; cd.textContent=pc+' / '+tot+' present'; }
}

function markAll(evtId, present) {
  if (!currentAdmin || !authToken) { showToast('Please sign in as admin'); return; }
  api('PATCH', '/events/' + evtId + '/attendance/all', { present: present }).then(function() {
    renderAttendance();
    el('attend-event-select').value = evtId;
  });
}

// ── Export Attendance to Excel ──
function exportAttendanceExcel() {
  var evtId = parseInt(el('attend-event-select').value);
  if (!evtId) { showToast('Please select an event first'); return; }

  // Gather rows from the rendered attendance table
  var rows = el('attend-container').querySelectorAll('.attend-row');
  if (!rows.length) { showToast('No attendance data to export'); return; }

  var ev = clubEvents.find(function(e){ return e.id === evtId; });
  var evtTitle = ev ? ev.title : ('Event #' + evtId);
  var evtDate  = ev ? (ev.date || '') : '';

  // Build data array: header + rows
  var data = [['Name', 'Student ID', 'Role / Team', 'Present']];
  rows.forEach(function(row) {
    var cells = row.querySelectorAll('div');
    var name  = cells[0] ? cells[0].textContent.trim() : '';
    var sid   = cells[1] ? cells[1].textContent.trim() : '';
    var role  = cells[2] ? cells[2].textContent.trim() : '';
    var btn   = row.querySelector('.attend-toggle');
    var pres  = btn && btn.classList.contains('present') ? 'Yes' : 'No';
    data.push([name, sid, role, pres]);
  });

  // Summary row
  var presentCount = data.slice(1).filter(function(r){ return r[3]==='Yes'; }).length;
  data.push([]);
  data.push(['Summary', '', 'Present', presentCount]);
  data.push(['', '', 'Total', data.length - 3]);

  // Use SheetJS to build workbook
  var wb = XLSX.utils.book_new();
  var ws = XLSX.utils.aoa_to_sheet(data);

  // Column widths
  ws['!cols'] = [{ wch: 28 }, { wch: 16 }, { wch: 20 }, { wch: 10 }];

  XLSX.utils.book_append_sheet(wb, ws, 'Attendance');

  var filename = 'attendance_' + evtTitle.replace(/[^a-zA-Z0-9]/g,'_').substring(0,30) + (evtDate ? '_' + evtDate : '') + '.xlsx';
  XLSX.writeFile(wb, filename);
  showToast('📊 Exported: ' + filename);
}

// ══════════════════════════════════════
// CALENDAR
// ══════════════════════════════════════
function renderCalendar() {
  var g = el('cal-grid');
  if (!g) return;
  var today  = new Date();
  var year   = today.getFullYear();
  var month  = today.getMonth(); // 0-based
  var days   = ['S','M','T','W','T','F','S'];

  // Get days in current month that have events
  // Only mark calendar days with future/today events
  var calToday = new Date(); calToday.setHours(0,0,0,0);
  var eventDays = [];
  events.forEach(function(e) {
    if (e.day && e.month) {
      // Parse month name to number
      var monthNames = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
      var mIdx = monthNames.indexOf((e.month||'').toLowerCase().substr(0,3));
      if (mIdx === month) eventDays.push(parseInt(e.day));
    }
  });
  // Remove duplicates
  eventDays = eventDays.filter(function(v,i,a){ return a.indexOf(v)===i; });

  // Build calendar grid
  var firstDay   = new Date(year, month, 1).getDay(); // 0=Sun
  var daysInMonth= new Date(year, month+1, 0).getDate();
  var prevDays   = new Date(year, month, 0).getDate();

  var html = days.map(function(d){ return '<div class="cal-daylabel">'+d+'</div>'; }).join('');
  for (var i = firstDay; i > 0; i--) html += '<div class="cal-day other-month">'+(prevDays-i+1)+'</div>';
  for (var d = 1; d <= daysInMonth; d++) {
    var isToday   = d === today.getDate();
    var hasEvent  = eventDays.indexOf(d) > -1;
    html += '<div class="cal-day' + (isToday?' today':'') + (hasEvent?' has-event':'') + '">' + d + '</div>';
  }
  g.innerHTML = html;

  // Update cal header month/year
  var monthLabel = el('cal-month-label');
  if (monthLabel) {
    var mNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    monthLabel.textContent = mNames[month] + ' ' + year;
  }

  // Render mini events sidebar
  renderMiniEvents();
}

function renderMiniEvents() {
  var mini = el('mini-events-list');
  if (!mini) return;
  var today  = new Date();
  var month  = today.getMonth();
  var monthNames = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
  var dotColors  = ['var(--accent)','var(--accent2)','var(--accent3)','#34D399','#F472B6'];

  var upcoming = events.filter(function(e) {
    var mIdx = monthNames.indexOf((e.month||'').toLowerCase().substr(0,3));
    return mIdx >= month;
  }).slice(0, 5);

  if (!upcoming.length) { mini.innerHTML = '<div style="font-size:12px;color:var(--muted);">No upcoming events</div>'; return; }

  mini.innerHTML = upcoming.map(function(e, i) {
    var color = dotColors[i % dotColors.length];
    return '<div class="mini-event">' +
      '<div class="mini-dot" style="background:' + color + '"></div>' +
      '<div>' +
        '<div class="mini-event-name">' + e.name + '</div>' +
        '<div class="mini-event-time">' + e.month + ' ' + e.day + (e.time ? ' &middot; ' + e.time : '') + '</div>' +
      '</div>' +
    '</div>';
  }).join('');
}

// ══════════════════════════════════════
// SLIDER
// ══════════════════════════════════════
var sliderPalettes = [
  {bg:'linear-gradient(135deg,#0a1628,#0d2444,#0a3060)',cat:'Tech',   catBg:'rgba(110,231,255,0.15)',catColor:'#6EE7FF', statusBg:'rgba(252,211,77,0.15)', statusColor:'#FCD34D'},
  {bg:'linear-gradient(135deg,#100820,#1a0d35,#210a40)',cat:'Arts',   catBg:'rgba(167,139,250,0.15)',catColor:'#A78BFA', statusBg:'rgba(52,211,153,0.15)', statusColor:'#34D399'},
  {bg:'linear-gradient(135deg,#0a1a0e,#0d2a12,#0e3318)',cat:'Culture',catBg:'rgba(52,211,153,0.15)', catColor:'#34D399', statusBg:'rgba(252,211,77,0.15)', statusColor:'#FCD34D'},
  {bg:'linear-gradient(135deg,#1a0a0a,#2a0d0d,#330e0e)',cat:'Social', catBg:'rgba(244,114,182,0.15)',catColor:'#F472B6', statusBg:'rgba(110,231,255,0.15)',statusColor:'#6EE7FF'},
  {bg:'linear-gradient(135deg,#0e1200,#1a2000,#233000)', cat:'Sports', catBg:'rgba(252,211,77,0.15)', catColor:'#FCD34D', statusBg:'rgba(110,231,255,0.15)',statusColor:'#6EE7FF'},
  {bg:'linear-gradient(135deg,#0a1628,#0d2444,#0a3060)',cat:'Tech',   catBg:'rgba(110,231,255,0.15)',catColor:'#6EE7FF', statusBg:'rgba(167,139,250,0.15)',statusColor:'#A78BFA'},
  {bg:'linear-gradient(135deg,#100820,#1a0d35,#210a40)',cat:'Culture',catBg:'rgba(167,139,250,0.15)',catColor:'#A78BFA', statusBg:'rgba(252,211,77,0.15)', statusColor:'#FCD34D'},
  {bg:'linear-gradient(135deg,#0a1a0e,#0d2a12,#0e3318)',cat:'Tech',   catBg:'rgba(52,211,153,0.15)', catColor:'#34D399', statusBg:'rgba(110,231,255,0.15)',statusColor:'#6EE7FF'},
];

function renderSlider() {
  var track=el('slider-track'), dots=el('slider-dots');
  // Map club category to palette
  var catPalette = {
    'tech':    {bg:'linear-gradient(135deg,#0a1628,#0d2444,#0a3060)', cat:'Tech',    catBg:'rgba(110,231,255,0.15)', catColor:'#6EE7FF', statusBg:'rgba(252,211,77,0.15)',  statusColor:'#FCD34D'},
    'arts':    {bg:'linear-gradient(135deg,#100820,#1a0d35,#210a40)', cat:'Arts',    catBg:'rgba(167,139,250,0.15)', catColor:'#A78BFA', statusBg:'rgba(52,211,153,0.15)',  statusColor:'#34D399'},
    'culture': {bg:'linear-gradient(135deg,#0a1a0e,#0d2a12,#0e3318)', cat:'Culture', catBg:'rgba(52,211,153,0.15)',  catColor:'#34D399', statusBg:'rgba(252,211,77,0.15)',  statusColor:'#FCD34D'},
    'social':  {bg:'linear-gradient(135deg,#1a0a0a,#2a0d0d,#330e0e)', cat:'Social',  catBg:'rgba(244,114,182,0.15)', catColor:'#F472B6', statusBg:'rgba(110,231,255,0.15)', statusColor:'#6EE7FF'},
    'sports':  {bg:'linear-gradient(135deg,#0e1200,#1a2000,#233000)',  cat:'Sports',  catBg:'rgba(252,211,77,0.15)',  catColor:'#FCD34D', statusBg:'rgba(110,231,255,0.15)', statusColor:'#6EE7FF'},
  };

  // Only show non-past events in slider
  var today = new Date(); today.setHours(0,0,0,0);
  var monthNames = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
  sliderCount = 0; // will be set below
  var sliderEvents = events.filter(function(e) {
    if (!e.day || !e.month) return true;
    var mIdx = monthNames.indexOf((e.month||'').toLowerCase().substr(0,3));
    if (mIdx === -1) return true;
    var yr = today.getFullYear();
    var evtDate = new Date(yr, mIdx, parseInt(e.day));
    if (evtDate < today && mIdx < today.getMonth()) evtDate.setFullYear(yr + 1);
    return evtDate >= today;
  }).slice(0, 8); // max 8 in slider

  track.innerHTML = sliderEvents.map(function(e,i) {
    // Look up club category from loaded clubs data, fallback to rotation
    var clubData = clubs.find(function(c){ return c.name === e.club; });
    var cat = clubData ? (clubData.tag || 'tech') : null;
    var p = (cat && catPalette[cat]) ? catPalette[cat] : sliderPalettes[i % sliderPalettes.length];
    return '<div class="slide-card" style="background:'+p.bg+';" onclick="showSection(\'events\',null)">' +
      '<div class="slide-gradient"></div>' +
      '<div class="slide-content">' +
        '<div class="slide-left">' +
          '<div class="slide-badge-row"><span class="slide-cat" style="background:'+p.catBg+';color:'+p.catColor+';">'+p.cat+'</span><span class="slide-status" style="background:'+p.statusBg+';color:'+p.statusColor+';">'+e.badgeText+'</span></div>' +
          '<div class="slide-title">'+e.name+'</div>' +
          '<div class="slide-meta">' +
            (e.time?'<div class="slide-meta-item">🕐 '+e.time+'</div>':'')+
            (e.location?'<div class="slide-meta-item">📍 '+e.location.split(',')[0]+'</div>':'')+
            '<div class="slide-meta-item">🏷️ '+e.club+'</div>'+
          '</div>' +
        '</div>' +
        '<div class="slide-right">' +
          '<div class="slide-date-box"><div class="slide-day">'+e.day+'</div><div class="slide-month">'+e.month+'</div></div>' +
          '<button class="slide-register-btn" onclick="event.stopPropagation();openEventReg('+e.id+')">Register</button>' +
        '</div>' +
      '</div></div>';
  }).join('');
  sliderCount = sliderEvents.length;
  dots.innerHTML=sliderEvents.map(function(_,i){ return '<div class="slider-dot'+(i===0?' active':'')+'" onclick="slideTo('+i+')"></div>'; }).join('');
  startSliderAuto();
}
function slideTo(i) { sliderIndex=(i+(sliderCount||events.length))%(sliderCount||events.length); el('slider-track').style.transform='translateX(-'+(sliderIndex*100)+'%)'; document.querySelectorAll('.slider-dot').forEach(function(d,idx){ d.classList.toggle('active',idx===sliderIndex); }); resetSliderAuto(); }
function slideMove(dir) { slideTo(sliderIndex+dir); }
function startSliderAuto() { clearInterval(sliderTimer); sliderTimer=setInterval(function(){ slideTo(sliderIndex+1); },4000); }
function resetSliderAuto()  { clearInterval(sliderTimer); sliderTimer=setInterval(function(){ slideTo(sliderIndex+1); },4000); }

// ══════════════════════════════════════
// TOAST
// ══════════════════════════════════════
function showToast(msg) {
  el('toast-msg').textContent=msg; el('toast').classList.add('show');
  clearTimeout(toastTimer); toastTimer=setTimeout(function(){ el('toast').classList.remove('show'); },3500);
}

// ══════════════════════════════════════
// SESSION RESTORE
// ══════════════════════════════════════
function restoreSession() {
  try {
    var token = loadSavedToken();
    if (!token) return;
    var payload = JSON.parse(atob(token.split('.')[1]));
    if (payload.exp * 1000 < Date.now()) { clearToken(); return; }
    authToken = token;
    if (payload.role === 'student') {
      // Set minimal currentUser from token so nav shows immediately
      var uname = payload.name || payload.email.split('@')[0];
      currentUser = { id: payload.id, email: payload.email, name: uname, initial: uname.charAt(0).toUpperCase() };
      buildStudentNav();
      // Then fetch full profile from DB to get real name, department, etc.
      api('GET', '/students').then(function(data) {
        if (data && data.student) {
          var s = data.student;
          currentUser.name        = s.name;
          currentUser.initial     = s.name.charAt(0).toUpperCase();
          currentUser.department  = s.department;
          currentUser.studentCode = s.student_code;
          currentUser.year        = s.year;
          buildStudentNav(); // refresh nav with real name
        }
        loadDashboardData();
      });
    }
  } catch(e) { clearToken(); }
}

// ══════════════════════════════════════
// INIT — load from DB then render
// ══════════════════════════════════════
// Initialize saved token from storage/cookie
authToken = loadSavedToken();

renderCalendar();
renderAdminPanel();
renderUserDashboard();

el('cev-type').addEventListener('change', function(){
  el('cev-teamsize-wrap').style.display = this.value==='team' ? 'block' : 'none';
});

// Load clubs + events from MySQL, render everything, then restore session
loadFromDB().then(function(){
  updateHomeStats();
  restoreSession();
}).catch(function(){
  renderClubs(clubs);
  renderEvents();
  renderSlider();
  restoreSession();
});

function updateHomeStats() {
  var clubCount   = el('home-stat-clubs');
  var evtCount    = el('home-stat-events');
  var memberCount = el('home-stat-members');
  if (clubCount)   clubCount.textContent  = clubs.length || '—';
  if (evtCount)    evtCount.textContent   = events.length || '—';
  // Sum member_count from DB; if all zero (no approvals yet), show total clubs × avg
  var total = clubs.reduce(function(sum, c){ return sum + (c.members || 0); }, 0);
  if (memberCount) memberCount.textContent = total > 0 ? total.toLocaleString() : clubs.length * 10 + '+';
}