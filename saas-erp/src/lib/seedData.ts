import { supabase } from './supabase';

export async function seedDemoData(schoolId: string) {
  try {
    // 1. Create Classes
    const classesToInsert = [
      { school_id: schoolId, name: 'Grade 1', section: 'A' },
      { school_id: schoolId, name: 'Grade 2', section: 'B' },
      { school_id: schoolId, name: 'Grade 3', section: 'C' },
    ];

    const { data: classes, error: classError } = await supabase
      .from('classes')
      .insert(classesToInsert)
      .select();

    if (classError) throw classError;

    // 2. Create Staff
    const staffToInsert = [
      { school_id: schoolId, full_name: 'John Doe', role: 'teacher', whatsapp_number: '+923001234567', is_active: true },
      { school_id: schoolId, full_name: 'Jane Smith', role: 'teacher', whatsapp_number: '+923007654321', is_active: true },
    ];

    const { data: staff, error: staffError } = await supabase
      .from('staff')
      .insert(staffToInsert)
      .select();

    if (staffError) throw staffError;

    // 3. Create Parents
    const parentsToInsert = [
      { school_id: schoolId, full_name: 'Parent One', cnic: '12345-1234567-1', whatsapp_number: '+923001112223', address: 'Street 1, City' },
      { school_id: schoolId, full_name: 'Parent Two', cnic: '12345-1234567-2', whatsapp_number: '+923004445556', address: 'Street 2, City' },
    ];

    const { data: parents, error: parentError } = await supabase
      .from('parents')
      .insert(parentsToInsert)
      .select();

    if (parentError) throw parentError;

    // 4. Create Students
    const studentsToInsert = [
      { 
        school_id: schoolId, 
        full_name: 'Student One', 
        roll_number: 101, 
        class_id: classes[0].id, 
        parent_id: parents[0].id,
        admission_date: new Date().toISOString(),
        status: 'active'
      },
      { 
        school_id: schoolId, 
        full_name: 'Student Two', 
        roll_number: 102, 
        class_id: classes[0].id, 
        parent_id: parents[0].id,
        admission_date: new Date().toISOString(),
        status: 'active'
      },
      { 
        school_id: schoolId, 
        full_name: 'Student Three', 
        roll_number: 201, 
        class_id: classes[1].id, 
        parent_id: parents[1].id,
        admission_date: new Date().toISOString(),
        status: 'active'
      },
    ];

    const { error: studentError } = await supabase.from('students').insert(studentsToInsert);
    if (studentError) throw studentError;

    // 5. Create Fee Structures
    const feeStructuresToInsert = classes.map(cls => ({
      school_id: schoolId,
      class_id: cls.id,
      amount: 5000
    }));

    const { error: feeError } = await supabase.from('fee_structures').insert(feeStructuresToInsert);
    if (feeError) throw feeError;

    // 6. Create some Fee Records
    const { data: insertedStudents } = await supabase
      .from('students')
      .select('id')
      .eq('school_id', schoolId);

    if (insertedStudents) {
      const feeRecordsToInsert = insertedStudents.map(student => ({
        school_id: schoolId,
        student_id: student.id,
        month_year: '2026-03-01',
        total_amount: 5000,
        paid_amount: Math.random() > 0.5 ? 5000 : 0,
        status: Math.random() > 0.5 ? 'paid' : 'pending'
      }));

      const { error: feeRecError } = await supabase.from('fee_records').insert(feeRecordsToInsert);
      if (feeRecError) throw feeRecError;

      // 7. Create some Attendance Records
      const attendanceToInsert = insertedStudents.map(student => ({
        school_id: schoolId,
        student_id: student.id,
        date: new Date().toISOString().split('T')[0],
        status: 'present'
      }));

      const { error: attError } = await supabase.from('attendance').insert(attendanceToInsert);
      if (attError) throw attError;
    }

    return { success: true };
  } catch (error) {
    console.error('Seeding failed:', error);
    throw error;
  }
}
