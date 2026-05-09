
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const ids = ['dc97691d-7200-4b1e-8053-35896caf4d73', 'f2be790a-5a1a-463d-b4e6-c3dbf43f9b32', '65b5b569-ac29-4e97-be21-ee4242b81283'];
  const { data: cls, error } = await supabase.from('classes').select('id, name, section').in('id', ids);
  
  if (error) return console.error(error);
  console.log(JSON.stringify(cls, null, 2));
}

check();
