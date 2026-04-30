-- ============================================================
-- FIX COMPLAINTS TABLE SCHEMA
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. Add missing columns to complaints table
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'complaint';
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal';
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS submitted_by_type TEXT;
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS submitted_by_name TEXT;
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS responses JSONB DEFAULT '[]'::jsonb;
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS forwarded_to_role TEXT;

-- 2. Update status constraint to include all used statuses
ALTER TABLE complaints DROP CONSTRAINT IF EXISTS complaints_status_check;
ALTER TABLE complaints ADD CONSTRAINT complaints_status_check 
  CHECK (status IN ('pending', 'in_progress', 'forwarded', 'resolved', 'closed'));

-- 3. Update priority constraint
ALTER TABLE complaints DROP CONSTRAINT IF EXISTS complaints_priority_check;
ALTER TABLE complaints ADD CONSTRAINT complaints_priority_check 
  CHECK (priority IN ('low', 'normal', 'high', 'urgent'));

-- 4. Update type constraint
ALTER TABLE complaints DROP CONSTRAINT IF EXISTS complaints_type_check;
ALTER TABLE complaints ADD CONSTRAINT complaints_type_check 
  CHECK (type IN ('complaint', 'feedback', 'suggestion', 'query'));
