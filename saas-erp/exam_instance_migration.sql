-- Migration: Exam Instance support
-- Adds month_year to exam_types so each monthly/weekly test is a distinct event,
-- and adds class_id to exam_results so results are properly class-scoped.
-- Run once in Supabase SQL Editor. Safe to re-run (IF NOT EXISTS / IF EXISTS guards).

-- 1. Add month_year to exam_types
--    Stores the specific period, e.g. '2025-04' for April 2025
--    Allows "Monthly Test" to exist as many rows: Apr, May, Jun, etc.
ALTER TABLE exam_types ADD COLUMN IF NOT EXISTS month_year TEXT;

-- 2. Add class_id to exam_results
--    Scopes each result to a class so cross-class data never leaks
ALTER TABLE exam_results ADD COLUMN IF NOT EXISTS class_id UUID REFERENCES classes(id);

-- Done. Verify with:
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name IN ('exam_types','exam_results')
--   ORDER BY table_name, ordinal_position;
