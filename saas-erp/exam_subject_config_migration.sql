-- SQL Migration: Granular Subject Marks per Exam Type
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS exam_subject_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  exam_type_id uuid REFERENCES exam_types(id) ON DELETE CASCADE,
  subject_id uuid REFERENCES subjects(id) ON DELETE CASCADE,
  total_marks numeric NOT NULL,
  passing_marks numeric NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(exam_type_id, subject_id)
);

-- Enable RLS
ALTER TABLE exam_subject_config ENABLE ROW LEVEL SECURITY;

-- Add RLS Policy
DROP POLICY IF EXISTS "Users can manage their school's exam subject config" ON exam_subject_config;
CREATE POLICY "Users can manage their school's exam subject config" ON exam_subject_config
  FOR ALL USING (school_id = (auth.jwt() ->> 'school_id')::uuid);
