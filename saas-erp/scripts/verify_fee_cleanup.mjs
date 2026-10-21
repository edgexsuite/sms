import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

let supabaseUrl = process.env.VITE_SUPABASE_URL;
let supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

try {
  const envText = fs.readFileSync('../superadmin/.env', 'utf8');
  const u = envText.match(/VITE_SUPABASE_URL=(.*)/)?.[1]?.trim().replace(/['"]/g, '');
  const k = envText.match(/VITE_SUPABASE_SERVICE_ROLE_KEY=(.*)/)?.[1]?.trim().replace(/['"]/g, '');
  if (u && k) {
    supabaseUrl = u;
    supabaseKey = k;
  }
} catch (e) {}

if (!supabaseKey) {
  const localEnv = fs.readFileSync('.env', 'utf8');
  supabaseUrl = localEnv.match(/VITE_SUPABASE_URL=(.*)/)?.[1]?.trim().replace(/['"]/g, '');
  supabaseKey = localEnv.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]?.trim().replace(/['"]/g, '');
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runVerification() {
  console.log('=== STARTING FEE SYSTEM VERIFICATION ===\n');

  // 1. Check Ghost Pending records on inactive / deleted students
  console.log('--- 1. Ghost Pending Records (Inactive/Deleted Students) ---');
  const { data: ghostPending, error: ghostErr } = await supabase
    .from('fee_records')
    .select(`
      id, invoice_number, status, total_amount, paid_amount, month_year, deleted_at,
      students!inner (id, full_name, status, is_deleted)
    `)
    .is('deleted_at', null)
    .in('status', ['pending', 'partial', 'overdue'])
    .or('status.neq.active,is_deleted.eq.true', { foreignTable: 'students' });

  if (ghostErr) {
    console.error('Error querying ghost pending:', ghostErr);
  } else {
    console.log(`Found ${ghostPending.length} active ghost pending records.`);
    if (ghostPending.length === 0) {
      console.log('✅ PASS: No active ghost pending records for inactive students.');
    } else {
      console.log('⚠️ Records still active:');
      ghostPending.forEach(r => console.log(`  - ${r.invoice_number}: ${r.students.full_name} (${r.students.status}) - ${r.month_year}`));
    }
  }

  // 2. Check Zero-Amount MIG records
  console.log('\n--- 2. Zero-Amount MIG Records ---');
  const { data: migRecords, error: migErr } = await supabase
    .from('fee_records')
    .select('id, invoice_number, total_amount, paid_amount, deleted_at')
    .is('deleted_at', null)
    .like('invoice_number', 'MIG-%')
    .eq('total_amount', 0)
    .eq('paid_amount', 0);

  if (migErr) {
    console.error('Error querying MIG records:', migErr);
  } else {
    console.log(`Found ${migRecords.length} active zero-amount MIG records.`);
    if (migRecords.length === 0) {
      console.log('✅ PASS: All zero-amount MIG records are soft-deleted or cleaned.');
    } else {
      console.log('⚠️ Remaining MIG records:', migRecords);
    }
  }

  // 3. Check Duplicate (student_id + month_year) Pairs where deleted_at IS NULL
  console.log('\n--- 3. Duplicate (student_id + month_year) Pairs ---');
  // Fetch all active fee records to find duplicates in JS
  let allRecords = [];
  let page = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('fee_records')
      .select('id, school_id, student_id, month_year, invoice_number, status, total_amount, paid_amount, payment_mode')
      .is('deleted_at', null)
      .range(page * pageSize, (page + 1) * pageSize - 1);
    if (error) {
      console.error('Error fetching records for duplicate check:', error);
      break;
    }
    allRecords.push(...(data || []));
    if (!data || data.length < pageSize) break;
    page++;
  }

  console.log(`Total active fee_records in database: ${allRecords.length}`);

  const counts = new Map();
  for (const r of allRecords) {
    const key = `${r.school_id}_${r.student_id}_${r.month_year}`;
    if (!counts.has(key)) counts.set(key, []);
    counts.get(key).push(r);
  }

  const duplicates = [];
  for (const [key, records] of counts.entries()) {
    if (records.length > 1) {
      duplicates.push({ key, records });
    }
  }

  if (duplicates.length === 0) {
    console.log('✅ PASS: Zero duplicate (student_id + month_year) pairs among active records!');
  } else {
    console.log(`⚠️ Found ${duplicates.length} duplicate groups:`);
    duplicates.forEach(d => {
      console.log(`  Key: ${d.key}`);
      d.records.forEach(r => console.log(`    - ID: ${r.id}, Inv: ${r.invoice_number}, Status: ${r.status}, Total: ${r.total_amount}, Paid: ${r.paid_amount}`));
    });
  }

  // 4. Check Payment Modes
  console.log('\n--- 4. Payment Modes Distribution ---');
  const modeCounts = {};
  for (const r of allRecords) {
    const mode = r.payment_mode || 'NULL';
    modeCounts[mode] = (modeCounts[mode] || 0) + 1;
  }
  console.log('Payment modes in active fee_records:');
  console.table(modeCounts);

  if (modeCounts['Bank']) {
    console.log(`⚠️ Found ${modeCounts['Bank']} records with non-standard payment_mode 'Bank'!`);
  } else {
    console.log("✅ PASS: No non-standard 'Bank' payment_mode values found!");
  }

  // 5. Test Unique Index Enforceability
  console.log('\n--- 5. Testing Unique Index Constraint ---');
  if (allRecords.length > 0) {
    const sample = allRecords[0];
    // Attempt inserting a duplicate record with the same student_id, month_year, school_id
    const testDup = {
      school_id: sample.school_id,
      student_id: sample.student_id,
      month_year: sample.month_year,
      total_amount: 100,
      paid_amount: 0,
      status: 'pending',
      invoice_number: 'TEST-DUP-' + Date.now()
    };

    const { data: insData, error: insErr } = await supabase.from('fee_records').insert(testDup).select();
    if (insErr) {
      console.log('✅ PASS: Duplicate insert was REJECTED by database constraint/index!');
      console.log('   Rejection message:', insErr.message);
    } else {
      console.log('⚠️ WARNING: Duplicate insert succeeded. Unique index might not be created or enforcing.');
      // Clean up test row
      if (insData && insData[0]) {
        await supabase.from('fee_records').delete().eq('id', insData[0].id);
      }
    }
  }

  // 6. Test Payment Mode Check Constraint
  console.log('\n--- 6. Testing Payment Mode Check Constraint ---');
  if (allRecords.length > 0) {
    const sample = allRecords[0];
    const testBadMode = {
      school_id: sample.school_id,
      student_id: sample.student_id,
      month_year: '2099-01-01',
      total_amount: 100,
      paid_amount: 0,
      status: 'pending',
      payment_mode: 'InvalidMode123',
      invoice_number: 'TEST-BADMODE-' + Date.now()
    };

    const { data: insData, error: insErr } = await supabase.from('fee_records').insert(testBadMode).select();
    if (insErr) {
      console.log('✅ PASS: Invalid payment_mode was REJECTED by check constraint!');
      console.log('   Rejection message:', insErr.message);
    } else {
      console.log('⚠️ WARNING: Invalid payment_mode was accepted. Check constraint might not be active.');
      if (insData && insData[0]) {
        await supabase.from('fee_records').delete().eq('id', insData[0].id);
      }
    }
  }

  // 7. Overall Summary Stats
  console.log('\n--- 7. Overall Fee Records Summary ---');
  const statusCounts = {};
  let totalBilled = 0;
  let totalPaid = 0;
  for (const r of allRecords) {
    statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
    totalBilled += Number(r.total_amount || 0);
    totalPaid += Number(r.paid_amount || 0);
  }
  console.log('Status Breakdown:');
  console.table(statusCounts);
  console.log(`Total Billed: Rs. ${totalBilled.toLocaleString()}`);
  console.log(`Total Paid:   Rs. ${totalPaid.toLocaleString()}`);
  console.log(`Total Unpaid: Rs. ${(totalBilled - totalPaid).toLocaleString()}`);

  console.log('\n=== VERIFICATION COMPLETE ===');
}

runVerification().catch(console.error);
