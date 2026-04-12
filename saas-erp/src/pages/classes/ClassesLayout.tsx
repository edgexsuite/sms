import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import ClassSectionManagement from './ClassSectionManagement';
import SubjectManagement from './SubjectManagement';

export default function ClassesLayout() {
  return (
    <Routes>
      <Route path="/" element={<ClassSectionManagement />} />
      <Route path="manage" element={<ClassSectionManagement />} />
      <Route path="subjects" element={<SubjectManagement />} />
      <Route path="*" element={<Navigate to="/classes/manage" replace />} />
    </Routes>
  );
}
