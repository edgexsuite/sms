-- ============================================================
-- New Roles Migration — Run in Supabase SQL Editor
-- Adds: vice_principal, campus_coordinator, academic_coordinator, section_coordinator
-- Safe to re-run
-- ============================================================

-- Drop old constraint and replace with expanded role list
ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS user_roles_role_check;

ALTER TABLE user_roles ADD CONSTRAINT user_roles_role_check
  CHECK (role IN (
    'admin',
    'teacher',
    'staff',
    'accountant',
    'librarian',
    'parent',
    'director',
    'principal',
    'vice_principal',
    'campus_coordinator',
    'academic_coordinator',
    'section_coordinator'
  ));
