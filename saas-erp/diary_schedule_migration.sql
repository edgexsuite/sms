-- ============================================================
-- Diary Schedule Migration
-- Run in Supabase SQL Editor
-- Safe to re-run
-- ============================================================

CREATE TABLE IF NOT EXISTS diary_schedule (
  id           UUID    DEFAULT uuid_generate_v4() PRIMARY KEY,
  school_id    UUID    NOT NULL REFERENCES schools(id)  ON DELETE CASCADE,
  class_id     UUID    NOT NULL REFERENCES classes(id)  ON DELETE CASCADE,
  day_of_week  TEXT    NOT NULL
                CHECK (day_of_week IN ('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday')),
  subject_id   UUID    NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  slot_order   INT     NOT NULL DEFAULT 1,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (class_id, day_of_week, subject_id)
);

CREATE INDEX IF NOT EXISTS idx_diary_schedule_class_day
  ON diary_schedule (class_id, day_of_week);

ALTER TABLE diary_schedule ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow All" ON diary_schedule;
CREATE POLICY "Allow All" ON diary_schedule
  FOR ALL USING (true) WITH CHECK (true);
