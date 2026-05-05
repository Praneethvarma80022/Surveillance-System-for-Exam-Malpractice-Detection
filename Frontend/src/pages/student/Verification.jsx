import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle, Button, Alert, AlertDescription, Input } from "@/components/ui";
import { 
  Camera, Upload, CheckCircle, AlertCircle, User, 
  IdCard, Mail, Lock, Shield, Settings, Key 
} from "lucide-react";
import './Verification.css';
// Standardized imports from the entity hub
import { User as UserEntity, ExamCredential } from "@/entities/all";

export default function VerificationPage() {
  const navigate = useNavigate();
  
  // Refs for potential focus management or DOM interaction
  const containerRef = useRef(null);
  
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [loginMode, setLoginMode] = useState('student'); // 'student' or 'admin'
  const [formData, setFormData] = useState({
    studentId: "",
    email: "",
    verificationCode: "",
    examAccessId: "",
    examPassword: ""
  });
  const [error, setError] = useState("");
  const [generatedCode, setGeneratedCode] = useState('');
  const [userRole, setUserRole] = useState(null);

  // Effect to handle initial state or clean up local storage on visit
  useEffect(() => {
    // Only clear session data when ENTERING the verification page (step 1)
    // Do NOT clear during step transitions as we're storing data during the flow
    if (step === 1) {
      // Clear previous session data to ensure security on initial load
      localStorage.removeItem('proctorguard_auth');
      localStorage.removeItem('proctorguard_role');
      // Don't clear exam-related data here as we'll set them in step 1
    }
    
    // Optional: focus the first input if on step 1
    if (step === 1 && containerRef.current) {
      const firstInput = containerRef.current.querySelector('input');
      if (firstInput) firstInput.focus();
    }
  }, [step]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError("");
  };

  const validateCredentials = async () => {
    if (loginMode === 'admin') {
      if (!formData.email) {
        setError("Please enter admin email address");
        return;
      }

      if (!formData.email.toLowerCase().includes('admin')) {
        setError("Invalid admin credentials");
        return;
      }

      setIsLoading(true);
      setUserRole('admin');
      
      setTimeout(() => {
        setStep(2);
        setIsLoading(false);
      }, 1500);
      return;
    }

    if (!formData.examAccessId || !formData.examPassword) {
      setError("Please enter both Exam Access ID and Password");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      // Get all active credentials first
      console.log('Fetching all active credentials...');
      const allCredentials = await ExamCredential.list();
      
      console.log('[DEBUG] All credentials from API:', allCredentials);
      
      if (!allCredentials || allCredentials.length === 0) {
        setError("No exam credentials found. Please contact your instructor.");
        setIsLoading(false);
        return;
      }

      // Filter by Access ID and password
      const matchingCredentials = allCredentials.filter(c => {
        const isActive = c.is_active === true || c.is_active === 'true' || c.is_active === 1;
        const accessIdMatch = c.exam_access_id === formData.examAccessId;
        const passwordMatch = c.password === formData.examPassword;
        
        if (accessIdMatch && passwordMatch) {
          console.log('[DEBUG] Found matching credential:', c);
          console.log('[DEBUG] Credential exam_id value:', c.exam_id);
          console.log('[DEBUG] All credential fields:', Object.keys(c));
          console.log('[DEBUG] Full credential data:', {
            id: c.id,
            exam_access_id: c.exam_access_id,
            password: c.password,
            exam_id: c.exam_id,
            is_active: c.is_active,
            used_count: c.used_count,
            max_uses: c.max_uses,
            ...c
          });
        }
        
        return isActive && accessIdMatch && passwordMatch;
      });

      if (matchingCredentials.length === 0) {
        // Check if Access ID exists at all
        const idMatch = allCredentials.find(c => c.exam_access_id === formData.examAccessId);
        if (idMatch) {
          setError("Incorrect password. Please try again.");
        } else {
          setError("Invalid Exam Access ID. Please check and try again.");
        }
        setIsLoading(false);
        return;
      }

      const credential = matchingCredentials[0];

      if (credential.max_uses && credential.used_count >= credential.max_uses) {
        setError("This credential has reached its maximum number of uses.");
        setIsLoading(false);
        return;
      }

      // Debug: Check all fields in the credential
      console.log('[DEBUG] Full credential object:', credential);
      console.log('[DEBUG] exam_id value:', credential.exam_id);
      console.log('[DEBUG] Available credential fields:', Object.keys(credential));

      // Verify credential has exam_id (try multiple field name variations)
      let examId = credential.exam_id || credential.examId || credential.exam || credential.exam_uuid || null;
      
      // If exam_id is missing, try to find it from the exams based on other data
      if (!examId) {
        console.warn('[WARNING] exam_id not found in credential. Available fields:', Object.keys(credential));
        console.warn('[WARNING] Full credential:', credential);
        
        setError("This credential is not properly configured (missing exam). Please contact your instructor.");
        setIsLoading(false);
        return;
      }

      // Validate examId is a string with actual content
      if (typeof examId !== 'string' || examId.trim() === '') {
        console.error('[ERROR] examId is invalid:', { examId, type: typeof examId });
        setError("This credential is not properly configured (invalid exam ID). Please contact your instructor.");
        setIsLoading(false);
        return;
      }

      setUserRole('student');
      
      // Store exam ID for navigation to exam - validate storage
      try {
        localStorage.setItem('proctorguard_exam_id', examId);
        localStorage.setItem('proctorguard_credential_id', credential.id);
        localStorage.setItem('proctorguard_student_id', formData.examAccessId);
        
        // Immediately verify storage worked
        const storedExamId = localStorage.getItem('proctorguard_exam_id');
        const storedCredId = localStorage.getItem('proctorguard_credential_id');
        const storedStudentId = localStorage.getItem('proctorguard_student_id');
        
        if (!storedExamId || !storedCredId || !storedStudentId) {
          console.error('[ERROR] localStorage.setItem failed!', {
            set_exam_id: examId,
            actual_exam_id: storedExamId,
            set_cred_id: credential.id,
            actual_cred_id: storedCredId,
            set_student_id: formData.examAccessId,
            actual_student_id: storedStudentId
          });
          // Try again with a delay?
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (storageErr) {
        console.error('[ERROR] Cannot access localStorage:', storageErr);
        setError("Cannot save session data. Please check browser settings.");
        setIsLoading(false);
        return;
      }
      
      console.log('✓ Credential validated successfully:', { 
        exam_id: examId, 
        credential_id: credential.id,
        access_id: formData.examAccessId,
        ls_exam_id: localStorage.getItem('proctorguard_exam_id'),
        ls_cred_id: localStorage.getItem('proctorguard_credential_id'),
        ls_student_id: localStorage.getItem('proctorguard_student_id')
      });

      setTimeout(() => {
        setStep(2);
        setIsLoading(false);
      }, 1500);
    } catch (err) {
      console.error("Validation Error:", err);
      setError("An error occurred during validation. Please try again.");
      setIsLoading(false);
    }
  };

  const sendVerificationCode = async () => {
    setIsLoading(true);
    setError("");

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedCode(code);

    setTimeout(() => {
      setStep(3);
      setIsLoading(false);
    }, 2000);
  };

  const verifyCodeAndComplete = async () => {
    if (!formData.verificationCode) {
      setError("Please enter the verification code");
      return;
    }

    setIsLoading(true);
    setError("");

    if (formData.verificationCode === generatedCode) {
      localStorage.setItem('proctorguard_auth', 'verified');
      localStorage.setItem('proctorguard_role', userRole);
      
      try {
        const credentialId = localStorage.getItem('proctorguard_credential_id');
        if (credentialId && userRole === 'student') {
          // Get full credential data before updating to avoid 422 errors
          const allCredentials = await ExamCredential.list();
          const credData = allCredentials.find(c => c.id === credentialId);
          
          if (credData) {
            // Update with full credential data
            const updatePayload = {
              ...credData,
              used_count: (credData.used_count || 0) + 1
            };
            console.log('[VERIFICATION] Updating credential used_count:', updatePayload);
            await ExamCredential.update(credentialId, updatePayload);
          }
        }

        // Try to update user data, but don't fail the entire flow if it fails
        try {
          await UserEntity.updateMyUserData({
            role: userRole,
            student_id: userRole === 'student' ? formData.examAccessId : null,
            verification_status: 'verified',
            last_login: new Date().toISOString()
          });
        } catch (userErr) {
          console.warn("User data update failed (non-critical):", userErr);
          // Continue anyway - this is not critical
        }

      } catch (err) {
        console.error("Critical error during verification completion:", err);
        setError("An error occurred during verification. Please try again.");
        setIsLoading(false);
        return;
      }

      if (userRole === 'admin') {
        navigate(createPageUrl("AdminDashboard"));
      } else {
        const examId = localStorage.getItem('proctorguard_exam_id');
        const credentialId = localStorage.getItem('proctorguard_credential_id');
        const studentId = localStorage.getItem('proctorguard_student_id');
        
        console.log('Navigation after verification - Student:', { 
          examId,
          credentialId,
          studentId,
          allLS: { ...localStorage }
        });
        
        if (!examId) {
          console.error('ERROR: No examId found in localStorage after verification');
          console.error('Available localStorage keys:', Object.keys(localStorage));
          console.error('Full localStorage content:', {
            auth: localStorage.getItem('proctorguard_auth'),
            role: localStorage.getItem('proctorguard_role'),
            exam_id: localStorage.getItem('proctorguard_exam_id'),
            credential_id: localStorage.getItem('proctorguard_credential_id'),
            student_id: localStorage.getItem('proctorguard_student_id')
          });
          setError("Error: Exam ID not found. Please log in again.");
          setIsLoading(false);
          return;
        }
        
        navigate(createPageUrl(`SystemCheck?examId=${encodeURIComponent(examId)}`));
      }
      
      setIsLoading(false);
    } else {
      setError("Invalid verification code.");
      setIsLoading(false);
    }
  };

  return (
    <div ref={containerRef} className="verification-page">
      <div className="verification-content">
        <div className="verification-header">
          <div className="brand-icon">
            {userRole === 'admin' ? <Settings className="brand-icon-svg" /> : <Shield className="brand-icon-svg" />}
          </div>
          <h1 className="verification-title">
            {userRole === 'admin' ? 'Admin Authentication' : 'Secure Verification'}
          </h1>
          <p className="verification-subtitle">ProctorGuard identity verification system</p>
        </div>

        <div className="stepper-dots">
          {[1, 2, 3].map((stepNum) => (
            <div
              key={stepNum}
              className={`dot ${
                stepNum <= step ? "active" : ""
              }`}
            />
          ))}
        </div>

        {step === 1 && (
          <Card className="auth-card">
            <CardHeader className="auth-card-header">
              <CardTitle className="card-title">
                {loginMode === 'admin' ? 'Administrative Login' : 'Student Access'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="login-toggle">
                <Button
                  type="button"
                  onClick={() => setLoginMode('student')}
                  className={`toggle-btn ${loginMode === 'student' ? 'toggle-btn-active' : ''}`}
                  variant="ghost"
                >
                  Student
                </Button>
                <Button
                  type="button"
                  onClick={() => setLoginMode('admin')}
                  className={`toggle-btn ${loginMode === 'admin' ? 'toggle-btn-active' : ''}`}
                  variant="ghost"
                >
                  Administrator
                </Button>
              </div>

              {loginMode === 'student' ? (
                <div className="space-y-4">
                  <div className="input-wrapper">
                    <IdCard className="input-icon" />
                    <Input
                      placeholder="Exam Access ID"
                      value={formData.examAccessId}
                      onChange={(e) => handleInputChange("examAccessId", e.target.value)}
                      className="input-field"
                    />
                  </div>
                  <div className="input-wrapper">
                    <Lock className="input-icon" />
                    <Input
                      type="password"
                      placeholder="Exam Password"
                      value={formData.examPassword}
                      onChange={(e) => handleInputChange("examPassword", e.target.value)}
                      className="input-field"
                    />
                  </div>
                </div>
              ) : (
                <div className="input-wrapper">
                  <Mail className="input-icon" />
                  <Input
                    type="email"
                    placeholder="Admin Email"
                    value={formData.email}
                    onChange={(e) => handleInputChange("email", e.target.value)}
                    className="input-field"
                  />
                </div>
              )}

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button
                onClick={validateCredentials}
                disabled={isLoading}
                className="verify-button"
              >
                {isLoading ? "Checking..." : "Verify Identity"}
              </Button>
            </CardContent>
          </Card>
        )}

{step === 2 && (
          <Card className="auth-card">
            <CardHeader className="text-center">
              <CardTitle className="auth-title">MFA Challenge</CardTitle>
              <p className="auth-subtitle">Security verification required for your role</p>
            </CardHeader>
            <CardContent className="auth-stack">
              <div className="mfa-box-blue">
                <CheckCircle className="mfa-icon-blue" />
                <p className="mfa-id">{formData.examAccessId || formData.email}</p>
                <p className="mfa-label">Identity Pre-Verified</p>
              </div>
              <Button
                onClick={sendVerificationCode}
                disabled={isLoading}
                className="auth-btn"
              >
                {isLoading ? "Processing..." : "Generate Security Code"}
              </Button>
            </CardContent>
          </Card>
        )}

        {step === 3 && (
          <Card className="auth-card">
            <CardHeader className="text-center">
              <CardTitle className="auth-title">Enter Security Code</CardTitle>
              <p className="auth-subtitle">Input the 6-digit code to finalize access</p>
            </CardHeader>
            <CardContent className="auth-stack">
              <div className="mfa-box-green">
                <p className="mfa-code-label">Generated Access Code:</p>
                <p className="mfa-code-value">{generatedCode}</p>
              </div>

              <Input
                placeholder="000000"
                value={formData.verificationCode}
                onChange={(e) => handleInputChange("verificationCode", e.target.value)}
                className="mfa-input"
                maxLength={6}
              />

              {error && (
                <Alert variant="destructive" className="auth-alert">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button
                onClick={verifyCodeAndComplete}
                disabled={isLoading}
                className="auth-btn"
              >
                {isLoading ? "Authenticating..." : "Establish Secure Session"}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}