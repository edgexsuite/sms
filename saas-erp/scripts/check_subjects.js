
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data, error } = await supabase
    .from('subjects')
    .select('id, subject_name, class_id, total_marks')
    .ilike('subject_name', '%ISLAMIYAT%');
  
  if (error) console.error(error);
  else console.log(JSON.stringify(data, null, 2));
}

check();
