/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import LoadingIndicator from './components/LoadingIndicator';
import './i18n/config';

// Lazy load layouts and pages
const DashboardLayout = lazy(() => import('./layouts/DashboardLayout'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Login = lazy(() => import('./pages/Login'));
const SignUp = lazy(() => import('./pages/SignUp'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const StudentsLayout = lazy(() => import('./pages/students/StudentsLayout'));
const Parents = lazy(() => import('./pages/Parents'));
const Staff = lazy(() => import('./pages/Staff'));
const StaffDigitalIDCards = lazy(() => import('./pages/staff/StaffDigitalIDCards'));
const StaffUserAccounts = lazy(() => import('./pages/staff/StaffUserAccounts'));
const StaffDetailPage = lazy(() => import('./pages/staff/StaffDetailPage'));
const ClassesLayout = lazy(() => import('./pages/classes/ClassesLayout'));
const FeesLayout = lazy(() => import('./pages/fees/FeesLayout'));
const ExpensesLayout = lazy(() => import('./pages/expenses/ExpensesLayout'));
const AttendanceLayout = lazy(() => import('./pages/attendance/AttendanceLayout'));
const ResultLayout = lazy(() => import('./pages/result/ResultLayout'));
const Settings = lazy(() => import('./pages/Settings'));
const CredentialDispatch = lazy(() => import('./pages/credentials/CredentialDispatch'));
const Evaluation = lazy(() => import('./pages/Evaluation'));
const Communication = lazy(() => import('./pages/Communication'));
const Timetable = lazy(() => import('./pages/Timetable'));
const Inventory = lazy(() => import('./pages/Inventory'));
const StationaryManagement = lazy(() => import('./pages/StationaryManagement'));
const Complaints = lazy(() => import('./pages/Complaints'));
const LeaveLayout = lazy(() => import('./pages/leave/LeaveLayout'));
const TeacherDiary = lazy(() => import('./pages/diary/TeacherDiary'));
const PayrollLayout = lazy(() => import('./pages/payroll/PayrollLayout'));
const AccountingLayout = lazy(() => import('./pages/accounting/AccountingLayout'));
const LibraryLayout = lazy(() => import('./pages/library/LibraryLayout'));
const FrontDeskLayout = lazy(() => import('./pages/frontdesk/FrontDeskLayout'));
const FamilyGroups = lazy(() => import('./pages/family/FamilyGroups'));
const CleanupDuplicates = lazy(() => import('./pages/family/CleanupDuplicates'));
const ParentPortal = lazy(() => import('./pages/ParentPortal'));
const StudentPortal = lazy(() => import('./pages/StudentPortal'));
const ReportsLayout = lazy(() => import('./pages/reports/ReportsLayout'));
const PermissionManager = lazy(() => import('./pages/settings/PermissionManagerPage'));
const Trashbin = lazy(() => import('./pages/settings/Trashbin'));
const IDCardSettings = lazy(() => import('./pages/settings/IDCardSettings'));
const ReportCardSettings = lazy(() => import('./pages/settings/ReportCardSettings'));
const TeacherDashboard = lazy(() => import('./pages/TeacherDashboard'));
const AccountantDashboard = lazy(() => import('./pages/AccountantDashboard'));
const PrincipalDashboard = lazy(() => import('./pages/PrincipalDashboard'));
const HelpSupport = lazy(() => import('./pages/HelpSupport'));
const TransportLayout = lazy(() => import('./pages/transport/TransportLayout'));

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, loading, roleNotFound, signOut } = useAuth();

  if (loading) {
    return <LoadingIndicator />;
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  // User is authenticated but has no user_roles row — show a clear error
  // instead of redirecting to /login (which causes an infinite loop + 429s)
  if (roleNotFound) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Account Not Configured</h2>
          <p className="text-gray-500 mb-1">
            You are signed in, but your account has not been assigned a role yet.
          </p>
          <p className="text-gray-500 mb-6 text-sm">
            Please contact your school administrator to activate your account.
          </p>
          <p className="text-xs text-gray-400 mb-6 font-mono bg-gray-50 rounded p-2 break-all">
            User ID: {session.user.id}
          </p>
          <button
            onClick={() => signOut()}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-lg transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Suspense fallback={<LoadingIndicator />}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<SignUp />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/parent-portal" element={<ParentPortal />} />
              <Route path="/student-portal" element={<StudentPortal />} />
              <Route path="/" element={
                <ProtectedRoute>
                  <DashboardLayout />
                </ProtectedRoute>
              }>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="teacher-dashboard" element={<TeacherDashboard />} />
                <Route path="accountant-dashboard" element={<AccountantDashboard />} />
                <Route path="principal-dashboard" element={<PrincipalDashboard />} />
                <Route path="students/*" element={<StudentsLayout />} />
                <Route path="parents" element={<Parents />} />
                <Route path="staff" element={<Staff />} />
                <Route path="staff/detail/:id" element={<StaffDetailPage />} />
                <Route path="staff/id-cards" element={<StaffDigitalIDCards />} />
                <Route path="staff/accounts" element={<StaffUserAccounts />} />
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
                <Route path="stationary" element={<StationaryManagement />} />
                <Route path="complaints" element={<Complaints />} />
                <Route path="ai-assistant" element={<Navigate to="/dashboard" replace />} />
                <Route path="leave/*" element={<LeaveLayout />} />
                <Route path="diary" element={<TeacherDiary />} />
                <Route path="settings" element={<Settings />} />
                <Route path="payroll/*" element={<PayrollLayout />} />
                <Route path="accounting/*" element={<AccountingLayout />} />
                <Route path="library/*" element={<LibraryLayout />} />
                <Route path="frontdesk/*" element={<FrontDeskLayout />} />
                <Route path="reports/*" element={<ReportsLayout />} />
                <Route path="family" element={<FamilyGroups />} />
                <Route path="family/cleanup" element={<CleanupDuplicates />} />
                <Route path="settings/permissions" element={<PermissionManager />} />
                <Route path="settings/id-cards" element={<IDCardSettings />} />
                <Route path="settings/report-cards" element={<ReportCardSettings />} />
                <Route path="settings/trashbin" element={<Trashbin />} />
                <Route path="transport/*" element={<TransportLayout />} />
                <Route path="help-support" element={<HelpSupport />} />
              </Route>
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
