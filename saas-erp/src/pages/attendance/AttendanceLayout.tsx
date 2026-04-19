import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import MarkAttendance from './MarkAttendance';
import MonthlyReport from './MonthlyReport';
import AbsentStudentList from './AbsentStudentList';
import DailyReport from './DailyReport';
import SessionalReport from './SessionalReport';
import SMSHistory from './SMSHistory';
import QRScanner from './QRScanner';
import QRAttendanceCards from './QRAttendanceCards';
import StaffAttendance from './StaffAttendance';
import StaffAttendanceReport from './StaffAttendanceReport';

export default function AttendanceLayout() {
  return (
    <Routes>
      <Route path="/" element={<MarkAttendance />} />
      <Route path="monthly-report" element={<MonthlyReport />} />
      <Route path="absent-list" element={<AbsentStudentList />} />
      <Route path="daily-report" element={<DailyReport />} />
      <Route path="sessional-report" element={<SessionalReport />} />
      <Route path="sms-history" element={<SMSHistory />} />
      <Route path="scanner" element={<QRScanner />} />
      <Route path="qr-cards" element={<QRAttendanceCards />} />
      <Route path="staff" element={<StaffAttendance />} />
      <Route path="staff-report" element={<StaffAttendanceReport />} />
      <Route path="*" element={<Navigate to="/attendance" replace />} />
    </Routes>
  );
}
