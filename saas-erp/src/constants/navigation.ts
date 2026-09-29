import {
  LayoutDashboard, Bot, GraduationCap, Users, UserPlus, FileText, Upload,
  ShieldCheck, CreditCard, Award, Settings as SettingsIcon, MessageSquare,
  Briefcase, Shield, BookOpen, Calendar, Star, CalendarCheck, Wifi,
  CalendarOff, ClipboardList, AlertTriangle, Wallet, TrendingUp, PiggyBank,
  Banknote, DollarSign, Scale, BarChart3, BarChart2, ClipboardCheck, UserX,
  LineChart, Library, Home, Bell, Key, Trash2, Box, Package, Clock, Palette,
  Receipt, Layers, BookMarked, Landmark, BarChart, LifeBuoy, Users2, Bus, MapPin, Truck,
  Radio, Inbox, Tag, History, Printer, Wand2, Trophy, CalendarDays, Table2, CheckCircle2
} from 'lucide-react';

export const ALL_ADMIN        = ['admin', 'principal', 'director', 'vice_principal'];
export const ALL_COORDINATORS = ['admin', 'principal', 'director', 'vice_principal', 'campus_coordinator', 'academic_coordinator'];
export const ALL_STAFF        = ['admin', 'principal', 'director', 'vice_principal', 'staff', 'campus_coordinator', 'academic_coordinator', 'section_coordinator'];
export const ALL_ACADEMIC     = ['admin', 'principal', 'director', 'vice_principal', 'teacher', 'staff', 'campus_coordinator', 'academic_coordinator', 'section_coordinator'];
export const ALL_FINANCE      = ['admin', 'staff', 'accountant', 'principal', 'director', 'vice_principal'];
export const ALL_REPORTS      = ['admin', 'staff', 'accountant', 'principal', 'director', 'vice_principal', 'campus_coordinator', 'academic_coordinator'];

export const NAV_SECTIONS = [

  // ──────────────────────────────────────────────────────────────────────────
  // 1. DASHBOARD & OVERVIEW
  // ──────────────────────────────────────────────────────────────────────────
  {
    title: 'Overview',
    id: 'dashboard',
    color: '#6366f1',
    roles: ['admin', 'teacher', 'staff', 'accountant', 'librarian', 'principal', 'director', 'vice_principal', 'campus_coordinator', 'academic_coordinator', 'section_coordinator'],
    items: [
      { name: 'Dashboard',             path: '/dashboard',             icon: LayoutDashboard, roles: ['admin', 'teacher', 'staff', 'librarian', 'principal', 'director', 'vice_principal', 'campus_coordinator', 'academic_coordinator', 'section_coordinator'] },
      { name: 'Accountant Portal',     path: '/accountant-dashboard',  icon: Scale,           roles: ['accountant'] },
      { name: 'AI Assistant',         path: '/ai-assistant',          icon: Bot,             roles: ['admin', 'director', 'principal', 'vice_principal'] },
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 2. STUDENTS & ADMISSIONS
  // ──────────────────────────────────────────────────────────────────────────
  {
    title: 'Students & Admissions',
    id: 'students',
    color: '#3b82f6',
    roles: ['admin', 'teacher', 'staff', 'principal', 'director'],
    items: [
      {
        name: 'Students',
        path: '/students',
        icon: GraduationCap,
        roles: ['admin', 'teacher', 'staff', 'principal', 'director'],
        subItems: [
          { name: 'Student Directory',     path: '/students',                    exact: true, icon: Users,        roles: ALL_ACADEMIC },
          { name: 'New Admission',         path: '/students/register',                        icon: UserPlus,     roles: ALL_STAFF    },
          { name: 'Admission Form',        path: '/students/admission-form',                  icon: FileText,     roles: ALL_STAFF    },
          { name: 'Promote Students',      path: '/students/promote',                         icon: ShieldCheck,  roles: ALL_ADMIN    },
          { name: 'Digital ID Cards',      path: '/students/id-cards',                        icon: CreditCard,   roles: ALL_STAFF    },
          { name: 'Leaving Certificate',   path: '/students/leaving-certificate',             icon: Award,        roles: ALL_STAFF    },
          { name: 'Character Certificate', path: '/students/character-certificate',           icon: Award,        roles: ALL_STAFF    },
          { name: 'Bulk Enrollment',       path: '/students/bulk-enrollment',                 icon: Upload,       roles: ALL_STAFF    },
          { name: 'Custom List Generator', path: '/students/custom-list',                     icon: ClipboardList,roles: ALL_STAFF    },
        ],
      },
      { name: 'Parents Directory', path: '/parents', icon: Users,    roles: ALL_STAFF  },
      { name: 'Family Groups',     path: '/family',  icon: Users2,   roles: ALL_STAFF  },
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 3. ACADEMICS & CURRICULUM
  // ──────────────────────────────────────────────────────────────────────────
  {
    title: 'Academics & Classes',
    id: 'academic',
    color: '#8b5cf6',
    roles: ALL_ACADEMIC,
    items: [
      {
        name: 'Classes & Subjects',
        path: '/classes',
        icon: BookOpen,
        roles: ALL_STAFF,
        subItems: [
          { name: 'Class & Section Setup', path: '/classes/manage',   exact: true, icon: BookOpen  },
          { name: 'Subject Management',    path: '/classes/subjects',              icon: FileText   },
          { name: 'Class Students',        path: '/classes/students',              icon: Users2     },
        ],
      },
      {
        name: 'Timetable & Routine',
        path: '/timetable',
        icon: Calendar,
        roles: ALL_ACADEMIC,
        subItems: [
          { name: 'Master Timetable',      path: '/timetable',        exact: true, icon: Calendar, roles: ALL_ACADEMIC },
          { name: 'Auto Generator',        path: '/auto-timetable',                icon: Wand2,    roles: ALL_ADMIN    },
          { name: 'Teacher Substitution',  path: '/timetable/substitution',        icon: Users,    roles: ALL_COORDINATORS },
        ],
      },
      { name: 'Teacher Diary', path: '/diary', icon: ClipboardList, roles: ALL_ACADEMIC },
      {
        name: 'Lesson Planner',
        path: '/planner',
        icon: CalendarDays,
        roles: ALL_ACADEMIC,
        subItems: [
          { name: 'Lesson Planner',        path: '/planner',        exact: true, icon: CalendarDays, roles: ALL_ACADEMIC },
          { name: 'Coordinator Report',    path: '/planner/report',              icon: CheckCircle2, roles: ALL_COORDINATORS },
        ],
      },
      { name: 'Academic Evaluation', path: '/evaluation', icon: Star, roles: ALL_ACADEMIC },
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 4. ATTENDANCE & LEAVES
  // ──────────────────────────────────────────────────────────────────────────
  {
    title: 'Attendance & Leaves',
    id: 'attendance',
    color: '#14b8a6',
    roles: ALL_ACADEMIC,
    items: [
      {
        name: 'Student Attendance',
        path: '/attendance',
        icon: CalendarCheck,
        roles: ALL_ACADEMIC,
        subItems: [
          { name: 'Daily Roll Call',      path: '/attendance',               exact: true, icon: CalendarCheck, roles: ALL_ACADEMIC },
          { name: 'Absent Students List', path: '/attendance/absent-list',               icon: UserX,         roles: ALL_ACADEMIC },
          { name: 'Attendance Reports',   path: '/attendance/daily-report',              icon: FileText,      roles: ALL_ACADEMIC },
          { name: 'Monthly Summary',      path: '/attendance/monthly-report',            icon: BarChart3,     roles: ALL_ACADEMIC },
          { name: 'QR Attendance Kiosk',  path: '/attendance/scanner',                   icon: Wifi,          roles: ALL_STAFF    },
          { name: 'SMS Broadcast History',path: '/attendance/sms-history',               icon: Radio,         roles: ALL_STAFF    },
        ],
      },
      {
        name: 'Staff & Leaves',
        path: '/leave',
        icon: CalendarOff,
        roles: ALL_ACADEMIC,
        subItems: [
          { name: 'Staff Daily Attendance',path: '/attendance/staff-daily',              icon: Clock,         roles: [...ALL_ADMIN, 'campus_coordinator', 'academic_coordinator', 'section_coordinator'] },
          { name: 'Staff Attendance Sheet',path: '/attendance/staff-report',             icon: LineChart,     roles: [...ALL_ADMIN, 'campus_coordinator', 'academic_coordinator', 'section_coordinator'] },
          { name: 'Staff Leave Requests',  path: '/leave/staff',                         icon: Briefcase,     roles: ALL_ADMIN   },
          { name: 'Student Leave Requests',path: '/leave/student',                       icon: GraduationCap, roles: ALL_ACADEMIC },
        ],
      },
      { name: 'Complaints & Feedback', path: '/complaints', icon: AlertTriangle, roles: ['admin', 'teacher', 'staff', 'principal', 'director', 'vice_principal', 'campus_coordinator'] },
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 5. EXAMINATIONS & RESULTS
  // ──────────────────────────────────────────────────────────────────────────
  {
    title: 'Exams & Results',
    id: 'exams',
    color: '#f59e0b',
    roles: ALL_ACADEMIC,
    items: [
      {
        name: 'Exam Management',
        path: '/result',
        icon: FileText,
        roles: ALL_ACADEMIC,
        subItems: [
          { name: 'Exam Terms & Types',      path: '/result/exam-types',       icon: SettingsIcon,   roles: ALL_ADMIN   },
          { name: 'Result Status Dashboard', path: '/result/status',           icon: ClipboardCheck, roles: ALL_ACADEMIC },
          { name: 'Marks Entry (Admin)',     path: '/result/add-result',       icon: Star,           roles: ALL_ADMIN   },
          { name: 'Teacher Marks Entry',     path: '/result/teacher-marks',    icon: Star,           roles: ALL_ACADEMIC },
          { name: 'Import Marks (Excel)',    path: '/result/import',           icon: Upload,         roles: ALL_STAFF   },
          { name: 'Teacher-Wise Analysis',   path: '/result/teacher-wise',     icon: Users,          roles: ALL_ACADEMIC },
          { name: 'Consolidated Sheet',      path: '/result/consolidated',     icon: LayoutDashboard,roles: ALL_ACADEMIC },
          { name: 'Award List Generator',    path: '/result/award-list',       icon: Printer,        roles: ALL_ACADEMIC },
          { name: 'Student Report Cards',    path: '/result/reporting',        icon: LineChart,      roles: ALL_ACADEMIC },
          { name: 'Grading Rules Setup',     path: '/result/grading-policy',   icon: SettingsIcon,   roles: ALL_ADMIN   },
        ],
      },
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 6. FEES & BILLING (HIGH PRIORITY OPERATIONAL HUB)
  // ──────────────────────────────────────────────────────────────────────────
  {
    title: 'Fees & Billing',
    id: 'fees',
    color: '#10b981',
    roles: ALL_FINANCE,
    items: [
      {
        name: 'Fee Operations',
        path: '/fees',
        icon: CreditCard,
        roles: ALL_FINANCE,
        subItems: [
          { name: 'Generate Monthly Challans', path: '/fees/invoices',       exact: true, icon: Receipt      },
          { name: 'Quick Fee Collection',      path: '/fees/easy-fee',                    icon: Wallet       },
          { name: 'Student Fee Ledgers',       path: '/fees/student-detail',              icon: Users        },
          { name: 'Fee History Search',        path: '/fees/fee-history',                 icon: Clock        },
          { name: 'Advance Fee Deposits',      path: '/fees/advance-fee',                 icon: Banknote,    roles: ALL_ADMIN },
        ],
      },
      {
        name: 'Fee Setup & Rules',
        path: '/fees/settings',
        icon: Layers,
        roles: ALL_ADMIN,
        subItems: [
          { name: 'Fee Structures & Templates', path: '/fees/fee-templates',   icon: Layers       },
          { name: 'Discounts & Scholarships',   path: '/fees/discounts',       icon: Award        },
          { name: 'Late Fine Rules',            path: '/fees/fine-policy',     icon: AlertTriangle},
          { name: 'Challan Print Designer',     path: '/fees/challan-settings',icon: Palette      },
          { name: 'Bulk Arrears Entry',         path: '/fees/bulk-arrears',    icon: History      },
          { name: 'Bulk Discount Allocation',   path: '/fees/bulk-discount',   icon: Tag          },
          { name: 'Historical Fee Migration',   path: '/fees/bulk-fee-import', icon: Upload       },
        ],
      },
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 7. FINANCE & HR
  // ──────────────────────────────────────────────────────────────────────────
  {
    title: 'Finance & HR',
    id: 'finance',
    color: '#0ea5e9',
    roles: ALL_FINANCE,
    items: [
      {
        name: 'Expenses & Daybook',
        path: '/expenses',
        icon: Wallet,
        roles: ALL_FINANCE,
        subItems: [
          { name: 'Add Daily Expense',  path: '/expenses/add-daily', exact: true, icon: Wallet    },
          { name: 'General Day Book',   path: '/expenses/ledger',                 icon: LineChart },
          { name: 'Expense Heads',      path: '/expenses/heads',                  icon: SettingsIcon, roles: ALL_ADMIN },
          { name: 'Profit & Loss',      path: '/expenses/p-and-l',                icon: TrendingUp},
        ],
      },
      {
        name: 'Staff Payroll',
        path: '/payroll',
        icon: DollarSign,
        roles: ['admin', 'accountant', 'principal', 'director'],
        subItems: [
          { name: 'Process Payroll',   path: '/payroll',            exact: true, icon: DollarSign },
          { name: 'Salary Slips',      path: '/payroll/slips',                   icon: FileText   },
          { name: 'Staff Advances',    path: '/payroll/advance',                 icon: Wallet     },
          { name: 'Staff Ledger',      path: '/payroll/ledger',                  icon: History    },
        ],
      },
      {
        name: 'School Accounts',
        path: '/accounting',
        icon: Scale,
        roles: ['admin', 'accountant', 'principal', 'director'],
        subItems: [
          { name: 'Journal Entries',    path: '/accounting/journal',            icon: BookMarked },
          { name: 'Chart of Accounts',  path: '/accounting/chart-of-accounts',  icon: Landmark   },
          { name: 'Trial Balance',      path: '/accounting/trial-balance',      icon: Scale      },
          { name: 'Balance Sheet',      path: '/accounting/balance-sheet',      icon: BarChart2  },
        ],
      },
      {
        name: 'Staff Directory',
        path: '/staff',
        icon: Briefcase,
        roles: ALL_ADMIN,
        subItems: [
          { name: 'Staff Profiles',     path: '/staff',          exact: true,   icon: Users     },
          { name: 'Staff ID Cards',     path: '/staff/id-cards',                icon: CreditCard },
          { name: 'Teacher of Month',   path: '/staff/teacher-of-the-month',    icon: Trophy     },
          { name: 'Portal Credentials', path: '/staff/accounts',                icon: Shield     },
        ],
      },
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 8. REPORTS & ANALYTICS
  // ──────────────────────────────────────────────────────────────────────────
  {
    title: 'Reports & Intelligence',
    id: 'reports',
    color: '#06b6d4',
    roles: ALL_REPORTS,
    items: [
      { name: 'Master Summary',        path: '/reports/master-summary',       icon: BarChart,       roles: ALL_REPORTS },
      { name: 'Fee Collection Audit',  path: '/reports/collection',           icon: CreditCard,     roles: ALL_REPORTS },
      { name: 'Fee Status Matrix',     path: '/reports/fee-status',           icon: ClipboardCheck, roles: ALL_REPORTS },
      { name: 'Arrears & Defaulters',  path: '/reports/arrears',              icon: AlertTriangle,  roles: ALL_REPORTS },
      { name: 'Class Fee Matrix',      path: '/reports/class-fee-matrix',     icon: Table2,         roles: ALL_REPORTS },
      { name: 'Invoice Audit Report',  path: '/fees/invoice-report',          icon: Receipt,        roles: ALL_FINANCE },
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 9. SERVICES & SYSTEM
  // ──────────────────────────────────────────────────────────────────────────
  {
    title: 'Services & System',
    id: 'services',
    color: '#64748b',
    roles: ['admin', 'staff', 'librarian', 'principal', 'director'],
    items: [
      { name: 'Front Desk & Visitors', path: '/frontdesk',           icon: Home,         roles: ALL_STAFF },
      { name: 'Gate Pass System',      path: '/frontdesk/gate-pass', icon: ShieldCheck,  roles: ALL_STAFF },
      { name: 'Library System',        path: '/library',             icon: Library,      roles: ['admin', 'staff', 'librarian'] },
      {
        name: 'Transport Service',
        path: '/transport',
        icon: Bus,
        roles: ALL_STAFF,
        subItems: [
          { name: 'Overview',           path: '/transport',          exact: true, icon: Bus,    roles: ALL_STAFF },
          { name: 'Routes & Stops',     path: '/transport/routes',               icon: MapPin, roles: ALL_STAFF },
          { name: 'Vehicles',           path: '/transport/vehicles',             icon: Truck,  roles: ALL_STAFF },
          { name: 'Student Allocation', path: '/transport/students',             icon: Users,  roles: ALL_STAFF },
        ],
      },
      { name: 'Inventory & Stock',     path: '/inventory',           icon: Package,      roles: ALL_STAFF },
      {
        name: 'System Settings',
        path: '/settings',
        icon: SettingsIcon,
        roles: ALL_ADMIN,
        subItems: [
          { name: 'General Settings',    path: '/settings',          exact: true, icon: SettingsIcon },
          { name: 'Role Permissions',    path: '/settings/permissions',           icon: Key          },
          { name: 'ID Card Designer',    path: '/settings/id-cards',              icon: Palette      },
          { name: 'Audit Logs',          path: '/audit-log',                      icon: History      },
          { name: 'Recycle Trashbin',    path: '/settings/trashbin',              icon: Trash2,      roles: ['admin'] },
        ],
      },
    ],
  },
];
