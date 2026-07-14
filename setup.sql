-- ================================================================
--  biokey.ATC — Supabase Schema
--  Запусти в Supabase Dashboard → SQL Editor → New query
-- ================================================================

-- ── CONFIG (SIP-сервер) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS config (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  server      TEXT        DEFAULT '',
  domain      TEXT        DEFAULT '',
  sip_user    TEXT        DEFAULT '',
  sip_pass    TEXT        DEFAULT '',
  stun        TEXT        DEFAULT 'stun:stun.l.google.com:19302',
  reg_timeout INT         DEFAULT 300,
  preset      TEXT        DEFAULT 'custom',
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- ── OPERATORS (операторы) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS operators (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL,
  ext        TEXT        DEFAULT '',
  pass       TEXT        DEFAULT '',
  role       TEXT        DEFAULT 'operator',   -- operator | senior | admin
  status     TEXT        DEFAULT 'active',     -- active | inactive
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── CDR (история звонков) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cdr (
  id   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  num  TEXT        DEFAULT '',
  type TEXT        DEFAULT 'miss',  -- in | out | miss
  dur  INT         DEFAULT 0,       -- длительность в секундах
  op   TEXT        DEFAULT '',      -- имя оператора
  time TIMESTAMPTZ DEFAULT now()
);

-- ── ADMIN CONFIG (учётные данные администратора) ─────────────────
CREATE TABLE IF NOT EXISTS admin_config (
  id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  login TEXT DEFAULT 'admin',
  pass  TEXT DEFAULT 'admin'
);

-- Вставляем дефолтного администратора (admin / admin)
INSERT INTO admin_config (login, pass)
SELECT 'admin', 'admin'
WHERE NOT EXISTS (SELECT 1 FROM admin_config);

-- ── ИНДЕКСЫ ───────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_cdr_time   ON cdr (time DESC);
CREATE INDEX IF NOT EXISTS idx_cdr_op     ON cdr (op);
CREATE INDEX IF NOT EXISTS idx_cdr_type   ON cdr (type);
CREATE INDEX IF NOT EXISTS idx_ops_status ON operators (status);

-- ── ROW LEVEL SECURITY ───────────────────────────────────────────
-- Отключено для простоты. В продакшне включи RLS и настрой политики.
ALTER TABLE config       DISABLE ROW LEVEL SECURITY;
ALTER TABLE operators    DISABLE ROW LEVEL SECURITY;
ALTER TABLE cdr          DISABLE ROW LEVEL SECURITY;
ALTER TABLE admin_config DISABLE ROW LEVEL SECURITY;

-- ================================================================
--  Готово! Теперь:
--  1. Скопируй Project URL и anon key из Settings → API
--  2. Вставь их в db.js (SUPABASE_URL, SUPABASE_ANON_KEY)
--  3. Задеплой на Vercel через GitHub
-- ================================================================
