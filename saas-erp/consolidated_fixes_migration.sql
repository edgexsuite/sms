-- ============================================================
-- Consolidated ERP Database Fixes Migration
-- Run in Supabase SQL Editor — safe to re-run anytime
-- ============================================================

-- ── 1. Audit Logs ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id           UUID        DEFAULT uuid_generate_v4() PRIMARY KEY,
  action       TEXT        NOT NULL,
  module       TEXT        NOT NULL,
  description  TEXT        NOT NULL,
  entity_type  TEXT,
  entity_id    TEXT,
  entity_name  TEXT,
  details      JSONB,
  metadata     JSONB,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_name TEXT DEFAULT 'Unknown';
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_role TEXT DEFAULT 'unknown';
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS metadata JSONB;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS details JSONB;

CREATE INDEX IF NOT EXISTS idx_audit_meta_school ON audit_logs ((metadata->>'school_id'), created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_det_school  ON audit_logs ((details->>'school_id'), created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_created_at  ON audit_logs (created_at DESC);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow All" ON audit_logs;
CREATE POLICY "Allow All" ON audit_logs FOR ALL USING (true) WITH CHECK (true);


-- ── 2. Staff Advances (Payroll) ──────────────────────────────
ALTER TABLE IF EXISTS staff_advances ADD COLUMN IF NOT EXISTS given_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE IF EXISTS staff_advances ADD COLUMN IF NOT EXISTS remaining_balance NUMERIC DEFAULT 0;
ALTER TABLE IF EXISTS staff_advances ADD COLUMN IF NOT EXISTS monthly_deduction NUMERIC DEFAULT 0;
ALTER TABLE IF EXISTS staff_advances ADD COLUMN IF NOT EXISTS reason TEXT;


-- ── 3. Transport Module ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS transport_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  route_name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS transport_stops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  route_id UUID NOT NULL REFERENCES transport_routes(id) ON DELETE CASCADE,
  stop_name TEXT NOT NULL,
  pickup_time TEXT,
  dropoff_time TEXT,
  sequence_order INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  vehicle_name TEXT NOT NULL,
  registration_number TEXT,
  capacity INT DEFAULT 40,
  driver_name TEXT,
  driver_phone TEXT,
  route_id UUID REFERENCES transport_routes(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS student_transport (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  route_id UUID NOT NULL REFERENCES transport_routes(id) ON DELETE CASCADE,
  stop_id UUID REFERENCES transport_stops(id) ON DELETE SET NULL,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  transport_type TEXT DEFAULT 'both' CHECK (transport_type IN ('pickup','dropoff','both')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (school_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_transport_routes_school ON transport_routes(school_id);
CREATE INDEX IF NOT EXISTS idx_transport_stops_route ON transport_stops(route_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_school ON vehicles(school_id);
CREATE INDEX IF NOT EXISTS idx_student_transport_student ON student_transport(student_id);
CREATE INDEX IF NOT EXISTS idx_student_transport_route ON student_transport(route_id);

ALTER TABLE transport_routes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow All" ON transport_routes;
CREATE POLICY "Allow All" ON transport_routes FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE transport_stops ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow All" ON transport_stops;
CREATE POLICY "Allow All" ON transport_stops FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow All" ON vehicles;
CREATE POLICY "Allow All" ON vehicles FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE student_transport ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow All" ON student_transport;
CREATE POLICY "Allow All" ON student_transport FOR ALL USING (true) WITH CHECK (true);
