
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data: subs, error } = await supabase
    .from('subjects')
    .select('id, subject_name, class_id, total_marks');
  
  if (error) return console.error(error);

  const groups = {};
  subs.forEach(s => {
    if (!groups[s.class_id]) groups[s.class_id] = [];
    groups[s.class_id].push(s);
  });

  for (const [cid, sList] of Object.entries(groups)) {
    if (sList.length === 8) {
      console.log(`Class with 8 subjects: ${cid}`);
      sList.forEach(i => console.log(`  - [${i.id}] ${i.subject_name} (${i.total_marks})`));
    }
  }
}

check();
