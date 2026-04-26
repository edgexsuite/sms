-- ============================================================
-- STAFF CREDENTIALS MIGRATION
-- Run in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- ============================================================

-- 1. Store plain-text password hint in user_roles (for admin credential dispatch)
ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS plain_password TEXT;

-- 2. Store login email separately (may differ from staff.email after creation)
ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS login_email TEXT;

-- Done! The Staff → User Accounts page will now store passwords in
-- the dark Credentials Card whenever you create or reset a staff login.
