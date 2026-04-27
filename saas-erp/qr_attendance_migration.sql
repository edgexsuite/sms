-- ============================================================
--  QR Attendance Migration
--  Run this in your Supabase SQL Editor
-- ============================================================

-- 1. Ensure attendance table exists
CREATE TABLE IF NOT EXISTS attendance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID REFERENCES schools(id) NOT NULL,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  staff_id UUID REFERENCES staff(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status TEXT NOT NULL,
  arrival_time TIME,
  departure_time TIME,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Add columns if table already existed but was missing them
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS arrival_time   TIME;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS departure_time TIME;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS staff_id UUID REFERENCES staff(id) ON DELETE CASCADE;
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
