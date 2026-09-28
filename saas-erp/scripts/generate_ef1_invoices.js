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

async function generateEF1Invoices() {
  const schoolId = 'aed24dc2-c3ac-47a1-9287-3b003934f720';
  const begClassId = '08bbc672-39bc-4dd2-b897-003031cab63b';
  const targetMonth = '2026-10-01';
  const dueDate = '2026-10-10';

  console.log(`\n=== Generating Monthly Invoices for EF-1 (BEG) - Month: ${targetMonth} ===`);

  // 1. Fetch class fee structure
  const { data: structure } = await supabase
    .from('fee_structures')
    .select('*')
    .eq('school_id', schoolId)
    .eq('class_id', begClassId)
    .single();

  console.log('Class fee structure:', structure?.amount, structure?.fee_matrix?.recurrent);

  // 2. Fetch active students in EF-1 (BEG)
  const { data: students } = await supabase
    .from('students')
    .select('*')
    .eq('school_id', schoolId)
    .eq('class_id', begClassId)
    .eq('status', 'active')
    .lt('fee_waiver_percentage', 100) // Exclude 100% free students
    .order('roll_number');

  console.log(`Found ${students?.length} billable students in EF-1 (BEG)`);

  // 3. Check existing invoices for targetMonth
  const { data: existing } = await supabase
    .from('fee_records')
    .select('student_id')
    .eq('school_id', schoolId)
    .eq('month_year', targetMonth)
    .is('deleted_at', null);

  const existingIds = new Set(existing?.map(e => e.student_id) || []);
  const billable = (students || []).filter(s => !existingIds.has(s.id));
  console.log(`${existingIds.size} already exist for this month. Students needing invoice: ${billable.length}`);

  if (billable.length === 0) {
    console.log('All students already have invoices for', targetMonth);
    return;
  }

  // 4. Construct inserts
  const inserts = billable.map(student => {
    const studentOverride = student.fee_override;
    const matrix = studentOverride || structure?.fee_matrix;
    let breakdown = [];
    let grossTotal = 0;
    const waiverDec = (student.fee_waiver_percentage || 0) / 100;

    if (matrix?.recurrent?.length) {
      matrix.recurrent.forEach(r => {
        breakdown.push({ item: r.item, amount: Number(r.amount) });
        grossTotal += Number(r.amount);
      });
    } else if (structure?.amount) {
      breakdown.push({ item: 'Monthly Tuition Fee', amount: Number(structure.amount) });
      grossTotal = Number(structure.amount);
    }

    const recurringGross = matrix?.recurrent?.length
      ? matrix.recurrent.reduce((s, r) => s + Number(r.amount), 0)
      : (structure?.amount ? Number(structure.amount) : 0);

    const discountAmount = Math.round(recurringGross * waiverDec);
    const netTotal = grossTotal - discountAmount;

    return {
      school_id: schoolId,
      student_id: student.id,
      month_year: targetMonth,
      total_amount: netTotal,
      discount_amount: discountAmount,
      paid_amount: 0,
      status: 'pending',
      due_date: dueDate,
      payment_mode: 'Pending',
      breakdown,
      invoice_number: `INV-2610-${student.id.slice(0, 6).toUpperCase()}`,
    };
  }).filter(i => i.total_amount > 0);

  console.log(`\nInserting ${inserts.length} invoices:`);
  inserts.forEach(i => {
    const s = students.find(st => st.id === i.student_id);
    console.log(`- ${s?.full_name.padEnd(25)} | Net Amount: Rs. ${i.total_amount} | Discount: Rs. ${i.discount_amount} | Breakdown:`, i.breakdown);
  });

  const { data: created, error: insErr } = await supabase
    .from('fee_records')
    .insert(inserts)
    .select('id, invoice_number, total_amount, student_id');

  if (insErr) {
    console.error('❌ Insert error:', insErr);
  } else {
    console.log(`\n✅ Successfully generated ${created?.length} monthly invoices for EF-1 (BEG)!`);
  }
}

generateEF1Invoices();
