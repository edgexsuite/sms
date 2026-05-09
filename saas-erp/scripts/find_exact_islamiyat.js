
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data: subs, error } = await supabase
    .from('subjects')
    .select('id, subject_name, class_id, total_marks')
    .eq('subject_name', 'Islamiyat');
  
  if (error) return console.error(error);

  const { data: cls } = await supabase.from('classes').select('id, name, section');
  const classMap = Object.fromEntries(cls.map(c => [c.id, `${c.name} ${c.section}`]));

  for (const s of subs) {
    console.log(`Found 'Islamiyat' in Class: ${classMap[s.class_id]} (${s.class_id}) [${s.id}]`);
  }
}

check();
