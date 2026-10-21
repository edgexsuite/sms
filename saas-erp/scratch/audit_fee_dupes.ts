import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  "https://sqqxbxffwwfxmcqgjvui.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNxcXhieGZmd3dmeG1jcWdqdnVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4NzIzNzksImV4cCI6MjA5MTQ0ODM3OX0.8bsScNKKLwuPMW7g97Fcjdoe_VnoVbsBkOW-R9_kREA"
);

async function runAudit() {
  console.log("=== STARTING FEE RECORDS AUDIT ===");

  // 1. Schools
  const { data: schools } = await supabase.from('schools').select('id, name');
  console.log(`Found ${schools?.length || 0} school(s).`);

  for (const school of schools || []) {
    console.log(`\n--- School: ${school.name} (${school.id}) ---`);

    // Fetch all fee records (including soft-deleted to see differences)
    const { data: allRecords, error: recErr } = await supabase
      .from('fee_records')
      .select('id, student_id, month_year, total_amount, paid_amount, status, invoice_number, deleted_at, created_at')
      .eq('school_id', school.id);

    if (recErr) {
      console.error("Error fetching fee records:", recErr);
      continue;
    }

    const totalCount = allRecords?.length || 0;
    const activeRecords = (allRecords || []).filter(r => !r.deleted_at);
    const softDeleted = (allRecords || []).filter(r => !!r.deleted_at);

    console.log(`Total fee_records: ${totalCount}`);
    console.log(`Active (deleted_at IS NULL): ${activeRecords.length}`);
    console.log(`Soft-deleted (deleted_at IS NOT NULL): ${softDeleted.length}`);

    // Status breakdown of active records
    const statusCounts: Record<string, number> = {};
    activeRecords.forEach(r => {
      statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
    });
    console.log("Status distribution (active records):", statusCounts);

    // 2. Check for DUPLICATES: same student_id + month_year in active records
    const studentMonthMap: Record<string, any[]> = {};
    activeRecords.forEach(r => {
      const key = `${r.student_id}_${r.month_year?.slice(0, 7)}`;
      if (!studentMonthMap[key]) studentMonthMap[key] = [];
      studentMonthMap[key].push(r);
    });

    const duplicateGroups = Object.entries(studentMonthMap).filter(([_, recs]) => recs.length > 1);
    console.log(`\nDuplicate (student_id + month_year) active groups found: ${duplicateGroups.length}`);

    let totalDuplicateInvoices = 0;
    let pendingDuplicates = 0;

    duplicateGroups.slice(0, 10).forEach(([key, recs]) => {
      console.log(`\n  Group ${key} has ${recs.length} records:`);
      recs.forEach(r => {
        console.log(`    - ID: ${r.id}, Inv: ${r.invoice_number}, Status: ${r.status}, Total: ${r.total_amount}, Paid: ${r.paid_amount}, Created: ${r.created_at}`);
      });
    });

    duplicateGroups.forEach(([_, recs]) => {
      totalDuplicateInvoices += (recs.length - 1);
      const pendingInGroup = recs.filter(r => r.status === 'pending');
      if (pendingInGroup.length > 1) pendingDuplicates += (pendingInGroup.length - 1);
    });

    console.log(`\nTotal redundant duplicate invoice rows: ${totalDuplicateInvoices}`);
    console.log(`Redundant PENDING duplicates: ${pendingDuplicates}`);

    // 3. Invoices for soft-deleted or inactive students
    const studentIds = Array.from(new Set(activeRecords.map(r => r.student_id)));
    const { data: students } = await supabase
      .from('students')
      .select('id, full_name, status, is_deleted, class_id')
      .in('id', studentIds);

    const studentMap = new Map((students || []).map(s => [s.id, s]));

    let invoicesForDeletedStudents = 0;
    let invoicesForInactiveStudents = 0;
    let pendingForDeletedOrInactive = 0;

    activeRecords.forEach(r => {
      const stu = studentMap.get(r.student_id);
      if (!stu || stu.is_deleted) {
        invoicesForDeletedStudents++;
        if (r.status === 'pending') pendingForDeletedOrInactive++;
      } else if (stu.status !== 'active') {
        invoicesForInactiveStudents++;
        if (r.status === 'pending') pendingForDeletedOrInactive++;
      }
    });

    console.log(`\nActive invoices belonging to soft-deleted/missing students: ${invoicesForDeletedStudents}`);
    console.log(`Active invoices belonging to inactive/withdrawn students: ${invoicesForInactiveStudents}`);
    console.log(`Pending invoices on deleted/inactive students: ${pendingForDeletedOrInactive}`);

    // 4. Duplicate invoice numbers
    const invNumMap: Record<string, any[]> = {};
    activeRecords.forEach(r => {
      if (r.invoice_number) {
        if (!invNumMap[r.invoice_number]) invNumMap[r.invoice_number] = [];
        invNumMap[r.invoice_number].push(r);
      }
    });
    const duplicateInvNums = Object.entries(invNumMap).filter(([_, recs]) => recs.length > 1);
    console.log(`Duplicate invoice_number instances: ${duplicateInvNums.length}`);
    duplicateInvNums.slice(0, 5).forEach(([num, recs]) => {
      console.log(`  Invoice ${num} shared by ${recs.length} records (student IDs: ${recs.map(r => r.student_id).join(', ')})`);
    });
  }
}

runAudit().catch(console.error);
