const API = 'http://localhost:5000/api';

// ── Helpers ──────────────────────────────────────────────
function showMsg(text, type = 'error') {
  const el = document.getElementById('auth-msg');
  el.textContent = text;
  el.className = `msg ${type}`;
  el.style.display = 'block';
}

function clearMsg() {
  const el = document.getElementById('auth-msg');
  el.style.display = 'none';
  el.textContent = '';
}

function setBtnLoading(btn, loading, defaultText) {
  btn.disabled = loading;
  btn.textContent = loading ? 'Please wait...' : defaultText;
}

// ── View switching ────────────────────────────────────────
function showLoginView() {
  document.getElementById('login-view').style.display = 'block';
  document.getElementById('register-view').style.display = 'none';
  clearMsg();
}

function showRegisterView() {
  document.getElementById('login-view').style.display = 'none';
  document.getElementById('register-view').style.display = 'block';
  clearMsg();
}

function showDashboard(user) {
  document.getElementById('auth-section').style.display = 'none';
  document.getElementById('dashboard-section').style.display = 'block';

  document.getElementById('nav-user').textContent = `Hi, ${user.username}`;

  const badge = document.getElementById('nav-role-badge');
  const roleLabels = { user: 'Citizen', admin: 'Admin', ward_authority: 'Ward Authority' };
  badge.textContent = roleLabels[user.role] || user.role;
  badge.className = `role-badge ${user.role}`;

  document.getElementById('dashboard-greeting').textContent = `Welcome, ${user.username}`;
  document.getElementById('dashboard-subtitle').textContent =
    user.role === 'ward_authority' && user.wardName
      ? `${user.wardName}${user.city ? ', ' + user.city : ''} — ${getDashboardSubtitle(user.role)}`
      : getDashboardSubtitle(user.role);

  renderCards(user.role);
}

function showAuthSection() {
  document.getElementById('dashboard-section').style.display = 'none';
  document.getElementById('auth-section').style.display = 'flex';
  showLoginView();
}

// ── Dashboard content per role ────────────────────────────
function getDashboardSubtitle(role) {
  const map = {
    user: 'Report road damage and track your complaints.',
    admin: 'Manage the platform, users, and all reports.',
    ward_authority: 'Review damage zones in your ward and manage repairs.'
  };
  return map[role] || '';
}

function renderCards(role) {
  const cardsByRole = {
    user: [
      { title: '📸 Submit Report', desc: 'Upload a photo of road damage with your GPS location.', link: 'report.html' },
      { title: '📋 My Reports', desc: 'Track the status of all your submitted reports.', link: 'my-reports.html' },
      { title: '🗺️ City Heatmap', desc: 'View road damage hotspots across the city.', link: 'heatmap.html' },
      { title: '📊 Ward Analytics', desc: 'Compare infrastructure health across wards.', link: 'analytics.html' }
    ],
    ward_authority: [
      { title: '🗂️ Damage Zones', desc: 'View and manage clustered damage zones in your ward.', link: 'authority.html' },
      { title: '🔧 Repair Tracking', desc: 'Log repair actions and update zone statuses.', link: 'authority.html' },
      { title: '📊 Ward Analytics', desc: 'Compare infrastructure health across wards.', link: 'analytics.html' }
    ],
    admin: [
      { title: '👥 All Users', desc: 'View and manage all registered users.', link: '#' },
      { title: '📁 All Reports', desc: 'Browse every submitted report across the city.', link: 'authority.html' },
      { title: '⚙️ System Config', desc: 'Configure ranking weights and system settings.', link: '#' },
      { title: '📊 Ward Analytics', desc: 'Compare infrastructure health across wards.', link: 'analytics.html' }
    ]
  };

  const grid = document.getElementById('dashboard-cards');
  grid.innerHTML = '';
  (cardsByRole[role] || []).forEach(({ title, desc, link }) => {
    const card = document.createElement('div');
    card.className = 'card' + (link && link !== '#' ? ' card-link' : '');
    card.innerHTML = `<h3>${title}</h3><p>${desc}</p>`;
    if (link && link !== '#') card.addEventListener('click', () => window.location.href = link);
    grid.appendChild(card);
  });
}

// ── Auth API calls ────────────────────────────────────────
async function handleLogin(e) {
  e.preventDefault();
  clearMsg();
  const btn = document.getElementById('login-btn');
  setBtnLoading(btn, true, 'Sign In');

  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;

  try {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();

    if (!res.ok) {
      showMsg(data.message || 'Login failed');
      return;
    }

    localStorage.setItem('ul_token', data.token);
  localStorage.setItem('ul_user', JSON.stringify({ _id: data._id, username: data.username, role: data.role, wardName: data.wardName || null, city: data.city || null }));
    showDashboard(data);
  } catch {
    showMsg('Cannot reach server. Make sure the backend is running on port 5000.');
  } finally {
    setBtnLoading(btn, false, 'Sign In');
  }
}

async function handleRegister(e) {
  e.preventDefault();
  clearMsg();
  const btn = document.getElementById('register-btn');
  setBtnLoading(btn, true, 'Create Account');

  const username = document.getElementById('reg-username').value.trim();
  const password = document.getElementById('reg-password').value;
  const role     = document.getElementById('reg-role').value;
  const wardName = document.getElementById('reg-ward-name')?.value.trim();
  const city     = document.getElementById('reg-city')?.value.trim();

  if (role === 'ward_authority' && (!wardName || !city)) {
    showMsg('Please enter your ward name and city.');
    setBtnLoading(btn, false, 'Create Account');
    return;
  }

  try {
    const body = { username, password, role };
    if (role === 'ward_authority') { body.wardName = wardName; body.city = city; }

    const res = await fetch(`${API}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();

    if (!res.ok) {
      showMsg(data.message || 'Registration failed');
      return;
    }

    showMsg('Account created! You can now sign in.', 'success');
    document.getElementById('register-form').reset();
    setTimeout(showLoginView, 1500);
  } catch {
    showMsg('Cannot reach server. Make sure the backend is running on port 5000.');
  } finally {
    setBtnLoading(btn, false, 'Create Account');
  }
}

function handleLogout() {
  localStorage.removeItem('ul_token');
  localStorage.removeItem('ul_user');
  showAuthSection();
}

// ── Token validation on load ──────────────────────────────
async function initApp() {
  const token = localStorage.getItem('ul_token');
  const userStr = localStorage.getItem('ul_user');

  if (!token || !userStr) {
    showLoginView();
    return;
  }

  try {
    const res = await fetch(`${API}/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (res.ok) {
      const user = await res.json();
      // Update stored user with fresh data from server
      localStorage.setItem('ul_user', JSON.stringify(user));
      showDashboard(user);
    } else {
      // Token expired or invalid
      localStorage.removeItem('ul_token');
      localStorage.removeItem('ul_user');
      showLoginView();
    }
  } catch {
    // Backend unreachable — use cached user data
    showDashboard(JSON.parse(userStr));
  }
}

// ── Event listeners ───────────────────────────────────────
document.getElementById('login-form').addEventListener('submit', handleLogin);
document.getElementById('register-form').addEventListener('submit', handleRegister);
document.getElementById('logout-btn').addEventListener('click', handleLogout);
document.getElementById('go-register').addEventListener('click', (e) => { e.preventDefault(); showRegisterView(); });
document.getElementById('go-login').addEventListener('click', (e) => { e.preventDefault(); showLoginView(); });

// Show/hide ward field
document.getElementById('reg-role').addEventListener('change', (e) => {
  document.getElementById('ward-field').style.display =
    e.target.value === 'ward_authority' ? 'block' : 'none';
});

// Shared: fill ward name + city fields from Nominatim response
async function lookupAndFill(lat, lng) {
  const result = document.getElementById('ward-result');
  result.style.display = 'none';
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { 'Accept-Language': 'en' } }
    );
    const data = await res.json();
    const addr = data.address || {};

    const ward =
      addr.quarter || addr.suburb || addr.neighbourhood || addr.residential ||
      addr.hamlet  || addr.village || addr.town || addr.road || addr.city ||
      addr.city_district || addr.district || addr.county || addr.state_district || '';

    const city =
      addr.city || addr.city_district || addr.district ||
      addr.county || addr.state_district || '';

    if (ward) document.getElementById('reg-ward-name').value = ward;
    if (city) document.getElementById('reg-city').value = city;

    result.textContent = `📍 Filled: ${ward}${city ? ', ' + city : ''}`;
    result.className = 'ward-result';
    result.style.display = 'block';
  } catch {
    result.textContent = `📍 Coordinates set. Please fill ward name manually.`;
    result.className = 'ward-result';
    result.style.display = 'block';
  }
}

// Toggle GPS detect section
document.getElementById('show-gps-detect').addEventListener('click', (e) => {
  e.preventDefault();
  const sec = document.getElementById('gps-detect-section');
  const hidden = sec.style.display === 'none';
  sec.style.display = hidden ? 'block' : 'none';
  e.target.textContent = hidden ? 'Hide GPS detection' : 'Or auto-detect from GPS instead';
});

// GPS detect button
document.getElementById('detect-ward-btn').addEventListener('click', () => {
  const btn = document.getElementById('detect-ward-btn');
  if (!navigator.geolocation) {
    document.getElementById('ward-result').textContent = 'Geolocation not supported.';
    document.getElementById('ward-result').style.display = 'block';
    return;
  }
  btn.disabled = true;
  btn.textContent = 'Detecting...';
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      document.getElementById('reg-lat').value = pos.coords.latitude;
      document.getElementById('reg-lng').value = pos.coords.longitude;
      await lookupAndFill(pos.coords.latitude, pos.coords.longitude);
      btn.textContent = '📍 Re-detect';
      btn.disabled = false;
    },
    (err) => {
      const msgs = { 1: 'Permission denied.', 2: 'Unavailable.', 3: 'Timed out.' };
      const r = document.getElementById('ward-result');
      r.textContent = msgs[err.code] || 'Could not get location.';
      r.className = 'ward-result ward-error';
      r.style.display = 'block';
      btn.textContent = '📍 Detect My Location';
      btn.disabled = false;
    },
    { timeout: 10000, enableHighAccuracy: true }
  );
});

// Toggle manual coords
document.getElementById('show-manual-coords').addEventListener('click', (e) => {
  e.preventDefault();
  const inputs = document.getElementById('manual-coords-inputs');
  const hidden = inputs.style.display === 'none';
  inputs.style.display = hidden ? 'block' : 'none';
  e.target.textContent = hidden ? 'Hide manual coordinates' : 'Or enter coordinates manually';
});

// Manual lookup
document.getElementById('lookup-manual-btn').addEventListener('click', async () => {
  const lat = parseFloat(document.getElementById('manual-lat').value);
  const lng = parseFloat(document.getElementById('manual-lng').value);
  const btn = document.getElementById('lookup-manual-btn');
  const result = document.getElementById('ward-result');

  if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    result.textContent = '⚠️ Enter valid latitude (-90 to 90) and longitude (-180 to 180).';
    result.className = 'ward-result ward-error';
    result.style.display = 'block';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Looking up...';
  document.getElementById('reg-lat').value = lat;
  document.getElementById('reg-lng').value = lng;
  await lookupAndFill(lat, lng);
  btn.textContent = '🔍 Lookup from Coordinates';
  btn.disabled = false;
});

// Boot
initApp();
