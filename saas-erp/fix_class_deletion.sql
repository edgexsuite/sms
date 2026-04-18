-- Run this snippet in your Supabase SQL Editor to allow deleting Classes that have existing Fee Templates
ALTER TABLE fee_structures
DROP CONSTRAINT IF EXISTS fee_structures_class_id_fkey;

ALTER TABLE fee_structures
ADD CONSTRAINT fee_structures_class_id_fkey
FOREIGN KEY (class_id) REFERENCES classes(id)
ON DELETE CASCADE;

-- Optional: Do the same for subjects if you want deleting a class to delete its subjects
ALTER TABLE subjects
DROP CONSTRAINT IF EXISTS subjects_class_id_fkey;

ALTER TABLE subjects
ADD CONSTRAINT subjects_class_id_fkey
FOREIGN KEY (class_id) REFERENCES classes(id)
ON DELETE CASCADE;
