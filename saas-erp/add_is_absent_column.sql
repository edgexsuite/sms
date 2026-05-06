-- ============================================================
-- Migration: Add is_absent column to exam_results
-- ============================================================
-- Run this in Supabase SQL Editor if you want is_absent
-- as a proper boolean column instead of relying on grade='Ab'
-- ============================================================

-- Step 1: Add the column (defaults to false for all existing rows)
ALTER TABLE exam_results
  ADD COLUMN IF NOT EXISTS is_absent BOOLEAN DEFAULT FALSE;

-- Step 2: Backfill existing rows using the grade column
-- Any row with grade='Ab' is an absent student
UPDATE exam_results
SET is_absent = TRUE
WHERE grade = 'Ab'
  AND is_absent = FALSE;

-- Step 3: Verify
DO $$
DECLARE
  v_absent_rows INT;
  v_total_rows  INT;
BEGIN
  SELECT COUNT(*) INTO v_absent_rows FROM exam_results WHERE is_absent = TRUE;
  SELECT COUNT(*) INTO v_total_rows  FROM exam_results;
  RAISE NOTICE 'Total rows: %, Absent rows: %', v_total_rows, v_absent_rows;
END;
$$;

-- ============================================================
-- After running this SQL, update the frontend code too:
-- See comments below for what to change in each file.
-- ============================================================
