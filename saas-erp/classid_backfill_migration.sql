-- ============================================================
-- Migration: Permanently backfill class_id in exam_results
-- ============================================================
-- WHY:
--   class_id was added to exam_results after data already existed.
--   Old rows have class_id = NULL. This migration fills them using
--   the students table (student_id → class_id), which is the
--   authoritative source of class membership.
--
-- SAFE TO RE-RUN: WHERE class_id IS NULL guard prevents duplication.
-- ============================================================

-- Step 1: Backfill existing NULLs from students table
UPDATE exam_results er
SET    class_id = s.class_id
FROM   students s
WHERE  er.student_id = s.id
  AND  er.class_id IS NULL;

-- Step 2: Report how many rows were updated
DO $$
DECLARE
  v_remaining INT;
BEGIN
  SELECT COUNT(*) INTO v_remaining FROM exam_results WHERE class_id IS NULL;
  IF v_remaining = 0 THEN
    RAISE NOTICE 'Backfill complete — all exam_results rows now have class_id.';
  ELSE
    RAISE WARNING '% rows still have class_id = NULL (students may be deleted).', v_remaining;
  END IF;
END;
$$;

-- Step 3 (optional - uncomment only after verifying Step 1):
-- Makes class_id mandatory going forward so this never happens again.
-- Only run this if ALL rows now have class_id (check the NOTICE above).
--
-- ALTER TABLE exam_results ALTER COLUMN class_id SET NOT NULL;

-- ============================================================
-- Verify with:
-- SELECT COUNT(*) FROM exam_results WHERE class_id IS NULL;
-- Should return 0 after running this.
-- ============================================================
