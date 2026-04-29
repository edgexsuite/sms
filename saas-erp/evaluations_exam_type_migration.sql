-- Migration: Add exam_type_id to evaluations to link performance reviews with specific exams
-- Run this in the Supabase SQL Editor

ALTER TABLE evaluations 
  ADD COLUMN IF NOT EXISTS exam_type_id UUID REFERENCES exam_types(id) ON DELETE SET NULL;

-- Description: This column is required by the TeacherDashboard and Evaluation modules 
-- to allow teachers to link qualitative student evaluations with formal exam sessions.
