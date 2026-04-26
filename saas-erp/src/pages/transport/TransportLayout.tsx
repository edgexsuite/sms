import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import TransportDashboard from './TransportDashboard';
import Routes_ from './Routes';
import Vehicles from './Vehicles';
import StudentTransport from './StudentTransport';

export default function TransportLayout() {
  return (
    <Routes>
      <Route path="/" element={<TransportDashboard />} />
      <Route path="routes" element={<Routes_ />} />
      <Route path="vehicles" element={<Vehicles />} />
      <Route path="students" element={<StudentTransport />} />
      <Route path="*" element={<Navigate to="/transport" replace />} />
    </Routes>
  );
}
