
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  "https://sqqxbxffwwfxmcqgjvui.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNxcXhieGZmd3dmeG1jcWdqdnVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4NzIzNzksImV4cCI6MjA5MTQ0ODM3OX0.8bsScNKKLwuPMW7g97Fcjdoe_VnoVbsBkOW-R9_kREA"
);

async function testDelete() {
  const teacherId = "c3b1121a-5ede-4355-a64b-1008f0d19a1b"; // Hanan Waqar's REAL ID
  const month = "2026-05-01";

  console.log(`Attempting to delete evaluation for Hanan Waqar (${teacherId}) for month ${month}...`);

  const { data, error, count } = await supabase
    .from('staff_evaluations')
    .delete({ count: 'exact' })
    .eq('staff_id', teacherId)
    .eq('evaluation_month', month);

  if (error) {
    console.error('Delete Error:', error);
  } else {
    console.log(`Deleted ${count} records.`);
  }

  // Verify
  const { data: verify } = await supabase
    .from('staff_evaluations')
    .select('*')
    .eq('evaluation_month', month);
  
  console.log('Remaining evaluations:', verify?.length);
}

testDelete();
