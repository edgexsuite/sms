-- ============================================================
-- Audit Log Migration
-- Run in Supabase SQL Editor — safe to re-run anytime
-- ============================================================

-- 1. Create table if not present
CREATE TABLE IF NOT EXISTS audit_logs (
  id           UUID        DEFAULT uuid_generate_v4() PRIMARY KEY,
  action       TEXT        NOT NULL,
  module       TEXT        NOT NULL,
  description  TEXT        NOT NULL,
  entity_type  TEXT,
  entity_id    TEXT,
  entity_name  TEXT,
  details      JSONB,
  metadata     JSONB,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Safely add school_id, user_name, user_role, user_id columns if table already existed
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_name TEXT DEFAULT 'Unknown';
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_role TEXT DEFAULT 'unknown';
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS metadata JSONB;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS details JSONB;

-- 3. JSONB indexes for blazing fast school audit trail lookups
CREATE INDEX IF NOT EXISTS idx_audit_meta_school ON audit_logs ((metadata->>'school_id'), created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_det_school  ON audit_logs ((details->>'school_id'), created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_created_at  ON audit_logs (created_at DESC);

-- 4. Enable Row Level Security and Allow All policy
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow All" ON audit_logs;
CREATE POLICY "Allow All" ON audit_logs
  FOR ALL USING (true) WITH CHECK (true);
