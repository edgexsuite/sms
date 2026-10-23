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

export type StaffCategory = 'teaching' | 'non_teaching' | 'admin';

export const STAFF_CATEGORIES: { id: StaffCategory; label: string; description: string; color: string; badgeClass: string }[] = [
  { id: 'teaching', label: 'Teaching', description: 'Teachers, Faculty, Subject Specialists', color: '#4f46e5', badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  { id: 'non_teaching', label: 'Non-Teaching', description: 'Security, Support, Drivers, Janitors, Librarians', color: '#d97706', badgeClass: 'bg-amber-50 text-amber-700 border-amber-200' },
  { id: 'admin', label: 'Admin', description: 'Principal, Vice Principal, Admin, Accountant, Coordinator', color: '#7c3aed', badgeClass: 'bg-purple-50 text-purple-700 border-purple-200' },
];

/**
 * Categorizes a staff member into:
 * - 'admin': Principal, VP, Coordinator, Admin, Accountant, management
 * - 'non_teaching': Support, Security, Drivers, Librarians, Peon, etc.
 * - 'teaching': Teachers, Instructors, Faculty
 */
export function getStaffCategory(staff: StaffBase): StaffCategory {
  const role = (staff.role || '').toLowerCase().trim();
  const dept = (staff.department || '').toLowerCase().trim();
  const desig = (staff.designation || '').toLowerCase().trim();

  // 1. Admin roles
  const adminKeywords = ['principal', 'vice principal', 'coordinator', 'admin', 'accountant', 'director', 'headmistress', 'headmaster', 'manager', 'finance'];
  if (
    adminKeywords.some(k => role.includes(k) || desig.includes(k)) ||
    dept.includes('administration') || dept.includes('accounts')
  ) {
    return 'admin';
  }

  // 2. Non-teaching roles
  if (NON_TEACHING_ROLES.has(role)) return 'non_teaching';
  const textToScan = `${role} ${dept} ${desig}`.toLowerCase();
  for (const keyword of NON_TEACHING_KEYWORDS) {
    if (textToScan.includes(keyword)) {
      return 'non_teaching';
    }
  }

  // 3. Teaching staff
  return 'teaching';
}

