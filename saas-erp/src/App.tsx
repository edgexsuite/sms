/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import DashboardLayout from './layouts/DashboardLayout';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import SignUp from './pages/SignUp';
import StudentsLayout from './pages/students/StudentsLayout';
import Parents from './pages/Parents';
import Staff from './pages/Staff';
import StaffDigitalIDCards from './pages/staff/StaffDigitalIDCards';
import ClassesLayout from './pages/classes/ClassesLayout';
import FeesLayout from './pages/fees/FeesLayout';
import ExpensesLayout from './pages/expenses/ExpensesLayout';
import AttendanceLayout from './pages/attendance/AttendanceLayout';
import ResultLayout from './pages/result/ResultLayout';
import Settings from './pages/Settings';
import CredentialDispatch from './pages/credentials/CredentialDispatch';
import Evaluation from './pages/Evaluation';
import Communication from './pages/Communication';
import Timetable from './pages/Timetable';
import Inventory from './pages/Inventory';
import Complaints from './pages/Complaints';
import AIAssistant from './pages/AIAssistant';
import LeaveLayout from './pages/leave/LeaveLayout';
import TeacherDiary from './pages/diary/TeacherDiary';
import PayrollLayout from './pages/payroll/PayrollLayout';
import AccountingLayout from './pages/accounting/AccountingLayout';
import LibraryLayout from './pages/library/LibraryLayout';
import FrontDeskLayout from './pages/frontdesk/FrontDeskLayout';
import FamilyGroups from './pages/family/FamilyGroups';
import ParentPortal from './pages/ParentPortal';
import StudentPortal from './pages/StudentPortal';
import ReportsLayout from './pages/reports/ReportsLayout';
import PermissionManager from './pages/settings/PermissionManager';
import Trashbin from './pages/settings/Trashbin';
import './i18n/config';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, loading } = useAuth();
  
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }
  
  if (!session) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
};

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<SignUp />} />
            <Route path="/parent-portal" element={<ParentPortal />} />
            <Route path="/student-portal" element={<StudentPortal />} />
            <Route path="/" element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="students/*" element={<StudentsLayout />} />
              <Route path="parents" element={<Parents />} />
              <Route path="staff" element={<Staff />} />
              <Route path="staff/id-cards" element={<StaffDigitalIDCards />} />
              <Route path="classes/*" element={<ClassesLayout />} />
              <Route path="attendance/*" element={<AttendanceLayout />} />
              <Route path="result/*" element={<ResultLayout />} />
              <Route path="fees/*" element={<FeesLayout />} />
              <Route path="expenses/*" element={<ExpensesLayout />} />
              <Route path="timetable" element={<Timetable />} />
              <Route path="evaluation" element={<Evaluation />} />
              <Route path="credentials" element={<CredentialDispatch />} />
              <Route path="communication" element={<Communication />} />
              <Route path="inventory" element={<Inventory />} />
              <Route path="complaints" element={<Complaints />} />
              <Route path="ai-assistant" element={<AIAssistant />} />
              <Route path="leave/*" element={<LeaveLayout />} />
              <Route path="diary" element={<TeacherDiary />} />
              <Route path="settings" element={<Settings />} />
              <Route path="payroll/*" element={<PayrollLayout />} />
              <Route path="accounting/*" element={<AccountingLayout />} />
              <Route path="library/*" element={<LibraryLayout />} />
              <Route path="frontdesk/*" element={<FrontDeskLayout />} />
              <Route path="reports/*" element={<ReportsLayout />} />
              <Route path="family" element={<FamilyGroups />} />
              <Route path="settings/permissions" element={<PermissionManager />} />
              <Route path="settings/trashbin" element={<Trashbin />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
