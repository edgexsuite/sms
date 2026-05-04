-- Migration: Add missing columns to parents table
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- Safe to run multiple times (IF NOT EXISTS guards)

-- 1. father_cnic — national ID of the father
--    (schema.sql has a generic `cnic` column; code uses the specific `father_cnic`)
ALTER TABLE parents ADD COLUMN IF NOT EXISTS father_cnic TEXT;

-- 2. guardian_name — separate guardian when father is not the guardian
ALTER TABLE parents ADD COLUMN IF NOT EXISTS guardian_name TEXT;

-- 3. guardian_cnic — CNIC of the guardian
ALTER TABLE parents ADD COLUMN IF NOT EXISTS guardian_cnic TEXT;

-- 4. is_father_guardian — boolean flag: true = father is the guardian (default case)
ALTER TABLE parents ADD COLUMN IF NOT EXISTS is_father_guardian BOOLEAN DEFAULT TRUE;

-- 5. family_group_id — links parent to their family group for sibling management
ALTER TABLE parents ADD COLUMN IF NOT EXISTS family_group_id UUID REFERENCES family_groups(id);

-- 6. Backfill: copy old generic `cnic` column value into `father_cnic` where available
UPDATE parents SET father_cnic = cnic WHERE father_cnic IS NULL AND cnic IS NOT NULL;

-- Done. Verify with:
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'parents' ORDER BY ordinal_position;
