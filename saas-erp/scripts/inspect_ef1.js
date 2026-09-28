import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();

let supabaseUrl = process.env.VITE_SUPABASE_URL;
let supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
try {
  const envText = fs.readFileSync('../superadmin/.env', 'utf8');
  const u = envText.match(/VITE_SUPABASE_URL=(.*)/)?.[1]?.trim();
  const k = envText.match(/VITE_SUPABASE_SERVICE_ROLE_KEY=(.*)/)?.[1]?.trim();
  if (u && k) { supabaseUrl = u; supabaseKey = k; }
} catch (e) {}

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectEF1() {
  const sid = 'aed24dc2-c3ac-47a1-9287-3b003934f720';

  console.log('=== Fee Structures for EF-1 classes ===');
  const { data: fsList } = await supabase.from('fee_structures')
    .select('*, classes(name, section)')
    .eq('school_id', sid)
    .in('class_id', ['08bbc672-39bc-4dd2-b897-003031cab63b', '943b6451-d1e5-40c6-93b0-45578442ae9e']);
  console.log(JSON.stringify(fsList, null, 2));

  console.log('\n=== Students in EF-1 (BEG) [08bbc672-39bc-4dd2-b897-003031cab63b] ===');
  const { data: begStudents } = await supabase.from('students')
    .select('id, full_name, roll_number, student_unique_id, fee_override, fee_waiver_percentage, class_id')
    .eq('class_id', '08bbc672-39bc-4dd2-b897-003031cab63b');
  console.log('Found', begStudents?.length, 'students in EF-1 (BEG)');
  console.log(begStudents?.slice(0, 5));

  // Check their fee records from previous months!
  const begStudentIds = (begStudents || []).map(s => s.id);
  const { data: pastFees } = await supabase.from('fee_records')
    .select('month_year, student_id, total_amount, paid_amount, discount_amount, breakdown')
    .in('student_id', begStudentIds.slice(0, 5))
    .order('month_year', { ascending: false });
  console.log('\n=== Sample Past Fee Records for these students ===');
  console.log(JSON.stringify(pastFees?.slice(0, 10), null, 2));

  // Check if any other classes have 0 fee structure or no fee structure
  const { data: allFS } = await supabase.from('fee_structures')
    .select('id, class_id, amount, fee_matrix, classes(name, section)')
    .eq('school_id', sid);
  console.log('\n=== All Fee Structures with 0 or empty fee_matrix ===');
  for (const f of allFS || []) {
    const recurrent = f.fee_matrix?.recurrent || [];
    if (f.amount === 0 || recurrent.length === 0) {
      console.log(`Class ${f.classes?.name} (${f.classes?.section}) -> amount: ${f.amount}, recurrent: ${JSON.stringify(recurrent)}`);
    }
  }
}

inspectEF1();
