/**
 * Helper utilities for staff categorization and filtering
 */

export interface StaffBase {
  id: string;
  full_name: string;
  role?: string | null;
  department?: string | null;
  designation?: string | null;
  is_active?: boolean;
  is_deleted?: boolean;
}

const NON_TEACHING_ROLES = new Set([
  'accountant',
  'librarian',
]);

const NON_TEACHING_KEYWORDS = [
  'driver',
  'peon',
  'sweeper',
  'cleaner',
  'guard',
  'security',
  'clerk',
  'receptionist',
  'conductor',
  'cashier',
  'nanny',
  'aya',
  'maid',
  'cook',
  'gardener',
  'mali',
  'electrician',
  'plumber',
  'janitor',
];

/**
 * Determines whether a staff member is eligible as a teaching staff member
 * for Timetables, Class Teacher assignments, and Marks Entry.
 */
export function isTeachingStaff(staff: StaffBase): boolean {
  if (staff.is_deleted) return false;
  if (staff.is_active === false) return false;

  const role = (staff.role || '').toLowerCase().trim();
  if (NON_TEACHING_ROLES.has(role)) return false;

  const textToScan = `${staff.role || ''} ${staff.department || ''} ${staff.designation || ''}`.toLowerCase();
  for (const keyword of NON_TEACHING_KEYWORDS) {
    if (textToScan.includes(keyword)) {
      return false;
    }
  }

  return true;
}

/**
 * Filter an array of staff members to return only active teaching staff.
 */
export function filterTeachingStaff<T extends StaffBase>(staffList: T[]): T[] {
  return staffList.filter(isTeachingStaff);
}
