import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import FeeCriteria from './FeeCriteria';
import MonthlyFeeInvoices from './MonthlyFeeInvoices';
import StudentFeeDetail from './StudentFeeDetail';
import ChallanFormSettings from './ChallanFormSettings';
import FinePolicy from './FinePolicy';
import DiscountScholarship from './DiscountScholarship';
import AdvanceFee from './AdvanceFee';
import AverageFee from './AverageFee';
import FeeTemplates from './FeeTemplates';
import StudentFeeHistory from './StudentFeeHistory';
import EasyFee from './EasyFee';
import BulkDiscountEntry from './BulkDiscountEntry';
import BulkArrearsEntry from './BulkArrearsEntry';
import InvoiceReport from './InvoiceReport';

export default function FeesLayout() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/fees/invoices" replace />} />
      <Route path="criteria" element={<FeeCriteria />} />
      <Route path="invoices" element={<MonthlyFeeInvoices />} />
      <Route path="student-detail" element={<StudentFeeDetail />} />
      <Route path="challan-settings" element={<ChallanFormSettings />} />
      <Route path="fine-policy" element={<FinePolicy />} />
      <Route path="discounts" element={<DiscountScholarship />} />
      <Route path="advance-fee" element={<AdvanceFee />} />
      <Route path="average-fee" element={<AverageFee />} />
      <Route path="fee-templates" element={<FeeTemplates />} />
      <Route path="fee-history" element={<StudentFeeHistory />} />
      <Route path="easy-fee" element={<EasyFee />} />
      <Route path="bulk-discount" element={<BulkDiscountEntry />} />
      <Route path="bulk-arrears" element={<BulkArrearsEntry />} />
      <Route path="invoice-report" element={<InvoiceReport />} />
      <Route path="*" element={<Navigate to="/fees/invoices" replace />} />
    </Routes>
  );
}
