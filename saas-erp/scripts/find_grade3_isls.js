
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const sid = 'aed24dc2-c3ac-47a1-9287-3b003934f720'; // The Edge School
  
  // 1. Find classes with "3" in the name
  const { data: cls } = await supabase.from('classes').select('id, name, section').eq('school_id', sid).ilike('name', '%3%');
  if (!cls) return console.log('No Grade 3 classes found.');

  for (const c of cls) {
    console.log(`Checking Class: ${c.name} ${c.section} (${c.id})`);
    
    // 2. Find "Islamiyat" in these classes
    const { data: subs } = await supabase.from('subjects').select('id, subject_name, total_marks').eq('class_id', c.id).ilike('subject_name', 'Islamiyat');
    if (subs) {
      subs.forEach(s => {
        console.log(`  - MATCH: [${s.id}] ${s.subject_name} (${s.total_marks})`);
      });
    }
  }
}

check();
