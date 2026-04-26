CREATE TABLE IF NOT EXISTS report_card_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID REFERENCES schools(id) NOT NULL,
  template TEXT NOT NULL DEFAULT 'classic', 
  fields JSONB DEFAULT '[]'::jsonb, -- Array of visible keys
  layout_config JSONB DEFAULT '{}'::jsonb,
  UNIQUE(school_id)
);

ALTER TABLE report_card_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow All" ON report_card_settings FOR ALL USING (true);
