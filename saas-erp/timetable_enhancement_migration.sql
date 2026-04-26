-- ============================================================
-- TIMETABLE ENHANCEMENT MIGRATION
-- Run in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- ============================================================

-- 1. Period Templates table
CREATE TABLE IF NOT EXISTS period_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- 2. Period Template Rows  (ordered list of time slots per template)
CREATE TABLE IF NOT EXISTS period_template_rows (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES period_templates(id) ON DELETE CASCADE,
  school_id   UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  sort_order  INTEGER NOT NULL DEFAULT 1,
  label       TEXT NOT NULL,
  slot_type   TEXT NOT NULL DEFAULT 'period'
                CHECK (slot_type IN ('period', 'break', 'assembly')),
  start_time  TIME,
  end_time    TIME,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- 3. Link each class to a period template
ALTER TABLE classes
  ADD COLUMN IF NOT EXISTS period_template_id UUID
    REFERENCES period_templates(id) ON DELETE SET NULL;

-- 4. Extend timetable_slots to support template-based rows
ALTER TABLE timetable_slots
  ADD COLUMN IF NOT EXISTS template_row_id UUID
    REFERENCES period_template_rows(id) ON DELETE SET NULL;

ALTER TABLE timetable_slots
  ADD COLUMN IF NOT EXISTS slot_label TEXT;

ALTER TABLE timetable_slots
  ADD COLUMN IF NOT EXISTS is_combined_class BOOLEAN DEFAULT false;

-- 5. Enable RLS on new tables
ALTER TABLE period_templates     ENABLE ROW LEVEL SECURITY;
ALTER TABLE period_template_rows ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies
DROP POLICY IF EXISTS "school_access_period_templates"     ON period_templates;
DROP POLICY IF EXISTS "school_access_period_template_rows" ON period_template_rows;

CREATE POLICY "school_access_period_templates"
  ON period_templates FOR ALL
  USING (
    school_id IN (
      SELECT school_id FROM user_roles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "school_access_period_template_rows"
  ON period_template_rows FOR ALL
  USING (
    school_id IN (
      SELECT school_id FROM user_roles WHERE user_id = auth.uid()
    )
  );

-- Done!
-- After running, go to Timetable → Period Templates tab and apply presets.
