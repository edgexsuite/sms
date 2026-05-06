-- ============================================================
-- Substitute / Fixture Assignments Migration
-- Run in Supabase SQL Editor — safe to re-run
-- ============================================================

CREATE TABLE IF NOT EXISTS substitute_assignments (
  id                    UUID    DEFAULT uuid_generate_v4() PRIMARY KEY,
  school_id             UUID    NOT NULL REFERENCES schools(id)  ON DELETE CASCADE,
  date                  DATE    NOT NULL,
  absent_teacher_id     UUID    NOT NULL REFERENCES staff(id)    ON DELETE CASCADE,
  substitute_teacher_id UUID             REFERENCES staff(id)    ON DELETE SET NULL,
  class_id              UUID             REFERENCES classes(id)  ON DELETE SET NULL,
  subject_id            UUID             REFERENCES subjects(id) ON DELETE SET NULL,
  period_number         INT     NOT NULL,
  day_of_week           TEXT    NOT NULL,
  slot_label            TEXT,
  start_time            TEXT,
  end_time              TEXT,
  created_by            UUID,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (school_id, date, absent_teacher_id, period_number, class_id)
);

CREATE INDEX IF NOT EXISTS idx_sub_assign_date       ON substitute_assignments (school_id, date);
CREATE INDEX IF NOT EXISTS idx_sub_assign_absent     ON substitute_assignments (absent_teacher_id);
CREATE INDEX IF NOT EXISTS idx_sub_assign_substitute ON substitute_assignments (substitute_teacher_id);

ALTER TABLE substitute_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow All" ON substitute_assignments;
CREATE POLICY "Allow All" ON substitute_assignments
  FOR ALL USING (true) WITH CHECK (true);
