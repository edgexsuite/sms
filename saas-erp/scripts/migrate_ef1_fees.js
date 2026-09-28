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

async function runMigration() {
  const schoolId = 'aed24dc2-c3ac-47a1-9287-3b003934f720';
  const begClassId = '08bbc672-39bc-4dd2-b897-003031cab63b';

  console.log('=== Step 1: Update Class Fee Template for EF-1 (BEG) ===');
  const classFeeMatrix = {
    recurrent: [
      { item: 'Monthly Tuition Fee', amount: 5000 }
    ],
    first_time: [
      { item: 'Admission Fee', amount: 5000 },
      { item: 'Security Deposit', amount: 5000 },
      { item: 'REGISTRATION FEE', amount: 2000 }
    ]
  };

  const { data: updatedFS, error: fsError } = await supabase
    .from('fee_structures')
    .update({
      amount: 5000,
      fee_matrix: classFeeMatrix
    })
    .eq('school_id', schoolId)
    .eq('class_id', begClassId)
    .select();

  if (fsError) {
    console.error('Error updating fee_structures:', fsError);
  } else {
    console.log('✅ Updated fee_structures for EF-1 (BEG):', updatedFS);
  }

  console.log('\n=== Step 2: Set Student-Specific Fee Matrices (fee_override) ===');
  const { data: students } = await supabase
    .from('students')
    .select('id, full_name, roll_number, fee_waiver_percentage')
    .eq('class_id', begClassId);

  // Student-specific monthly tuition fee overrides based on September agreements
  const customMonthlyFees = {
    'Hamna Usman': 3500,
    'MUSTAFA GHANI': 3000,
    'Malik Saud Channar': 3000,
    'Muhammad Mahbeer Ali': 2000,
    'Kinza Batool': 2000,
    'Haiqua Ahmad': 2000,
    'Abdul Hanan': 3000,
    'Zain waseem': 2500,
    'Amal Gulraiz': 4000,
  };

  for (const s of students || []) {
    if (customMonthlyFees[s.full_name] !== undefined) {
      const targetAmount = customMonthlyFees[s.full_name];
      const overrideMatrix = {
        recurrent: [
          { item: 'Monthly Tuition Fee', amount: targetAmount }
        ],
        first_time: []
      };

      const { error: updErr } = await supabase
        .from('students')
        .update({ fee_override: overrideMatrix })
        .eq('id', s.id);

      if (updErr) {
        console.error(`❌ Error setting override for ${s.full_name}:`, updErr);
      } else {
        console.log(`✅ Set fee_override for ${s.full_name}: Rs. ${targetAmount}/month`);
      }
    } else {
      console.log(`ℹ️ ${s.full_name}: Using class base (Rs. 5000) with ${s.fee_waiver_percentage || 0}% waiver`);
    }
  }

  console.log('\n🎉 Step 1 & Step 2 completed successfully!');
}

runMigration();
