/**
 * NadiCare Hackathon Evaluator — server.js  v2
 * Node.js + Express + PostgreSQL (Supabase)
 * All teams and judges are stored in the database
 */
require('dotenv').config();

const express  = require('express');
const cors     = require('cors');
const path     = require('path');
const os       = require('os');
const { Pool } = require('pg');
const ExcelJS  = require('exceljs');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── ADMIN CREDENTIALS (set via env vars) ──────────────────────
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin@bnmit';
const ADMIN_TOKEN    = process.env.ADMIN_TOKEN    || 'nadicare-admin-secret-token-2025';

// ── DATABASE ──────────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
  max: 10
});

// Create tables if they don't exist yet
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS teams (
      id                SERIAL PRIMARY KEY,
      name              TEXT NOT NULL UNIQUE,
      problem_statement TEXT NOT NULL,
      created_at        TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS judges (
      id         SERIAL PRIMARY KEY,
      name       TEXT NOT NULL,
      username   TEXT NOT NULL UNIQUE,
      password   TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS evaluations (
      id         SERIAL PRIMARY KEY,
      timestamp  TEXT NOT NULL,
      evaluator  TEXT NOT NULL,
      team       TEXT NOT NULL,
      problem    TEXT,
      scores     JSONB NOT NULL DEFAULT '{}',
      total      INTEGER NOT NULL DEFAULT 0,
      remarks    TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  console.log('[DB] Tables ready');
}

// ── CRITERIA ──────────────────────────────────────────────────
const CRITERIA_KEYS = [
  { id: 'innovation',   label: 'Innovation & Creativity'      },
  { id: 'technical',   label: 'Technical Skills'             },
  { id: 'presentation', label: 'Presentation & Communication' },
  { id: 'impact',      label: 'Impact & Feasibility'         },
  { id: 'design',      label: 'UI/UX & Design'               }
];

// ── MIDDLEWARE ────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── ADMIN AUTH ────────────────────────────────────────────────
function requireAdmin(req, res, next) {
  const auth  = req.headers['authorization'] || '';
  const token = auth.replace('Bearer ', '').trim() || (req.query.t || '');
  if (token === ADMIN_TOKEN) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

// ════════════════════════════════════════════════════════════
// AUTH ROUTES
// ════════════════════════════════════════════════════════════

// Judge login — validates against judges table
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const { rows } = await pool.query(
      'SELECT id, name, username FROM judges WHERE username=$1 AND password=$2',
      [username?.toLowerCase().trim(), password]
    );
    if (rows.length === 0) return res.status(401).json({ error: 'Invalid username or password' });
    res.json({ success: true, username: rows[0].username, name: rows[0].name });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin login
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    res.json({ token: ADMIN_TOKEN });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

// ════════════════════════════════════════════════════════════
// TEAMS ROUTES
// ════════════════════════════════════════════════════════════

// Public — evaluator dropdown
app.get('/api/teams', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id, name, problem_statement FROM teams ORDER BY name ASC');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// Admin — list teams
app.get('/api/admin/teams', requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id, name, problem_statement FROM teams ORDER BY name ASC');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// Admin — add team
app.post('/api/admin/teams', requireAdmin, async (req, res) => {
  try {
    const { name, problem_statement } = req.body;
    if (!name?.trim() || !problem_statement?.trim())
      return res.status(400).json({ error: 'Name and problem statement are required' });
    const { rows } = await pool.query(
      'INSERT INTO teams (name, problem_statement) VALUES ($1, $2) RETURNING *',
      [name.trim(), problem_statement.trim()]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Team name already exists' });
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin — update team
app.put('/api/admin/teams/:id', requireAdmin, async (req, res) => {
  try {
    const { name, problem_statement } = req.body;
    const { rows } = await pool.query(
      'UPDATE teams SET name=$1, problem_statement=$2 WHERE id=$3 RETURNING *',
      [name.trim(), problem_statement.trim(), parseInt(req.params.id)]
    );
    if (!rows.length) return res.status(404).json({ error: 'Team not found' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// Admin — delete team
app.delete('/api/admin/teams/:id', requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM teams WHERE id=$1', [parseInt(req.params.id)]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// ════════════════════════════════════════════════════════════
// JUDGES ROUTES (admin only)
// ════════════════════════════════════════════════════════════

app.get('/api/admin/judges', requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, name, username, password, created_at FROM judges ORDER BY created_at ASC'
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/admin/judges', requireAdmin, async (req, res) => {
  try {
    const { name, username, password } = req.body;
    if (!name?.trim() || !username?.trim() || !password?.trim())
      return res.status(400).json({ error: 'Name, username, and password are required' });
    const { rows } = await pool.query(
      'INSERT INTO judges (name, username, password) VALUES ($1,$2,$3) RETURNING *',
      [name.trim(), username.toLowerCase().trim(), password.trim()]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Username already exists' });
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/admin/judges/:id', requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM judges WHERE id=$1', [parseInt(req.params.id)]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// ════════════════════════════════════════════════════════════
// EVALUATIONS ROUTES
// ════════════════════════════════════════════════════════════

app.get('/api/evaluations', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM evaluations ORDER BY id DESC');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/evaluations', async (req, res) => {
  try {
    const { evaluator, team, problem, scores, total, remarks, timestamp } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO evaluations (timestamp,evaluator,team,problem,scores,total,remarks)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [timestamp, evaluator, team, problem || '', scores, total, remarks || '']
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Eval insert error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/evaluations/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM evaluations WHERE id=$1', [parseInt(req.params.id)]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// Admin evaluations
app.get('/api/admin/evaluations', requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM evaluations ORDER BY id DESC');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

app.delete('/api/admin/evaluations/:id', requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM evaluations WHERE id=$1', [parseInt(req.params.id)]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

app.delete('/api/admin/evaluations', requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM evaluations');
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// ════════════════════════════════════════════════════════════
// EXCEL EXPORT
// ════════════════════════════════════════════════════════════
app.get('/api/export/excel', requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM evaluations ORDER BY id ASC');
    const date = new Date().toISOString().slice(0, 10);
    const MAX  = CRITERIA_KEYS.length * 10;

    const wb = new ExcelJS.Workbook();
    wb.creator = 'NadiCare Evaluator';

    // Sheet 1 — All Evaluations
    const s1 = wb.addWorksheet('All Evaluations');
    s1.columns = [
      { header: 'ID',                key: 'id',        width: 8  },
      { header: 'Timestamp',         key: 'timestamp', width: 22 },
      { header: 'Evaluator',         key: 'evaluator', width: 16 },
      { header: 'Team Name',         key: 'team',      width: 20 },
      { header: 'Problem Statement', key: 'problem',   width: 42 },
      ...CRITERIA_KEYS.map(c => ({ header: c.label, key: c.id, width: 24 })),
      { header: 'Total',     key: 'total', width: 10 },
      { header: 'Max',       key: 'max',   width: 10 },
      { header: 'Remarks',   key: 'remarks', width: 36 }
    ];
    s1.getRow(1).eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF6B00' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    });
    s1.getRow(1).height = 28;
    rows.forEach(ev => {
      const sc = typeof ev.scores === 'object' ? ev.scores : JSON.parse(ev.scores || '{}');
      s1.addRow({
        id: ev.id, timestamp: ev.timestamp, evaluator: ev.evaluator,
        team: ev.team, problem: ev.problem,
        ...CRITERIA_KEYS.reduce((a, c) => { a[c.id] = sc[c.id] ?? ''; return a; }, {}),
        total: ev.total, max: MAX, remarks: ev.remarks || ''
      });
    });

    // Sheet 2 — Team Summary
    const s2 = wb.addWorksheet('Team Summary');
    s2.columns = [
      { header: 'Team Name',      key: 'team',  width: 22 },
      { header: '# Evaluations',  key: 'count', width: 14 },
      ...CRITERIA_KEYS.map(c => ({ header: `Avg ${c.label}`, key: c.id, width: 26 })),
      { header: 'Avg Total', key: 'avg', width: 12 },
      { header: 'Max',       key: 'max', width: 10 }
    ];
    s2.getRow(1).eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF16A34A' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    });
    s2.getRow(1).height = 28;
    const tm = {};
    rows.forEach(ev => { (tm[ev.team] = tm[ev.team] || []).push(ev); });
    Object.entries(tm).sort((a,b) => {
      const avg = arr => arr.reduce((s,r) => s + r.total, 0) / arr.length;
      return avg(b[1]) - avg(a[1]);
    }).forEach(([team, recs]) => {
      const n = recs.length;
      const row = { team, count: n, max: MAX,
        avg: +(recs.reduce((s,r) => s + r.total, 0) / n).toFixed(2) };
      CRITERIA_KEYS.forEach(c => {
        row[c.id] = +(recs.reduce((s,r) => {
          const sc = typeof r.scores === 'object' ? r.scores : JSON.parse(r.scores || '{}');
          return s + (sc[c.id] || 0);
        }, 0) / n).toFixed(2);
      });
      s2.addRow(row);
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="NadiCare_Evaluations_${date}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Excel export error:', err.message);
    res.status(500).json({ error: 'Export failed' });
  }
});

// ════════════════════════════════════════════════════════════
// START
// ════════════════════════════════════════════════════════════
initDB().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    const nets = os.networkInterfaces();
    let localIP = 'localhost';
    for (const ifaces of Object.values(nets))
      for (const iface of ifaces)
        if (iface.family === 'IPv4' && !iface.internal) { localIP = iface.address; break; }

    console.log('\n╔══════════════════════════════════════════════════╗');
    console.log('║     NadiCare Hackathon Evaluator — RUNNING       ║');
    console.log('╠══════════════════════════════════════════════════╣');
    console.log(`║  Local:   http://localhost:${PORT}                  ║`);
    console.log(`║  Network: http://${localIP}:${PORT}            ║`);
    console.log('╠══════════════════════════════════════════════════╣');
    console.log(`║  Admin:   http://localhost:${PORT}/admin/           ║`);
    console.log(`║  Admin:   ${ADMIN_USERNAME} / ${ADMIN_PASSWORD}               ║`);
    console.log('╚══════════════════════════════════════════════════╝\n');
  });
}).catch(err => {
  console.error('[DB] Init failed:', err.message);
  process.exit(1);
});
