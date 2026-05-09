
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data: subs, error } = await supabase
    .from('subjects')
    .select('subject_name, class_id, total_marks');
  
  if (error) return console.error(error);

  subs.forEach(s => {
    console.log(`Class: ${s.class_id} | Sub: ${s.subject_name} | Marks: ${s.total_marks}`);
  });
}

check();
