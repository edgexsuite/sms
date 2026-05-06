-- ============================================================
-- Fix: Coordinator RLS on attendance table
-- Run in Supabase SQL Editor
-- Safe to re-run
-- ============================================================

-- Drop whatever policy exists and recreate with explicit WITH CHECK
DROP POLICY IF EXISTS "Allow All"         ON attendance;
DROP POLICY IF EXISTS "attendance_policy" ON attendance;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON attendance;

CREATE POLICY "Allow All" ON attendance
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Also refresh teacher_diary policy in case it has the same issue
DROP POLICY IF EXISTS "Allow All" ON teacher_diary;
CREATE POLICY "Allow All" ON teacher_diary
  FOR ALL
  USING (true)
  WITH CHECK (true);
