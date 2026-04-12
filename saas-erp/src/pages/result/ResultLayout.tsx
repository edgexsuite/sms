import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import AddExamType from './AddExamType';
import AddExamSchedule from './AddExamSchedule';
import AddResult from './AddResult';
import ConsolidatedResult from './ConsolidatedResult';
import ResultReporting from './ResultReporting';
import ResultSetting from './ResultSetting';
import RollNumberSlips from './RollNumberSlips';

export default function ResultLayout() {
  return (
    <Routes>
      <Route path="/" element={<AddExamType />} />
      <Route path="exam-types" element={<AddExamType />} />
      <Route path="schedule" element={<AddExamSchedule />} />
      <Route path="add-result" element={<AddResult />} />
      <Route path="consolidated" element={<ConsolidatedResult />} />
      <Route path="reporting" element={<ResultReporting />} />
      <Route path="settings" element={<ResultSetting />} />
      <Route path="roll-slips" element={<RollNumberSlips />} />
      <Route path="*" element={<Navigate to="/result/exam-types" replace />} />
    </Routes>
  );
}
