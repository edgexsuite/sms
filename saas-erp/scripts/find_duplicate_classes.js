
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data: cls, error } = await supabase
    .from('classes')
    .select('id, name, section');
  
  if (error) return console.error(error);

  const names = {};
  cls.forEach(c => {
    const key = `${c.name} ${c.section}`;
    if (!names[key]) names[key] = [];
    names[key].push(c.id);
  });

  for (const [name, ids] of Object.entries(names)) {
    if (ids.length > 1) {
      console.log(`Duplicate Class Name: ${name}`);
      for (const id of ids) {
        const { data: subs } = await supabase.from('subjects').select('subject_name').eq('class_id', id);
        console.log(`  - [${id}] Subjects: ${subs.map(s => s.subject_name).join(', ')}`);
      }
    }
  }
}

check();
