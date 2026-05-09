
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const sid = 'aed24dc2-c3ac-47a1-9287-3b003934f720';
  const { data: cls, error } = await supabase.from('classes').select('id, name, section').eq('school_id', sid);
  if (error) return console.error(error);
  console.log(JSON.stringify(cls, null, 2));
}

check();
