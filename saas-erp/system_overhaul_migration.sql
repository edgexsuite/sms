-- ============================================================
-- SYSTEM OVERHAUL MIGRATION: DATA INTEGRITY & ROLES
-- ============================================================

-- 1. Update User Roles CHECK Constraint
-- Dropping and recreating to add 'director' and 'principal'
ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS user_roles_role_check;
ALTER TABLE user_roles ADD CONSTRAINT user_roles_role_check 
CHECK (role IN ('admin', 'teacher', 'staff', 'parent', 'director', 'principal'));

-- 2. Enforce Hard Delete Cascades for Students
-- fee_records
ALTER TABLE fee_records DROP CONSTRAINT IF EXISTS fee_records_student_id_fkey;
ALTER TABLE fee_records ADD CONSTRAINT fee_records_student_id_fkey 
FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;

-- attendance
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_student_id_fkey;
ALTER TABLE attendance ADD CONSTRAINT attendance_student_id_fkey 
FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;

-- 3. Enforce Hard Delete Cascades for Parents -> Students
ALTER TABLE students DROP CONSTRAINT IF EXISTS students_parent_id_fkey;
ALTER TABLE students ADD CONSTRAINT students_parent_id_fkey 
FOREIGN KEY (parent_id) REFERENCES parents(id) ON DELETE SET NULL;

-- 4. Clean up Orphaned Records (Safety Run)
-- Remove fee records for students that no longer exist
DELETE FROM fee_records WHERE student_id NOT IN (SELECT id FROM students);
DELETE FROM attendance WHERE student_id NOT IN (SELECT id FROM students);
DELETE FROM student_stationary_ledger WHERE student_id NOT IN (SELECT id FROM students);

-- 5. Administrative Bypass for Admin/Director roles
-- (Updating RLS happens in rls_policies.sql usually, but we ensure policies allow these roles)
CREATE OR REPLACE FUNCTION is_school_admin(school_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
      AND school_id = school_uuid
      AND role IN ('admin', 'director', 'principal')
  );
$$;

CREATE OR REPLACE FUNCTION is_school_admin_or_teacher(school_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
      AND school_id = school_uuid
      AND role IN ('admin', 'director', 'principal', 'teacher')
  );
$$;

DROP POLICY IF EXISTS "Allow All" ON students;
CREATE POLICY "Allow All" ON students FOR ALL USING (true); -- Keep loose for demo, but role-based in prod

-- 6. Add 'director' to staff roles check if applicable
-- Assuming staff table might have a role check too
-- ALTER TABLE staff DROP CONSTRAINT IF EXISTS staff_role_check;
-- ALTER TABLE staff ADD CONSTRAINT staff_role_check CHECK (role IN (...));
