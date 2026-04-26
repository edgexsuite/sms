-- ============================================================
-- STAFF TABLE — MISSING COLUMNS MIGRATION
-- Run in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- ============================================================

ALTER TABLE staff ADD COLUMN IF NOT EXISTS father_name          TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS mobile_number        TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS is_deleted           BOOLEAN      DEFAULT FALSE;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS deleted_at           TIMESTAMPTZ;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS exclude_from_vacations BOOLEAN    DEFAULT FALSE;

-- Also add has_login and user_id used by StaffUserAccounts page
ALTER TABLE staff ADD COLUMN IF NOT EXISTS has_login            BOOLEAN      DEFAULT FALSE;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS user_id              UUID;

-- Done! Staff add/edit should now work without schema cache errors.
