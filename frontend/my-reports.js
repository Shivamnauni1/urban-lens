const API = 'http://localhost:5000/api';
const IMG_BASE = 'http://localhost:5000';

// ── Auth guard ────────────────────────────────────────────
const token = localStorage.getItem('ul_token');
const user  = JSON.parse(localStorage.getItem('ul_user') || 'null');

if (!token || !user) window.location.href = 'index.html';
if (user && user.role !== 'user') window.location.href = 'index.html';

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

// ── Helpers ───────────────────────────────────────────────
function severityDots(severity) {
  if (!severity) return '<span style="color:#aaa;font-size:0.8rem;">Pending</span>';
  let html = '<span class="severity-dots">';
  for (let i = 1; i <= 5; i++) {
    html += `<span class="dot ${i <= severity ? 'filled' : ''}"></span>`;
  }
  return html + '</span>';
}

function statusClass(status) {
  return 'status-' + (status || 'Pending').replace(' ', '-');
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function renderReport(r) {
  const imgSrc = r.imageUrl.startsWith('http') ? r.imageUrl : `${IMG_BASE}${r.imageUrl}`;
  const coords = r.location?.coordinates
    ? `${r.location.coordinates[1].toFixed(4)}, ${r.location.coordinates[0].toFixed(4)}`
    : 'N/A';

  return `
    <div class="report-card">
      <div class="report-img-wrap" data-src="${imgSrc}">
        <img src="${imgSrc}" alt="Report image" loading="lazy" />
      </div>
      <div class="report-info">
        <div class="report-top">
          <span class="report-id">ID: ${r._id}</span>
          <span class="status-badge ${statusClass(r.status)}">${r.status}</span>
        </div>
        <div class="report-meta">
          <div class="meta-item"><strong>Type:</strong> ${r.damageType || 'Evaluating'}</div>
          <div class="meta-item"><strong>Severity:</strong> ${severityDots(r.severity)}</div>
          <div class="meta-item"><strong>Urgency:</strong> ${r.urgencyScore ? r.urgencyScore + '/10' : '—'}</div>
          <div class="meta-item"><strong>Location:</strong> ${coords}</div>
          <div class="meta-item"><strong>Submitted:</strong> ${formatDate(r.createdAt)}</div>
        </div>
        ${r.description ? `<div class="report-desc">${r.description}</div>` : ''}
        <div class="repair-history" id="history-${r._id}">
          <button class="toggle-history-btn" data-id="${r._id}">🔧 View Repair History</button>
          <div class="history-list" id="history-list-${r._id}" style="display:none;"></div>
        </div>
      </div>
    </div>
  `;
}

// ── Image modal ───────────────────────────────────────────
function openModal(src) {
  document.getElementById('modal-img').src = src;
  document.getElementById('img-modal').style.display = 'flex';
}
function closeModal() {
  document.getElementById('img-modal').style.display = 'none';
}
document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('modal-backdrop').addEventListener('click', closeModal);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

// ── Load reports ──────────────────────────────────────────
async function loadReports() {
  try {
    const res = await fetch(`${API}/reports/my`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!res.ok) {
      document.getElementById('loading').textContent = 'Failed to load reports.';
      return;
    }

    const reports = await res.json();
    document.getElementById('loading').style.display = 'none';

    if (reports.length === 0) {
      document.getElementById('empty').style.display = 'block';
      return;
    }

    const list = document.getElementById('reports-list');
    list.style.display = 'block';
    list.innerHTML = reports.map(renderReport).join('');

    // Attach click handlers for image modal
    list.querySelectorAll('.report-img-wrap').forEach(el => {
      el.addEventListener('click', () => openModal(el.dataset.src));
    });

    // Attach repair history toggles
    list.querySelectorAll('.toggle-history-btn').forEach(btn => {
      btn.addEventListener('click', () => toggleHistory(btn.dataset.id, btn));
    });

  } catch {
    document.getElementById('loading').textContent = 'Cannot reach server.';
  }
}

loadReports();

// ── Repair history toggle ─────────────────────────────────
async function toggleHistory(reportId, btn) {
  const listEl = document.getElementById(`history-list-${reportId}`);
  const isOpen = listEl.style.display !== 'none';

  if (isOpen) {
    listEl.style.display = 'none';
    btn.textContent = '🔧 View Repair History';
    return;
  }

  btn.textContent = 'Loading...';
  btn.disabled = true;

  try {
    const res = await fetch(`${API}/repairs/${reportId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const logs = await res.json();

    if (!logs.length) {
      listEl.innerHTML = '<p class="no-history">No repair actions logged yet.</p>';
    } else {
      listEl.innerHTML = logs.map(log => `
        <div class="history-entry">
          <div class="history-top">
            <span class="history-action">${log.action}</span>
            <span class="status-badge ${statusClass(log.newStatus)}">${log.newStatus}</span>
          </div>
          ${log.note ? `<div class="history-note">${log.note}</div>` : ''}
          <div class="history-meta">
            By <strong>${log.authority?.username || 'Authority'}</strong>
            · ${formatDate(log.createdAt)}
          </div>
        </div>
      `).join('');
    }

    listEl.style.display = 'block';
    btn.textContent = '🔧 Hide Repair History';
  } catch {
    listEl.innerHTML = '<p class="no-history">Could not load history.</p>';
    listEl.style.display = 'block';
    btn.textContent = '🔧 View Repair History';
  } finally {
    btn.disabled = false;
  }
}
