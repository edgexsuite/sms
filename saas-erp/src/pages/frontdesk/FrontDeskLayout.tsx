import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AdmissionInquiries from './AdmissionInquiries';
import VisitorBook from './VisitorBook';
import NoticeBoard from './NoticeBoard';

export default function FrontDeskLayout() {
  return (
    <Routes>
      <Route path="/" element={<AdmissionInquiries />} />
      <Route path="inquiries" element={<AdmissionInquiries />} />
      <Route path="visitors" element={<VisitorBook />} />
      <Route path="notices" element={<NoticeBoard />} />
      <Route path="*" element={<Navigate to="/frontdesk/inquiries" replace />} />
    </Routes>
  );
}
