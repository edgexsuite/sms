-- ============================================================
-- Staff User Accounts Migration
-- Run in Supabase SQL Editor
-- Safe to re-run (uses IF NOT EXISTS / IF EXISTS guards)
-- ============================================================

-- 1. Extend user_roles table
ALTER TABLE user_roles
  ADD COLUMN IF NOT EXISTS permissions   JSONB    DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_active     BOOLEAN  DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS created_by    UUID,
  ADD COLUMN IF NOT EXISTS staff_id      UUID     REFERENCES staff(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_login    TIMESTAMP WITH TIME ZONE;

-- 2. Extend staff table
ALTER TABLE staff
  ADD COLUMN IF NOT EXISTS user_id    UUID     REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS has_login  BOOLEAN  DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN  DEFAULT FALSE;

-- 3. Widen role enum to include all system roles
ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS user_roles_role_check;
ALTER TABLE user_roles ADD CONSTRAINT user_roles_role_check
  CHECK (role IN (
    'admin','teacher','staff','accountant','librarian','parent',
    'director','principal','vice_principal',
    'campus_coordinator','academic_coordinator','section_coordinator'
  ));

-- 4. Index for fast staff ↔ user_roles lookups
CREATE INDEX IF NOT EXISTS idx_user_roles_staff_id  ON user_roles(staff_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_school_id ON user_roles(school_id);
CREATE INDEX IF NOT EXISTS idx_staff_user_id        ON staff(user_id);

-- 5. Default permission presets (stored as a reference — not enforced by DB,
--    used by the app when creating a new account with a given role)
--    Stored in form_settings so the admin can customise them in the UI.
INSERT INTO form_settings (school_id, form_name, sections_config)
SELECT
  s.id,
  'permission_presets',
  '{
    "teacher": {
      "modules": {
        "students":  true,
        "academic":  true,
        "finance":   false,
        "services":  false,
        "reports":   false,
        "settings":  false
      },
      "actions": {
        "delete_student":  false,
        "delete_staff":    false,
        "delete_expenses": false
      }
    },
    "staff": {
      "modules": {
        "students":  true,
        "academic":  false,
        "finance":   true,
        "services":  true,
        "reports":   false,
        "settings":  false
      },
      "actions": {
        "delete_student":  false,
        "delete_staff":    false,
        "delete_expenses": false
      }
    },
    "accountant": {
      "modules": {
        "students":  false,
        "academic":  false,
        "finance":   true,
        "services":  false,
        "reports":   true,
        "settings":  false
      },
      "actions": {
        "delete_student":  false,
        "delete_staff":    false,
        "delete_expenses": true
      }
    },
    "librarian": {
      "modules": {
        "students":  true,
        "academic":  false,
        "finance":   false,
        "services":  true,
        "reports":   false,
        "settings":  false
      },
      "actions": {
        "delete_student":  false,
        "delete_staff":    false,
        "delete_expenses": false
      }
    }
  }'::jsonb
FROM schools s
ON CONFLICT (school_id, form_name) DO NOTHING;
