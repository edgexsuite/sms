import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envText = fs.readFileSync('../superadmin/.env', 'utf8');
const url = envText.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = envText.match(/VITE_SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1].trim();
const supabase = createClient(url, key);

const DEMO_SCHOOL_ID = 'b5dd7269-9d48-4e05-a1f3-3929fbbb9c9b';
const DEMO_USER_ID = 'f97dcc3b-f0d3-499c-a953-4b76165598bb';
const SEED_TIMESTAMP = '2026-08-30T10:00:00.000Z';

async function seed() {
  console.log('🚀 Seeding Demo School Profile...');
  await supabase.from('schools').update({
    name: 'EdgeX Model School & College (Demo Campus)',
    address: 'Model Town Campus, Link Road, Lahore / Bahawalpur',
    contact_email: 'demo@edgexsuite.com',
    contact_phone: '0301-2616367',
    academic_session: '2026-2027',
    school_type: 'Private',
    city: 'Lahore',
    website: 'https://edgexsuite.com',
    status: 'active',
    subscription_plan: 'Enterprise (Demo Sandbox)',
  }).eq('id', DEMO_SCHOOL_ID);

  console.log('🔑 Updating Demo User Password...');
  await supabase.auth.admin.updateUserById(DEMO_USER_ID, { password: 'Demo@1234' });

  await supabase.from('user_roles').upsert({
    id: 'd6539b89-b2c7-48b5-9c49-5a68233fb26c',
    user_id: DEMO_USER_ID,
    school_id: DEMO_SCHOOL_ID,
    role: 'admin',
    email: 'demo@edgexsuite.com',
    is_active: true,
  });

  console.log('🧹 Clearing old demo data...');
  const cleanTables = [
    'exam_results', 'exam_types', 'attendance', 'staff_attendance',
    'fee_records', 'fee_structures', 'timetable_slots', 'period_template_rows',
    'period_templates', 'subjects', 'students', 'parents', 'staff', 'classes'
  ];
  for (const t of cleanTables) {
    await supabase.from(t).delete().eq('school_id', DEMO_SCHOOL_ID);
  }

  console.log('⏰ Creating Period Templates...');
  const { data: tpl } = await supabase.from('period_templates').insert({
    school_id: DEMO_SCHOOL_ID,
    name: 'Standard 8-Period Day',
    created_at: SEED_TIMESTAMP,
  }).select('id').single();

  const tplId = tpl?.id;
  if (tplId) {
    const periodRows = [
      { template_id: tplId, school_id: DEMO_SCHOOL_ID, period_number: 1, label: 'Assembly & Registration', start_time: '08:00', end_time: '08:20', is_break: false, sort_order: 1 },
      { template_id: tplId, school_id: DEMO_SCHOOL_ID, period_number: 2, label: 'Period 1', start_time: '08:20', end_time: '09:00', is_break: false, sort_order: 2 },
      { template_id: tplId, school_id: DEMO_SCHOOL_ID, period_number: 3, label: 'Period 2', start_time: '09:00', end_time: '09:40', is_break: false, sort_order: 3 },
      { template_id: tplId, school_id: DEMO_SCHOOL_ID, period_number: 4, label: 'Period 3', start_time: '09:40', end_time: '10:20', is_break: false, sort_order: 4 },
      { template_id: tplId, school_id: DEMO_SCHOOL_ID, period_number: 5, label: 'Recess / Lunch Break', start_time: '10:20', end_time: '10:50', is_break: true, sort_order: 5 },
      { template_id: tplId, school_id: DEMO_SCHOOL_ID, period_number: 6, label: 'Period 4', start_time: '10:50', end_time: '11:30', is_break: false, sort_order: 6 },
      { template_id: tplId, school_id: DEMO_SCHOOL_ID, period_number: 7, label: 'Period 5', start_time: '11:30', end_time: '12:10', is_break: false, sort_order: 7 },
      { template_id: tplId, school_id: DEMO_SCHOOL_ID, period_number: 8, label: 'Period 6', start_time: '12:10', end_time: '12:50', is_break: false, sort_order: 8 },
      { template_id: tplId, school_id: DEMO_SCHOOL_ID, period_number: 9, label: 'Period 7', start_time: '12:50', end_time: '13:30', is_break: false, sort_order: 9 },
    ];
    await supabase.from('period_template_rows').insert(periodRows);
  }

  console.log('👩‍🏫 Creating Staff Members...');
  const staffMembers = [
    { school_id: DEMO_SCHOOL_ID, full_name: 'Dr. Muhammad Tariq', role: 'principal', designation: 'Principal / Director', qualification: 'Ph.D. Education', email: 'principal@edgexdemo.com', whatsapp_number: '03001112233', salary: 150000, is_active: true, created_at: SEED_TIMESTAMP },
    { school_id: DEMO_SCHOOL_ID, full_name: 'Ms. Ayesha Rehman', role: 'academic_coordinator', designation: 'Head Coordinator', qualification: 'M.Phil English', email: 'coordinator@edgexdemo.com', whatsapp_number: '03002223344', salary: 85000, is_active: true, created_at: SEED_TIMESTAMP },
    { school_id: DEMO_SCHOOL_ID, full_name: 'Sir Salman Qureshi', role: 'teacher', designation: 'Senior Science Lead', qualification: 'M.Sc Physics', email: 'salman@edgexdemo.com', whatsapp_number: '03003334455', salary: 65000, is_active: true, created_at: SEED_TIMESTAMP },
    { school_id: DEMO_SCHOOL_ID, full_name: 'Sir Usman Ghani', role: 'teacher', designation: 'Senior Math Specialist', qualification: 'M.Sc Mathematics', email: 'usman@edgexdemo.com', whatsapp_number: '03004445566', salary: 65000, is_active: true, created_at: SEED_TIMESTAMP },
    { school_id: DEMO_SCHOOL_ID, full_name: 'Ms. Zainab Noor', role: 'teacher', designation: 'English Department Incharge', qualification: 'M.A. English Linguistics', email: 'zainab@edgexdemo.com', whatsapp_number: '03005556677', salary: 58000, is_active: true, created_at: SEED_TIMESTAMP },
    { school_id: DEMO_SCHOOL_ID, full_name: 'Qari Abdul Rehman', role: 'teacher', designation: 'Islamiat & Arabic Head', qualification: 'M.A. Islamic Studies', email: 'rehman@edgexdemo.com', whatsapp_number: '03006667788', salary: 52000, is_active: true, created_at: SEED_TIMESTAMP },
    { school_id: DEMO_SCHOOL_ID, full_name: 'Engr. Bilal Farooq', role: 'teacher', designation: 'Computer & AI Instructor', qualification: 'BS Computer Science', email: 'bilal@edgexdemo.com', whatsapp_number: '03007778899', salary: 60000, is_active: true, created_at: SEED_TIMESTAMP },
    { school_id: DEMO_SCHOOL_ID, full_name: 'Mr. Kamran Siddiqui', role: 'accountant', designation: 'Finance Officer', qualification: 'M.Com Finance', email: 'accounts@edgexdemo.com', whatsapp_number: '03008889900', salary: 70000, is_active: true, created_at: SEED_TIMESTAMP },
    { school_id: DEMO_SCHOOL_ID, full_name: 'Ms. Fatima Jameel', role: 'staff', designation: 'Front Desk Officer', qualification: 'B.A. Public Admin', email: 'frontdesk@edgexdemo.com', whatsapp_number: '03009990011', salary: 45000, is_active: true, created_at: SEED_TIMESTAMP },
  ];
  const { data: insertedStaff } = await supabase.from('staff').insert(staffMembers).select('id, full_name, role');
  const staffMap = {};
  insertedStaff?.forEach(s => staffMap[s.full_name] = s.id);

  console.log('🏫 Creating Classes...');
  const classDefs = [
    { name: 'Grade 1', section: 'A', teacher: 'Ms. Zainab Noor' },
    { name: 'Grade 2', section: 'A', teacher: 'Ms. Zainab Noor' },
    { name: 'Grade 3', section: 'A', teacher: 'Sir Salman Qureshi' },
    { name: 'Grade 4', section: 'A', teacher: 'Sir Usman Ghani' },
    { name: 'Grade 5', section: 'A', teacher: 'Sir Salman Qureshi' },
    { name: 'Grade 6', section: 'A', teacher: 'Sir Usman Ghani' },
    { name: 'Grade 7', section: 'A', teacher: 'Engr. Bilal Farooq' },
    { name: 'Grade 8', section: 'A', teacher: 'Sir Salman Qureshi' },
    { name: 'Grade 9', section: 'Science', teacher: 'Sir Usman Ghani' },
    { name: 'Grade 10', section: 'Science', teacher: 'Sir Salman Qureshi' },
  ];
  const classRows = classDefs.map(c => ({
    school_id: DEMO_SCHOOL_ID,
    name: c.name,
    section: c.section,
    class_teacher_id: staffMap[c.teacher] || null,
    period_template_id: tplId || null,
  }));
  const { data: insertedClasses } = await supabase.from('classes').insert(classRows).select('id, name, section');

  console.log('📚 Creating Subjects...');
  const subjectList = ['English', 'Mathematics', 'General Science', 'Urdu', 'Islamiat', 'Computer Science', 'Social Studies'];
  const subjectRows = [];
  for (const c of insertedClasses || []) {
    for (const s of subjectList) {
      subjectRows.push({
        school_id: DEMO_SCHOOL_ID,
        class_id: c.id,
        subject_name: s,
        subject_code: s.slice(0, 3).toUpperCase(),
        total_marks: 100,
        passing_marks: 40,
        created_at: SEED_TIMESTAMP,
      });
    }
  }
  const { data: insertedSubjects } = await supabase.from('subjects').insert(subjectRows).select('id, class_id, subject_name');

  console.log('📅 Creating Timetable Slots...');
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const timetableRows = [];
  for (const c of (insertedClasses || []).slice(0, 6)) {
    const classSubs = (insertedSubjects || []).filter(s => s.class_id === c.id);
    for (const day of days) {
      for (let p = 2; p <= 8; p++) {
        const sub = classSubs[(p + day.length) % classSubs.length];
        const teacherId = staffMap['Sir Usman Ghani'] || staffMap['Sir Salman Qureshi'] || Object.values(staffMap)[0];
        timetableRows.push({
          school_id: DEMO_SCHOOL_ID,
          class_id: c.id,
          subject_id: sub?.id,
          teacher_id: teacherId,
          day_of_week: day,
          period_number: p,
          start_time: '0' + (p + 6) + ':00',
          end_time: '0' + (p + 6) + ':40',
          created_at: SEED_TIMESTAMP,
        });
      }
    }
  }
  if (timetableRows.length > 0) await supabase.from('timetable_slots').insert(timetableRows);

  console.log('💳 Creating Fee Structures...');
  const feeStructureRows = (insertedClasses || []).map((c, idx) => ({
    school_id: DEMO_SCHOOL_ID,
    class_id: c.id,
    amount: 5000 + (idx * 500),
    fee_matrix: {
      recurrent: [
        { name: 'Tuition Fee', amount: 4000 + (idx * 400) },
        { name: 'Computer & Lab Fund', amount: 600 },
        { name: 'Exam & Utility Fund', amount: 400 + (idx * 100) },
      ],
      first_time: [
        { name: 'Admission Processing Fee', amount: 3000 },
        { name: 'Digital ID & Registration Card', amount: 500 },
      ]
    }
  }));
  await supabase.from('fee_structures').insert(feeStructureRows);

  console.log('👨‍👩‍👧 Creating Parents...');
  const parentDefs = [
    { full_name: 'Muhammad Farooq', father_name: 'Abdul Ghafoor', cnic: '31202-1234567-1', whatsapp_number: '03012616367', occupation: 'Civil Engineer', address: 'House #14, Street 5, Model Town' },
    { full_name: 'Chaudhry Nadeem Akhtar', father_name: 'Akhtar Ali', cnic: '31202-2345678-3', whatsapp_number: '03023456789', occupation: 'Businessman', address: 'Commercial Plaza, Cantt Area' },
    { full_name: 'Dr. Tariq Mehmood', father_name: 'Mehmood Ul Hassan', cnic: '31202-3456789-5', whatsapp_number: '03034567890', occupation: 'Doctor / Surgeon', address: 'Doctors Colony' },
    { full_name: 'Advocate Rashid Minhas', father_name: 'Minhas Khan', cnic: '31202-4567890-7', whatsapp_number: '03045678901', occupation: 'Lawyer / High Court', address: 'Judicial Colony' },
    { full_name: 'Malik Zulfiqar Ali', father_name: 'Malik Allah Ditta', cnic: '31202-5678901-9', whatsapp_number: '03056789012', occupation: 'Government Officer', address: 'Officers Mess Road' },
  ];
  const parentRows = parentDefs.map(p => ({
    school_id: DEMO_SCHOOL_ID,
    full_name: p.full_name,
    father_name: p.father_name,
    father_cnic: p.cnic,
    whatsapp_number: p.whatsapp_number,
    father_occupation: p.occupation,
    address: p.address,
    email: p.full_name.toLowerCase().replace(/[^a-z]/g, '') + '@gmail.com',
    created_at: SEED_TIMESTAMP,
  }));
  const { data: insertedParents } = await supabase.from('parents').insert(parentRows).select('id, full_name');
  const parentIds = (insertedParents || []).map(p => p.id);

  console.log('🎒 Creating Students...');
  const studentNames = [
    { name: 'Ali Raza Farooq', roll: '101', gender: 'male', blood: 'B+' },
    { name: 'Fatima Farooq', roll: '102', gender: 'female', blood: 'A+' },
    { name: 'Hamza Nadeem', roll: '103', gender: 'male', blood: 'O+' },
    { name: 'Ayesha Nadeem', roll: '104', gender: 'female', blood: 'AB+' },
    { name: 'Ahmed Tariq', roll: '105', gender: 'male', blood: 'B+' },
    { name: 'Maryam Tariq', roll: '106', gender: 'female', blood: 'O+' },
    { name: 'Zainab Rashid', roll: '107', gender: 'female', blood: 'A+' },
    { name: 'Bilal Rashid', roll: '108', gender: 'male', blood: 'B-' },
    { name: 'Usman Zulfiqar', roll: '109', gender: 'male', blood: 'O-' },
    { name: 'Hafsa Zulfiqar', roll: '110', gender: 'female', blood: 'A+' },
    { name: 'Abdullah Khan', roll: '111', gender: 'male', blood: 'B+' },
    { name: 'Khadija Bibi', roll: '112', gender: 'female', blood: 'AB-' },
    { name: 'Mustafa Ahmed', roll: '113', gender: 'male', blood: 'O+' },
    { name: 'Zoya Fatima', roll: '114', gender: 'female', blood: 'A+' },
    { name: 'Ibrahim Qasim', roll: '115', gender: 'male', blood: 'B+' },
  ];
  const studentRows = [];
  let sIdx = 0;
  for (const c of insertedClasses || []) {
    for (let i = 0; i < 3; i++) {
      const template = studentNames[sIdx % studentNames.length];
      const pId = parentIds[sIdx % parentIds.length];
      studentRows.push({
        school_id: DEMO_SCHOOL_ID,
        class_id: c.id,
        parent_id: pId,
        full_name: template.name + ' (' + c.name + ')',
        roll_number: String(100 + sIdx + 1),
        b_form_cnic: '31202-0000' + (sIdx + 1) + '-1',
        gender: template.gender,
        blood_group: template.blood,
        admission_date: '2026-04-01',
        status: 'active',
        created_at: SEED_TIMESTAMP,
      });
      sIdx++;
    }
  }
  const { data: insertedStudents } = await supabase.from('students').insert(studentRows).select('id, class_id, full_name');
  console.log('✅ Seeded ' + (insertedStudents?.length || 0) + ' Students.');

  console.log('💰 Creating 12-Month Fee Ledger...');
  const feeMonthsList = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11', '2026-12'];
  const feeRecords = [];
  for (const st of insertedStudents || []) {
    const tuition = 5500;
    feeMonthsList.forEach((m, mIdx) => {
      const isPaid = mIdx < 7;
      const isPartial = mIdx === 7;
      const status = isPaid ? 'paid' : isPartial ? 'partial' : 'unpaid';
      const paidAmount = isPaid ? tuition : isPartial ? 3000 : 0;
      feeRecords.push({
        school_id: DEMO_SCHOOL_ID,
        student_id: st.id,
        month_year: m,
        total_amount: tuition,
        paid_amount: paidAmount,
        status: status,
        due_date: m + '-10',
        paid_date: isPaid ? m + '-05' : null,
        created_at: SEED_TIMESTAMP,
      });
    });
  }
  for (let i = 0; i < feeRecords.length; i += 100) {
    await supabase.from('fee_records').insert(feeRecords.slice(i, i + 100));
  }

  console.log('📋 Creating Daily Attendance...');
  const attRecords = [];
  const sampleDates = ['2026-08-25', '2026-08-26', '2026-08-27', '2026-08-28', '2026-08-29'];
  for (const st of insertedStudents || []) {
    for (const d of sampleDates) {
      const isPresent = Math.random() > 0.1;
      attRecords.push({
        school_id: DEMO_SCHOOL_ID,
        student_id: st.id,
        date: d,
        status: isPresent ? 'present' : 'absent',
        arrival_time: isPresent ? '08:05' : null,
        created_at: SEED_TIMESTAMP,
      });
    }
  }
  for (let i = 0; i < attRecords.length; i += 100) {
    await supabase.from('attendance').insert(attRecords.slice(i, i + 100));
  }

  console.log('🏆 Creating Exam Results...');
  const { data: examType } = await supabase.from('exam_types').insert({
    school_id: DEMO_SCHOOL_ID,
    name: 'Mid-Term Examination 2026',
    session: '2026-2027',
    month_year: '2026-08',
    created_at: SEED_TIMESTAMP,
  }).select('id').single();

  if (examType?.id) {
    const examResults = [];
    for (const st of (insertedStudents || []).slice(0, 15)) {
      const classSubs = (insertedSubjects || []).filter(s => s.class_id === st.class_id);
      for (const sub of classSubs) {
        const marks = Math.floor(65 + Math.random() * 32);
        const grade = marks >= 90 ? 'A+' : marks >= 80 ? 'A' : marks >= 70 ? 'B' : 'C';
        examResults.push({
          school_id: DEMO_SCHOOL_ID,
          exam_type_id: examType.id,
          student_id: st.id,
          class_id: st.class_id,
          subject_id: sub.id,
          obtained_marks: marks,
          total_marks: 100,
          grade: grade,
          created_at: SEED_TIMESTAMP,
        });
      }
    }
    await supabase.from('exam_results').insert(examResults);
  }

  console.log('📄 Creating Gate Pass & Lesson Planner Configs...');
  const firstClassId = insertedClasses?.[0]?.id || '';
  const firstSubId = insertedSubjects?.[0]?.id || '';

  const plannerKey = firstClassId + '__' + firstSubId;
  const plannerConfig = {
    period_type: 'weekly',
    start_date: '2026-08-24',
    end_date: '2026-08-29',
    plans: {
      [plannerKey]: {
        class_name: 'Grade 1 (A)',
        subject_name: 'English',
        teacher_name: 'Ms. Zainab Noor',
        unit_chapter: 'Unit 3: The Little Red Hen & Phonics',
        learning_outcomes: 'Identify vowel blends, read sentences fluently, writing practice.',
        days: {
          '2026-08-24': { topic: 'Reading Comprehension (pg 24)', classwork: 'Sentence making on board', homework: 'Learn spellings of 5 words', quiz_test: 'Short Dictation' },
          '2026-08-25': { topic: 'Grammar: Nouns & Pronouns', classwork: 'Worksheet exercise 1', homework: 'Complete Exercise 2 in notebook', quiz_test: 'None' },
          '2026-08-26': { topic: 'Creative Writing: My Best Friend', classwork: 'Draft 4 lines on notebook', homework: 'Revise vocabulary list', quiz_test: 'None' },
          '2026-08-27': { topic: 'Phonics Activity: Sh/Ch sounds', classwork: 'Audio listening & repetition', homework: 'Find 5 words with "sh"', quiz_test: 'Oral Quiz' },
          '2026-08-28': { topic: 'Story Retelling & Drama', classwork: 'Group storytelling roleplay', homework: 'Read story with parents', quiz_test: 'None' },
          '2026-08-29': { topic: 'Weekly Assessment & Review', classwork: 'Solve 10 MCQ worksheet', homework: 'Enjoy weekend reading', quiz_test: 'Friday Class Quiz' },
        }
      }
    }
  };

  await supabase.from('form_settings').upsert({
    school_id: DEMO_SCHOOL_ID,
    form_name: 'planner_cls_' + firstClassId + '_weekly_2026-08-24_2026-08-29',
    sections_config: plannerConfig,
    created_at: SEED_TIMESTAMP,
  });

  const gatePassConfig = {
    passes: [
      {
        id: 'gp-demo-1',
        pass_number: 'GP-2026-089',
        type: 'student_exit',
        student_name: 'Ali Raza Farooq',
        roll_number: '101',
        class_name: 'Grade 7 (A)',
        collector_name: 'Muhammad Farooq',
        collector_relation: 'Father',
        collector_cnic: '31202-1234567-1',
        collector_phone: '03012616367',
        reason: 'Doctor / Hospital Appointment',
        authorized_by: 'Principal Office',
        exit_datetime: '2026-08-29T11:30',
        status: 'departed',
        created_at: SEED_TIMESTAMP,
      }
    ]
  };

  await supabase.from('form_settings').upsert({
    school_id: DEMO_SCHOOL_ID,
    form_name: 'gate_pass_register',
    sections_config: gatePassConfig,
    created_at: SEED_TIMESTAMP,
  });

  console.log('🎉 DEMO SCHOOL SEEDING COMPLETED 100%!');
}

seed();
