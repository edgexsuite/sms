import React, { useState, useMemo, lazy } from 'react';
import { Routes, Route, Navigate, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  FileText, CreditCard, AlertCircle, Users, TrendingUp, GraduationCap,
  ClipboardCheck, Calendar, AlertTriangle, BarChart3, BookOpen,
  ChevronDown, Search, Filter, Layers, Sparkles, Table2
} from 'lucide-react';
import { cn } from '../../lib/utils';
import MasterSummaryReport from './MasterSummaryReport';

const CollectionReport             = lazy(() => import('./CollectionReport'));
const DefaulterReport              = lazy(() => import('./DefaulterReport'));
const FeeDefaulterReport           = lazy(() => import('./FeeDefaulterReport'));
const StaffAttendanceMonthlyReport = lazy(() => import('./StaffAttendanceMonthlyReport'));
const IncomeExpenseTrendReport     = lazy(() => import('./IncomeExpenseTrendReport'));
const StudentStrengthReport        = lazy(() => import('./StudentStrengthReport'));
const FeeStatusReport              = lazy(() => import('./FeeStatusReport'));
const MonthlyConsolidatedReport    = lazy(() => import('./MonthlyConsolidatedReport'));
const ArrearsReport                = lazy(() => import('./ArrearsReport'));
const ClassFeeSummary              = lazy(() => import('./ClassFeeSummary'));
const ClassFeeMatrixReport         = lazy(() => import('./ClassFeeMatrixReport'));
const StudentFeeLedgerReport       = lazy(() => import('./StudentFeeLedgerReport'));

type CategoryId = 'all' | 'fee' | 'academic' | 'operations';

interface ReportNavItem {
  to: string;
  icon: any;
  label: string;
  shortLabel?: string;
  category: CategoryId;
  badge?: string;
  desc: string;
}

const REPORT_ITEMS: ReportNavItem[] = [
  // Fee & Collections
  { to: '/reports/collection',           icon: CreditCard,     label: 'Collection Report',   shortLabel: 'Collection',    category: 'fee',        desc: 'Daily & monthly fee receipts and paid logs' },
  { to: '/reports/fee-status',           icon: ClipboardCheck, label: 'Fee Status Report',   shortLabel: 'Fee Status',    category: 'fee',        badge: 'Core', desc: 'Filter by Pending, Partial, or Paid status' },
  { to: '/reports/monthly-consolidated', icon: Calendar,       label: 'Monthly Consolidated',shortLabel: 'Monthly Summary',category: 'fee',      desc: 'Month-by-month revenue & collection rate' },
  { to: '/reports/arrears',              icon: AlertTriangle,  label: 'Arrears / Overdue',   shortLabel: 'Arrears',       category: 'fee',        badge: 'Aging', desc: 'Overdue balances from previous months' },
  { to: '/reports/class-fee-summary',    icon: BarChart3,      label: 'Class Fee Summary',   shortLabel: 'Class Summary', category: 'fee',        desc: 'One row per class fee & collection KPI' },
  { to: '/reports/class-fee-matrix',     icon: Table2,         label: 'Class Fee Matrix',    shortLabel: 'Fee Matrix',    category: 'fee',        badge: 'Annual', desc: '12-month consolidated fee paid matrix per student' },
  { to: '/reports/student-ledger',       icon: BookOpen,       label: 'Student Fee Ledger',  shortLabel: 'Fee Ledger',    category: 'fee',        desc: 'Single student full ledger & timeline' },
  { to: '/reports/defaulters',           icon: AlertCircle,    label: 'Defaulter List',      shortLabel: 'Defaulters',    category: 'fee',        desc: 'Full dues & unpaid invoices list' },
  { to: '/reports/fee-defaulters',       icon: AlertCircle,    label: 'Fee Defaulters & SMS',shortLabel: 'SMS Defaulters',category: 'fee',       desc: 'Defaulters with WhatsApp reminder dispatch' },

  // Academic & Overview
  { to: '/reports/master-summary',       icon: FileText,       label: 'Master Summary',      shortLabel: 'Master Summary',category: 'academic',   badge: '360°', desc: 'High-level school health, admissions & finances' },
  { to: '/reports/student-strength',     icon: GraduationCap,  label: 'Student Strength',    shortLabel: 'Strength',      category: 'academic',   desc: 'Class-wise gender ratio & enrollment count' },

  // Operations & HR
  { to: '/reports/staff-attendance-monthly', icon: Users,      label: 'Staff Attendance',    shortLabel: 'Staff Attend.', category: 'operations', desc: 'Monthly staff attendance & leaves summary' },
  { to: '/reports/income-expense-trend',     icon: TrendingUp, label: 'Income vs Expense',   shortLabel: 'Cash Flow',     category: 'operations', desc: 'Revenue vs operational expenditures trend' },
];

const CATEGORIES: { id: CategoryId; label: string; icon: any }[] = [
  { id: 'all',        label: 'All Reports',       icon: Layers },
  { id: 'fee',        label: 'Fee & Financial',   icon: CreditCard },
  { id: 'academic',   label: 'Academic & School', icon: GraduationCap },
  { id: 'operations', label: 'Operations & HR',   icon: TrendingUp },
];

export default function ReportsLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState<CategoryId>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Find active item
  const currentItem = useMemo(() => {
    return REPORT_ITEMS.find(item => location.pathname.startsWith(item.to)) || REPORT_ITEMS[0];
  }, [location.pathname]);

  // Filter items
  const visibleItems = useMemo(() => {
    return REPORT_ITEMS.filter(item => {
      const matchesCat = selectedCategory === 'all' || item.category === selectedCategory;
      const matchesSearch = !searchQuery.trim() ||
        item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.desc.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCat && matchesSearch;
    });
  }, [selectedCategory, searchQuery]);

  return (
    <div className="space-y-4">
      {/* ── Compact Professional Navigation Header ── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-3 no-print">
        {/* Top Control Strip */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          
          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            {CATEGORIES.map(cat => {
              const count = cat.id === 'all' ? REPORT_ITEMS.length : REPORT_ITEMS.filter(r => r.category === cat.id).length;
              const isActive = selectedCategory === cat.id;
              const Icon = cat.icon;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition-all whitespace-nowrap',
                    isActive
                      ? 'bg-[#0d1526] text-white shadow-sm'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/60'
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{cat.label}</span>
                  <span className={cn(
                    'px-1.5 py-0.2 rounded-md text-[10px] font-black',
                    isActive ? 'bg-white/20 text-white' : 'bg-slate-200/80 text-slate-600'
                  )}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Quick Jump Selector & Search */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="relative w-48 sm:w-56">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Find report..."
                className="w-full pl-8 pr-2.5 py-1.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-400"
              />
            </div>

            {/* Quick Switcher dropdown */}
            <div className="relative">
              <select
                value={currentItem.to}
                onChange={e => navigate(e.target.value)}
                className="appearance-none pl-3 pr-8 py-1.5 text-xs font-black bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-sm"
              >
                <optgroup label="Fee & Financial">
                  {REPORT_ITEMS.filter(r => r.category === 'fee').map(r => (
                    <option key={r.to} value={r.to}>{r.label}</option>
                  ))}
                </optgroup>
                <optgroup label="Academic & School">
                  {REPORT_ITEMS.filter(r => r.category === 'academic').map(r => (
                    <option key={r.to} value={r.to}>{r.label}</option>
                  ))}
                </optgroup>
                <optgroup label="Operations & HR">
                  {REPORT_ITEMS.filter(r => r.category === 'operations').map(r => (
                    <option key={r.to} value={r.to}>{r.label}</option>
                  ))}
                </optgroup>
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-indigo-500 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Secondary Report Navigation Chips Bar — Multi-row responsive wrap */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2.5">
          {visibleItems.map(item => {
            const Icon = item.icon;
            const isSelected = location.pathname.startsWith(item.to);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={cn(
                  'group flex items-center gap-2 px-3 py-1.5 rounded-xl font-bold text-xs transition-all whitespace-nowrap border',
                  isSelected
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-100'
                    : 'bg-white text-slate-600 border-slate-200/80 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300'
                )}
                title={item.desc}
              >
                <Icon className={cn('w-3.5 h-3.5', isSelected ? 'text-white' : 'text-slate-400 group-hover:text-indigo-600')} />
                <span>{item.shortLabel || item.label}</span>
                {item.badge && (
                  <span className={cn(
                    'px-1.5 py-0.2 rounded-full text-[9px] font-black uppercase tracking-wider',
                    isSelected ? 'bg-white/25 text-white' : 'bg-indigo-50 text-indigo-600'
                  )}>
                    {item.badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </div>
      </div>

      {/* ── Active Report View ── */}
      <Routes>
        <Route path="master-summary"           element={<MasterSummaryReport />} />
        <Route path="collection"               element={<CollectionReport />} />
        <Route path="fee-status"               element={<FeeStatusReport />} />
        <Route path="monthly-consolidated"     element={<MonthlyConsolidatedReport />} />
        <Route path="arrears"                  element={<ArrearsReport />} />
        <Route path="class-fee-summary"        element={<ClassFeeSummary />} />
        <Route path="class-fee-matrix"         element={<ClassFeeMatrixReport />} />
        <Route path="student-ledger"           element={<StudentFeeLedgerReport />} />
        <Route path="defaulters"               element={<DefaulterReport />} />
        <Route path="fee-defaulters"           element={<FeeDefaulterReport />} />
        <Route path="staff-attendance-monthly" element={<StaffAttendanceMonthlyReport />} />
        <Route path="income-expense-trend"     element={<IncomeExpenseTrendReport />} />
        <Route path="student-strength"         element={<StudentStrengthReport />} />
        <Route path="*"                        element={<Navigate to="master-summary" replace />} />
      </Routes>
    </div>
  );
}
