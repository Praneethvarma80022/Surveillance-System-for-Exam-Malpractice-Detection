import React, { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { format, isAfter, isBefore } from "date-fns";
import { 
  BookOpen, Clock, CheckCircle, Calendar, Play, 
  Eye, Award, Shield 
} from "lucide-react";
import "./Dashboard.css";
import { createPageUrl } from "@/utils";
import { Exam, ExamSession } from "@/entities/all";
import { Card, CardContent, CardHeader, CardTitle, Badge, Button, Tabs, TabsContent, TabsList, TabsTrigger, Container, Grid } from "@/components/ui";

export default function DashboardPage() {
  const navigate = useNavigate();
  const [exams, setExams] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Memoized data loading function
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [examData, sessionData] = await Promise.all([
        Exam.list(),
        ExamSession.list()
      ]);
      const assignedExamId = localStorage.getItem('proctorguard_exam_id');
      const filteredExams = assignedExamId
        ? (examData || []).filter(exam => exam.id === assignedExamId)
        : (examData || []);
      setExams(filteredExams);
      setSessions(sessionData || []);
    } catch (error) {
      console.error("Error loading dashboard data:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Memoized auth check function
  const checkAuthAndLoadData = useCallback(async () => {
    const authStatus = localStorage.getItem('proctorguard_auth') === 'verified';
    
    if (!authStatus) {
      navigate(createPageUrl("Verification"));
      return;
    }
    
    setIsAuthenticated(true);
    await loadData();
  }, [navigate, loadData]);

  // Unified Effect
  useEffect(() => {
    checkAuthAndLoadData();
  }, [checkAuthAndLoadData]);

  const categorizeExams = () => {
    const now = new Date();
    const toBeStarted = exams.filter(exam => {
      const session = (sessions || []).find(s => s.exam_id === exam.id);
      
      // If exam has start_time and end_time, use them for scheduling
      if (exam.start_time && exam.end_time) {
        const startTime = new Date(exam.start_time);
        const endTime = new Date(exam.end_time);
        
        const isActive = isAfter(now, startTime) && isBefore(now, endTime);
        const isNotDone = !session || (session.status !== 'completed' && session.status !== 'flagged');
        
        return isActive && isNotDone;
      }
      
      // If no scheduling, show as available if not completed
      const isNotDone = !session || (session.status !== 'completed' && session.status !== 'flagged');
      return isNotDone;
    });

    const upcoming = exams.filter(exam => {
      if (!exam.start_time) return false;
      return isBefore(now, new Date(exam.start_time));
    });

    const completed = exams.filter(exam => {
      const session = (sessions || []).find(s => s.exam_id === exam.id);
      return session && (session.status === 'completed' || session.status === 'flagged');
    });

    return { toBeStarted, upcoming, completed };
  };

  const getExamStatus = (exam) => {
    const now = new Date();
    const session = (sessions || []).find(s => s.exam_id === exam.id);
    
    if (session?.status === 'completed') return { label: 'Completed', color: 'bg-green-100 text-green-800' };
    if (session?.status === 'in_progress') return { label: 'In Progress', color: 'bg-blue-100 text-blue-800' };
    if (session?.status === 'flagged') return { label: 'Under Review', color: 'bg-red-100 text-red-800' };
    
    // Check if exam has scheduling
    if (exam.end_time && isAfter(now, new Date(exam.end_time))) {
      return { label: 'Expired', color: 'bg-gray-100 text-gray-800' };
    }
    if (exam.start_time && isAfter(now, new Date(exam.start_time))) {
      return { label: 'Available', color: 'bg-emerald-100 text-emerald-800' };
    }
    if (exam.start_time && isBefore(now, new Date(exam.start_time))) {
      return { label: 'Upcoming', color: 'bg-amber-100 text-amber-800' };
    }
    
    // No scheduling - always available
    return { label: 'Available', color: 'bg-emerald-100 text-emerald-800' };
  };

  const ExamCard = ({ exam, actionButton }) => {
    const status = getExamStatus(exam);
    const session = (sessions || []).find(s => s.exam_id === exam.id);

    return (
      <div className="exam-card">
        <div className="exam-card-header">
          <div className="exam-card-title-section">
            <h3 className="exam-card-title">
              {exam.title}
            </h3>
            <span className={`exam-card-badge exam-badge-${status.label.toLowerCase().replace(' ', '-')}`}>
              {status.label}
            </span>
          </div>
          <p className="exam-card-desc">{exam.description}</p>
        </div>
        <div className="exam-card-content">
          <div className="exam-card-info">
            <div className="exam-info-item">
              <Calendar className="exam-icon" />
              <span>{format(new Date(exam.start_time), 'MMM d, yyyy')}</span>
            </div>
            <div className="exam-info-item">
              <Clock className="exam-icon" />
              <span>{exam.duration_minutes} min</span>
            </div>
            <div className="exam-info-item">
              <Award className="exam-icon" />
              <span>{exam.total_points || 100} pts</span>
            </div>
            {session?.score !== undefined && (
              <div className="exam-info-item exam-info-score">
                <CheckCircle className="exam-icon" />
                <span>Score: {session.score}%</span>
              </div>
            )}
          </div>
          {actionButton}
        </div>
      </div>
    );
  };

  if (!isAuthenticated || isLoading) {
    return (
      <div className="student-dashboard loading-state">
        <div className="loading-content">
          <Shield className={`${isLoading ? 'animate-spin' : 'animate-pulse'}`} />
          <p>{isLoading ? "Loading exams..." : "Verifying session..."}</p>
        </div>
      </div>
    );
  }

  const { toBeStarted, upcoming, completed } = categorizeExams();

  return (
    <div className="student-dashboard">
      <Container className="dashboard-container">
        {/* Welcome Banner */}
        <div className="dashboard-header">
          <div>
            <h1 className="dashboard-title">ProctorGuard Dashboard</h1>
            <p className="dashboard-subtitle">Secure Student Portal</p>
          </div>
          <Shield className="dashboard-icon" />
        </div>

        {/* Stats Grid */}
        <div className="dashboard-stats">
          <StatCard title="Active" val={toBeStarted.length} icon={Play} />
          <StatCard title="Upcoming" val={upcoming.length} icon={Calendar} />
          <StatCard title="Done" val={completed.length} icon={CheckCircle} />
          <StatCard title="Total" val={exams.length} icon={BookOpen} />
        </div>

        <Tabs defaultValue="available" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 bg-white/50 backdrop-blur-md">
            <TabsTrigger value="available">Available ({toBeStarted.length})</TabsTrigger>
            <TabsTrigger value="upcoming">Upcoming ({upcoming.length})</TabsTrigger>
            <TabsTrigger value="completed">History ({completed.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="available">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {toBeStarted.map(exam => (
                <ExamCard 
                  key={exam.id} 
                  exam={exam} 
                  actionButton={
                    <Button 
                      onClick={() => navigate(createPageUrl(`SystemCheck?examId=${exam.id}`))}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      Enter Exam Room
                    </Button>
                  } 
                />
              ))}
              {toBeStarted.length === 0 && <EmptyState text="No exams currently available." icon={BookOpen} />}
            </div>
          </TabsContent>
          
          <TabsContent value="upcoming">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {upcoming.map(exam => (
                <ExamCard key={exam.id} exam={exam} actionButton={<Button disabled className="w-full">Locked until Start Time</Button>} />
              ))}
              {upcoming.length === 0 && <EmptyState text="No scheduled exams." icon={Calendar} />}
            </div>
          </TabsContent>

          <TabsContent value="completed">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {completed.map(exam => (
                <ExamCard key={exam.id} exam={exam} actionButton={<Button variant="outline" className="w-full">View Submission</Button>} />
              ))}
              {completed.length === 0 && <EmptyState text="No completed records found." icon={CheckCircle} />}
            </div>
          </TabsContent>
        </Tabs>
      </Container>
    </div>
  );
}

// Helper Components for Clarity
const StatCard = ({ title, val, icon }) => (
  <div className="stat-card">
    <div className="stat-content">
      <p className="stat-label">{title}</p>
      <p className="stat-value">{val}</p>
    </div>
    {icon && React.createElement(icon, { className: 'stat-icon' })}
  </div>
);

const EmptyState = ({ text, icon }) => (
  <div className="empty-state">
    {icon && React.createElement(icon, { className: 'empty-state-icon' })}
    <p>{text}</p>
  </div>
);