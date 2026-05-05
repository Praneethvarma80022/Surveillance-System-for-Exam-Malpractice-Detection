import { HashRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Layout from "./Layout";
import VerificationPage from "./pages/student/Verification";
import DashboardPage from "./pages/student/Dashboard";
import SystemCheckPage from "./pages/student/SystemCheck";
import ExamPage from "./pages/student/Exam";
import ExamCompletePage from "./pages/student/ExamComplete";
import MobileCameraPage from "./pages/student/MobileCamera";
import CameraTestPage from "./pages/student/CameraTest";
import AdminDashboardPage from "./pages/admin/AdminDashboard";
import AdminStudentsPage from "./pages/admin/AdminStudents";
import AdminExamsPage from "./pages/admin/AdminExams";
import AdminMonitoringPage from "./pages/admin/AdminMonitoring";
import AdminReportsPage from "./pages/admin/AdminReports";
import './App.css';

export default function App() {
  return (
    <Router>
      <Routes>
        {/* Standalone Mobile Route (No Layout) */}
        <Route path="/MobileCamera" element={<MobileCameraPage />} />
        <Route path="/CameraTest" element={<CameraTestPage />} />

        {/* Auth Routes */}
        <Route path="/Verification" element={<VerificationPage />} />

        {/* Main Application Flow */}
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/Verification" />} />
          
          {/* Student Routes */}
          <Route path="Dashboard" element={<DashboardPage />} />
          <Route path="SystemCheck" element={<SystemCheckPage />} />
          <Route path="Exam" element={<ExamPage />} />
          <Route path="ExamComplete" element={<ExamCompletePage />} />
          
          {/* Admin Routes */}
          <Route path="AdminDashboard" element={<AdminDashboardPage />} />
          <Route path="AdminStudents" element={<AdminStudentsPage />} />
          <Route path="AdminExams" element={<AdminExamsPage />} />
          <Route path="AdminMonitoring" element={<AdminMonitoringPage />} />
          <Route path="AdminReports" element={<AdminReportsPage />} />
        </Route>
      </Routes>
    </Router>
  );
}