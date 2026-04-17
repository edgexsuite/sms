import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AdmissionInquiries from './AdmissionInquiries';
import VisitorBook from './VisitorBook';
import NoticeBoard from './NoticeBoard';
import AdmissionPipeline from './AdmissionPipeline';

export default function FrontDeskLayout() {
  return (
    <Routes>
      <Route path="/" element={<AdmissionPipeline />} />
      <Route path="pipeline" element={<AdmissionPipeline />} />
      <Route path="inquiries" element={<AdmissionInquiries />} />
      <Route path="visitors" element={<VisitorBook />} />
      <Route path="notices" element={<NoticeBoard />} />
      <Route path="*" element={<Navigate to="/frontdesk/pipeline" replace />} />
    </Routes>
  );
}
