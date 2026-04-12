-- Core Multi-Tenant Database Initialization
-- Run this securely from your Supabase SQL Editor

CREATE TABLE schools (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE user_roles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL, -- references auth.users(id) once authenticated setup handles
  school_id UUID REFERENCES schools(id) NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'teacher', 'staff', 'parent')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE classes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID REFERENCES schools(id) NOT NULL,
  name TEXT NOT NULL,
  section TEXT NOT NULL,
  class_teacher_id UUID
);

CREATE TABLE staff (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID REFERENCES schools(id) NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL,
  whatsapp_number TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE classes ADD CONSTRAINT fk_class_teacher FOREIGN KEY (class_teacher_id) REFERENCES staff(id);

CREATE TABLE parents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID REFERENCES schools(id) NOT NULL,
  family_number TEXT UNIQUE, -- e.g. FAM-1001
  auth_password TEXT, -- For login dispatch
  full_name TEXT NOT NULL,
  father_name TEXT,
  mother_name TEXT,
  cnic TEXT,
  father_qualification TEXT,
  mother_qualification TEXT,
  father_occupation TEXT,
  mother_occupation TEXT,
  whatsapp_number TEXT,
  emergency_mobile TEXT,
  home_telephone TEXT,
  office_telephone TEXT,
  email TEXT,
  address TEXT,
  custom_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE students (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID REFERENCES schools(id) NOT NULL,
  parent_id UUID REFERENCES parents(id),
  class_id UUID REFERENCES classes(id),
  student_unique_id TEXT UNIQUE, -- e.g. STU-2026-001
  auth_password TEXT, -- For login dispatch
  b_form_cnic TEXT,
  roll_number INT NOT NULL,
  full_name TEXT NOT NULL,
  dob DATE,
  gender TEXT,
  blood_group TEXT,
  religion TEXT,
  hobbies TEXT,
  nationality TEXT,
  photograph_url TEXT,
  address TEXT,
  last_school TEXT,
  remarks TEXT,
  reason_for_choosing TEXT,
  insurance_opt_in BOOLEAN DEFAULT FALSE,
  eye_sight_normal BOOLEAN DEFAULT TRUE,
  glasses_number TEXT,
  other_eye_disease TEXT,
  allergies TEXT,
  contagious_disease TEXT,
  medical_caution TEXT,
  custom_data JSONB DEFAULT '{}'::jsonb,
  admission_date DATE DEFAULT CURRENT_DATE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'left', 'graduated')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE fee_structures (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID REFERENCES schools(id) NOT NULL,
  class_id UUID REFERENCES classes(id) NOT NULL,
  amount NUMERIC NOT NULL
);

CREATE TABLE fee_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID REFERENCES schools(id) NOT NULL,
  student_id UUID REFERENCES students(id) NOT NULL,
  month_year DATE NOT NULL,
  total_amount NUMERIC NOT NULL,
  paid_amount NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE attendance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID REFERENCES schools(id) NOT NULL,
  student_id UUID REFERENCES students(id) NOT NULL,
  date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'late', 'excused')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE parents ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

-- Disable strict policies for immediate demo/onboarding setup 
-- NOTE: In production, rewrite these to match: auth.uid() = user_roles.user_id AND user_roles.school_id = table.school_id
CREATE POLICY "Allow All" ON schools FOR ALL USING (true);
CREATE POLICY "Allow All" ON classes FOR ALL USING (true);
CREATE POLICY "Allow All" ON staff FOR ALL USING (true);
CREATE POLICY "Allow All" ON parents FOR ALL USING (true);
CREATE POLICY "Allow All" ON students FOR ALL USING (true);
CREATE POLICY "Allow All" ON fee_structures FOR ALL USING (true);
CREATE POLICY "Allow All" ON attendance FOR ALL USING (true);

-- FORM BUILDER TABLES --
CREATE TABLE IF NOT EXISTS form_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID REFERENCES schools(id) NOT NULL,
  form_name TEXT NOT NULL, 
  sections_config JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(school_id, form_name)
);

CREATE TABLE IF NOT EXISTS custom_fields (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID REFERENCES schools(id) NOT NULL,
  form_name TEXT NOT NULL, 
  section_name TEXT NOT NULL, 
  field_label TEXT NOT NULL, 
  field_type TEXT NOT NULL, 
  options JSONB, 
  is_required BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE form_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_fields ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow All" ON form_settings FOR ALL USING (true);
CREATE POLICY "Allow All" ON custom_fields FOR ALL USING (true);

