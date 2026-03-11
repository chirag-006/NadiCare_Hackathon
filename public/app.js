/* ═══════════════════════════════════════════════════════════
   NadiCare Hackathon Evaluator — app.js  v2
   Teams and judges are now loaded from the database.
   ═══════════════════════════════════════════════════════════ */

// ── CONFIG ────────────────────────────────────────────────────
const API_BASE  = (window.APP_CONFIG?.apiBase || '').replace(/\/$/, '');
const MAX_SCORE = 50;

// ── EVALUATION CRITERIA (fixed for this hackathon) ────────────
const CRITERIA = [
  { id: 'innovation',   label: 'Innovation & Creativity',      desc: 'Novelty and originality of the solution' },
  { id: 'technical',   label: 'Technical Skills',              desc: 'Quality, complexity & soundness of implementation' },
  { id: 'presentation', label: 'Presentation & Communication', desc: 'Clarity, confidence and effectiveness of pitch' },
  { id: 'impact',      label: 'Impact & Feasibility',          desc: 'Real-world applicability and scalability potential' },
  { id: 'design',      label: 'UI/UX & Design',                desc: 'Aesthetics, usability and user experience' }
];

// ── STATE ─────────────────────────────────────────────────────
let currentEvaluator = null;    // username string
let evaluations      = [];
let evaluatedTeams   = new Set();
let teamsData        = {};      // { 'Team Alpha': 'Problem statement...' }

// ══════════════════════════════════════════════════════════════
// BOOT
// ══════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  buildEvalForm();
  attachLoginHandlers();
  attachTabHandlers();
});

// ══════════════════════════════════════════════════════════════
// PAGE SWITCHING
// ══════════════════════════════════════════════════════════════
function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  if (id === 'app-page') showNetworkURL();
}

function showNetworkURL() {
  const el = document.getElementById('network-url');
  if (el) el.textContent = `http://${window.location.host}`;
}

// ══════════════════════════════════════════════════════════════
// API HELPERS
// ══════════════════════════════════════════════════════════════
async function apiGet(path) {
  const r = await fetch(API_BASE + path);
  if (!r.ok) throw new Error('GET ' + path + ' failed');
  return r.json();
}

async function apiPost(path, body) {
  const r = await fetch(API_BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!r.ok) {
    const data = await r.json().catch(() => ({}));
    throw new Error(data.error || 'POST ' + path + ' failed');
  }
  return r.json();
}

async function apiDelete(path) {
  const r = await fetch(API_BASE + path, { method: 'DELETE' });
  if (!r.ok) throw new Error('DELETE ' + path + ' failed');
  return r.json();
}

// ══════════════════════════════════════════════════════════════
// LOGIN
// ══════════════════════════════════════════════════════════════
function attachLoginHandlers() {
  const form   = document.getElementById('login-form');
  const errBox = document.getElementById('login-error');

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const username = document.getElementById('username').value.trim().toLowerCase();
    const password = document.getElementById('password').value;
    const btn      = document.getElementById('login-btn');

    btn.disabled    = true;
    btn.textContent = 'Signing in…';
    errBox.classList.remove('show');

    try {
      const data = await apiPost('/api/auth/login', { username, password });
      currentEvaluator = data.username;
      evaluatedTeams   = new Set();
      document.getElementById('evaluator-name').textContent = data.name || data.username;
      showPage('app-page');
      await loadTeamsAndInit();
    } catch (err) {
      errBox.textContent = '❌  ' + (err.message || 'Invalid username or password');
      errBox.classList.add('show');
      form.classList.add('shake');
      setTimeout(() => form.classList.remove('shake'), 500);
    } finally {
      btn.disabled    = false;
      btn.textContent = 'Sign In  →';
    }
  });

  document.getElementById('logout-btn').addEventListener('click', () => {
    currentEvaluator = null;
    evaluatedTeams   = new Set();
    teamsData        = {};
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
    showPage('login-page');
  });
}

// ── LOAD TEAMS FROM DB ────────────────────────────────────────
async function loadTeamsAndInit() {
  try {
    const teams = await apiGet('/api/teams');
    teamsData   = {};
    teams.forEach(t => { teamsData[t.name] = t.problem_statement; });
  } catch { teamsData = {}; }
  populateTeamDropdown();
  loadEvaluatedTeams();
}

// Load which teams this evaluator already scored
async function loadEvaluatedTeams() {
  try {
    const all    = await apiGet('/api/evaluations');
    evaluatedTeams = new Set(
      all.filter(e => e.evaluator === currentEvaluator).map(e => e.team)
    );
    updateTeamDropdownStatus();
  } catch { /* ignore */ }
}

// ══════════════════════════════════════════════════════════════
// TEAM DROPDOWN
// ══════════════════════════════════════════════════════════════
function populateTeamDropdown() {
  const sel     = document.getElementById('team-select');
  const warning = document.getElementById('team-done-warning');

  sel.innerHTML = '<option value="">— Select a Team —</option>';
  Object.keys(teamsData).forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    sel.appendChild(opt);
  });

  sel.addEventListener('change', () => {
    const team = sel.value;
    document.getElementById('problem-display').value = teamsData[team] || '';
    if (warning) warning.style.display = team && evaluatedTeams.has(team) ? 'block' : 'none';
  });
}

function updateTeamDropdownStatus() {
  const sel     = document.getElementById('team-select');
  const warning = document.getElementById('team-done-warning');
  const prev    = sel.value;

  sel.innerHTML = '<option value="">— Select a Team —</option>';
  Object.keys(teamsData).forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    if (evaluatedTeams.has(name)) {
      opt.textContent = `✅ ${name} (already evaluated)`;
      opt.disabled    = true;
      opt.style.color = '#888';
    } else {
      opt.textContent = name;
    }
    sel.appendChild(opt);
  });

  if (prev && !evaluatedTeams.has(prev)) sel.value = prev;
  else sel.value = '';

  if (warning) warning.style.display = (sel.value && evaluatedTeams.has(sel.value)) ? 'block' : 'none';
}

// ══════════════════════════════════════════════════════════════
// TABS
// ══════════════════════════════════════════════════════════════
function attachTabHandlers() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.tab).classList.add('active');
      if (btn.dataset.tab === 'dashboard-panel') loadAndRenderDashboard();
    });
  });
}

// ══════════════════════════════════════════════════════════════
// EVALUATION FORM
// ══════════════════════════════════════════════════════════════
function buildEvalForm() {
  const container = document.getElementById('criteria-list');
  container.innerHTML = '';

  const opts = '<option value="">-- score --</option>' +
    Array.from({ length: 11 }, (_, i) => `<option value="${i}">${i}</option>`).join('');

  CRITERIA.forEach(c => {
    const item = document.createElement('div');
    item.className = 'criteria-item';
    item.innerHTML = `
      <div class="criteria-info">
        <div class="criteria-name">${c.label}</div>
        <div class="criteria-desc">${c.desc}</div>
      </div>
      <div class="score-controls">
        <select class="score-select" id="sel-${c.id}" onchange="syncFromSelect('${c.id}')">
          ${opts}
        </select>
        <span class="score-or">or</span>
        <input type="number" class="score-type" id="inp-${c.id}"
               min="0" max="10" step="1" placeholder="type 0–10"
               oninput="syncFromInput('${c.id}')">
      </div>`;
    container.appendChild(item);
  });

  updateTotal();
  document.getElementById('eval-form').addEventListener('submit', handleSubmit);
}

// ── SCORE SYNC ────────────────────────────────────────────────
function syncFromSelect(id) {
  document.getElementById(`inp-${id}`).value = document.getElementById(`sel-${id}`).value;
  updateTotal();
}

function syncFromInput(id) {
  const inp = document.getElementById(`inp-${id}`);
  let v = parseInt(inp.value);
  if (isNaN(v)) v = '';
  else v = Math.min(10, Math.max(0, v));
  inp.value = v === '' ? '' : v;
  document.getElementById(`sel-${id}`).value = v !== '' ? String(v) : '';
  updateTotal();
}

function getScore(id) {
  const sel = document.getElementById(`sel-${id}`);
  if (sel?.value !== '') return parseInt(sel.value);
  const inp = document.getElementById(`inp-${id}`);
  if (inp?.value !== '') return parseInt(inp.value);
  return null;
}

function updateTotal() {
  let total = 0, allFilled = true;
  CRITERIA.forEach(c => {
    const v = getScore(c.id);
    if (v === null) allFilled = false;
    else total += v;
  });
  document.getElementById('total-score').textContent = allFilled ? total : '—';
  document.getElementById('total-max').textContent   = '/' + MAX_SCORE;
  const fill = document.getElementById('total-fill');
  if (fill) fill.style.width = allFilled ? ((total / MAX_SCORE) * 100) + '%' : '0%';
}

// ══════════════════════════════════════════════════════════════
// SUBMIT
// ══════════════════════════════════════════════════════════════
async function handleSubmit(e) {
  e.preventDefault();
  const team = document.getElementById('team-select').value.trim();
  if (!team) { showToast('⚠️  Please select a team first.', 'error'); return; }
  if (evaluatedTeams.has(team)) {
    showToast(`🔒  You already evaluated "${team}".`, 'error'); return;
  }

  const scores = {}, total_ref = { val: 0 };
  let missing = false;
  CRITERIA.forEach(c => {
    const v = getScore(c.id);
    if (v === null) { missing = true; return; }
    scores[c.id] = v;
    total_ref.val += v;
  });
  if (missing) { showToast('⚠️  Please score all criteria before submitting.', 'error'); return; }

  const total   = total_ref.val;
  const remarks = document.getElementById('remarks').value.trim();
  const now     = new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  const btn     = document.querySelector('#eval-form button[type="submit"]');

  btn.disabled    = true;
  btn.textContent = 'Submitting…';

  try {
    const problem = teamsData[team] || document.getElementById('problem-display').value.trim() || '—';
    await apiPost('/api/evaluations', { evaluator: currentEvaluator, team, problem, scores, total, remarks, timestamp: now });
    evaluatedTeams.add(team);
    updateTeamDropdownStatus();
    showToast(`✅  Evaluation for "${team}" submitted!`, 'success');
    resetForm();
  } catch (err) {
    showToast('❌  Failed to submit. Check your connection.', 'error');
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Submit Evaluation  ✓';
  }
}

function resetForm() {
  document.getElementById('team-select').value     = '';
  document.getElementById('problem-display').value = '';
  document.getElementById('remarks').value         = '';
  CRITERIA.forEach(c => {
    document.getElementById(`sel-${c.id}`).value = '';
    document.getElementById(`inp-${c.id}`).value = '';
  });
  updateTotal();
}

// ══════════════════════════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════════════════════════
async function loadAndRenderDashboard() {
  try {
    evaluations = await apiGet('/api/evaluations');
    renderDashboard();
  } catch { showToast('❌  Could not load evaluations.', 'error'); }
}

function renderDashboard() {
  const body       = document.getElementById('table-body');
  const emptyState = document.getElementById('empty-state');

  document.getElementById('stat-total').textContent = evaluations.length;
  document.getElementById('stat-teams').textContent = [...new Set(evaluations.map(e => e.team))].length;
  if (evaluations.length) {
    const avg = Math.round(evaluations.reduce((s, e) => s + e.total, 0) / evaluations.length);
    document.getElementById('stat-avg').textContent = `${avg}/${MAX_SCORE}`;
  } else {
    document.getElementById('stat-avg').textContent = '—';
  }

  if (!evaluations.length) { body.innerHTML = ''; emptyState.style.display = 'block'; return; }
  emptyState.style.display = 'none';

  body.innerHTML = evaluations.map(ev => `
    <tr>
      <td>${ev.timestamp}</td>
      <td><strong>${ev.team}</strong></td>
      <td style="max-width:180px;font-size:.78rem;color:var(--text-secondary)">${ev.problem}</td>
      ${CRITERIA.map(c => `<td style="text-align:center">${(ev.scores||{})[c.id] ?? '—'}</td>`).join('')}
      <td style="text-align:center"><span class="score-badge">${ev.total}/${MAX_SCORE}</span></td>
      <td style="color:var(--text-secondary);font-size:.8rem;max-width:140px">${ev.remarks || '—'}</td>
      <td style="font-size:.78rem;color:var(--text-muted)">${ev.evaluator}</td>
      <td>
        <button class="btn-danger" style="padding:.3rem .8rem;font-size:.75rem"
                onclick="deleteEval(${ev.id})">🗑️ Delete</button>
      </td>
    </tr>`).join('');

  renderLeaderboard();
}

// ── LEADERBOARD ───────────────────────────────────────────────
function renderLeaderboard() {
  const section = document.getElementById('leaderboard-section');
  const podium  = document.getElementById('podium-row');
  if (!section || !podium || !evaluations.length) { if (section) section.style.display = 'none'; return; }

  const teamMap = {};
  evaluations.forEach(ev => {
    if (!teamMap[ev.team]) teamMap[ev.team] = { total: 0, count: 0 };
    teamMap[ev.team].total += ev.total;
    teamMap[ev.team].count++;
  });
  const ranked = Object.entries(teamMap)
    .map(([team, d]) => ({ team, avg: +(d.total / d.count).toFixed(1), count: d.count }))
    .sort((a, b) => b.avg - a.avg);

  const evaluated = new Set(ranked.map(r => r.team));
  const notEval   = Object.keys(teamsData).filter(n => !evaluated.has(n))
    .map(team => ({ team, avg: null, count: 0 }));

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

  document.getElementById('rank-list')?.remove();
  const restRows = ranked.slice(3).map((e, i) => `
    <div class="rank-row">
      <span class="rank-pos">${i+4}</span>
      <span class="rank-team">${e.team}</span>
      <span class="rank-score">${e.avg}/${MAX_SCORE}</span>
    </div>`);
  const pendingRows = notEval.map(e => `
    <div class="rank-row rank-row-pending">
      <span class="rank-pos" style="background:#1a1a1a;color:#333">—</span>
      <span class="rank-team" style="color:var(--text-muted)">${e.team}</span>
      <span class="rank-score" style="color:#333">—/${MAX_SCORE}</span>
    </div>`);
  const allRows = [...restRows, ...pendingRows];
  if (allRows.length)
    podium.insertAdjacentHTML('afterend', `<div class="rank-list" id="rank-list">${allRows.join('')}</div>`);

  section.style.display = 'block';
}

// ── DELETE EVAL ───────────────────────────────────────────────
async function deleteEval(id) {
  if (!confirm('Delete this evaluation entry? This cannot be undone.')) return;
  try {
    const ev = evaluations.find(e => e.id === id);
    await apiDelete(`/api/evaluations/${id}`);
    evaluations = evaluations.filter(e => e.id !== id);
    if (ev?.evaluator === currentEvaluator) { evaluatedTeams.delete(ev.team); updateTeamDropdownStatus(); }
    renderDashboard();
    showToast('🗑️  Entry deleted.', 'error');
  } catch { showToast('❌  Delete failed.', 'error'); }
}

// ══════════════════════════════════════════════════════════════
// TOAST
// ══════════════════════════════════════════════════════════════
function showToast(msg, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className   = `toast ${type} show`;
  setTimeout(() => toast.classList.remove('show'), 3500);
}
