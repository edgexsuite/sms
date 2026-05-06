// ============================================================
// Shared Role Permissions — single source of truth
// Imported by StaffUserAccounts.tsx and PermissionManagerPage.tsx
// ============================================================

export interface PermissionSet {
  modules: Record<string, boolean>;
  actions: Record<string, boolean>;
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

// Module definitions (canonical IDs — must match DashboardLayout nav keys)
export const MODULES = [
  { id: 'dashboard', name: 'Dashboard'          },
  { id: 'students',  name: 'Students'            },
  { id: 'staff',     name: 'Staff & Payroll'     },
  { id: 'finance',   name: 'Fees & Expenses'     },
  { id: 'academic',  name: 'Exams & Results'     },
  { id: 'services',  name: 'Library & Transport' },
  { id: 'reports',   name: 'Reports'             },
  { id: 'settings',  name: 'System Settings'     },
];

// Action definitions — canonical IDs used by canDo() in AuthContext
// NOTE: stored under permissions.actions.{id} in the DB
export const ACTIONS = [
  { id: 'delete_student', name: 'Delete Students', desc: 'Move student records to trash'   },
  { id: 'delete_staff',   name: 'Delete Staff',    desc: 'Move staff records to trash'     },
  { id: 'delete_expense', name: 'Delete Expenses', desc: 'Remove financial transactions'   },
];

// Default permission presets per role
// Used when creating a new account or resetting permissions
export const ROLE_PRESETS: Record<string, PermissionSet> = {
  director: {
    modules: { dashboard: true,  students: true,  staff: true,  finance: true,  academic: true,  services: true,  reports: true,  settings: true  },
    actions: { delete_student: true,  delete_staff: true,  delete_expense: true  },
  },
  principal: {
    modules: { dashboard: true,  students: true,  staff: true,  finance: true,  academic: true,  services: true,  reports: true,  settings: false },
    actions: { delete_student: true,  delete_staff: false, delete_expense: false },
  },
  vice_principal: {
    modules: { dashboard: true,  students: true,  staff: true,  finance: true,  academic: true,  services: true,  reports: true,  settings: false },
    actions: { delete_student: false, delete_staff: false, delete_expense: false },
  },
  admin: {
    modules: { dashboard: true,  students: true,  staff: true,  finance: true,  academic: true,  services: true,  reports: true,  settings: true  },
    actions: { delete_student: true,  delete_staff: true,  delete_expense: true  },
  },
  teacher: {
    modules: { dashboard: true,  students: true,  staff: false, finance: false, academic: true,  services: false, reports: false, settings: false },
    actions: { delete_student: false, delete_staff: false, delete_expense: false },
  },
  staff: {
    modules: { dashboard: true,  students: true,  staff: false, finance: true,  academic: false, services: true,  reports: false, settings: false },
    actions: { delete_student: false, delete_staff: false, delete_expense: false },
  },
  accountant: {
    modules: { dashboard: true,  students: false, staff: false, finance: true,  academic: false, services: false, reports: true,  settings: false },
    actions: { delete_student: false, delete_staff: false, delete_expense: true  },
  },
  librarian: {
    modules: { dashboard: true,  students: true,  staff: false, finance: false, academic: false, services: true,  reports: false, settings: false },
    actions: { delete_student: false, delete_staff: false, delete_expense: false },
  },
  campus_coordinator: {
    modules: { dashboard: true,  students: true,  staff: false, finance: false, academic: true,  services: true,  reports: true,  settings: false },
    actions: { delete_student: false, delete_staff: false, delete_expense: false },
  },
  academic_coordinator: {
    modules: { dashboard: true,  students: true,  staff: false, finance: false, academic: true,  services: false, reports: true,  settings: false },
    actions: { delete_student: false, delete_staff: false, delete_expense: false },
  },
  section_coordinator: {
    modules: { dashboard: true,  students: true,  staff: false, finance: false, academic: true,  services: false, reports: false, settings: false },
    actions: { delete_student: false, delete_staff: false, delete_expense: false },
  },
};

// Display metadata used in the permission UI (PermissionManagerPage)
export const ROLE_DISPLAY: Record<string, {
  label: string; color: string; bgLight: string; ring: string; desc: string;
}> = {
  admin:                { label: 'Admin',               color: 'text-indigo-700',  bgLight: 'bg-indigo-50',  ring: 'ring-indigo-300',  desc: 'Full access to all modules and system settings.' },
  director:             { label: 'Director',            color: 'text-purple-700',  bgLight: 'bg-purple-50',  ring: 'ring-purple-300',  desc: 'All access including deletions. Same as admin.' },
  principal:            { label: 'Principal',           color: 'text-violet-700',  bgLight: 'bg-violet-50',  ring: 'ring-violet-300',  desc: 'Full view of all modules, no system settings or bulk deletes.' },
  vice_principal:       { label: 'Vice Principal',      color: 'text-indigo-700',  bgLight: 'bg-indigo-50',  ring: 'ring-indigo-300',  desc: 'Full academic and student oversight. Finance view. No system settings.' },
  teacher:              { label: 'Teacher',             color: 'text-blue-700',    bgLight: 'bg-blue-50',    ring: 'ring-blue-300',    desc: 'Dashboard, students view, academic entry. No finance or settings.' },
  accountant:           { label: 'Accountant',          color: 'text-emerald-700', bgLight: 'bg-emerald-50', ring: 'ring-emerald-300', desc: 'Finance and reports only. Can delete expenses.' },
  staff:                { label: 'Staff',               color: 'text-cyan-700',    bgLight: 'bg-cyan-50',    ring: 'ring-cyan-300',    desc: 'General access — students, finance, academic, services.' },
  librarian:            { label: 'Librarian',           color: 'text-amber-700',   bgLight: 'bg-amber-50',   ring: 'ring-amber-300',   desc: 'Dashboard, student lookup, and library/transport services.' },
  campus_coordinator:   { label: 'Campus Coordinator',  color: 'text-teal-700',    bgLight: 'bg-teal-50',    ring: 'ring-teal-300',    desc: 'Students, academic, services, and reports. No finance or settings.' },
  academic_coordinator: { label: 'Academic Coordinator',color: 'text-cyan-700',    bgLight: 'bg-cyan-50',    ring: 'ring-cyan-300',    desc: 'Students, exams & results, and academic reporting. No finance.' },
  section_coordinator:  { label: 'Section Coordinator', color: 'text-sky-700',     bgLight: 'bg-sky-50',     ring: 'ring-sky-300',     desc: 'Student view and academic entry for their assigned section only.' },
};

// Coordinator roles constant (used in Dashboard routing guards)
export const COORDINATOR_ROLES = ['academic_coordinator', 'campus_coordinator', 'section_coordinator'] as const;
