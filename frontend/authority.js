const API      = 'http://localhost:5000/api';
const IMG_BASE = 'http://localhost:5000';

// ── Auth guard ────────────────────────────────────────────
const token = localStorage.getItem('ul_token');
const user  = JSON.parse(localStorage.getItem('ul_user') || 'null');

if (!token || !user) window.location.href = 'index.html';
if (user && !['admin', 'ward_authority'].includes(user.role)) window.location.href = 'index.html';

// ── Navbar ────────────────────────────────────────────────
document.getElementById('nav-user').textContent = `Hi, ${user.username}`;
const badge = document.getElementById('nav-role-badge');
badge.textContent = user.role === 'admin' ? 'Admin' : 'Ward Authority';
badge.className   = `role-badge ${user.role}`;

document.getElementById('logout-btn').addEventListener('click', () => {
  localStorage.removeItem('ul_token');
  localStorage.removeItem('ul_user');
  window.location.href = 'index.html';
});

// ── Helpers ───────────────────────────────────────────────
function dots(severity) {
  if (!severity) return '—';
  let h = '<span class="dots">';
  for (let i = 1; i <= 5; i++) h += `<span class="dot ${i <= severity ? 'on' : ''}"></span>`;
  return h + '</span>';
}

function badgeHtml(status) {
  const cls = 'badge badge-' + (status || 'Pending').replace(' ', '-');
  return `<span class="${cls}">${status || 'Pending'}</span>`;
}

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── Stats ─────────────────────────────────────────────────
async function loadStats() {
  try {
    const res = await fetch(`${API}/reports/stats`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) return;
    const s = await res.json();
    document.querySelector('#stat-total   .stat-num').textContent = s.total;
    document.querySelector('#stat-pending  .stat-num').textContent = s.pending;
    document.querySelector('#stat-verified .stat-num').textContent = s.verified;
    document.querySelector('#stat-progress .stat-num').textContent = s.inProgress;
    document.querySelector('#stat-resolved .stat-num').textContent = s.resolved;
  } catch { /* silent */ }
}

// ── Table ─────────────────────────────────────────────────
function renderRow(r) {
  const img = r.imageUrl.startsWith('http') ? r.imageUrl : `${IMG_BASE}${r.imageUrl}`;
  return `
    <tr data-id="${r._id}">
      <td><img class="thumb" src="${img}" data-src="${img}" alt="report" /></td>
      <td>${r.citizen?.username || '—'}</td>
      <td>${r.damageType || 'Evaluating'}</td>
      <td>${dots(r.severity)}</td>
      <td>${r.wardName || '—'}</td>
      <td>${r.city    || '—'}</td>
      <td class="status-cell">${badgeHtml(r.status)}</td>
      <td>${fmtDate(r.createdAt)}</td>
      <td>
        <select class="status-select" data-id="${r._id}" data-current="${r.status}">
          <option value="">Change…</option>
          <option value="Pending">Pending</option>
          <option value="Verified">Verified</option>
          <option value="In Progress">In Progress</option>
          <option value="Resolved">Resolved</option>
          <option value="Rejected">Rejected</option>
        </select>
      </td>
      <td>
        <button class="repair-btn" data-id="${r._id}">🔧 Log</button>
      </td>
    </tr>`;
}

async function loadReports() {
  const status = document.getElementById('filter-status').value;
  const type   = document.getElementById('filter-type').value;
  const ward   = document.getElementById('filter-ward').value.trim();

  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (type)   params.set('type', type);
  if (ward)   params.set('ward', ward);

  document.getElementById('table-loading').style.display = 'block';
  document.getElementById('table-empty').style.display   = 'none';
  document.getElementById('reports-table').style.display = 'none';

  try {
    const res = await fetch(`${API}/reports?${params}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const reports = await res.json();

    document.getElementById('table-loading').style.display = 'none';

    if (!reports.length) {
      document.getElementById('table-empty').style.display = 'block';
      return;
    }

    document.getElementById('reports-tbody').innerHTML = reports.map(renderRow).join('');
    document.getElementById('reports-table').style.display = 'table';

    // Attach image modal clicks
    document.querySelectorAll('.thumb').forEach(img => {
      img.addEventListener('click', () => openModal(img.dataset.src));
    });

    // Attach status change handlers
    document.querySelectorAll('.status-select').forEach(sel => {
      sel.addEventListener('change', () => handleStatusChange(sel));
    });

    // Attach repair log buttons
    document.querySelectorAll('.repair-btn').forEach(btn => {
      btn.addEventListener('click', () => openRepairModal(btn.dataset.id));
    });

  } catch {
    document.getElementById('table-loading').textContent = 'Failed to load reports.';
  }
}

// ── Status update ─────────────────────────────────────────
async function handleStatusChange(sel) {
  const id        = sel.dataset.id;
  const newStatus = sel.value;
  if (!newStatus) return;

  sel.disabled = true;
  try {
    const res = await fetch(`${API}/reports/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status: newStatus })
    });

    if (res.ok) {
      // Update the badge in the same row
      const row = sel.closest('tr');
      row.querySelector('.status-cell').innerHTML = badgeHtml(newStatus);
      sel.dataset.current = newStatus;
      sel.value = '';
      loadStats(); // refresh counts
    } else {
      const d = await res.json();
      alert(d.message || 'Failed to update status');
      sel.value = '';
    }
  } catch {
    alert('Network error');
    sel.value = '';
  } finally {
    sel.disabled = false;
  }
}

// ── Filters ───────────────────────────────────────────────
document.getElementById('apply-filters-btn').addEventListener('click', loadReports);
document.getElementById('reset-filters-btn').addEventListener('click', () => {
  document.getElementById('filter-status').value = '';
  document.getElementById('filter-type').value   = '';
  document.getElementById('filter-ward').value   = '';
  loadReports();
});

// ── Image modal ───────────────────────────────────────────
function openModal(src) {
  document.getElementById('modal-img').src = src;
  document.getElementById('img-modal').style.display = 'flex';
}
function closeModal() { document.getElementById('img-modal').style.display = 'none'; }
document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('modal-backdrop').addEventListener('click', closeModal);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

// ── Boot ──────────────────────────────────────────────────
loadStats();
loadReports();

// ── Repair modal ──────────────────────────────────────────
let activeRepairReportId = null;

function openRepairModal(reportId) {
  activeRepairReportId = reportId;
  document.getElementById('repair-report-id').textContent = `Report ID: ${reportId}`;
  document.getElementById('repair-action').value = '';
  document.getElementById('repair-note').value   = '';
  document.getElementById('repair-status').value = 'In Progress';
  document.getElementById('repair-msg').style.display = 'none';
  document.getElementById('repair-modal').style.display = 'flex';
}

function closeRepairModal() {
  document.getElementById('repair-modal').style.display = 'none';
  activeRepairReportId = null;
}

document.getElementById('repair-modal-close').addEventListener('click', closeRepairModal);
document.getElementById('repair-backdrop').addEventListener('click', closeRepairModal);

document.getElementById('repair-submit-btn').addEventListener('click', async () => {
  const action    = document.getElementById('repair-action').value.trim();
  const newStatus = document.getElementById('repair-status').value;
  const note      = document.getElementById('repair-note').value.trim();
  const btn       = document.getElementById('repair-submit-btn');
  const msgEl     = document.getElementById('repair-msg');

  if (!action) {
    msgEl.textContent = 'Please describe the action taken.';
    msgEl.className = 'msg error';
    msgEl.style.display = 'block';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Submitting...';

  try {
    const res = await fetch(`${API}/repairs/${activeRepairReportId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action, newStatus, note })
    });

    const data = await res.json();

    if (!res.ok) {
      msgEl.textContent = data.message || 'Failed to log repair.';
      msgEl.className = 'msg error';
      msgEl.style.display = 'block';
      return;
    }

    // Update the badge in the table row
    const row = document.querySelector(`tr[data-id="${activeRepairReportId}"]`);
    if (row) row.querySelector('.status-cell').innerHTML = badgeHtml(newStatus);

    msgEl.textContent = 'Repair logged successfully!';
    msgEl.className = 'msg success';
    msgEl.style.display = 'block';

    loadStats();
    setTimeout(closeRepairModal, 1200);
  } catch {
    msgEl.textContent = 'Network error.';
    msgEl.className = 'msg error';
    msgEl.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Submit Log';
  }
});
