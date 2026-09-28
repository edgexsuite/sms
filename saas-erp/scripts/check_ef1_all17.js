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

async function checkAll17() {
  const classId = '08bbc672-39bc-4dd2-b897-003031cab63b'; // EF-1 (BEG)
  const { data: students } = await supabase.from('students')
    .select('id, full_name, roll_number, student_unique_id, fee_override, fee_waiver_percentage')
    .eq('class_id', classId)
    .order('roll_number');

  console.log(`=== All ${students.length} students in EF-1 (BEG) ===`);
  for (const s of students || []) {
    const { data: latestFee } = await supabase.from('fee_records')
      .select('month_year, total_amount, paid_amount, discount_amount, breakdown')
      .eq('student_id', s.id)
      .order('month_year', { ascending: false })
      .limit(1)
      .maybeSingle();

    console.log({
      name: s.full_name,
      roll: s.roll_number,
      waiver: s.fee_waiver_percentage,
      override: s.fee_override,
      latestMonth: latestFee?.month_year,
      latestTotal: latestFee?.total_amount,
      breakdown: latestFee?.breakdown
    });
  }
}

checkAll17();
