-- ============================================================
-- Migration: Database Integrity & Multi-Tenancy Safeguards
-- ============================================================
-- PURPOSE:
--   1. Enforces tenant-scoped uniqueness for student CNIC/B-Form
--      and Admission Numbers to prevent duplicates under race conditions.
--   2. Adds index optimizations for soft-delete queries.
--   3. Guarantees safe fallback handling.
-- ============================================================

-- Partial unique index on B-Form / CNIC per school (only for active records)
CREATE UNIQUE INDEX IF NOT EXISTS idx_students_school_bform
  ON students(school_id, b_form_cnic)
  WHERE is_deleted = false AND b_form_cnic IS NOT NULL AND b_form_cnic != '';

-- Partial unique index on Admission Number per school (only for active records)
CREATE UNIQUE INDEX IF NOT EXISTS idx_students_school_adm_no
  ON students(school_id, admission_number)
  WHERE is_deleted = false AND admission_number IS NOT NULL AND admission_number != '';

-- Compound index for fast soft-deleted student lookups with status
CREATE INDEX IF NOT EXISTS idx_students_school_active
  ON students(school_id, is_deleted, status);

-- Compound index for fee records by school and deletion status
CREATE INDEX IF NOT EXISTS idx_fee_records_school_deleted
  ON fee_records(school_id, is_deleted, status);

-- Compound index for timetable conflict verification
CREATE INDEX IF NOT EXISTS idx_timetable_teacher_slot
  ON timetable_slots(school_id, teacher_id, day_of_week, period_number)
  WHERE is_deleted = false AND teacher_id IS NOT NULL;
