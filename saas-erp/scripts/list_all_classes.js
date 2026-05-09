
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data: cls, error } = await supabase.from('classes').select('id, name, section');
  if (error) return console.error(error);
  console.log(JSON.stringify(cls, null, 2));
}

check();
