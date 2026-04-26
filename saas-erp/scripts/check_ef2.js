import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://sqqxbxffwwfxmcqgjvui.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNxcXhieGZmd3dmeG1jcWdqdnVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4NzIzNzksImV4cCI6MjA5MTQ0ODM3OX0.8bsScNKKLwuPMW7g97Fcjdoe_VnoVbsBkOW-R9_kREA');

async function run() {
  console.log("Fetching classes...");
  const { data: classes } = await supabase.from('classes').select('*').ilike('name', '%EF-2%');
  
  if (!classes || classes.length === 0) {
    console.log("Could not find EF-2 class");
    return;
  }
  
  const classId = classes[0].id;
  console.log(`Found EF-2 class ID: ${classId}`);
  
  const { data: students, error } = await supabase.from('students').select('*').eq('class_id', classId).eq('is_deleted', false).order('full_name');
  
  if (error) {
    console.error("Error fetching students:", error);
    return;
  }
  
  console.log(`EF-2 has ${students.length} active students:`);
  for (const s of students) {
    console.log(`- ${s.full_name} | Roll: ${s.roll_number} | ID: ${s.id} | UniqueID: ${s.student_unique_id}`);
  }
}

run();
