import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ChartOfAccounts from './ChartOfAccounts';
import JournalEntry from './JournalEntry';
import TrialBalance from './TrialBalance';
import BalanceSheet from './BalanceSheet';

export default function AccountingLayout() {
  return (
    <Routes>
      <Route path="/" element={<JournalEntry />} />
      <Route path="chart-of-accounts" element={<ChartOfAccounts />} />
      <Route path="journal" element={<JournalEntry />} />
      <Route path="trial-balance" element={<TrialBalance />} />
      <Route path="balance-sheet" element={<BalanceSheet />} />
      <Route path="*" element={<Navigate to="/accounting/journal" replace />} />
    </Routes>
  );
}
