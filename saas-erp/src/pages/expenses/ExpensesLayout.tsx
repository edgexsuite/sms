import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import AddDailyExpenses from './AddDailyExpenses';
import Ledger from './Ledger';
import ExpenseHeads from './ExpenseHeads';
import Budget from './Budget';
import ExpenseReports from './ExpenseReports';
import PaymentSources from './PaymentSources';
import ProfitLoss from './ProfitLoss';
import BulkExpenseImport from './BulkExpenseImport';

export default function ExpensesLayout() {
  return (
    <Routes>
      <Route path="/" element={<AddDailyExpenses />} />
      <Route path="add-daily" element={<AddDailyExpenses />} />
      <Route path="ledger" element={<Ledger />} />
      <Route path="heads" element={<ExpenseHeads />} />
      <Route path="budget" element={<Budget />} />
      <Route path="reports" element={<ExpenseReports />} />
      <Route path="payment-sources" element={<PaymentSources />} />
      <Route path="p-and-l" element={<ProfitLoss />} />
      <Route path="bulk-import" element={<BulkExpenseImport />} />
      <Route path="*" element={<Navigate to="/expenses/add-daily" replace />} />
    </Routes>
  );
}
