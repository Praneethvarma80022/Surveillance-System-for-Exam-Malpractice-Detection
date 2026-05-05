import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Label, Badge } from "@/components/ui";
import { User, Mail, Shield, Calendar, Edit, Save, X } from "lucide-react";
import "./Profile.css";

export default function ProfilePage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState("");
  const loadUserProfile = React.useCallback(async () => {
    try {
      const authStatus = localStorage.getItem('proctorguard_auth') === 'verified';
      if (!authStatus) {
        navigate(createPageUrl("Verification"));
        return;
      }

      const userData = await base44.auth.me();
      setUser(userData);
      setEditedName(userData.full_name || userData.email);
    } catch (error) {
      console.error("Error loading user:", error);
    } finally {
      setIsLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    const t = setTimeout(() => loadUserProfile(), 0);
    return () => clearTimeout(t);
  }, [loadUserProfile]);

  const handleSaveProfile = async () => {
    try {
      await base44.auth.updateMe({
        full_name: editedName
      });
      setUser({ ...user, full_name: editedName });
      setIsEditing(false);
    } catch (error) {
      console.error("Error updating profile:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="profile-loading">
        <div className="profile-loading-content">
          <div className="profile-loading-spinner"></div>
          <p className="profile-loading-text">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const userRole = localStorage.getItem('proctorguard_role') || 'student';

  return (
    <div className="profile-page">
      <div className="profile-content">
        {/* Header */}
        <div className="profile-header">
          <h1>My Profile</h1>
          <Button variant="outline" onClick={() => navigate(createPageUrl(userRole === 'admin' ? 'AdminDashboard' : 'Dashboard'))}>
            Back to Dashboard
          </Button>
        </div>

        {/* Profile Card */}
        <Card className="profile-main-card">
          <CardHeader className="profile-card-header">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center">
                <User className="w-10 h-10 text-white" />
              </div>
              <div>
                <CardTitle className="text-2xl">{user.full_name || user.email}</CardTitle>
                <Badge className={`mt-2 ${userRole === 'admin' ? 'bg-purple-500' : 'bg-blue-500'}`}>
                  {userRole === 'admin' ? 'Administrator' : 'Student'}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            {/* Basic Information */}
            <div className="profile-info-section">
              <h3 className="profile-info-title">
                <Shield className="w-5 h-5" />
                Basic Information
              </h3>
              
              <div className="profile-grid">
                <div className="profile-field">
                  <Label className="profile-label">Full Name</Label>
                  {isEditing ? (
                    <Input
                      value={editedName}
                      onChange={(e) => setEditedName(e.target.value)}
                      placeholder="Enter your name"
                    />
                  ) : (
                    <p className="profile-value">{user.full_name || "Not set"}</p>
                  )}
                </div>

                <div className="profile-field">
                  <Label className="profile-label">Email Address</Label>
                  <p className="profile-value flex-items-center">
                    <Mail className="w-4 h-4" style={{marginRight: '8px'}} />
                    {user.email}
                  </p>
                </div>

                <div className="profile-field">
                  <Label className="profile-label">Role</Label>
                  <p className="profile-value">
                    {userRole === 'admin' ? 'Administrator' : 'Student'}
                  </p>
                </div>

                <div className="profile-field">
                  <Label className="profile-label">Account Created</Label>
                  <p className="profile-value flex-items-center">
                    <Calendar className="w-4 h-4" style={{marginRight: '8px'}} />
                    {new Date(user.created_date).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Edit Actions */}
            <div className="profile-actions">
              {isEditing ? (
                <>
                  <Button variant="outline" onClick={() => {
                    setIsEditing(false);
                    setEditedName(user.full_name || user.email);
                  }}>
                    <X className="w-4 h-4 mr-2" />
                    Cancel
                  </Button>
                  <Button onClick={handleSaveProfile} className="profile-save-btn">
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </Button>
                </>
              ) : (
                <Button onClick={() => setIsEditing(true)} variant="outline">
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Profile
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Account Status */}
        <Card className="profile-status-card">
          <CardHeader>
            <CardTitle className="profile-status-title">Account Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="profile-status-grid">
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="font-semibold text-green-900">Verified</span>
                </div>
                <p className="text-sm text-green-700">Your account is verified and active</p>
              </div>

              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span className="font-semibold text-blue-900">Proctoring Enabled</span>
                </div>
                <p className="text-sm text-blue-700">Ready for monitored exams</p>
              </div>

              <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                  <span className="font-semibold text-purple-900">Session Active</span>
                </div>
                <p className="text-sm text-purple-700">Currently logged in</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}