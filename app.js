// ================================================================
//  AlumniNexus — app.js
//  Firebase Compat SDK | No static data | Full CRUD + Delete
// ================================================================

var firebaseConfig = {
  apiKey:            "AIzaSyCfhlQ2jpRGj-Sz8yVYjUzJ8Zej15Nf-W4",
  authDomain:        "alumni-323cb.firebaseapp.com",
  projectId:         "alumni-323cb",
  storageBucket:     "alumni-323cb.firebasestorage.app",
  messagingSenderId: "339865134131",
  appId:             "1:339865134131:web:f348b72009925e896d2f46"
};
firebase.initializeApp(firebaseConfig);
var fbAuth = firebase.auth();
var fbDB   = firebase.firestore();

// Admin emails
var ADMIN_EMAILS = ['admin@nitt.edu', 'anisinga24@gmail.com'];

// ── STATE ────────────────────────────────────────────────────────
var currentUser = null;
// Live data arrays (populated only from Firestore)
var alumniData    = [];
var eventsData    = [];
var mentorsData   = [];
var jobsData      = [];
var campaignsData = [];
var donationsData = [];
var activityLog   = [];
var notifications = [];
// Filtered + pagination
var filteredAlumni = [];
var PAGE = 1, PER = 9;
var eventsFilter = 'all';

// ── HELPERS ──────────────────────────────────────────────────────
function g(id) { return document.getElementById(id); }
function v(id) { return (g(id) ? g(id).value : '').trim(); }
function s(id, val) { if (g(id)) g(id).textContent = val; }
function ts() { return firebase.firestore.FieldValue.serverTimestamp(); }

function showToast(msg, type) {
  type = type || 'info';
  var icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
  var c = g('toastContainer'); if (!c) return;
  var t = document.createElement('div');
  t.className = 'toast ' + type;
  t.innerHTML = '<span>' + icons[type] + '</span><span>' + msg + '</span>';
  c.appendChild(t);
  setTimeout(function () {
    t.style.animation = 'toastOut .3s ease forwards';
    setTimeout(function () { if (t.parentNode) t.remove(); }, 300);
  }, 3500);
}

var AV_COLORS = ['#1e3a8a','#14532d','#7c2d12','#581c87','#0e7490','#92400e','#065f46'];
function avColor(str) {
  var h = 0;
  for (var i = 0; i < (str||'').length; i++) h = (h * 31 + str.charCodeAt(i)) & 0xffffffff;
  return AV_COLORS[Math.abs(h) % AV_COLORS.length];
}
function initials(fn, ln) { return ((fn||'?')[0] + (ln||'?')[0]).toUpperCase(); }

function pushActivity(ico, text) {
  activityLog.unshift({ ico: ico, text: text, time: new Date().toLocaleTimeString() });
  activityLog = activityLog.slice(0, 8);
  renderActivity();
}

function updateDashCounts() {
  s('dAlumni',    alumniData.length);
  s('dEvents',    eventsData.length);
  s('dMentors',   mentorsData.length);
  s('dJobs',      jobsData.length);
  s('dCampaigns', campaignsData.length);
  s('ls-alumni',  alumniData.length);
  s('ls-events',  eventsData.length);
  s('ls-jobs',    jobsData.length);
  s('ls-mentors', mentorsData.length);
}

// ── CONFIRM DELETE HELPER ────────────────────────────────────────
function confirmDelete(msg, onOk) {
  g('confirmMsg').textContent = msg;
  var btn = g('confirmOkBtn');
  var newBtn = btn.cloneNode(true);
  btn.parentNode.replaceChild(newBtn, btn);
  newBtn.onclick = function () { closeModal('confirmModal'); onOk(); };
  showModal('confirmModal');
}

// ── AUTH ─────────────────────────────────────────────────────────
function doLogin() {
  var em = v('liEmail'), pw = v('liPass');
  if (!em) { showToast('Enter your email', 'error'); return; }
  if (!pw) { showToast('Enter your password', 'error'); return; }
  showToast('Signing in...', 'info');
  fbAuth.signInWithEmailAndPassword(em, pw)
    .then(function (r) { handleFBUser(r.user); })
    .catch(function (e) {
      showToast(e.code === 'auth/invalid-credential' || e.code === 'auth/wrong-password' ? 'Invalid email or password' : e.message, 'error');
    });
}

function doGoogleLogin() {
  fbAuth.signInWithPopup(new firebase.auth.GoogleAuthProvider())
    .then(function (r) { handleFBUser(r.user); })
    .catch(function (e) { if (e.code !== 'auth/popup-closed-by-user') showToast(e.message, 'error'); });
}

function handleFBUser(fbUser) {
  var isAdmin = ADMIN_EMAILS.indexOf(fbUser.email.toLowerCase()) >= 0;
  fbDB.collection('users').doc(fbUser.uid).get()
    .then(function (snap) {
      var d = snap.exists ? snap.data() : {};
      var parts = (fbUser.displayName || '').split(' ');
      loginSuccess({
        uid:       fbUser.uid,
        firstName: d.firstName || parts[0] || 'User',
        lastName:  d.lastName  || parts.slice(1).join(' ') || '',
        email:     fbUser.email,
        role:      isAdmin ? 'admin' : (d.role || 'alumni'),
        phone:     d.phone    || '',
        company:   d.company  || '',
        desig:     d.desig    || '',
        city:      d.city     || '',
        linkedin:  d.linkedin || '',
        bio:       d.bio      || ''
      });
    })
    .catch(function () {
      var parts = (fbUser.displayName || '').split(' ');
      loginSuccess({ uid: fbUser.uid, firstName: parts[0] || 'User', lastName: parts.slice(1).join(' ') || '', email: fbUser.email, role: isAdmin ? 'admin' : 'alumni' });
    });
}

function loginSuccess(user) {
  currentUser = user;
  g('loginPage').classList.add('hidden');
  g('mainApp').classList.remove('hidden');
  updateNav();
  applyRoleUI();
  loadProfile();
  loadAll();
  showToast('Welcome, ' + user.firstName + '! 👋', 'success');
}

function doLogout() {
  fbAuth.signOut().catch(function () {});
  currentUser = null;
  alumniData = []; eventsData = []; mentorsData = []; jobsData = []; campaignsData = []; donationsData = [];
  g('loginPage').classList.remove('hidden');
  g('mainApp').classList.add('hidden');
  g('liEmail').value = ''; g('liPass').value = '';
  switchTab('login');
  closeMenu();
  showToast('Logged out', 'info');
}

function doRegister() {
  var fn = v('rFN'), ln = v('rLN'), em = v('rEmail'), pw = v('rPass'), role = v('rRole') || 'alumni';
  if (!fn) { showToast('Enter First Name', 'error'); return; }
  if (!ln) { showToast('Enter Last Name', 'error'); return; }
  if (!em) { showToast('Enter Email', 'error'); return; }
  if (pw.length < 6) { showToast('Password must be at least 6 characters', 'error'); return; }
  showToast('Creating account...', 'info');
  fbAuth.createUserWithEmailAndPassword(em, pw)
    .then(function (r) {
      var batch = parseInt(v('rBatch')) || null;
      var dept  = v('rDept') || null;
      return fbDB.collection('users').doc(r.user.uid).set({
        firstName: fn, lastName: ln, email: em,
        role: ADMIN_EMAILS.indexOf(em.toLowerCase()) >= 0 ? 'admin' : role,
        batch: batch, dept: dept,
        createdAt: ts()
      });
    })
    .then(function () {
      showToast('Account created! Please sign in.', 'success');
      ['rFN','rLN','rEmail','rPass'].forEach(function (id) { if (g(id)) g(id).value = ''; });
      switchTab('login');
      g('liEmail').value = em;
      return fbAuth.signOut();
    })
    .catch(function (e) {
      showToast(e.code === 'auth/email-already-in-use' ? 'Email already registered' : e.message, 'error');
    });
}

function sendReset() {
  var em = v('forgotEmail');
  if (!em) { showToast('Enter email', 'error'); return; }
  fbAuth.sendPasswordResetEmail(em).finally(function () {
    showToast('Reset link sent to ' + em, 'success');
    closeModal('forgotModal');
  });
}

function togglePass(id, btn) {
  var el = g(id); if (!el) return;
  el.type = el.type === 'password' ? 'text' : 'password';
  btn.textContent = el.type === 'password' ? '👁' : '🙈';
}

function switchTab(tab) {
  g('loginForm').classList.toggle('hidden', tab !== 'login');
  g('registerForm').classList.toggle('hidden', tab !== 'register');
  g('loginTab').classList.toggle('active', tab === 'login');
  g('registerTab').classList.toggle('active', tab === 'register');
}

function toggleRegFields() {
  var role = v('rRole');
  g('rAlumniFields').classList.toggle('hidden', role !== 'alumni');
}

// ── NAV / MENU ───────────────────────────────────────────────────
function updateNav() {
  if (!currentUser) return;
  var ini = initials(currentUser.firstName, currentUser.lastName);
  var lbl = { admin: 'Admin', alumni: 'Alumni', student: 'Student', recruiter: 'Recruiter' };
  s('navAvatar', ini); s('umAv', ini);
  s('umName', currentUser.firstName + ' ' + currentUser.lastName);
  s('umRole', lbl[currentUser.role] || currentUser.role);
  s('umEmail', currentUser.email);
  s('roleDisplay', lbl[currentUser.role] || '—');
  s('welcomeName', currentUser.firstName);
  s('profAv', ini); s('profName', currentUser.firstName + ' ' + currentUser.lastName); s('profEmail', currentUser.email);
}

function toggleMenu() { g('userMenu').classList.toggle('open'); }
function closeMenu()   { g('userMenu').classList.remove('open'); }
document.addEventListener('click', function (e) { if (!e.target.closest('.avatar-wrap')) closeMenu(); });

// ── ROLE UI ──────────────────────────────────────────────────────
function applyRoleUI() {
  var role = currentUser ? currentUser.role : 'guest';
  document.querySelectorAll('.admin-only').forEach(function (el) { el.style.display = role === 'admin' ? '' : 'none'; });
  document.querySelectorAll('.alumni-only').forEach(function (el) { el.style.display = (role === 'alumni' || role === 'admin') ? '' : 'none'; });
  document.querySelectorAll('.student-only').forEach(function (el) { el.style.display = (role === 'student' || role === 'admin') ? '' : 'none'; });
  var pb = g('postJobBtn');
  if (pb) pb.style.display = (role === 'admin' || role === 'alumni' || role === 'recruiter') ? '' : 'none';
}

// ── VIEWS ────────────────────────────────────────────────────────
function showView(name) {
  document.querySelectorAll('.view').forEach(function (v) { v.classList.remove('active'); });
  document.querySelectorAll('.nav-link').forEach(function (l) { l.classList.remove('active'); });
  var vw = g('view-' + name); if (vw) vw.classList.add('active');
  var lk = document.querySelector('.nav-link[data-view="' + name + '"]'); if (lk) lk.classList.add('active');
  closeMenu();
  applyRoleUI();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (name === 'notifications') renderNotifications();
}

// ── MODALS ───────────────────────────────────────────────────────
function showModal(id)         { var el = g(id); if (el) { el.classList.add('open'); document.body.style.overflow = 'hidden'; } }
function closeModal(id)        { var el = g(id); if (el) { el.classList.remove('open'); document.body.style.overflow = ''; } }
function closeOv(e)            { if (e.target === e.currentTarget) closeModal(e.currentTarget.id); }

// ── LOAD ALL FROM FIRESTORE ──────────────────────────────────────
function loadAll() {
  loadAlumni();
  loadEvents();
  loadMentors();
  loadJobs();
  loadCampaigns();
  loadDonations();
}

function loadAlumni() {
  fbDB.collection('alumni').orderBy('createdAt', 'desc').onSnapshot(function (snap) {
    alumniData = [];
    snap.forEach(function (doc) {
      var d = doc.data(); d.id = doc.id; alumniData.push(d);
    });
    filteredAlumni = alumniData.slice();
    renderAlumni();
    updateDashCounts();
    s('alumniSub', alumniData.length + ' alumni in the network');
  }, function () { showToast('Could not load alumni', 'error'); });
}

function loadEvents() {
  fbDB.collection('events').orderBy('createdAt', 'desc').onSnapshot(function (snap) {
    eventsData = [];
    snap.forEach(function (doc) { var d = doc.data(); d.id = doc.id; eventsData.push(d); });
    renderEvents();
    updateDashCounts();
    s('eventsSub', eventsData.length + ' events');
  });
}

function loadMentors() {
  fbDB.collection('mentors').orderBy('createdAt', 'desc').onSnapshot(function (snap) {
    mentorsData = [];
    snap.forEach(function (doc) { var d = doc.data(); d.id = doc.id; mentorsData.push(d); });
    renderMentors();
    updateDashCounts();
    s('mentorsSub', mentorsData.length + ' mentors registered');
  });
}

function loadJobs() {
  fbDB.collection('jobs').orderBy('createdAt', 'desc').onSnapshot(function (snap) {
    jobsData = [];
    snap.forEach(function (doc) { var d = doc.data(); d.id = doc.id; jobsData.push(d); });
    renderJobs();
    updateDashCounts();
    s('jobsSub', jobsData.length + ' opportunities');
  });
}

function loadCampaigns() {
  fbDB.collection('campaigns').orderBy('createdAt', 'desc').onSnapshot(function (snap) {
    campaignsData = [];
    snap.forEach(function (doc) { var d = doc.data(); d.id = doc.id; campaignsData.push(d); });
    renderCampaigns();
    updateDashCounts();
    s('donationsSub', campaignsData.length + ' campaigns');
    // Populate donation campaign dropdown
    var sel = g('dCampaign'); if (!sel) return;
    sel.innerHTML = campaignsData.length
      ? campaignsData.map(function (c) { return '<option value="' + c.id + '">' + c.title + '</option>'; }).join('')
      : '<option>No campaigns yet</option>';
  });
}

function loadDonations() {
  fbDB.collection('donations').orderBy('createdAt', 'desc').limit(50).onSnapshot(function (snap) {
    donationsData = [];
    snap.forEach(function (doc) { var d = doc.data(); d.id = doc.id; donationsData.push(d); });
    renderDonations();
  });
}

// ── ACTIVITY ─────────────────────────────────────────────────────
function renderActivity() {
  var el = g('activityFeed'); if (!el) return;
  if (!activityLog.length) { el.innerHTML = '<p class="empty-msg">No recent activity</p>'; return; }
  el.innerHTML = activityLog.map(function (a) {
    return '<div class="act-item"><div class="act-ico">' + a.ico + '</div><div><div class="act-text">' + a.text + '</div><div class="act-time">' + a.time + '</div></div></div>';
  }).join('');
}

// ── ALUMNI RENDER ────────────────────────────────────────────────
function renderAlumni() {
  var start = (PAGE - 1) * PER;
  var page  = filteredAlumni.slice(start, start + PER);
  var el    = g('alumniGrid'); if (!el) return;
  var isAdmin = currentUser && currentUser.role === 'admin';

  if (!page.length) {
    el.innerHTML = '<p class="empty-msg">No alumni found. ' + (isAdmin ? 'Click "+ Add Alumni" to add the first one.' : '') + '</p>';
    g('alumniPagination').innerHTML = '';
    return;
  }

  el.innerHTML = page.map(function (a) {
    var ini = initials(a.firstName, a.lastName);
    var col = avColor(a.firstName + a.lastName);
    var delBtn = isAdmin
      ? '<button class="icon-btn del-btn" title="Delete" onclick="deleteAlumni(\'' + a.id + '\',\'' + (a.firstName + ' ' + a.lastName).replace(/'/g, '') + '\');event.stopPropagation()">🗑️</button>'
      : '';
    return '<div class="alumni-card">' +
      '<div class="ac-top">' +
        '<div class="ac-av" style="background:' + col + '">' + ini + '</div>' +
        '<div class="ac-info"><div class="ac-name">' + a.firstName + ' ' + a.lastName + '</div>' +
          '<div class="ac-batch">' + (a.batch || '—') + ' · ' + (a.dept || '—') + '</div></div>' +
        '<div class="ac-actions">' + delBtn + '</div>' +
      '</div>' +
      '<div class="ac-role">' + (a.desig || '—') + '</div>' +
      '<div class="ac-company">@ ' + (a.company || '—') + '</div>' +
      '<div class="ac-footer"><span>📍 ' + (a.city || '—') + '</span>' +
        '<span class="ac-status ' + (a.status === 'inactive' ? 'inactive' : 'active') + '">●</span></div>' +
      '</div>';
  }).join('');

  // Pagination
  var pages  = Math.ceil(filteredAlumni.length / PER);
  var pagEl  = g('alumniPagination'); if (!pagEl) return;
  pagEl.innerHTML = pages > 1
    ? Array.from({ length: pages }, function (_, i) {
        return '<button class="page-btn' + (i + 1 === PAGE ? ' active' : '') + '" onclick="goPage(' + (i + 1) + ')">' + (i + 1) + '</button>';
      }).join('')
    : '';
}

function filterAlumni() {
  var q     = (v('alumniSearch') || '').toLowerCase();
  var batch = v('batchFilter') || '';
  var dept  = v('deptFilter')  || '';
  filteredAlumni = alumniData.filter(function (a) {
    var txt = (a.firstName + ' ' + a.lastName + ' ' + (a.company || '') + ' ' + (a.dept || '')).toLowerCase();
    return (!q || txt.includes(q)) && (!batch || String(a.batch) === batch) && (!dept || a.dept === dept);
  });
  PAGE = 1;
  renderAlumni();
}

function goPage(n) { PAGE = n; renderAlumni(); }

// ── ADD ALUMNI ───────────────────────────────────────────────────
function addAlumni() {
  var fn = v('aFN'), ln = v('aLN'), em = v('aEmail'), batch = v('aBatch');
  if (!fn)    { showToast('Enter First Name', 'error'); return; }
  if (!ln)    { showToast('Enter Last Name', 'error'); return; }
  if (!em)    { showToast('Enter Email', 'error'); return; }
  if (!batch) { showToast('Enter Graduation Year', 'error'); return; }

  var data = {
    firstName: fn, lastName: ln, email: em,
    phone:    v('aPhone'), batch: parseInt(batch),
    dept:     v('aDept'),  company: v('aCompany'),
    desig:    v('aDesig'), city:    v('aCity'),
    industry: v('aIndustry'), linkedin: v('aLinkedin'),
    status:   'active',
    addedBy:  currentUser ? currentUser.email : 'admin',
    createdAt: ts()
  };

  showToast('Saving to Firebase...', 'info');
  fbDB.collection('alumni').add(data)
    .then(function () {
      closeModal('addAlumniModal');
      ['aFN','aLN','aEmail','aPhone','aBatch','aCompany','aDesig','aCity','aLinkedin'].forEach(function (id) { if (g(id)) g(id).value = ''; });
      showToast(fn + ' ' + ln + ' added! 👤', 'success');
      pushActivity('👤', 'Alumni added: ' + fn + ' ' + ln);
    })
    .catch(function (e) { showToast('Error: ' + e.message, 'error'); });
}

// ── DELETE ALUMNI ────────────────────────────────────────────────
function deleteAlumni(id, name) {
  confirmDelete('Delete alumni "' + name + '"? This cannot be undone.', function () {
    fbDB.collection('alumni').doc(id).delete()
      .then(function () { showToast(name + ' deleted', 'success'); pushActivity('🗑️', 'Alumni deleted: ' + name); })
      .catch(function (e) { showToast('Error: ' + e.message, 'error'); });
  });
}

// ── EVENTS ───────────────────────────────────────────────────────
function renderEvents() {
  var list = eventsFilter === 'all' ? eventsData : eventsData.filter(function (e) { return e.status === eventsFilter; });
  var el   = g('eventsGrid'); if (!el) return;
  var isAdmin = currentUser && currentUser.role === 'admin';
  var typeColors = { Reunion:'#1e3a8a', Webinar:'#14532d', Workshop:'#7c2d12', Networking:'#581c87', Fundraiser:'#0e7490' };
  var typeEmoji  = { Reunion:'🎓', Webinar:'💻', Workshop:'🛠️', Networking:'🤝', Fundraiser:'💰' };

  if (!list.length) { el.innerHTML = '<p class="empty-msg">No events yet.' + (isAdmin ? ' Create the first event!' : '') + '</p>'; return; }

  el.innerHTML = list.map(function (ev) {
    var col = typeColors[ev.type] || '#1e3a8a';
    var ico = typeEmoji[ev.type]  || '📅';
    var delBtn = isAdmin ? '<button class="icon-btn del-btn" title="Delete event" onclick="deleteEvent(\'' + ev.id + '\',\'' + (ev.title||'').replace(/'/g,'') + '\')">🗑️</button>' : '';
    var rsvpBtn = ev.status !== 'past'
      ? '<button class="btn btn-sm btn-primary" onclick="rsvpEvent(\'' + ev.id + '\')" ' + (ev.registrations >= ev.maxAttendees ? 'disabled' : '') + '>' + (ev.registrations >= ev.maxAttendees ? 'Full' : 'RSVP') + '</button>'
      : '<span class="badge-ended">Ended</span>';
    return '<div class="event-card">' +
      '<div class="ev-banner" style="background:' + col + '20">' +
        '<span style="font-size:2rem">' + ico + '</span>' +
        '<span class="ev-badge ev-' + ev.status + '">' + ev.status + '</span>' +
        delBtn +
      '</div>' +
      '<div class="ev-body">' +
        '<div class="ev-title">' + (ev.title || '—') + '</div>' +
        '<div class="ev-meta">📅 ' + (ev.date || '—') + (ev.time ? ' · ' + ev.time : '') + '</div>' +
        '<div class="ev-meta">📍 ' + (ev.venue || '—') + '</div>' +
        '<div class="ev-meta">🎫 ' + (ev.fee ? '₹' + ev.fee : 'Free') + '</div>' +
        '<div class="ev-footer"><span>👥 ' + (ev.registrations || 0) + '/' + (ev.maxAttendees || '—') + '</span>' + rsvpBtn + '</div>' +
      '</div></div>';
  }).join('');
}

function filterEvents(f, btn) {
  eventsFilter = f;
  document.querySelectorAll('.tab').forEach(function (b) { b.classList.remove('active'); });
  btn.classList.add('active');
  renderEvents();
}

function createEvent() {
  var title = v('eTitle'), date = v('eDate');
  if (!title) { showToast('Enter Event Title', 'error'); return; }
  if (!date)  { showToast('Select a Date', 'error'); return; }
  var emojis = { Reunion:'🎓', Webinar:'💻', Workshop:'🛠️', Networking:'🤝', Fundraiser:'💰' };
  var type   = v('eType') || 'Reunion';
  var data   = {
    title: title, type: type, status: v('eStatus') || 'upcoming',
    date: date, time: v('eTime'), venue: v('eVenue'),
    maxAttendees: parseInt(v('eMax')) || 100, registrations: 0,
    fee: parseInt(v('eFee')) || 0, desc: v('eDesc'), emoji: emojis[type] || '📅',
    createdBy: currentUser ? currentUser.email : 'admin', createdAt: ts()
  };
  showToast('Creating event...', 'info');
  fbDB.collection('events').add(data)
    .then(function () {
      closeModal('addEventModal');
      ['eTitle','eDate','eTime','eVenue','eMax','eDesc'].forEach(function (id) { if (g(id)) g(id).value = ''; });
      if (g('eFee')) g('eFee').value = '0';
      showToast('Event "' + title + '" created! 📅', 'success');
      pushActivity('📅', 'Event created: ' + title);
    })
    .catch(function (e) { showToast('Error: ' + e.message, 'error'); });
}

function deleteEvent(id, title) {
  confirmDelete('Delete event "' + title + '"?', function () {
    fbDB.collection('events').doc(id).delete()
      .then(function () { showToast('Event deleted', 'success'); pushActivity('🗑️', 'Event deleted: ' + title); })
      .catch(function (e) { showToast('Error: ' + e.message, 'error'); });
  });
}

function rsvpEvent(id) {
  var ev = eventsData.find(function (e) { return e.id === id; });
  if (!ev) return;
  if (ev.registrations >= ev.maxAttendees) { showToast('This event is full', 'warning'); return; }
  fbDB.collection('events').doc(id).update({ registrations: (ev.registrations || 0) + 1 })
    .then(function () { showToast('RSVP confirmed for "' + ev.title + '"! 🎉', 'success'); pushActivity('📅', 'RSVP for ' + ev.title); })
    .catch(function (e) { showToast('Error: ' + e.message, 'error'); });
}

// ── MENTORS ──────────────────────────────────────────────────────
function renderMentors() {
  var q  = (v('mentorSearch') || '').toLowerCase();
  var df = v('mentorDomainF') || '';
  var list = mentorsData.filter(function (m) {
    var txt = ((m.name || '') + ' ' + (m.company || '')).toLowerCase();
    var doms = (m.domains || []).join(' ').toLowerCase();
    return (!q || txt.includes(q)) && (!df || doms.includes(df.toLowerCase()));
  });
  var el = g('mentorsGrid'); if (!el) return;
  var isAdmin = currentUser && currentUser.role === 'admin';

  if (!list.length) { el.innerHTML = '<p class="empty-msg">No mentors yet.' + (isAdmin ? ' Add the first mentor!' : '') + '</p>'; return; }

  el.innerHTML = list.map(function (m) {
    var ini = (m.name || 'M').split(' ').map(function (w) { return w[0]; }).join('').toUpperCase().slice(0, 2);
    var col = avColor(m.name || '');
    var delBtn = isAdmin ? '<button class="icon-btn del-btn" title="Delete mentor" onclick="deleteMentor(\'' + m.id + '\',\'' + (m.name || '').replace(/'/g, '') + '\')">🗑️</button>' : '';
    return '<div class="mentor-card">' +
      '<div class="mc-top">' +
        '<div class="mc-av" style="background:' + col + '">' + ini + '</div>' +
        '<div class="mc-info"><div class="mc-name">' + (m.name || '—') + '</div><div class="mc-role">' + (m.role || '—') + ' · ' + (m.company || '—') + '</div></div>' +
        '<div>' + delBtn + '</div>' +
      '</div>' +
      '<div class="mc-domains">' + (m.domains || []).map(function (d) { return '<span class="domain-chip">' + d + '</span>'; }).join('') + '</div>' +
      '<div class="mc-footer">' +
        '<span class="avail-' + (m.available ? 'yes' : 'no') + '">● ' + (m.available ? 'Available' : 'Busy') + '</span>' +
        '<button class="btn btn-sm btn-primary" onclick="requestMentorByName(\'' + (m.name || '').replace(/'/g, '') + '\')">Request</button>' +
      '</div></div>';
  }).join('');
}

function filterMentors() { renderMentors(); }

function addMentor() {
  var name = v('mrName'), email = v('mrEmail'), company = v('mrCompany'), role = v('mrRole'), domains = v('mrDomains');
  if (!name)    { showToast('Enter Full Name', 'error'); return; }
  if (!email)   { showToast('Enter Email', 'error'); return; }
  if (!company) { showToast('Enter Company', 'error'); return; }
  if (!role)    { showToast('Enter Role', 'error'); return; }
  if (!domains) { showToast('Enter at least one Domain', 'error'); return; }
  var data = {
    name: name, email: email, company: company, role: role,
    domains:   domains.split(',').map(function (d) { return d.trim(); }).filter(Boolean),
    exp:       parseInt(v('mrExp')) || 0,
    available: v('mrAvail') !== 'false',
    bio:       v('mrBio'),
    addedBy:   currentUser ? currentUser.email : 'admin',
    createdAt: ts()
  };
  showToast('Adding mentor...', 'info');
  fbDB.collection('mentors').add(data)
    .then(function () {
      closeModal('mentorRegModal');
      ['mrName','mrEmail','mrCompany','mrRole','mrDomains','mrExp','mrBio'].forEach(function (id) { if (g(id)) g(id).value = ''; });
      showToast(name + ' added as mentor! 🎓', 'success');
      pushActivity('🎓', 'Mentor added: ' + name);
    })
    .catch(function (e) { showToast('Error: ' + e.message, 'error'); });
}

function deleteMentor(id, name) {
  confirmDelete('Delete mentor "' + name + '"?', function () {
    fbDB.collection('mentors').doc(id).delete()
      .then(function () { showToast('Mentor deleted', 'success'); pushActivity('🗑️', 'Mentor deleted: ' + name); })
      .catch(function (e) { showToast('Error: ' + e.message, 'error'); });
  });
}

function requestMentorByName(name) {
  fbDB.collection('menteeRequests').add({
    mentorName: name, requestedBy: currentUser ? currentUser.email : 'guest',
    goal: '', createdAt: ts()
  }).then(function () {
    showToast('Mentorship request sent to ' + name + '! 🤝', 'success');
    pushActivity('🤝', 'Mentorship request sent to ' + name);
  }).catch(function (e) { showToast('Error: ' + e.message, 'error'); });
}

function requestMentorship() {
  var goal = v('mrGoal');
  fbDB.collection('menteeRequests').add({
    requestedBy: currentUser ? currentUser.email : 'guest',
    goal: goal, createdAt: ts()
  }).then(function () {
    closeModal('menteeRequestModal');
    if (g('mrGoal')) g('mrGoal').value = '';
    showToast('Mentorship request submitted! 🤝', 'success');
  }).catch(function (e) { showToast('Error: ' + e.message, 'error'); });
}

// ── JOBS ─────────────────────────────────────────────────────────
function renderJobs() {
  var q    = (v('jobSearch') || '').toLowerCase();
  var type = v('jobTypeF') || '';
  var loc  = v('jobLocF')  || '';
  var list = jobsData.filter(function (j) {
    var txt = ((j.title || '') + ' ' + (j.company || '')).toLowerCase();
    return (!q || txt.includes(q)) && (!type || j.type === type) && (!loc || (j.location || '').includes(loc));
  });
  var el = g('jobsList'); if (!el) return;
  var isAdmin = currentUser && currentUser.role === 'admin';
  var typeClass = { 'Full-time': 'tj-full', 'Internship': 'tj-intern', 'Part-time': 'tj-part', 'Contract': 'tj-contract' };

  if (!list.length) { el.innerHTML = '<p class="empty-msg">No jobs posted yet.</p>'; return; }

  el.innerHTML = list.map(function (j) {
    var ini = (j.company || 'CO').slice(0, 2).toUpperCase();
    var col = avColor(j.company || '');
    var canDel = isAdmin || (currentUser && j.postedBy === currentUser.email);
    var delBtn = canDel ? '<button class="icon-btn del-btn" title="Delete" onclick="deleteJob(\'' + j.id + '\',\'' + (j.title||'').replace(/'/g,'') + '\')">🗑️</button>' : '';
    return '<div class="job-card">' +
      '<div class="jc-logo" style="background:' + col + '">' + ini + '</div>' +
      '<div class="jc-body">' +
        '<div class="jc-top"><div><div class="jc-title">' + (j.title || '—') + '</div><div class="jc-company">' + (j.company || '—') + '</div></div>' +
        '<div style="display:flex;gap:.5rem;align-items:center"><span class="jtype ' + (typeClass[j.type] || '') + '">' + (j.type || '—') + '</span>' + delBtn + '</div></div>' +
        '<div class="jc-meta">📍 ' + (j.location || '—') + ' &nbsp;|&nbsp; 💰 ' + (j.salary || 'Negotiable') + ' &nbsp;|&nbsp; 📅 Apply by ' + (j.deadline || 'Open') + '</div>' +
        '<div class="jc-footer">' +
          '<span style="font-size:.78rem;color:var(--muted)">Posted ' + (j.postedBy || '—') + '</span>' +
          '<button class="btn btn-sm btn-primary" onclick="applyJob(\'' + (j.title||'').replace(/'/g,'') + '\',\'' + (j.company||'').replace(/'/g,'') + '\')">Apply Now</button>' +
        '</div>' +
      '</div></div>';
  }).join('');
}

function filterJobs() { renderJobs(); }

function postJob() {
  var title = v('jTitle'), company = v('jCompany');
  if (!title)   { showToast('Enter Job Title', 'error'); return; }
  if (!company) { showToast('Enter Company Name', 'error'); return; }
  var data = {
    title: title, company: company, type: v('jType') || 'Full-time',
    location: v('jLocation'), salary: v('jSalary'),
    deadline: v('jDeadline'), desc: v('jDesc'), applyLink: v('jLink'),
    postedBy: currentUser ? currentUser.email : 'guest', createdAt: ts()
  };
  showToast('Posting job...', 'info');
  fbDB.collection('jobs').add(data)
    .then(function () {
      closeModal('postJobModal');
      ['jTitle','jCompany','jLocation','jSalary','jDeadline','jDesc','jLink'].forEach(function (id) { if (g(id)) g(id).value = ''; });
      showToast('"' + title + '" posted! 💼', 'success');
      pushActivity('💼', 'Job posted: ' + title + ' @ ' + company);
    })
    .catch(function (e) { showToast('Error: ' + e.message, 'error'); });
}

function deleteJob(id, title) {
  confirmDelete('Delete job "' + title + '"?', function () {
    fbDB.collection('jobs').doc(id).delete()
      .then(function () { showToast('Job deleted', 'success'); pushActivity('🗑️', 'Job deleted: ' + title); })
      .catch(function (e) { showToast('Error: ' + e.message, 'error'); });
  });
}

function applyJob(title, company) {
  fbDB.collection('applications').add({
    jobTitle: title, company: company,
    appliedBy: currentUser ? currentUser.email : 'guest', createdAt: ts()
  }).then(function () {
    showToast('Applied for "' + title + '" at ' + company + '! 🎉', 'success');
    pushActivity('💼', 'Applied for ' + title + ' at ' + company);
  }).catch(function (e) { showToast('Error: ' + e.message, 'error'); });
}

// ── CAMPAIGNS ────────────────────────────────────────────────────
function renderCampaigns() {
  var el = g('campaignsGrid'); if (!el) return;
  var isAdmin = currentUser && currentUser.role === 'admin';

  if (!campaignsData.length) { el.innerHTML = '<p class="empty-msg">No campaigns yet.' + (isAdmin ? ' Create one!' : '') + '</p>'; return; }

  el.innerHTML = campaignsData.map(function (c) {
    var pct  = Math.round(Math.min((c.raised || 0) / (c.target || 1) * 100, 100));
    var delBtn = isAdmin ? '<button class="icon-btn del-btn" title="Delete campaign" onclick="deleteCampaign(\'' + c.id + '\',\'' + (c.title||'').replace(/'/g,'') + '\')">🗑️</button>' : '';
    return '<div class="camp-card">' +
      '<div class="cc-hdr"><div style="display:flex;align-items:center;gap:.75rem">' +
        '<div class="cc-ico">' + (c.icon || '🎯') + '</div>' +
        '<div><div class="cc-title">' + (c.title || '—') + '</div>' +
          '<div class="cc-desc">' + (c.desc || '') + '</div></div></div>' +
        delBtn + '</div>' +
      '<div class="cc-amt"><span class="cc-raised">₹' + (c.raised || 0).toLocaleString() + '</span><span class="cc-goal"> of ₹' + (c.target || 0).toLocaleString() + '</span></div>' +
      '<div class="cc-bar"><div class="cc-fill" style="width:' + pct + '%"></div></div>' +
      '<div class="cc-footer"><span>👥 ' + (c.donors || 0) + ' donors · ' + pct + '%</span>' +
        '<button class="btn btn-sm btn-primary" onclick="showModal(\'donationModal\')">Donate</button>' +
      '</div></div>';
  }).join('');
}

function createCampaign() {
  var title  = v('cTitle');
  var target = parseInt(v('cTarget'));
  if (!title)         { showToast('Enter Campaign Title', 'error'); return; }
  if (!target || target < 1) { showToast('Enter a valid Target Amount', 'error'); return; }
  var data = {
    title: title, icon: v('cIcon') || '🎯', desc: v('cDesc'),
    target: target, raised: 0, donors: 0,
    endDate: v('cEndDate'),
    createdBy: currentUser ? currentUser.email : 'admin', createdAt: ts()
  };
  showToast('Creating campaign...', 'info');
  fbDB.collection('campaigns').add(data)
    .then(function () {
      closeModal('newCampaignModal');
      ['cTitle','cTarget','cEndDate','cIcon','cDesc'].forEach(function (id) { if (g(id)) g(id).value = ''; });
      showToast('"' + title + '" campaign launched! 🎯', 'success');
      pushActivity('🎯', 'Campaign created: ' + title);
    })
    .catch(function (e) { showToast('Error: ' + e.message, 'error'); });
}

function deleteCampaign(id, title) {
  confirmDelete('Delete campaign "' + title + '"? All related data remains.', function () {
    fbDB.collection('campaigns').doc(id).delete()
      .then(function () { showToast('Campaign deleted', 'success'); pushActivity('🗑️', 'Campaign deleted: ' + title); })
      .catch(function (e) { showToast('Error: ' + e.message, 'error'); });
  });
}

// ── DONATIONS ────────────────────────────────────────────────────
function renderDonations() {
  var el = g('donorsTable'); if (!el) return;
  var isAdmin = currentUser && currentUser.role === 'admin';

  if (!donationsData.length) { el.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:1.5rem">No donations yet</td></tr>'; return; }

  el.innerHTML = donationsData.map(function (d) {
    var delBtn = isAdmin ? '<td class="admin-only"><button class="icon-btn del-btn" onclick="deleteDonation(\'' + d.id + '\',\'' + (d.name||'').replace(/'/g,'') + '\')">🗑️</button></td>' : '<td></td>';
    return '<tr><td><strong>' + (d.name || 'Anonymous') + '</strong></td>' +
      '<td>' + (d.campaignTitle || '—') + '</td>' +
      '<td><strong>₹' + (d.amount || 0).toLocaleString() + '</strong></td>' +
      '<td>' + (d.date || '—') + '</td>' +
      '<td style="font-size:.82rem;color:var(--muted)">' + (d.message || '—') + '</td>' +
      delBtn + '</tr>';
  }).join('');
  applyRoleUI();
}

function makeDonation() {
  var campaignId = g('dCampaign') ? g('dCampaign').value : '';
  var amount     = parseInt(v('donAmt'));
  if (!campaignId || campaignId === 'No campaigns yet') { showToast('Select a campaign first', 'error'); return; }
  if (!amount || amount < 1) { showToast('Enter a valid amount', 'error'); return; }
  var anon = g('anonChk') && g('anonChk').checked;
  var camp = campaignsData.find(function (c) { return c.id === campaignId; });
  var name = anon ? 'Anonymous' : (currentUser ? currentUser.firstName + ' ' + currentUser.lastName : 'Guest');
  var data = {
    name: name, amount: amount,
    campaignId: campaignId, campaignTitle: camp ? camp.title : '—',
    message:   v('donMsg'), anonymous: anon,
    donatedBy: currentUser ? currentUser.email : 'guest',
    date:      new Date().toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }),
    createdAt: ts()
  };
  showToast('Processing donation...', 'info');
  var batch = fbDB.batch();
  var donRef = fbDB.collection('donations').doc();
  batch.set(donRef, data);
  if (camp) {
    var campRef = fbDB.collection('campaigns').doc(campaignId);
    batch.update(campRef, { raised: (camp.raised || 0) + amount, donors: (camp.donors || 0) + 1 });
  }
  batch.commit()
    .then(function () {
      closeModal('donationModal');
      if (g('donAmt'))  g('donAmt').value  = '2500';
      if (g('donMsg'))  g('donMsg').value  = '';
      if (g('anonChk')) g('anonChk').checked = false;
      showToast('Thank you for donating ₹' + amount.toLocaleString() + '! 💰', 'success');
      pushActivity('💰', name + ' donated ₹' + amount.toLocaleString() + (camp ? ' to ' + camp.title : ''));
    })
    .catch(function (e) { showToast('Error: ' + e.message, 'error'); });
}

function pickAmt(val, btn) {
  document.querySelectorAll('.amt-btn').forEach(function (b) { b.classList.remove('active'); });
  btn.classList.add('active');
  if (g('donAmt')) g('donAmt').value = val;
}

function deleteDonation(id, name) {
  confirmDelete('Delete donation record from "' + name + '"?', function () {
    fbDB.collection('donations').doc(id).delete()
      .then(function () { showToast('Donation record deleted', 'success'); })
      .catch(function (e) { showToast('Error: ' + e.message, 'error'); });
  });
}

// ── BROADCAST ────────────────────────────────────────────────────
function sendBroadcast() {
  var sub = v('bSubject'), msg = v('bMessage');
  if (!sub) { showToast('Enter Subject', 'error'); return; }
  if (!msg) { showToast('Enter Message', 'error'); return; }
  fbDB.collection('broadcasts').add({
    subject: sub, message: msg, recipients: v('bRecip'),
    sentBy: currentUser ? currentUser.email : 'admin', sentAt: ts()
  }).then(function () {
    closeModal('broadcastModal');
    if (g('bSubject')) g('bSubject').value = '';
    if (g('bMessage')) g('bMessage').value = '';
    showToast('Broadcast sent! 📢', 'success');
    pushActivity('📢', 'Broadcast: ' + sub);
  }).catch(function (e) { showToast('Error: ' + e.message, 'error'); });
}

// ── EXPORT CSV ───────────────────────────────────────────────────
function exportCSV() {
  if (!alumniData.length) { showToast('No alumni data to export', 'warning'); return; }
  var hdrs = ['First Name','Last Name','Email','Phone','Batch','Department','Company','Designation','City','Industry','Status'];
  var rows = alumniData.map(function (a) {
    return [a.firstName, a.lastName, a.email, a.phone, a.batch, a.dept, a.company, a.desig, a.city, a.industry, a.status]
      .map(function (f) { return '"' + (f || '') + '"'; }).join(',');
  });
  var csv  = [hdrs.join(',')].concat(rows).join('\n');
  var blob = new Blob([csv], { type: 'text/csv' });
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement('a'); a.href = url; a.download = 'alumni_export.csv'; a.click();
  URL.revokeObjectURL(url);
  showToast('Alumni data exported! ↓', 'success');
}

// ── PROFILE / SETTINGS ───────────────────────────────────────────
function loadProfile() {
  if (!currentUser) return;
  var fs = function (id, val) { if (g(id)) g(id).value = val || ''; };
  fs('sFirstName', currentUser.firstName); fs('sLastName', currentUser.lastName);
  fs('sEmail', currentUser.email); fs('sPhone', currentUser.phone);
  fs('sCompany', currentUser.company); fs('sDesig', currentUser.desig);
  fs('sCity', currentUser.city); fs('sLinkedin', currentUser.linkedin);
  fs('sBio', currentUser.bio);
}

function saveProfile() {
  var fn = v('sFirstName'), ln = v('sLastName');
  if (!fn) { showToast('First name cannot be empty', 'error'); return; }
  if (!ln) { showToast('Last name cannot be empty',  'error'); return; }
  currentUser.firstName = fn; currentUser.lastName  = ln;
  currentUser.phone    = v('sPhone');   currentUser.company = v('sCompany');
  currentUser.desig    = v('sDesig');   currentUser.city    = v('sCity');
  currentUser.linkedin = v('sLinkedin'); currentUser.bio    = v('sBio');
  showToast('Saving...', 'info');
  var fbUser = fbAuth.currentUser;
  if (fbUser) {
    fbDB.collection('users').doc(fbUser.uid).set({
      firstName: fn, lastName: ln, phone: currentUser.phone,
      company: currentUser.company, desig: currentUser.desig,
      city: currentUser.city, linkedin: currentUser.linkedin,
      bio: currentUser.bio, role: currentUser.role, email: currentUser.email,
      updatedAt: new Date().toISOString()
    }, { merge: true })
      .then(function ()  { updateNav(); showToast('Profile saved! ✅', 'success'); })
      .catch(function (e) { showToast('Error: ' + e.message, 'error'); });
  } else {
    updateNav(); showToast('Profile updated locally', 'success');
  }
}

function savePassword() {
  var curr = v('currPass'), np = v('newPass'), cp = v('confPass');
  if (!curr) { showToast('Enter current password', 'error'); return; }
  if (np.length < 6) { showToast('New password must be at least 6 characters', 'error'); return; }
  if (np !== cp)  { showToast('Passwords do not match', 'error'); return; }
  var fbUser = fbAuth.currentUser;
  if (fbUser && np) {
    fbUser.updatePassword(np)
      .then(function () { showToast('Password updated! 🔒', 'success'); ['currPass','newPass','confPass'].forEach(function (id) { if (g(id)) g(id).value = ''; }); })
      .catch(function (e) { showToast('Error: ' + e.message, 'error'); });
  } else {
    showToast('Not signed in via Firebase', 'warning');
  }
}

function saveInstitution() {
  var name = v('instName');
  if (!name) { showToast('Institution name cannot be empty', 'error'); return; }
  fbDB.collection('settings').doc('institution').set({
    name: name, city: v('instCity'), state: v('instState'), website: v('instWeb'),
    updatedAt: new Date().toISOString()
  }, { merge: true })
    .then(function ()  { showToast('Institution settings saved! 🏛️', 'success'); })
    .catch(function () { showToast('Saved locally', 'success'); });
}

function showStab(tab, el) {
  document.querySelectorAll('.stab').forEach(function (t) { t.classList.remove('active'); });
  document.querySelectorAll('.snav').forEach(function (l) { l.classList.remove('active'); });
  var t = g('st-' + tab); if (t) t.classList.add('active');
  el.classList.add('active');
}

// ── NOTIFICATIONS ─────────────────────────────────────────────────
function renderNotifications() {
  var el = g('notifList'); if (!el) return;
  if (!notifications.length) { el.innerHTML = '<p class="empty-msg" style="padding:2rem">No notifications yet</p>'; return; }
  el.innerHTML = notifications.map(function (n) {
    return '<div class="notif-row' + (n.read ? '' : ' unread') + '" onclick="markRead(' + n.id + ')">' +
      '<div class="notif-ico">' + n.ico + '</div>' +
      '<div><div class="notif-text">' + n.text + '</div><div class="notif-time">' + n.time + '</div></div>' +
      (!n.read ? '<div class="unread-dot"></div>' : '') + '</div>';
  }).join('');
}

function markRead(id) {
  var n = notifications.find(function (x) { return x.id === id; }); if (n) n.read = true;
  renderNotifications();
}
function markAllRead() { notifications.forEach(function (n) { n.read = true; }); renderNotifications(); showToast('All read', 'success'); }
