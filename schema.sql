-- ═══════════════════════════════════════════════════════════
-- NadiCare Hackathon Evaluator — Supabase / PostgreSQL Schema
-- Run this in the Supabase SQL Editor (one time only)
-- ═══════════════════════════════════════════════════════════

-- Teams participating in the hackathon
CREATE TABLE IF NOT EXISTS teams (
  id                SERIAL PRIMARY KEY,
  name              TEXT NOT NULL UNIQUE,
  problem_statement TEXT NOT NULL,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Judges / evaluators (login credentials stored here)
CREATE TABLE IF NOT EXISTS judges (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  username   TEXT NOT NULL UNIQUE,
  password   TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Evaluations submitted by judges
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

-- ─────────────────────────────────────────────────────────────
-- Sample seed data (optional — delete if not needed)
-- ─────────────────────────────────────────────────────────────

INSERT INTO teams (name, problem_statement) VALUES
  ('Team Alpha',   'AI-powered early detection of cardiovascular diseases using wearable sensor data'),
  ('Team Beta',    'Smart medication adherence tracker with IoT pill dispenser and reminder system'),
  ('Team Gamma',   'Telemedicine platform for rural healthcare with offline-first capabilities'),
  ('Team Delta',   'Mental health monitoring app using NLP to analyze speech and behavioral patterns'),
  ('Team Epsilon', 'Blockchain-based patient data management system for secure cross-hospital sharing'),
  ('Team Zeta',    'Automated diagnostic tool for diabetic retinopathy using fundus image analysis'),
  ('Team Eta',     'Emergency response coordination platform integrating real-time ambulance routing'),
  ('Team Theta',   'Predictive analytics system for hospital bed management and patient flow optimization')
ON CONFLICT (name) DO NOTHING;

-- Add your first admin judge (change password before use!)
INSERT INTO judges (name, username, password) VALUES
  ('Head Judge', 'judge1', 'nadicare2025')
ON CONFLICT (username) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- Useful queries for reference
-- ─────────────────────────────────────────────────────────────

-- View all evaluations with scores:
-- SELECT * FROM evaluations ORDER BY created_at DESC;

-- Team leaderboard (average scores):
-- SELECT team,
--        COUNT(*)                              AS evaluations,
--        ROUND(AVG(total)::numeric, 2)         AS avg_total,
--        MAX(total)                            AS best_score
-- FROM evaluations
-- GROUP BY team
-- ORDER BY avg_total DESC;

-- Per-judge submission count:
-- SELECT evaluator, COUNT(*) AS submissions FROM evaluations GROUP BY evaluator;
