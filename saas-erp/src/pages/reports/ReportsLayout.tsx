import React, { lazy } from 'react';
import { Routes, Route, Navigate, NavLink } from 'react-router-dom';
import { FileText, CreditCard, AlertCircle, Users, TrendingUp, GraduationCap } from 'lucide-react';
import MasterSummaryReport from './MasterSummaryReport';

const CollectionReport             = lazy(() => import('./CollectionReport'));
const DefaulterReport              = lazy(() => import('./DefaulterReport'));
const FeeDefaulterReport           = lazy(() => import('./FeeDefaulterReport'));
const StaffAttendanceMonthlyReport = lazy(() => import('./StaffAttendanceMonthlyReport'));
const IncomeExpenseTrendReport     = lazy(() => import('./IncomeExpenseTrendReport'));
const StudentStrengthReport        = lazy(() => import('./StudentStrengthReport'));

const NAV = [
  { to: '/reports/master-summary',           icon: FileText,       label: 'Master Summary'      },
  { to: '/reports/collection',               icon: CreditCard,     label: 'Collection Report'   },
  { to: '/reports/defaulters',               icon: AlertCircle,    label: 'Defaulters'          },
  { to: '/reports/fee-defaulters',           icon: AlertCircle,    label: 'Fee Defaulters'      },
  { to: '/reports/staff-attendance-monthly', icon: Users,          label: 'Staff Attendance'    },
  { to: '/reports/income-expense-trend',     icon: TrendingUp,     label: 'Income vs Expense'   },
  { to: '/reports/student-strength',         icon: GraduationCap,  label: 'Student Strength'    },
];

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-2 px-4 py-3 font-black transition whitespace-nowrap text-sm border-b-2 ${
    isActive
      ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50'
      : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
  }`;

export default function ReportsLayout() {
  return (
    <div className="space-y-6">
      <div className="bg-white border-b border-slate-200 -mx-6 -mt-6 px-6 py-2 shadow-sm no-print">
        <div className="flex items-center gap-6 overflow-x-auto no-scrollbar">
          {NAV.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} className={linkClass}>
              <Icon className="w-5 h-5" /> {label}
            </NavLink>
          ))}
        </div>
      </div>

      <Routes>
        <Route path="master-summary"           element={<MasterSummaryReport />} />
        <Route path="collection"               element={<CollectionReport />} />
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
