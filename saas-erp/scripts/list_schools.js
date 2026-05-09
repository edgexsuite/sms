
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data: sch, error } = await supabase.from('schools').select('id, name');
  if (error) return console.error(error);
  console.log(JSON.stringify(sch, null, 2));
}

check();
