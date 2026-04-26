import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://sqqxbxffwwfxmcqgjvui.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNxcXhieGZmd3dmeG1jcWdqdnVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4NzIzNzksImV4cCI6MjA5MTQ0ODM3OX0.8bsScNKKLwuPMW7g97Fcjdoe_VnoVbsBkOW-R9_kREA');

async function run() {
  console.log("Fetching active students...");
  const { data: students, error } = await supabase.from('students').select('id, full_name, roll_number, class_id, school_id').eq('is_deleted', false);
  
  if (error) {
    console.error("Error fetching students:", error);
    return;
  }
  
  const map = new Map();
  const toDelete = [];
  
  for (const s of students) {
    const key = `${s.school_id}_${s.class_id}_${s.roll_number}_${s.full_name}`;
    if (map.has(key)) {
      toDelete.push(s.id);
    } else {
      map.set(key, true);
    }
  }
  
  console.log(`Found ${toDelete.length} duplicates to delete.`);
  
  if (toDelete.length > 0) {
    // Delete in batches
    for (let i = 0; i < toDelete.length; i += 100) {
      const batch = toDelete.slice(i, i + 100);
      const { error: delError } = await supabase.from('students').delete().in('id', batch);
      if (delError) {
        console.error("Error deleting:", delError);
      } else {
        console.log(`Deleted ${batch.length} duplicates`);
      }
    }
    console.log("Finished deleting duplicates.");
  }
}

run();
