-- ============================================================
-- FEE SYSTEM SCHEMA SYNCHRONIZATION
-- Resolve ghost columns in fee_records and financial_transactions
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. fee_records: Add missing columns
ALTER TABLE fee_records 
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS student_name TEXT,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- 2. financial_transactions: Add missing columns
ALTER TABLE financial_transactions 
  ADD COLUMN IF NOT EXISTS fee_record_id UUID REFERENCES fee_records(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS fee_items JSONB DEFAULT '[]'::jsonb;

-- 3. schools: Add missing configuration columns
ALTER TABLE schools 
  ADD COLUMN IF NOT EXISTS monthly_leave_limit INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS yearly_leave_limit  INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS diary_settings      JSONB DEFAULT '{
    "show_topic_covered": true,
    "show_homework": true,
    "show_activity_notes": true,
    "show_next_plan": true
  }'::jsonb;

-- 4. Verify fee_records constraints
-- Ensure status includes 'partial'
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fee_records_status_check') THEN
    ALTER TABLE fee_records ADD CONSTRAINT fee_records_status_check 
      CHECK (status IN ('pending', 'paid', 'partial', 'overdue'));
  END IF;
END $$;

-- 5. Enable RLS on any new potential access patterns (if needed)
-- (Existing policies usually cover all columns)

-- Done!
