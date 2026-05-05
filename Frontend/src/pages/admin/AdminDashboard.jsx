import React, { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Exam, ExamSession, User } from "@/entities/all";
import "./AdminDashboard.css";
import ExamCredentialsManager from "@/components/admin/ExamCredentialsManager";
import { Card, CardContent, CardHeader, CardTitle, Badge, Button, Tabs, TabsContent, TabsList, TabsTrigger, Container } from "@/components/ui";
import { 
  Shield, 
  Users, 
  BookOpen, 
  Activity, 
  AlertTriangle,
  Eye,
  Settings,
  BarChart3,
  Video,
  Clock,
  CheckCircle,
  UserCheck,
  Calendar,
  Plus,
  Search
} from "lucide-react";

export default function AdminDashboardPage() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState({
    totalExams: 0,
    activeExams: 0,
    totalStudents: 0,
    verifiedStudents: 0,
    activeSessions: 0,
    flaggedSessions: 0,
    recentViolations: [],
    averageScore: 0,
    recentScores: []
  });
  const loadDashboardData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [exams, sessions, users] = await Promise.all([
        Exam.list(),
        ExamSession.list(),
        User.list()
      ]);

      const now = new Date();
      const activeExams = exams.filter(exam => 
        new Date(exam.start_time) <= now && new Date(exam.end_time) >= now
      ).length;

      const students = users.filter(user => user.role === 'student');
      const verifiedStudents = students.filter(user => user.verification_status === 'verified').length;
      const activeSessions = sessions.filter(session => session.status === 'in_progress').length;
      const flaggedSessions = sessions.filter(session => session.status === 'flagged').length;
      const scoredSessions = sessions.filter(session => typeof session.score === 'number');
      const averageScore = scoredSessions.length
        ? Math.round(scoredSessions.reduce((sum, session) => sum + session.score, 0) / scoredSessions.length)
        : 0;

      setDashboardData({
        totalExams: exams.length,
        activeExams,
        totalStudents: students.length,
        verifiedStudents,
        activeSessions,
        flaggedSessions,
        recentViolations: sessions.filter(s => s.proctoring_data?.flags?.length > 0).slice(0, 5),
        averageScore,
        recentScores: scoredSessions.slice(0, 5)
      });
    } catch (error) {
      console.error("Error loading dashboard data:", error);
    }
    setIsLoading(false);
  }, []);

  const checkAuthAndLoadData = useCallback(async () => {
    const authStatus = localStorage.getItem('proctorguard_auth') === 'verified';
    const userRole = localStorage.getItem('proctorguard_role');

    if (!authStatus || userRole !== 'admin') {
      navigate(createPageUrl("Verification"));
      return;
    }

    await loadDashboardData();
  }, [loadDashboardData, navigate]);

  useEffect(() => {
    const t = setTimeout(() => checkAuthAndLoadData(), 0);
    return () => clearTimeout(t);
  }, [checkAuthAndLoadData]);

  if (isLoading) {
    return (
      <div className="admin-dashboard loading-state">
        <div className="loading-content">
          <Shield className="loading-icon" />
          <p>Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      <Container className="dashboard-container">
        {/* Header */}
        <div className="dashboard-header">
          <div className="dashboard-header-content">
            <div>
              <h1 className="dashboard-title">ProctorGuard Admin</h1>
              <p className="dashboard-subtitle">Comprehensive Examination Monitoring & Control System</p>
              <div className="dashboard-status">
                <div className="status-item">
                  <div className="status-indicator"></div>
                  <span>System Online</span>
                </div>
                <div className="status-item">
                  <Shield className="status-icon" />
                  <span>Secure Monitoring Active</span>
                </div>
              </div>
            </div>
            <div className="dashboard-header-icon">
              <Shield className="w-16 h-16" />
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="dashboard-stats">
          <div className="stat-card stat-card-blue">
            <div className="stat-content">
              <p className="stat-label">Total Exams</p>
              <p className="stat-value">{dashboardData.totalExams}</p>
            </div>
            <BookOpen className="stat-icon" />
          </div>

          <div className="stat-card stat-card-green">
            <div className="stat-content">
              <p className="stat-label">Active Exams</p>
              <p className="stat-value">{dashboardData.activeExams}</p>
            </div>
            <Activity className="stat-icon" />
          </div>

          <div className="stat-card stat-card-purple">
            <div className="stat-content">
              <p className="stat-label">Total Students</p>
              <p className="stat-value">{dashboardData.totalStudents}</p>
            </div>
            <Users className="stat-icon" />
          </div>

          <div className="stat-card stat-card-orange">
            <div className="stat-content">
              <p className="stat-label">Verified Students</p>
              <p className="stat-value">{dashboardData.verifiedStudents}</p>
            </div>
            <UserCheck className="stat-icon" />
          </div>

          <div className="stat-card stat-card-cyan">
            <div className="stat-content">
              <p className="stat-label">Live Sessions</p>
              <p className="stat-value">{dashboardData.activeSessions}</p>
            </div>
            <Video className="stat-icon" />
          </div>

          <div className="stat-card stat-card-red">
            <div className="stat-content">
              <p className="stat-label">Flagged Sessions</p>
              <p className="stat-value">{dashboardData.flaggedSessions}</p>
            </div>
            <AlertTriangle className="stat-icon" />
          </div>

          <div className="stat-card stat-card-indigo">
            <div className="stat-content">
              <p className="stat-label">Average Score</p>
              <p className="stat-value">{dashboardData.averageScore}%</p>
            </div>
            <BarChart3 className="stat-icon" />
          </div>
        </div>

        {/* Quick Actions */}
        <div className="dashboard-actions">
          <Link to={createPageUrl("AdminStudents")}>
            <div className="action-card">
              <Users className="action-card-icon" />
              <h3 className="action-card-title">Manage Students</h3>
              <p className="action-card-desc">Verify identities, update statuses</p>
            </div>
          </Link>

          <Link to={createPageUrl("AdminExams")}>
            <div className="action-card">
              <BookOpen className="action-card-icon" />
              <h3 className="action-card-title">Create Exams</h3>
              <p className="action-card-desc">Configure timing, rules, settings</p>
            </div>
          </Link>

          <Link to={createPageUrl("AdminMonitoring")}>
            <div className="action-card">
              <Video className="action-card-icon" />
              <h3 className="action-card-title">Live Monitoring</h3>
              <p className="action-card-desc">Real-time proctoring panel</p>
            </div>
          </Link>

          <Link to={createPageUrl("AdminReports")}>
            <div className="action-card">
              <BarChart3 className="action-card-icon" />
              <h3 className="action-card-title">Reports & Analytics</h3>
              <p className="action-card-desc">Performance, violations, insights</p>
            </div>
          </Link>
        </div>

        {/* Exam Credentials Manager */}
        <ExamCredentialsManager />

        {/* Recent Activity & Alerts */}
        <div className="dashboard-section">
          {/* Recent Violations */}
          <div className="dashboard-card">
            <div className="dashboard-card-header">
              <h3 className="dashboard-card-title">
                <AlertTriangle className="w-5 h-5" />
                Recent Violations
              </h3>
            </div>
            <div className="dashboard-card-content">
              {dashboardData.recentViolations.length === 0 ? (
                <div className="empty-state">
                  <CheckCircle className="w-12 h-12" />
                  <p>No recent violations detected</p>
                </div>
              ) : (
                <div className="violation-list">
                  {dashboardData.recentViolations.map((session, index) => (
                    <div key={index} className="violation-item">
                      <div>
                        <p className="violation-title">Session #{session.id?.slice(-6)}</p>
                        <p className="violation-reason">{session.proctoring_data?.flags?.[0]?.reason}</p>
                      </div>
                      <div className="violation-badge">High</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Recent Scores */}
          <div className="dashboard-card">
            <div className="dashboard-card-header">
              <h3 className="dashboard-card-title">
                <BarChart3 className="w-5 h-5" />
                Recent Scores
              </h3>
            </div>
            <div className="dashboard-card-content">
              {dashboardData.recentScores.length === 0 ? (
                <div className="empty-state">
                  <CheckCircle className="w-12 h-12" />
                  <p>No scores submitted yet</p>
                </div>
              ) : (
                <div className="violation-list">
                  {dashboardData.recentScores.map((session, index) => (
                    <div key={index} className="violation-item">
                      <div>
                        <p className="violation-title">Session #{session.id?.slice(-6)}</p>
                        <p className="violation-reason">Score: {session.score}%</p>
                      </div>
                      <div className="violation-badge">{session.score}%</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* System Status */}
          <div className="dashboard-card">
            <div className="dashboard-card-header">
              <h3 className="dashboard-card-title">
                <Activity className="w-5 h-5" />
                System Status
              </h3>
            </div>
            <div className="dashboard-card-content">
              <div className="status-check">
                <div className="status-indicator-circle"></div>
                <span className="status-text">Monitoring Service</span>
                <div className="status-badge">Online</div>
              </div>
              
              <div className="status-check">
                <div className="status-indicator-circle"></div>
                <span className="status-text">AI Detection</span>
                <div className="status-badge">Active</div>
              </div>
              
              <div className="status-check">
                <div className="status-indicator-circle"></div>
                <span className="status-text">Video Storage</span>
                <div className="status-badge">85% Available</div>
              </div>
              
              <div className="status-check">
                <div className="status-indicator-circle"></div>
                <span className="status-text">Encryption Service</span>
                <div className="status-badge">Secure</div>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </div>
  );
}