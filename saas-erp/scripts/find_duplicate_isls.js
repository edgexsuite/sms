
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
    const isls = sList.filter(s => s.subject_name.toUpperCase().includes('ISLAMIYAT'));
    if (isls.length > 1) {
      console.log(`Class: ${classMap[cid]} (${cid})`);
      isls.forEach(i => console.log(`  - [${i.id}] ${i.subject_name} (${i.total_marks})`));
    }
  }
}

check();
