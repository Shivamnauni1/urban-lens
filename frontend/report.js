const API = 'http://localhost:5000/api';

// ── Auth guard ────────────────────────────────────────────
const token = localStorage.getItem('ul_token');
const user  = JSON.parse(localStorage.getItem('ul_user') || 'null');

if (!token || !user) {
  window.location.href = 'index.html';
}

// Only citizens can submit reports
if (user && user.role !== 'user') {
  alert('Only citizens can submit reports.');
  window.location.href = 'index.html';
}

// ── Navbar ────────────────────────────────────────────────
document.getElementById('nav-user').textContent = `Hi, ${user.username}`;
const badge = document.getElementById('nav-role-badge');
badge.textContent = 'Citizen';
badge.className = 'role-badge user';

document.getElementById('logout-btn').addEventListener('click', () => {
  localStorage.removeItem('ul_token');
  localStorage.removeItem('ul_user');
  window.location.href = 'index.html';
});

// ── Image preview ─────────────────────────────────────────
document.getElementById('image-input').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const preview = document.getElementById('image-preview');
  const placeholder = document.getElementById('upload-placeholder');

  const reader = new FileReader();
  reader.onload = (ev) => {
    preview.src = ev.target.result;
    preview.style.display = 'block';
    placeholder.style.display = 'none';
  };
  reader.readAsDataURL(file);
});

// ── GPS ───────────────────────────────────────────────────
document.getElementById('get-location-btn').addEventListener('click', () => {
  const btn = document.getElementById('get-location-btn');
  const status = document.getElementById('gps-status');

  if (!navigator.geolocation) {
    status.textContent = 'Geolocation is not supported by your browser.';
    status.className = 'gps-status err';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Fetching...';
  status.textContent = 'Getting your location...';
  status.className = 'gps-status';

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      document.getElementById('latitude').value  = pos.coords.latitude.toFixed(6);
      document.getElementById('longitude').value = pos.coords.longitude.toFixed(6);
      status.textContent = `✓ Location captured (accuracy: ±${Math.round(pos.coords.accuracy)}m)`;
      status.className = 'gps-status ok';
      btn.textContent = '📍 Update Location';
      btn.disabled = false;
    },
    (err) => {
      const msgs = {
        1: 'Location permission denied. Please allow location access.',
        2: 'Location unavailable. Try again.',
        3: 'Location request timed out. Try again.'
      };
      status.textContent = msgs[err.code] || 'Could not get location.';
      status.className = 'gps-status err';
      btn.textContent = '📍 Get My Location';
      btn.disabled = false;
    },
    { timeout: 10000, enableHighAccuracy: true }
  );
});

// ── Helpers ───────────────────────────────────────────────
function showMsg(text, type = 'error') {
  const el = document.getElementById('report-msg');
  el.textContent = text;
  el.className = `msg ${type}`;
  el.style.display = 'block';
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ── Form submit ───────────────────────────────────────────
document.getElementById('report-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const btn = document.getElementById('submit-btn');
  const imageFile = document.getElementById('image-input').files[0];
  const latitude  = document.getElementById('latitude').value;
  const longitude = document.getElementById('longitude').value;
  const description = document.getElementById('description').value.trim();

  if (!imageFile) {
    showMsg('Please select an image.');
    return;
  }
  if (!latitude || !longitude) {
    showMsg('Please get your GPS location first.');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Submitting...';

  const formData = new FormData();
  formData.append('image', imageFile);
  formData.append('latitude', latitude);
  formData.append('longitude', longitude);
  formData.append('description', description);

  try {
    const res = await fetch(`${API}/reports`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });

    const data = await res.json();

    if (!res.ok) {
      showMsg(data.message || 'Submission failed.');
      return;
    }

    showMsg('Report submitted successfully! It will be verified shortly.', 'success');
    document.getElementById('report-form').reset();
    document.getElementById('image-preview').style.display = 'none';
    document.getElementById('upload-placeholder').style.display = 'block';
    document.getElementById('gps-status').textContent = '';
  } catch {
    showMsg('Cannot reach server. Make sure the backend is running.');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Submit Report';
  }
});

// ── Manual GPS input ──────────────────────────────────────
document.getElementById('show-manual-gps').addEventListener('click', (e) => {
  e.preventDefault();
  const inputs = document.getElementById('manual-gps-inputs');
  const isHidden = inputs.style.display === 'none';
  inputs.style.display = isHidden ? 'block' : 'none';
  e.target.textContent = isHidden ? 'Hide manual input' : 'Enter coordinates manually instead';
});

document.getElementById('apply-manual-gps-btn').addEventListener('click', () => {
  const lat = parseFloat(document.getElementById('manual-report-lat').value);
  const lng = parseFloat(document.getElementById('manual-report-lng').value);
  const status = document.getElementById('gps-status');

  if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    status.textContent = '⚠️ Enter valid latitude (-90 to 90) and longitude (-180 to 180).';
    status.className = 'gps-status err';
    return;
  }

  // Set the readonly fields used by the form submit
  document.getElementById('latitude').value  = lat.toFixed(6);
  document.getElementById('longitude').value = lng.toFixed(6);
  status.textContent = `✓ Manual coordinates set (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
  status.className = 'gps-status ok';
});
