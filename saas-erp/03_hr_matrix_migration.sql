-- 1. Upgrade Attendance Status Constraints
-- First, drop the old constraint holding back half-leaves
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_status_check;
-- Rebuild it with the new half-leave tag
ALTER TABLE attendance ADD CONSTRAINT attendance_status_check CHECK (status IN ('present', 'absent', 'late', 'excused', 'half-leave'));

-- 2. Upgrade Staff HR Parameters
-- We retain default strict boundaries to avoid breaking old data
ALTER TABLE staff ADD COLUMN IF NOT EXISTS employment_type TEXT DEFAULT 'full-time' CHECK (employment_type IN ('full-time', 'visiting'));
ALTER TABLE staff ADD COLUMN IF NOT EXISTS payment_basis TEXT DEFAULT 'monthly' CHECK (payment_basis IN ('monthly', 'per-lecture', 'per-day'));
