-- ============================================================
-- Migration: Backfill NULL school_id in exam_results
-- ============================================================
-- WHY:
--   Some exam_results rows were saved with school_id = NULL
--   because userRole?.school_id evaluated to undefined at save
--   time (optional chaining when userRole was still loading).
--
--   The RLS policy on exam_results uses:
--     USING (is_school_member(school_id) OR auth.uid() IS NULL)
--   When school_id IS NULL, is_school_member(NULL) returns FALSE,
--   so those rows are completely invisible to all users.
--
-- FIX:
--   Backfill school_id from the students table (via student_id),
--   which is the authoritative source of school membership.
--
-- SAFE TO RE-RUN: WHERE school_id IS NULL guard prevents duplication.
-- ============================================================

-- Step 1: Backfill NULL school_id from students table
UPDATE exam_results er
SET    school_id = s.school_id
FROM   students s
WHERE  er.student_id = s.id
  AND  er.school_id IS NULL;

-- Step 2: Report results
DO $$
DECLARE
  v_remaining INT;
  v_fixed     INT;
BEGIN
  SELECT COUNT(*) INTO v_remaining FROM exam_results WHERE school_id IS NULL;
  SELECT COUNT(*) INTO v_fixed     FROM exam_results WHERE school_id IS NOT NULL;

  RAISE NOTICE 'exam_results backfill complete:';
  RAISE NOTICE '  Rows with school_id now set: %', v_fixed;
  IF v_remaining = 0 THEN
    RAISE NOTICE '  No remaining NULL school_id rows.';
  ELSE
    RAISE WARNING '  % rows still have school_id = NULL (students may be deleted or missing).', v_remaining;
  END IF;
END;
$$;

-- Step 3: Verify (run manually to check):
-- SELECT COUNT(*) as null_school_id FROM exam_results WHERE school_id IS NULL;
-- Should return 0.

-- Step 4: Also fix exam_subject_config if it has same issue
UPDATE exam_subject_config esc
SET    school_id = et.school_id
FROM   exam_types et
WHERE  esc.exam_type_id = et.id
  AND  esc.school_id IS NULL;

DO $$
DECLARE v_remaining INT;
BEGIN
  SELECT COUNT(*) INTO v_remaining FROM exam_subject_config WHERE school_id IS NULL;
  IF v_remaining = 0 THEN
    RAISE NOTICE 'exam_subject_config: all rows have school_id set.';
  ELSE
    RAISE WARNING 'exam_subject_config: % rows still have NULL school_id.', v_remaining;
  END IF;
END;
$$;
