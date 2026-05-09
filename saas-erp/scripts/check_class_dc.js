
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data: cls, error } = await supabase.from('classes').select('name, section').eq('id', 'dc97691d-7200-4b1e-8053-35896caf4d73').maybeSingle();
  if (error) return console.error(error);
  console.log(JSON.stringify(cls, null, 2));
}

check();
