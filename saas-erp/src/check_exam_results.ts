
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkResults() {
  const { data: exams } = await supabase.from('exam_types').select('id, name').limit(5);
  console.log('Exams:', exams);

  if (exams && exams.length > 0) {
    const { data: results, error } = await supabase
      .from('exam_results')
      .select('student_id, subject_id, obtained_marks')
      .eq('exam_type_id', exams[0].id)
      .limit(5);
    
    console.log('Results for first exam:', results);
    if (error) console.error('Error:', error);
  }
}

checkResults();
