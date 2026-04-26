import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://sqqxbxffwwfxmcqgjvui.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNxcXhieGZmd3dmeG1jcWdqdnVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4NzIzNzksImV4cCI6MjA5MTQ0ODM3OX0.8bsScNKKLwuPMW7g97Fcjdoe_VnoVbsBkOW-R9_kREA');

async function run() {
  const { data: classes } = await supabase.from('classes').select('*');
  const classMap = {};
  if (classes) {
    classes.forEach(c => classMap[c.id] = c.name + (c.section ? ` (${c.section})` : ''));
  }

  const { data: students, error } = await supabase.from('students').select('*').eq('is_deleted', false);
  
  if (error) {
    console.error("Error fetching students:", error);
    return;
  }
  
  const classGroups = {};
  for (const s of students) {
    const cName = classMap[s.class_id] || `Unknown Class ID: ${s.class_id}`;
    if (!classGroups[cName]) classGroups[cName] = [];
    classGroups[cName].push(s);
  }
  
  for (const [cName, list] of Object.entries(classGroups)) {
    console.log(`\n--- Class: ${cName} (${list.length} students) ---`);
    if (cName.toUpperCase().includes('EF')) {
      for (const s of list) {
        console.log(`- ${s.full_name} | Roll: ${s.roll_number} | UniqueID: ${s.student_unique_id}`);
      }
    }
  }
}

run();
