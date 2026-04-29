-- RUN THIS IN YOUR SUPABASE SQL EDITOR TO UPGRADE YOUR SCHEMA FOR THE CUSTOM FORM BUILDER

-- 1. Create table for controlling section visibility (hide/show Medical, Previous School, etc)
CREATE TABLE IF NOT EXISTS form_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID REFERENCES schools(id) NOT NULL,
  form_name TEXT NOT NULL, -- e.g., 'student_admission'
  sections_config JSONB DEFAULT '{}'::jsonb, -- e.g., {"medical": false, "insurance": true}
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(school_id, form_name)
);

-- 2. Create table for entirely NEW custom fields (e.g., 'Mother Tongue')
CREATE TABLE IF NOT EXISTS custom_fields (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID REFERENCES schools(id) NOT NULL,
  form_name TEXT NOT NULL, -- e.g., 'student_admission'
  section_name TEXT NOT NULL, -- Which block should this appear in?
  field_label TEXT NOT NULL, -- e.g., 'Household Income'
  field_type TEXT NOT NULL, -- 'text', 'number', 'select', 'checkbox', 'date'
  options JSONB, -- For 'select' dropdowns e.g. ["Under 50k", "Over 50k"]
  is_required BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Safely add custom_data columns to parent and students tables to hold dynamic JSON answers
ALTER TABLE parents 
  ADD COLUMN IF NOT EXISTS custom_data JSONB DEFAULT '{}'::jsonb;

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS custom_data JSONB DEFAULT '{}'::jsonb;

-- Adjust RLS for new tables
ALTER TABLE form_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_fields ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow All" ON form_settings;
CREATE POLICY "Allow All" ON form_settings FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow All" ON custom_fields;
CREATE POLICY "Allow All" ON custom_fields FOR ALL USING (true);

-- 4. Create table for WhatsApp/SMS communication logs
CREATE TABLE IF NOT EXISTS communication_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID REFERENCES schools(id) NOT NULL,
  parent_id UUID REFERENCES parents(id),
  channel TEXT NOT NULL DEFAULT 'whatsapp',
  recipient_number TEXT,
  message_content TEXT NOT NULL,
  status TEXT DEFAULT 'sent',
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE communication_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow All" ON communication_logs;
CREATE POLICY "Allow All" ON communication_logs FOR ALL USING (true);

-- 5. FINANCE & UNIFIED LEDGER UPGRADES
ALTER TABLE students ADD COLUMN IF NOT EXISTS fee_waiver_percentage NUMERIC DEFAULT 0;

ALTER TABLE fee_records ADD COLUMN IF NOT EXISTS breakdown JSONB DEFAULT '[]'::jsonb;
ALTER TABLE fee_records ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE fee_records ADD COLUMN IF NOT EXISTS payment_mode TEXT DEFAULT 'Cash';
ALTER TABLE fee_records ADD COLUMN IF NOT EXISTS invoice_number TEXT;

CREATE TABLE IF NOT EXISTS expense_heads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID REFERENCES schools(id) NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS financial_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID REFERENCES schools(id) NOT NULL,
  type TEXT CHECK (type IN ('income', 'expense')),
  amount NUMERIC NOT NULL,
  payment_mode TEXT DEFAULT 'Cash',
  category TEXT NOT NULL,
  reference_id UUID,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  remarks TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE expense_heads ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow All" ON expense_heads;
CREATE POLICY "Allow All" ON expense_heads FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow All" ON financial_transactions;
CREATE POLICY "Allow All" ON financial_transactions FOR ALL USING (true);

-- 6. ADVANCED FEE STRUCTURE MATRICES
ALTER TABLE fee_structures ADD COLUMN IF NOT EXISTS fee_matrix JSONB DEFAULT '{"recurrent": [{"item": "Tuition Fee", "amount": 0}], "first_time": [{"item": "Admission Fee", "amount": 0}]}'::jsonb;

-- 7. CURRICULUM: SUBJECTS TABLE
-- Subjects are tied to a specific class (Class 1 Math ≠ Class 8 Math)
CREATE TABLE IF NOT EXISTS subjects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID REFERENCES schools(id) NOT NULL,
  class_id UUID REFERENCES classes(id) NOT NULL,
  subject_name TEXT NOT NULL,
  subject_code TEXT,         -- e.g. "MATH-1", "ENG-8"
  total_marks NUMERIC DEFAULT 100,
  passing_marks NUMERIC DEFAULT 33,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(class_id, subject_name)
);

ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow All" ON subjects;
CREATE POLICY "Allow All" ON subjects FOR ALL USING (true);

-- Also allow attendance to track 'leave' status (was only checking 'excused')
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_status_check;
ALTER TABLE attendance ADD CONSTRAINT attendance_status_check
  CHECK (status IN ('present', 'absent', 'late', 'leave', 'excused'));

-- Add created_by column to attendance for teacher tracking
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS created_by UUID;

-- 8. EXAMS & RESULTS ENGINE
-- Step 1: Exam Types (e.g. First Term, Annual, Monthly Test)
CREATE TABLE IF NOT EXISTS exam_types (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID REFERENCES schools(id) NOT NULL,
  name TEXT NOT NULL,           -- e.g. "First Term", "Annual Exam"
  session TEXT,                 -- e.g. "2025-2026"
  weightage NUMERIC DEFAULT 100, -- percentage weight for combined result
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 2: Exam Schedules (which class takes which subject on which date)
CREATE TABLE IF NOT EXISTS exam_schedules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID REFERENCES schools(id) NOT NULL,
  exam_type_id UUID REFERENCES exam_types(id) ON DELETE CASCADE NOT NULL,
  class_id UUID REFERENCES classes(id) NOT NULL,
  subject_id UUID REFERENCES subjects(id) NOT NULL,
  exam_date DATE,
  start_time TIME,
  end_time TIME,
  total_marks NUMERIC DEFAULT 100,
  passing_marks NUMERIC DEFAULT 33,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 3: Individual Student Results
CREATE TABLE IF NOT EXISTS exam_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID REFERENCES schools(id) NOT NULL,
  exam_type_id UUID REFERENCES exam_types(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES students(id) NOT NULL,
  subject_id UUID REFERENCES subjects(id) NOT NULL,
  obtained_marks NUMERIC NOT NULL,
  total_marks NUMERIC NOT NULL,
  grade TEXT,            -- Auto-calculated: A+, A, B, C, D, F
  remarks TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(exam_type_id, student_id, subject_id)
);

ALTER TABLE exam_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow All" ON exam_types;
CREATE POLICY "Allow All" ON exam_types FOR ALL USING (true);
DROP POLICY IF EXISTS "Allow All" ON exam_schedules;
CREATE POLICY "Allow All" ON exam_schedules FOR ALL USING (true);
DROP POLICY IF EXISTS "Allow All" ON exam_results;
CREATE POLICY "Allow All" ON exam_results FOR ALL USING (true);

-- 9. STAFF MODULE UPGRADES
-- Extend the staff table with profile fields needed for full HR management
ALTER TABLE staff ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS qualification TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS cnic TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS dob DATE;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS gender TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS qualification TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS cnic TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS dob DATE;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS gender TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS joining_date DATE;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS salary NUMERIC;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS photograph_url TEXT;

-- 10. TIMETABLE ENGINE
-- Each slot links a class + subject + teacher + day + period time
CREATE TABLE IF NOT EXISTS timetable_slots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID REFERENCES schools(id) NOT NULL,
  class_id UUID REFERENCES classes(id) NOT NULL,
  subject_id UUID REFERENCES subjects(id),
  teacher_id UUID REFERENCES staff(id),
  day_of_week TEXT NOT NULL CHECK (day_of_week IN ('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday')),
  period_number INT NOT NULL,        -- 1, 2, 3 ... 8
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(class_id, day_of_week, period_number)
);

ALTER TABLE timetable_slots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow All" ON timetable_slots;
CREATE POLICY "Allow All" ON timetable_slots FOR ALL USING (true);

-- 11. SCHOOL PROFILE UPGRADES (for Settings & Branding)
ALTER TABLE schools ADD COLUMN IF NOT EXISTS contact_phone2 TEXT;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS academic_session TEXT;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS school_type TEXT;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS website TEXT;

-- 12. LEAVE MANAGEMENT & TEACHER DIARY
-- Unified leave table for both students and staff
CREATE TABLE IF NOT EXISTS leave_applications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID REFERENCES schools(id) NOT NULL,
  applicant_type TEXT NOT NULL CHECK (applicant_type IN ('student', 'staff')),
  student_id UUID REFERENCES students(id),
  staff_id UUID REFERENCES staff(id),
  leave_type TEXT NOT NULL,   -- Sick, Casual, Annual, Emergency, Hajj
  from_date DATE NOT NULL,
  to_date DATE NOT NULL,
  total_days INT GENERATED ALWAYS AS (to_date - from_date + 1) STORED,
  reason TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Teacher diary: daily lesson plan / activity log per class + subject
CREATE TABLE IF NOT EXISTS teacher_diary (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID REFERENCES schools(id) NOT NULL,
  teacher_id UUID REFERENCES staff(id) NOT NULL,
  class_id UUID REFERENCES classes(id) NOT NULL,
  subject_id UUID REFERENCES subjects(id),
  diary_date DATE NOT NULL,
  topic_covered TEXT NOT NULL,
  homework TEXT,
  activity_notes TEXT,
  next_plan TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(teacher_id, class_id, subject_id, diary_date)
);

ALTER TABLE leave_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_diary ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow All" ON leave_applications;
CREATE POLICY "Allow All" ON leave_applications FOR ALL USING (true);
DROP POLICY IF EXISTS "Allow All" ON teacher_diary;
CREATE POLICY "Allow All" ON teacher_diary FOR ALL USING (true);

-- 13. INVENTORY & ASSET MANAGEMENT
-- Categories for items (Stationery, Furniture, IT, etc)
CREATE TABLE IF NOT EXISTS inventory_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID REFERENCES schools(id) NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(school_id, name)
);

-- Individual inventory items
CREATE TABLE IF NOT EXISTS inventory_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID REFERENCES schools(id) NOT NULL,
  category_id UUID REFERENCES inventory_categories(id),
  name TEXT NOT NULL,
  sku TEXT,                    -- Stock Keeping Unit / Barcode
  unit TEXT DEFAULT 'pcs',     -- pcs, rims, kg, liters, etc
  quantity NUMERIC DEFAULT 0,  -- current stock level
  min_stock NUMERIC DEFAULT 10, -- low stock alert threshold
  is_asset BOOLEAN DEFAULT FALSE, -- True for fixed assets like projectors
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Vendor directory
CREATE TABLE IF NOT EXISTS vendors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID REFERENCES schools(id) NOT NULL,
  name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Stock movement log (Transactions)
CREATE TABLE IF NOT EXISTS inventory_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID REFERENCES schools(id) NOT NULL,
  item_id UUID REFERENCES inventory_items(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('purchase', 'issue', 'return', 'adjustment', 'loss')),
  quantity NUMERIC NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  
  -- If issued to someone
  issued_to_type TEXT CHECK (issued_to_type IN ('staff', 'student')),
  staff_id UUID REFERENCES staff(id),
  student_id UUID REFERENCES students(id),
  
  -- Linking to finance (optional)
  financial_transaction_id UUID REFERENCES financial_transactions(id),
  
  remarks TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE inventory_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow All" ON inventory_categories;
CREATE POLICY "Allow All" ON inventory_categories FOR ALL USING (true);
DROP POLICY IF EXISTS "Allow All" ON inventory_items;
CREATE POLICY "Allow All" ON inventory_items FOR ALL USING (true);
DROP POLICY IF EXISTS "Allow All" ON vendors;
CREATE POLICY "Allow All" ON vendors FOR ALL USING (true);
DROP POLICY IF EXISTS "Allow All" ON inventory_transactions;
CREATE POLICY "Allow All" ON inventory_transactions FOR ALL USING (true);



-- 14. FEEDBACK & TICKETS (Evaluations & Complaints)
CREATE TABLE IF NOT EXISTS evaluations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID REFERENCES schools(id) NOT NULL,
  evaluator_id UUID REFERENCES staff(id), -- staff member doing the rating
  
  target_type TEXT NOT NULL CHECK (target_type IN ('student', 'staff')),
  student_id UUID REFERENCES students(id),
  staff_id UUID REFERENCES staff(id), -- the person being rated
  
  ratings JSONB DEFAULT '{}'::jsonb, -- e.g. {"teaching": 4, "punctuality": 5}
  feedback TEXT,
  exam_type_id UUID REFERENCES exam_types(id) ON DELETE SET NULL,
  evaluation_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS complaints (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID REFERENCES schools(id) NOT NULL,
  user_id UUID, -- links to the person who submitted (can be parent or staff)
  
  category TEXT NOT NULL, -- Facilities, Transport, Academics, Discipline, etc
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'resolved')),
  
  resolution_notes TEXT,
  resolved_by UUID REFERENCES staff(id),
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaints ENABLE ROW LEVEL SECURITY;

-- Evaluations Policy: Admins see all, Staff see their own/assigned. 
-- For now, Allow All for easier dev but structured for later.
DROP POLICY IF EXISTS "Allow All" ON evaluations;
CREATE POLICY "Allow All" ON evaluations FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow All" ON complaints;
CREATE POLICY "Allow All" ON complaints FOR ALL USING (true);

-- ============================================================
-- Add missing student medical + family fields
-- Run in Supabase SQL Editor
-- ============================================================
ALTER TABLE students ADD COLUMN IF NOT EXISTS chronic_disease TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS physical_disability TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS emergency_doctor_name TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS emergency_doctor_phone TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS family_group_id UUID REFERENCES family_groups(id);
ALTER TABLE students ADD COLUMN IF NOT EXISTS height NUMERIC;
ALTER TABLE students ADD COLUMN IF NOT EXISTS weight NUMERIC;

-- ============================================================
-- FEE RECORDS: add missing columns used in application code
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. paid_at: timestamp of when payment was collected
ALTER TABLE fee_records ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP WITH TIME ZONE;

-- 2. remarks: optional note on the invoice
ALTER TABLE fee_records ADD COLUMN IF NOT EXISTS remarks TEXT;

-- 3. Fix status constraint to include 'partial' (partial payment)
ALTER TABLE fee_records DROP CONSTRAINT IF EXISTS fee_records_status_check;
ALTER TABLE fee_records ADD CONSTRAINT fee_records_status_check
  CHECK (status IN ('pending', 'paid', 'partial', 'overdue'));

-- 4. nationality on parents (used in registration form)
ALTER TABLE parents ADD COLUMN IF NOT EXISTS nationality TEXT DEFAULT 'Pakistani';

-- 5. is_active flag on staff (used by QR attendance scanner)
ALTER TABLE staff ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- ============================================================
-- ADMISSION PIPELINE: extended columns for AdmissionPipeline.tsx
-- Run in Supabase SQL Editor
-- ============================================================

-- Create admission_inquiries table if it doesn't exist
CREATE TABLE IF NOT EXISTS admission_inquiries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID REFERENCES schools(id) NOT NULL,
  student_name TEXT NOT NULL,
  applying_for_class TEXT NOT NULL,
  father_name TEXT NOT NULL,
  contact_number TEXT NOT NULL,
  inquiry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'new_inquiry'
    CHECK (status IN ('new_inquiry','follow_up_1','follow_up_2','test_scheduled','admitted','rejected')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Extended columns for full pipeline workflow
ALTER TABLE admission_inquiries ADD COLUMN IF NOT EXISTS student_dob DATE;
ALTER TABLE admission_inquiries ADD COLUMN IF NOT EXISTS student_gender TEXT;
ALTER TABLE admission_inquiries ADD COLUMN IF NOT EXISTS mother_name TEXT;
ALTER TABLE admission_inquiries ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE admission_inquiries ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE admission_inquiries ADD COLUMN IF NOT EXISTS source TEXT;

-- Follow-up 1
ALTER TABLE admission_inquiries ADD COLUMN IF NOT EXISTS follow_up_1_date DATE;
ALTER TABLE admission_inquiries ADD COLUMN IF NOT EXISTS follow_up_1_notes TEXT;

-- Follow-up 2
ALTER TABLE admission_inquiries ADD COLUMN IF NOT EXISTS follow_up_2_date DATE;
ALTER TABLE admission_inquiries ADD COLUMN IF NOT EXISTS follow_up_2_notes TEXT;

-- Admission test
ALTER TABLE admission_inquiries ADD COLUMN IF NOT EXISTS test_date DATE;
ALTER TABLE admission_inquiries ADD COLUMN IF NOT EXISTS test_score NUMERIC;
ALTER TABLE admission_inquiries ADD COLUMN IF NOT EXISTS test_total NUMERIC;
ALTER TABLE admission_inquiries ADD COLUMN IF NOT EXISTS test_result TEXT CHECK (test_result IN ('pass','fail'));
ALTER TABLE admission_inquiries ADD COLUMN IF NOT EXISTS test_remarks TEXT;

-- Links
ALTER TABLE admission_inquiries ADD COLUMN IF NOT EXISTS visitor_id UUID;
ALTER TABLE admission_inquiries ADD COLUMN IF NOT EXISTS student_id UUID REFERENCES students(id);

-- ============================================================
-- PAYROLL: payroll_records + salary_components tables
-- ============================================================
CREATE TABLE IF NOT EXISTS payroll_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID REFERENCES schools(id) NOT NULL,
  staff_id UUID REFERENCES staff(id) NOT NULL,
  month_year DATE NOT NULL,
  full_name TEXT,
  designation TEXT,
  base_salary NUMERIC DEFAULT 0,
  allowances NUMERIC DEFAULT 0,
  deductions NUMERIC DEFAULT 0,
  absent_days INTEGER DEFAULT 0,
  absent_deduction NUMERIC DEFAULT 0,
  gross_salary NUMERIC DEFAULT 0,
  net_salary NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','paid')),
  paid_at TIMESTAMP WITH TIME ZONE,
  payment_source TEXT,
  notes TEXT,
  allowances_detail JSONB DEFAULT '[]'::jsonb,
  deductions_detail JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(school_id, staff_id, month_year)
);
ALTER TABLE payroll_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow All" ON payroll_records;
CREATE POLICY "Allow All" ON payroll_records FOR ALL USING (true);

CREATE TABLE IF NOT EXISTS salary_components (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID REFERENCES schools(id) NOT NULL,
  name TEXT NOT NULL,
  component_type TEXT NOT NULL CHECK (component_type IN ('allowance','deduction')),
  calculation_type TEXT NOT NULL CHECK (calculation_type IN ('fixed','percentage')),
  amount NUMERIC DEFAULT 0,
  percentage NUMERIC DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE salary_components ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow All" ON salary_components;
CREATE POLICY "Allow All" ON salary_components FOR ALL USING (true);

-- Staff: add missing columns used by payroll module
ALTER TABLE staff ADD COLUMN IF NOT EXISTS designation TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS employment_type TEXT DEFAULT 'full-time';
ALTER TABLE staff ADD COLUMN IF NOT EXISTS payment_basis TEXT DEFAULT 'monthly';
ALTER TABLE staff ADD COLUMN IF NOT EXISTS salary NUMERIC DEFAULT 0;

-- Students: expand status to include 'withdrawn' (passout handled by 'graduated')
ALTER TABLE students DROP CONSTRAINT IF EXISTS students_status_check;
ALTER TABLE students ADD CONSTRAINT students_status_check
  CHECK (status IN ('active', 'left', 'graduated', 'withdrawn'));
