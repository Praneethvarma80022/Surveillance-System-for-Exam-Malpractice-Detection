
import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Exam, ExamCredential } from "@/entities/all";
import "./AdminExams.css";
import { Card, CardContent, CardHeader, CardTitle, Button, Badge, Input, Textarea, Label, Switch, Tabs, TabsContent, TabsList, TabsTrigger, Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Container } from "@/components/ui";
import { 
  BookOpen, 
  Plus, 
  Edit, 
  Trash2, 
  Clock, 
  Users, 
  Shield, 
  Settings,
  Calendar,
  Eye,
  EyeOff,
  Copy,
  Play,
  Pause,
  Square,
  Key,
  Lock,
  Unlock,
  CheckCircle 
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui";

export default function AdminExamsPage() {
  const navigate = useNavigate();
  const [exams, setExams] = useState([]);
  const [credentials, setCredentials] = useState([]);
  const [_isLoading, setIsLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showCreateCredentialDialog, setShowCreateCredentialDialog] = useState(false);
  const [viewingExam, setViewingExam] = useState(null);
  const [editingExam, setEditingExam] = useState(null);
  const [passwordVisibility, setPasswordVisibility] = useState({});
  const [newCredential, setNewCredential] = useState({
    exam_id: "",
    exam_access_id: "",
    password: "",
    max_uses: 1,
    is_active: true
  });
  const [newExam, setNewExam] = useState({
    title: "",
    description: "",
    start_time: "",
    end_time: "",
    duration_minutes: 60,
    questions: [],
    total_points: 100,
    settings: {
      shuffle_questions: false,
      show_results_immediately: false,
      allow_backtrack: true,
      strict_proctoring: true,
      face_detection: true,
      screen_recording: true,
      browser_lockdown: false
    }
  });

  const loadExams = useCallback(async () => {
    setIsLoading(true);
    try {
      const [examData, credentialData] = await Promise.all([
        Exam.list(),
        ExamCredential.list()
      ]);
      console.log('[ADMIN LOAD] Exams from API:', examData);
      console.log('[ADMIN LOAD] Credentials from API:', credentialData);
      if (credentialData && credentialData.length > 0) {
        console.log('[ADMIN LOAD] Sample credential fields:', Object.keys(credentialData[0]));
        console.log('[ADMIN LOAD] Sample credential data:', credentialData[0]);
      }
      
      setExams(examData);
      setCredentials(credentialData);
    } catch (error) {
      console.error("Error loading exams:", error);
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
    
    await loadExams();
  }, [navigate, loadExams]);

  useEffect(() => {
    const t = setTimeout(() => checkAuthAndLoadData(), 0);
    return () => clearTimeout(t);
  }, [checkAuthAndLoadData]);

  const handleCreateExam = async () => {
    try {
      const now = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 1); // Default: available for 1 month
      
      const examData = {
        ...newExam,
        // If no start_time provided, make it immediately available
        start_time: newExam.start_time || now.toISOString(),
        // If no end_time provided, set it to 1 month from now
        end_time: newExam.end_time || endDate.toISOString(),
        status: "upcoming"
      };
      await Exam.create(examData);
      await loadExams();
      setShowCreateDialog(false);
      resetNewExam();
    } catch (error) {
      console.error("Error creating exam:", error);
    }
  };

  const handleViewExam = (exam) => {
    setViewingExam(exam);
    setShowViewDialog(true);
  };

  const handleEditExam = (exam) => {
    setEditingExam({
      ...exam,
      start_time: exam.start_time ? new Date(exam.start_time).toISOString().slice(0, 16) : "",
      end_time: exam.end_time ? new Date(exam.end_time).toISOString().slice(0, 16) : ""
    });
    setShowEditDialog(true);
  };

  const handleUpdateExam = async () => {
    if (!editingExam) return;
    
    try {
      await Exam.update(editingExam.id, {
        title: editingExam.title,
        description: editingExam.description,
        start_time: editingExam.start_time,
        end_time: editingExam.end_time,
        duration_minutes: editingExam.duration_minutes,
        questions: editingExam.questions,
        total_points: editingExam.total_points,
        settings: editingExam.settings
      });
      await loadExams();
      setShowEditDialog(false);
      setEditingExam(null);
    } catch (error) {
      console.error("Error updating exam:", error);
    }
  };

  const handleDeleteExam = async (examId) => {
    if (window.confirm("Are you sure you want to delete this exam? This action cannot be undone.")) {
      try {
        await Exam.delete(examId);
        await loadExams();
      } catch (error) {
        console.error("Error deleting exam:", error);
      }
    }
  };

  const handleUpdateExamStatus = async (examId, status) => {
    try {
      await Exam.update(examId, { status });
      await loadExams();
    } catch (error) {
      console.error("Error updating exam status:", error);
    }
  };

  const resetNewExam = () => {
    setNewExam({
      title: "",
      description: "",
      start_time: "",
      end_time: "",
      duration_minutes: 60,
      questions: [],
      total_points: 100,
      settings: {
        shuffle_questions: false,
        show_results_immediately: false,
        allow_backtrack: true,
        strict_proctoring: true,
        face_detection: true,
        screen_recording: true,
        browser_lockdown: false
      }
    });
  };

  const handleCreateCredential = async () => {
    try {
      if (!newCredential.exam_id) {
        alert("Please select an exam");
        return;
      }
      
      console.log('[CREDENTIAL CREATE] Creating credential with data:', newCredential);
      
      const credentialData = {
        ...newCredential,
        used_count: 0,
        created_at: new Date().toISOString(),
        created_by_admin: localStorage.getItem('proctorguard_user_id') || 'system'
      };
      
      console.log('[CREDENTIAL CREATE] Final payload:', credentialData);
      const createdCredential = await ExamCredential.create(credentialData);
      console.log('[CREDENTIAL CREATE] Created credential response:', createdCredential);
      
      await loadExams();
      setShowCreateCredentialDialog(false);
      resetNewCredential();
    } catch (error) {
      console.error("Error creating credential:", error);
      alert("Error creating credential: " + error.message);
    }
  };

  const resetNewCredential = () => {
    setNewCredential({
      exam_id: "",
      exam_access_id: "",
      password: "",
      max_uses: 1,
      is_active: true
    });
  };

  const handleToggleCredentialStatus = async (credentialId, currentStatus) => {
    try {
      // Get the full credential object to preserve all fields
      const credentialsData = await ExamCredential.list();
      const credential = credentialsData.find(c => c.id === credentialId);
      
      if (!credential) {
        console.error("Credential not found:", credentialId);
        return;
      }
      
      // Update with full credential data to avoid 422 errors
      const updatePayload = {
        ...credential,
        is_active: !currentStatus
      };
      
      console.log('[TOGGLE] Updating credential:', credentialId, 'Payload:', updatePayload);
      await ExamCredential.update(credentialId, updatePayload);
      await loadExams();
    } catch (error) {
      console.error("Error toggling credential status:", error);
      alert("Error: " + (error.message || "Failed to update credential"));
    }
  };

  const handleDeleteCredential = async (credentialId) => {
    if (window.confirm("Are you sure you want to delete this credential?")) {
      try {
        console.log('[DELETE] Deleting credential:', credentialId);
        await ExamCredential.delete(credentialId);
        await loadExams();
      } catch (error) {
        console.error("Error deleting credential:", error);
        alert("Error: " + (error.message || "Failed to delete credential"));
      }
    }
  };

  const handleCopyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text).then(() => {
      alert(`${label} copied to clipboard!`);
    }).catch((err) => {
      console.error("Failed to copy:", err);
    });
  };

  const togglePasswordVisibility = (credentialId) => {
    setPasswordVisibility(prev => ({
      ...prev,
      [credentialId]: !prev[credentialId]
    }));
  };

  const getStatusBadge = (status) => {
    const badges = {
      upcoming: <Badge className="bg-amber-100 text-amber-800">Upcoming</Badge>,
      active: <Badge className="bg-green-100 text-green-800">Active</Badge>,
      completed: <Badge className="bg-blue-100 text-blue-800">Completed</Badge>,
      expired: <Badge className="bg-gray-100 text-gray-800">Expired</Badge>
    };
    return badges[status] || badges.upcoming;
  };

  const addQuestion = () => {
    const newQuestion = {
      question: "",
      type: "multiple_choice",
      options: ["", "", "", ""],
      points: 10
    };
    setNewExam(prev => ({
      ...prev,
      questions: [...prev.questions, newQuestion]
    }));
  };

  const updateQuestion = (index, field, value) => {
    setNewExam(prev => ({
      ...prev,
      questions: prev.questions.map((q, i) => 
        i === index ? { ...q, [field]: value } : q
      )
    }));
  };

  const removeQuestion = (index) => {
    setNewExam(prev => ({
      ...prev,
      questions: prev.questions.filter((_, i) => i !== index)
    }));
  };

  return (
    <div className="admin-exams">
      <div className="exams-container">
        {/* Header */}
        <div className="exams-header">
          <div>
            <h1 className="exams-header-h1">
              <BookOpen className="w-8 h-8 text-indigo-600" />
              Exam Management
            </h1>
            <p className="exams-header-subtitle">Create, configure, and manage examinations</p>
          </div>
          <div className="exams-header-actions">
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button className="bg-indigo-600 hover:bg-indigo-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Create New Exam
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create New Examination</DialogTitle>
                </DialogHeader>
                
                <Tabs defaultValue="basic" className="space-y-6">
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="basic">Basic Info</TabsTrigger>
                    <TabsTrigger value="questions">Questions</TabsTrigger>
                    <TabsTrigger value="settings">Settings</TabsTrigger>
                    <TabsTrigger value="proctoring">Proctoring</TabsTrigger>
                  </TabsList>

                  <TabsContent value="basic" className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Exam Title</Label>
                        <Input
                          value={newExam.title}
                          onChange={(e) => setNewExam(prev => ({ ...prev, title: e.target.value }))}
                          placeholder="Enter exam title"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Duration (minutes)</Label>
                        <Input
                          type="number"
                          value={newExam.duration_minutes}
                          onChange={(e) => setNewExam(prev => ({ ...prev, duration_minutes: parseInt(e.target.value) }))}
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Textarea
                        value={newExam.description}
                        onChange={(e) => setNewExam(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Enter exam description"
                        className="h-24"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Start Date & Time</Label>
                        <Input
                          type="datetime-local"
                          value={newExam.start_time}
                          onChange={(e) => setNewExam(prev => ({ ...prev, start_time: e.target.value }))}
                        />
                        <p className="text-xs text-gray-500">Leave empty to make exam immediately available</p>
                      </div>
                      <div className="space-y-2">
                        <Label>End Date & Time</Label>
                        <Input
                          type="datetime-local"
                          value={newExam.end_time}
                          onChange={(e) => setNewExam(prev => ({ ...prev, end_time: e.target.value }))}
                        />
                        <p className="text-xs text-gray-500">Leave empty to set 1 month availability</p>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="questions" className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-semibold">Exam Questions</h3>
                      <Button onClick={addQuestion} size="sm">
                        <Plus className="w-4 h-4 mr-1" />
                        Add Question
                      </Button>
                    </div>

                    <div className="space-y-4 max-h-96 overflow-y-auto">
                      {newExam.questions.map((question, index) => (
                        <Card key={index} className="p-4">
                          <div className="space-y-3">
                            <div className="flex justify-between items-start">
                              <Label>Question {index + 1}</Label>
                              <Button
                                onClick={() => removeQuestion(index)}
                                size="sm"
                                variant="outline"
                                className="text-red-600"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                            
                            <Textarea
                              value={question.question}
                              onChange={(e) => updateQuestion(index, 'question', e.target.value)}
                              placeholder="Enter question text"
                            />

                            <div className="grid grid-cols-2 gap-4">
                              <Select
                                value={question.type}
                                onValueChange={(value) => updateQuestion(index, 'type', value)}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                                  <SelectItem value="essay">Essay</SelectItem>
                                  <SelectItem value="short_answer">Short Answer</SelectItem>
                                </SelectContent>
                              </Select>

                              <Input
                                type="number"
                                value={question.points}
                                onChange={(e) => updateQuestion(index, 'points', parseInt(e.target.value))}
                                placeholder="Points"
                              />
                            </div>

                            {question.type === 'multiple_choice' && (
                              <div className="space-y-2">
                                <Label>Answer Options</Label>
                                {question.options.map((option, optIndex) => (
                                  <Input
                                    key={optIndex}
                                    value={option}
                                    onChange={(e) => {
                                      const newOptions = [...question.options];
                                      newOptions[optIndex] = e.target.value;
                                      updateQuestion(index, 'options', newOptions);
                                    }}
                                    placeholder={`Option ${optIndex + 1}`}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        </Card>
                      ))}
                    </div>
                  </TabsContent>

                  <TabsContent value="settings" className="space-y-4">
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Shuffle Questions</Label>
                          <p className="text-sm text-slate-600">Randomize question order for each student</p>
                        </div>
                        <Switch
                          checked={newExam.settings.shuffle_questions}
                          onCheckedChange={(checked) => 
                            setNewExam(prev => ({
                              ...prev,
                              settings: { ...prev.settings, shuffle_questions: checked }
                            }))
                          }
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Show Results Immediately</Label>
                          <p className="text-sm text-slate-600">Display results after exam submission</p>
                        </div>
                        <Switch
                          checked={newExam.settings.show_results_immediately}
                          onCheckedChange={(checked) => 
                            setNewExam(prev => ({
                              ...prev,
                              settings: { ...prev.settings, show_results_immediately: checked }
                            }))
                          }
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Allow Backtracking</Label>
                          <p className="text-sm text-slate-600">Let students navigate back to previous questions</p>
                        </div>
                        <Switch
                          checked={newExam.settings.allow_backtrack}
                          onCheckedChange={(checked) => 
                            setNewExam(prev => ({
                              ...prev,
                              settings: { ...prev.settings, allow_backtrack: checked }
                            }))
                          }
                        />
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="proctoring" className="space-y-4">
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Strict Proctoring</Label>
                          <p className="text-sm text-slate-600">Enable comprehensive monitoring and restrictions</p>
                        </div>
                        <Switch
                          checked={newExam.settings.strict_proctoring}
                          onCheckedChange={(checked) => 
                            setNewExam(prev => ({
                              ...prev,
                              settings: { ...prev.settings, strict_proctoring: checked }
                            }))
                          }
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Face Detection</Label>
                          <p className="text-sm text-slate-600">Monitor student's face during the exam</p>
                        </div>
                        <Switch
                          checked={newExam.settings.face_detection}
                          onCheckedChange={(checked) => 
                            setNewExam(prev => ({
                              ...prev,
                              settings: { ...prev.settings, face_detection: checked }
                            }))
                          }
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Screen Recording</Label>
                          <p className="text-sm text-slate-600">Record student's screen activity</p>
                        </div>
                        <Switch
                          checked={newExam.settings.screen_recording}
                          onCheckedChange={(checked) => 
                            setNewExam(prev => ({
                              ...prev,
                              settings: { ...prev.settings, screen_recording: checked }
                            }))
                          }
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Browser Lockdown</Label>
                          <p className="text-sm text-slate-600">Prevent students from leaving the exam window</p>
                        </div>
                        <Switch
                          checked={newExam.settings.browser_lockdown}
                          onCheckedChange={(checked) => 
                            setNewExam(prev => ({
                              ...prev,
                              settings: { ...prev.settings, browser_lockdown: checked }
                            }))
                          }
                        />
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>

                <div className="flex justify-end gap-3 pt-4">
                  <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateExam} className="bg-indigo-600 hover:bg-indigo-700">
                    Create Exam
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            
            <Button onClick={() => navigate(createPageUrl("AdminDashboard"))} variant="outline">
              Back to Dashboard
            </Button>
          </div>
        </div>

        {/* Main Content with Tabs */}
        <Tabs defaultValue="exams" className="space-y-6">
          <TabsList className="bg-white/80 backdrop-blur-sm border-0 shadow-sm">
            <TabsTrigger value="exams" className="flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              All Examinations ({exams.length})
            </TabsTrigger>
            <TabsTrigger value="credentials" className="flex items-center gap-2">
              <Key className="w-4 h-4" />
              Exam Access Credentials ({credentials.length})
            </TabsTrigger>
          </TabsList>

          {/* Exams Tab */}
          <TabsContent value="exams">
            <Card className="exams-table-card">
              <CardContent className="pt-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Exam Title</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Start Time</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Questions</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {exams.map((exam) => (
                      <TableRow key={exam.id}>
                        <TableCell>
                          <div>
                            <p className="font-semibold">{exam.title}</p>
                            <p className="text-sm text-slate-600 truncate max-w-xs">{exam.description}</p>
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(exam.status)}</TableCell>
                        <TableCell>
                          {new Date(exam.start_time).toLocaleDateString()} {new Date(exam.start_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </TableCell>
                        <TableCell>{exam.duration_minutes} min</TableCell>
                        <TableCell>{exam.questions?.length || 0}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => handleViewExam(exam)}>
                              <Eye className="w-3 h-3 mr-1" />
                              View
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleEditExam(exam)}>
                              <Edit className="w-3 h-3 mr-1" />
                              Edit
                            </Button>
                            {exam.status === 'upcoming' && (
                              <Button 
                                size="sm" 
                                onClick={() => handleUpdateExamStatus(exam.id, 'active')}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                <Play className="w-3 h-3 mr-1" />
                                Start
                              </Button>
                            )}
                            {exam.status === 'active' && (
                              <Button 
                                size="sm" 
                                onClick={() => handleUpdateExamStatus(exam.id, 'completed')}
                                variant="destructive"
                              >
                                <Square className="w-3 h-3 mr-1" />
                                End
                              </Button>
                            )}
                            {exam.status === 'upcoming' || exam.status === 'completed' || exam.status === 'expired' ? (
                                <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => handleDeleteExam(exam.id)}
                                >
                                    <Trash2 className="w-3 h-3 mr-1" />
                                    Delete
                                </Button>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                
                {exams.length === 0 && (
                  <div className="text-center py-12 text-slate-500">
                    <BookOpen className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                    <h3 className="text-xl font-semibold mb-2">No Exams Created</h3>
                    <p>Create your first exam to get started with proctored testing.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Credentials Tab */}
          <TabsContent value="credentials">
            <Card className="border-0 bg-white/80 backdrop-blur-sm shadow-lg">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Key className="w-5 h-5" />
                      Exam Access Credentials
                    </CardTitle>
                    <p className="text-sm text-slate-600 mt-1">Create and manage login credentials for students to access exams</p>
                  </div>
                  <Dialog open={showCreateCredentialDialog} onOpenChange={setShowCreateCredentialDialog}>
                    <DialogTrigger asChild>
                      <Button className="bg-indigo-600 hover:bg-indigo-700">
                        <Plus className="w-4 h-4 mr-2" />
                        New Credential
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-lg">
                      <DialogHeader>
                        <DialogTitle>Create Exam Access Credential</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>Select Exam</Label>
                          <Select
                            value={newCredential.exam_id}
                            onValueChange={(value) => setNewCredential(prev => ({ ...prev, exam_id: value }))}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Choose an exam" />
                            </SelectTrigger>
                            <SelectContent>
                              {exams.map((exam) => (
                                <SelectItem key={exam.id} value={exam.id}>
                                  {exam.title}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label>Exam Access ID</Label>
                          <Input
                            value={newCredential.exam_access_id}
                            onChange={(e) => setNewCredential(prev => ({ ...prev, exam_access_id: e.target.value }))}
                            placeholder="e.g., exam2200080022"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Password</Label>
                          <Input
                            type="password"
                            value={newCredential.password}
                            onChange={(e) => setNewCredential(prev => ({ ...prev, password: e.target.value }))}
                            placeholder="Enter password"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Maximum Uses</Label>
                          <Input
                            type="number"
                            min="1"
                            value={newCredential.max_uses}
                            onChange={(e) => setNewCredential(prev => ({ ...prev, max_uses: parseInt(e.target.value) }))}
                          />
                        </div>

                        <div className="flex items-center gap-2">
                          <Switch
                            checked={newCredential.is_active}
                            onCheckedChange={(checked) => setNewCredential(prev => ({ ...prev, is_active: checked }))}
                          />
                          <Label>Active</Label>
                        </div>

                        <div className="flex justify-end gap-3 pt-4">
                          <Button variant="outline" onClick={() => setShowCreateCredentialDialog(false)}>
                            Cancel
                          </Button>
                          <Button onClick={handleCreateCredential} className="bg-indigo-600 hover:bg-indigo-700">
                            Create Credential
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                <div className="credentials-grid">
                  {credentials.map((credential) => {
                    // Log all credentials to see their structure
                    if (!credential.exam_id) {
                      console.warn('[CREDENTIAL DISPLAY] Credential missing exam_id:', {
                        id: credential.id,
                        exam_access_id: credential.exam_access_id,
                        fields: Object.keys(credential),
                        fullData: credential
                      });
                    }
                    
                    const exam = exams.find(e => e.id === credential.exam_id);
                    const isPasswordVisible = passwordVisibility[credential.id];
                    
                    return (
                      <div key={credential.id} className="credential-card-new">
                        {/* Left Section: Title, Status, Usage */}
                        <div className="credential-section credential-section-left">
                          <h3 className="credential-exam-title-new">{exam?.title || 'Unknown Exam'}</h3>
                          <div className="credential-meta">
                            {credential.is_active ? (
                              <div className="credential-badge-active">
                                <CheckCircle className="w-3.5 h-3.5" />
                                Active
                              </div>
                            ) : (
                              <div className="credential-badge-inactive">Inactive</div>
                            )}
                            <span className="credential-usage-text">
                              Used: {credential.used_count || 0}/{credential.max_uses}
                            </span>
                          </div>
                        </div>

                        {/* Middle Section: Form Fields */}
                        <div className="credential-section credential-section-middle">
                          <div className="credential-field-group">
                            <label className="credential-field-label">EXAM ACCESS ID</label>
                            <div className="credential-input-wrapper">
                              <input 
                                type="text" 
                                className="credential-input" 
                                value={credential.exam_access_id} 
                                readOnly 
                              />
                              <button 
                                className="credential-icon-btn"
                                onClick={() => handleCopyToClipboard(credential.exam_access_id, 'Access ID')}
                                title="Copy Access ID"
                              >
                                <Copy className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          <div className="credential-field-group">
                            <label className="credential-field-label">PASSWORD</label>
                            <div className="credential-input-wrapper">
                              <input 
                                type={isPasswordVisible ? "text" : "password"}
                                className="credential-input" 
                                value={credential.password || '••••••••••'} 
                                readOnly 
                              />
                              <button 
                                className="credential-icon-btn"
                                onClick={() => togglePasswordVisibility(credential.id)}
                                title={isPasswordVisible ? "Hide Password" : "View Password"}
                              >
                                {isPasswordVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Right Section: Actions */}
                        <div className="credential-section credential-section-right">
                          <button
                            className="credential-action-btn credential-btn-toggle-new"
                            onClick={() => handleToggleCredentialStatus(credential.id, credential.is_active)}
                            title={credential.is_active ? 'Deactivate' : 'Activate'}
                          >
                            {credential.is_active ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                            {credential.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                          <button
                            className="credential-action-btn credential-btn-delete-new"
                            onClick={() => handleDeleteCredential(credential.id)}
                            title="Delete Credential"
                          >
                            <Trash2 className="w-4 h-4" />
                            Delete
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {credentials.length === 0 && (
                  <div className="text-center py-12 text-slate-500">
                    <Key className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                    <h3 className="text-xl font-semibold mb-2">No Credentials Created</h3>
                    <p>Create exam access credentials to allow students to take exams.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* View Exam Dialog */}
        <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl">Exam Details</DialogTitle>
            </DialogHeader>
            
            {viewingExam && (
              <div className="space-y-6">
                {/* Basic Info */}
                <Card className="bg-slate-50">
                  <CardHeader>
                    <CardTitle className="text-lg">Basic Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label className="text-slate-600">Title</Label>
                      <p className="font-semibold text-lg">{viewingExam.title}</p>
                    </div>
                    <div>
                      <Label className="text-slate-600">Description</Label>
                      <p className="text-slate-800">{viewingExam.description}</p>
                    </div>
                    <div className="grid md:grid-cols-3 gap-4">
                      <div>
                        <Label className="text-slate-600">Duration</Label>
                        <p className="font-semibold">{viewingExam.duration_minutes} minutes</p>
                      </div>
                      <div>
                        <Label className="text-slate-600">Total Points</Label>
                        <p className="font-semibold">{viewingExam.total_points} points</p>
                      </div>
                      <div>
                        <Label className="text-slate-600">Status</Label>
                        <div className="mt-1">{getStatusBadge(viewingExam.status)}</div>
                      </div>
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-slate-600">Start Time</Label>
                        <p className="font-semibold">{new Date(viewingExam.start_time).toLocaleString()}</p>
                      </div>
                      <div>
                        <Label className="text-slate-600">End Time</Label>
                        <p className="font-semibold">{new Date(viewingExam.end_time).toLocaleString()}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Questions */}
                <Card className="bg-slate-50">
                  <CardHeader>
                    <CardTitle className="text-lg">Questions ({viewingExam.questions?.length || 0})</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {viewingExam.questions?.length === 0 ? (
                        <p className="text-slate-600 text-center py-4">No questions defined for this exam.</p>
                    ) : (
                        viewingExam.questions?.map((question, index) => (
                        <Card key={index} className="bg-white">
                            <CardContent className="p-4">
                            <div className="flex justify-between items-start mb-3">
                                <h4 className="font-semibold text-slate-900">Question {index + 1}</h4>
                                <Badge variant="outline">{question.points} points</Badge>
                            </div>
                            <p className="text-slate-800 mb-3">{question.question}</p>
                            <div className="flex items-center gap-2 mb-2">
                                <Badge className="bg-blue-100 text-blue-800">{question.type.replace('_', ' ')}</Badge>
                            </div>
                            {question.type === 'multiple_choice' && question.options && (
                                <div className="mt-3 space-y-2">
                                <Label className="text-sm text-slate-600">Options:</Label>
                                {question.options.map((option, optIndex) => (
                                    <div key={optIndex} className="pl-4 py-1 text-slate-700">
                                    {String.fromCharCode(65 + optIndex)}. {option}
                                    </div>
                                ))}
                                </div>
                            )}
                            </CardContent>
                        </Card>
                        ))
                    )}
                  </CardContent>
                </Card>

                {/* Settings */}
                <Card className="bg-slate-50">
                  <CardHeader>
                    <CardTitle className="text-lg">Exam Settings</CardTitle>
                  </CardHeader>
                  <CardContent className="grid md:grid-cols-2 gap-4">
                      <div className="flex items-center justify-between p-3 bg-white rounded-lg">
                        <span className="text-slate-700">Shuffle Questions</span>
                        <Badge className={viewingExam.settings?.shuffle_questions ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}>
                          {viewingExam.settings?.shuffle_questions ? "Enabled" : "Disabled"}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-white rounded-lg">
                        <span className="text-slate-700">Show Results Immediately</span>
                        <Badge className={viewingExam.settings?.show_results_immediately ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}>
                          {viewingExam.settings?.show_results_immediately ? "Enabled" : "Disabled"}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-white rounded-lg">
                        <span className="text-slate-700">Allow Backtrack</span>
                        <Badge className={viewingExam.settings?.allow_backtrack ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}>
                          {viewingExam.settings?.allow_backtrack ? "Enabled" : "Disabled"}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-white rounded-lg">
                        <span className="text-slate-700">Strict Proctoring</span>
                        <Badge className={viewingExam.settings?.strict_proctoring ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}>
                          {viewingExam.settings?.strict_proctoring ? "Enabled" : "Disabled"}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-white rounded-lg">
                        <span className="text-slate-700">Face Detection</span>
                        <Badge className={viewingExam.settings?.face_detection ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}>
                          {viewingExam.settings?.face_detection ? "Enabled" : "Disabled"}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-white rounded-lg">
                        <span className="text-slate-700">Screen Recording</span>
                        <Badge className={viewingExam.settings?.screen_recording ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}>
                          {viewingExam.settings?.screen_recording ? "Enabled" : "Disabled"}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-white rounded-lg">
                        <span className="text-slate-700">Browser Lockdown</span>
                        <Badge className={viewingExam.settings?.browser_lockdown ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}>
                          {viewingExam.settings?.browser_lockdown ? "Enabled" : "Disabled"}
                        </Badge>
                      </div>
                  </CardContent>
                </Card>

                <div className="flex justify-end gap-3">
                  <Button variant="outline" onClick={() => setShowViewDialog(false)}>
                    Close
                  </Button>
                  <Button onClick={() => {
                    setShowViewDialog(false);
                    handleEditExam(viewingExam);
                  }} className="bg-indigo-600 hover:bg-indigo-700">
                    <Edit className="w-4 h-4 mr-2" />
                    Edit Exam
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Edit Exam Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Examination</DialogTitle>
            </DialogHeader>
            
            {editingExam && (
              <Tabs defaultValue="basic" className="space-y-6">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="basic">Basic Info</TabsTrigger>
                  <TabsTrigger value="questions">Questions</TabsTrigger>
                  <TabsTrigger value="settings">Settings</TabsTrigger>
                  <TabsTrigger value="proctoring">Proctoring</TabsTrigger>
                </TabsList>

                <TabsContent value="basic" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Exam Title</Label>
                      <Input
                        value={editingExam.title}
                        onChange={(e) => setEditingExam({...editingExam, title: e.target.value})}
                        placeholder="Enter exam title"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Duration (minutes)</Label>
                      <Input
                        type="number"
                        value={editingExam.duration_minutes}
                        onChange={(e) => setEditingExam({...editingExam, duration_minutes: parseInt(e.target.value)})}
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea
                      value={editingExam.description}
                      onChange={(e) => setEditingExam({...editingExam, description: e.target.value})}
                      placeholder="Enter exam description"
                      className="h-24"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Start Date & Time</Label>
                      <Input
                        type="datetime-local"
                        value={editingExam.start_time}
                        onChange={(e) => setEditingExam({...editingExam, start_time: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>End Date & Time</Label>
                      <Input
                        type="datetime-local"
                        value={editingExam.end_time}
                        onChange={(e) => setEditingExam({...editingExam, end_time: e.target.value})}
                      />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="questions" className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold">Exam Questions</h3>
                    <Button onClick={() => {
                      const newQuestion = {
                        question: "",
                        type: "multiple_choice",
                        options: ["", "", "", ""],
                        points: 10
                      };
                      setEditingExam(prev => ({
                        ...prev,
                        questions: [...(prev.questions || []), newQuestion]
                      }));
                    }} size="sm">
                      <Plus className="w-4 h-4 mr-1" />
                      Add Question
                    </Button>
                  </div>

                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    {editingExam.questions?.length === 0 ? (
                        <p className="text-slate-600 text-center py-4">No questions defined. Click "Add Question" to create one.</p>
                    ) : (
                        editingExam.questions.map((question, index) => (
                        <Card key={index} className="p-4">
                            <div className="space-y-3">
                            <div className="flex justify-between items-start">
                                <Label>Question {index + 1}</Label>
                                <Button
                                onClick={() => {
                                    const newQuestions = editingExam.questions.filter((_, i) => i !== index);
                                    setEditingExam({...editingExam, questions: newQuestions});
                                }}
                                size="sm"
                                variant="outline"
                                className="text-red-600"
                                >
                                <Trash2 className="w-4 h-4" />
                                </Button>
                            </div>
                            
                            <Textarea
                                value={question.question}
                                onChange={(e) => {
                                const newQuestions = [...editingExam.questions];
                                newQuestions[index].question = e.target.value;
                                setEditingExam({...editingExam, questions: newQuestions});
                                }}
                                placeholder="Enter question text"
                            />

                            <div className="grid grid-cols-2 gap-4">
                                <Select
                                value={question.type}
                                onValueChange={(value) => {
                                    const newQuestions = [...editingExam.questions];
                                    newQuestions[index].type = value;
                                    // Reset options if type changes from MC
                                    if (value !== 'multiple_choice' && question.type === 'multiple_choice') {
                                        newQuestions[index].options = [];
                                    } else if (value === 'multiple_choice' && !newQuestions[index].options?.length) {
                                        newQuestions[index].options = ["", "", "", ""];
                                    }
                                    setEditingExam({...editingExam, questions: newQuestions});
                                }}
                                >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                                    <SelectItem value="essay">Essay</SelectItem>
                                    <SelectItem value="short_answer">Short Answer</SelectItem>
                                </SelectContent>
                                </Select>

                                <Input
                                type="number"
                                value={question.points}
                                onChange={(e) => {
                                    const newQuestions = [...editingExam.questions];
                                    newQuestions[index].points = parseInt(e.target.value);
                                    setEditingExam({...editingExam, questions: newQuestions});
                                }}
                                placeholder="Points"
                                />
                            </div>

                            {question.type === 'multiple_choice' && (
                                <div className="space-y-2">
                                <Label>Answer Options</Label>
                                {question.options?.map((option, optIndex) => (
                                    <Input
                                    key={optIndex}
                                    value={option}
                                    onChange={(e) => {
                                        const newQuestions = [...editingExam.questions];
                                        if (!newQuestions[index].options) newQuestions[index].options = [];
                                        newQuestions[index].options[optIndex] = e.target.value;
                                        setEditingExam({...editingExam, questions: newQuestions});
                                    }}
                                    placeholder={`Option ${optIndex + 1}`}
                                    />
                                ))}
                                </div>
                            )}
                            </div>
                        </Card>
                        ))
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="settings" className="space-y-4">
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Shuffle Questions</Label>
                        <p className="text-sm text-slate-600">Randomize question order for each student</p>
                      </div>
                      <Switch
                        checked={editingExam.settings?.shuffle_questions}
                        onCheckedChange={(checked) => 
                          setEditingExam(prev => ({
                            ...prev,
                            settings: { ...prev.settings, shuffle_questions: checked }
                          }))
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Show Results Immediately</Label>
                        <p className="text-sm text-slate-600">Display results after exam submission</p>
                      </div>
                      <Switch
                        checked={editingExam.settings?.show_results_immediately}
                        onCheckedChange={(checked) => 
                          setEditingExam(prev => ({
                            ...prev,
                            settings: { ...prev.settings, show_results_immediately: checked }
                          }))
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Allow Backtracking</Label>
                        <p className="text-sm text-slate-600">Let students navigate back to previous questions</p>
                      </div>
                      <Switch
                        checked={editingExam.settings?.allow_backtrack}
                        onCheckedChange={(checked) => 
                          setEditingExam(prev => ({
                            ...prev,
                            settings: { ...prev.settings, allow_backtrack: checked }
                          }))
                        }
                      />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="proctoring" className="space-y-4">
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Strict Proctoring</Label>
                        <p className="text-sm text-slate-600">Enable comprehensive monitoring and restrictions</p>
                      </div>
                      <Switch
                        checked={editingExam.settings?.strict_proctoring}
                        onCheckedChange={(checked) => 
                          setEditingExam(prev => ({
                            ...prev,
                            settings: { ...prev.settings, strict_proctoring: checked }
                          }))
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Face Detection</Label>
                        <p className="text-sm text-slate-600">Monitor student's face during the exam</p>
                      </div>
                      <Switch
                        checked={editingExam.settings?.face_detection}
                        onCheckedChange={(checked) => 
                          setEditingExam(prev => ({
                            ...prev,
                            settings: { ...prev.settings, face_detection: checked }
                          }))
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Screen Recording</Label>
                        <p className="text-sm text-slate-600">Record student's screen activity</p>
                      </div>
                      <Switch
                        checked={editingExam.settings?.screen_recording}
                        onCheckedChange={(checked) => 
                          setEditingExam(prev => ({
                            ...prev,
                            settings: { ...prev.settings, screen_recording: checked }
                          }))
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Browser Lockdown</Label>
                        <p className="text-sm text-slate-600">Prevent students from leaving the exam window</p>
                      </div>
                      <Switch
                        checked={editingExam.settings?.browser_lockdown}
                        onCheckedChange={(checked) => 
                          setEditingExam(prev => ({
                            ...prev,
                            settings: { ...prev.settings, browser_lockdown: checked }
                          }))
                        }
                      />
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpdateExam} className="bg-indigo-600 hover:bg-indigo-700">
                Save Changes
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
