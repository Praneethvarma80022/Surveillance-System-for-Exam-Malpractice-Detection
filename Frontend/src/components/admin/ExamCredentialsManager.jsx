import React, { useState, useEffect } from "react";
import { Exam, ExamCredential } from "@/entities/all";
// Pointing to the file created in Step 1
import { Card, CardContent, CardHeader, CardTitle, Button } from "@/components/ui";
import { Input } from "@/components/ui";
import { Label } from "@/components/ui";
import { Badge } from "@/components/ui";
import { Alert, AlertDescription } from "@/components/ui";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui";
import { Key, Copy, Check, Plus, Eye, EyeOff, Trash2 } from "lucide-react";
import "./ExamCredentialsManager.css";

export default function ExamCredentialsManager() {
  const [exams, setExams] = useState([]);
  const [credentials, setCredentials] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [showPasswords, setShowPasswords] = useState({});
  
  const [newCredential, setNewCredential] = useState({
    exam_id: "",
    exam_access_id: "",
    password: "",
    max_uses: 1
  });
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [examsData, credentialsData] = await Promise.all([
        Exam.list(),
        ExamCredential.list()
      ]);
      setExams(examsData);
      setCredentials(credentialsData);
    } catch (error) {
      console.error("Error loading data:", error);
    }
    setIsLoading(false);
  };

  const generateRandomId = () => {
    return 'EXAM' + Math.random().toString(36).substring(2, 10).toUpperCase();
  };

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  };

  useEffect(() => {
    const t = setTimeout(() => {
      loadData();
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const handleCreateCredential = async () => {
    if (!newCredential.exam_id || !newCredential.exam_access_id || !newCredential.password) {
      return;
    }

    try {
      await ExamCredential.create(newCredential);
      await loadData();
      setShowCreateDialog(false);
      setNewCredential({
        exam_id: "",
        exam_access_id: "",
        password: "",
        max_uses: 1
      });
    } catch (error) {
      console.error("Error creating credential:", error);
    }
  };

  const handleDeleteCredential = async (credentialId) => {
    try {
      await ExamCredential.delete(credentialId);
      await loadData();
    } catch (error) {
      console.error("Error deleting credential:", error);
    }
  };

  const copyToClipboard = async (text, id) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      console.error("Copy failed:", error);
    }
  };

  const getExamTitle = (examId) => {
    const exam = exams.find(e => e.id === examId);
    return exam?.title || "Unknown Exam";
  };

  const togglePasswordVisibility = (credentialId) => {
    setShowPasswords(prev => ({
      ...prev,
      [credentialId]: !prev[credentialId]
    }));
  };

  return (
    <div className="exam-credentials-manager">
      <div className="credentials-header">
        <div className="credentials-header-content">
          <div className="credentials-header-info">
            <h2>
              <Key className="credentials-header-icon" />
              Exam Access Credentials
            </h2>
            <p>Create and manage login credentials for students to access exams</p>
          </div>
          <Button
            onClick={() => setShowCreateDialog(true)}
            className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Credential
          </Button>
        </div>
      </div>

      <div className="credentials-content">
        {isLoading ? (
          <div className="credentials-empty">
            <p>Loading credentials...</p>
          </div>
        ) : credentials.length === 0 ? (
          <div className="credentials-empty">
            <Key className="credentials-empty-icon" />
            <div className="credentials-empty-title">No exam credentials created yet</div>
            <p className="credentials-empty-description">Create credentials for students to access exams</p>
          </div>
        ) : (
          <div className="credentials-list">
            {credentials.map((credential) => (
              <div key={credential.id} className="credential-item">
                <div className="credential-item-header">
                  <div className="flex-1">
                    <p className="credential-item-title">{getExamTitle(credential.exam_id)}</p>
                    <div className="credential-item-meta">
                      <span className={`credential-badge ${credential.is_active ? 'active' : 'inactive'}`}>
                        {credential.is_active ? '✓ Active' : 'Inactive'}
                      </span>
                      <span className="credential-usage">
                        Used: {credential.used_count || 0}/{credential.max_uses || '∞'}
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteCredential(credential.id)}
                    className="delete-button"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>

                <div className="credential-fields">
                  <div className="credential-field">
                    <Label className="credential-field-label">Exam Access ID</Label>
                    <div className="credential-field-input">
                      <div className="credential-field-value">
                        {credential.exam_access_id}
                      </div>
                      <Button
                        size="sm"
                        className="credential-button"
                        onClick={() => copyToClipboard(credential.exam_access_id, `id-${credential.id}`)}
                      >
                        {copiedId === `id-${credential.id}` ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  <div className="credential-field">
                    <Label className="credential-field-label">Password</Label>
                    <div className="credential-field-input">
                      <div className="credential-field-value">
                        {showPasswords[credential.id] ? credential.password : '••••••••••'}
                      </div>
                      <Button
                        size="sm"
                        className="credential-button"
                        onClick={() => togglePasswordVisibility(credential.id)}
                      >
                        {showPasswords[credential.id] ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        className="credential-button"
                        onClick={() => copyToClipboard(credential.password, `pwd-${credential.id}`)}
                      >
                        {copiedId === `pwd-${credential.id}` ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Credential Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="credentials-dialog">
          <div className="credentials-dialog-header">
            <h2>Create Exam Credential</h2>
          </div>
          <div className="credentials-dialog-form">
            <div className="form-group">
              <Label className="form-label">Select Exam *</Label>
              <div style={{ position: 'relative' }}>
                <Select
                  value={newCredential.exam_id}
                  onValueChange={(value) => setNewCredential({...newCredential, exam_id: value})}
                >
                  <SelectTrigger className="form-input">
                    <SelectValue placeholder="Choose an exam" />
                  </SelectTrigger>
                  <SelectContent>
                    {exams && exams.length > 0 ? (
                      exams.map((exam) => (
                        <SelectItem key={exam.id} value={exam.id}>
                          {exam.title}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="" disabled>
                        No exams available
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="form-group">
              <Label className="form-label">Exam Access ID *</Label>
              <div className="form-input-group">
                <Input
                  value={newCredential.exam_access_id}
                  onChange={(e) => setNewCredential({...newCredential, exam_access_id: e.target.value})}
                  placeholder="e.g., EXAM12345"
                  className="form-input flex-1"
                />
                <Button
                  type="button"
                  className="form-button-secondary"
                  onClick={() => setNewCredential({...newCredential, exam_access_id: generateRandomId()})}
                >
                  Generate
                </Button>
              </div>
            </div>

            <div className="form-group">
              <Label className="form-label">Password *</Label>
              <div className="form-input-group">
                <Input
                  type="text"
                  value={newCredential.password}
                  onChange={(e) => setNewCredential({...newCredential, password: e.target.value})}
                  placeholder="Enter password"
                  className="form-input flex-1"
                />
                <Button
                  type="button"
                  className="form-button-secondary"
                  onClick={() => setNewCredential({...newCredential, password: generateRandomPassword()})}
                >
                  Generate
                </Button>
              </div>
            </div>

            <div className="form-group">
              <Label className="form-label">Max Uses (Optional)</Label>
              <Input
                type="number"
                value={newCredential.max_uses}
                onChange={(e) => setNewCredential({...newCredential, max_uses: parseInt(e.target.value) || 1})}
                placeholder="Number of students who can use this credential"
                min="1"
                className="form-input"
              />
            </div>

            <Alert className="info-alert">
              <AlertDescription className="info-alert-text">
                <strong>Share the generated credentials with students.</strong> They will use the Exam Access ID and Password to login and access the exam.
              </AlertDescription>
            </Alert>

            <div className="dialog-actions">
              <Button
                onClick={() => setShowCreateDialog(false)}
                className="dialog-action-button cancel"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateCredential}
                disabled={!newCredential.exam_id || !newCredential.exam_access_id || !newCredential.password}
                className="dialog-action-button primary"
              >
                Create Credential
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}