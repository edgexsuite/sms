-- ============================================================
-- Phase 5 Schema Migration
-- Run this in Supabase SQL Editor
-- ============================================================

-- 5a: Payroll Module
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS salary_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  component_type TEXT NOT NULL CHECK (component_type IN ('allowance', 'deduction')),
  calculation_type TEXT NOT NULL DEFAULT 'fixed' CHECK (calculation_type IN ('fixed', 'percentage')),
  amount NUMERIC DEFAULT 0,
  percentage NUMERIC DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (school_id, name)
);

CREATE TABLE IF NOT EXISTS payroll_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  staff_id UUID REFERENCES staff(id) ON DELETE CASCADE,
  month_year TEXT NOT NULL,            -- '2026-04' format
  base_salary NUMERIC NOT NULL DEFAULT 0,
  allowances JSONB DEFAULT '[]',       -- [{name, amount}]
  deductions JSONB DEFAULT '[]',       -- [{name, amount}]
  gross_salary NUMERIC NOT NULL DEFAULT 0,
  net_salary NUMERIC NOT NULL DEFAULT 0,
  absent_days INTEGER DEFAULT 0,
  per_day_salary NUMERIC DEFAULT 0,
  absent_deduction NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  paid_at TIMESTAMPTZ,
  payment_source TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (school_id, staff_id, month_year)
);

CREATE TABLE IF NOT EXISTS staff_loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  staff_id UUID REFERENCES staff(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  remaining_amount NUMERIC NOT NULL,
  monthly_installment NUMERIC NOT NULL,
  reason TEXT,
  issued_date DATE DEFAULT CURRENT_DATE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'cleared')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS for payroll
ALTER TABLE salary_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_loans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "school_member_salary_components" ON salary_components
  USING (school_id IN (SELECT school_id FROM user_roles WHERE user_id = auth.uid()));
CREATE POLICY "school_member_payroll_records" ON payroll_records
  USING (school_id IN (SELECT school_id FROM user_roles WHERE user_id = auth.uid()));
CREATE POLICY "school_member_staff_loans" ON staff_loans
  USING (school_id IN (SELECT school_id FROM user_roles WHERE user_id = auth.uid()));

-- 5b: Accounting Module
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  account_type TEXT NOT NULL CHECK (account_type IN ('asset', 'liability', 'equity', 'income', 'expense')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (school_id, code)
);

CREATE TABLE IF NOT EXISTS journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reference_no TEXT,
  narration TEXT NOT NULL,
  status TEXT DEFAULT 'posted' CHECK (status IN ('draft', 'posted', 'reversed')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS journal_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_id UUID REFERENCES accounts(id),
  debit NUMERIC DEFAULT 0,
  credit NUMERIC DEFAULT 0,
  description TEXT
);

-- RLS for accounting
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "school_member_accounts" ON accounts
  USING (school_id IN (SELECT school_id FROM user_roles WHERE user_id = auth.uid()));
CREATE POLICY "school_member_journal_entries" ON journal_entries
  USING (school_id IN (SELECT school_id FROM user_roles WHERE user_id = auth.uid()));
CREATE POLICY "school_member_journal_lines" ON journal_lines
  USING (entry_id IN (SELECT id FROM journal_entries WHERE school_id IN (SELECT school_id FROM user_roles WHERE user_id = auth.uid())));

-- 5d: Library Module
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS library_books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  author TEXT,
  isbn TEXT,
  category TEXT,
  total_copies INTEGER DEFAULT 1,
  available_copies INTEGER DEFAULT 1,
  shelf_location TEXT,
  published_year INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS library_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  member_type TEXT NOT NULL CHECK (member_type IN ('student', 'staff', 'other')),
  member_id UUID,                     -- student_id or staff_id (optional FK)
  member_name TEXT NOT NULL,
  card_number TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS library_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  book_id UUID REFERENCES library_books(id),
  member_id UUID REFERENCES library_members(id),
  issued_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  returned_date DATE,
  fine_amount NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'issued' CHECK (status IN ('issued', 'returned', 'overdue')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS for library
ALTER TABLE library_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE library_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE library_issues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "school_member_library_books" ON library_books
  USING (school_id IN (SELECT school_id FROM user_roles WHERE user_id = auth.uid()));
CREATE POLICY "school_member_library_members" ON library_members
  USING (school_id IN (SELECT school_id FROM user_roles WHERE user_id = auth.uid()));
CREATE POLICY "school_member_library_issues" ON library_issues
  USING (school_id IN (SELECT school_id FROM user_roles WHERE user_id = auth.uid()));

-- 5f: Front Desk Module
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admission_inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  student_name TEXT NOT NULL,
  father_name TEXT,
  contact_number TEXT,
  email TEXT,
  applying_for_class TEXT,
  inquiry_date DATE DEFAULT CURRENT_DATE,
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'test_scheduled', 'enrolled', 'rejected')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS visitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  visitor_name TEXT NOT NULL,
  phone TEXT,
  purpose TEXT,
  whom_to_meet TEXT,
  check_in TIMESTAMPTZ DEFAULT now(),
  check_out TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  audience TEXT DEFAULT 'all' CHECK (audience IN ('all', 'students', 'staff', 'parents')),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('normal', 'urgent')),
  posted_by TEXT,
  expires_at DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS for front desk
ALTER TABLE admission_inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE visitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE notices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "school_member_admission_inquiries" ON admission_inquiries
  USING (school_id IN (SELECT school_id FROM user_roles WHERE user_id = auth.uid()));
CREATE POLICY "school_member_visitors" ON visitors
  USING (school_id IN (SELECT school_id FROM user_roles WHERE user_id = auth.uid()));
CREATE POLICY "school_member_notices" ON notices
  USING (school_id IN (SELECT school_id FROM user_roles WHERE user_id = auth.uid()));

-- 5g: Family Groups
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS family_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  family_name TEXT NOT NULL,
  primary_contact TEXT,
  primary_phone TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add family_group_id to students if not exists
ALTER TABLE students ADD COLUMN IF NOT EXISTS family_group_id UUID REFERENCES family_groups(id);

ALTER TABLE family_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "school_member_family_groups" ON family_groups
  USING (school_id IN (SELECT school_id FROM user_roles WHERE user_id = auth.uid()));

-- ============================================================
-- Done. Run this entire script once in Supabase SQL Editor.
-- ============================================================
