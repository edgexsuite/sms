import {
  LayoutDashboard, Bot, GraduationCap, Users, UserPlus, FileText, Upload,
  ShieldCheck, CreditCard, Award, Settings as SettingsIcon, MessageSquare,
  Briefcase, Shield, BookOpen, Calendar, Star, CalendarCheck, Wifi,
  CalendarOff, ClipboardList, AlertTriangle, Wallet, TrendingUp, PiggyBank,
  Banknote, DollarSign, Scale, BarChart3, BarChart2, ClipboardCheck, UserX,
  LineChart, Library, Home, Bell, Key, Trash2, Box, Package, Clock, Palette,
  Receipt, Layers, BookMarked, Landmark, BarChart
} from 'lucide-react';

export const ALL_ADMIN = ['admin', 'principal', 'director'];
export const ALL_STAFF = ['admin', 'principal', 'director', 'staff'];
export const ALL_ACADEMIC = ['admin', 'principal', 'director', 'teacher', 'staff'];
export const ALL_FINANCE = ['admin', 'staff', 'accountant', 'principal', 'director'];
export const ALL_REPORTS = ['admin', 'staff', 'accountant', 'principal', 'director'];

export const NAV_SECTIONS = [
  {
    title: 'Overview',
    id: 'dashboard',
    roles: ['admin', 'teacher', 'staff', 'accountant', 'librarian', 'principal', 'director'],
    items: [
      { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, roles: ['admin', 'teacher', 'staff', 'accountant', 'librarian', 'principal', 'director'] },
      { name: 'AI Assistant', path: '/ai-assistant', icon: Bot, roles: ['admin', 'director', 'principal'] },
    ]
  },
  {
    title: 'People & Enrollment',
    id: 'students',
    roles: ['admin', 'teacher', 'staff', 'principal', 'director'],
    items: [
      {
        name: 'Students',
        path: '/students',
        icon: GraduationCap,
        roles: ['admin', 'teacher', 'staff', 'principal', 'director'],
        subItems: [
          { name: 'Student List', path: '/students', exact: true, icon: Users, roles: ALL_ACADEMIC },
          { name: 'Register New Student', path: '/students/register', icon: UserPlus, roles: ALL_STAFF },
          { name: 'Custom List Generator', path: '/students/custom-list', icon: ClipboardList, roles: ALL_STAFF },
          { name: 'Admission Form', path: '/students/admission-form', icon: FileText, roles: ALL_STAFF },
          { name: 'Bulk Enrollment', path: '/students/bulk-enrollment', icon: Upload, roles: ALL_STAFF },
          { name: 'Promote Students', path: '/students/promote', icon: ShieldCheck, roles: ALL_ADMIN },
          { name: 'Digital ID Cards', path: '/students/id-cards', icon: CreditCard, roles: ALL_STAFF },
          { name: 'Student Reports', path: '/students/reports', icon: BarChart3, roles: ALL_ADMIN },
          { name: 'Leaving Certificate', path: '/students/leaving-certificate', icon: Award, roles: ALL_STAFF },
          { name: 'Character Certificate', path: '/students/character-certificate', icon: Award, roles: ALL_STAFF },
        ]
      },
      { name: 'Parents', path: '/parents', icon: Users, roles: ALL_STAFF },
      {
        name: 'Staff',
        path: '/staff',
        icon: Briefcase,
        roles: ALL_ADMIN,
        subItems: [
          { name: 'Staff Directory', path: '/staff', exact: true, icon: Users },
          { name: 'Staff ID Cards', path: '/staff/id-cards', icon: CreditCard },
          { name: 'User Accounts', path: '/staff/accounts', icon: Shield },
        ]
      },
      { name: 'Family Groups', path: '/family', icon: Users, roles: ALL_STAFF },
    ]
  },
  {
    title: 'Curriculum',
    id: 'academic',
    roles: ALL_STAFF,
    items: [
      {
        name: 'Classes & Subjects',
        path: '/classes',
        icon: BookOpen,
        roles: ALL_STAFF,
        subItems: [
          { name: 'Class & Section Setup', path: '/classes/manage', exact: true, icon: BookOpen },
          { name: 'Subject Management', path: '/classes/subjects', icon: FileText },
        ]
      },
      { name: 'Timetable', path: '/timetable', icon: Calendar, roles: ALL_STAFF },
      { name: 'Evaluation', path: '/evaluation', icon: Star, roles: ['admin', 'teacher', 'principal', 'director'] },
    ]
  },
  {
    title: 'Attendance & Leave',
    id: 'attendance',
    roles: ALL_ACADEMIC,
    items: [
      {
        name: 'Attendance',
        path: '/attendance',
        icon: CalendarCheck,
        roles: ALL_ACADEMIC,
        subItems: [
          { name: 'Daily Roll Call', path: '/attendance', exact: true, icon: CalendarCheck, roles: ALL_ACADEMIC },
          { name: 'Absent Students', path: '/attendance/absent-list', icon: UserX, roles: ALL_ACADEMIC },
          { name: 'Daily Report', path: '/attendance/daily-report', icon: FileText, roles: ALL_ACADEMIC },
          { name: 'Monthly Report', path: '/attendance/monthly-report', icon: BarChart3, roles: ALL_ACADEMIC },
          { name: 'Sessional Report', path: '/attendance/sessional-report', icon: TrendingUp, roles: ALL_ACADEMIC },
          { name: 'Staff Attendance', path: '/attendance/staff', icon: Briefcase, roles: ALL_ADMIN },
          { name: 'Staff Report', path: '/attendance/staff-report', icon: LineChart, roles: ALL_ADMIN },
          { name: 'Smart Kiosk', path: '/attendance/scanner', icon: Wifi, roles: ALL_STAFF },
          { name: 'SMS History', path: '/attendance/sms-history', icon: MessageSquare, roles: ALL_STAFF },
        ]
      },
      {
        name: 'Leave Management',
        path: '/leave',
        icon: CalendarOff,
        roles: ALL_ACADEMIC,
        subItems: [
          { name: 'Student Leave', path: '/leave/student', icon: GraduationCap },
          { name: 'Staff Leave', path: '/leave/staff', icon: Briefcase, roles: ALL_ADMIN },
        ]
      },
      { name: 'Teacher Diary', path: '/diary', icon: ClipboardList, roles: ['admin', 'teacher', 'principal', 'director'] },
      { name: 'Complaints', path: '/complaints', icon: AlertTriangle, roles: ['admin', 'teacher', 'staff', 'principal', 'director'] },
    ]
  },
  {
    title: 'Exams & Results',
    id: 'exams',
    roles: ALL_ACADEMIC,
    items: [
      {
        name: 'Result Module',
        path: '/result',
        icon: FileText,
        roles: ALL_ACADEMIC,
        subItems: [
          { name: 'Exam Types', path: '/result/exam-types', icon: SettingsIcon, roles: ALL_ADMIN },
          { name: 'Enter Results', path: '/result/add-result', exact: true, icon: Star },
          { name: 'Report Cards', path: '/result/reporting', icon: LineChart },
        ]
      },
    ]
  },
  {
    title: 'Finance',
    id: 'finance',
    roles: ALL_FINANCE,
    items: [
      {
        name: 'Fee Management',
        path: '/fees',
        icon: CreditCard,
        roles: ALL_FINANCE,
        subItems: [
          { name: 'Fee Master', path: '/fees/criteria', icon: SettingsIcon, roles: ALL_ADMIN },
          { name: 'Monthly Invoices', path: '/fees/invoices', icon: Receipt },
          { name: 'Fee Collection', path: '/fees/easy-fee', icon: Wallet },
          { name: 'Student Ledgers', path: '/fees/student-detail', icon: Users },
          { name: 'Fee History', path: '/fees/fee-history', icon: Clock },
          { name: 'Discount Manager', path: '/fees/discounts', icon: Award, roles: ALL_ADMIN },
          { name: 'Fine Policy', path: '/fees/fine-policy', icon: AlertTriangle, roles: ALL_ADMIN },
          { name: 'Advance Fee', path: '/fees/advance-fee', icon: Banknote, roles: ALL_ADMIN },
          { name: 'Challan Settings', path: '/fees/challan-settings', icon: Palette, roles: ALL_ADMIN },
        ]
      },
      {
        name: 'Expenses',
        path: '/expenses',
        icon: Wallet,
        roles: ALL_FINANCE,
        subItems: [
          { name: 'Daily Expenses', path: '/expenses/add-daily', exact: true, icon: Wallet },
          { name: 'Expense Ledger', path: '/expenses/ledger', icon: LineChart },
          { name: 'Expense Heads', path: '/expenses/heads', icon: SettingsIcon, roles: ALL_ADMIN },
          { name: 'Budget', path: '/expenses/budget', icon: PiggyBank },
          { name: 'Expense Reports', path: '/expenses/reports', icon: BarChart3 },
          { name: 'Payment Sources', path: '/expenses/payment-sources', icon: CreditCard, roles: ALL_ADMIN },
          { name: 'Profit & Loss', path: '/expenses/p-and-l', icon: TrendingUp },
          { name: 'Bulk Import', path: '/expenses/bulk-import', icon: Upload, roles: ALL_ADMIN },
        ]
      },
      {
        name: 'Payroll',
        path: '/payroll',
        icon: DollarSign,
        roles: ['admin', 'accountant', 'principal', 'director'],
        subItems: [
          { name: 'Process Payroll', path: '/payroll', exact: true, icon: DollarSign },
          { name: 'Allowances', path: '/payroll/allowances', icon: Award },
          { name: 'Salary Slips', path: '/payroll/slips', icon: FileText },
          { name: 'Payroll Reports', path: '/payroll/reports', icon: BarChart3 },
        ]
      },
      {
        name: 'Accounting',
        path: '/accounting',
        icon: Scale,
        roles: ['admin', 'accountant', 'principal', 'director'],
        subItems: [
          { name: 'Journal Entry', path: '/accounting/journal', icon: BookMarked },
          { name: 'Chart of Accounts', path: '/accounting/chart-of-accounts', icon: Landmark },
          { name: 'Trial Balance', path: '/accounting/trial-balance', icon: Scale },
          { name: 'Balance Sheet', path: '/accounting/balance-sheet', icon: BarChart2 },
        ]
      },
    ]
  },
  {
    title: 'Reports',
    id: 'reports',
    roles: ALL_REPORTS,
    items: [
      { name: 'Master Summary', path: '/reports/master-summary', icon: BarChart, roles: ALL_REPORTS },
    ]
  },
  {
    title: 'School Services',
    id: 'services',
    roles: ['admin', 'teacher', 'staff', 'librarian', 'principal', 'director'],
    items: [
      { name: 'Library', path: '/library', icon: Library, roles: ['admin', 'staff', 'librarian'] },
      { name: 'Front Desk', path: '/frontdesk', icon: Home, roles: ALL_STAFF },
      { name: 'Inventory', path: '/inventory', icon: Package, roles: ALL_STAFF },
      { name: 'Stationary', path: '/stationary', icon: Box, roles: ALL_STAFF },
      { name: 'Communication', path: '/communication', icon: MessageSquare, roles: ALL_ADMIN },
    ]
  },
  {
    title: 'System',
    id: 'settings',
    roles: ALL_ADMIN,
    items: [
      { name: 'Settings', path: '/settings', icon: SettingsIcon, roles: ALL_ADMIN },
      { name: 'Permission Manager', path: '/settings/permissions', icon: Key, roles: ALL_ADMIN },
      { name: 'ID Card Designer', path: '/settings/id-cards', icon: Palette, roles: ALL_ADMIN },
      { name: 'Credential Dispatch', path: '/credentials', icon: ShieldCheck, roles: ALL_ADMIN },
      { name: 'Trashbin', path: '/settings/trashbin', icon: Trash2, roles: ['admin'] },
    ]
  },
];
