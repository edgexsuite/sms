const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '../.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function fixRollNumbers() {
  console.log('Fetching all students...');
  const { data: students, error } = await supabase
    .from('students')
    .select('id, class_id, admission_date, created_at, full_name, roll_number')
    .eq('is_deleted', false);

  if (error) {
    console.error('Error fetching students:', error);
    return;
  }

  // Group by class
  const classGroups = {};
  students.forEach(s => {
    if (!s.class_id) return;
    if (!classGroups[s.class_id]) classGroups[s.class_id] = [];
    classGroups[s.class_id].push(s);
  });

  console.log(`Found ${Object.keys(classGroups).length} classes with students.`);

  for (const classId in classGroups) {
    const classStudents = classGroups[classId];
    
    // Sort by admission_date then created_at
    classStudents.sort((a, b) => {
      const dateA = a.admission_date || a.created_at || '';
      const dateB = b.admission_date || b.created_at || '';
      return dateA.localeCompare(dateB);
    });

    console.log(`Processing Class ${classId} (${classStudents.length} students)...`);

    for (let i = 0; i < classStudents.length; i++) {
      const student = classStudents[i];
      const newRoll = i + 1;

      console.log(`  Updating ${student.full_name}: ${student.roll_number} -> ${newRoll}`);
      const { data, error: updateErr } = await supabase
        .from('students')
        .update({ roll_number: newRoll })
        .eq('id', student.id)
        .select();
      
      if (updateErr) {
        console.error(`    Error updating ${student.full_name}:`, updateErr.message);
      } else if (!data || data.length === 0) {
        console.warn(`    Warning: No data returned for ${student.full_name}. RLS might be blocking update.`);
      } else {
        console.log(`    Success: ${student.full_name} updated.`);
      }
    }
  }

  console.log('Roll number fix completed.');
}

fixRollNumbers();
