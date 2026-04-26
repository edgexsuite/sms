-- ============================================================
-- STAFF TABLE: Add father_name column
-- Run in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- ============================================================

ALTER TABLE staff ADD COLUMN IF NOT EXISTS father_name TEXT;

-- Done! Staff form will now save the Father's Name field correctly.
