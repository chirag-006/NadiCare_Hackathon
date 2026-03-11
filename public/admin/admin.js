/* ═══════════════════════════════════════════════════════════
   NadiCare Admin — admin.js  v2
   ═══════════════════════════════════════════════════════════ */

const API_BASE  = (window.APP_CONFIG?.apiBase || '').replace(/\/$/, '');
const MAX_SCORE = 50;
const CRITERIA  = [
  { id: 'innovation',   label: 'Innovation'    },
  { id: 'technical',   label: 'Technical'     },
  { id: 'presentation', label: 'Presentation' },
  { id: 'impact',      label: 'Impact'        },
  { id: 'design',      label: 'UI/UX'         }
];

// ── STATE ─────────────────────────────────────────────────────
let adminToken  = sessionStorage.getItem('adminToken') || null;
let evaluations = [];

// ══════════════════════════════════════════════════════════════
// BOOT
// ══════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  if (adminToken) showDashboard();

  // ── Login
  document.getElementById('admin-login-form').addEventListener('submit', async e => {
    e.preventDefault();
    const username = document.getElementById('admin-username').value.trim();
    const password = document.getElementById('admin-password').value;
    const errBox   = document.getElementById('admin-login-error');
    const btn      = document.getElementById('admin-login-btn');
    btn.disabled = true; btn.textContent = 'Signing in…';
    try {
      const res  = await fetch(`${API_BASE}/api/admin/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      adminToken = data.token;
      sessionStorage.setItem('adminToken', adminToken);
      errBox.classList.remove('show');
      showDashboard();
    } catch (err) {
      errBox.textContent = '❌  ' + err.message;
      errBox.classList.add('show');
      const form = document.getElementById('admin-login-form');
      form.classList.add('shake');
      setTimeout(() => form.classList.remove('shake'), 500);
    } finally { btn.disabled = false; btn.textContent = 'Sign In →'; }
  });

  // ── Logout
  document.getElementById('admin-logout-btn').addEventListener('click', () => {
    adminToken = null; sessionStorage.removeItem('adminToken');
    document.getElementById('admin-dashboard-page').classList.remove('active');
    document.getElementById('admin-login-page').classList.add('active');
    document.getElementById('admin-username').value = '';
    document.getElementById('admin-password').value = '';
  });

  // ── Excel download
  document.getElementById('download-excel-btn').addEventListener('click', () => {
    window.location.href = `${API_BASE}/api/export/csv?t=${adminToken}`;
  });

  // ── Clear all
  document.getElementById('clear-all-btn').addEventListener('click', async () => {
    if (!confirm('⚠️  Delete ALL evaluations permanently?')) return;
    try {
      await adminFetch('/api/admin/evaluations', 'DELETE');
      evaluations = [];
      renderEvaluations();
      showToast('🗑️  All evaluations cleared.', 'error');
    } catch { showToast('❌  Could not clear data.', 'error'); }
  });

  // ── Add team form
  document.getElementById('add-team-form').addEventListener('submit', async e => {
    e.preventDefault();
    const name     = document.getElementById('new-team-name').value.trim();
    const problem  = document.getElementById('new-team-problem').value.trim();
    const errBox   = document.getElementById('add-team-error');
    errBox.classList.remove('show');
    try {
      await adminFetch('/api/admin/teams', 'POST', { name, problem_statement: problem });
      document.getElementById('new-team-name').value    = '';
      document.getElementById('new-team-problem').value = '';
      showToast('✅  Team added successfully!', 'success');
      loadTeams();
    } catch (err) {
      errBox.textContent = '❌  ' + err.message;
      errBox.classList.add('show');
    }
  });

  // ── Add judge form
  document.getElementById('add-judge-form').addEventListener('submit', async e => {
    e.preventDefault();
    const name     = document.getElementById('new-judge-name').value.trim();
    const username = document.getElementById('new-judge-username').value.trim();
    const password = document.getElementById('new-judge-password').value.trim();
    const errBox   = document.getElementById('add-judge-error');
    errBox.classList.remove('show');
    try {
      await adminFetch('/api/admin/judges', 'POST', { name, username, password });
      document.getElementById('new-judge-name').value     = '';
      document.getElementById('new-judge-username').value = '';
      document.getElementById('new-judge-password').value = '';
      showToast('✅  Judge added successfully!', 'success');
      loadJudges();
    } catch (err) {
      errBox.textContent = '❌  ' + err.message;
      errBox.classList.add('show');
    }
  });

  // ── Tab switching
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.tab).classList.add('active');
      if (btn.dataset.tab === 'eval-tab')   loadEvaluations();
      if (btn.dataset.tab === 'teams-tab')  loadTeams();
      if (btn.dataset.tab === 'judges-tab') loadJudges();
    });
  });
});

// ══════════════════════════════════════════════════════════════
// SHOW DASHBOARD
// ══════════════════════════════════════════════════════════════
function showDashboard() {
  document.getElementById('admin-login-page').classList.remove('active');
  document.getElementById('admin-dashboard-page').classList.add('active');
  loadEvaluations();
}

// ══════════════════════════════════════════════════════════════
// API HELPERS
// ══════════════════════════════════════════════════════════════
async function adminFetch(path, method = 'GET', body) {
  const opts = {
    method,
    headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' }
  };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(API_BASE + path, opts);

  if (r.status === 401) {
    sessionStorage.removeItem('adminToken'); adminToken = null;
    document.getElementById('admin-dashboard-page').classList.remove('active');
    document.getElementById('admin-login-page').classList.add('active');
    throw new Error('Session expired — please log in again.');
  }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// ══════════════════════════════════════════════════════════════
// EVALUATIONS TAB
// ══════════════════════════════════════════════════════════════
async function loadEvaluations() {
  try {
    evaluations = await adminFetch('/api/admin/evaluations');
    renderEvaluations();
  } catch (err) { showToast('❌  ' + err.message, 'error'); }
}

function renderEvaluations() {
  const uniqueTeams  = [...new Set(evaluations.map(e => e.team))];
  const uniqueJudges = [...new Set(evaluations.map(e => e.evaluator))];
  document.getElementById('admin-stat-total').textContent  = evaluations.length;
  document.getElementById('admin-stat-teams').textContent  = uniqueTeams.length;
  document.getElementById('admin-stat-judges').textContent = uniqueJudges.length;
  if (evaluations.length) {
    const avg = (evaluations.reduce((s, e) => s + e.total, 0) / evaluations.length).toFixed(1);
    document.getElementById('admin-stat-avg').textContent = `${avg}/${MAX_SCORE}`;
  } else {
    document.getElementById('admin-stat-avg').textContent = '—';
  }

  const body  = document.getElementById('admin-table-body');
  const empty = document.getElementById('admin-empty-state');
  if (!evaluations.length) { body.innerHTML = ''; empty.style.display = 'block'; document.getElementById('leaderboard-section').style.display = 'none'; return; }
  empty.style.display = 'none';

  body.innerHTML = evaluations.map(ev => `
    <tr>
      <td>${ev.timestamp}</td>
      <td style="font-size:.8rem;color:var(--text-secondary)">${ev.evaluator}</td>
      <td><strong>${ev.team}</strong></td>
      <td style="max-width:160px;font-size:.78rem;color:var(--text-secondary)">${ev.problem || '—'}</td>
      ${CRITERIA.map(c => `<td style="text-align:center">${(ev.scores||{})[c.id] ?? '—'}</td>`).join('')}
      <td style="text-align:center"><span class="score-badge">${ev.total}/${MAX_SCORE}</span></td>
      <td style="color:var(--text-secondary);font-size:.8rem;max-width:140px">${ev.remarks || '—'}</td>
      <td><button class="btn-danger" style="padding:.3rem .8rem;font-size:.75rem" onclick="deleteEval(${ev.id})">🗑️</button></td>
    </tr>`).join('');

  renderLeaderboard();
}

function renderLeaderboard() {
  const section  = document.getElementById('leaderboard-section');
  const podium   = document.getElementById('admin-podium-row');
  const rankList = document.getElementById('admin-rank-list');
  if (!evaluations.length) { section.style.display = 'none'; return; }

  const teamMap = {};
  evaluations.forEach(ev => { (teamMap[ev.team] = teamMap[ev.team] || { total:0, count:0 }).total += ev.total; teamMap[ev.team].count++; });
  const ranked = Object.entries(teamMap)
    .map(([team, d]) => ({ team, avg: +(d.total/d.count).toFixed(1), count: d.count }))
    .sort((a, b) => b.avg - a.avg);

  const medals = [
    { icon: '🥇', label: '1st Place', cls: 'podium-gold'   },
    { icon: '🥈', label: '2nd Place', cls: 'podium-silver' },
    { icon: '🥉', label: '3rd Place', cls: 'podium-bronze' }
  ];
  podium.innerHTML = ranked.slice(0, 3).map((e, i) => `
    <div class="podium-card ${medals[i].cls}">
      <div class="podium-medal">${medals[i].icon}</div>
      <div class="podium-rank">${medals[i].label}</div>
      <div class="podium-team">${e.team}</div>
      <div class="podium-score">${e.avg}<span class="podium-max">/${MAX_SCORE}</span></div>
      <div class="podium-evals">${e.count} evaluation${e.count !== 1 ? 's' : ''}</div>
    </div>`).join('');

  rankList.innerHTML = ranked.slice(3).map((e, i) => `
    <div class="rank-row">
      <span class="rank-pos">${i+4}</span>
      <span class="rank-team">${e.team}</span>
      <span class="rank-score">${e.avg}/${MAX_SCORE}</span>
    </div>`).join('');

  section.style.display = 'block';
}

async function deleteEval(id) {
  if (!confirm('Delete this entry? Cannot be undone.')) return;
  try {
    await adminFetch(`/api/admin/evaluations/${id}`, 'DELETE');
    evaluations = evaluations.filter(e => e.id !== id);
    renderEvaluations();
    showToast('🗑️  Deleted.', 'error');
  } catch { showToast('❌  Delete failed.', 'error'); }
}

// ══════════════════════════════════════════════════════════════
// TEAMS TAB
// ══════════════════════════════════════════════════════════════
async function loadTeams() {
  try {
    const teams = await adminFetch('/api/admin/teams');
    // Use admin teams endpoint (same as public but via admin for consistency)
    // Fallback to public endpoint
    renderTeams(teams);
  } catch {
    try {
      const teams = await fetch(`${API_BASE}/api/teams`).then(r => r.json());
      renderTeams(teams);
    } catch { showToast('❌  Could not load teams.', 'error'); }
  }
}

function renderTeams(teams) {
  const list  = document.getElementById('teams-list');
  const empty = document.getElementById('teams-empty');
  if (!teams.length) { list.innerHTML = ''; empty.style.display = 'block'; return; }
  empty.style.display = 'none';
  list.innerHTML = `
    <div class="table-wrap">
      <table class="eval-table" style="min-width:600px">
        <thead><tr>
          <th style="width:180px">Team Name</th>
          <th>Problem Statement</th>
          <th style="width:80px"></th>
        </tr></thead>
        <tbody>
          ${teams.map(t => `
            <tr>
              <td><strong>${t.name}</strong></td>
              <td style="font-size:.85rem;color:var(--text-secondary)">${t.problem_statement}</td>
              <td>
                <button class="btn-danger" style="padding:.3rem .8rem;font-size:.75rem"
                        onclick="deleteTeam(${t.id}, '${t.name.replace(/'/g,"\\'")}')">🗑️</button>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

async function deleteTeam(id, name) {
  if (!confirm(`Delete team "${name}"? This won't delete their evaluations.`)) return;
  try {
    await adminFetch(`/api/admin/teams/${id}`, 'DELETE');
    showToast(`🗑️  "${name}" deleted.`, 'error');
    loadTeams();
  } catch { showToast('❌  Delete failed.', 'error'); }
}

// ══════════════════════════════════════════════════════════════
// JUDGES TAB
// ══════════════════════════════════════════════════════════════
async function loadJudges() {
  try {
    const judges = await adminFetch('/api/admin/judges');
    renderJudges(judges);
  } catch { showToast('❌  Could not load judges.', 'error'); }
}

function renderJudges(judges) {
  const list  = document.getElementById('judges-list');
  const empty = document.getElementById('judges-empty');
  if (!judges.length) { list.innerHTML = ''; empty.style.display = 'block'; return; }
  empty.style.display = 'none';
  list.innerHTML = judges.map(j => `
    <div class="judge-card">
      <div class="judge-info">
        <div class="judge-name">${j.name}</div>
        <div class="judge-creds">
          <span class="cred-label">Username:</span>
          <span class="cred-value">${j.username}</span>
          &nbsp;&nbsp;
          <span class="cred-label">Password:</span>
          <span class="cred-value">${j.password}</span>
        </div>
      </div>
      <div class="judge-actions">
        <button class="btn-secondary" style="padding:.4rem .9rem;font-size:.8rem"
                onclick="copyCreds('${j.name}','${j.username}','${j.password}')">
          📋 Copy
        </button>
        <button class="btn-danger" style="padding:.4rem .9rem;font-size:.8rem"
                onclick="deleteJudge(${j.id}, '${j.name}')">
          🗑️
        </button>
      </div>
    </div>`).join('');
}

function copyCreds(name, username, password) {
  const text = `NadiCare Evaluator Login\nName: ${name}\nUsername: ${username}\nPassword: ${password}\nURL: ${window.location.origin}`;
  navigator.clipboard.writeText(text).then(() => showToast('📋  Credentials copied to clipboard!', 'success'));
}

async function deleteJudge(id, name) {
  if (!confirm(`Remove judge "${name}"? They won't be able to log in anymore.`)) return;
  try {
    await adminFetch(`/api/admin/judges/${id}`, 'DELETE');
    showToast(`✅  ${name} removed.`, 'success');
    loadJudges();
  } catch { showToast('❌  Delete failed.', 'error'); }
}

// ══════════════════════════════════════════════════════════════
// TOAST
// ══════════════════════════════════════════════════════════════
function showToast(msg, type = 'success') {
  const toast = document.getElementById('admin-toast');
  toast.textContent = msg;
  toast.className   = `toast ${type} show`;
  setTimeout(() => toast.classList.remove('show'), 3500);
}
