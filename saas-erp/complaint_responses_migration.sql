-- ============================================================
-- Complaint Responses Migration
-- Moves response threads off the JSONB column on complaints
-- into a proper child table for safe concurrent writes.
-- Safe to re-run (IF NOT EXISTS guards).
-- ============================================================

CREATE TABLE IF NOT EXISTS complaint_responses (
  id           UUID        DEFAULT uuid_generate_v4() PRIMARY KEY,
  complaint_id UUID        NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  school_id    UUID        NOT NULL REFERENCES schools(id)    ON DELETE CASCADE,
  author_name  TEXT        NOT NULL DEFAULT 'Unknown',
  author_role  TEXT        NOT NULL DEFAULT 'staff',
  message      TEXT        NOT NULL,
  is_internal  BOOLEAN     NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_complaint_resp_complaint ON complaint_responses (complaint_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_complaint_resp_school    ON complaint_responses (school_id);

ALTER TABLE complaint_responses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow All" ON complaint_responses;
CREATE POLICY "Allow All" ON complaint_responses
  FOR ALL USING (true) WITH CHECK (true);

-- NOTE: Existing JSONB responses in complaints.responses remain intact.
-- The frontend combines both sources so no history is lost.
-- After confirming everything works you may run:
--   ALTER TABLE complaints DROP COLUMN IF EXISTS responses;
-- to clean up (optional — wait until all existing threads are
-- naturally superseded by new responses).
