-- ============================================================
-- THE EDGE SCHOOL, BAHAWALPUR — Seed Data
-- Run this in Supabase SQL Editor
--
-- IMPORTANT: Replace <YOUR_SCHOOL_ID> with your actual school UUID.
-- To find it: SELECT id FROM schools LIMIT 5;
-- ============================================================

DO $$
DECLARE
  sid UUID := (SELECT id FROM schools ORDER BY created_at LIMIT 1); -- auto-picks first school

  -- Class IDs
  c_ef1  UUID; c_ef2  UUID; c_ef3  UUID;
  c_g1   UUID; c_g2   UUID; c_g3   UUID;
  c_g4   UUID; c_g5   UUID; c_g6   UUID;
  c_g7   UUID; c_g8   UUID;

BEGIN
  RAISE NOTICE 'Seeding for school_id = %', sid;

  -- ──────────────────────────────────────────────────────────
  -- 1. CLASSES (name + section 'A' as default)
  -- ──────────────────────────────────────────────────────────

  INSERT INTO classes (school_id, name, section)
    VALUES (sid, 'EF-1', 'A')
    ON CONFLICT DO NOTHING
    RETURNING id INTO c_ef1;
  IF c_ef1 IS NULL THEN
    SELECT id INTO c_ef1 FROM classes WHERE school_id = sid AND name = 'EF-1' LIMIT 1;
  END IF;

  INSERT INTO classes (school_id, name, section)
    VALUES (sid, 'EF-2', 'A')
    ON CONFLICT DO NOTHING
    RETURNING id INTO c_ef2;
  IF c_ef2 IS NULL THEN
    SELECT id INTO c_ef2 FROM classes WHERE school_id = sid AND name = 'EF-2' LIMIT 1;
  END IF;

  INSERT INTO classes (school_id, name, section)
    VALUES (sid, 'EF-3', 'A')
    ON CONFLICT DO NOTHING
    RETURNING id INTO c_ef3;
  IF c_ef3 IS NULL THEN
    SELECT id INTO c_ef3 FROM classes WHERE school_id = sid AND name = 'EF-3' LIMIT 1;
  END IF;

  INSERT INTO classes (school_id, name, section)
    VALUES (sid, 'Grade-1', 'A')
    ON CONFLICT DO NOTHING
    RETURNING id INTO c_g1;
  IF c_g1 IS NULL THEN
    SELECT id INTO c_g1 FROM classes WHERE school_id = sid AND name = 'Grade-1' LIMIT 1;
  END IF;

  INSERT INTO classes (school_id, name, section)
    VALUES (sid, 'Grade-2', 'A')
    ON CONFLICT DO NOTHING
    RETURNING id INTO c_g2;
  IF c_g2 IS NULL THEN
    SELECT id INTO c_g2 FROM classes WHERE school_id = sid AND name = 'Grade-2' LIMIT 1;
  END IF;

  INSERT INTO classes (school_id, name, section)
    VALUES (sid, 'Grade-3', 'A')
    ON CONFLICT DO NOTHING
    RETURNING id INTO c_g3;
  IF c_g3 IS NULL THEN
    SELECT id INTO c_g3 FROM classes WHERE school_id = sid AND name = 'Grade-3' LIMIT 1;
  END IF;

  INSERT INTO classes (school_id, name, section)
    VALUES (sid, 'Grade-4', 'A')
    ON CONFLICT DO NOTHING
    RETURNING id INTO c_g4;
  IF c_g4 IS NULL THEN
    SELECT id INTO c_g4 FROM classes WHERE school_id = sid AND name = 'Grade-4' LIMIT 1;
  END IF;

  INSERT INTO classes (school_id, name, section)
    VALUES (sid, 'Grade-5', 'A')
    ON CONFLICT DO NOTHING
    RETURNING id INTO c_g5;
  IF c_g5 IS NULL THEN
    SELECT id INTO c_g5 FROM classes WHERE school_id = sid AND name = 'Grade-5' LIMIT 1;
  END IF;

  INSERT INTO classes (school_id, name, section)
    VALUES (sid, 'Grade-6', 'A')
    ON CONFLICT DO NOTHING
    RETURNING id INTO c_g6;
  IF c_g6 IS NULL THEN
    SELECT id INTO c_g6 FROM classes WHERE school_id = sid AND name = 'Grade-6' LIMIT 1;
  END IF;

  INSERT INTO classes (school_id, name, section)
    VALUES (sid, 'Grade-7', 'A')
    ON CONFLICT DO NOTHING
    RETURNING id INTO c_g7;
  IF c_g7 IS NULL THEN
    SELECT id INTO c_g7 FROM classes WHERE school_id = sid AND name = 'Grade-7' LIMIT 1;
  END IF;

  INSERT INTO classes (school_id, name, section)
    VALUES (sid, 'Grade-8', 'A')
    ON CONFLICT DO NOTHING
    RETURNING id INTO c_g8;
  IF c_g8 IS NULL THEN
    SELECT id INTO c_g8 FROM classes WHERE school_id = sid AND name = 'Grade-8' LIMIT 1;
  END IF;

  RAISE NOTICE 'Classes created. EF-1=% EF-2=% EF-3=% G1=% G2=% G3=% G4=% G5=% G6=% G7=% G8=%',
    c_ef1, c_ef2, c_ef3, c_g1, c_g2, c_g3, c_g4, c_g5, c_g6, c_g7, c_g8;

  -- ──────────────────────────────────────────────────────────
  -- 2. SUBJECTS — extracted from weekly diary PDF
  -- ──────────────────────────────────────────────────────────

  -- EF-1: English, Urdu, Math, Islamiat
  INSERT INTO subjects (school_id, class_id, subject_name, subject_code, total_marks, passing_marks)
  VALUES
    (sid, c_ef1, 'English',   'ENG-EF1',   50, 25),
    (sid, c_ef1, 'Urdu',      'URD-EF1',   50, 25),
    (sid, c_ef1, 'Math',      'MTH-EF1',   50, 25),
    (sid, c_ef1, 'Islamiat',  'ISL-EF1',   50, 25)
  ON CONFLICT (class_id, subject_name) DO NOTHING;

  -- EF-2: English, Urdu, Math, Rhymes, Islamiat
  INSERT INTO subjects (school_id, class_id, subject_name, subject_code, total_marks, passing_marks)
  VALUES
    (sid, c_ef2, 'English',   'ENG-EF2',   50, 25),
    (sid, c_ef2, 'Urdu',      'URD-EF2',   50, 25),
    (sid, c_ef2, 'Math',      'MTH-EF2',   50, 25),
    (sid, c_ef2, 'Rhymes',    'RHY-EF2',   50, 25),
    (sid, c_ef2, 'Islamiat',  'ISL-EF2',   50, 25)
  ON CONFLICT (class_id, subject_name) DO NOTHING;

  -- EF-3: English, Urdu, Math, Rhymes, Islamiat
  INSERT INTO subjects (school_id, class_id, subject_name, subject_code, total_marks, passing_marks)
  VALUES
    (sid, c_ef3, 'English',   'ENG-EF3',   50, 25),
    (sid, c_ef3, 'Urdu',      'URD-EF3',   50, 25),
    (sid, c_ef3, 'Math',      'MTH-EF3',   50, 25),
    (sid, c_ef3, 'Rhymes',    'RHY-EF3',   50, 25),
    (sid, c_ef3, 'Islamiat',  'ISL-EF3',   50, 25)
  ON CONFLICT (class_id, subject_name) DO NOTHING;

  -- Grade-1: English, Urdu, Math, Computer, Social Studies, Islamiat
  INSERT INTO subjects (school_id, class_id, subject_name, subject_code, total_marks, passing_marks)
  VALUES
    (sid, c_g1, 'English',        'ENG-G1',  100, 40),
    (sid, c_g1, 'Urdu',           'URD-G1',  100, 40),
    (sid, c_g1, 'Math',           'MTH-G1',  100, 40),
    (sid, c_g1, 'Computer',       'CMP-G1',  100, 40),
    (sid, c_g1, 'Social Studies', 'SST-G1',  100, 40),
    (sid, c_g1, 'Islamiat',       'ISL-G1',  100, 40)
  ON CONFLICT (class_id, subject_name) DO NOTHING;

  -- Grade-2: English, Urdu, Math, Computer, Islamiat
  INSERT INTO subjects (school_id, class_id, subject_name, subject_code, total_marks, passing_marks)
  VALUES
    (sid, c_g2, 'English',   'ENG-G2',  100, 40),
    (sid, c_g2, 'Urdu',      'URD-G2',  100, 40),
    (sid, c_g2, 'Math',      'MTH-G2',  100, 40),
    (sid, c_g2, 'Computer',  'CMP-G2',  100, 40),
    (sid, c_g2, 'Islamiat',  'ISL-G2',  100, 40)
  ON CONFLICT (class_id, subject_name) DO NOTHING;

  -- Grade-3: English, Urdu, Math, Computer, Islamiat
  INSERT INTO subjects (school_id, class_id, subject_name, subject_code, total_marks, passing_marks)
  VALUES
    (sid, c_g3, 'English',   'ENG-G3',  100, 40),
    (sid, c_g3, 'Urdu',      'URD-G3',  100, 40),
    (sid, c_g3, 'Math',      'MTH-G3',  100, 40),
    (sid, c_g3, 'Computer',  'CMP-G3',  100, 40),
    (sid, c_g3, 'Islamiat',  'ISL-G3',  100, 40)
  ON CONFLICT (class_id, subject_name) DO NOTHING;

  -- Grade-4: English, Urdu, Math, Computer, Islamiat
  INSERT INTO subjects (school_id, class_id, subject_name, subject_code, total_marks, passing_marks)
  VALUES
    (sid, c_g4, 'English',   'ENG-G4',  100, 40),
    (sid, c_g4, 'Urdu',      'URD-G4',  100, 40),
    (sid, c_g4, 'Math',      'MTH-G4',  100, 40),
    (sid, c_g4, 'Computer',  'CMP-G4',  100, 40),
    (sid, c_g4, 'Islamiat',  'ISL-G4',  100, 40)
  ON CONFLICT (class_id, subject_name) DO NOTHING;

  -- Grade-5: English, Urdu, Math, Computer, Islamiat
  INSERT INTO subjects (school_id, class_id, subject_name, subject_code, total_marks, passing_marks)
  VALUES
    (sid, c_g5, 'English',   'ENG-G5',  100, 40),
    (sid, c_g5, 'Urdu',      'URD-G5',  100, 40),
    (sid, c_g5, 'Math',      'MTH-G5',  100, 40),
    (sid, c_g5, 'Computer',  'CMP-G5',  100, 40),
    (sid, c_g5, 'Islamiat',  'ISL-G5',  100, 40)
  ON CONFLICT (class_id, subject_name) DO NOTHING;

  -- Grade-6: English, Urdu, Math, Science, History, Islamiat
  INSERT INTO subjects (school_id, class_id, subject_name, subject_code, total_marks, passing_marks)
  VALUES
    (sid, c_g6, 'English',   'ENG-G6',  100, 40),
    (sid, c_g6, 'Urdu',      'URD-G6',  100, 40),
    (sid, c_g6, 'Math',      'MTH-G6',  100, 40),
    (sid, c_g6, 'Science',   'SCI-G6',  100, 40),
    (sid, c_g6, 'History',   'HIS-G6',  100, 40),
    (sid, c_g6, 'Islamiat',  'ISL-G6',  100, 40)
  ON CONFLICT (class_id, subject_name) DO NOTHING;

  -- Grade-7: English, Urdu, Math, Science, History, Islamiat
  INSERT INTO subjects (school_id, class_id, subject_name, subject_code, total_marks, passing_marks)
  VALUES
    (sid, c_g7, 'English',   'ENG-G7',  100, 40),
    (sid, c_g7, 'Urdu',      'URD-G7',  100, 40),
    (sid, c_g7, 'Math',      'MTH-G7',  100, 40),
    (sid, c_g7, 'Science',   'SCI-G7',  100, 40),
    (sid, c_g7, 'History',   'HIS-G7',  100, 40),
    (sid, c_g7, 'Islamiat',  'ISL-G7',  100, 40)
  ON CONFLICT (class_id, subject_name) DO NOTHING;

  -- Grade-8: English, Urdu, Math, Science, History, Islamiat
  INSERT INTO subjects (school_id, class_id, subject_name, subject_code, total_marks, passing_marks)
  VALUES
    (sid, c_g8, 'English',   'ENG-G8',  100, 40),
    (sid, c_g8, 'Urdu',      'URD-G8',  100, 40),
    (sid, c_g8, 'Math',      'MTH-G8',  100, 40),
    (sid, c_g8, 'Science',   'SCI-G8',  100, 40),
    (sid, c_g8, 'History',   'HIS-G8',  100, 40),
    (sid, c_g8, 'Islamiat',  'ISL-G8',  100, 40)
  ON CONFLICT (class_id, subject_name) DO NOTHING;

  RAISE NOTICE 'Subjects inserted for all 11 classes.';

  -- ──────────────────────────────────────────────────────────
  -- 3. PAKISTANI EXPENSE HEADS
  -- ──────────────────────────────────────────────────────────

  INSERT INTO expense_heads (school_id, name, description)
  VALUES
    -- Utilities
    (sid, 'Electricity Bill',        'Monthly WAPDA / MEPCO electricity bill payment'),
    (sid, 'Gas Bill',                'SNGPL / SSGC natural gas utility bill'),
    (sid, 'Water Bill / WASA',       'Municipal water supply charges'),
    (sid, 'Internet & Broadband',    'Monthly internet service provider charges'),
    (sid, 'Telephone Bill',          'Landline / mobile phone bills'),
    -- Office & Stationery
    (sid, 'Stationery & Supplies',   'Pens, paper, registers, markers, files, folders'),
    (sid, 'Photocopy / Printing',    'Photocopier usage, cartridges, toner, printing costs'),
    (sid, 'Computer Supplies',       'Ink, USB drives, hardware accessories'),
    (sid, 'Office Furniture',        'Chairs, tables, cabinets, shelving'),
    -- Canteen & Kitchen
    (sid, 'Tea & Refreshments',      'Daily tea, coffee, biscuits for staff'),
    (sid, 'Canteen Supplies',        'Food items, crockery, utensils for school canteen'),
    (sid, 'Water Dispenser / Cooler','Water cooler maintenance, water jars / gallons'),
    -- Repairs & Maintenance
    (sid, 'Building Repair',         'Masonry, plastering, painting, civil work'),
    (sid, 'Electrical Repair',       'Wiring, fixtures, fan/AC repair'),
    (sid, 'Plumbing & Sanitation',   'Pipe work, washroom maintenance, drainage'),
    (sid, 'Furniture Repair',        'Chair, table, and bench repair or replacement'),
    (sid, 'Generator Maintenance',   'Generator fuel, servicing, and repair'),
    (sid, 'AC / Fan Repair',         'Air conditioner and fan servicing'),
    -- Salaries & HR
    (sid, 'Teaching Staff Salaries', 'Monthly salary disbursement to teaching staff'),
    (sid, 'Non-Teaching Salaries',   'Peon, guard, cleaner, admin staff salaries'),
    (sid, 'Staff Bonus / Eid Grant', 'Eid bonus, annual increment payments'),
    (sid, 'Staff Conveyance',        'Transport allowance or fuel reimbursement'),
    -- Academic
    (sid, 'Books & Textbooks',       'Purchase of student and library books'),
    (sid, 'Lab Equipment',           'Science lab instruments, chemicals, glassware'),
    (sid, 'Computer Lab Supplies',   'Computer hardware, software, accessories'),
    (sid, 'Sports Equipment',        'Cricket bat, football, badminton, other gear'),
    (sid, 'Art & Craft Supplies',    'Drawing sheets, paints, craft material'),
    (sid, 'Exam / Test Printing',    'Paper, printing for exams and assessments'),
    -- Cleaning & Sanitation
    (sid, 'Cleaning Supplies',       'Phenyl, detergent, mops, brooms, dustbins'),
    (sid, 'Garbage Disposal',        'Waste collection and disposal charges'),
    -- Transport
    (sid, 'Vehicle Fuel',            'Petrol/CNG for school van/bus'),
    (sid, 'Vehicle Repair',          'Van/bus mechanical repair and servicing'),
    (sid, 'Vehicle Insurance / Tax', 'Annual vehicle registration, token, insurance'),
    -- Security & Safety
    (sid, 'Security Guard Services', 'Salary or agency charges for security staff'),
    (sid, 'CCTV & Security System',  'Camera installation, maintenance, DVR charges'),
    (sid, 'Fire Safety Equipment',   'Fire extinguisher refill and maintenance'),
    -- Events & Miscellaneous
    (sid, 'Annual Function / Events','Decoration, stage, sound system for events'),
    (sid, 'Prize Distribution',      'Trophies, shields, medals, prize items'),
    (sid, 'Charity & Donations',     'Zakat, sadaqah, institutional donations'),
    (sid, 'Bank Charges / Tax',      'Bank service charges, withholding tax, FBR'),
    (sid, 'Miscellaneous Expenses',  'Any other unclassified school expenditure'),
    (sid, 'Postage & Courier',       'Speed post, TCS, Leopards courier charges'),
    (sid, 'Advertisement',           'Newspaper ads, banners, pamphlets for admissions')
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Expense heads inserted.';
  RAISE NOTICE '✅ Seed complete for The Edge School, Bahawalpur.';

END $$;

-- ──────────────────────────────────────────────────────────
-- Quick verification queries (run after the block above)
-- ──────────────────────────────────────────────────────────
-- SELECT name, section FROM classes ORDER BY name;
-- SELECT c.name AS class, s.subject_name, s.subject_code FROM subjects s JOIN classes c ON c.id = s.class_id ORDER BY c.name, s.subject_name;
-- SELECT name, description FROM expense_heads ORDER BY name;
