-- ============================================================
-- PRODUCTION RLS MIGRATION
-- Replaces all "Allow All" policies with proper auth-based checks
-- Run this entire file in your Supabase SQL Editor
-- ============================================================

-- ============================================================
-- SECTION 1: HELPER FUNCTIONS
-- These run as SECURITY DEFINER so they can query user_roles
-- without recursion or permission issues
-- ============================================================

CREATE OR REPLACE FUNCTION is_school_member(school_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
      AND school_id = school_uuid
  );
$$;

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
      AND role = 'admin'
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
      AND role IN ('admin', 'teacher')
  );
$$;

-- ============================================================
-- SECTION 2: schools
-- Any member can read their school. Only admins can update.
-- INSERT is open to allow the signup flow to create a school.
-- ============================================================

ALTER TABLE schools ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow All" ON schools;
DROP POLICY IF EXISTS "schools_select" ON schools;
DROP POLICY IF EXISTS "schools_insert" ON schools;
DROP POLICY IF EXISTS "schools_update" ON schools;
DROP POLICY IF EXISTS "schools_delete" ON schools;

-- Any authenticated user who belongs to this school can read it
CREATE POLICY "schools_select" ON schools
  FOR SELECT USING (
    id IN (
      SELECT school_id FROM user_roles WHERE user_id = auth.uid()
    )
  );

-- Signup flow: allow creating a new school (row doesn't exist yet so no school_id to check)
CREATE POLICY "schools_insert" ON schools
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Only admins can update school details
CREATE POLICY "schools_update" ON schools
  FOR UPDATE USING (is_school_admin(id));

-- Only admins can delete (guard against accidents)
CREATE POLICY "schools_delete" ON schools
  FOR DELETE USING (is_school_admin(id));

-- ============================================================
-- SECTION 3: user_roles
-- Users can read their own role.
-- Admins can read all roles in their school.
-- Only admins can insert/update/delete roles.
-- ============================================================

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow All" ON user_roles;
DROP POLICY IF EXISTS "user_roles_select_own" ON user_roles;
DROP POLICY IF EXISTS "user_roles_select_admin" ON user_roles;
DROP POLICY IF EXISTS "user_roles_insert" ON user_roles;
DROP POLICY IF EXISTS "user_roles_update" ON user_roles;
DROP POLICY IF EXISTS "user_roles_delete" ON user_roles;

-- Users can always see their own role entry
CREATE POLICY "user_roles_select_own" ON user_roles
  FOR SELECT USING (user_id = auth.uid());

-- Admins can see all roles within their school
CREATE POLICY "user_roles_select_admin" ON user_roles
  FOR SELECT USING (is_school_admin(school_id));

-- Only admins can assign roles; signup flow creates initial admin entry
-- We allow insert if no admin exists yet (bootstrap) OR if caller is an admin
CREATE POLICY "user_roles_insert" ON user_roles
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      is_school_admin(school_id)
      OR NOT EXISTS (
        SELECT 1 FROM user_roles ur2
        WHERE ur2.school_id = school_id
          AND ur2.role = 'admin'
      )
    )
  );

CREATE POLICY "user_roles_update" ON user_roles
  FOR UPDATE USING (is_school_admin(school_id));

CREATE POLICY "user_roles_delete" ON user_roles
  FOR DELETE USING (is_school_admin(school_id));

-- ============================================================
-- SECTION 4: classes
-- All school members can read. Only admins can write.
-- ============================================================

ALTER TABLE classes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow All" ON classes;
DROP POLICY IF EXISTS "classes_select" ON classes;
DROP POLICY IF EXISTS "classes_write" ON classes;

CREATE POLICY "classes_select" ON classes
  FOR SELECT USING (is_school_member(school_id));

CREATE POLICY "classes_write" ON classes
  FOR ALL USING (is_school_admin(school_id))
  WITH CHECK (is_school_admin(school_id));

-- ============================================================
-- SECTION 5: staff
-- All school members can read. Only admins can write.
-- ============================================================

ALTER TABLE staff ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow All" ON staff;
DROP POLICY IF EXISTS "staff_select" ON staff;
DROP POLICY IF EXISTS "staff_write" ON staff;

CREATE POLICY "staff_select" ON staff
  FOR SELECT USING (is_school_member(school_id));

CREATE POLICY "staff_write" ON staff
  FOR ALL USING (is_school_admin(school_id))
  WITH CHECK (is_school_admin(school_id));

-- ============================================================
-- SECTION 6: parents
-- All school members can read.
-- Parents can read and update their own record.
-- Only admins can insert/delete.
-- ============================================================

ALTER TABLE parents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow All" ON parents;
DROP POLICY IF EXISTS "parents_select_member" ON parents;
DROP POLICY IF EXISTS "parents_update_own" ON parents;
DROP POLICY IF EXISTS "parents_admin_write" ON parents;

-- Any school member can read parents (needed for fee/attendance lookups)
CREATE POLICY "parents_select_member" ON parents
  FOR SELECT USING (is_school_member(school_id));

-- Parents can update their own contact info (matched by user_id on user_roles)
CREATE POLICY "parents_update_own" ON parents
  FOR UPDATE USING (
    id IN (
      SELECT p.id FROM parents p
      JOIN user_roles ur ON ur.school_id = p.school_id
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'parent'
        AND p.school_id = parents.school_id
    )
  );

-- Only admins can create or delete parent records
CREATE POLICY "parents_admin_write" ON parents
  FOR ALL USING (is_school_admin(school_id))
  WITH CHECK (is_school_admin(school_id));

-- ============================================================
-- SECTION 7: students
-- All school members can read.
-- Only admins can write.
-- ============================================================

ALTER TABLE students ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow All" ON students;
DROP POLICY IF EXISTS "students_select" ON students;
DROP POLICY IF EXISTS "students_write" ON students;

CREATE POLICY "students_select" ON students
  FOR SELECT USING (is_school_member(school_id));

CREATE POLICY "students_write" ON students
  FOR ALL USING (is_school_admin(school_id))
  WITH CHECK (is_school_admin(school_id));

-- ============================================================
-- SECTION 8: fee_structures
-- All school members can read. Only admins can write.
-- ============================================================

ALTER TABLE fee_structures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow All" ON fee_structures;
DROP POLICY IF EXISTS "fee_structures_select" ON fee_structures;
DROP POLICY IF EXISTS "fee_structures_write" ON fee_structures;

CREATE POLICY "fee_structures_select" ON fee_structures
  FOR SELECT USING (is_school_member(school_id));

CREATE POLICY "fee_structures_write" ON fee_structures
  FOR ALL USING (is_school_admin(school_id))
  WITH CHECK (is_school_admin(school_id));

-- ============================================================
-- SECTION 9: fee_records
-- All school members can read. Only admins can write.
-- ============================================================

ALTER TABLE fee_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow All" ON fee_records;
DROP POLICY IF EXISTS "fee_records_select" ON fee_records;
DROP POLICY IF EXISTS "fee_records_write" ON fee_records;

CREATE POLICY "fee_records_select" ON fee_records
  FOR SELECT USING (is_school_member(school_id));

CREATE POLICY "fee_records_write" ON fee_records
  FOR ALL USING (is_school_admin(school_id))
  WITH CHECK (is_school_admin(school_id));

-- ============================================================
-- SECTION 10: attendance
-- All school members can read.
-- Admins and teachers can insert/update.
-- ============================================================

ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow All" ON attendance;
DROP POLICY IF EXISTS "attendance_select" ON attendance;
DROP POLICY IF EXISTS "attendance_write" ON attendance;

CREATE POLICY "attendance_select" ON attendance
  FOR SELECT USING (is_school_member(school_id));

CREATE POLICY "attendance_write" ON attendance
  FOR ALL USING (is_school_admin_or_teacher(school_id))
  WITH CHECK (is_school_admin_or_teacher(school_id));

-- ============================================================
-- SECTION 11: form_settings
-- All school members can read. Only admins can write.
-- ============================================================

ALTER TABLE form_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow All" ON form_settings;
DROP POLICY IF EXISTS "form_settings_select" ON form_settings;
DROP POLICY IF EXISTS "form_settings_write" ON form_settings;

CREATE POLICY "form_settings_select" ON form_settings
  FOR SELECT USING (is_school_member(school_id));

CREATE POLICY "form_settings_write" ON form_settings
  FOR ALL USING (is_school_admin(school_id))
  WITH CHECK (is_school_admin(school_id));

-- ============================================================
-- SECTION 12: custom_fields
-- All school members can read. Only admins can write.
-- ============================================================

ALTER TABLE custom_fields ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow All" ON custom_fields;
DROP POLICY IF EXISTS "custom_fields_select" ON custom_fields;
DROP POLICY IF EXISTS "custom_fields_write" ON custom_fields;

CREATE POLICY "custom_fields_select" ON custom_fields
  FOR SELECT USING (is_school_member(school_id));

CREATE POLICY "custom_fields_write" ON custom_fields
  FOR ALL USING (is_school_admin(school_id))
  WITH CHECK (is_school_admin(school_id));

-- ============================================================
-- SECTION 13: communication_logs
-- Admins and teachers can read and write.
-- ============================================================

ALTER TABLE communication_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow All" ON communication_logs;
DROP POLICY IF EXISTS "communication_logs_select" ON communication_logs;
DROP POLICY IF EXISTS "communication_logs_write" ON communication_logs;

CREATE POLICY "communication_logs_select" ON communication_logs
  FOR SELECT USING (is_school_admin_or_teacher(school_id));

CREATE POLICY "communication_logs_write" ON communication_logs
  FOR ALL USING (is_school_admin_or_teacher(school_id))
  WITH CHECK (is_school_admin_or_teacher(school_id));

-- ============================================================
-- SECTION 14: expense_heads
-- All school members can read. Only admins can write.
-- ============================================================

ALTER TABLE expense_heads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow All" ON expense_heads;
DROP POLICY IF EXISTS "expense_heads_select" ON expense_heads;
DROP POLICY IF EXISTS "expense_heads_write" ON expense_heads;

CREATE POLICY "expense_heads_select" ON expense_heads
  FOR SELECT USING (is_school_member(school_id));

CREATE POLICY "expense_heads_write" ON expense_heads
  FOR ALL USING (is_school_admin(school_id))
  WITH CHECK (is_school_admin(school_id));

-- ============================================================
-- SECTION 15: financial_transactions
-- Only admins can read and write (sensitive financial data).
-- ============================================================

ALTER TABLE financial_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow All" ON financial_transactions;
DROP POLICY IF EXISTS "financial_transactions_admin" ON financial_transactions;

CREATE POLICY "financial_transactions_admin" ON financial_transactions
  FOR ALL USING (is_school_admin(school_id))
  WITH CHECK (is_school_admin(school_id));

-- ============================================================
-- SECTION 16: subjects
-- All school members can read. Only admins can write.
-- ============================================================

ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow All" ON subjects;
DROP POLICY IF EXISTS "subjects_select" ON subjects;
DROP POLICY IF EXISTS "subjects_write" ON subjects;

CREATE POLICY "subjects_select" ON subjects
  FOR SELECT USING (is_school_member(school_id));

CREATE POLICY "subjects_write" ON subjects
  FOR ALL USING (is_school_admin(school_id))
  WITH CHECK (is_school_admin(school_id));

-- ============================================================
-- SECTION 17: exam_types
-- All school members can read. Only admins can write.
-- ============================================================

ALTER TABLE exam_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow All" ON exam_types;
DROP POLICY IF EXISTS "exam_types_select" ON exam_types;
DROP POLICY IF EXISTS "exam_types_write" ON exam_types;

CREATE POLICY "exam_types_select" ON exam_types
  FOR SELECT USING (is_school_member(school_id));

CREATE POLICY "exam_types_write" ON exam_types
  FOR ALL USING (is_school_admin(school_id))
  WITH CHECK (is_school_admin(school_id));

-- ============================================================
-- SECTION 18: exam_schedules
-- All school members can read. Only admins can write.
-- ============================================================

ALTER TABLE exam_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow All" ON exam_schedules;
DROP POLICY IF EXISTS "exam_schedules_select" ON exam_schedules;
DROP POLICY IF EXISTS "exam_schedules_write" ON exam_schedules;

CREATE POLICY "exam_schedules_select" ON exam_schedules
  FOR SELECT USING (is_school_member(school_id));

CREATE POLICY "exam_schedules_write" ON exam_schedules
  FOR ALL USING (is_school_admin(school_id))
  WITH CHECK (is_school_admin(school_id));

-- ============================================================
-- SECTION 19: exam_results
-- All school members can read.
-- Admins and teachers can write.
-- ============================================================

ALTER TABLE exam_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow All" ON exam_results;
DROP POLICY IF EXISTS "exam_results_select" ON exam_results;
DROP POLICY IF EXISTS "exam_results_write" ON exam_results;

CREATE POLICY "exam_results_select" ON exam_results
  FOR SELECT USING (is_school_member(school_id));

CREATE POLICY "exam_results_write" ON exam_results
  FOR ALL USING (is_school_admin_or_teacher(school_id))
  WITH CHECK (is_school_admin_or_teacher(school_id));

-- ============================================================
-- SECTION 20: timetable_slots
-- All school members can read. Only admins can write.
-- ============================================================

ALTER TABLE timetable_slots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow All" ON timetable_slots;
DROP POLICY IF EXISTS "timetable_slots_select" ON timetable_slots;
DROP POLICY IF EXISTS "timetable_slots_write" ON timetable_slots;

CREATE POLICY "timetable_slots_select" ON timetable_slots
  FOR SELECT USING (is_school_member(school_id));

CREATE POLICY "timetable_slots_write" ON timetable_slots
  FOR ALL USING (is_school_admin(school_id))
  WITH CHECK (is_school_admin(school_id));

-- ============================================================
-- SECTION 21: leave_applications
-- All school members can read.
-- Anyone in the school can submit a leave application.
-- Only admins and teachers can approve/reject (update).
-- ============================================================

ALTER TABLE leave_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow All" ON leave_applications;
DROP POLICY IF EXISTS "leave_select" ON leave_applications;
DROP POLICY IF EXISTS "leave_insert" ON leave_applications;
DROP POLICY IF EXISTS "leave_update" ON leave_applications;
DROP POLICY IF EXISTS "leave_delete" ON leave_applications;

CREATE POLICY "leave_select" ON leave_applications
  FOR SELECT USING (is_school_member(school_id));

CREATE POLICY "leave_insert" ON leave_applications
  FOR INSERT WITH CHECK (is_school_member(school_id));

CREATE POLICY "leave_update" ON leave_applications
  FOR UPDATE USING (is_school_admin_or_teacher(school_id));

CREATE POLICY "leave_delete" ON leave_applications
  FOR DELETE USING (is_school_admin(school_id));

-- ============================================================
-- SECTION 22: teacher_diary
-- All school members can read.
-- Teachers and admins can write.
-- ============================================================

ALTER TABLE teacher_diary ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow All" ON teacher_diary;
DROP POLICY IF EXISTS "teacher_diary_select" ON teacher_diary;
DROP POLICY IF EXISTS "teacher_diary_write" ON teacher_diary;

CREATE POLICY "teacher_diary_select" ON teacher_diary
  FOR SELECT USING (is_school_member(school_id));

CREATE POLICY "teacher_diary_write" ON teacher_diary
  FOR ALL USING (is_school_admin_or_teacher(school_id))
  WITH CHECK (is_school_admin_or_teacher(school_id));

-- ============================================================
-- SECTION 23: inventory_categories
-- All school members can read. Only admins can write.
-- ============================================================

ALTER TABLE inventory_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow All" ON inventory_categories;
DROP POLICY IF EXISTS "inventory_categories_select" ON inventory_categories;
DROP POLICY IF EXISTS "inventory_categories_write" ON inventory_categories;

CREATE POLICY "inventory_categories_select" ON inventory_categories
  FOR SELECT USING (is_school_member(school_id));

CREATE POLICY "inventory_categories_write" ON inventory_categories
  FOR ALL USING (is_school_admin(school_id))
  WITH CHECK (is_school_admin(school_id));

-- ============================================================
-- SECTION 24: inventory_items
-- All school members can read. Only admins can write.
-- ============================================================

ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow All" ON inventory_items;
DROP POLICY IF EXISTS "inventory_items_select" ON inventory_items;
DROP POLICY IF EXISTS "inventory_items_write" ON inventory_items;

CREATE POLICY "inventory_items_select" ON inventory_items
  FOR SELECT USING (is_school_member(school_id));

CREATE POLICY "inventory_items_write" ON inventory_items
  FOR ALL USING (is_school_admin(school_id))
  WITH CHECK (is_school_admin(school_id));

-- ============================================================
-- SECTION 25: vendors
-- All school members can read. Only admins can write.
-- ============================================================

ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow All" ON vendors;
DROP POLICY IF EXISTS "vendors_select" ON vendors;
DROP POLICY IF EXISTS "vendors_write" ON vendors;

CREATE POLICY "vendors_select" ON vendors
  FOR SELECT USING (is_school_member(school_id));

CREATE POLICY "vendors_write" ON vendors
  FOR ALL USING (is_school_admin(school_id))
  WITH CHECK (is_school_admin(school_id));

-- ============================================================
-- SECTION 26: inventory_transactions
-- All school members can read. Only admins can write.
-- ============================================================

ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow All" ON inventory_transactions;
DROP POLICY IF EXISTS "inventory_transactions_select" ON inventory_transactions;
DROP POLICY IF EXISTS "inventory_transactions_write" ON inventory_transactions;

CREATE POLICY "inventory_transactions_select" ON inventory_transactions
  FOR SELECT USING (is_school_member(school_id));

CREATE POLICY "inventory_transactions_write" ON inventory_transactions
  FOR ALL USING (is_school_admin(school_id))
  WITH CHECK (is_school_admin(school_id));

-- ============================================================
-- SECTION 27: evaluations
-- All school members can read.
-- Admins and teachers can write.
-- ============================================================

ALTER TABLE evaluations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow All" ON evaluations;
DROP POLICY IF EXISTS "evaluations_select" ON evaluations;
DROP POLICY IF EXISTS "evaluations_write" ON evaluations;

CREATE POLICY "evaluations_select" ON evaluations
  FOR SELECT USING (is_school_member(school_id));

CREATE POLICY "evaluations_write" ON evaluations
  FOR ALL USING (is_school_admin_or_teacher(school_id))
  WITH CHECK (is_school_admin_or_teacher(school_id));

-- ============================================================
-- SECTION 28: complaints
-- All school members can read and submit complaints.
-- Only admins can update (resolve) complaints.
-- ============================================================

ALTER TABLE complaints ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow All" ON complaints;
DROP POLICY IF EXISTS "complaints_select" ON complaints;
DROP POLICY IF EXISTS "complaints_insert" ON complaints;
DROP POLICY IF EXISTS "complaints_update" ON complaints;
DROP POLICY IF EXISTS "complaints_delete" ON complaints;

CREATE POLICY "complaints_select" ON complaints
  FOR SELECT USING (is_school_member(school_id));

CREATE POLICY "complaints_insert" ON complaints
  FOR INSERT WITH CHECK (is_school_member(school_id));

CREATE POLICY "complaints_update" ON complaints
  FOR UPDATE USING (is_school_admin(school_id));

CREATE POLICY "complaints_delete" ON complaints
  FOR DELETE USING (is_school_admin(school_id));

-- ============================================================
-- VERIFICATION QUERIES
-- Run these after migration to confirm policies are in place
-- ============================================================

-- List all active policies (should show no "Allow All" entries)
-- SELECT schemaname, tablename, policyname, cmd, qual
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename, policyname;

-- Expected: zero rows with policyname = 'Allow All'
-- SELECT COUNT(*) FROM pg_policies
-- WHERE schemaname = 'public' AND policyname = 'Allow All';
