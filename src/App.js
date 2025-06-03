import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/auth/Login';
import Register from './components/auth/Register';
import ForgotPassword from './components/auth/ForgotPassword';
import ProfessorDashboard from './components/professor/Dashboard';
import StudentDashboard from './components/student/Dashboard';
import IntroScreen from './components/IntroScreen';
import './styles/auth.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<IntroScreen role="estudiante" />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/professor/dashboard" element={<ProfessorDashboard />} />
        <Route path="/student/dashboard" element={<StudentDashboard />} />
      </Routes>
    </Router>
  );
}

export default App; 