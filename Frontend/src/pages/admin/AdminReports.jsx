import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Exam, ExamSession } from "@/entities/all";
import "./AdminReports.css";
import { Card, CardContent, CardHeader, CardTitle, Button } from "@/components/ui";
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  FileText, 
  Download,
  Calendar,
  Award,
  AlertTriangle,
  Activity
} from "lucide-react";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function AdminReportsPage() {
  const navigate = useNavigate();
  const [exams, setExams] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [_isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    totalExams: 0,
    totalStudents: 0,
    averageScore: 0,
    completionRate: 0,
    flaggedSessions: 0
  });
  const [participationTrends, setParticipationTrends] = useState([]);
  const [scoreDistribution, setScoreDistribution] = useState([]);
  const [examPerformance, setExamPerformance] = useState([]);

  const loadReportsData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [examsData, sessionsData] = await Promise.all([
        Exam.list(),
        ExamSession.list()
      ]);

      setExams(examsData);
      setSessions(sessionsData);

      // Calculate statistics
      const uniqueStudents = new Set(sessionsData.map(s => s.student_id)).size;
      const completedSessions = sessionsData.filter(s => s.status === 'completed' || s.status === 'flagged');
      const totalScore = completedSessions.reduce((sum, s) => sum + (s.score || 0), 0);
      const averageScore = completedSessions.length > 0 ? Math.round(totalScore / completedSessions.length) : 0;
      const flaggedCount = sessionsData.filter(s => s.status === 'flagged').length;
      const completionRate = examsData.length > 0 ? Math.round((completedSessions.length / sessionsData.length) * 100) : 0;

      setStats({
        totalExams: examsData.length,
        totalStudents: uniqueStudents,
        averageScore,
        completionRate,
        flaggedSessions: flaggedCount
      });

      // Participation Trends (last 7 days)
      const trends = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const count = sessionsData.filter(s => {
          const sessionDate = new Date(s.start_time);
          return sessionDate.toDateString() === date.toDateString();
        }).length;
        trends.push({ date: dateStr, participants: count });
      }
      setParticipationTrends(trends);

      // Score Distribution
      const distribution = [
        { range: '0-20', count: completedSessions.filter(s => s.score >= 0 && s.score < 20).length },
        { range: '20-40', count: completedSessions.filter(s => s.score >= 20 && s.score < 40).length },
        { range: '40-60', count: completedSessions.filter(s => s.score >= 40 && s.score < 60).length },
        { range: '60-80', count: completedSessions.filter(s => s.score >= 60 && s.score < 80).length },
        { range: '80-100', count: completedSessions.filter(s => s.score >= 80 && s.score <= 100).length }
      ];
      setScoreDistribution(distribution);

      // Exam Performance
      const examPerf = examsData.map(exam => {
        const examSessions = sessionsData.filter(s => s.exam_id === exam.id && s.score != null);
        const avgScore = examSessions.length > 0
          ? Math.round(examSessions.reduce((sum, s) => sum + s.score, 0) / examSessions.length)
          : 0;
        return {
          name: exam.title.slice(0, 20),
          score: avgScore,
          participants: examSessions.length
        };
      });
      setExamPerformance(examPerf);

    } catch (error) {
      console.error("Error loading reports data:", error);
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
    
    await loadReportsData();
  }, [navigate, loadReportsData]);

  useEffect(() => {
    const t = setTimeout(() => checkAuthAndLoadData(), 0);
    return () => clearTimeout(t);
  }, [checkAuthAndLoadData]);

  const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];

  return (
    <div className="admin-reports">
      <div className="reports-container">
        {/* Header */}
        <div className="reports-header">
          <div>
            <h1>
              <BarChart3 className="w-8 h-8" />
              Analytics & Reports
            </h1>
            <p>Comprehensive examination insights and performance metrics</p>
          </div>
          <div className="reports-header-actions">
            <Button variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Export Report
            </Button>
            <Button onClick={() => navigate(createPageUrl("AdminDashboard"))} variant="outline">
              Back to Dashboard
            </Button>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="reports-stats-grid">
          <Card className="report-stat-card report-stat-blue">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <FileText className="w-8 h-8 opacity-80" />
                <TrendingUp className="w-5 h-5" />
              </div>
              <p className="text-3xl font-bold">{stats.totalExams}</p>
              <p className="text-blue-100 text-sm">Total Exams</p>
            </CardContent>
          </Card>

          <Card className="report-stat-card report-stat-purple">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <Users className="w-8 h-8 opacity-80" />
                <Activity className="w-5 h-5" />
              </div>
              <p className="text-3xl font-bold">{stats.totalStudents}</p>
              <p className="text-purple-100 text-sm">Active Students</p>
            </CardContent>
          </Card>

          <Card className="report-stat-card report-stat-green">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <Award className="w-8 h-8 opacity-80" />
                <TrendingUp className="w-5 h-5" />
              </div>
              <p className="text-3xl font-bold">{stats.averageScore}%</p>
              <p className="text-green-100 text-sm">Average Score</p>
            </CardContent>
          </Card>

          <Card className="report-stat-card report-stat-amber">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <Calendar className="w-8 h-8 opacity-80" />
                <Activity className="w-5 h-5" />
              </div>
              <p className="text-3xl font-bold">{stats.completionRate}%</p>
              <p className="text-amber-100 text-sm">Completion Rate</p>
            </CardContent>
          </Card>

          <Card className="report-stat-card report-stat-red">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <AlertTriangle className="w-8 h-8 opacity-80" />
                <Activity className="w-5 h-5" />
              </div>
              <p className="text-3xl font-bold">{stats.flaggedSessions}</p>
              <p className="text-red-100 text-sm">Flagged Sessions</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Participation Trends */}
          <Card className="border-0 bg-white/80 backdrop-blur-sm shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-indigo-600" />
                Participation Trends (Last 7 Days)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={participationTrends}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" stroke="#64748b" />
                  <YAxis stroke="#64748b" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="participants" stroke="#6366f1" strokeWidth={3} dot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Score Distribution */}
          <Card className="border-0 bg-white/80 backdrop-blur-sm shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-purple-600" />
                Score Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={scoreDistribution}
                    dataKey="count"
                    nameKey="range"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label
                  >
                    {scoreDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Exam Performance */}
          <Card className="border-0 bg-white/80 backdrop-blur-sm shadow-lg lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="w-5 h-5 text-green-600" />
                Exam Performance Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={examPerformance}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" stroke="#64748b" />
                  <YAxis stroke="#64748b" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                  />
                  <Legend />
                  <Bar dataKey="score" fill="#10b981" name="Average Score" />
                  <Bar dataKey="participants" fill="#6366f1" name="Participants" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <Card className="border-0 bg-white/80 backdrop-blur-sm shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-600" />
              Recent Exam Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {sessions.slice(0, 5).map((session) => (
                <div key={session.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${
                      session.status === 'completed' ? 'bg-green-500' : 
                      session.status === 'flagged' ? 'bg-red-500' : 'bg-blue-500'
                    }`}>
                      {session.student_id?.slice(-3)}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">Student {session.student_id}</p>
                      <p className="text-sm text-slate-600">
                        {exams.find(e => e.id === session.exam_id)?.title || 'Unknown Exam'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-slate-900">{session.score || 0}%</p>
                    <p className="text-xs text-slate-500">{new Date(session.start_time).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}