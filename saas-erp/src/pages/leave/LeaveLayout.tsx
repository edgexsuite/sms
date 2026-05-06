import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import StudentLeave from './StudentLeave';
import StaffLeave from './StaffLeave';
import SubstituteFixture from './SubstituteFixture';

export default function LeaveLayout() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/leave/student" replace />} />
      <Route path="student" element={<StudentLeave />} />
      <Route path="staff" element={<StaffLeave />} />
      <Route path="fixture" element={<SubstituteFixture />} />
      <Route path="*" element={<Navigate to="/leave/student" replace />} />
    </Routes>
  );
}
