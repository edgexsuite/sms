import { supabase } from './lib/supabase';

async function checkSchema() {
  const { data, error } = await supabase.from('teacher_diary').select('*').limit(1);
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Columns:', Object.keys(data[0] || {}));
  }
}

checkSchema();
