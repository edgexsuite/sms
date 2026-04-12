import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// Import sub-pages 
import StudentList from './StudentList';
import RegisterStudent from './RegisterStudent';
import BulkEnrollment from './BulkEnrollment';
import PromoteStudents from './PromoteStudents';
import DigitalIDCards from './DigitalIDCards';
import StudentReports from './StudentReports';
import CustomizeForm from './CustomizeForm';
import ParentSMSHistory from './ParentSMSHistory';
import ProgressReport from './ProgressReport';
import LeavingCertificate from './LeavingCertificate';
import BirthCertificate from './BirthCertificate';
import CharacterCertificate from './CharacterCertificate';
import AdmissionForm from './AdmissionForm';

export default function StudentsLayout() {
  // Now simply acts as a router wrapper, navigation is handled by main DashboardLayout
  return (
    <Routes>
      <Route path="/" element={<StudentList />} />
      <Route path="register" element={<RegisterStudent />} />
      <Route path="bulk-enrollment" element={<BulkEnrollment />} />
      <Route path="promote" element={<PromoteStudents />} />
      <Route path="id-cards" element={<DigitalIDCards />} />
      <Route path="reports" element={<StudentReports />} />
      <Route path="customize-form" element={<CustomizeForm />} />
      <Route path="parent-sms-history" element={<ParentSMSHistory />} />
      <Route path="progress-report" element={<ProgressReport />} />
      <Route path="leaving-certificate" element={<LeavingCertificate />} />
      <Route path="birth-certificate" element={<BirthCertificate />} />
      <Route path="character-certificate" element={<CharacterCertificate />} />
      <Route path="admission-form" element={<AdmissionForm />} />
      <Route path="*" element={<Navigate to="/students" replace />} />
    </Routes>
  );
}
