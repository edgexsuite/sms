
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data: cls } = await supabase.from('classes').select('id, name, section').ilike('name', '%3%');
  if (cls) console.log(JSON.stringify(cls, null, 2));

  const { data: cls2 } = await supabase.from('classes').select('id, name, section').ilike('name', '%III%');
  if (cls2) console.log(JSON.stringify(cls2, null, 2));
}

check();
