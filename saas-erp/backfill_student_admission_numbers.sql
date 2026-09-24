-- ============================================================
-- EdgeX Suite: Standardized Student Admission / Registration Number Backfill
-- Format: {YYYY}-{CLASS_CODE}-{SEQUENCE}
-- Example: 2026-EF1-0001, 2026-G01-0042
--
-- Features:
-- 1. Preserves old student_unique_id in custom_data->>'previous_student_unique_id'
-- 2. Derives class code from classes.name:
--    - Early Foundation: EF-1 -> EF1, EF-2 -> EF2, EF-3 -> EF3
--    - Grades 1-12: Grade 1 -> G01, Grade 2 -> G02 ... Grade 10 -> G10
--    - Pre-school: Playgroup -> PG, Nursery -> NUR, Prep/KG -> PREP
-- 3. Groups by school_id and enrollment year, assigning sequential 0001, 0002...
--    ordered by admission_date ASC, created_at ASC, roll_number ASC
-- ============================================================

DO $$
DECLARE
  rec RECORD;
  v_year INT;
  v_class_raw TEXT;
  v_class_code TEXT;
  v_seq_str TEXT;
  v_new_id TEXT;
  v_prev_id TEXT;
  v_updated INT := 0;
BEGIN
  RAISE NOTICE 'Starting student admission number backfill...';

  -- Create a temporary table with ordered sequence per school and enrollment year
  CREATE TEMP TABLE temp_numbered_students ON COMMIT DROP AS
  SELECT 
    s.id AS student_id,
    s.school_id,
    s.student_unique_id AS old_unique_id,
    s.custom_data,
    COALESCE(
      EXTRACT(YEAR FROM s.admission_date)::INT,
      EXTRACT(YEAR FROM s.created_at)::INT,
      2026
    ) AS enroll_year,
    c.name AS class_name,
    ROW_NUMBER() OVER (
      PARTITION BY s.school_id, COALESCE(EXTRACT(YEAR FROM s.admission_date)::INT, EXTRACT(YEAR FROM s.created_at)::INT, 2026)
      ORDER BY s.admission_date ASC NULLS LAST, s.created_at ASC, s.roll_number ASC
    ) AS seq_num
  FROM students s
  LEFT JOIN classes c ON c.id = s.class_id
  WHERE s.is_deleted = false;

  FOR rec IN SELECT * FROM temp_numbered_students LOOP
    v_year := rec.enroll_year;
    v_class_raw := UPPER(TRIM(COALESCE(rec.class_name, 'GEN')));

    -- Normalize class code
    IF v_class_raw ~ 'E(ARLY\s*FOUNDATION|F)[\s\-_]*1' THEN
      v_class_code := 'EF1';
    ELSIF v_class_raw ~ 'E(ARLY\s*FOUNDATION|F)[\s\-_]*2' THEN
      v_class_code := 'EF2';
    ELSIF v_class_raw ~ 'E(ARLY\s*FOUNDATION|F)[\s\-_]*3' THEN
      v_class_code := 'EF3';
    ELSIF v_class_raw ~ 'PLAY[\s\-_]*GROUP|^PG$' THEN
      v_class_code := 'PG';
    ELSIF v_class_raw ~ '^NUR' THEN
      v_class_code := 'NUR';
    ELSIF v_class_raw ~ '^PREP' OR v_class_raw ~ '^KG' THEN
      v_class_code := 'PREP';
    ELSIF v_class_raw ~ '(GRADE|CLASS|LEVEL)[\s\-_]*10|^10(TH)?$' THEN
      v_class_code := 'G10';
    ELSIF v_class_raw ~ '(GRADE|CLASS|LEVEL)[\s\-_]*11|^11(TH)?$' THEN
      v_class_code := 'G11';
    ELSIF v_class_raw ~ '(GRADE|CLASS|LEVEL)[\s\-_]*12|^12(TH)?$' THEN
      v_class_code := 'G12';
    ELSIF v_class_raw ~ '(GRADE|CLASS|LEVEL)[\s\-_]*1|^1(ST)?$' THEN
      v_class_code := 'G01';
    ELSIF v_class_raw ~ '(GRADE|CLASS|LEVEL)[\s\-_]*2|^2(ND)?$' THEN
      v_class_code := 'G02';
    ELSIF v_class_raw ~ '(GRADE|CLASS|LEVEL)[\s\-_]*3|^3(RD)?$' THEN
      v_class_code := 'G03';
    ELSIF v_class_raw ~ '(GRADE|CLASS|LEVEL)[\s\-_]*4|^4(TH)?$' THEN
      v_class_code := 'G04';
    ELSIF v_class_raw ~ '(GRADE|CLASS|LEVEL)[\s\-_]*5|^5(TH)?$' THEN
      v_class_code := 'G05';
    ELSIF v_class_raw ~ '(GRADE|CLASS|LEVEL)[\s\-_]*6|^6(TH)?$' THEN
      v_class_code := 'G06';
    ELSIF v_class_raw ~ '(GRADE|CLASS|LEVEL)[\s\-_]*7|^7(TH)?$' THEN
      v_class_code := 'G07';
    ELSIF v_class_raw ~ '(GRADE|CLASS|LEVEL)[\s\-_]*8|^8(TH)?$' THEN
      v_class_code := 'G08';
    ELSIF v_class_raw ~ '(GRADE|CLASS|LEVEL)[\s\-_]*9|^9(TH)?$' THEN
      v_class_code := 'G09';
    ELSE
      -- Fallback: clean alphanumeric max 4 chars
      v_class_code := SUBSTRING(REGEXP_REPLACE(v_class_raw, '[^A-Z0-9]', '', 'g') FROM 1 FOR 4);
      IF v_class_code IS NULL OR v_class_code = '' THEN
        v_class_code := 'GEN';
      END IF;
    END IF;

    v_seq_str := LPAD(rec.seq_num::TEXT, 4, '0');
    v_new_id := v_year || '-' || v_class_code || '-' || v_seq_str;
    v_prev_id := rec.old_unique_id;

    -- Update student record with new standardized ID and preserve old ID
    UPDATE students
    SET 
      student_unique_id = v_new_id,
      custom_data = jsonb_set(
        COALESCE(custom_data, '{}'::jsonb),
        '{previous_student_unique_id}',
        to_jsonb(COALESCE(v_prev_id, ''))
      )
    WHERE id = rec.student_id;

    v_updated := v_updated + 1;
  END LOOP;

  RAISE NOTICE 'Backfill complete. Updated % active students with standardized admission numbers.', v_updated;
END $$;
