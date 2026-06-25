-- ============================================================
-- Demo Registration System — Database Migration
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Add demo columns to schools table
ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS demo_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS demo_notified BOOLEAN DEFAULT FALSE;

-- 2. Create demo_applications table
CREATE TABLE IF NOT EXISTS demo_applications (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_name         TEXT NOT NULL,
  city                TEXT,
  contact_phone       TEXT NOT NULL,
  contact_email       TEXT NOT NULL,
  school_type         TEXT,
  approx_students     INTEGER,
  contact_person_name TEXT,
  contact_person_role TEXT,
  how_heard           TEXT,
  status              TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  notes               TEXT,
  school_id           UUID REFERENCES schools(id) ON DELETE SET NULL,
  approved_at         TIMESTAMPTZ,
  rejected_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. RLS policies for demo_applications
ALTER TABLE demo_applications ENABLE ROW LEVEL SECURITY;

-- Public can INSERT (for registration form — no auth needed)
CREATE POLICY "Anyone can submit demo application"
  ON demo_applications FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Authenticated users can read their own application (by email match)
CREATE POLICY "Applicants can view their own application"
  ON demo_applications FOR SELECT
  TO authenticated
  USING (contact_email = auth.email());

-- Service role (superadmin) can do everything — bypasses RLS automatically

-- 4. Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_demo_applications_status ON demo_applications(status);
CREATE INDEX IF NOT EXISTS idx_demo_applications_email ON demo_applications(contact_email);
