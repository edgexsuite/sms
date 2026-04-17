-- 04_communication_templates.sql
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS communication_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID REFERENCES schools(id) NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE communication_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow All" ON communication_templates;
CREATE POLICY "Allow All" ON communication_templates FOR ALL USING (true);
