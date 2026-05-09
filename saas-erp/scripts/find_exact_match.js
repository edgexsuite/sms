
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data: subs, error } = await supabase
    .from('subjects')
    .select('id, subject_name, class_id, total_marks');
  
  if (error) return console.error(error);

  const { data: cls } = await supabase.from('classes').select('id, name, section');
  const classMap = Object.fromEntries(cls.map(c => [c.id, `${c.name} ${c.section}`]));

  const groups = {};
  subs.forEach(s => {
    if (!groups[s.class_id]) groups[s.class_id] = [];
    groups[s.class_id].push(s);
  });

  for (const [cid, sList] of Object.entries(groups)) {
    if (sList.length === 8) {
      const counts = {};
      sList.forEach(s => { counts[s.total_marks] = (counts[s.total_marks] || 0) + 1; });
      
      if (counts[100] === 1 && counts[30] === 7) {
        console.log(`EXACT MATCH FOUND! Class: ${classMap[cid]} (${cid})`);
        sList.forEach(i => console.log(`  - [${i.id}] ${i.subject_name} (Total: ${i.total_marks})`));
      }
    }
  }
}

check();
