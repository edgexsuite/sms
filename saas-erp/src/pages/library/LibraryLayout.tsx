import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import LibraryCatalog from './LibraryCatalog';
import LibraryIssues from './LibraryIssues';
import LibraryMembers from './LibraryMembers';

export default function LibraryLayout() {
  return (
    <Routes>
      <Route path="/" element={<LibraryCatalog />} />
      <Route path="catalog" element={<LibraryCatalog />} />
      <Route path="issues" element={<LibraryIssues />} />
      <Route path="members" element={<LibraryMembers />} />
      <Route path="*" element={<Navigate to="/library/catalog" replace />} />
    </Routes>
  );
}
