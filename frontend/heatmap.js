const API = 'http://localhost:5000/api';

// ── Auth (heatmap is viewable by all logged-in users) ─────
const token  = localStorage.getItem('ul_token');
const user   = JSON.parse(localStorage.getItem('ul_user') || 'null');

if (!token || !user) window.location.href = 'index.html';

// ── Navbar ────────────────────────────────────────────────
document.getElementById('nav-user').textContent = `Hi, ${user.username}`;
const badge = document.getElementById('nav-role-badge');
const roleLabels = { user: 'Citizen', admin: 'Admin', ward_authority: 'Ward Authority' };
badge.textContent = roleLabels[user.role] || user.role;
badge.className = `role-badge ${user.role}`;

document.getElementById('logout-btn').addEventListener('click', () => {
  localStorage.removeItem('ul_token');
  localStorage.removeItem('ul_user');
  window.location.href = 'index.html';
});

// ── Severity colours for markers ──────────────────────────
const SEVERITY_COLORS = {
  5: '#ff0000',
  4: '#ff6600',
  3: '#ffaa00',
  2: '#ffdd00',
  1: '#00cc44'
};

function makeIcon(severity) {
  const color = SEVERITY_COLORS[severity] || '#888';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="32" viewBox="0 0 24 32">
    <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 20 12 20s12-11 12-20C24 5.4 18.6 0 12 0z"
      fill="${color}" stroke="#fff" stroke-width="1.5"/>
    <circle cx="12" cy="12" r="5" fill="#fff" opacity="0.85"/>
  </svg>`;
  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [24, 32],
    iconAnchor: [12, 32],
    popupAnchor: [0, -34]
  });
}

// ── Map init — default centre: India ─────────────────────
const map = L.map('map', { zoomControl: true }).setView([20.5937, 78.9629], 5);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  maxZoom: 19
}).addTo(map);

// ── State ─────────────────────────────────────────────────
let allReports   = [];
let heatLayer    = null;
let markerGroup  = L.layerGroup().addTo(map);

// ── Render ────────────────────────────────────────────────
function renderMap(reports) {
  // Clear existing layers
  if (heatLayer) map.removeLayer(heatLayer);
  markerGroup.clearLayers();

  const countEl = document.getElementById('report-count');

  if (reports.length === 0) {
    countEl.textContent = '0 reports';
    // Show a message on the map itself
    const noDataDiv = document.getElementById('no-data-msg');
    if (noDataDiv) noDataDiv.style.display = 'flex';
    return;
  }

  const noDataDiv = document.getElementById('no-data-msg');
  if (noDataDiv) noDataDiv.style.display = 'none';

  countEl.textContent = `${reports.length} report${reports.length !== 1 ? 's' : ''}`;

  // Heatmap points: [lat, lng, intensity]
  const heatPoints = reports.map(r => [
    r.location.coordinates[1],
    r.location.coordinates[0],
    (r.severity || 1) / 5
  ]);

  heatLayer = L.heatLayer(heatPoints, {
    radius: 35,
    blur: 25,
    maxZoom: 17,
    gradient: { 0.2: '#00cc44', 0.4: '#ffdd00', 0.6: '#ffaa00', 0.8: '#ff6600', 1.0: '#ff0000' }
  }).addTo(map);

  // Individual markers
  reports.forEach(r => {
    const lat = r.location.coordinates[1];
    const lng = r.location.coordinates[0];
    const marker = L.marker([lat, lng], { icon: makeIcon(r.severity) });
    marker.on('click', () => showPanel(r));
    markerGroup.addLayer(marker);
  });

  // Auto-fit map to data bounds
  const bounds = L.latLngBounds(reports.map(r => [
    r.location.coordinates[1],
    r.location.coordinates[0]
  ]));
  map.fitBounds(bounds, { padding: [60, 60], maxZoom: 14 });
}

// ── Detail panel ──────────────────────────────────────────
function showPanel(r) {
  const panel = document.getElementById('report-panel');
  document.getElementById('panel-type').textContent =
    `${r.damageType || 'Unknown'} — Severity ${r.severity || '?'}/5`;

  const date = new Date(r.createdAt).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric'
  });

  document.getElementById('panel-rows').innerHTML = `
    <div class="panel-row"><strong>Status:</strong> ${r.status}</div>
    <div class="panel-row"><strong>Severity:</strong> ${r.severity || 'N/A'} / 5</div>
    <div class="panel-row"><strong>Coordinates:</strong> ${r.location.coordinates[1].toFixed(4)}, ${r.location.coordinates[0].toFixed(4)}</div>
    <div class="panel-row"><strong>Reported:</strong> ${date}</div>
  `;
  panel.style.display = 'block';
}

document.getElementById('panel-close').addEventListener('click', () => {
  document.getElementById('report-panel').style.display = 'none';
});

// ── Filters ───────────────────────────────────────────────
function applyFilters() {
  const type     = document.getElementById('filter-type').value;
  const severity = document.getElementById('filter-severity').value;

  let filtered = allReports;
  if (type !== 'all')     filtered = filtered.filter(r => r.damageType === type);
  if (severity !== 'all') filtered = filtered.filter(r => r.severity === parseInt(severity));

  renderMap(filtered);
}

document.getElementById('filter-type').addEventListener('change', applyFilters);
document.getElementById('filter-severity').addEventListener('change', applyFilters);

// ── Fetch reports ─────────────────────────────────────────
async function loadMapData() {
  document.getElementById('report-count').textContent = 'Loading...';
  try {
    const res = await fetch(`${API}/reports/map`);
    if (!res.ok) throw new Error('Failed to fetch');
    allReports = await res.json();
    renderMap(allReports);
  } catch {
    document.getElementById('report-count').textContent = 'Failed to load';
  }
}

loadMapData();
