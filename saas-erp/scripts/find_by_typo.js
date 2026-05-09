
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data: subs, error } = await supabase
    .from('subjects')
    .select('id, subject_name, class_id, total_marks')
    .ilike('subject_name', '%Writting%'); // Search for the typo
  
  if (error) return console.error(error);

  const { data: cls } = await supabase.from('classes').select('id, name, section');
  const classMap = Object.fromEntries(cls.map(c => [c.id, `${c.name} ${c.section}`]));

  for (const s of subs) {
    console.log(`Class: ${classMap[s.class_id]} (${s.class_id})`);
    console.log(`  - [${s.id}] ${s.subject_name} (${s.total_marks})`);
    
    // Find other subjects in this class
    const { data: others } = await supabase.from('subjects').select('id, subject_name, total_marks').eq('class_id', s.class_id);
    (others || []).forEach(o => {
       if (o.id !== s.id) console.log(`    * [${o.id}] ${o.subject_name} (${o.total_marks})`);
    });
  }
}

check();
