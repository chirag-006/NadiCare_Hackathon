/* ═══════════════════════════════════════════════════════════
   NadiCare Hackathon Evaluator — app.js
   ═══════════════════════════════════════════════════════════ */

// ── CREDENTIALS ──────────────────────────────────────────────
// Add / edit evaluator credentials here (username: password)
const EVALUATORS = {
  "evaluator1": "nadicare2025",
  "evaluator2": "nadicare2025",
  "admin":      "admin@bnmit"
};

// ── TEAMS & PROBLEM STATEMENTS ───────────────────────────────
// Format: "Team Name": "Problem Statement description"
const TEAMS = {
  "Team Alpha":   "AI-powered early detection of cardiovascular diseases using wearable sensor data",
  "Team Beta":    "Smart medication adherence tracker with IoT pill dispenser and reminder system",
  "Team Gamma":   "Telemedicine platform for rural healthcare with offline-first capabilities",
  "Team Delta":   "Mental health monitoring app using NLP to analyze speech and behavioral patterns",
  "Team Epsilon": "Blockchain-based patient data management system for secure sharing across hospitals",
  "Team Zeta":    "Automated diagnostic tool for diabetic retinopathy using fundus image analysis",
  "Team Eta":     "Emergency response coordination platform integrating real-time ambulance routing",
  "Team Theta":   "Predictive analytics system for hospital bed management and patient flow optimization"
};

// ── EVALUATION CRITERIA ───────────────────────────────────────
const CRITERIA = [
  { id: "innovation",    label: "Innovation & Creativity",    desc: "Novelty and originality of the solution" },
  { id: "technical",     label: "Technical Skills",           desc: "Quality, complexity & soundness of implementation" },
  { id: "presentation",  label: "Presentation & Communication", desc: "Clarity, confidence and effectiveness of pitch" },
  { id: "impact",        label: "Impact & Feasibility",       desc: "Real-world applicability and scalability potential" },
  { id: "design",        label: "UI/UX & Design",             desc: "Aesthetics, usability and user experience" }
];

const MAX_SCORE = CRITERIA.length * 10;
const STORAGE_KEY = "nadicare_evaluations";

// ── STATE ─────────────────────────────────────────────────────
let currentEvaluator = null;
let evaluations = loadEvaluations();

// ══════════════════════════════════════════════════════════════
// BOOT
// ══════════════════════════════════════════════════════════════
document.addEventListener("DOMContentLoaded", () => {
  buildEvalForm();
  populateTeamDropdown();
  attachLoginHandlers();
  attachTabHandlers();
  renderDashboard();
});

// ══════════════════════════════════════════════════════════════
// PAGE SWITCHING
// ══════════════════════════════════════════════════════════════
function showPage(id) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

// ══════════════════════════════════════════════════════════════
// LOGIN
// ══════════════════════════════════════════════════════════════
function attachLoginHandlers() {
  const form    = document.getElementById("login-form");
  const errBox  = document.getElementById("login-error");

  form.addEventListener("submit", e => {
    e.preventDefault();
    const username = document.getElementById("username").value.trim().toLowerCase();
    const password = document.getElementById("password").value;

    if (EVALUATORS[username] && EVALUATORS[username] === password) {
      currentEvaluator = username;
      document.getElementById("evaluator-name").textContent = username;
      errBox.classList.remove("show");
      showPage("app-page");
    } else {
      errBox.textContent = "❌  Invalid username or password. Please try again.";
      errBox.classList.add("show");
      shakeElement(form);
    }
  });

  document.getElementById("logout-btn").addEventListener("click", () => {
    currentEvaluator = null;
    document.getElementById("username").value = "";
    document.getElementById("password").value = "";
    showPage("login-page");
  });
}

function shakeElement(el) {
  el.classList.add("shake");
  setTimeout(() => el.classList.remove("shake"), 500);
}

// ══════════════════════════════════════════════════════════════
// TABS
// ══════════════════════════════════════════════════════════════
function attachTabHandlers() {
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(btn.dataset.tab).classList.add("active");
      if (btn.dataset.tab === "dashboard-panel") renderDashboard();
    });
  });
}

// ══════════════════════════════════════════════════════════════
// BUILD EVALUATION FORM (dynamic)
// ══════════════════════════════════════════════════════════════
function buildEvalForm() {
  const container = document.getElementById("criteria-list");
  container.innerHTML = "";

  CRITERIA.forEach(c => {
    const item = document.createElement("div");
    item.className = "criteria-item";
    item.innerHTML = `
      <div>
        <div class="criteria-name">${c.label}</div>
        <div class="criteria-desc">${c.desc}</div>
      </div>
      <div class="score-input-wrap">
        <input type="range" class="score-range" id="range-${c.id}"
               min="1" max="10" value="5"
               oninput="updateScore('${c.id}', this.value)">
      </div>
      <div>
        <div class="score-number" id="num-${c.id}">5</div>
        <div class="score-max">/ 10</div>
      </div>
    `;
    container.appendChild(item);
  });

  updateTotal();

  document.getElementById("eval-form").addEventListener("submit", handleSubmit);
}

function populateTeamDropdown() {
  const sel = document.getElementById("team-select");
  sel.innerHTML = '<option value="">— Select a Team —</option>';
  Object.keys(TEAMS).forEach(name => {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    sel.appendChild(opt);
  });

  sel.addEventListener("change", () => {
    const prob = document.getElementById("problem-display");
    const teamName = sel.value;
    if (teamName && TEAMS[teamName]) {
      prob.value = TEAMS[teamName];
    } else {
      prob.value = "";
    }
  });
}

// ══════════════════════════════════════════════════════════════
// SCORING
// ══════════════════════════════════════════════════════════════
function updateScore(id, val) {
  document.getElementById(`num-${id}`).textContent = val;
  // colour the range track
  const range = document.getElementById(`range-${id}`);
  const pct   = ((val - 1) / 9) * 100;
  range.style.background = `linear-gradient(to right, #FF6B00 ${pct}%, #2a2a2a ${pct}%)`;
  updateTotal();
}

function updateTotal() {
  let total = 0;
  CRITERIA.forEach(c => {
    const el = document.getElementById(`range-${c.id}`);
    if (el) total += parseInt(el.value);
  });
  document.getElementById("total-score").textContent = total;
  document.getElementById("total-max").textContent   = MAX_SCORE;

  const pct  = (total / MAX_SCORE) * 100;
  const fill = document.getElementById("total-fill");
  if (fill) fill.style.width = pct + "%";
}

// ══════════════════════════════════════════════════════════════
// SUBMIT
// ══════════════════════════════════════════════════════════════
function handleSubmit(e) {
  e.preventDefault();

  const team = document.getElementById("team-select").value;

  if (!team) {
    showToast("⚠️  Please select a team first.", "error");
    return;
  }

  // collect scores
  const scores = {};
  let total = 0;
  CRITERIA.forEach(c => {
    const v = parseInt(document.getElementById(`range-${c.id}`).value);
    scores[c.id] = v;
    total += v;
  });

  const remarks = document.getElementById("remarks").value.trim();
  const now     = new Date();

  const record = {
    id:          Date.now(),
    evaluator:   currentEvaluator,
    team,
    problem:     TEAMS[team],
    scores,
    total,
    remarks,
    timestamp:   now.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
  };

  evaluations.push(record);
  saveEvaluations();

  showToast(`✅  Evaluation for "${team}" submitted successfully!`, "success");
  resetForm();
}

function resetForm() {
  document.getElementById("team-select").value = "";
  document.getElementById("problem-display").value = "";
  document.getElementById("remarks").value = "";
  CRITERIA.forEach(c => {
    const range = document.getElementById(`range-${c.id}`);
    range.value = 5;
    range.style.background = `linear-gradient(to right, #FF6B00 44.4%, #2a2a2a 44.4%)`;
    document.getElementById(`num-${c.id}`).textContent = "5";
  });
  updateTotal();
}

// ══════════════════════════════════════════════════════════════
// TOAST
// ══════════════════════════════════════════════════════════════
function showToast(msg, type = "success") {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.className   = `toast ${type} show`;
  setTimeout(() => toast.classList.remove("show"), 3500);
}

// ══════════════════════════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════════════════════════
function renderDashboard() {
  const body = document.getElementById("table-body");
  const empty = document.getElementById("empty-state");

  // stats
  document.getElementById("stat-total").textContent  = evaluations.length;
  const teams = [...new Set(evaluations.map(e => e.team))];
  document.getElementById("stat-teams").textContent  = teams.length;
  const avg = evaluations.length
    ? Math.round(evaluations.reduce((s, e) => s + e.total, 0) / evaluations.length)
    : 0;
  document.getElementById("stat-avg").textContent    = evaluations.length ? avg + "/" + MAX_SCORE : "—";

  if (evaluations.length === 0) {
    body.innerHTML = "";
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";

  body.innerHTML = evaluations.map(ev => `
    <tr>
      <td>${ev.timestamp}</td>
      <td><strong>${ev.team}</strong></td>
      <td style="max-width:200px;font-size:0.8rem;color:var(--text-secondary)">${ev.problem}</td>
      ${CRITERIA.map(c => `<td style="text-align:center">${ev.scores[c.id]}</td>`).join("")}
      <td style="text-align:center"><span class="score-badge">${ev.total}/${MAX_SCORE}</span></td>
      <td style="color:var(--text-secondary);font-size:0.8rem;max-width:150px">${ev.remarks || "—"}</td>
      <td>
        <button class="btn-secondary" style="padding:0.3rem 0.7rem;font-size:0.75rem"
                onclick="deleteEval(${ev.id})">✕</button>
      </td>
    </tr>
  `).join("");
}

function deleteEval(id) {
  if (!confirm("Remove this evaluation entry?")) return;
  evaluations = evaluations.filter(e => e.id !== id);
  saveEvaluations();
  renderDashboard();
  showToast("🗑️  Entry removed.", "error");
}

function clearAll() {
  if (!confirm("⚠️  This will delete ALL evaluations. Are you sure?")) return;
  evaluations = [];
  saveEvaluations();
  renderDashboard();
  showToast("🗑️  All evaluations cleared.", "error");
}

// ══════════════════════════════════════════════════════════════
// PERSISTENCE
// ══════════════════════════════════════════════════════════════
function saveEvaluations() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(evaluations));
}

function loadEvaluations() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch { return []; }
}

// ══════════════════════════════════════════════════════════════
// EXCEL EXPORT (SheetJS)
// ══════════════════════════════════════════════════════════════
function downloadExcel() {
  if (evaluations.length === 0) {
    showToast("⚠️  No evaluations to export yet.", "error");
    return;
  }

  const headers = [
    "Timestamp", "Evaluator", "Team Name", "Problem Statement",
    ...CRITERIA.map(c => c.label),
    "Total Score", "Max Score", "Remarks"
  ];

  const rows = evaluations.map(ev => [
    ev.timestamp,
    ev.evaluator,
    ev.team,
    ev.problem,
    ...CRITERIA.map(c => ev.scores[c.id]),
    ev.total,
    MAX_SCORE,
    ev.remarks || ""
  ]);

  const wsData = [headers, ...rows];
  const wb     = XLSX.utils.book_new();
  const ws     = XLSX.utils.aoa_to_sheet(wsData);

  // column widths
  ws["!cols"] = [
    { wch: 20 }, { wch: 14 }, { wch: 18 }, { wch: 55 },
    ...CRITERIA.map(() => ({ wch: 22 })),
    { wch: 13 }, { wch: 10 }, { wch: 40 }
  ];

  // header style
  headers.forEach((_, i) => {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c: i });
    if (!ws[cellRef]) return;
    ws[cellRef].s = {
      font: { bold: true, color: { rgb: "FF6B00" } },
      fill: { fgColor: { rgb: "1A1A1A" } }
    };
  });

  XLSX.utils.book_append_sheet(wb, ws, "Evaluations");

  // Summary sheet
  const teamMap = {};
  evaluations.forEach(ev => {
    if (!teamMap[ev.team]) teamMap[ev.team] = [];
    teamMap[ev.team].push(ev.total);
  });

  const summaryHeaders = ["Team Name", "# Evaluations", "Total Points", "Average Score", "Max Possible"];
  const summaryRows = Object.entries(teamMap).map(([team, scores]) => {
    const sum = scores.reduce((a, b) => a + b, 0);
    const avg = +(sum / scores.length).toFixed(2);
    return [team, scores.length, sum, avg, MAX_SCORE];
  }).sort((a, b) => b[3] - a[3]);

  const ws2 = XLSX.utils.aoa_to_sheet([summaryHeaders, ...summaryRows]);
  ws2["!cols"] = [{ wch: 20 }, { wch: 16 }, { wch: 14 }, { wch: 15 }, { wch: 13 }];
  XLSX.utils.book_append_sheet(wb, ws2, "Team Summary");

  const date = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `NadiCare_Evaluations_${date}.xlsx`);
  showToast("📊  Excel file downloaded successfully!", "success");
}
