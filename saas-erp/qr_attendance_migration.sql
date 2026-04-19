-- ============================================================
--  QR Attendance Migration
--  Run this in your Supabase SQL Editor
-- ============================================================

-- 1. Add check-in / check-out time columns
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS arrival_time   TIME;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS departure_time TIME;

-- 2. Make student_id nullable (staff rows don't have a student)
ALTER TABLE attendance ALTER COLUMN student_id DROP NOT NULL;

-- 3. Expand status constraint to include all used values
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_status_check;
ALTER TABLE attendance ADD CONSTRAINT attendance_status_check
  CHECK (status IN ('present', 'absent', 'late', 'excused', 'leave', 'half-day', 'vacation'));

-- 4. Prevent duplicate check-ins per person per day
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_unique_student_date;
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_unique_staff_date;

CREATE UNIQUE INDEX IF NOT EXISTS attendance_student_date_unique
  ON attendance (school_id, student_id, date)
  WHERE student_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS attendance_staff_date_unique
  ON attendance (school_id, staff_id, date)
  WHERE staff_id IS NOT NULL;
