const API = 'http://localhost:5000/api';

// ── Auth guard ────────────────────────────────────────────
const token = localStorage.getItem('ul_token');
const user  = JSON.parse(localStorage.getItem('ul_user') || 'null');
if (!token || !user) window.location.href = 'index.html';

// ── Navbar ────────────────────────────────────────────────
document.getElementById('nav-user').textContent = `Hi, ${user.username}`;
const badge = document.getElementById('nav-role-badge');
const roleLabels = { user: 'Citizen', admin: 'Admin', ward_authority: 'Ward Authority' };
badge.textContent = roleLabels[user.role] || user.role;
badge.className   = `role-badge ${user.role}`;

document.getElementById('logout-btn').addEventListener('click', () => {
  localStorage.removeItem('ul_token');
  localStorage.removeItem('ul_user');
  window.location.href = 'index.html';
});

// ── Chart colour palette ──────────────────────────────────
const COLORS = [
  '#0f3460','#e53e3e','#38a169','#d69e2e','#3182ce',
  '#805ad5','#dd6b20','#319795','#e53e3e','#2d3748'
];

function makeChart(id, type, labels, datasets, options = {}) {
  return new Chart(document.getElementById(id), {
    type,
    data: { labels, datasets },
    options: {
      responsive: true,
      plugins: { legend: { display: type === 'doughnut' || type === 'pie' } },
      scales: type !== 'doughnut' && type !== 'pie'
        ? { y: { beginAtZero: true, ticks: { precision: 0 } } }
        : {},
      ...options
    }
  });
}

// ── Load & render ─────────────────────────────────────────
async function load() {
  try {
    const res = await fetch(`${API}/analytics/wards`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const wards = await res.json();

    document.getElementById('loading-state').style.display = 'none';

    if (!wards.length) {
      document.getElementById('empty-state').style.display = 'block';
      return;
    }

    document.getElementById('analytics-content').style.display = 'block';

    const labels = wards.map(w => w.ward + (w.city ? ` (${w.city})` : ''));

    // ── Summary cards ─────────────────────────────────────
    const totalReports  = wards.reduce((s, w) => s + w.total, 0);
    const totalResolved = wards.reduce((s, w) => s + w.resolved, 0);
    const worstWard     = wards[0]; // sorted by total desc
    const bestWard      = [...wards].sort((a, b) => b.resolutionRate - a.resolutionRate)[0];
    const overallRate   = totalReports > 0 ? Math.round((totalResolved / totalReports) * 100) : 0;

    document.getElementById('summary-cards').innerHTML = `
      <div class="s-card"><div class="s-num">${wards.length}</div><div class="s-label">Wards</div></div>
      <div class="s-card"><div class="s-num">${totalReports}</div><div class="s-label">Total Reports</div></div>
      <div class="s-card"><div class="s-num">${overallRate}%</div><div class="s-label">Overall Resolution</div></div>
      <div class="s-card highlight"><div class="s-num">${worstWard.ward}</div><div class="s-label">Most Reports</div></div>
      <div class="s-card"><div class="s-num">${bestWard.ward}</div><div class="s-label">Best Resolution</div></div>
    `;

    // ── Chart 1: Total reports per ward ───────────────────
    makeChart('chart-total', 'bar', labels, [{
      label: 'Total Reports',
      data: wards.map(w => w.total),
      backgroundColor: COLORS[0],
      borderRadius: 4
    }]);

    // ── Chart 2: Resolution rate ──────────────────────────
    makeChart('chart-resolution', 'bar', labels, [{
      label: 'Resolution Rate (%)',
      data: wards.map(w => w.resolutionRate),
      backgroundColor: wards.map(w =>
        w.resolutionRate >= 70 ? '#38a169' :
        w.resolutionRate >= 40 ? '#d69e2e' : '#e53e3e'
      ),
      borderRadius: 4
    }], { scales: { y: { beginAtZero: true, max: 100 } } });

    // ── Chart 3: Avg severity ─────────────────────────────
    makeChart('chart-severity', 'bar', labels, [{
      label: 'Avg Severity (1–5)',
      data: wards.map(w => w.avgSeverity || 0),
      backgroundColor: '#805ad5',
      borderRadius: 4
    }], { scales: { y: { beginAtZero: true, max: 5 } } });

    // ── Chart 4: Status breakdown for worst ward ──────────
    const w = worstWard;
    makeChart('chart-status', 'doughnut',
      ['Pending', 'Verified', 'In Progress', 'Resolved', 'Rejected'],
      [{
        data: [w.pending, w.verified, w.inProgress, w.resolved, w.rejected],
        backgroundColor: ['#d69e2e','#3182ce','#805ad5','#38a169','#e53e3e']
      }],
      { plugins: { legend: { display: true, position: 'bottom' } } }
    );

    // ── Table ─────────────────────────────────────────────
    const tbody = document.getElementById('analytics-tbody');
    tbody.innerHTML = wards.map((w, i) => {
      const rowClass = i === 0 ? 'worst-ward' : w.resolutionRate === bestWard.resolutionRate ? 'best-ward' : '';
      return `
        <tr class="${rowClass}">
          <td><strong>${w.ward}</strong></td>
          <td>${w.city || '—'}</td>
          <td>${w.total}</td>
          <td>${w.pending}</td>
          <td>${w.verified}</td>
          <td>${w.inProgress}</td>
          <td>${w.resolved}</td>
          <td>${w.avgSeverity ?? '—'}</td>
          <td>
            <div class="rate-bar">
              <div class="rate-fill" style="width:${w.resolutionRate}px;max-width:80px;"></div>
              <span class="rate-text">${w.resolutionRate}%</span>
            </div>
          </td>
        </tr>`;
    }).join('');

  } catch {
    document.getElementById('loading-state').textContent = 'Failed to load analytics.';
  }
}

load();
