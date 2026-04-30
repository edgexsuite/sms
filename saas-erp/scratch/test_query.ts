import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testQuery() {
  const staffId = '...'; // I don't know the staffId, so I'll just check the schema/relationship
  const { data, error } = await supabase
    .from('chat_messages')
    .select(`
      id, student_id, sender_id, receiver_id, sender_type, receiver_type, message, created_at, is_read,
      students (id, full_name, roll_number, photograph_url, parent_id, classes (name, section))
    `)
    .limit(1);
    
  if (error) {
    console.error('QUERY ERROR:', error);
  } else {
    console.log('QUERY SUCCESS:', data);
  }
}
