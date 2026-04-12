-- ============================================================
-- Phase 6 Schema Migration — File Uploads
-- Run this in Supabase SQL Editor
-- ============================================================

-- Add photograph_url to students table
ALTER TABLE students ADD COLUMN IF NOT EXISTS photograph_url TEXT;

-- Storage bucket for school assets (logos, student photos)
-- Note: The storage.buckets table may require superuser access.
-- If the INSERT below fails, create the bucket manually in
-- Supabase Dashboard → Storage → New Bucket → name: "school-assets", Public: ON

INSERT INTO storage.buckets (id, name, public)
VALUES ('school-assets', 'school-assets', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for storage (drop first to avoid conflicts)
DROP POLICY IF EXISTS "public_read_school_assets" ON storage.objects;
DROP POLICY IF EXISTS "auth_upload_school_assets" ON storage.objects;
DROP POLICY IF EXISTS "auth_update_school_assets" ON storage.objects;
DROP POLICY IF EXISTS "auth_delete_school_assets" ON storage.objects;

CREATE POLICY "public_read_school_assets"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'school-assets');

CREATE POLICY "auth_upload_school_assets"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'school-assets' AND auth.role() = 'authenticated');

CREATE POLICY "auth_update_school_assets"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'school-assets' AND auth.role() = 'authenticated');

CREATE POLICY "auth_delete_school_assets"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'school-assets' AND auth.role() = 'authenticated');

-- ============================================================
-- Done.
-- ============================================================
