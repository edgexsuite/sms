import {
  LayoutDashboard, Bot, GraduationCap, Users, UserPlus, FileText, Upload,
  ShieldCheck, CreditCard, Award, Settings as SettingsIcon, MessageSquare,
  Briefcase, Shield, BookOpen, Calendar, Star, CalendarCheck, Wifi,
  CalendarOff, ClipboardList, AlertTriangle, Wallet, TrendingUp, PiggyBank,
  Banknote, DollarSign, Scale, BarChart3, BarChart2, ClipboardCheck, UserX,
  LineChart, Library, Home, Bell, Key, Trash2, Box, Package, Clock, Palette,
  Receipt, Layers, BookMarked, Landmark, BarChart, LifeBuoy, Users2, Bus, MapPin, Truck,
  Radio, Inbox, Tag, History, Printer
} from 'lucide-react';

export const ALL_ADMIN    = ['admin', 'principal', 'director', 'vice_principal'];
export const ALL_STAFF    = ['admin', 'principal', 'director', 'vice_principal', 'staff', 'campus_coordinator', 'academic_coordinator', 'section_coordinator'];
export const ALL_ACADEMIC = ['admin', 'principal', 'director', 'vice_principal', 'teacher', 'staff', 'campus_coordinator', 'academic_coordinator', 'section_coordinator'];
export const ALL_FINANCE  = ['admin', 'staff', 'accountant', 'principal', 'director', 'vice_principal'];
export const ALL_REPORTS  = ['admin', 'staff', 'accountant', 'principal', 'director', 'vice_principal', 'campus_coordinator', 'academic_coordinator'];

export const NAV_SECTIONS = [

  // ──────────────────────────────────────────────────────────────────────────
  // 1. OVERVIEW
  // ──────────────────────────────────────────────────────────────────────────
  {
    title: 'Overview',
    id: 'dashboard',
    color: '#6366f1',
    roles: ['admin', 'teacher', 'staff', 'accountant', 'librarian', 'principal', 'director', 'vice_principal', 'campus_coordinator', 'academic_coordinator', 'section_coordinator'],
    items: [
      { name: 'Dashboard',             path: '/dashboard',             icon: LayoutDashboard, roles: ['admin', 'teacher', 'staff', 'librarian', 'principal', 'director', 'vice_principal', 'campus_coordinator', 'academic_coordinator', 'section_coordinator'] },
      { name: 'Accountant Dashboard', path: '/accountant-dashboard',  icon: Scale,           roles: ['accountant'] },
      { name: 'AI Assistant',         path: '/ai-assistant',          icon: Bot,             roles: ['admin', 'director', 'principal', 'vice_principal'] },
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 2. PEOPLE & ENROLLMENT
  // ──────────────────────────────────────────────────────────────────────────
  {
    title: 'People & Enrollment',
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
          { name: 'Student List',          path: '/students',                    exact: true, icon: Users,        roles: ALL_ACADEMIC },
          { name: 'Register New Student',  path: '/students/register',                        icon: UserPlus,     roles: ALL_STAFF    },
          { name: 'Custom List Generator', path: '/students/custom-list',                     icon: ClipboardList,roles: ALL_STAFF    },
          { name: 'Admission Form',        path: '/students/admission-form',                  icon: FileText,     roles: ALL_STAFF    },
          { name: 'Bulk Enrollment',       path: '/students/bulk-enrollment',                 icon: Upload,       roles: ALL_STAFF    },
          { name: 'Promote Students',      path: '/students/promote',                         icon: ShieldCheck,  roles: ALL_ADMIN    },
          { name: 'Digital ID Cards',      path: '/students/id-cards',                        icon: CreditCard,   roles: ALL_STAFF    },
          { name: 'Student Reports',       path: '/students/reports',                         icon: BarChart3,    roles: ALL_ADMIN    },
          { name: 'Leaving Certificate',   path: '/students/leaving-certificate',             icon: Award,        roles: ALL_STAFF    },
          { name: 'Character Certificate', path: '/students/character-certificate',           icon: Award,        roles: ALL_STAFF    },
        ],
      },
      { name: 'Parents',       path: '/parents', icon: Users,    roles: ALL_STAFF  },
      {
        name: 'Staff',
        path: '/staff',
        icon: Briefcase,
        roles: ALL_ADMIN,
        subItems: [
          { name: 'Staff Directory', path: '/staff',          exact: true, icon: Users     },
          { name: 'Staff ID Cards',  path: '/staff/id-cards',             icon: CreditCard },
          { name: 'User Accounts',   path: '/staff/accounts',             icon: Shield     },
        ],
      },
      { name: 'Family Groups', path: '/family', icon: Users2,   roles: ALL_STAFF  },
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 3. ACADEMIC
  // ──────────────────────────────────────────────────────────────────────────
  {
    title: 'Academic',
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
      { name: 'Timetable',     path: '/timetable',  icon: Calendar,     roles: ALL_ACADEMIC },
      { name: 'Teacher Diary', path: '/diary',       icon: ClipboardList,roles: ALL_ACADEMIC },
      { name: 'Evaluation',    path: '/evaluation',  icon: Star,         roles: ALL_ACADEMIC },
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 4. ATTENDANCE  (merged Leave & Discipline here — logically grouped)
  // ──────────────────────────────────────────────────────────────────────────
  {
    title: 'Attendance & Leave',
    id: 'attendance',
    color: '#14b8a6',
    roles: ALL_ACADEMIC,
    items: [
      {
        name: 'Attendance',
        path: '/attendance',
        icon: CalendarCheck,
        roles: ALL_ACADEMIC,
        subItems: [
          { name: 'Daily Roll Call',      path: '/attendance',               exact: true, icon: CalendarCheck, roles: ALL_ACADEMIC },
          { name: 'Absent Students',      path: '/attendance/absent-list',               icon: UserX,         roles: ALL_ACADEMIC },
          { name: 'Daily Report',         path: '/attendance/daily-report',              icon: FileText,      roles: ALL_ACADEMIC },
          { name: 'Monthly Report',       path: '/attendance/monthly-report',            icon: BarChart3,     roles: ALL_ACADEMIC },
          { name: 'Sessional Report',     path: '/attendance/sessional-report',          icon: TrendingUp,    roles: ALL_ACADEMIC },
          { name: 'Staff Attendance',     path: '/attendance/staff',                     icon: Briefcase,     roles: ALL_ADMIN    },
          { name: 'Staff Report',         path: '/attendance/staff-report',              icon: LineChart,     roles: ALL_ADMIN    },
          { name: 'QR Attendance Kiosk',  path: '/attendance/scanner',                   icon: Wifi,          roles: ALL_STAFF    },
          { name: 'SMS History',          path: '/attendance/sms-history',               icon: Radio,         roles: ALL_STAFF    },
        ],
      },
      {
        name: 'Leave Management',
        path: '/leave',
        icon: CalendarOff,
        roles: ALL_ACADEMIC,
        subItems: [
          { name: 'Student Leave',      path: '/leave/student',  icon: GraduationCap                    },
          { name: 'Staff Leave',        path: '/leave/staff',    icon: Briefcase,    roles: ALL_ADMIN   },
          { name: 'Substitute Fixture', path: '/leave/fixture',  icon: Users2,       roles: ALL_ADMIN   },
        ],
      },
      { name: 'Complaints & Feedback', path: '/complaints', icon: AlertTriangle, roles: ['admin', 'teacher', 'staff', 'principal', 'director', 'vice_principal', 'campus_coordinator'] },
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 5. EXAMS & RESULTS
  // ──────────────────────────────────────────────────────────────────────────
  {
    title: 'Exams & Results',
    id: 'exams',
    color: '#f59e0b',
    roles: ALL_ACADEMIC,
    items: [
      {
        name: 'Exam and Results',
        path: '/result',
        icon: FileText,
        roles: ALL_ACADEMIC,
        subItems: [
          { name: 'Exam Types',              path: '/result/exam-types',       icon: SettingsIcon,   roles: ALL_ADMIN   },
          { name: 'Result Status',           path: '/result/status',           icon: ClipboardCheck, roles: ALL_ACADEMIC },
          { name: 'Admin Results Entry',     path: '/result/add-result',       icon: Star,           roles: ALL_ADMIN   },
          { name: 'Import from Excel',       path: '/result/import',           icon: Upload,         roles: ALL_STAFF   },
          { name: 'Teacher Mark Entry',      path: '/result/teacher-marks',    icon: Star,           roles: ALL_ACADEMIC },
          { name: 'Consolidated Sheet',      path: '/result/consolidated',     icon: LayoutDashboard,roles: ALL_ACADEMIC },
          { name: 'Award List Generator',    path: '/result/award-list',       icon: Printer,        roles: ALL_ACADEMIC },
          { name: 'Report Cards',            path: '/result/reporting',        icon: LineChart,      roles: ALL_ACADEMIC },
          { name: 'Grading Policy',          path: '/result/grading-policy',   icon: SettingsIcon,   roles: ALL_ADMIN   },
          { name: 'Subject Marks Config',    path: '/result/marks-config',     icon: Award,          roles: ALL_ADMIN   },
        ],
      },
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 6. FINANCE
  // ──────────────────────────────────────────────────────────────────────────
  {
    title: 'Finance',
    id: 'finance',
    color: '#10b981',
    roles: ALL_FINANCE,
    items: [
      {
        name: 'Fee Management',
        path: '/fees',
        icon: CreditCard,
        roles: ALL_FINANCE,
        subItems: [
          { name: 'Quick Collection',         path: '/fees/easy-fee',        icon: Wallet       },
          { name: 'Generate Invoices',        path: '/fees/invoices',        icon: Receipt      },
          { name: 'Student Fee Ledger',       path: '/fees/student-detail',  icon: Users        },
          { name: 'Fee History Search',       path: '/fees/fee-history',     icon: Clock        },
          { name: 'Advance Payments',         path: '/fees/advance-fee',     icon: Banknote,    roles: ALL_ADMIN },
          { name: 'Fee Templates',            path: '/fees/fee-templates',   icon: Layers,      roles: ALL_ADMIN },
          { name: 'Discounts & Scholarships', path: '/fees/discounts',       icon: Award,       roles: ALL_ADMIN },
          { name: 'Late Fine Rules',          path: '/fees/fine-policy',     icon: AlertTriangle,roles: ALL_ADMIN },
          { name: 'Challan Settings',         path: '/fees/challan-settings',icon: Palette,     roles: ALL_ADMIN },
          { name: 'Bulk Discount Entry',      path: '/fees/bulk-discount',   icon: Tag,         roles: ALL_ADMIN },
          { name: 'Bulk Arrears Entry',       path: '/fees/bulk-arrears',    icon: History,     roles: ALL_ADMIN },
        ],
      },
      {
        name: 'Expenses',
        path: '/expenses',
        icon: Wallet,
        roles: ALL_FINANCE,
        subItems: [
          { name: 'Daily Expenses',   path: '/expenses/add-daily',        exact: true, icon: Wallet    },
          { name: 'Day Book / Ledger',path: '/expenses/ledger',                        icon: LineChart },
          { name: 'Expense Heads',    path: '/expenses/heads',                         icon: SettingsIcon, roles: ALL_ADMIN },
          { name: 'Budget',           path: '/expenses/budget',                        icon: PiggyBank },
          { name: 'Expense Reports',  path: '/expenses/reports',                       icon: BarChart3 },
          { name: 'Payment Sources',  path: '/expenses/payment-sources',               icon: CreditCard,   roles: ALL_ADMIN },
          { name: 'Profit & Loss',    path: '/expenses/p-and-l',                       icon: TrendingUp},
          { name: 'Bulk Import',      path: '/expenses/bulk-import',                   icon: Upload,       roles: ALL_ADMIN },
        ],
      },
      {
        name: 'Payroll',
        path: '/payroll',
        icon: DollarSign,
        roles: ['admin', 'accountant', 'principal', 'director'],
        subItems: [
          { name: 'Process Payroll',  path: '/payroll',            exact: true, icon: DollarSign },
          { name: 'Allowances',       path: '/payroll/allowances',              icon: Award      },
          { name: 'Salary Slips',     path: '/payroll/slips',                   icon: FileText   },
          { name: 'Staff Advance',    path: '/payroll/advance',                 icon: Wallet     },
          { name: 'Staff Ledger',     path: '/payroll/ledger',                  icon: History    },
          { name: 'Payroll Reports',  path: '/payroll/reports',                 icon: BarChart3  },
        ],
      },
      {
        name: 'Accounting',
        path: '/accounting',
        icon: Scale,
        roles: ['admin', 'accountant', 'principal', 'director'],
        subItems: [
          { name: 'Journal Entry',     path: '/accounting/journal',            icon: BookMarked },
          { name: 'Chart of Accounts', path: '/accounting/chart-of-accounts',  icon: Landmark   },
          { name: 'Trial Balance',     path: '/accounting/trial-balance',      icon: Scale      },
          { name: 'Balance Sheet',     path: '/accounting/balance-sheet',      icon: BarChart2  },
        ],
      },
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 7. REPORTS & ANALYTICS  (Invoice Report promoted here from Finance)
  // ──────────────────────────────────────────────────────────────────────────
  {
    title: 'Reports & Analytics',
    id: 'reports',
    color: '#0ea5e9',
    roles: ALL_REPORTS,
    items: [
      { name: 'Master Summary',    path: '/reports/master-summary', icon: BarChart,   roles: ALL_REPORTS },
      { name: 'Collection Report', path: '/reports/collection',     icon: CreditCard, roles: ALL_REPORTS },
      { name: 'Invoice Report',    path: '/fees/invoice-report',    icon: Receipt,    roles: ALL_FINANCE },
      { name: 'Student Reports',   path: '/students/reports',       icon: BarChart3,  roles: ALL_ADMIN   },
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 8. COMMUNICATION  (SMS History moved to Attendance; Front Desk stays)
  // ──────────────────────────────────────────────────────────────────────────
  {
    title: 'Communication',
    id: 'communication',
    color: '#ec4899',
    roles: ['admin', 'teacher', 'staff', 'principal', 'director'],
    items: [
      { name: 'Broadcast & Messaging', path: '/communication', icon: MessageSquare, roles: ALL_ADMIN },
      { name: 'Front Desk',            path: '/frontdesk',     icon: Home,          roles: ALL_STAFF },
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 9. SCHOOL SERVICES
  // ──────────────────────────────────────────────────────────────────────────
  {
    title: 'School Services',
    id: 'services',
    color: '#f97316',
    roles: ['admin', 'staff', 'librarian', 'principal', 'director'],
    items: [
      { name: 'Library',    path: '/library',    icon: Library, roles: ['admin', 'staff', 'librarian'] },
      {
        name: 'Transport',
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
      { name: 'Inventory & Stationery', path: '/inventory', icon: Package, roles: ALL_STAFF },
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 10. SYSTEM
  // ──────────────────────────────────────────────────────────────────────────
  {
    title: 'System',
    id: 'settings',
    color: '#94a3b8',
    roles: ALL_ADMIN,
    items: [
      { name: 'Settings',             path: '/settings',             icon: SettingsIcon, roles: ALL_ADMIN },
      { name: 'Permission Manager',   path: '/settings/permissions', icon: Key,          roles: ALL_ADMIN },
      { name: 'ID Card Designer',     path: '/settings/id-cards',    icon: Palette,      roles: ALL_ADMIN },
      { name: 'Report Card Designer', path: '/settings/report-cards',icon: LineChart,    roles: ALL_ADMIN },
      { name: 'Credential Dispatch',  path: '/credentials',          icon: ShieldCheck,  roles: ALL_ADMIN },
      { name: 'Help & Support',       path: '/help-support',         icon: LifeBuoy,     roles: ALL_ADMIN },
      { name: 'Trashbin',             path: '/settings/trashbin',    icon: Trash2,       roles: ['admin'] },
    ],
  },
];
