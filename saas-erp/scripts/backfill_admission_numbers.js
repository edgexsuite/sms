/**
 * backfill_admission_numbers.js
 *
 * Backfills all existing active students with the new standardized
 * Admission / Registration Number format: {YYYY}-{CLASS_CODE}-{SEQUENCE}
 *
 * - Backs up the old student_unique_id to custom_data.previous_student_unique_id
 * - Orders by admission_date, created_at, roll_number
 * - Supports dry-run mode: node scripts/backfill_admission_numbers.js --dry-run
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

function formatClassCode(className) {
  if (!className || typeof className !== 'string') return 'GEN';

  const raw = className.trim().toUpperCase();

  const efMatch = raw.match(/E(?:ARLY\s*FOUNDATION|F)[\s\-_]*(\d+)/i);
  if (efMatch) return `EF${efMatch[1]}`;

  if (/^P(?:LAY[\s\-_]*GROUP|G)$/i.test(raw)) return 'PG';
  if (/^NUR(?:SERY)?$/i.test(raw)) return 'NUR';
  if (/^PREP(?:ARATORY)?$/i.test(raw)) return 'PREP';
  if (/^K(?:INDERGARTEN|G)[\s\-_]*(\d*)$/i.test(raw)) {
    const kgNum = raw.match(/\d+/);
    return kgNum ? `KG${kgNum[0]}` : 'KG';
  }

  const gradeMatch = raw.match(/(?:GRADE|CLASS|LEVEL)[\s\-_]*(\d+)/i);
  if (gradeMatch) {
    const num = parseInt(gradeMatch[1], 10);
    return `G${String(num).padStart(2, '0')}`;
  }

  const ordinalMatch = raw.match(/^(\d+)(?:ST|ND|RD|TH)?$/i);
  if (ordinalMatch) {
    const num = parseInt(ordinalMatch[1], 10);
    return `G${String(num).padStart(2, '0')}`;
  }

  const clean = raw.replace(/[^A-Z0-9]/g, '');
  if (!clean) return 'GEN';

  const trailingNumMatch = clean.match(/^([A-Z]+)(\d)$/);
  if (trailingNumMatch) {
    return `${trailingNumMatch[1]}0${trailingNumMatch[2]}`;
  }

  return clean.substring(0, 5);
}

async function runBackfill() {
  const isDryRun = process.argv.includes('--dry-run');
  console.log(`\n🚀 Starting Student Admission Number Backfill [${isDryRun ? 'DRY RUN' : 'LIVE UPDATE'}]...\n`);

  // 1. Fetch all schools
  const { data: schools, error: schoolErr } = await supabase.from('schools').select('id, name');
  if (schoolErr) {
    console.error('Error fetching schools:', schoolErr);
    return;
  }

  for (const school of schools) {
    console.log(`\n🏫 Processing School: "${school.name}" (${school.id})`);

    // 2. Fetch classes for this school
    const { data: classes } = await supabase
      .from('classes')
      .select('id, name, section')
      .eq('school_id', school.id);

    const classMap = new Map();
    (classes || []).forEach(c => classMap.set(c.id, c.name));

    // 3. Fetch all active students
    const { data: students, error: stuErr } = await supabase
      .from('students')
      .select('id, full_name, admission_date, created_at, class_id, roll_number, student_unique_id, custom_data')
      .eq('school_id', school.id)
      .eq('is_deleted', false)
      .order('admission_date', { ascending: true })
      .order('created_at', { ascending: true })
      .order('roll_number', { ascending: true });

    if (stuErr) {
      console.error(`  ❌ Error fetching students for school ${school.id}:`, stuErr);
      continue;
    }

    if (!students || students.length === 0) {
      console.log('  ℹ️ No active students found.');
      continue;
    }

    console.log(`  📊 Found ${students.length} active students.`);

    // 4. Group by enrollment year
    const yearGroups = {};
    students.forEach(s => {
      const year = s.admission_date
        ? new Date(s.admission_date).getFullYear()
        : s.created_at
        ? new Date(s.created_at).getFullYear()
        : new Date().getFullYear();

      if (!yearGroups[year]) yearGroups[year] = [];
      yearGroups[year].push(s);
    });

    // 5. Assign sequential admission numbers per year
    let updatedCount = 0;
    for (const [year, studentList] of Object.entries(yearGroups)) {
      console.log(`    📅 Year ${year}: ${studentList.length} students`);
      let sequence = 1;

      for (const student of studentList) {
        const className = classMap.get(student.class_id) || 'General';
        const classCode = formatClassCode(className);
        const newAdmissionNo = `${year}-${classCode}-${String(sequence).padStart(4, '0')}`;
        sequence++;

        const previousId = student.student_unique_id;
        const currentCustomData = student.custom_data || {};
        const updatedCustomData = {
          ...currentCustomData,
          previous_student_unique_id: previousId,
          admission_number_backfilled_at: new Date().toISOString(),
        };

        if (isDryRun) {
          console.log(`      [DRY-RUN] ${student.full_name.padEnd(25)} | Old: ${String(previousId).padEnd(12)} -> New: ${newAdmissionNo}`);
        } else {
          const { error: updErr } = await supabase
            .from('students')
            .update({
              student_unique_id: newAdmissionNo,
              custom_data: updatedCustomData,
            })
            .eq('id', student.id);

          if (updErr) {
            console.error(`      ❌ Error updating ${student.full_name}:`, updErr.message);
          } else {
            updatedCount++;
            if (updatedCount <= 5 || updatedCount % 25 === 0 || updatedCount === studentList.length) {
              console.log(`      ✅ ${student.full_name.padEnd(25)} | ${String(previousId).padEnd(12)} -> ${newAdmissionNo}`);
            }
          }
        }
      }
    }

    if (!isDryRun) {
      console.log(`  ✨ Successfully updated ${updatedCount} students in "${school.name}".`);
    }
  }

  console.log(`\n🎉 Backfill process complete!\n`);
}

runBackfill();
