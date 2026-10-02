import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Settings, Award, ClipboardCheck, Star, LayoutDashboard, Printer, LineChart
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuth } from '../../contexts/AuthContext';

export default function ResultTabsHeader() {
  const location = useLocation();
  const { userRole } = useAuth();

  const isTeacher = ['teacher', 'staff'].includes(userRole?.role || '');
  const isAdminOrCoordinator = ['admin', 'principal', 'director', 'vice_principal', 'campus_coordinator', 'academic_coordinator'].includes(userRole?.role || '');

  const tabs = [
    {
      name: 'Exam Terms & Types',
      path: '/result/exam-types',
      icon: Settings,
      show: isAdminOrCoordinator,
    },
    {
      name: 'Subject Marks Config',
      path: '/result/marks-config',
      icon: Award,
      show: isAdminOrCoordinator,
    },
    {
      name: 'Result Status',
      path: '/result/status',
      icon: ClipboardCheck,
      show: true,
    },
    {
      name: 'Marks Entry',
      path: '/result/teacher-marks',
      icon: Star,
      show: true,
    },
    {
      name: 'Consolidated Sheet',
      path: '/result/consolidated',
      icon: LayoutDashboard,
      show: true,
    },
    {
      name: 'Award List',
      path: '/result/award-list',
      icon: Printer,
      show: true,
    },
    {
      name: 'Report Cards',
      path: '/result/reporting',
      icon: LineChart,
      show: true,
    },
  ].filter(t => t.show);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-2 shadow-xs mb-6 no-print">
      <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar scrollbar-none py-0.5">
        {tabs.map((tab) => {
          const isActive = location.pathname === tab.path || (tab.path === '/result/exam-types' && location.pathname === '/result');
          const Icon = tab.icon;
          return (
            <NavLink
              key={tab.path}
              to={tab.path}
              className={({ isActive: linkActive }) =>
                cn(
                  'flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap shrink-0',
                  isActive || linkActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100'
                    : 'text-slate-600 hover:text-indigo-600 hover:bg-slate-50'
                )
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{tab.name}</span>
            </NavLink>
          );
        })}
      </div>
    </div>
  );
}
