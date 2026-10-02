import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import MarkAttendance from './MarkAttendance';
import MonthlyReport from './MonthlyReport';
import AbsentStudentList from './AbsentStudentList';
import DailyReport from './DailyReport';
import SessionalReport from './SessionalReport';
import SMSHistory from './SMSHistory';
import QRScanner from './QRScanner';
import DigitalAttendanceHub from './DigitalAttendanceHub';
import StaffAttendance from './StaffAttendance';
import StaffAttendanceReport from './StaffAttendanceReport';
import StaffDailyReport from './StaffDailyReport';

export default function AttendanceLayout() {
  return (
    <Routes>
      <Route path="/" element={<MarkAttendance />} />
      <Route path="monthly-report" element={<MonthlyReport />} />
      <Route path="absent-list" element={<AbsentStudentList />} />
      <Route path="daily-report" element={<DailyReport />} />
      <Route path="sessional-report" element={<SessionalReport />} />
      <Route path="sms-history" element={<SMSHistory />} />
      <Route path="scanner" element={<DigitalAttendanceHub />} />
      <Route path="qr" element={<DigitalAttendanceHub />} />
      <Route path="badges" element={<DigitalAttendanceHub />} />
      <Route path="auto" element={<DigitalAttendanceHub />} />
      <Route path="staff" element={<StaffAttendance />} />
      <Route path="staff-report" element={<StaffAttendanceReport />} />
      <Route path="staff-daily" element={<StaffDailyReport />} />
      <Route path="*" element={<Navigate to="/attendance" replace />} />
    </Routes>
  );
}
