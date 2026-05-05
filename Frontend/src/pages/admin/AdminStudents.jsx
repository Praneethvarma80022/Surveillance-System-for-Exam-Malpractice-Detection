import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { User, ExamSession, ExamCredential, Exam } from "@/entities/all";
import "./AdminStudents.css";
import { 
  Card, CardContent, CardHeader, CardTitle, 
  Button, Badge, Input, Dialog, DialogContent, DialogHeader, DialogTitle
} from "@/components/ui";
import { 
  Users, Search, UserCheck, UserX, Eye, 
  CheckCircle, XCircle, Clock, Award, AlertOctagon, ArrowLeft,
  User as UserIcon, Key, Lock, Unlock, RefreshCw
} from "lucide-react";

/** * Local UI Helpers to resolve "Not Defined" errors 
 */
const Container = ({ children, className = "" }) => (
  <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ${className}`}>{children}</div>
);

const Table = ({ children }) => (
  <div className="w-full overflow-x-auto rounded-lg border border-slate-200">
    <table className="w-full text-sm text-left">{children}</table>
  </div>
);

const TableHeader = ({ children }) => <thead className="bg-slate-50 border-b border-slate-200">{children}</thead>;
const TableRow = ({ children }) => <tr className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">{children}</tr>;
const TableHead = ({ children }) => <th className="px-4 py-3 font-semibold text-slate-700">{children}</th>;
const TableBody = ({ children }) => <tbody>{children}</tbody>;
const TableCell = ({ children }) => <td className="px-4 py-3 align-middle">{children}</td>;

export default function AdminStudentsPage() {
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [credentials, setCredentials] = useState([]);
  const [exams, setExams] = useState([]);
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [selectedSession, setSelectedSession] = useState(null);
  const [showLogDialog, setShowLogDialog] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const loadStudents = useCallback(async () => {
    setIsLoading(true);
    try {
      const [users, examSessions, allCredentials, allExams] = await Promise.all([
        User.list().catch(() => []),
        ExamSession.list().catch(() => []),
        ExamCredential.list().catch(() => []),
        Exam.list().catch(() => [])
      ]);
      
      // Filter only users with the student role
      const studentUsers = (users || []).filter(u => u.role === 'student' || (u.role !== 'admin' && u.student_id));
      const sessionList = examSessions || [];

      if (studentUsers.length) {
        setStudents(studentUsers);
      } else if (sessionList.length) {
        const sessionStudents = sessionList.map((session) => ({
          id: session.student_id || session.id,
          full_name: session.student_name || "Student",
          email: session.student_email || "",
          student_id: session.student_id || "Unknown",
          role: "student",
          verification_status: "pending"
        }));
        const seen = new Set();
        const uniqueStudents = sessionStudents.filter((student) => {
          const key = student.student_id || student.id;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        setStudents(uniqueStudents);
      } else {
        setStudents([]);
      }

      setSessions(sessionList);
      setCredentials(allCredentials || []);
      setExams(allExams || []);
    } catch (error) {
      console.error("Error loading students:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const filterStudents = useCallback(() => {
    let filtered = [...students];

    if (searchTerm) {
      filtered = filtered.filter(s => 
        (s.full_name?.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (s.email?.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (s.student_id?.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter(s => s.verification_status === statusFilter);
    }

    setFilteredStudents(filtered);
  }, [students, searchTerm, statusFilter]);

  const checkAuthAndLoadData = useCallback(async () => {
    const authStatus = localStorage.getItem('proctorguard_auth') === 'verified';
    const userRole = localStorage.getItem('proctorguard_role');
    
    if (!authStatus || userRole !== 'admin') {
      navigate(createPageUrl("Verification"));
      return;
    }
    await loadStudents();
  }, [navigate, loadStudents]);

  useEffect(() => {
    checkAuthAndLoadData();
  }, [checkAuthAndLoadData]);

  // Auto-refresh effect to reload credentials and students every 30 seconds
  useEffect(() => {
    if (!autoRefresh) return;
    
    const intervalId = setInterval(() => {
      loadStudents();
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(intervalId);
  }, [autoRefresh, loadStudents]);

  useEffect(() => {
    filterStudents();
  }, [filterStudents]);

  const updateStudentStatus = async (studentId, status) => {
    try {
      // 422 Prevention: Only sending specific schema fields
      await User.update(studentId, { verification_status: status });
      await loadStudents();
    } catch (error) {
      console.error("Status update failed:", error);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'verified':
        return <Badge className="bg-green-100 text-green-700 border-green-200">Verified</Badge>;
      case 'rejected':
        return <Badge className="bg-red-100 text-red-700 border-red-200">Rejected</Badge>;
      default:
        return <Badge className="bg-amber-100 text-amber-700 border-amber-200">Pending</Badge>;
    }
  };

  const resolveStudentSession = (student) => {
    const matches = sessions.filter((session) => (
      session.student_id === student.student_id ||
      session.student_id === student.id
    ));

    if (!matches.length) return null;

    return matches.sort((a, b) => {
      const aTime = new Date(a.end_time || a.start_time || 0).getTime();
      const bTime = new Date(b.end_time || b.start_time || 0).getTime();
      return bTime - aTime;
    })[0];
  };

  const openLogDialog = (student, session) => {
    setSelectedStudent(student);
    setSelectedSession(session);
    setShowLogDialog(true);
  };

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await loadStudents();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-600 font-medium">Syncing Student Data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-students">
      <div className="students-container">
        {/* Header Section */}
        <div className="students-header">
          <div>
            <h1>
              <Users className="w-8 h-8" />
              Student Directory
            </h1>
            <p>Review verifications and monitor performance.</p>
          </div>
          <div className="flex gap-3 items-center">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`auto-refresh-toggle ${autoRefresh ? 'active' : ''}`}
              title={autoRefresh ? 'Auto-refresh enabled' : 'Auto-refresh disabled'}
            >
              <div className={`toggle-indicator ${autoRefresh ? 'on' : 'off'}`}></div>
              <span>Auto-Refresh</span>
            </button>
            <Button 
              onClick={handleManualRefresh}
              variant="outline"
              className="flex items-center gap-2 btn-refresh"
              disabled={isRefreshing}
            >
              <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} /> 
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </Button>
            <Button 
              onClick={() => navigate(createPageUrl("AdminDashboard"))} 
              variant="outline"
              className="flex items-center gap-2"
            >
              <ArrowLeft size={16} /> Back to Dashboard
            </Button>
          </div>
        </div>

        {/* Action Bar */}
        <Card className="students-action-bar">
          <CardContent className="students-action-content">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input 
                className="pl-10 bg-white" 
                placeholder="Search by name, ID or email..." 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
              />
            </div>
            <div className="students-filter-group">
              {["all", "pending", "verified", "rejected"].map((f) => (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  className={`students-filter-btn ${
                    statusFilter === f ? "students-filter-btn-active" : ""
                  }`}
                >
                  {f.toUpperCase()}
                </button>
              ))}
            </div>
            {autoRefresh && (
              <div className="auto-refresh-indicator" title="Auto-refreshing every 30 seconds">
                <div className="refresh-pulse"></div>
                <span>Live</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Students Table */}
        <Card className="students-table-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student Details</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Exam Credentials</TableHead>
                <TableHead>Academic Performance</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStudents.map((student) => {
                const session = resolveStudentSession(student);
                const flags = session?.proctoring_data?.flags || [];
                const violations = flags.length;
                const hasSession = Boolean(session);
                
                // Find credentials for this student's exam
                const studentCredential = credentials.find(cred => 
                  cred.exam_access_id === student.student_id || 
                  (session && cred.exam_id === session.exam_id)
                );
                const credentialExam = studentCredential ? exams.find(e => e.id === studentCredential.exam_id) : null;

                return (
                  <TableRow key={student.id} className="student-row-enhanced">
                    <TableCell>
                      <div className="student-info-cell">
                        <div className="student-avatar-mini">
                          <UserIcon size={18} />
                        </div>
                        <div className="student-details-wrapper">
                          <div className="student-name-primary">{student.full_name || "Unregistered"}</div>
                          <div className="student-meta-line">
                            <span className="meta-badge">{student.student_id || "No ID"}</span>
                            <span className="meta-divider">•</span>
                            <span className="meta-email">{student.email}</span>
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="status-cell-wrapper">
                        {getStatusBadge(student.verification_status)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="credentials-cell">
                        {studentCredential ? (
                          <>
                            <div className="credential-item">
                              <div className="credential-icon-wrapper">
                                <Key size={16} />
                              </div>
                              <div className="credential-content">
                                <div className="credential-label">Access ID</div>
                                <div className="credential-value">{studentCredential.exam_access_id}</div>
                              </div>
                            </div>
                            <div className="credential-item">
                              <div className={`credential-icon-wrapper ${studentCredential.is_active ? 'active-icon' : 'inactive-icon'}`}>
                                {studentCredential.is_active ? <Unlock size={16} /> : <Lock size={16} />}
                              </div>
                              <div className="credential-content">
                                <div className="credential-label">Status</div>
                                <div className="credential-value">{studentCredential.is_active ? 'Active' : 'Inactive'}</div>
                              </div>
                            </div>
                            {studentCredential.max_uses && (
                              <div className="credential-item">
                                <div className="credential-icon-wrapper usage-icon">
                                  <Award size={16} />
                                </div>
                                <div className="credential-content">
                                  <div className="credential-label">Usage</div>
                                  <div className="credential-value">
                                    {studentCredential.used_count || 0}/{studentCredential.max_uses}
                                  </div>
                                </div>
                              </div>
                            )}
                            {credentialExam && (
                              <div className="credential-exam-tag">
                                {credentialExam.title}
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="no-credential-placeholder">
                            <Lock size={16} />
                            <span>No credentials assigned</span>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="performance-cell">
                        {hasSession ? (
                          <>
                            <div className="perf-item perf-score">
                              <div className="perf-icon-wrapper score-icon">
                                <Award size={16} />
                              </div>
                              <div className="perf-content">
                                <div className="perf-label">Score</div>
                                <div className="perf-value">{session?.score ?? 0}%</div>
                              </div>
                            </div>
                            <div className="perf-item perf-status">
                              <div className="perf-icon-wrapper status-icon">
                                <CheckCircle size={16} />
                              </div>
                              <div className="perf-content">
                                <div className="perf-label">Status</div>
                                <div className="perf-value">{session?.status || "unknown"}</div>
                              </div>
                            </div>
                            <div className="perf-item perf-flags">
                              <div className={`perf-icon-wrapper flags-icon ${violations > 0 ? 'has-violations' : ''}`}>
                                <AlertOctagon size={16} />
                              </div>
                              <div className="perf-content">
                                <div className="perf-label">Flags</div>
                                <div className={`perf-value ${violations > 0 ? 'text-red-600' : 'text-slate-500'}`}>
                                  {violations} detected
                                </div>
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="no-session-placeholder">
                            <Clock size={16} />
                            <span>No exam activity</span>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="action-buttons-cell">
                        {student.verification_status !== 'verified' && (
                          <Button 
                            size="sm" 
                            onClick={() => updateStudentStatus(student.id, 'verified')} 
                            className="btn-approve"
                          >
                            <CheckCircle size={14} />
                            Approve
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="btn-view-log"
                          onClick={() => openLogDialog(student, session)}
                          disabled={!hasSession}
                        >
                          <Eye size={14} />
                          View Log
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          
          {filteredStudents.length === 0 && (
            <div className="py-20 text-center">
              <Users className="w-12 h-12 text-slate-200 mx-auto mb-4" />
              <p className="text-slate-500 font-medium">No students match your search criteria.</p>
            </div>
          )}
        </Card>
      </div>

      <Dialog open={showLogDialog} onOpenChange={setShowLogDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detection Log</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <div className="text-sm text-slate-500">Student</div>
              <div className="font-semibold">
                {selectedStudent?.full_name || "Unknown"} ({selectedStudent?.student_id || "N/A"})
              </div>
              <div className="text-sm text-slate-500">{selectedStudent?.email || ""}</div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg border border-slate-200 p-3">
                <div className="text-xs text-slate-500">Session Status</div>
                <div className="font-semibold capitalize">{selectedSession?.status || "no session"}</div>
              </div>
              <div className="rounded-lg border border-slate-200 p-3">
                <div className="text-xs text-slate-500">Score</div>
                <div className="font-semibold">{selectedSession?.score ?? "N/A"}</div>
              </div>
              <div className="rounded-lg border border-slate-200 p-3">
                <div className="text-xs text-slate-500">Violations</div>
                <div className="font-semibold">{(selectedSession?.proctoring_data?.flags || []).length}</div>
              </div>
              <div className="rounded-lg border border-slate-200 p-3">
                <div className="text-xs text-slate-500">Snapshots</div>
                <div className="font-semibold">{(selectedSession?.proctoring_data?.snapshots || []).length}</div>
              </div>
            </div>

            <div>
              <div className="text-sm font-semibold mb-2">Detected Logs</div>
              {(selectedSession?.proctoring_data?.flags || []).length === 0 ? (
                <div className="text-sm text-slate-400">No detection logs recorded.</div>
              ) : (
                <ul className="space-y-2">
                  {selectedSession.proctoring_data.flags.map((flag, index) => (
                    <li key={`${flag}-${index}`} className="rounded-md border border-slate-200 px-3 py-2 text-sm">
                      {flag}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}