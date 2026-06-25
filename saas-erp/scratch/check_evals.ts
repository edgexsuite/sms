
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  "https://sqqxbxffwwfxmcqgjvui.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNxcXhieGZmd3dmeG1jcWdqdnVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4NzIzNzksImV4cCI6MjA5MTQ0ODM3OX0.8bsScNKKLwuPMW7g97Fcjdoe_VnoVbsBkOW-R9_kREA"
);

async function checkEvaluations() {
  const { data, error } = await supabase
    .from('staff_evaluations')
    .select('*, staff!staff_evaluations_staff_id_fkey(full_name)')
    .eq('evaluation_month', '2026-05-01');

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Evaluations for May 2026:');
  console.table(data.map(e => ({
    Teacher: e.staff?.full_name || 'Unknown',
    Month: e.evaluation_month,
    Score: e.total_score
  })));
}

checkEvaluations();
