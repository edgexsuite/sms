/**
 * Helper utilities for staff categorization, roles, and filtering
 */

export interface StaffBase {
  id?: string;
  full_name?: string;
  role?: string | null;
  department?: string | null;
  designation?: string | null;
  is_active?: boolean;
  is_deleted?: boolean;
}

export type StaffCategory = 'teaching' | 'non_teaching' | 'admin';

export const STAFF_CATEGORIES: { id: StaffCategory; label: string; description: string; color: string; badgeClass: string }[] = [
  { id: 'teaching', label: 'Teaching', description: 'Teachers, Faculty, Subject Specialists', color: '#4f46e5', badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  { id: 'non_teaching', label: 'Non-Teaching', description: 'Security, Support, Drivers, Janitors, Librarians', color: '#d97706', badgeClass: 'bg-amber-50 text-amber-700 border-amber-200' },
  { id: 'admin', label: 'Admin', description: 'Principal, Vice Principal, Admin, Accountant, Coordinator', color: '#7c3aed', badgeClass: 'bg-purple-50 text-purple-700 border-purple-200' },
];

/**
 * Standard grouped roles for Institutional Staff Registration and Management
 */
export const ROLE_GROUPS: { category: StaffCategory; label: string; roles: string[] }[] = [
  {
    category: 'teaching',
    label: 'Teaching Faculty',
    roles: [
      'Teacher',
      'Subject Specialist',
      'Senior Teacher',
      'Junior Teacher',
      'Assistant Teacher',
      'Instructor',
      'Lecturer',
      'Physical Education (PET)',
      'Quran / Islamic Teacher',
      'Art Teacher',
      'Music Teacher',
    ]
  },
  {
    category: 'admin',
    label: 'Administration & Leadership',
    roles: [
      'Principal',
      'Vice Principal',
      'Coordinator',
      'Academic Coordinator',
      'Section Coordinator',
      'Campus Coordinator',
      'Admin',
      'Accountant',
      'Finance Officer',
      'Director',
      'Manager',
      'Office Superintendent',
    ]
  },
  {
    category: 'non_teaching',
    label: 'Support & Operational Staff',
    roles: [
      'Support Staff',
      'Gardener / Mali',
      'Gardener',
      'Peon / Office Boy',
      'Peon',
      'Sweeper / Cleaner',
      'Sweeper',
      'Cleaner',
      'Janitor',
      'Security Guard',
      'Driver',
      'Conductor / Bus Helper',
      'Aya / Nanny / Maid',
      'Cook / Kitchen Staff',
      'Electrician',
      'Plumber',
      'Carpenter / Maintenance',
      'Librarian',
      'Clerk / Office Assistant',
      'Receptionist',
      'Lab Assistant / Attendant',
      'Other',
    ]
  }
];

export const STANDARD_ROLES: string[] = ROLE_GROUPS.flatMap(g => g.roles);

const ADMIN_KEYWORDS = [
  'principal',
  'vice principal',
  'coordinator',
  'admin',
  'accountant',
  'director',
  'headmistress',
  'headmaster',
  'manager',
  'finance',
  'bursar',
  'superintendent',
];

const NON_TEACHING_KEYWORDS = [
  // Support & Manual Roles
  'support',
  'gardener',
  'gardner',
  'mali',
  'peon',
  'office boy',
  'naib qasid',
  'qasid',
  'runner',
  'sweeper',
  'cleaner',
  'janitor',
  'khakrob',
  'sanitary',
  'housekeeping',
  'maid',
  'aya',
  'ayah',
  'nanny',
  'caretaker',
  'cook',
  'chef',
  'kitchen',
  'canteen',
  'mess',
  'electrician',
  'plumber',
  'carpenter',
  'painter',
  'mason',
  'technician',
  'maintenance',
  'repair',
  'handyman',
  'helper',
  'attendant',

  // Security
  'guard',
  'security',
  'chowkidar',
  'chokidar',
  'gatekeeper',
  'darban',

  // Transport
  'driver',
  'conductor',
  'bus helper',
  'transport',

  // Office support & Library & Labs
  'librarian',
  'library',
  'clerk',
  'ldc',
  'udc',
  'office assistant',
  'data entry',
  'deo',
  'receptionist',
  'front desk',
  'telephone operator',
  'lab assistant',
  'lab attendant',
  'laboratory',
  'cashier',
];

/**
 * Categorizes a staff member into:
 * - 'admin': Principal, VP, Coordinator, Admin, Accountant, management
 * - 'non_teaching': Support, Security, Drivers, Librarians, Peon, Gardener, etc.
 * - 'teaching': Teachers, Instructors, Faculty
 */
export function getStaffCategory(staff: StaffBase): StaffCategory {
  const role = (staff.role || '').toLowerCase().trim();
  const dept = (staff.department || '').toLowerCase().trim();
  const desig = (staff.designation || '').toLowerCase().trim();
  const textToScan = `${role} ${dept} ${desig}`.toLowerCase();

  // 1. Admin roles & departments
  if (
    ADMIN_KEYWORDS.some(k => role.includes(k) || desig.includes(k)) ||
    dept.includes('administration') || dept.includes('accounts') || dept.includes('finance')
  ) {
    return 'admin';
  }

  // 2. Non-teaching roles, keywords & support departments
  if (
    NON_TEACHING_KEYWORDS.some(k => textToScan.includes(k)) ||
    dept.includes('security') || dept.includes('transport') || dept.includes('library') ||
    dept.includes('maintenance') || dept.includes('support') || dept.includes('sanitation') ||
    dept.includes('kitchen') || dept.includes('housekeeping')
  ) {
    return 'non_teaching';
  }

  // 3. If role is 'other' or empty, check if academic
  if (role === 'other' || role === '') {
    if (textToScan.includes('teach') || textToScan.includes('faculty') || dept.includes('academic')) {
      return 'teaching';
    }
    return 'non_teaching';
  }

  // 4. Default to teaching staff (Teachers, Instructors, Faculty, Subject Specialists)
  return 'teaching';
}

/**
 * Determines whether a staff member is eligible as a teaching staff member
 * for Timetables, Class Teacher assignments, and Marks Entry.
 */
export function isTeachingStaff(staff: StaffBase): boolean {
  if (staff.is_deleted) return false;
  if (staff.is_active === false) return false;
  return getStaffCategory(staff) === 'teaching';
}

/**
 * Filter an array of staff members to return only active teaching staff.
 */
export function filterTeachingStaff<T extends StaffBase>(staffList: T[]): T[] {
  return staffList.filter(isTeachingStaff);
}
