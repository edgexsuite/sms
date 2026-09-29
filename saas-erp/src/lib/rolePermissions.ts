// ============================================================
// Shared Role Permissions — single source of truth
// Imported by StaffUserAccounts.tsx, PermissionManagerPage.tsx, and AuthContext.tsx
// ============================================================

export interface PermissionSet {
  modules: Record<string, boolean>;
  actions: Record<string, boolean>;
}

export interface ModuleDef {
  id: string;
  name: string;
  category: 'Core' | 'Academic' | 'Operations' | 'Finance' | 'Administration';
  desc: string;
}

export interface ActionDef {
  id: string;
  name: string;
  category: 'Academic' | 'Exams' | 'Students' | 'Finance' | 'Danger';
  desc: string;
}

// Human-readable labels for system role values
export const ROLE_LABELS: Record<string, string> = {
  director:             'Director',
  principal:            'Principal',
  vice_principal:       'Vice Principal',
  admin:                'Admin',
  teacher:              'Teacher',
  staff:                'Staff',
  accountant:           'Accountant',
  librarian:            'Librarian',
  campus_coordinator:   'Campus Coordinator',
  academic_coordinator: 'Academic Coordinator',
  section_coordinator:  'Section Coordinator',
};

// Canonical role order for display lists
export const ROLE_ORDER = [
  'admin', 'director', 'principal', 'vice_principal',
  'teacher', 'accountant', 'staff', 'librarian',
  'campus_coordinator', 'academic_coordinator', 'section_coordinator',
];

// Module definitions (canonical IDs — matched by canAccess() and DashboardLayout navigation)
export const MODULES: ModuleDef[] = [
  // Core
  { id: 'dashboard',     name: 'Dashboard & Overview',         category: 'Core',          desc: 'Main overview dashboard, key metrics, and AI assistant tools' },
  { id: 'students',      name: 'Students & Enrollment',        category: 'Core',          desc: 'Student directory, admissions, registration, ID cards, and certificates' },
  { id: 'staff',         name: 'Staff Management',             category: 'Core',          desc: 'Staff directory, teacher profiles, ID cards, and user credentials' },

  // Academic
  { id: 'academic',      name: 'Classes & Timetable',          category: 'Academic',      desc: 'Class management, subjects, weekly timetable, and substitutions' },
  { id: 'diary',         name: 'Teacher Diary & Planner',      category: 'Academic',      desc: 'Daily & weekly teacher diary entries, lesson plans, and homework tracking' },
  { id: 'exams',         name: 'Exams & Results',              category: 'Academic',      desc: 'Exam types, marks entry, consolidated sheets, report cards, and award lists' },

  // Operations
  { id: 'attendance',    name: 'Student & Staff Attendance',   category: 'Operations',    desc: 'Daily roll call, absent alerts, QR scanner kiosk, attendance reports' },
  { id: 'leave',         name: 'Leave Management',             category: 'Operations',    desc: 'Student and staff leave requests and approvals' },
  { id: 'communication', name: 'Communication & Front Desk',   category: 'Operations',    desc: 'Broadcast SMS, parent messaging, front desk, and gate pass visitor system' },
  { id: 'services',      name: 'Library & Transport',          category: 'Operations',    desc: 'Book cataloging, student issuance, bus routes, stops, and vehicles' },
  { id: 'inventory',     name: 'Inventory & Stationery',       category: 'Operations',    desc: 'Stock items, stationery issuance, and inventory levels' },

  // Finance
  { id: 'fees',          name: 'Fee Management & Invoicing',   category: 'Finance',       desc: 'Quick fee collection, challan generation, fee ledgers, and discounts' },
  { id: 'expenses',      name: 'Expenses & Day Book',          category: 'Finance',       desc: 'Daily expense entries, expense heads, day book, and budgets' },
  { id: 'payroll',       name: 'Staff Payroll & Salaries',     category: 'Finance',       desc: 'Monthly payroll processing, salary slips, advances, and staff ledger' },
  { id: 'accounting',    name: 'General Accounting & Ledgers', category: 'Finance',       desc: 'Double-entry journal, chart of accounts, trial balance, and balance sheet' },
  { id: 'reports',       name: 'Reports & Analytics Suite',    category: 'Finance',       desc: 'Collection reports, fee status, arrears lists, class matrix, master summary' },

  // Administration
  { id: 'settings',      name: 'System Settings & Config',     category: 'Administration', desc: 'School configuration, report card designer, permission manager, audit logs' },
];

// Action definitions — canonical IDs used by canDo() in AuthContext
export const ACTIONS: ActionDef[] = [
  // Academic & Diary
  { id: 'manage_class_diary',    name: 'Manage Class Diary',    category: 'Academic', desc: 'Create, edit, and view complete class diary entries for assigned classes' },
  { id: 'print_class_diary',     name: 'Print & Download Diary',category: 'Academic', desc: 'Export, print, and download PDF of daily and weekly class diaries' },
  { id: 'manage_diary_schedule', name: 'Manage Diary Schedule', category: 'Academic', desc: 'Configure per-class day-wise subject timetable & diary schedule' },

  // Exams & Results
  { id: 'manage_exams',          name: 'Configure Exams',       category: 'Exams',    desc: 'Create, edit, and configure exams, grading policy, and subject mark caps' },
  { id: 'enter_marks',           name: 'Enter Student Marks',   category: 'Exams',    desc: 'Input and edit student marks for assigned classes and subjects' },
  { id: 'publish_results',       name: 'Publish Results',       category: 'Exams',    desc: 'Lock marks and publish report cards to student & parent portals' },
  { id: 'view_award_list',       name: 'View Award Lists',      category: 'Exams',    desc: 'Generate printable award lists, mark summaries, and rank sheets' },

  // Students & Operations
  { id: 'approve_student_leave', name: 'Approve Student Leave', category: 'Students', desc: 'Approve or reject student leave applications for assigned classes' },
  { id: 'issue_certificates',    name: 'Issue Certificates',    category: 'Students', desc: 'Generate and issue leaving certificates and character certificates' },
  { id: 'manage_gate_pass',      name: 'Issue Gate Passes',     category: 'Students', desc: 'Create and authorize visitor and student gate passes' },

  // Finance & Fees
  { id: 'collect_fees',          name: 'Collect Fees',          category: 'Finance',  desc: 'Accept fee payments, enter transactions, and issue receipts' },
  { id: 'issue_fee_discounts',   name: 'Apply Concessions',     category: 'Finance',  desc: 'Grant student fee concessions, scholarships, and custom discounts' },
  { id: 'manage_fee_challans',   name: 'Generate Challans',     category: 'Finance',  desc: 'Generate, reprint, or revise monthly student fee challans' },

  // Deletions & Danger
  { id: 'delete_student',        name: 'Delete Students',       category: 'Danger',   desc: 'Permanently remove or trash student enrollment records' },
  { id: 'delete_staff',          name: 'Delete Staff Accounts', category: 'Danger',   desc: 'Permanently remove staff members and revoke logins' },
  { id: 'delete_expense',        name: 'Delete Expenses',       category: 'Danger',   desc: 'Remove entered expense vouchers and financial ledger lines' },
  { id: 'delete_fee_invoice',    name: 'Cancel/Delete Challans',category: 'Danger',   desc: 'Void or delete posted fee invoices and collection records' },
];

// Helper to create full default maps
function makePreset(modulesOn: string[], actionsOn: string[]): PermissionSet {
  const modules: Record<string, boolean> = {};
  const actions: Record<string, boolean> = {};
  MODULES.forEach(m => { modules[m.id] = modulesOn.includes(m.id); });
  // Also preserve backward compatibility aliases
  modules['finance'] = modulesOn.includes('fees') || modulesOn.includes('expenses') || modulesOn.includes('finance');
  
  ACTIONS.forEach(a => { actions[a.id] = actionsOn.includes(a.id); });
  return { modules, actions };
}

const ALL_MODULE_IDS = MODULES.map(m => m.id);
const ALL_ACTION_IDS = ACTIONS.map(a => a.id);

// Default factory permission presets per role
export const ROLE_PRESETS: Record<string, PermissionSet> = {
  admin: makePreset(ALL_MODULE_IDS, ALL_ACTION_IDS),
  
  director: makePreset(ALL_MODULE_IDS, ALL_ACTION_IDS),
  
  principal: makePreset(
    ALL_MODULE_IDS.filter(m => m !== 'settings'),
    ALL_ACTION_IDS.filter(a => !['delete_staff', 'delete_expense', 'delete_fee_invoice'].includes(a))
  ),
  
  vice_principal: makePreset(
    ['dashboard', 'students', 'staff', 'academic', 'diary', 'exams', 'attendance', 'leave', 'communication', 'services', 'fees', 'reports'],
    ['manage_class_diary', 'print_class_diary', 'manage_diary_schedule', 'manage_exams', 'enter_marks', 'publish_results', 'view_award_list', 'approve_student_leave', 'issue_certificates', 'manage_gate_pass']
  ),
  
  teacher: makePreset(
    ['dashboard', 'students', 'academic', 'diary', 'exams', 'attendance', 'leave'],
    ['manage_class_diary', 'print_class_diary', 'enter_marks', 'view_award_list', 'approve_student_leave']
  ),
  
  staff: makePreset(
    ['dashboard', 'students', 'attendance', 'communication', 'services', 'inventory'],
    ['issue_certificates', 'manage_gate_pass']
  ),
  
  accountant: makePreset(
    ['dashboard', 'fees', 'expenses', 'payroll', 'accounting', 'reports'],
    ['collect_fees', 'issue_fee_discounts', 'manage_fee_challans', 'delete_expense', 'delete_fee_invoice']
  ),
  
  librarian: makePreset(
    ['dashboard', 'students', 'services'],
    []
  ),
  
  campus_coordinator: makePreset(
    ['dashboard', 'students', 'academic', 'diary', 'exams', 'attendance', 'leave', 'communication', 'services', 'inventory', 'reports'],
    ['manage_class_diary', 'print_class_diary', 'manage_diary_schedule', 'manage_exams', 'enter_marks', 'publish_results', 'view_award_list', 'approve_student_leave', 'issue_certificates', 'manage_gate_pass']
  ),
  
  academic_coordinator: makePreset(
    ['dashboard', 'students', 'academic', 'diary', 'exams', 'attendance', 'leave', 'reports'],
    ['manage_class_diary', 'print_class_diary', 'manage_diary_schedule', 'manage_exams', 'enter_marks', 'publish_results', 'view_award_list', 'approve_student_leave', 'issue_certificates']
  ),
  
  section_coordinator: makePreset(
    ['dashboard', 'students', 'academic', 'diary', 'exams', 'attendance', 'leave'],
    ['manage_class_diary', 'print_class_diary', 'enter_marks', 'view_award_list', 'approve_student_leave']
  ),
};

// Display metadata used in the permission UI (PermissionManagerPage)
export const ROLE_DISPLAY: Record<string, {
  label: string; color: string; bgLight: string; ring: string; desc: string;
}> = {
  admin:                { label: 'Admin',               color: 'text-indigo-700',  bgLight: 'bg-indigo-50',  ring: 'ring-indigo-300',  desc: 'Full administrative access to all modules, settings, and destructive actions.' },
  director:             { label: 'Director',            color: 'text-purple-700',  bgLight: 'bg-purple-50',  ring: 'ring-purple-300',  desc: 'Executive authority with full system control, analytics, and deletion powers.' },
  principal:            { label: 'Principal',           color: 'text-violet-700',  bgLight: 'bg-violet-50',  ring: 'ring-violet-300',  desc: 'Full operational leadership over academics, students, and finances. Settings disabled.' },
  vice_principal:       { label: 'Vice Principal',      color: 'text-indigo-700',  bgLight: 'bg-indigo-50',  ring: 'ring-indigo-300',  desc: 'Academic leadership, student discipline, teacher monitoring, and certificate authorization.' },
  teacher:              { label: 'Teacher',             color: 'text-blue-700',    bgLight: 'bg-blue-50',    ring: 'ring-blue-300',    desc: 'Classroom portal: class diary, lesson plans, student attendance, and mark entry.' },
  accountant:           { label: 'Accountant',          color: 'text-emerald-700', bgLight: 'bg-emerald-50', ring: 'ring-emerald-300', desc: 'Financial desk: fee collections, expenses, day book, payroll, and financial reports.' },
  staff:                { label: 'Staff / Office',      color: 'text-cyan-700',    bgLight: 'bg-cyan-50',    ring: 'ring-cyan-300',    desc: 'Front desk operations, student admissions, visitor gate passes, and inventory.' },
  librarian:            { label: 'Librarian',           color: 'text-amber-700',   bgLight: 'bg-amber-50',   ring: 'ring-amber-300',   desc: 'Library cataloging, book issuance, return tracking, and student directory lookup.' },
  campus_coordinator:   { label: 'Campus Coordinator',  color: 'text-teal-700',    bgLight: 'bg-teal-50',    ring: 'ring-teal-300',    desc: 'Campus-wide oversight of classes, teacher substitutions, attendance, and services.' },
  academic_coordinator: { label: 'Academic Coordinator',color: 'text-cyan-700',    bgLight: 'bg-cyan-50',    ring: 'ring-cyan-300',    desc: 'Curriculum oversight, timetable scheduling, exams, marks entry, and report cards.' },
  section_coordinator:  { label: 'Section Coordinator', color: 'text-sky-700',     bgLight: 'bg-sky-50',     ring: 'ring-sky-300',     desc: 'Section-level monitoring of diaries, roll call, and student academic progress.' },
};

// Coordinator roles constant (used in Dashboard routing guards)
export const COORDINATOR_ROLES = ['academic_coordinator', 'campus_coordinator', 'section_coordinator'] as const;

/**
 * Returns the effective default permissions for a role, factoring in school-specific
 * configured role templates from form_settings, falling back to static ROLE_PRESETS.
 */
export function getRoleDefaultPermissions(role: string, schoolTemplates?: Record<string, PermissionSet> | null): PermissionSet {
  const normRole = role.toLowerCase();
  const schoolDefault = schoolTemplates?.[normRole];
  const factoryPreset = ROLE_PRESETS[normRole] || ROLE_PRESETS.staff;
  
  if (!schoolDefault) return factoryPreset;

  return {
    modules: { ...factoryPreset.modules, ...(schoolDefault.modules || {}) },
    actions: { ...factoryPreset.actions, ...(schoolDefault.actions || {}) },
  };
}
