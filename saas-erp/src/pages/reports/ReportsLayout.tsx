import React, { lazy } from 'react';
import { Routes, Route, Navigate, NavLink } from 'react-router-dom';
import { FileText, PieChart, BarChart3, CreditCard, AlertCircle } from 'lucide-react';
import MasterSummaryReport from './MasterSummaryReport';

const CollectionReport = lazy(() => import('./CollectionReport'));
const DefaulterReport = lazy(() => import('./DefaulterReport'));

export default function ReportsLayout() {
  return (
    <div className="space-y-6">
      <div className="bg-white border-b border-slate-200 -mx-6 -mt-6 px-6 py-2 shadow-sm no-print">
        <div className="flex items-center gap-6 overflow-x-auto no-scrollbar">
          <NavLink 
            to="/reports/master-summary" 
            className={({isActive}) => `flex items-center gap-2 px-4 py-3 font-black transition whitespace-nowrap text-sm border-b-2 ${isActive ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
          >
            <FileText className="w-5 h-5"/> Master Summary
          </NavLink>
          <NavLink 
            to="/reports/collection" 
            className={({isActive}) => `flex items-center gap-2 px-4 py-3 font-black transition whitespace-nowrap text-sm border-b-2 ${isActive ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
          >
            <CreditCard className="w-5 h-5"/> Collection Report
          </NavLink>
          <NavLink 
            to="/reports/defaulters" 
            className={({isActive}) => `flex items-center gap-2 px-4 py-3 font-black transition whitespace-nowrap text-sm border-b-2 ${isActive ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
          >
            <AlertCircle className="w-5 h-5"/> Defaulters
          </NavLink>
        </div>
      </div>

      <Routes>
        <Route path="master-summary" element={<MasterSummaryReport />} />
        <Route path="collection" element={<CollectionReport />} />
        <Route path="defaulters" element={<DefaulterReport />} />
        <Route path="*" element={<Navigate to="master-summary" replace />} />
      </Routes>
    </div>
  );
}
