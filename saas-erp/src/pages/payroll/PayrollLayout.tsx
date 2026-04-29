import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Payroll from './Payroll';
import SalarySlips from './SalarySlips';
import Allowances from './Allowances';
import PayrollReports from './PayrollReports';
import StaffAdvance from './StaffAdvance';
import StaffLedger from './StaffLedger';

export default function PayrollLayout() {
  return (
    <Routes>
      <Route path="/"          element={<Payroll />} />
      <Route path="slips"      element={<SalarySlips />} />
      <Route path="allowances" element={<Allowances />} />
      <Route path="reports"    element={<PayrollReports />} />
      <Route path="advance"    element={<StaffAdvance />} />
      <Route path="ledger"     element={<StaffLedger />} />
      <Route path="*"          element={<Navigate to="/payroll" replace />} />
    </Routes>
  );
}
