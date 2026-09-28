import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';

let supabaseUrl = process.env.VITE_SUPABASE_URL;
let supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

try {
  const envText = fs.readFileSync('../superadmin/.env', 'utf8');
  const u = envText.match(/VITE_SUPABASE_URL=(.*)/)?.[1]?.trim();
  const k = envText.match(/VITE_SUPABASE_SERVICE_ROLE_KEY=(.*)/)?.[1]?.trim();
  if (u && k) {
    supabaseUrl = u;
    supabaseKey = k;
  }
} catch (e) {}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: schools } = await supabase.from('schools').select('id, name');
  console.log('Schools:', schools);
  if (!schools || schools.length === 0) return;
  const sid = schools[0].id; // The Edge School Bahawalpur

  const { data: classes } = await supabase.from('classes').select('id, name, section').eq('school_id', sid).order('name');
  console.log('Classes count:', classes?.length);

  const { data: feeStructures } = await supabase.from('fee_structures').select('id, class_id, amount, fee_matrix').eq('school_id', sid);
  console.log('Fee structures count:', feeStructures?.length);

  const fsClassIds = new Set((feeStructures || []).map(f => f.class_id));

  // Find classes with students but NO fee structure
  const { data: students } = await supabase.from('students')
    .select('id, full_name, class_id, roll_number, student_unique_id, fee_override, fee_waiver_percentage, status')
    .eq('school_id', sid)
    .eq('status', 'active');

  console.log('Total active students:', students?.length);

  const studentsByClass = {};
  for (const s of students || []) {
    studentsByClass[s.class_id] = (studentsByClass[s.class_id] || 0) + 1;
  }

  console.log('\n--- Classes Summary ---');
  for (const c of classes || []) {
    const studentCount = studentsByClass[c.id] || 0;
    const hasFS = fsClassIds.has(c.id);
    const fs = feeStructures?.find(f => f.class_id === c.id);
    console.log(
      'Class: ' + c.name + ' (' + (c.section || '') + ') [ID: ' + c.id + '] -> ' +
      studentCount + ' students | Fee Structure: ' + (hasFS ? 'YES (Amount: ' + fs?.amount + ')' : 'NO ❌')
    );
  }

  // Check students with fee_override
  const studentsWithOverride = students?.filter(s => s.fee_override);
  console.log('\nStudents with fee_override count:', studentsWithOverride?.length);
  if (studentsWithOverride && studentsWithOverride.length > 0) {
    console.log('Sample overrides:', studentsWithOverride.slice(0, 5).map(s => ({
      name: s.full_name,
      class_id: s.class_id,
      override: s.fee_override
    })));
  }

  // Also check recent fee_records to see which months exist and which class students had previous fees
  const { data: recentFees } = await supabase.from('fee_records')
    .select('month_year, student_id, total_amount, breakdown')
    .eq('school_id', sid)
    .order('month_year', { ascending: false })
    .limit(10);
  console.log('\nRecent fee records:', recentFees?.slice(0, 3));
}

check();
