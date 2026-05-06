-- ============================================================
-- Audit Log Migration
-- Run in Supabase SQL Editor — safe to re-run
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id           UUID        DEFAULT uuid_generate_v4() PRIMARY KEY,
  school_id    UUID        NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  user_id      UUID,
  user_name    TEXT        NOT NULL DEFAULT 'Unknown',
  user_role    TEXT        NOT NULL DEFAULT 'unknown',
  action       TEXT        NOT NULL,  -- CREATE | UPDATE | DELETE | LOGIN | LOGOUT | PAY | EXPORT | PRINT | APPROVE | REJECT | ASSIGN
  module       TEXT        NOT NULL,  -- Students | Fees | Attendance | Staff | Results | Expenses | Payroll | Auth | ...
  entity_type  TEXT,                  -- 'student', 'fee_record', 'staff', etc.
  entity_id    TEXT,
  entity_name  TEXT,
  description  TEXT        NOT NULL,
  metadata     JSONB,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_school_date   ON audit_logs (school_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_user          ON audit_logs (school_id, user_id);
CREATE INDEX IF NOT EXISTS idx_audit_module        ON audit_logs (school_id, module);
CREATE INDEX IF NOT EXISTS idx_audit_action        ON audit_logs (school_id, action);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow All" ON audit_logs;
CREATE POLICY "Allow All" ON audit_logs
  FOR ALL USING (true) WITH CHECK (true);
