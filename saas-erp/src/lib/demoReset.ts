import { supabase } from './supabase';

export const DEMO_SCHOOL_ID = 'b5dd7269-9d48-4e05-a1f3-3929fbbb9c9b';
export const DEMO_SEED_TIMESTAMP = '2026-08-30T10:00:00.000Z';

/**
 * Automatically cleans up any records created during a demo session,
 * ensuring the demo environment remains in a pristine golden state for subsequent visitors.
 */
export async function cleanupDemoSchoolModifications(schoolId: string = DEMO_SCHOOL_ID) {
  if (schoolId !== DEMO_SCHOOL_ID) return;

  try {
    const tablesToClean = [
      'exam_results',
      'attendance',
      'staff_attendance',
      'fee_records',
      'timetable_slots',
      'subjects',
      'students',
      'parents',
      'staff',
      'classes',
    ];

    // 1. Delete all newly added records created after the baseline seed timestamp
    for (const tableName of tablesToClean) {
      await supabase
        .from(tableName)
        .delete()
        .eq('school_id', DEMO_SCHOOL_ID)
        .gt('created_at', DEMO_SEED_TIMESTAMP);
    }

    // 2. Un-delete any soft-deleted baseline students/staff
    await supabase
      .from('students')
      .update({ is_deleted: false, deleted_at: null })
      .eq('school_id', DEMO_SCHOOL_ID)
      .eq('is_deleted', true);

    await supabase
      .from('staff')
      .update({ is_deleted: false, deleted_at: null })
      .eq('school_id', DEMO_SCHOOL_ID)
      .eq('is_deleted', true);

    console.log('✨ Demo school session auto-cleanup completed successfully.');
  } catch (err) {
    console.error('Error during demo school auto-cleanup:', err);
  }
}
