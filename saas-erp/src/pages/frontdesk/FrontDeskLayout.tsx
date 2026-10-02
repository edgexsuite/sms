import React from 'react';
import { Routes, Route, Navigate, NavLink, useLocation } from 'react-router-dom';
import { 
  GitPullRequest, HelpCircle, Users, Bell, ShieldCheck, Home
} from 'lucide-react';
import { cn } from '../../lib/utils';

import AdmissionPipeline from './AdmissionPipeline';
import AdmissionInquiries from './AdmissionInquiries';
import VisitorBook from './VisitorBook';
import GatePass from './GatePass';
import NoticeBoard from './NoticeBoard';

export default function FrontDeskLayout() {
  const location = useLocation();

  const navItems = [
    {
      to: '/frontdesk/pipeline',
      label: 'Admission Pipeline',
      icon: GitPullRequest,
      desc: 'Stages & Enrollment',
    },
    {
      to: '/frontdesk/inquiries',
      label: 'Inquiries',
      icon: HelpCircle,
      desc: 'Prospect Log & Follow-ups',
    },
    {
      to: '/frontdesk/visitors',
      label: 'Visitor Book',
      icon: Users,
      desc: 'Check-in & Security',
    },
    {
      to: '/frontdesk/gate-pass',
      label: 'Gate Pass System',
      icon: ShieldCheck,
      desc: 'Student Exit & Badges',
    },
    {
      to: '/frontdesk/notices',
      label: 'Notice Board',
      icon: Bell,
      desc: 'Announcements & Alerts',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Front Desk Hub Navigation Bar (Hidden on print) */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-sm print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-100 ring-4 ring-blue-50">
              <Home className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight leading-none uppercase">
                Front Desk & Reception Hub
              </h1>
              <p className="text-xs text-slate-500 font-medium mt-1">
                Admissions, Visitor Registry, Security Gate Passes and Campus Notices
              </p>
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 mt-5 pt-4 border-t border-slate-100">
          {navItems.map(item => {
            const isActive = location.pathname.startsWith(item.to) || (item.to === '/frontdesk/pipeline' && (location.pathname === '/frontdesk' || location.pathname === '/frontdesk/'));
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-2.5 p-3 rounded-2xl border text-left transition-all duration-200 cursor-pointer",
                  isActive
                    ? "bg-blue-50/80 border-blue-300 ring-2 ring-blue-500/20 text-blue-950 shadow-sm"
                    : "bg-slate-50/60 border-slate-200 text-slate-600 hover:bg-slate-100/80 hover:text-slate-900"
                )}
              >
                <div className={cn(
                  "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                  isActive ? "bg-blue-600 text-white shadow-md shadow-blue-200" : "bg-white text-slate-500 border border-slate-200"
                )}>
                  <item.icon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-tight truncate">
                    {item.label}
                  </p>
                  <p className="text-[10px] text-slate-400 font-medium truncate hidden md:block">
                    {item.desc}
                  </p>
                </div>
              </NavLink>
            );
          })}
        </div>
      </div>

      {/* Routes */}
      <div>
        <Routes>
          <Route path="/" element={<AdmissionPipeline />} />
          <Route path="pipeline" element={<AdmissionPipeline />} />
          <Route path="inquiries" element={<AdmissionInquiries />} />
          <Route path="visitors" element={<VisitorBook />} />
          <Route path="gate-pass" element={<GatePass />} />
          <Route path="notices" element={<NoticeBoard />} />
          <Route path="*" element={<Navigate to="/frontdesk/pipeline" replace />} />
        </Routes>
      </div>
    </div>
  );
}
