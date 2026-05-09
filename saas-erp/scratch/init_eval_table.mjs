import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: 'c:/sms/superadmin/.env' })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Missing Supabase credentials in .env")
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function setupTable() {
    console.log('Setting up staff_evaluations table...')

    const sql = `
    CREATE TABLE IF NOT EXISTS staff_evaluations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
        staff_id UUID REFERENCES staff(id) ON DELETE CASCADE,
        evaluator_id UUID REFERENCES staff(id),
        evaluation_month DATE NOT NULL,
        total_score INTEGER NOT NULL DEFAULT 0,
        punctuality INTEGER DEFAULT 0,
        attendance INTEGER DEFAULT 0,
        class_management INTEGER DEFAULT 0,
        subject_command INTEGER DEFAULT 0,
        school_activities INTEGER DEFAULT 0,
        admissions_contribution INTEGER DEFAULT 0,
        results INTEGER DEFAULT 0,
        dress_code INTEGER DEFAULT 0,
        feedback INTEGER DEFAULT 0,
        innovation INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT now(),
        UNIQUE(staff_id, evaluation_month)
    );

    -- Add RLS
    ALTER TABLE staff_evaluations ENABLE ROW LEVEL SECURITY;
    
    DO $$ 
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies WHERE tablename = 'staff_evaluations' AND policyname = 'Enable all access for school_id'
        ) THEN
            CREATE POLICY "Enable all access for school_id" ON staff_evaluations
                FOR ALL
                USING (auth.jwt() ->> 'school_id' = school_id::text)
                WITH CHECK (auth.jwt() ->> 'school_id' = school_id::text);
        END IF;
    END $$;
    `;

    const { error } = await supabase.rpc('exec_sql', { sql });

    if (error) {
        console.error('Error creating table:', error);
    } else {
        console.log('Table staff_evaluations created successfully.');
    }
}

setupTable()
