
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  // 1. Find Grade 3 classes
  const { data: classes } = await supabase.from('classes').select('id, name, section').ilike('name', '%Grade 3%');
  console.log('--- Grade 3 Classes ---');
  console.log(JSON.stringify(classes, null, 2));

  if (classes && classes.length > 0) {
    const classIds = classes.map(c => c.id);
    // 2. Find all subjects for these classes
    const { data: subjects } = await supabase.from('subjects').select('id, subject_name, class_id').in('class_id', classIds).order('subject_name');
    console.log('\n--- Grade 3 Subjects ---');
    console.log(JSON.stringify(subjects, null, 2));
    
    // 3. Find exam results for Islamiyat specifically (to see if they are orphans)
    const { data: results } = await supabase.from('exam_results').select('id, subject_id, student_id').in('subject_id', subjects.map(s => s.id)).limit(10);
    console.log('\n--- Sample Results for these subjects ---');
    console.log(JSON.stringify(results, null, 2));
  }
}

run();
