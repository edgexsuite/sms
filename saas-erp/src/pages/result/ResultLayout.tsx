import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import AddExamType from './AddExamType';
import AddExamSchedule from './AddExamSchedule';
import AddResult from './AddResult';
import ConsolidatedResult from './ConsolidatedResult';
import ResultReporting from './ResultReporting';
import ResultSetting from './ResultSetting';
import RollNumberSlips from './RollNumberSlips';
import ImportResult from './ImportResult';
import TeacherMarks from './TeacherMarks';
import GradingPolicy from './GradingPolicy';
import AwardListGenerator from './AwardListGenerator';
import ExamMarksConfig from './ExamMarksConfig';
import ResultStatus from './ResultStatus';
import TeacherWiseResult from './TeacherWiseResult';

export default function ResultLayout() {
  return (
    <Routes>
      <Route path="/" element={<AddExamType />} />
      <Route path="exam-types" element={<AddExamType />} />
      <Route path="schedule" element={<AddExamSchedule />} />
      <Route path="add-result" element={<TeacherMarks />} />
      <Route path="consolidated" element={<ConsolidatedResult />} />
      <Route path="reporting" element={<ResultReporting />} />
      <Route path="settings" element={<ResultSetting />} />
      <Route path="roll-slips" element={<RollNumberSlips />} />
      <Route path="import" element={<ImportResult />} />
      <Route path="grading-policy" element={<GradingPolicy />} />
      <Route path="teacher-marks" element={<TeacherMarks />} />
      <Route path="award-list" element={<AwardListGenerator />} />
      <Route path="teacher-wise" element={<TeacherWiseResult />} />
      <Route path="marks-config" element={<ExamMarksConfig />} />
      <Route path="status" element={<ResultStatus />} />
      <Route path="*" element={<Navigate to="/result/exam-types" replace />} />
    </Routes>
  );
}
