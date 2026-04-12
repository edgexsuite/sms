-- SECURITY & TRASHBIN SCHEMA UPDATE
-- Run this in your Supabase SQL Editor

-- 1. Add permissions to user_roles
ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{"modules": {"students": true, "staff": true, "finance": true, "academic": true, "services": true, "reports": true, "support": true, "settings": true}, "actions": {"delete_student": false, "delete_staff": false, "delete_expense": false}}'::jsonb;

-- 2. Add Deleted flags to core tables
ALTER TABLE students ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;
ALTER TABLE students ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE staff ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE financial_transactions ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;
ALTER TABLE financial_transactions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- 3. MERGE & CLEANUP DUPLICATE STAFF (Solving Foreign Key Dependencies)
-- This block re-links all activity (Attendance, Payroll, etc.) to a single 'Master' record
DO $$ 
BEGIN
    -- Temporary mapping of redundant records to their 'Master' version (earliest record)
    CREATE TEMP TABLE staff_merge_map AS
    SELECT 
        id as redundant_id,
        first_value(id) OVER (PARTITION BY school_id, cnic ORDER BY created_at ASC) as master_id
    FROM staff
    WHERE cnic IS NOT NULL;

    -- Migrate Attendance references
    UPDATE attendance a
    SET staff_id = m.master_id
    FROM staff_merge_map m
    WHERE a.staff_id = m.redundant_id 
    AND m.redundant_id != m.master_id;

    -- Migrate Classes references
    UPDATE classes c
    SET class_teacher_id = m.master_id
    FROM staff_merge_map m
    WHERE c.class_teacher_id = m.redundant_id 
    AND m.redundant_id != m.master_id;

    -- Migrate Leave references
    UPDATE leave_applications l
    SET staff_id = m.master_id
    FROM staff_merge_map m
    WHERE l.staff_id = m.redundant_id 
    AND m.redundant_id != m.master_id;

    -- Migrate Payroll references
    UPDATE payroll_records p
    SET staff_id = m.master_id
    FROM staff_merge_map m
    WHERE p.staff_id = m.redundant_id 
    AND m.redundant_id != m.master_id;

    -- Migrate Timetable references
    UPDATE timetable_slots t
    SET teacher_id = m.master_id
    FROM staff_merge_map m
    WHERE t.teacher_id = m.redundant_id 
    AND m.redundant_id != m.master_id;

    -- Final Pruning of redundant staff records
    DELETE FROM staff 
    WHERE id IN (SELECT redundant_id FROM staff_merge_map WHERE redundant_id != master_id);
    
    DROP TABLE staff_merge_map;
END $$;

-- 4. Add Unique Constraint to staff CNIC
-- Secure the registry against future duplications
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'staff_school_cnic_key') THEN
    ALTER TABLE staff ADD CONSTRAINT staff_school_cnic_key UNIQUE (school_id, cnic);
  END IF;
END $$;

-- 5. Initialize PIN in form_settings
INSERT INTO form_settings (school_id, form_name, sections_config)
SELECT id, 'security_settings', '{"delete_pin": "1122"}'::jsonb
FROM schools
ON CONFLICT (school_id, form_name) DO NOTHING;
