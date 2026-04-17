-- ============================================================
-- STUDENT STATIONARY MANAGEMENT SYSTEM
-- Unified Ledger for "The Edge School"
-- ============================================================

-- 1. Class-wise Stationary Templates
CREATE TABLE IF NOT EXISTS stationary_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  class_name TEXT NOT NULL, -- e.g. "EF-1", "Grade-1"
  items JSONB NOT NULL,     -- e.g. [{"name": "Pencils", "quantity": 24}, ...]
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(school_id, class_name)
);

-- 2. Student Stationary Ledger (Current Balances)
CREATE TABLE IF NOT EXISTS student_stationary_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  required_qty INTEGER DEFAULT 0,
  received_qty INTEGER DEFAULT 0,
  consumed_qty INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(student_id, item_name)
);

-- RLS
ALTER TABLE stationary_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_stationary_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow All" ON stationary_templates;
CREATE POLICY "Allow All" ON stationary_templates FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow All" ON student_stationary_ledger;
CREATE POLICY "Allow All" ON student_stationary_ledger FOR ALL USING (true);

-- 3. INITIAL SEEDING FOR THE EDGE SCHOOL
-- Run this block once you have your school_id
/*
DO $$
DECLARE
  sid UUID := (SELECT id FROM schools LIMIT 1);
BEGIN
  -- EF-1, EF-2, EF-3 Template
  INSERT INTO stationary_templates (school_id, class_name, items)
  VALUES (sid, 'EF-1', '[
    {"name": "Glaze Sheet", "quantity": 3},
    {"name": "Glitter Sheet", "quantity": 2},
    {"name": "Colour Page A4", "quantity": 15},
    {"name": "UHU Glue", "quantity": 1},
    {"name": "Colour Pencils", "quantity": 2},
    {"name": "Crayons", "quantity": 2},
    {"name": "Charts", "quantity": 3},
    {"name": "Glue Stick", "quantity": 2},
    {"name": "Scotch Tape (Big)", "quantity": 1},
    {"name": "Clip File", "quantity": 1},
    {"name": "Clear Bag", "quantity": 2},
    {"name": "Crape Paper", "quantity": 2},
    {"name": "Fomic Sheet", "quantity": 2},
    {"name": "Tissue Box", "quantity": 1},
    {"name": "Pencils", "quantity": 24},
    {"name": "Erasers", "quantity": 6},
    {"name": "Sharpeners", "quantity": 6},
    {"name": "Scissors", "quantity": 1},
    {"name": "A4 Pack", "quantity": 1},
    {"name": "Poster Colours", "quantity": 3},
    {"name": "Paint Brush", "quantity": 2},
    {"name": "Diary", "quantity": 1}
  ]'::jsonb),
  (sid, 'EF-2', '[
    {"name": "Glaze Sheet", "quantity": 3},
    {"name": "Glitter Sheet", "quantity": 2},
    {"name": "Colour Page A4", "quantity": 15},
    {"name": "UHU Glue", "quantity": 1},
    {"name": "Colour Pencils", "quantity": 2},
    {"name": "Crayons", "quantity": 2},
    {"name": "Charts", "quantity": 3},
    {"name": "Glue Stick", "quantity": 2},
    {"name": "Scotch Tape (Big)", "quantity": 1},
    {"name": "Clip File", "quantity": 1},
    {"name": "Clear Bag", "quantity": 2},
    {"name": "Crape Paper", "quantity": 2},
    {"name": "Fomic Sheet", "quantity": 2},
    {"name": "Tissue Box", "quantity": 1},
    {"name": "Pencils", "quantity": 24},
    {"name": "Erasers", "quantity": 6},
    {"name": "Sharpeners", "quantity": 6},
    {"name": "Scissors", "quantity": 1},
    {"name": "A4 Pack", "quantity": 1},
    {"name": "Poster Colours", "quantity": 3},
    {"name": "Paint Brush", "quantity": 2},
    {"name": "Diary", "quantity": 1}
  ]'::jsonb),
  (sid, 'EF-3', '[
    {"name": "Glaze Sheet", "quantity": 3},
    {"name": "Glitter Sheet", "quantity": 2},
    {"name": "Colour Page A4", "quantity": 15},
    {"name": "UHU Glue", "quantity": 1},
    {"name": "Colour Pencils", "quantity": 2},
    {"name": "Crayons", "quantity": 2},
    {"name": "Charts", "quantity": 3},
    {"name": "Glue Stick", "quantity": 2},
    {"name": "Scotch Tape (Big)", "quantity": 1},
    {"name": "Clip File", "quantity": 1},
    {"name": "Clear Bag", "quantity": 2},
    {"name": "Crape Paper", "quantity": 2},
    {"name": "Fomic Sheet", "quantity": 2},
    {"name": "Tissue Box", "quantity": 1},
    {"name": "Pencils", "quantity": 24},
    {"name": "Erasers", "quantity": 6},
    {"name": "Sharpeners", "quantity": 6},
    {"name": "Scissors", "quantity": 1},
    {"name": "A4 Pack", "quantity": 1},
    {"name": "Poster Colours", "quantity": 3},
    {"name": "Paint Brush", "quantity": 2},
    {"name": "Diary", "quantity": 1}
  ]'::jsonb);

  -- GRADE-1, GRADE-2 Template
  INSERT INTO stationary_templates (school_id, class_name, items)
  VALUES (sid, 'Grade-1', '[
    {"name": "Glaze Sheet", "quantity": 3},
    {"name": "Glitter Sheet", "quantity": 2},
    {"name": "Colour Page A4", "quantity": 15},
    {"name": "UHU Glue", "quantity": 1},
    {"name": "Loose Sheets", "quantity": 2},
    {"name": "Charts", "quantity": 3},
    {"name": "Glue Stick", "quantity": 2},
    {"name": "Scotch Tape (Big)", "quantity": 1},
    {"name": "Clip File", "quantity": 1},
    {"name": "Clear Bag", "quantity": 2},
    {"name": "Crape Paper", "quantity": 2},
    {"name": "Fomic Sheet", "quantity": 2},
    {"name": "Tissue Box", "quantity": 1},
    {"name": "Colour Pencils", "quantity": 1},
    {"name": "Pencils", "quantity": 6},
    {"name": "Erasers", "quantity": 2},
    {"name": "Sharpeners", "quantity": 2},
    {"name": "Scissors", "quantity": 1},
    {"name": "A4 Pack", "quantity": 1},
    {"name": "Diary", "quantity": 1}
  ]'::jsonb),
  (sid, 'Grade-2', '[
    {"name": "Glaze Sheet", "quantity": 3},
    {"name": "Glitter Sheet", "quantity": 2},
    {"name": "Colour Page A4", "quantity": 15},
    {"name": "UHU Glue", "quantity": 1},
    {"name": "Loose Sheets", "quantity": 2},
    {"name": "Charts", "quantity": 3},
    {"name": "Glue Stick", "quantity": 2},
    {"name": "Scotch Tape (Big)", "quantity": 1},
    {"name": "Clip File", "quantity": 1},
    {"name": "Clear Bag", "quantity": 2},
    {"name": "Crape Paper", "quantity": 2},
    {"name": "Fomic Sheet", "quantity": 2},
    {"name": "Tissue Box", "quantity": 1},
    {"name": "Colour Pencils", "quantity": 1},
    {"name": "Pencils", "quantity": 6},
    {"name": "Erasers", "quantity": 2},
    {"name": "Sharpeners", "quantity": 2},
    {"name": "Scissors", "quantity": 1},
    {"name": "A4 Pack", "quantity": 1},
    {"name": "Diary", "quantity": 1}
  ]'::jsonb);

  -- GRADE-3 to GRADE-8 Template
  INSERT INTO stationary_templates (school_id, class_name, items)
  VALUES (sid, 'Grade-3', '[
    {"name": "Glaze Sheet", "quantity": 3},
    {"name": "Glitter Sheet", "quantity": 3},
    {"name": "Colour Page A4", "quantity": 15},
    {"name": "UHU Glue", "quantity": 1},
    {"name": "Loose Sheets", "quantity": 2},
    {"name": "Charts", "quantity": 3},
    {"name": "Glue Stick", "quantity": 2},
    {"name": "Scotch Tape (Big)", "quantity": 1},
    {"name": "Clip File", "quantity": 1},
    {"name": "Clear Bag", "quantity": 2},
    {"name": "Crape Paper", "quantity": 3},
    {"name": "Fomic Sheet", "quantity": 3},
    {"name": "Colour Pencils", "quantity": 1},
    {"name": "Scissors", "quantity": 1},
    {"name": "A4 Pack", "quantity": 1},
    {"name": "Diary", "quantity": 1}
  ]'::jsonb),
  (sid, 'Grade-4', '[
    {"name": "Glaze Sheet", "quantity": 3},
    {"name": "Glitter Sheet", "quantity": 3},
    {"name": "Colour Page A4", "quantity": 15},
    {"name": "UHU Glue", "quantity": 1},
    {"name": "Loose Sheets", "quantity": 2},
    {"name": "Charts", "quantity": 3},
    {"name": "Glue Stick", "quantity": 2},
    {"name": "Scotch Tape (Big)", "quantity": 1},
    {"name": "Clip File", "quantity": 1},
    {"name": "Clear Bag", "quantity": 2},
    {"name": "Crape Paper", "quantity": 3},
    {"name": "Fomic Sheet", "quantity": 3},
    {"name": "Colour Pencils", "quantity": 1},
    {"name": "Scissors", "quantity": 1},
    {"name": "A4 Pack", "quantity": 1},
    {"name": "Diary", "quantity": 1}
  ]'::jsonb),
  (sid, 'Grade-5', '[
    {"name": "Glaze Sheet", "quantity": 3},
    {"name": "Glitter Sheet", "quantity": 3},
    {"name": "Colour Page A4", "quantity": 15},
    {"name": "UHU Glue", "quantity": 1},
    {"name": "Loose Sheets", "quantity": 2},
    {"name": "Charts", "quantity": 3},
    {"name": "Glue Stick", "quantity": 2},
    {"name": "Scotch Tape (Big)", "quantity": 1},
    {"name": "Clip File", "quantity": 1},
    {"name": "Clear Bag", "quantity": 2},
    {"name": "Crape Paper", "quantity": 3},
    {"name": "Fomic Sheet", "quantity": 3},
    {"name": "Colour Pencils", "quantity": 1},
    {"name": "Scissors", "quantity": 1},
    {"name": "A4 Pack", "quantity": 1},
    {"name": "Diary", "quantity": 1}
  ]'::jsonb),
  (sid, 'Grade-6', '[
    {"name": "Glaze Sheet", "quantity": 3},
    {"name": "Glitter Sheet", "quantity": 3},
    {"name": "Colour Page A4", "quantity": 15},
    {"name": "UHU Glue", "quantity": 1},
    {"name": "Loose Sheets", "quantity": 2},
    {"name": "Charts", "quantity": 3},
    {"name": "Glue Stick", "quantity": 2},
    {"name": "Scotch Tape (Big)", "quantity": 1},
    {"name": "Clip File", "quantity": 1},
    {"name": "Clear Bag", "quantity": 2},
    {"name": "Crape Paper", "quantity": 3},
    {"name": "Fomic Sheet", "quantity": 3},
    {"name": "Scissors", "quantity": 1},
    {"name": "A4 Pack", "quantity": 1},
    {"name": "Diary", "quantity": 1}
  ]'::jsonb),
  (sid, 'Grade-7', '[
    {"name": "Glaze Sheet", "quantity": 3},
    {"name": "Glitter Sheet", "quantity": 3},
    {"name": "Colour Page A4", "quantity": 15},
    {"name": "UHU Glue", "quantity": 1},
    {"name": "Loose Sheets", "quantity": 2},
    {"name": "Charts", "quantity": 3},
    {"name": "Glue Stick", "quantity": 2},
    {"name": "Scotch Tape (Big)", "quantity": 1},
    {"name": "Clip File", "quantity": 1},
    {"name": "Clear Bag", "quantity": 2},
    {"name": "Crape Paper", "quantity": 3},
    {"name": "Fomic Sheet", "quantity": 3},
    {"name": "Scissors", "quantity": 1},
    {"name": "A4 Pack", "quantity": 1},
    {"name": "Diary", "quantity": 1}
  ]'::jsonb),
  (sid, 'Grade-8', '[
    {"name": "Glaze Sheet", "quantity": 3},
    {"name": "Glitter Sheet", "quantity": 3},
    {"name": "Colour Page A4", "quantity": 15},
    {"name": "UHU Glue", "quantity": 1},
    {"name": "Loose Sheets", "quantity": 2},
    {"name": "Charts", "quantity": 3},
    {"name": "Glue Stick", "quantity": 2},
    {"name": "Scotch Tape (Big)", "quantity": 1},
    {"name": "Clip File", "quantity": 1},
    {"name": "Clear Bag", "quantity": 2},
    {"name": "Crape Paper", "quantity": 3},
    {"name": "Fomic Sheet", "quantity": 3},
    {"name": "Scissors", "quantity": 1},
    {"name": "A4 Pack", "quantity": 1},
    {"name": "Diary", "quantity": 1}
  ]'::jsonb)
  ON CONFLICT (school_id, class_name) DO NOTHING;
END $$;
*/
